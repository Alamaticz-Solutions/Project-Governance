//! Gate-review decisions (spec 002). Re-expression of the legacy
//! `gate_review_service::submit_gate_decision`. Per-record ownership
//! (`assigned_role == actor role`, admin override) is enforced here — not
//! expressible as a single-row Rego filter.

use std::sync::Arc;

use chrono::Utc;
use serde_json::json;

use crate::{
    product_api::{DataAccess, HandlerResult, JsonValue, UserAuth},
    schemas::governance::{ApprovalDecision, GateReviewProjection, InputGateReview},
    services::{
        audit,
        support::{entity, field, has_role, primary_role, require_user, resolve_user_id, selection},
    },
};

fn review_selection() -> JsonValue {
    selection(
        "gate_review",
        &[
            field("id"),
            field("project_id"),
            field("gate_code"),
            field("gate_name"),
            field("committee"),
            field("assigned_role"),
            field("status"),
            field("decision"),
            field("decision_notes"),
            field("checklist_items"),
            field("submitted_at"),
            field("due_date"),
            field("priority"),
            field("version"),
        ],
    )
}

fn input_from(p: &GateReviewProjection) -> HandlerResult<InputGateReview> {
    Ok(InputGateReview {
        id: p.id.clone(),
        project_id: p
            .project_id
            .clone()
            .ok_or_else(|| anyhow::anyhow!("gate review missing project_id"))?,
        gate_code: p
            .gate_code
            .ok_or_else(|| anyhow::anyhow!("gate review missing gate_code"))?,
        gate_name: p.gate_name.clone().unwrap_or_default(),
        committee: p.committee.clone(),
        assigned_role: p.assigned_role,
        status: p.status.clone(),
        decision: p.decision,
        decision_by_id: p.decision_by_id.clone(),
        decision_at: p.decision_at,
        decision_notes: p.decision_notes.clone(),
        checklist_items: p.checklist_items.clone(),
        submitted_at: p.submitted_at,
        due_date: p.due_date,
        priority: p.priority,
        version: p.version,
    })
}

/// `payload`: `{ "decision": "approved" | "rejected" | "needs_info" | "deferred", "notes"?: string }`
pub async fn decide(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    gate_id: String,
    payload: JsonValue,
) -> HandlerResult<JsonValue> {
    let actor = require_user(user)?;
    let raw = payload
        .get("decision")
        .and_then(|d| d.as_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let notes = payload
        .get("notes")
        .and_then(|n| n.as_str())
        .map(|s| s.to_string());
    let (decision, status_str, event) = match raw.as_str() {
        "approved" | "approve" => (ApprovalDecision::APPROVED, "approved", audit::GATE_APPROVED),
        "rejected" | "reject" => (ApprovalDecision::REJECTED, "rejected", audit::GATE_REJECTED),
        "needs_info" | "changes_requested" => {
            (ApprovalDecision::NEEDS_INFO, "changes_requested", audit::GATE_RETURNED)
        }
        "deferred" | "defer" => (ApprovalDecision::DEFERRED, "deferred", audit::GATE_RETURNED),
        other => return Err(anyhow::anyhow!("unknown gate decision `{other}`")),
    };

    let review_type = entity(data_access, "GateReview")?;
    let review = data_access
        .find_item::<GateReviewProjection>(
            review_type.clone(),
            review_selection(),
            gate_id.clone(),
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?
        .ok_or_else(|| anyhow::anyhow!("gate review `{gate_id}` was not found"))?;

    let owns = has_role(&actor, "admin")
        || review
            .assigned_role
            .as_ref()
            .map(|r| format!("{r:?}").to_ascii_lowercase() == primary_role(&actor))
            .unwrap_or(false);
    if !owns {
        return Err(anyhow::anyhow!(
            "only the assigned reviewer role or an admin may decide this gate"
        ));
    }

    let mut input = input_from(&review)?;
    input.status = Some(status_str.to_string());
    input.decision = Some(decision);
    input.decision_by_id = resolve_user_id(data_access, user).await?;
    input.decision_at = Some(Utc::now());
    input.decision_notes = notes.clone();

    let updated = data_access
        .update_item::<InputGateReview, GateReviewProjection>(
            review_type,
            selection("gate_review", &[field("id"), field("status"), field("decision"), field("version")]),
            input,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    audit::record(
        data_access,
        user,
        review.project_id.clone(),
        "GateReview",
        &gate_id,
        event,
        Some(json!({ "decision": status_str, "notes": notes, "gate": review.gate_name })),
    )
    .await?;

    Ok(json!({
        "ok": true,
        "gate_id": gate_id,
        "project_id": review.project_id,
        "decision": status_str,
        "version": updated.version,
    }))
}
