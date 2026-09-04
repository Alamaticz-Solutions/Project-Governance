//! Per-gate lifecycle transitions on `WorkflowStage` (spec 002) + gate-form
//! upsert on `GateSubmission`. Re-expression of the legacy `TransitionService`
//! and `workspace_service::save_stage`. Illegal transitions are rejected.

use std::sync::Arc;

use chrono::Utc;
use serde_json::json;

use crate::{
    product_api::{DataAccess, HandlerResult, JsonValue, UserAuth},
    schemas::governance::{
        GateSubmissionProjection, InputGateSubmission, InputWorkflowStage, WorkflowStageProjection,
        WorkflowStageStatus,
    },
    services::{
        audit,
        support::{entity, field, primary_role, require_user, resolve_user_id, selection},
    },
};

fn stage_selection() -> JsonValue {
    selection(
        "workflow_stage",
        &[
            field("id"),
            field("workflow_instance_id"),
            field("stage_definition_id"),
            field("stage_name"),
            field("stage_code"),
            field("sequence_order"),
            field("status"),
            field("started_at"),
            field("completed_at"),
            field("due_date"),
            field("notes"),
            field("version"),
        ],
    )
}

fn stage_input(
    p: &WorkflowStageProjection,
    status: WorkflowStageStatus,
) -> HandlerResult<InputWorkflowStage> {
    Ok(InputWorkflowStage {
        id: p.id.clone(),
        workflow_instance_id: p
            .workflow_instance_id
            .clone()
            .ok_or_else(|| anyhow::anyhow!("stage missing workflow_instance_id"))?,
        stage_definition_id: p
            .stage_definition_id
            .clone()
            .ok_or_else(|| anyhow::anyhow!("stage missing stage_definition_id"))?,
        stage_name: p.stage_name.clone().unwrap_or_default(),
        stage_code: p.stage_code.clone().unwrap_or_default(),
        sequence_order: p.sequence_order.unwrap_or(0),
        status,
        started_at: p.started_at,
        completed_at: p.completed_at,
        due_date: p.due_date,
        notes: p.notes.clone(),
        version: p.version,
    })
}

async fn load_stage(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    stage_id: &str,
) -> HandlerResult<(Arc<crate::product_api::EntityType>, WorkflowStageProjection)> {
    let stage_type = entity(data_access, "WorkflowStage")?;
    let stage = data_access
        .find_item::<WorkflowStageProjection>(
            stage_type.clone(),
            stage_selection(),
            stage_id.to_string(),
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?
        .ok_or_else(|| anyhow::anyhow!("workflow stage `{stage_id}` was not found"))?;
    Ok((stage_type, stage))
}

async fn apply(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    stage_type: Arc<crate::product_api::EntityType>,
    mut input: InputWorkflowStage,
) -> HandlerResult<WorkflowStageProjection> {
    // touch timestamps to match the target status
    match input.status {
        WorkflowStageStatus::IN_PROGRESS if input.started_at.is_none() => {
            input.started_at = Some(Utc::now())
        }
        WorkflowStageStatus::APPROVED
        | WorkflowStageStatus::REJECTED
        | WorkflowStageStatus::SKIPPED => input.completed_at = Some(Utc::now()),
        _ => {}
    }
    data_access
        .update_item::<InputWorkflowStage, WorkflowStageProjection>(
            stage_type,
            selection(
                "workflow_stage",
                &[field("id"), field("status"), field("version")],
            ),
            input,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))
}

#[tracing::instrument(name = "workflow.stage_start", skip(data_access, user), fields(stage_id = %stage_id))]
pub async fn start(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    stage_id: String,
) -> HandlerResult<JsonValue> {
    require_user(user)?;
    let (stage_type, stage) = load_stage(data_access, user, &stage_id).await?;
    let cur = stage.status.unwrap_or(WorkflowStageStatus::LOCKED);
    if !matches!(
        cur,
        WorkflowStageStatus::ELIGIBLE | WorkflowStageStatus::CHANGES_REQUESTED
    ) {
        return Err(anyhow::anyhow!(
            "cannot start a stage in status {cur:?} (must be ELIGIBLE or CHANGES_REQUESTED)"
        ));
    }
    let input = stage_input(&stage, WorkflowStageStatus::IN_PROGRESS)?;
    let updated = apply(data_access, user, stage_type, input).await?;
    audit::record(
        data_access,
        user,
        None,
        "WorkflowStage",
        &stage_id,
        audit::GATE_STARTED,
        Some(json!({ "stage_code": stage.stage_code })),
    )
    .await?;
    Ok(
        json!({ "ok": true, "stage_id": stage_id, "status": "IN_PROGRESS", "version": updated.version }),
    )
}

#[tracing::instrument(name = "workflow.stage_submit", skip(data_access, user, payload), fields(stage_id = %stage_id))]
pub async fn submit(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    stage_id: String,
    payload: JsonValue,
) -> HandlerResult<JsonValue> {
    require_user(user)?;
    let (stage_type, stage) = load_stage(data_access, user, &stage_id).await?;
    let cur = stage.status.unwrap_or(WorkflowStageStatus::LOCKED);
    if !matches!(cur, WorkflowStageStatus::IN_PROGRESS) {
        return Err(anyhow::anyhow!(
            "cannot submit a stage in status {cur:?} (must be IN_PROGRESS)"
        ));
    }
    let mut input = stage_input(&stage, WorkflowStageStatus::PENDING_APPROVAL)?;
    if let Some(note) = payload.get("notes").and_then(|n| n.as_str()) {
        input.notes = Some(note.to_string());
    }
    let updated = apply(data_access, user, stage_type, input).await?;
    audit::record(
        data_access,
        user,
        None,
        "WorkflowStage",
        &stage_id,
        audit::GATE_SUBMITTED,
        Some(json!({ "stage_code": stage.stage_code })),
    )
    .await?;
    Ok(
        json!({ "ok": true, "stage_id": stage_id, "status": "PENDING_APPROVAL", "version": updated.version }),
    )
}

#[tracing::instrument(name = "workflow.stage_skip", skip(data_access, user), fields(stage_id = %stage_id))]
pub async fn skip(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    stage_id: String,
    reason: String,
) -> HandlerResult<JsonValue> {
    require_user(user)?;
    if reason.trim().is_empty() {
        return Err(anyhow::anyhow!("a skip reason is required"));
    }
    let (stage_type, stage) = load_stage(data_access, user, &stage_id).await?;
    let cur = stage.status.unwrap_or(WorkflowStageStatus::LOCKED);
    if matches!(
        cur,
        WorkflowStageStatus::APPROVED | WorkflowStageStatus::SKIPPED
    ) {
        return Err(anyhow::anyhow!("stage is already {cur:?}"));
    }
    let mut input = stage_input(&stage, WorkflowStageStatus::SKIPPED)?;
    input.notes = Some(format!("SKIPPED: {reason}"));
    let updated = apply(data_access, user, stage_type, input).await?;
    audit::record(
        data_access,
        user,
        None,
        "WorkflowStage",
        &stage_id,
        audit::GATE_SKIPPED,
        Some(json!({ "stage_code": stage.stage_code, "reason": reason })),
    )
    .await?;
    Ok(json!({ "ok": true, "stage_id": stage_id, "status": "SKIPPED", "version": updated.version }))
}

// --- GateSubmission.save_stage (workspace stage form upsert) ---

#[tracing::instrument(
    name = "workflow.save_stage",
    skip(data_access, user, payload),
    fields(project_id = %project_id, stage = %stage)
)]
pub async fn save_stage(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    project_id: String,
    stage: String,
    payload: JsonValue,
) -> HandlerResult<JsonValue> {
    require_user(user)?;
    let sub_type = entity(data_access, "GateSubmission")?;
    let sel = selection(
        "gate_submissions",
        &[
            field("id"),
            field("project_id"),
            field("stage"),
            field("status"),
            field("decision"),
            field("data"),
            field("created_at"),
            field("version"),
        ],
    );
    let existing = data_access
        .query_items::<GateSubmissionProjection>(
            sub_type.clone(),
            sel.clone(),
            Some(json!({ "_and": [
                { "project_id": { "_eq": project_id } },
                { "stage": { "_eq": stage } }
            ]})),
            None,
            0,
            1,
            None,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?
        .items
        .into_iter()
        .next();

    let status = payload
        .get("status")
        .and_then(|s| s.as_str())
        .unwrap_or("in_progress")
        .to_string();
    let decision = payload
        .get("decision")
        .and_then(|d| d.as_str())
        .map(|s| s.to_string());
    let data = payload
        .get("data")
        .cloned()
        .unwrap_or_else(|| payload.clone());
    let submitted_by = resolve_user_id(data_access, user).await?;

    let (input, created) = match &existing {
        Some(p) => (
            InputGateSubmission {
                id: p.id.clone(),
                project_id: project_id.clone(),
                stage: stage.clone(),
                status,
                decision,
                data,
                submitted_by,
                submitted_at: Some(Utc::now()),
                created_at: p.created_at.unwrap_or_else(Utc::now),
                updated_at: Some(Utc::now()),
                version: p.version,
            },
            false,
        ),
        None => (
            InputGateSubmission {
                id: None,
                project_id: project_id.clone(),
                stage: stage.clone(),
                status,
                decision,
                data,
                submitted_by,
                submitted_at: Some(Utc::now()),
                created_at: Utc::now(),
                updated_at: None,
                version: None,
            },
            true,
        ),
    };

    let saved = if created {
        data_access
            .create_item::<InputGateSubmission, GateSubmissionProjection>(
                sub_type,
                sel,
                input,
                user.clone(),
            )
            .await
    } else {
        data_access
            .update_item::<InputGateSubmission, GateSubmissionProjection>(
                sub_type,
                sel,
                input,
                user.clone(),
            )
            .await
    }
    .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    audit::record(
        data_access,
        user,
        Some(project_id.clone()),
        "GateSubmission",
        saved.id.as_deref().unwrap_or(""),
        audit::GATE_SUBMITTED,
        Some(json!({ "stage": stage, "status": saved.status })),
    )
    .await?;

    Ok(json!({
        "ok": true,
        "project_id": project_id,
        "stage": stage,
        "submission_id": saved.id,
        "created": created,
        "status": saved.status,
        "version": saved.version,
    }))
}
