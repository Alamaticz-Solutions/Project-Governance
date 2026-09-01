use axum::{extract::State, Json};
use serde_json::{json, Value};

use crate::{auth::CurrentUser, dto::notification::NotificationResponse, error::AppResult, services::notification_service, state::AppState};

pub async fn list(current_user: CurrentUser, State(state): State<AppState>) -> AppResult<Json<Vec<NotificationResponse>>> {
    Ok(Json(notification_service::list_for_user(&state.db, current_user.id).await?))
}

pub async fn mark_all_read(current_user: CurrentUser, State(state): State<AppState>) -> AppResult<Json<Value>> {
    let count = notification_service::mark_all_read(&state.db, current_user.id).await?;
    Ok(Json(json!({ "marked_read": count })))
}
