//! The real PDS Health governance workflow: a single continuous "workspace"
//! that walks a project through SRA/DFD -> VCR/VRA -> EAC -> TRC -> CAB ->
//! ST-Runbook -> PIC. Intake itself is satisfied by project creation
//! (`project_service::create_project`), so the workspace starts at SRA/DFD.
//!
//! One generic `gate_submissions` row per (project, stage) holds a JSONB
//! payload shaped however that stage's form needs — the stage list below is
//! the single source of truth for ordering/advancement, not duplicated
//! per-stage tables, since the exact field set per stage is still evolving
//! upstream (see the IT Governance intake data-points workbook).

use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter,
    TransactionTrait,
};
use uuid::Uuid;

use crate::{
    auth::CurrentUser,
    dto::{
        projects::ProjectResponse,
        workspace::{GateSubmissionResponse, SaveStageRequest, WorkspaceResponse},
    },
    entities::{gate_submissions, projects, users},
    error::{AppError, AppResult},
    services::support::record_audit,
};

pub const STAGE_ORDER: [&str; 7] = ["sra_dfd", "vcr_vra", "eac", "trc", "cab", "st_runbook", "pic"];

pub fn stage_label(stage: &str) -> &'static str {
    match stage {
        "sra_dfd" => "SRA / DFD",
        "vcr_vra" => "VCR / VRA",
        "eac" => "EAC Review",
        "trc" => "TRC Review",
        "cab" => "CAB Change Ticket",
        "st_runbook" => "ST-Runbook",
        "pic" => "PIC Review",
        _ => "Unknown Stage",
    }
}

/// Owner role gating shown in the UI — not exhaustively enforced server-side
/// beyond admin-override, matching the rest of this app's RBAC posture.
pub fn stage_owner_role(stage: &str) -> &'static str {
    match stage {
        "sra_dfd" | "vcr_vra" => "security",
        "eac" => "eac",
        "trc" => "trc",
        "cab" => "cab",
        "st_runbook" => "project_manager",
        "pic" => "pic",
        _ => "admin",
    }
}

fn next_stage(current: &str) -> Option<&'static str> {
    let idx = STAGE_ORDER.iter().position(|s| *s == current)?;
    STAGE_ORDER.get(idx + 1).copied()
}

pub async fn get_workspace(db: &DatabaseConnection, project_id: Uuid) -> AppResult<WorkspaceResponse> {
    let project = projects::Entity::find_by_id(project_id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound("Project not found".to_string()))?;
    let manager = users::Entity::find_by_id(project.manager_id).one(db).await?;

    let submissions = gate_submissions::Entity::find()
        .filter(gate_submissions::Column::ProjectId.eq(project_id))
        .all(db)
        .await?
        .into_iter()
        .map(GateSubmissionResponse::from)
        .collect();

    Ok(WorkspaceResponse {
        project: ProjectResponse::from_model(project, manager),
        stage_order: STAGE_ORDER.to_vec(),
        submissions,
    })
}

pub async fn save_stage(
    db: &DatabaseConnection,
    current_user: &CurrentUser,
    project_id: Uuid,
    stage: &str,
    payload: SaveStageRequest,
) -> AppResult<WorkspaceResponse> {
    if !STAGE_ORDER.contains(&stage) {
        return Err(AppError::BadRequest(format!("Unknown workspace stage '{stage}'")));
    }

    let txn = db.begin().await?;

    let project = projects::Entity::find_by_id(project_id)
        .one(&txn)
        .await?
        .ok_or_else(|| AppError::NotFound("Project not found".to_string()))?;

    let existing = gate_submissions::Entity::find()
        .filter(gate_submissions::Column::ProjectId.eq(project_id))
        .filter(gate_submissions::Column::Stage.eq(stage))
        .one(&txn)
        .await?;

    let now = Utc::now();
    let status = if payload.decision.is_some() { "submitted" } else { "in_progress" };

    let submission = match existing {
        Some(existing) => {
            let mut am: gate_submissions::ActiveModel = existing.into();
            am.status = Set(status.to_string());
            am.decision = Set(payload.decision.clone());
            am.data = Set(payload.data.clone());
            am.submitted_by = Set(Some(current_user.id));
            am.submitted_at = Set(Some(now.into()));
            am.updated_at = Set(Some(now.into()));
            am.update(&txn).await?
        }
        None => {
            let am = gate_submissions::ActiveModel {
                id: Set(Uuid::new_v4()),
                project_id: Set(project_id),
                stage: Set(stage.to_string()),
                status: Set(status.to_string()),
                decision: Set(payload.decision.clone()),
                data: Set(payload.data.clone()),
                submitted_by: Set(Some(current_user.id)),
                submitted_at: Set(Some(now.into())),
                created_at: Set(now.into()),
                ..Default::default()
            };
            am.insert(&txn).await?
        }
    };

    record_audit(
        &txn,
        Some(project_id),
        "gate_submission",
        &submission.id.to_string(),
        &format!("workspace_save_{stage}"),
        None,
        Some(serde_json::json!({ "decision": payload.decision, "advance": payload.advance })),
        Some(current_user.id),
    )
    .await?;

    if payload.advance {
        let mut project_am: projects::ActiveModel = project.clone().into();
        match next_stage(stage) {
            Some(next) => {
                project_am.current_stage = Set(Some(next.to_string()));
                project_am.current_owner_role = Set(Some(stage_owner_role(next).to_string()));
                project_am.workflow_status = Set(Some(format!("{} complete", stage_label(stage))));
                project_am.last_stage_completed = Set(Some(stage.to_string()));
            }
            None => {
                // PIC was the last stage — governance cycle complete.
                project_am.current_stage = Set(Some("complete".to_string()));
                project_am.current_status = Set(Some("Approved".to_string()));
                project_am.workflow_status = Set(Some("All gates cleared".to_string()));
                project_am.last_stage_completed = Set(Some(stage.to_string()));
                project_am.status = Set(crate::entities::sea_orm_active_enums::ProjectStatus::Completed);
            }
        }
        project_am.updated_at = Set(Some(now.into()));
        project_am.update(&txn).await?;
    }

    txn.commit().await?;
    get_workspace(db, project_id).await
}
