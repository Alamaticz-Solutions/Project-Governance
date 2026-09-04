//
// Backend governance WorkflowStage Implementation
//    Product-owned handler extension file.
//    Generated once by app_gen, then preserved.
//
#[allow(unused_imports)]
pub(crate) use super::generated::workflow_stage::*;
#[allow(unused)]
use std::sync::Arc;

#[allow(unused_imports)]
use crate::{
    product_api::{DataAccess, EntityType, HandlerResult, JsonValue, UserAuth},
    schemas::common::AggregateResult,
    schemas::governance::{InputWorkflowStage, WorkflowStageProjection, WorkflowStageQueryResult},
};

#[allow(unused)]
pub async fn start_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    _entity_type: &Arc<EntityType>,
    _selections: JsonValue,
    stage_id: String,
) -> HandlerResult<serde_json::Value> {
    crate::services::transition::start(data_access, &user, stage_id).await
}

pub async fn submit_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    _entity_type: &Arc<EntityType>,
    _selections: JsonValue,
    stage_id: String,
    payload: serde_json::Value,
) -> HandlerResult<serde_json::Value> {
    crate::services::transition::submit(data_access, &user, stage_id, payload).await
}

pub async fn skip_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    _entity_type: &Arc<EntityType>,
    _selections: JsonValue,
    stage_id: String,
    reason: String,
) -> HandlerResult<serde_json::Value> {
    crate::services::transition::skip(data_access, &user, stage_id, reason).await
}
