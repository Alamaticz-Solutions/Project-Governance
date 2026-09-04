//
// Backend governance GateReview Implementation
//    Product-owned handler extension file.
//    Generated once by app_gen, then preserved.
//
#[allow(unused_imports)]
pub(crate) use super::generated::gate_review::*;
#[allow(unused)]
use std::sync::Arc;

#[allow(unused_imports)]
use crate::{
    product_api::{DataAccess, EntityType, HandlerResult, JsonValue, UserAuth},
    schemas::common::AggregateResult,
    schemas::governance::{GateReviewProjection, GateReviewQueryResult, InputGateReview},
};

#[allow(unused)]
pub async fn decide_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    _entity_type: &Arc<EntityType>,
    _selections: JsonValue,
    gate_id: String,
    payload: serde_json::Value,
) -> HandlerResult<serde_json::Value> {
    crate::services::gate_review::decide(data_access, &user, gate_id, payload).await
}
