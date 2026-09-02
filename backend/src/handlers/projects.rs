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


pub async fn extract_team_fields(
    _user: CurrentUser,
    State(state): State<AppState>,
    Path((project_id, team)): Path<(String, String)>,
    mut multipart: Multipart,
) -> AppResult<Json<Value>> {
    let mut combined_text = String::new();
    
    let uploads_dir = std::path::Path::new("static/uploads");
    if !uploads_dir.exists() {
        std::fs::create_dir_all(uploads_dir).unwrap_or_default();
    }

    while let Ok(Some(field)) = multipart.next_field().await {
        if let Some(name) = field.name() {
            if name == "files" || name.starts_with("file") {
                let filename = field.file_name().unwrap_or("upload").to_string();
                let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
                
                if let Ok(bytes) = field.bytes().await {
                    let text = ai_extraction_service::extract_text(&filename, &bytes).unwrap_or_default();
                    combined_text.push_str(&text);
                    combined_text.push_str("\n\n");
                    
                    let unique_name = format!("{}_{}", uuid::Uuid::new_v4(), filename);
                    let file_path = uploads_dir.join(&unique_name);
                    std::fs::write(&file_path, &bytes).unwrap_or_default();
                    
                    let parsed_uuid = uuid::Uuid::parse_str(&project_id).unwrap_or_default();
                    
                    let model = crate::entities::attachments::ActiveModel {
                        id: sea_orm::Set(uuid::Uuid::new_v4()),
                        project_id: sea_orm::Set(parsed_uuid),
                        file_name: sea_orm::Set(filename),
                        file_type: sea_orm::Set(Some(content_type)),
                        file_size: sea_orm::Set(Some(bytes.len() as i32)),
                        s3_key: sea_orm::Set(Some(unique_name.clone())),
                        s3_url: sea_orm::Set(Some(format!("/api/v1/projects/{}/documents/{}/download", project_id, unique_name.clone()))),
                        upload_status: sea_orm::Set(Some("COMPLETED".to_string())),
                        uploaded_by_id: sea_orm::Set(Some(_user.id)),
                        ai_extracted: sea_orm::Set(Some(true)),
                        ..Default::default()
                    };
                    
                    use sea_orm::EntityTrait;
                    let _ = crate::entities::attachments::Entity::insert(model).exec(&state.db).await;
                }
            }
        }
    }

    if combined_text.trim().is_empty() {
        return Err(AppError::BadRequest("Could not extract text from the files.".to_string()));
    }

    let data = ai_extraction_service::extract_team_fields(&state.http, &state.config, &combined_text, &team).await?;
    Ok(Json(json!({ "success": true, "data": data })))
}

pub async fn list_documents(
    _user: CurrentUser,
    State(state): State<AppState>,
    Path(project_id): Path<String>,
) -> AppResult<Json<Vec<serde_json::Value>>> {
    use sea_orm::{EntityTrait, ColumnTrait, QueryFilter};
    let pid = uuid::Uuid::parse_str(&project_id).unwrap_or_default();
    
    let docs = crate::entities::attachments::Entity::find()
        .filter(crate::entities::attachments::Column::ProjectId.eq(pid))
        .all(&state.db)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("DB Error: {}", e)))?;
        
    let result: Vec<_> = docs.into_iter().map(|d| {
        let doc_id_str = d.id.to_string();
        json!({
            "id": doc_id_str.clone(),
            "filename": d.file_name,
            "size": d.file_size,
            "type": d.file_type,
            "url": format!("/api/v1/projects/{}/documents/{}/download", project_id, doc_id_str),
            "uploadedAt": d.uploaded_at
        })
    }).collect();
    
    Ok(Json(result))
}

pub async fn download_document(
    State(state): State<AppState>,
    Path((project_id, doc_id)): Path<(String, String)>,
) -> AppResult<axum::response::Response> {
    use sea_orm::EntityTrait;
    if let Ok(did) = uuid::Uuid::parse_str(&doc_id) {
        let doc_opt = crate::entities::attachments::Entity::find_by_id(did)
            .one(&state.db)
            .await
            .map_err(|e| AppError::Internal(anyhow::anyhow!("DB Error")))?;
            
        if let Some(doc) = doc_opt {
            let local_path = format!("static/uploads/{}", doc.s3_key.unwrap_or_default());
            if let Ok(bytes) = std::fs::read(&local_path) {
                let builder = axum::response::Response::builder()
                    .header(axum::http::header::CONTENT_TYPE, doc.file_type.unwrap_or("application/octet-stream".to_string()))
                    .header(axum::http::header::CONTENT_DISPOSITION, format!("inline; filename=\"{}\"", doc.file_name))
                    .body(axum::body::Body::from(bytes));
                return Ok(builder.unwrap());
            }
        }
    }
    Err(AppError::NotFound("Document not found".to_string()))
}
