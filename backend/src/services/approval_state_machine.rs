//! Approval state machine (spec 002). Re-expression of the legacy
//! `project_service::submit_decision` / `fast_track_complete` / soft-cancel
//! against the framework Query IR (`DataAccess`), NOT a port of the 980-line
//! original. Per-record stage-ownership (`assigned_role == actor role`) is
//! enforced here — it is not expressible as a single-row Rego filter
//! (spec 001 / spec 002 authorization split).

use std::sync::Arc;

use chrono::Utc;
use serde_json::json;

use crate::{
    product_api::{DataAccess, EntityType, HandlerResult, JsonValue, UserAuth},
    schemas::governance::{
        InputProject, InputProjectApproval, ProjectApprovalProjection, ProjectPriority,
        ProjectProjection, ProjectStatus,
    },
    services::{
        audit,
        notification,
        support::{
            entity, field, has_any_role, has_role, primary_role, require_user, resolve_user_id,
            selection,
        },
    },
    schemas::governance::NotificationType,
};

fn role_str(role: &crate::schemas::governance::UserRole) -> String {
    format!("{role:?}").to_ascii_lowercase()
}

fn approval_selection() -> JsonValue {
    selection(
        "project_approvals",
        &[
            field("id"),
            field("project_id"),
            field("approval_stage"),
            field("assigned_role"),
            field("assigned_user_id"),
            field("status"),
            field("decision"),
            field("comments"),
            field("sequence_order"),
            field("notification_sent"),
            field("created_at"),
            field("version"),
        ],
    )
}

async fn load_approvals(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    approvals_type: &Arc<EntityType>,
    project_id: &str,
) -> HandlerResult<Vec<ProjectApprovalProjection>> {
    let res = data_access
        .query_items::<ProjectApprovalProjection>(
            approvals_type.clone(),
            approval_selection(),
            Some(json!({ "project_id": { "_eq": project_id } })),
            Some(json!([{ "field": "sequence_order", "direction": "asc" }])),
            0,
            500,
            None,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    Ok(res.items)
}

fn approval_input(p: &ProjectApprovalProjection) -> HandlerResult<InputProjectApproval> {
    Ok(InputProjectApproval {
        id: p.id.clone(),
        project_id: p
            .project_id
            .clone()
            .ok_or_else(|| anyhow::anyhow!("approval missing project_id"))?,
        approval_stage: p.approval_stage.clone().unwrap_or_default(),
        assigned_role: p
            .assigned_role
            .ok_or_else(|| anyhow::anyhow!("approval missing assigned_role"))?,
        assigned_user_id: p.assigned_user_id.clone(),
        status: p.status.clone().unwrap_or_else(|| "Pending".to_string()),
        decision: p.decision.clone(),
        comments: p.comments.clone(),
        approved_by: p.approved_by.clone(),
        approved_at: p.approved_at,
        sequence_order: p.sequence_order.unwrap_or(0),
        notification_sent: p.notification_sent.unwrap_or(false),
        created_at: p.created_at.unwrap_or_else(Utc::now),
        updated_at: p.updated_at,
        version: p.version,
    })
}

/// `payload`: `{ "decision": "approve" | "reject" | "needs_info", "comments"?: string }`
pub async fn submit_decision(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    _entity_type: &Arc<EntityType>,
    project_id: String,
    payload: JsonValue,
) -> HandlerResult<JsonValue> {
    let actor = require_user(user)?;
    let decision = payload
        .get("decision")
        .and_then(|d| d.as_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let comments = payload
        .get("comments")
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());
    let (new_status, event) = match decision.as_str() {
        "approve" | "approved" => ("Approved", audit::GATE_APPROVED),
        "reject" | "rejected" => ("Rejected", audit::GATE_REJECTED),
        "needs_info" | "changes_requested" | "return" => ("Returned", audit::GATE_RETURNED),
        other => return Err(anyhow::anyhow!("unknown decision `{other}`")),
    };

    let approvals_type = entity(data_access, "ProjectApproval")?;
    let approvals = load_approvals(data_access, user, &approvals_type, &project_id).await?;
    let actor_role = primary_role(&actor);
    let is_privileged = has_any_role(&actor, &["admin", "epmo"]);

    let target = approvals
        .iter()
        .find(|a| {
            a.status
                .as_deref()
                .map(|s| s.eq_ignore_ascii_case("pending"))
                .unwrap_or(false)
                && (is_privileged
                    || a.assigned_role
                        .as_ref()
                        .map(|r| role_str(r) == actor_role)
                        .unwrap_or(false))
        })
        .ok_or_else(|| {
            anyhow::anyhow!("no pending approval addressed to your role for this project")
        })?;

    let approver_id = resolve_user_id(data_access, user).await?;
    let mut input = approval_input(target)?;
    input.status = new_status.to_string();
    input.decision = Some(decision.clone());
    input.comments = comments.clone();
    input.approved_by = approver_id;
    input.approved_at = Some(Utc::now());

    let sel = selection(
        "project_approval",
        &[field("id"), field("status"), field("decision"), field("sequence_order"), field("version")],
    );
    let updated = data_access
        .update_item::<InputProjectApproval, ProjectApprovalProjection>(
            approvals_type.clone(),
            sel,
            input,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    audit::record(
        data_access,
        user,
        Some(project_id.clone()),
        "ProjectApproval",
        updated.id.as_deref().unwrap_or(""),
        event,
        Some(json!({ "decision": decision, "comments": comments, "stage": target.approval_stage })),
    )
    .await?;

    // On approve, surface the next pending approval and notify its role.
    let mut next_stage: Option<String> = None;
    if new_status == "Approved" {
        if let Some(next) = approvals.iter().find(|a| {
            a.sequence_order.unwrap_or(0) > target.sequence_order.unwrap_or(0)
                && a.status
                    .as_deref()
                    .map(|s| s.eq_ignore_ascii_case("pending"))
                    .unwrap_or(false)
        }) {
            next_stage = next.approval_stage.clone();
            if let Some(role) = next.assigned_role.as_ref() {
                notification::notify_role(
                    data_access,
                    user,
                    &format!("{role:?}"),
                    Some(project_id.clone()),
                    NotificationType::APPROVAL_REQUIRED,
                    "Approval required",
                    &format!(
                        "Project {project_id} is ready for your review at stage {}",
                        next_stage.as_deref().unwrap_or("(next)")
                    ),
                )
                .await?;
            }
        } else {
            audit::record(
                data_access,
                user,
                Some(project_id.clone()),
                "Project",
                &project_id,
                audit::WORKFLOW_ADVANCED,
                Some(json!({ "note": "all approvals complete" })),
            )
            .await?;
        }
    }

    Ok(json!({
        "ok": true,
        "project_id": project_id,
        "approval_id": updated.id,
        "decision": decision,
        "status": new_status,
        "next_stage": next_stage,
        "workflow_complete": new_status == "Approved" && next_stage.is_none(),
    }))
}

pub async fn pending_approvals(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    project_id: String,
) -> HandlerResult<JsonValue> {
    let actor = require_user(user)?;
    let approvals_type = entity(data_access, "ProjectApproval")?;
    let all = load_approvals(data_access, user, &approvals_type, &project_id).await?;
    let actor_role = primary_role(&actor);
    let privileged = has_any_role(&actor, &["admin", "epmo"]);

    let items: Vec<JsonValue> = all
        .into_iter()
        .filter(|a| {
            a.status
                .as_deref()
                .map(|s| s.eq_ignore_ascii_case("pending"))
                .unwrap_or(false)
        })
        .filter(|a| {
            privileged
                || a.assigned_role
                    .as_ref()
                    .map(|r| role_str(r) == actor_role)
                    .unwrap_or(false)
        })
        .map(|a| {
            json!({
                "id": a.id,
                "project_id": a.project_id,
                "approval_stage": a.approval_stage,
                "assigned_role": a.assigned_role.as_ref().map(|r| format!("{r:?}")),
                "sequence_order": a.sequence_order,
                "status": a.status,
            })
        })
        .collect();

    Ok(json!({ "project_id": project_id, "count": items.len(), "items": items }))
}

fn project_selection() -> JsonValue {
    selection(
        "project",
        &[
            field("id"),
            field("project_number"),
            field("project_name"),
            field("business_unit"),
            field("manager_id"),
            field("priority"),
            field("status"),
            field("created_at"),
            field("current_stage"),
            field("current_status"),
            field("workflow_status"),
            field("version"),
        ],
    )
}

fn project_input(p: &ProjectProjection) -> HandlerResult<InputProject> {
    Ok(InputProject {
        id: p.id.clone(),
        project_number: p.project_number.clone().unwrap_or_default(),
        project_name: p.project_name.clone().unwrap_or_default(),
        business_unit: p.business_unit.clone().unwrap_or_default(),
        department: p.department.clone(),
        manager_id: p
            .manager_id
            .clone()
            .ok_or_else(|| anyhow::anyhow!("project missing manager_id"))?,
        sponsor_name: p.sponsor_name.clone(),
        sponsor_email: p.sponsor_email.clone(),
        description: p.description.clone(),
        problem_statement: p.problem_statement.clone(),
        business_value: p.business_value.clone(),
        strategic_alignment: p.strategic_alignment.clone(),
        requestor_name: p.requestor_name.clone(),
        request_type: p.request_type.clone(),
        desired_outcome: p.desired_outcome.clone(),
        what_do_you_do_today: p.what_do_you_do_today.clone(),
        what_transpires_if_nothing: p.what_transpires_if_nothing.clone(),
        notes: p.notes.clone(),
        budget_estimated: p.budget_estimated,
        budget_approved: p.budget_approved,
        budget_type: p.budget_type.clone(),
        requested_start_date: p.requested_start_date,
        requested_end_date: p.requested_end_date,
        actual_start_date: p.actual_start_date,
        actual_end_date: p.actual_end_date,
        priority: p.priority.unwrap_or(ProjectPriority::MEDIUM),
        risk_level: p.risk_level,
        status: p.status.unwrap_or(ProjectStatus::DRAFT),
        it_involvement: p.it_involvement,
        vendor_required: p.vendor_required,
        has_phi_data: p.has_phi_data,
        is_clinical: p.is_clinical,
        is_hipaa_applicable: p.is_hipaa_applicable,
        smartsheet_row_id: p.smartsheet_row_id.clone(),
        smartsheet_sheet_url: p.smartsheet_sheet_url.clone(),
        jira_ticket_id: p.jira_ticket_id.clone(),
        duplicate_of_id: p.duplicate_of_id.clone(),
        is_duplicate: p.is_duplicate,
        ai_extracted_data: p.ai_extracted_data.clone(),
        current_stage: p.current_stage.clone(),
        current_status: p.current_status.clone(),
        current_owner_role: p.current_owner_role.clone(),
        last_stage_completed: p.last_stage_completed.clone(),
        workflow_status: p.workflow_status.clone(),
        submitted_at: p.submitted_at,
        created_at: p.created_at.unwrap_or_else(Utc::now),
        updated_at: p.updated_at,
        archived_at: p.archived_at,
        version: p.version,
    })
}

async fn load_project(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    project_type: &Arc<EntityType>,
    project_id: &str,
) -> HandlerResult<ProjectProjection> {
    data_access
        .find_item::<ProjectProjection>(
            project_type.clone(),
            project_selection(),
            project_id.to_string(),
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?
        .ok_or_else(|| anyhow::anyhow!("project `{project_id}` was not found"))
}

pub async fn fast_track_complete(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    project_id: String,
) -> HandlerResult<JsonValue> {
    let actor = require_user(user)?;
    if !has_role(&actor, "admin") {
        return Err(anyhow::anyhow!("fast-track completion is admin-only"));
    }
    let approvals_type = entity(data_access, "ProjectApproval")?;
    let approvals = load_approvals(data_access, user, &approvals_type, &project_id).await?;
    let approver_id = resolve_user_id(data_access, user).await?;
    let mut approved = 0usize;
    for a in &approvals {
        if a.status
            .as_deref()
            .map(|s| s.eq_ignore_ascii_case("pending"))
            .unwrap_or(false)
        {
            let mut input = approval_input(a)?;
            input.status = "Approved".to_string();
            input.decision = Some("approve".to_string());
            input.comments = Some("fast-tracked by admin".to_string());
            input.approved_by = approver_id.clone();
            input.approved_at = Some(Utc::now());
            let sel = selection("project_approval", &[field("id"), field("status"), field("version")]);
            data_access
                .update_item::<InputProjectApproval, ProjectApprovalProjection>(
                    approvals_type.clone(),
                    sel,
                    input,
                    user.clone(),
                )
                .await
                .map_err(|e| anyhow::anyhow!(e.to_string()))?;
            approved += 1;
        }
    }

    let project_type = entity(data_access, "Project")?;
    let project = load_project(data_access, user, &project_type, &project_id).await?;
    let mut pinput = project_input(&project)?;
    pinput.status = ProjectStatus::COMPLETED;
    pinput.workflow_status = Some("Completed".to_string());
    data_access
        .update_item::<InputProject, ProjectProjection>(
            project_type,
            project_selection(),
            pinput,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    audit::record(
        data_access,
        user,
        Some(project_id.clone()),
        "Project",
        &project_id,
        audit::WORKFLOW_ADVANCED,
        Some(json!({ "fast_track": true, "approvals_auto_approved": approved })),
    )
    .await?;

    Ok(json!({ "ok": true, "project_id": project_id, "approvals_auto_approved": approved, "status": "COMPLETED" }))
}

/// Legacy "delete" == status transition to CANCELLED (000-INDEX reconciled
/// point 3). Not the `soft-deleted` facet.
pub async fn cancel(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    project_id: String,
    reason: String,
) -> HandlerResult<JsonValue> {
    let actor = require_user(user)?;
    if !has_any_role(&actor, &["admin", "epmo"]) {
        return Err(anyhow::anyhow!("cancelling a project requires admin or epmo"));
    }
    let project_type = entity(data_access, "Project")?;
    let project = load_project(data_access, user, &project_type, &project_id).await?;
    let mut pinput = project_input(&project)?;
    pinput.status = ProjectStatus::CANCELLED;
    pinput.workflow_status = Some("Cancelled".to_string());
    let updated = data_access
        .update_item::<InputProject, ProjectProjection>(
            project_type,
            project_selection(),
            pinput,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    audit::record(
        data_access,
        user,
        Some(project_id.clone()),
        "Project",
        &project_id,
        audit::PROJECT_CANCELLED,
        Some(json!({ "reason": reason })),
    )
    .await?;

    Ok(json!({ "ok": true, "project_id": project_id, "status": "CANCELLED", "version": updated.version }))
}
