use axum::{
    extract::{Multipart, Path, Query, State},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    auth::CurrentUser,
    dto::projects::{
        DecisionSubmitRequest, IntakeEmailRequest, PendingApprovalItem, ProjectCreateRequest,
        ProjectListQuery, ProjectListResponse, ProjectResponse, ProjectUpdateRequest,
    },
    error::{AppError, AppResult},
    services::{ai_extraction_service, email_service, project_service},
    state::AppState,
};

pub async fn list(
    _user: CurrentUser,
    State(state): State<AppState>,
    Query(query): Query<ProjectListQuery>,
) -> AppResult<Json<ProjectListResponse>> {
    Ok(Json(project_service::list_projects(&state.db, query).await?))
}

pub async fn create(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Json(payload): Json<ProjectCreateRequest>,
) -> AppResult<Json<ProjectResponse>> {
    Ok(Json(
        project_service::create_project(&state.db, &current_user, payload).await?,
    ))
}

pub async fn send_intake_email(
    _user: CurrentUser,
    State(state): State<AppState>,
    Json(payload): Json<IntakeEmailRequest>,
) -> AppResult<Json<Value>> {
    let detail = email_service::send_intake_copy_email(
        &state.config,
        &payload.email,
        &payload.project_id,
        &payload.data,
    )
    .await?;
    Ok(Json(json!({ "success": true, "detail": detail })))
}

pub async fn extract_intake(
    _user: CurrentUser,
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> AppResult<Json<Value>> {
    let mut filename = String::new();
    let mut bytes = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Invalid upload: {e}")))?
    {
        if field.name() == Some("file") {
            filename = field.file_name().unwrap_or("upload").to_string();
            bytes = field
                .bytes()
                .await
                .map_err(|e| AppError::BadRequest(format!("Invalid upload: {e}")))?
                .to_vec();
        }
    }

    if bytes.is_empty() {
        return Err(AppError::BadRequest("No file uploaded".to_string()));
    }

    let text = ai_extraction_service::extract_text(&filename, &bytes)?;
    if text.trim().is_empty() {
        return Err(AppError::BadRequest("Could not extract text from the file.".to_string()));
    }

    let data = ai_extraction_service::extract_intake_fields(&state.http, &state.config, &text).await?;
    Ok(Json(json!({ "success": true, "data": data })))
}

pub async fn pending_approvals(
    current_user: CurrentUser,
    State(state): State<AppState>,
) -> AppResult<Json<Vec<PendingApprovalItem>>> {
    Ok(Json(
        project_service::get_pending_approvals(&state.db, &current_user).await?,
    ))
}

pub async fn get(
    _user: CurrentUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<ProjectResponse>> {
    Ok(Json(project_service::get_project(&state.db, &id).await?))
}

pub async fn update(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ProjectUpdateRequest>,
) -> AppResult<Json<ProjectResponse>> {
    Ok(Json(
        project_service::update_project(&state.db, &current_user, id, payload).await?,
    ))
}

pub async fn delete(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<axum::http::StatusCode> {
    project_service::delete_project(&state.db, &current_user, id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

pub async fn submit_decision(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<DecisionSubmitRequest>,
) -> AppResult<Json<ProjectResponse>> {
    Ok(Json(
        project_service::submit_decision(&state.db, &current_user, id, payload).await?,
    ))
}

pub async fn fast_track_complete(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<ProjectResponse>> {
    Ok(Json(
        project_service::fast_track_complete(&state.db, &current_user, id).await?,
    ))
}
