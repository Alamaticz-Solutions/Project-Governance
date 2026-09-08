//! Shared helpers for the product service layer.

use std::sync::Arc;

use serde_json::json;

use crate::{
    product_api::{DataAccess, EntityType, HandlerResult, JsonValue, UserAuth},
    schemas::governance::UserProjection,
};

/// Product schema name — every `get_entity_type` call in this crate uses it.
pub const SCHEMA: &str = "governance";

/// Unwrap the optional authenticated actor, erroring if the request is
/// unauthenticated.
pub fn require_user(user: &Option<UserAuth>) -> HandlerResult<UserAuth> {
    user.clone()
        .ok_or_else(|| anyhow::anyhow!("authentication is required"))
}

/// Whether the actor carries `role` (case-insensitive).
pub fn has_role(user: &UserAuth, role: &str) -> bool {
    user.roles.iter().any(|r| r.eq_ignore_ascii_case(role))
}

/// Whether the actor carries any of `roles` (case-insensitive).
pub fn has_any_role(user: &UserAuth, roles: &[&str]) -> bool {
    roles.iter().any(|r| has_role(user, r))
}

/// The actor's primary role, lowercased (mirrors the auth-boundary projection
/// described in spec 001). Empty string if the actor carries no roles.
pub fn primary_role(user: &UserAuth) -> String {
    user.roles
        .first()
        .map(|r| r.to_ascii_lowercase())
        .unwrap_or_default()
}

/// Look up an `EntityType` in the governance schema by its type name.
pub fn entity(data_access: &Arc<DataAccess>, type_name: &str) -> HandlerResult<Arc<EntityType>> {
    data_access
        .app_config
        .get_entity_type(&SCHEMA.to_string(), &type_name.to_string())
        .map_err(|e| anyhow::anyhow!(e.to_string()))
}

// --- GraphQL selection-set JSON builders (same shape the framework expects) ---

/// A leaf selection: a scalar field with no sub-selection.
pub fn field(name: &str) -> JsonValue {
    json!({ "name": name, "selection_set": [] })
}

/// A named selection with a sub-selection (for nested/navigation reads).
#[allow(dead_code)] // selection helper for nested reads
pub fn nested(name: &str, fields: &[JsonValue]) -> JsonValue {
    json!({ "name": name, "selection_set": fields })
}

/// A top-level selection over `name` with the given field sub-selection.
pub fn selection(name: &str, fields: &[JsonValue]) -> JsonValue {
    json!({ "name": name, "selection_set": fields })
}

/// Resolve the runtime actor (`user_name`, an email/username string — the
/// runtime carries no user UUID; see spec 001 Open decision A) to the `users`
/// row id, so FK columns like `performed_by_id` / `approved_by` can be set.
/// Returns `None` when the actor cannot be matched to a seeded user.
pub async fn resolve_user_id(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
) -> HandlerResult<Option<String>> {
    let Some(actor) = user.as_ref() else {
        return Ok(None);
    };
    let users_type = entity(data_access, "User")?;
    let sel = selection("users", &[field("id"), field("email"), field("username")]);
    let by_email = data_access
        .query_items::<UserProjection>(
            users_type.clone(),
            sel.clone(),
            Some(json!({ "email": { "_eq": actor.user_name } })),
            None,
            0,
            1,
            None,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    if let Some(u) = by_email.items.into_iter().next() {
        return Ok(u.id);
    }
    let by_username = data_access
        .query_items::<UserProjection>(
            users_type,
            sel,
            Some(json!({ "username": { "_eq": actor.user_name } })),
            None,
            0,
            1,
            None,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    Ok(by_username.items.into_iter().next().and_then(|u| u.id))
}
