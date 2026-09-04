//
// Backend governance Project Implementation
//    Product-owned handler extension file.
//    Generated once by app_gen, then preserved.
//
#[allow(unused_imports)]
pub(crate) use super::generated::project::*;
#[allow(unused)]
use std::sync::Arc;

#[allow(unused_imports)]
use crate::{
    product_api::{DataAccess, EntityType, HandlerResult, JsonValue, UserAuth},
    schemas::common::AggregateResult,
    schemas::governance::{InputProject, ProjectProjection, ProjectQueryResult},
};

#[allow(unused)]
pub async fn submit_decision_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    entity_type: &Arc<EntityType>,
    selections: JsonValue,
    project_id: String,
    payload: serde_json::Value,
) -> HandlerResult<serde_json::Value> {
    Err(anyhow::anyhow!(
        "custom method `submit_decision` is not implemented yet"
    ))
}

#[allow(unused)]
pub async fn pending_approvals_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    entity_type: &Arc<EntityType>,
    selections: JsonValue,
    project_id: String,
) -> HandlerResult<serde_json::Value> {
    Err(anyhow::anyhow!(
        "custom method `pending_approvals` is not implemented yet"
    ))
}

#[allow(unused)]
pub async fn fast_track_complete_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    entity_type: &Arc<EntityType>,
    selections: JsonValue,
    project_id: String,
) -> HandlerResult<serde_json::Value> {
    Err(anyhow::anyhow!(
        "custom method `fast_track_complete` is not implemented yet"
    ))
}

#[allow(unused)]
pub async fn workspace_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    entity_type: &Arc<EntityType>,
    selections: JsonValue,
    project_id: String,
) -> HandlerResult<serde_json::Value> {
    Err(anyhow::anyhow!(
        "custom method `workspace` is not implemented yet"
    ))
}

#[allow(unused)]
pub async fn eligible_gates_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    entity_type: &Arc<EntityType>,
    selections: JsonValue,
    project_id: String,
) -> HandlerResult<serde_json::Value> {
    Err(anyhow::anyhow!(
        "custom method `eligible_gates` is not implemented yet"
    ))
}

#[allow(unused)]
pub async fn cancel_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    entity_type: &Arc<EntityType>,
    selections: JsonValue,
    project_id: String,
    reason: String,
) -> HandlerResult<serde_json::Value> {
    Err(anyhow::anyhow!(
        "custom method `cancel` is not implemented yet"
    ))
}
