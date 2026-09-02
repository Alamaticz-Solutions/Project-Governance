//! Teams meeting + VTT POC endpoints — **Microsoft Graph route** (app-only).
//!
//! * Scheduling: `POST /teams-poc/meetings` creates a calendar event on the
//!   configured organizer mailbox (`isOnlineMeeting: true`), which also emails
//!   invitations. Without Graph configured, a local-stub link is issued so the
//!   pipeline stays demoable.
//! * Transcript ingest: Graph change notifications hit
//!   `POST /teams-poc/graph-notifications` when a transcript is ready; the
//!   handler downloads the VTT and runs the extraction pipeline. The by-row-id
//!   `POST /teams-poc/meetings/:id/ingest-transcript` (manual paste/upload from
//!   the UI) is unchanged.
//!
//! These endpoints are otherwise unauthenticated (the V1 frontend is on mock
//! auth). The Graph webhooks are verified by `clientState` + the subscription
//! validation-token handshake, not by app auth.

use axum::{
    extract::{Path, RawQuery, State},
    http::{header::CONTENT_TYPE, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use sea_orm::{ActiveModelTrait, ActiveValue::Set, EntityTrait, QueryOrder};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::{
    dto::teams_poc::{
        IngestTranscriptRequest, MeetingResponse, ScheduleMeetingRequest,
    },
    entities::poc_meetings,
    error::{AppError, AppResult},
    services::{graph_meeting_service, poc_meeting_service},
    state::AppState,
};

fn parse_dt(s: &str) -> Option<chrono::DateTime<chrono::FixedOffset>> {
    chrono::DateTime::parse_from_rfc3339(s).ok()
}

/// Parse a required RFC 3339 timestamp, turning a malformed value into a 400
/// instead of silently storing NULL.
fn require_dt(field: &str, s: &str) -> AppResult<chrono::DateTime<chrono::FixedOffset>> {
    parse_dt(s).ok_or_else(|| {
        AppError::BadRequest(format!("{field} is not a valid RFC 3339 timestamp: '{s}'"))
    })
}

fn now() -> chrono::DateTime<chrono::FixedOffset> {
    chrono::Utc::now().into()
}

// ── POST /teams-poc/meetings ────────────────────────────────────────────────
pub async fn schedule_meeting(
    State(state): State<AppState>,
    Json(req): Json<ScheduleMeetingRequest>,
) -> AppResult<Json<MeetingResponse>> {
    let id = Uuid::new_v4();
    let cfg = &state.config;

    // Validate up front — don't create a Teams meeting for a bad request, and
    // never persist an unparseable timestamp as NULL.
    let start_dt = require_dt("start_time", &req.start_time)?;
    let end_dt = require_dt("end_time", &req.end_time)?;
    if end_dt <= start_dt {
        return Err(AppError::BadRequest(
            "end_time must be after start_time.".to_string(),
        ));
    }

    let (source, join_url, graph_event_id, graph_online_meeting_id, error_message) =
        if let Some(graph) = &state.graph {
            let scheduled = graph_meeting_service::schedule_meeting_via_graph(
                graph,
                &cfg.graph_default_organizer_id,
                &req.subject,
                start_dt,
                end_dt,
                &req.attendees,
            )
            .await?;
            (
                "graph_scheduled".to_string(),
                scheduled.join_url,
                scheduled.graph_event_id,
                scheduled.graph_online_meeting_id,
                scheduled.error,
            )
        } else {
            // No Graph wired — still create a demoable meeting so the
            // VTT-ingest flow can be exercised end to end.
            (
                "local_stub".to_string(),
                Some(format!("https://teams.microsoft.com/l/meetup-join/POC-{id}")),
                None,
                None,
                None,
            )
        };

    let organizer_email = req
        .organizer_email
        .clone()
        .filter(|s| !s.is_empty())
        .or_else(|| {
            (!cfg.graph_default_organizer_email.is_empty())
                .then(|| cfg.graph_default_organizer_email.clone())
        });
    let graph_organizer = (!cfg.graph_default_organizer_id.is_empty())
        .then(|| cfg.graph_default_organizer_id.clone());

    let model = poc_meetings::ActiveModel {
        id: Set(id),
        subject: Set(req.subject.clone()),
        source: Set(source),
        status: Set("scheduled".to_string()),
        start_time: Set(Some(start_dt)),
        end_time: Set(Some(end_dt)),
        organizer_email: Set(organizer_email),
        attendees: Set(json!(req.attendees)),
        external_ref: Set(graph_online_meeting_id.clone()),
        join_url: Set(join_url),
        graph_event_id: Set(graph_event_id),
        graph_online_meeting_id: Set(graph_online_meeting_id),
        graph_organizer_user_id: Set(graph_organizer),
        graph_transcript_id: Set(None),
        transcript_vtt: Set(None),
        transcript_text: Set(None),
        summary: Set(None),
        decisions: Set(json!([])),
        action_items: Set(json!([])),
        agenda_items: Set(json!([])),
        contains_process_flow: Set(false),
        process_name: Set(None),
        bpmn_xml: Set(None),
        bpmn_status: Set(None),
        error_message: Set(error_message),
        created_at: Set(now()),
        updated_at: Set(None),
    };

    let saved = model.insert(&state.db).await?;
    Ok(Json(saved.into()))
}

// ── GET /teams-poc/meetings ─────────────────────────────────────────────────
pub async fn list_meetings(State(state): State<AppState>) -> AppResult<Json<Vec<MeetingResponse>>> {
    let rows = poc_meetings::Entity::find()
        .order_by_desc(poc_meetings::Column::CreatedAt)
        .all(&state.db)
        .await?;
    Ok(Json(rows.into_iter().map(MeetingResponse::from).collect()))
}

// ── GET /teams-poc/meetings/:id ─────────────────────────────────────────────
pub async fn get_meeting(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<MeetingResponse>> {
    let row = poc_meetings::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Meeting not found".to_string()))?;
    Ok(Json(row.into()))
}

/// Best-effort cancel of the backing Graph calendar event. Logs and continues
/// on failure — the local row change is still worth making.
async fn try_cancel_graph_event(state: &AppState, row: &poc_meetings::Model) {
    let (Some(graph), Some(event_id)) = (state.graph.as_ref(), row.graph_event_id.as_deref())
    else {
        return;
    };
    let organizer = row
        .graph_organizer_user_id
        .clone()
        .unwrap_or_else(|| state.config.graph_default_organizer_id.clone());
    if organizer.is_empty() {
        return;
    }
    if let Err(e) = graph_meeting_service::cancel_event(graph, &organizer, event_id).await {
        tracing::warn!(error = %e, "Graph event cancel failed; proceeding with local change");
    }
}

// ── POST /teams-poc/meetings/:id/cancel ─────────────────────────────────────
// Only while `scheduled` and the start time hasn't passed. Cancels the Graph
// event (sends cancellations), then marks the row `cancelled` and clears
// `join_url`. The row is kept — use DELETE to remove it.
pub async fn cancel_meeting(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<MeetingResponse>> {
    let row = poc_meetings::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Meeting not found".to_string()))?;

    if row.status != "scheduled" {
        return Err(AppError::BadRequest(format!(
            "Cannot cancel a meeting in '{}' status.",
            row.status
        )));
    }
    if let Some(start) = row.start_time {
        if start <= now() {
            return Err(AppError::BadRequest(
                "Cannot cancel — the scheduled start time has already passed.".to_string(),
            ));
        }
    }

    try_cancel_graph_event(&state, &row).await;

    let mut model: poc_meetings::ActiveModel = row.into();
    model.status = Set("cancelled".to_string());
    model.join_url = Set(None);
    model.updated_at = Set(Some(now()));
    let updated = model.update(&state.db).await?;
    Ok(Json(updated.into()))
}

// ── DELETE /teams-poc/meetings/:id ──────────────────────────────────────────
// Removes the local POC row. If the meeting is still `scheduled` and has a
// backing Graph event, that event is cancelled first.
pub async fn delete_meeting(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let row = poc_meetings::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Meeting not found".to_string()))?;

    if row.status == "scheduled" {
        try_cancel_graph_event(&state, &row).await;
    }
    poc_meetings::Entity::delete_by_id(row.id)
        .exec(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── POST /teams-poc/meetings/:id/ingest-transcript ──────────────────────────
// By row id — the portal UI's manual paste/upload path. Unchanged by the Graph
// migration.
pub async fn ingest_transcript(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<IngestTranscriptRequest>,
) -> AppResult<Json<MeetingResponse>> {
    let updated = poc_meeting_service::process_transcript(
        &state.db,
        &state.http,
        &state.config,
        id,
        req.vtt_text,
    )
    .await?;
    Ok(Json(updated.into()))
}

// ── Graph change notifications ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct GraphNotificationBatch {
    #[serde(default)]
    pub value: Vec<GraphNotification>,
}

#[derive(Debug, Deserialize)]
pub struct GraphNotification {
    #[serde(rename = "clientState")]
    pub client_state: Option<String>,
    pub resource: Option<String>,
}

/// `application/x-www-form-urlencoded` decode of one query-string value: `+`
/// is a space, `%XX` is a byte. A literal `+` in the token is delivered by
/// Graph as `%2B`, so this round-trips correctly.
fn query_decode(s: &str) -> String {
    let b = s.as_bytes();
    let hex = |c: u8| match c {
        b'0'..=b'9' => Some(c - b'0'),
        b'a'..=b'f' => Some(c - b'a' + 10),
        b'A'..=b'F' => Some(c - b'A' + 10),
        _ => None,
    };
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'%' if i + 2 < b.len() => match (hex(b[i + 1]), hex(b[i + 2])) {
                (Some(h), Some(l)) => {
                    out.push(h * 16 + l);
                    i += 3;
                }
                _ => {
                    out.push(b'%');
                    i += 1;
                }
            },
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            c => {
                out.push(c);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Graph subscription create/renew handshake: if the raw query carries
/// `validationToken`, its decoded value must be echoed back verbatim as
/// `text/plain` within ~10s.
fn validation_reply(raw_query: Option<&str>) -> Option<Response> {
    let token = raw_query?.split('&').find_map(|pair| {
        let (k, v) = pair.split_once('=')?;
        (k == "validationToken").then(|| query_decode(v))
    })?;
    Some((StatusCode::OK, [(CONTENT_TYPE, "text/plain")], token).into_response())
}

// ── POST /api/v1/teams-poc/graph-notifications ──────────────────────────────
// Graph calls this: (1) once at subscription create/renew with a
// `?validationToken=` we must echo within 10s; (2) with `{ "value": [ … ] }`
// batches when a transcript is ready. We verify `clientState`, then fetch +
// process each transcript on a spawned task so Graph is ACKed immediately.
pub async fn graph_notifications(
    State(state): State<AppState>,
    RawQuery(raw_query): RawQuery,
    body: String,
) -> Response {
    if let Some(reply) = validation_reply(raw_query.as_deref()) {
        return reply;
    }

    let Some(graph) = state.graph.clone() else {
        return StatusCode::ACCEPTED.into_response();
    };

    let batch: GraphNotificationBatch = match serde_json::from_str(&body) {
        Ok(b) => b,
        Err(e) => {
            tracing::warn!(error = %e, "unparseable Graph notification body");
            return StatusCode::ACCEPTED.into_response();
        }
    };

    let expected = state.config.graph_notification_client_state.clone();
    for n in batch.value {
        if n.client_state.as_deref() != Some(expected.as_str()) {
            tracing::warn!("Graph notification with mismatched clientState — dropped");
            continue;
        }
        let Some(resource) = n.resource else { continue };
        let Some(tref) = graph_meeting_service::parse_transcript_resource(&resource) else {
            tracing::warn!(%resource, "Graph notification resource is not a transcript — skipped");
            continue;
        };

        let db = state.db.clone();
        let http = state.http.clone();
        let config = (*state.config).clone();
        let graph = graph.clone();
        tokio::spawn(async move {
            if let Err(e) = graph_meeting_service::ingest_from_notification(
                &db, &graph, &http, &config, tref,
            )
            .await
            {
                tracing::error!(error = %e, "Graph transcript ingest failed");
            }
        });
    }

    StatusCode::ACCEPTED.into_response()
}

// ── POST /api/v1/teams-poc/graph-lifecycle ──────────────────────────────────
// Subscription lifecycle events (reauthorization needed, subscription removed).
pub async fn graph_lifecycle(
    State(state): State<AppState>,
    RawQuery(raw_query): RawQuery,
    body: String,
) -> Response {
    if let Some(reply) = validation_reply(raw_query.as_deref()) {
        return reply;
    }

    tracing::info!(
        body = %body.chars().take(500).collect::<String>(),
        "Graph lifecycle notification"
    );

    if body.contains("reauthorizationRequired") || body.contains("subscriptionRemoved") {
        if let Some(graph) = state.graph.clone() {
            let db = state.db.clone();
            let config = (*state.config).clone();
            tokio::spawn(async move {
                if let Err(e) = crate::services::graph_subscription_service::ensure_subscription(
                    &graph, &config, &db,
                )
                .await
                {
                    tracing::error!(error = %e, "lifecycle-triggered re-subscribe failed");
                }
            });
        }
    }

    StatusCode::ACCEPTED.into_response()
}
