use axum::{extract::{Query, State}, Json};

use crate::{
    auth::{ensure_role, CurrentUser},
    dto::audit::{AuditHistoryResponse, AuditQuery},
    entities::sea_orm_active_enums::UserRole,
    error::AppResult,
    services::audit_service,
    state::AppState,
};

pub async fn list(
    current_user: CurrentUser,
    State(state): State<AppState>,
    Query(query): Query<AuditQuery>,
) -> AppResult<Json<Vec<AuditHistoryResponse>>> {
    ensure_role(&current_user, &[UserRole::Admin, UserRole::Epmo])?;
    Ok(Json(audit_service::list_audit(&state.db, query).await?))
}
