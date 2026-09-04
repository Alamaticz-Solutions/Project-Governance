//
// Backend governance Meeting Implementation
//    Product-owned handler extension file.
//    Generated once by app_gen, then preserved.
//
#[allow(unused_imports)]
pub(crate) use super::generated::meeting::*;
#[allow(unused)]
use std::sync::Arc;

#[allow(unused_imports)]
use crate::{
    product_api::{DataAccess, EntityType, HandlerResult, JsonValue, UserAuth},
    schemas::common::AggregateResult,
    schemas::governance::{InputMeeting, MeetingProjection, MeetingQueryResult},
};

#[allow(unused)]
pub async fn process_transcript_impl(
    user: Option<UserAuth>,
    data_access: &Arc<DataAccess>,
    entity_type: &Arc<EntityType>,
    selections: JsonValue,
    meeting_id: String,
    payload: serde_json::Value,
) -> HandlerResult<serde_json::Value> {
    crate::services::meeting_agent::process_transcript(data_access, &user, meeting_id, payload)
        .await
}
