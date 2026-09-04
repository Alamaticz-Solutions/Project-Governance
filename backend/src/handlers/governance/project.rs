//
// Backend governance Project Implementation
//    Product-owned handler extension file.
//    Generated once by app_gen, then preserved.
//
//    Custom-method _impl bodies wired to the workflow-engine services
//    (spec 002). Standard CRUD stays on the generated defaults imported below.
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
    services::{approval_state_machine, gate_eligibility, workspace},
};

pub async fn submit_decision_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    entity_type: &Arc<EntityType>,
    _selections: JsonValue,
    project_id: String,
    payload: serde_json::Value,
) -> HandlerResult<serde_json::Value> {
    approval_state_machine::submit_decision(data_access, &user, entity_type, project_id, payload)
        .await
}

pub async fn pending_approvals_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    _entity_type: &Arc<EntityType>,
    _selections: JsonValue,
    project_id: String,
) -> HandlerResult<serde_json::Value> {
    approval_state_machine::pending_approvals(data_access, &user, project_id).await
}

pub async fn fast_track_complete_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    _entity_type: &Arc<EntityType>,
    _selections: JsonValue,
    project_id: String,
) -> HandlerResult<serde_json::Value> {
    approval_state_machine::fast_track_complete(data_access, &user, project_id).await
}

pub async fn workspace_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    entity_type: &Arc<EntityType>,
    _selections: JsonValue,
    project_id: String,
) -> HandlerResult<serde_json::Value> {
    workspace::assemble(data_access, &user, entity_type, project_id).await
}

pub async fn eligible_gates_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    _entity_type: &Arc<EntityType>,
    _selections: JsonValue,
    project_id: String,
) -> HandlerResult<serde_json::Value> {
    gate_eligibility::compute(data_access, &user, project_id).await
}

pub async fn cancel_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    _entity_type: &Arc<EntityType>,
    _selections: JsonValue,
    project_id: String,
    reason: String,
) -> HandlerResult<serde_json::Value> {
    approval_state_machine::cancel(data_access, &user, project_id, reason).await
}
