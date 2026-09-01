use axum::{extract::State, Json};
use sea_orm::EntityTrait;

use crate::{
    auth::CurrentUser,
    dto::auth::{LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UserResponse},
    error::AppResult,
    services::auth_service,
    state::AppState,
};

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> AppResult<Json<TokenResponse>> {
    let result = auth_service::login(&state.db, &state.config, &payload.email, &payload.password).await?;
    Ok(Json(result))
}

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> AppResult<Json<UserResponse>> {
    let user = auth_service::register(&state.db, payload).await?;
    Ok(Json(user))
}

pub async fn refresh(
    State(state): State<AppState>,
    Json(payload): Json<RefreshRequest>,
) -> AppResult<Json<TokenResponse>> {
    let result = auth_service::refresh(&state.db, &state.config, &payload.refresh_token).await?;
    Ok(Json(result))
}

pub async fn me(current_user: CurrentUser, State(state): State<AppState>) -> AppResult<Json<UserResponse>> {
    let user = crate::entities::users::Entity::find_by_id(current_user.id)
        .one(&state.db)
        .await?
        .ok_or_else(|| crate::error::AppError::NotFound("User not found".to_string()))?;
    Ok(Json(user.into()))
}
