use axum::{
    extract::FromRequestParts,
    http::{header, request::Parts},
};
use sea_orm::EntityTrait;
use uuid::Uuid;

use crate::{
    auth::jwt::decode_token,
    entities::{sea_orm_active_enums::UserRole, users},
    error::AppError,
    state::AppState,
};

/// The authenticated user for the current request, loaded fresh from the
/// database on every call (mirrors `get_current_user` in the legacy FastAPI
/// backend: a deactivated user is locked out on their very next request,
/// with no separate revocation list needed).
#[derive(Clone, Debug)]
pub struct CurrentUser {
    pub id: Uuid,
    pub email: String,
    pub full_name: String,
    pub role: UserRole,
    pub is_active: bool,
}

impl From<users::Model> for CurrentUser {
    fn from(u: users::Model) -> Self {
        Self {
            id: u.id,
            email: u.email,
            full_name: u.full_name,
            role: u.role,
            is_active: u.is_active,
        }
    }
}

#[axum::async_trait]
impl FromRequestParts<AppState> for CurrentUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header_value = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| AppError::Unauthorized("Missing bearer token".to_string()))?;

        let token = header_value
            .strip_prefix("Bearer ")
            .ok_or_else(|| AppError::Unauthorized("Malformed Authorization header".to_string()))?;

        let claims = decode_token(&state.config.jwt_secret, token)?;
        if claims.token_type != "access" {
            return Err(AppError::Unauthorized("Expected an access token".to_string()));
        }

        let user_id = Uuid::parse_str(&claims.sub)
            .map_err(|_| AppError::Unauthorized("Invalid token subject".to_string()))?;

        let user = users::Entity::find_by_id(user_id)
            .one(&state.db)
            .await?
            .filter(|u| u.is_active)
            .ok_or_else(|| AppError::Unauthorized("User not found or inactive".to_string()))?;

        Ok(user.into())
    }
}

/// Central RBAC guard — every handler that needs a role check calls this
/// instead of an ad-hoc inline comparison, closing the gaps the legacy
/// backend had (e.g. `PATCH /projects/{id}` and the gate-review decision
/// endpoint previously had no role check at all).
pub fn ensure_role(user: &CurrentUser, allowed: &[UserRole]) -> Result<(), AppError> {
    if allowed.contains(&user.role) {
        Ok(())
    } else {
        Err(AppError::Forbidden(format!(
            "Role '{}' is not permitted to perform this action",
            user.role.as_str()
        )))
    }
}
