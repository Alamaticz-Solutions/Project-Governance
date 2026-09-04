//! Project workspace assembly (spec 002) — re-expression of the legacy
//! `workspace_service::get_workspace`: one payload with the project, its gate
//! submissions, its approval chain, a recent audit slice, and the derived
//! gate eligibility.

use std::sync::Arc;

use serde_json::json;

use crate::{
    product_api::{DataAccess, EntityType, HandlerResult, JsonValue, UserAuth},
    schemas::governance::{
        AuditEventProjection, GateSubmissionProjection, ProjectApprovalProjection,
        ProjectProjection,
    },
    services::{
        gate_eligibility,
        support::{entity, field, selection},
    },
};

pub async fn assemble(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    _entity_type: &Arc<EntityType>,
    project_id: String,
) -> HandlerResult<JsonValue> {
    let project_type = entity(data_access, "Project")?;
    let project = data_access
        .find_item::<ProjectProjection>(
            project_type,
            selection(
                "project",
                &[
                    field("id"),
                    field("project_number"),
                    field("project_name"),
                    field("business_unit"),
                    field("status"),
                    field("priority"),
                    field("risk_level"),
                    field("manager_id"),
                    field("current_stage"),
                    field("current_owner_role"),
                    field("workflow_status"),
                    field("has_phi_data"),
                    field("is_clinical"),
                    field("version"),
                ],
            ),
            project_id.clone(),
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?
        .ok_or_else(|| anyhow::anyhow!("project `{project_id}` was not found"))?;

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
                    field("data"),
                    field("submitted_at"),
                    field("version"),
                ],
            ),
            Some(json!({ "project_id": { "_eq": project_id } })),
            Some(json!([{ "field": "stage", "direction": "asc" }])),
            0,
            200,
            None,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    let approvals_type = entity(data_access, "ProjectApproval")?;
    let approvals = data_access
        .query_items::<ProjectApprovalProjection>(
            approvals_type,
            selection(
                "project_approvals",
                &[
                    field("id"),
                    field("approval_stage"),
                    field("assigned_role"),
                    field("status"),
                    field("decision"),
                    field("sequence_order"),
                    field("approved_at"),
                ],
            ),
            Some(json!({ "project_id": { "_eq": project_id } })),
            Some(json!([{ "field": "sequence_order", "direction": "asc" }])),
            0,
            200,
            None,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    let audit_type = entity(data_access, "AuditEvent")?;
    let events = data_access
        .query_items::<AuditEventProjection>(
            audit_type,
            selection(
                "audit_events",
                &[
                    field("id"),
                    field("action"),
                    field("entity_type"),
                    field("entity_id"),
                    field("new_values"),
                    field("performed_at"),
                ],
            ),
            Some(json!({ "project_id": { "_eq": project_id } })),
            Some(json!([{ "field": "performed_at", "direction": "desc" }])),
            0,
            25,
            None,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    let eligibility = gate_eligibility::compute(data_access, user, project_id.clone()).await?;

    Ok(json!({
        "project": {
            "id": project.id,
            "project_number": project.project_number,
            "project_name": project.project_name,
            "business_unit": project.business_unit,
            "status": project.status.map(|s| format!("{s:?}")),
            "priority": project.priority.map(|p| format!("{p:?}")),
            "risk_level": project.risk_level.map(|r| format!("{r:?}")),
            "manager_id": project.manager_id,
            "current_stage": project.current_stage,
            "current_owner_role": project.current_owner_role,
            "workflow_status": project.workflow_status,
            "has_phi_data": project.has_phi_data,
            "is_clinical": project.is_clinical,
            "version": project.version,
        },
        "gate_submissions": subs.items.into_iter().map(|s| json!({
            "id": s.id, "stage": s.stage, "status": s.status, "decision": s.decision,
            "data": s.data, "submitted_at": s.submitted_at, "version": s.version,
        })).collect::<Vec<_>>(),
        "approvals": approvals.items.into_iter().map(|a| json!({
            "id": a.id, "approval_stage": a.approval_stage,
            "assigned_role": a.assigned_role.as_ref().map(|r| format!("{r:?}")),
            "status": a.status, "decision": a.decision, "sequence_order": a.sequence_order,
            "approved_at": a.approved_at,
        })).collect::<Vec<_>>(),
        "recent_audit": events.items.into_iter().map(|e| json!({
            "id": e.id, "action": e.action, "entity_type": e.entity_type,
            "entity_id": e.entity_id, "new_values": e.new_values, "performed_at": e.performed_at,
        })).collect::<Vec<_>>(),
        "eligibility": eligibility,
    }))
}
