use axum::{
    extract::{Path, State},
    Json,
};
use uuid::Uuid;

use crate::{
    auth::CurrentUser,
    dto::workspace::{SaveStageRequest, WorkspaceResponse},
    error::AppResult,
    services::workspace_service,
    state::AppState,
};

pub async fn get(
    _user: CurrentUser,
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> AppResult<Json<WorkspaceResponse>> {
    Ok(Json(workspace_service::get_workspace(&state.db, project_id).await?))
}

pub async fn save_stage(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Path((project_id, stage)): Path<(Uuid, String)>,
    Json(payload): Json<SaveStageRequest>,
) -> AppResult<Json<WorkspaceResponse>> {
    Ok(Json(
        workspace_service::save_stage(&state.db, &current_user, project_id, &stage, payload).await?,
    ))
}
