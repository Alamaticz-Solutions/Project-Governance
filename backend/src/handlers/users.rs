use axum::{extract::State, Json};
use sea_orm::EntityTrait;

use crate::{
    auth::{ensure_role, CurrentUser},
    dto::auth::{AdminCreateUserRequest, UserResponse},
    entities::{sea_orm_active_enums::UserRole, users},
    error::AppResult,
    services::auth_service,
    state::AppState,
};

pub async fn list_users(
    current_user: CurrentUser,
    State(state): State<AppState>,
) -> AppResult<Json<Vec<UserResponse>>> {
    ensure_role(&current_user, &[UserRole::Admin, UserRole::Epmo])?;
    let all = users::Entity::find().all(&state.db).await?;
    Ok(Json(all.into_iter().map(UserResponse::from).collect()))
}

pub async fn create_user(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Json(payload): Json<AdminCreateUserRequest>,
) -> AppResult<Json<UserResponse>> {
    ensure_role(&current_user, &[UserRole::Admin])?;
    let user = auth_service::admin_create_user(&state.db, payload).await?;
    Ok(Json(user))
}
