//! Teams meeting + VTT POC endpoints.
//!
//! NOTE: these endpoints are intentionally **unauthenticated** for the POC —
//! the V1 frontend currently runs on mock auth, and the Graph webhook is
//! called by Microsoft (no bearer token). Wire `CurrentUser` back in when the
//! POC is folded into the real app.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, QueryFilter, QueryOrder,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use uuid::Uuid;

use crate::{
    dto::teams_poc::{IngestTranscriptRequest, MeetingResponse, ScheduleMeetingRequest},
    entities::poc_meetings,
    error::{AppError, AppResult},
    services::{graph_service, poc_meeting_service},
    state::AppState,
};

fn parse_dt(s: &str) -> Option<chrono::DateTime<chrono::FixedOffset>> {
    chrono::DateTime::parse_from_rfc3339(s).ok()
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

    let (source, graph_meeting_id, graph_organizer_id, join_url) = if cfg.graph_configured() {
        let organizer = req
            .organizer_id
            .clone()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| cfg.graph_default_organizer_id.clone());
        if organizer.is_empty() {
            return Err(AppError::BadRequest(
                "No organizer_id provided and GRAPH_DEFAULT_ORGANIZER_ID is unset.".to_string(),
            ));
        }
        let created = graph_service::create_teams_meeting(
            &state.http,
            cfg,
            &req.subject,
            &req.start_time,
            &req.end_time,
            &organizer,
        )
        .await?;
        (
            "graph_scheduled".to_string(),
            Some(created.online_meeting_id),
            Some(created.organizer_id),
            Some(created.join_url),
        )
    } else {
        // No Azure tenant wired — still create a demoable meeting so the
        // manual VTT-ingest flow can be exercised end to end.
        (
            "local_stub".to_string(),
            None,
            None,
            Some(format!(
                "https://teams.microsoft.com/l/meetup-join/POC-{id}"
            )),
        )
    };

    let model = poc_meetings::ActiveModel {
        id: Set(id),
        subject: Set(req.subject.clone()),
        source: Set(source),
        status: Set("scheduled".to_string()),
        start_time: Set(parse_dt(&req.start_time)),
        end_time: Set(parse_dt(&req.end_time)),
        organizer_email: Set(req
            .organizer_email
            .clone()
            .or_else(|| Some(cfg.graph_default_organizer_email.clone()).filter(|s| !s.is_empty()))),
        graph_online_meeting_id: Set(graph_meeting_id),
        graph_organizer_id: Set(graph_organizer_id),
        graph_transcript_id: Set(None),
        join_url: Set(join_url),
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
        error_message: Set(None),
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

// ── POST /teams-poc/meetings/:id/ingest-transcript ──────────────────────────
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

// ── POST /teams-poc/subscriptions/renew ─────────────────────────────────────
pub async fn renew_subscription(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let body = graph_service::create_transcript_subscription(&state.http, &state.config).await?;
    Ok(Json(json!({ "subscription": body })))
}

// ── POST /teams-poc/webhooks/graph/transcripts ─────────────────────────────
// Handles both the Graph validation handshake (`?validationToken=...`, echo as
// text/plain) and real `created` notifications.
pub async fn graph_webhook(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
    body: String,
) -> impl IntoResponse {
    if let Some(token) = params.get("validationToken") {
        return (StatusCode::OK, token.clone()).into_response();
    }

    let payload: Value = match serde_json::from_str(&body) {
        Ok(v) => v,
        Err(_) => return (StatusCode::BAD_REQUEST, "invalid body").into_response(),
    };

    // Return 202 fast; process each notification. (POC does it inline — prod
    // should enqueue.)
    if let Some(items) = payload["value"].as_array() {
        for item in items {
            if item["clientState"].as_str() != Some(state.config.graph_webhook_client_state.as_str())
            {
                tracing::warn!("Graph webhook: clientState mismatch, ignoring notification");
                continue;
            }
            if let Err(e) = handle_notification(&state, item).await {
                tracing::error!(error = %e, "Graph webhook: failed to process notification");
            }
        }
    }

    (StatusCode::ACCEPTED, "").into_response()
}

async fn handle_notification(state: &AppState, item: &Value) -> AppResult<()> {
    // resource looks like:
    //   users/{organizerId}/onlineMeetings('{meetingId}')/transcripts('{transcriptId}')
    let resource = item["resource"].as_str().unwrap_or_default();
    let organizer_id = between(resource, "users/", "/onlineMeetings").unwrap_or_default();
    let meeting_id = between(resource, "onlineMeetings('", "')").unwrap_or_default();
    let transcript_id = between(resource, "transcripts('", "')").unwrap_or_default();

    if organizer_id.is_empty() || meeting_id.is_empty() {
        return Err(AppError::BadRequest(format!(
            "Could not parse resource path: {resource}"
        )));
    }

    let transcript_id = if transcript_id.is_empty() {
        graph_service::latest_transcript_id(&state.http, &state.config, &organizer_id, &meeting_id)
            .await?
            .ok_or_else(|| AppError::NotFound("No transcript found for meeting".to_string()))?
    } else {
        transcript_id
    };

    let vtt = graph_service::fetch_transcript_vtt(
        &state.http,
        &state.config,
        &organizer_id,
        &meeting_id,
        &transcript_id,
    )
    .await?;

    // Correlate to an existing POC meeting, else create one (unlinked — a
    // human would link it to a governance request in the real app).
    let existing = poc_meetings::Entity::find()
        .filter(poc_meetings::Column::GraphOnlineMeetingId.eq(meeting_id.clone()))
        .one(&state.db)
        .await?;

    let row_id = match existing {
        Some(m) => {
            let mut am: poc_meetings::ActiveModel = m.into();
            am.graph_transcript_id = Set(Some(transcript_id.clone()));
            am.updated_at = Set(Some(now()));
            am.update(&state.db).await?.id
        }
        None => {
            let id = Uuid::new_v4();
            poc_meetings::ActiveModel {
                id: Set(id),
                subject: Set(format!("Auto-ingested Teams meeting {meeting_id}")),
                source: Set("teams_auto".to_string()),
                status: Set("scheduled".to_string()),
                start_time: Set(None),
                end_time: Set(None),
                organizer_email: Set(None),
                graph_online_meeting_id: Set(Some(meeting_id.clone())),
                graph_organizer_id: Set(Some(organizer_id.clone())),
                graph_transcript_id: Set(Some(transcript_id.clone())),
                join_url: Set(None),
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
                error_message: Set(None),
                created_at: Set(now()),
                updated_at: Set(None),
            }
            .insert(&state.db)
            .await?
            .id
        }
    };

    poc_meeting_service::process_transcript(&state.db, &state.http, &state.config, row_id, vtt)
        .await?;
    Ok(())
}

fn between(haystack: &str, start: &str, end: &str) -> Option<String> {
    let s = haystack.find(start)? + start.len();
    let e = haystack[s..].find(end)? + s;
    Some(haystack[s..e].to_string())
}
