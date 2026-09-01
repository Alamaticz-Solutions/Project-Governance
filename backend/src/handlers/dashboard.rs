use axum::{extract::State, Json};

use crate::{auth::CurrentUser, dto::dashboard::DashboardResponse, error::AppResult, services::dashboard_service, state::AppState};

pub async fn get(current_user: CurrentUser, State(state): State<AppState>) -> AppResult<Json<DashboardResponse>> {
    Ok(Json(dashboard_service::get_dashboard(&state.db, &current_user).await?))
}
