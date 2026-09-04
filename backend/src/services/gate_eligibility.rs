//! Gate-eligibility engine (spec 002). Evaluates each configured stage
//! definition's `prerequisites` against the project's completed gate
//! submissions and returns the derived state per stage:
//! `SATISFIED | ELIGIBLE | LOCKED`.
//!
//! PROVISIONAL: reads the seeded "Standard Project Lifecycle v2" stage
//! definitions (legacy `seed_workflow_definitions` DAG). The authoritative
//! Excel gate/field matrix (spec 002 Open decision P5) is not yet available;
//! `conditions` (field-driven applicability / skip) are not evaluated here.

use std::{collections::HashSet, sync::Arc};

use serde_json::json;

use crate::{
    product_api::{DataAccess, HandlerResult, JsonValue, UserAuth},
    schemas::governance::{GateSubmissionProjection, WorkflowStageDefinitionProjection},
    services::support::{entity, field, selection},
};

fn is_satisfied(sub: &GateSubmissionProjection) -> bool {
    let decision_ok = sub
        .decision
        .as_deref()
        .map(|d| d.eq_ignore_ascii_case("approved"))
        .unwrap_or(false);
    let status_ok = sub
        .status
        .as_deref()
        .map(|s| s.eq_ignore_ascii_case("submitted") || s.eq_ignore_ascii_case("approved"))
        .unwrap_or(false);
    decision_ok || status_ok
}

fn prereq_gates(def: &WorkflowStageDefinitionProjection) -> Vec<String> {
    def.prerequisites
        .as_ref()
        .and_then(|p| p.get("gates"))
        .and_then(|g| g.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

pub async fn compute(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    project_id: String,
) -> HandlerResult<JsonValue> {
    let defs_type = entity(data_access, "WorkflowStageDefinition")?;
    let defs = data_access
        .query_items::<WorkflowStageDefinitionProjection>(
            defs_type,
            selection(
                "workflow_stage_definitions",
                &[
                    field("id"),
                    field("stage_code"),
                    field("stage_name"),
                    field("phase_name"),
                    field("sequence_order"),
                    field("prerequisites"),
                    field("parallel_execution"),
                ],
            ),
            None,
            Some(json!([{ "field": "sequence_order", "direction": "asc" }])),
            0,
            500,
            None,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    let subs_type = entity(data_access, "GateSubmission")?;
    let subs = data_access
        .query_items::<GateSubmissionProjection>(
            subs_type,
            selection(
                "gate_submissions",
                &[
                    field("id"),
                    field("stage"),
                    field("status"),
                    field("decision"),
                ],
            ),
            Some(json!({ "project_id": { "_eq": project_id } })),
            None,
            0,
            500,
            None,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    let satisfied_codes: HashSet<String> = subs
        .items
        .iter()
        .filter(|s| is_satisfied(s))
        .filter_map(|s| s.stage.clone())
        .collect();

    let mut gates = Vec::new();
    let mut eligible_count = 0usize;
    for def in &defs.items {
        let code = def.stage_code.clone().unwrap_or_default();
        let prereqs = prereq_gates(def);
        let prereqs_met = prereqs.iter().all(|g| satisfied_codes.contains(g));
        let state = if satisfied_codes.contains(&code) {
            "SATISFIED"
        } else if prereqs_met {
            eligible_count += 1;
            "ELIGIBLE"
        } else {
            "LOCKED"
        };
        gates.push(json!({
            "stage_code": code,
            "stage_name": def.stage_name,
            "phase": def.phase_name,
            "sequence_order": def.sequence_order,
            "prerequisites": prereqs,
            "prerequisites_met": prereqs_met,
            "state": state,
        }));
    }

    Ok(json!({
        "project_id": project_id,
        "provisional": true,
        "note": "pending the authoritative Excel gate/field matrix (spec 002 P5); conditions/skip not evaluated",
        "eligible_count": eligible_count,
        "gates": gates,
    }))
}
