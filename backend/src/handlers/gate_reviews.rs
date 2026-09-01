use axum::{
    extract::{Path, State},
    Json,
};
use uuid::Uuid;

use crate::{
    auth::CurrentUser,
    dto::gate_review::{GateDecisionRequest, GateReviewResponse},
    error::AppResult,
    services::gate_review_service,
    state::AppState,
};

pub async fn list(_user: CurrentUser, State(state): State<AppState>) -> AppResult<Json<Vec<GateReviewResponse>>> {
    Ok(Json(gate_review_service::list_gate_reviews(&state.db).await?))
}

pub async fn get(
    _user: CurrentUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<GateReviewResponse>> {
    Ok(Json(gate_review_service::get_gate_review(&state.db, id).await?))
}

pub async fn decide(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<GateDecisionRequest>,
) -> AppResult<Json<GateReviewResponse>> {
    Ok(Json(
        gate_review_service::submit_gate_decision(&state.db, &current_user, id, payload).await?,
    ))
}
