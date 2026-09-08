//! `Meeting.schedule_via_graph` / `Meeting.cancel_via_graph` orchestration
//! (G1 governed writes, spec 003 non-goal 1 lifted for these two
//! operations only). Every actual Graph call goes through
//! `services::graph::writes::execute` -- this module's job is just to
//! resolve the bound parameters from the `Meeting` row + the caller's
//! payload, call `execute`, and persist the result.
//!
//! `payload` shapes:
//!   schedule: `{ subject?, start_time, end_time, attendees?: [email],
//!                organizer?, idempotency_key? }`
//!   cancel:   `{ idempotency_key? }` -- organizer/event id come from the
//!             Meeting row itself (`graph_organizer_user_id`/`organizer_email`,
//!             `graph_event_id`), never the caller.

use std::sync::Arc;

use chrono::Utc;
use serde_json::json;

use crate::{
    product_api::{DataAccess, HandlerResult, JsonValue, UserAuth},
    schemas::governance::{InputMeeting, MeetingProjection},
    services::{
        graph::{auth::GraphAuthConfig, writes, WriteContext, WriteOperation},
        support::{entity, field, require_user, selection},
    },
};

fn meeting_selection() -> JsonValue {
    selection(
        "meeting",
        &[
            field("id"),
            field("subject"),
            field("source"),
            field("status"),
            field("organizer_email"),
            field("graph_organizer_user_id"),
            field("graph_online_meeting_id"),
            field("graph_event_id"),
            field("join_url"),
            field("start_time"),
            field("end_time"),
            field("version"),
        ],
    )
}

fn meeting_input(p: &MeetingProjection) -> InputMeeting {
    InputMeeting {
        id: p.id.clone(),
        subject: p
            .subject
            .clone()
            .unwrap_or_else(|| "(untitled)".to_string()),
        source: p.source.clone().unwrap_or_else(|| "local_stub".to_string()),
        status: p.status.clone().unwrap_or_else(|| "scheduled".to_string()),
        start_time: p.start_time,
        end_time: p.end_time,
        organizer_email: p.organizer_email.clone(),
        graph_online_meeting_id: p.graph_online_meeting_id.clone(),
        graph_organizer_id: p.graph_organizer_id.clone(),
        graph_organizer_user_id: p.graph_organizer_user_id.clone(),
        graph_transcript_id: p.graph_transcript_id.clone(),
        graph_event_id: p.graph_event_id.clone(),
        join_url: p.join_url.clone(),
        external_ref: p.external_ref.clone(),
        transcript_vtt: p.transcript_vtt.clone(),
        transcript_text: p.transcript_text.clone(),
        summary: p.summary.clone(),
        decisions: p.decisions.clone(),
        action_items: p.action_items.clone(),
        agenda_items: p.agenda_items.clone(),
        attendees: p.attendees.clone(),
        contains_process_flow: p.contains_process_flow,
        process_name: p.process_name.clone(),
        bpmn_xml: p.bpmn_xml.clone(),
        bpmn_status: p.bpmn_status.clone(),
        error_message: p.error_message.clone(),
        created_at: p.created_at,
        updated_at: Some(Utc::now()),
        version: p.version,
    }
}

fn resolve_organizer(payload: &JsonValue, meeting: &MeetingProjection) -> HandlerResult<String> {
    payload
        .get("organizer")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| meeting.graph_organizer_user_id.clone())
        .or_else(|| meeting.organizer_email.clone())
        .or_else(|| GraphAuthConfig::from_env().map(|c| c.default_organizer_id))
        .ok_or_else(|| {
            anyhow::anyhow!(
                "no organizer available: meeting has neither graph_organizer_user_id nor \
                 organizer_email, no `organizer` was passed, and GRAPH_DEFAULT_ORGANIZER_ID is unset"
            )
        })
}

/// `Meeting.schedule_via_graph(meeting_id, payload)`. Creates the Teams
/// meeting via Microsoft Graph (`WriteOperation::ScheduleTeamsMeeting`)
/// behind the full G1 stack, then persists `graph_online_meeting_id` +
/// `join_url` onto the `Meeting` row and advances `status`.
#[tracing::instrument(
    name = "meeting.schedule_via_graph",
    skip(data_access, user, payload),
    fields(meeting_id = %meeting_id)
)]
pub async fn schedule_via_graph(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    meeting_id: String,
    payload: JsonValue,
) -> HandlerResult<JsonValue> {
    let actor = require_user(user)?;
    let meeting_type = entity(data_access, "Meeting")?;
    let meeting = data_access
        .find_item::<MeetingProjection>(
            meeting_type.clone(),
            meeting_selection(),
            meeting_id.clone(),
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?
        .ok_or_else(|| anyhow::anyhow!("meeting `{meeting_id}` was not found"))?;

    let organizer = resolve_organizer(&payload, &meeting)?;
    let subject = payload
        .get("subject")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| meeting.subject.clone())
        .unwrap_or_else(|| "(untitled)".to_string());
    let start_iso = payload
        .get("start_time")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| meeting.start_time.map(|t| t.to_rfc3339()))
        .ok_or_else(|| anyhow::anyhow!("start_time is required (payload or meeting row)"))?;
    let end_iso = payload
        .get("end_time")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| meeting.end_time.map(|t| t.to_rfc3339()))
        .ok_or_else(|| anyhow::anyhow!("end_time is required (payload or meeting row)"))?;
    let attendees: Vec<String> = payload
        .get("attendees")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default();
    let idempotency_key = payload.get("idempotency_key").and_then(|v| v.as_str());

    let ctx = WriteContext::from_user(&actor);
    // Calendar-backed: POST /users/{organizer}/events with isOnlineMeeting.
    // This puts the meeting on the organizer's calendar AND emails invites to
    // attendees -- POST /onlineMeetings does neither.
    let op = WriteOperation::ScheduleCalendarEvent {
        organizer: organizer.clone(),
        subject,
        start_iso: start_iso.clone(),
        end_iso: end_iso.clone(),
        attendees: attendees.clone(),
    };

    let outcome = writes::execute(data_access, &ctx, op, Some(&meeting_id), idempotency_key)
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    // The /events response carries `onlineMeeting.joinUrl` (and `id`, the
    // calendar event id, already in `graph_resource_id`).
    let join_url = outcome
        .graph_response
        .as_ref()
        .and_then(|r| {
            r.get("onlineMeeting")
                .and_then(|m| m.get("joinUrl"))
                .or_else(|| r.get("joinWebUrl"))
        })
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| meeting.join_url.clone());

    let event_id = outcome.graph_resource_id.clone();

    // Resolve the onlineMeeting id from the join URL -- needed later to fetch
    // the transcript. Best-effort: the transcript webhook has a fallback.
    let online_meeting_id = match join_url.as_deref() {
        Some(url) => resolve_online_meeting_id(&organizer, url).await,
        None => None,
    };

    let attendees_json: Vec<serde_json::Value> = attendees
        .iter()
        .map(|a| json!({ "email": a }))
        .collect();

    let mut input = meeting_input(&meeting);
    input.graph_event_id = event_id.clone();
    input.graph_online_meeting_id = online_meeting_id.clone();
    input.graph_organizer_user_id = Some(organizer.clone());
    input.join_url = join_url;
    input.status = "graph_scheduled".to_string();
    if let Ok(t) = chrono::DateTime::parse_from_rfc3339(&start_iso) {
        input.start_time = Some(t.with_timezone(&chrono::Utc));
    }
    if let Ok(t) = chrono::DateTime::parse_from_rfc3339(&end_iso) {
        input.end_time = Some(t.with_timezone(&chrono::Utc));
    }
    if !attendees_json.is_empty() {
        input.attendees = Some(attendees_json);
    }

    let saved = data_access
        .update_item::<InputMeeting, MeetingProjection>(
            meeting_type,
            selection(
                "meeting",
                &[field("id"), field("status"), field("join_url"), field("version")],
            ),
            input,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    Ok(json!({
        "ok": true,
        "meeting_id": meeting_id,
        "operation": outcome.operation,
        "graph_event_id": event_id,
        "graph_online_meeting_id": online_meeting_id,
        "join_url": saved.join_url,
        "status": saved.status,
        "version": saved.version,
        "idempotent_replay": outcome.idempotent_replay,
    }))
}

/// `GET /users/{organizer}/onlineMeetings?$filter=JoinWebUrl eq '{join_url}'`
/// through the governed read registry. Best-effort -- returns `None` on any
/// failure (Graph unconfigured, filter miss, parse error); the transcript
/// webhook can backfill the id from the notification later.
async fn resolve_online_meeting_id(organizer: &str, join_url: &str) -> Option<String> {
    use crate::services::graph::{GraphClient, ReadOperation};
    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .ok()?;
    let client = GraphClient::from_env(http)?;
    let body = client
        .read(ReadOperation::GetOnlineMeetingByJoinUrl {
            organizer: organizer.to_string(),
            join_url: join_url.to_string(),
        })
        .await
        .ok()?;
    body.get("value")
        .and_then(|v| v.as_array())
        .and_then(|a| a.first())
        .and_then(|m| m.get("id"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
}

/// `Meeting.cancel_via_graph(meeting_id, payload)`. Cancels whatever Graph
/// resource `schedule_via_graph` actually created for this meeting, behind
/// the full G1 stack, then marks the row `cancelled`. Prefers
/// `WriteOperation::CancelOnlineMeeting` (`graph_online_meeting_id`) over
/// `CancelCalendarEvent` (`graph_event_id`) because `schedule_via_graph`
/// only ever sets the former -- `POST /onlineMeetings` creates an
/// online-meeting resource, not a calendar event (found live, 2026-09-07:
/// `DELETE /events/{onlineMeetingId}` is a category error, the online
/// meeting is a different resource type). `graph_event_id` stays supported
/// for a future portal path that schedules via `POST /events` instead. The
/// organizer and resource id come from the `Meeting` row itself, never the
/// caller -- a caller cannot direct a cancel at an arbitrary resource.
#[tracing::instrument(
    name = "meeting.cancel_via_graph",
    skip(data_access, user, payload),
    fields(meeting_id = %meeting_id)
)]
pub async fn cancel_via_graph(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    meeting_id: String,
    payload: JsonValue,
) -> HandlerResult<JsonValue> {
    let actor = require_user(user)?;
    let meeting_type = entity(data_access, "Meeting")?;
    let meeting = data_access
        .find_item::<MeetingProjection>(
            meeting_type.clone(),
            meeting_selection(),
            meeting_id.clone(),
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?
        .ok_or_else(|| anyhow::anyhow!("meeting `{meeting_id}` was not found"))?;

    let organizer = resolve_organizer(&payload, &meeting)?;
    let idempotency_key = payload.get("idempotency_key").and_then(|v| v.as_str());

    let ctx = WriteContext::from_user(&actor);
    let op = if let Some(event_id) = meeting.graph_event_id.clone() {
        WriteOperation::CancelCalendarEvent { organizer, event_id }
    } else if let Some(online_meeting_id) = meeting.graph_online_meeting_id.clone() {
        WriteOperation::CancelOnlineMeeting {
            organizer,
            online_meeting_id,
        }
    } else {
        return Err(anyhow::anyhow!(
            "meeting `{meeting_id}` has no graph_event_id/graph_online_meeting_id -- \
             nothing to cancel on Graph"
        ));
    };

    let outcome = writes::execute(data_access, &ctx, op, Some(&meeting_id), idempotency_key)
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    let mut input = meeting_input(&meeting);
    input.status = "cancelled".to_string();

    let saved = data_access
        .update_item::<InputMeeting, MeetingProjection>(
            meeting_type,
            selection("meeting", &[field("id"), field("status"), field("version")]),
            input,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    Ok(json!({
        "ok": true,
        "meeting_id": meeting_id,
        "operation": outcome.operation,
        "status": saved.status,
        "version": saved.version,
        "idempotent_replay": outcome.idempotent_replay,
    }))
}
