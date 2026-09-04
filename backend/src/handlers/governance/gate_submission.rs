//
// Backend governance GateSubmission Implementation
//    Product-owned handler extension file.
//    Generated once by app_gen, then preserved.
//
#[allow(unused_imports)]
pub(crate) use super::generated::gate_submission::*;
#[allow(unused)]
use std::sync::Arc;

#[allow(unused_imports)]
use crate::{
    product_api::{DataAccess, EntityType, HandlerResult, JsonValue, UserAuth},
    schemas::common::AggregateResult,
    schemas::governance::{
        GateSubmissionProjection, GateSubmissionQueryResult, InputGateSubmission,
    },
};

#[allow(unused)]
pub async fn save_stage_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    _entity_type: &Arc<EntityType>,
    _selections: JsonValue,
    project_id: String,
    stage: String,
    payload: serde_json::Value,
) -> HandlerResult<serde_json::Value> {
    crate::services::transition::save_stage(data_access, &user, project_id, stage, payload).await
}
