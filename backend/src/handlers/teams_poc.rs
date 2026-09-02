//! Teams meeting + VTT POC endpoints — **Power Automate route** (no Graph).
//!
//! * Scheduling: the portal POSTs to a Power Automate flow (`schedule_via_flow`)
//!   which creates the Teams meeting and returns a join URL. Without a flow URL
//!   configured, a local-stub link is issued so the pipeline is still demoable.
//! * Transcript ingest: `POST /teams-poc/meetings/:id/ingest-transcript` (by
//!   row id, used by the portal UI) and `POST /teams-poc/ingest` (by
//!   `meeting_ref`, the endpoint a Power Automate transcript flow calls —
//!   guarded by `INGEST_API_KEY` when set).
//!
//! These endpoints are otherwise unauthenticated (the V1 frontend is on mock
//! auth). Wire `CurrentUser` back in when the POC folds into the real app.

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, QueryFilter, QueryOrder,
};
use serde_json::json;
use uuid::Uuid;

use crate::{
    dto::teams_poc::{
        IngestByRefRequest, IngestTranscriptRequest, MeetingResponse, ScheduleMeetingRequest,
    },
    entities::poc_meetings,
    error::{AppError, AppResult},
    services::{poc_meeting_service, power_automate_service},
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

/// Parse an optional RFC 3339 timestamp. Absent/blank → `None` (allowed); a
/// present-but-malformed value → 400 (the caller sent us bad data).
fn optional_dt(
    field: &str,
    s: Option<&str>,
) -> AppResult<Option<chrono::DateTime<chrono::FixedOffset>>> {
    match s.map(str::trim).filter(|s| !s.is_empty()) {
        Some(s) => Ok(Some(require_dt(field, s)?)),
        None => Ok(None),
    }
}

fn now() -> chrono::DateTime<chrono::FixedOffset> {
    chrono::Utc::now().into()
}

/// Enforces `INGEST_API_KEY` (via the `x-api-key` header) when it is configured.
/// A blank key means the endpoint is open — fine for a localhost-only backend.
fn check_ingest_key(state: &AppState, headers: &HeaderMap) -> AppResult<()> {
    let expected = state.config.ingest_api_key.trim();
    if expected.is_empty() {
        return Ok(());
    }
    let provided = headers
        .get("x-api-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .trim();
    if provided == expected {
        Ok(())
    } else {
        Err(AppError::Unauthorized(
            "Missing or invalid x-api-key header.".to_string(),
        ))
    }
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

    let (source, external_ref, join_url, error_message) = if cfg.schedule_via_flow() {
        let scheduled = power_automate_service::schedule_meeting_via_flow(
            &state.http,
            cfg,
            &req.subject,
            &req.start_time,
            &req.end_time,
            req.organizer_email.as_deref(),
            &req.attendees,
        )
        .await?;
        (
            "flow_scheduled".to_string(),
            scheduled.meeting_ref,
            scheduled.join_url,
            scheduled.error,
        )
    } else {
        // No scheduling flow wired — still create a demoable meeting so the
        // VTT-ingest flow can be exercised end to end.
        (
            "local_stub".to_string(),
            Some(id.to_string()),
            Some(format!("https://teams.microsoft.com/l/meetup-join/POC-{id}")),
            None,
        )
    };

    let model = poc_meetings::ActiveModel {
        id: Set(id),
        subject: Set(req.subject.clone()),
        source: Set(source),
        status: Set("scheduled".to_string()),
        start_time: Set(Some(start_dt)),
        end_time: Set(Some(end_dt)),
        organizer_email: Set(req.organizer_email.clone().filter(|s| !s.is_empty())),
        attendees: Set(json!(req.attendees)),
        external_ref: Set(external_ref),
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

// ── POST /teams-poc/meetings/:id/cancel ─────────────────────────────────────
// Only allowed while status is `scheduled` and the meeting's start time
// hasn't passed yet. Marks the row `cancelled` and clears `join_url` so the
// link can no longer be used — the row itself is kept (use DELETE to remove
// it). This only affects the local POC record; it does not cancel the
// underlying Teams meeting/Power Automate flow.
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

    let mut model: poc_meetings::ActiveModel = row.into();
    model.status = Set("cancelled".to_string());
    model.join_url = Set(None);
    model.updated_at = Set(Some(now()));
    let updated = model.update(&state.db).await?;
    Ok(Json(updated.into()))
}

// ── DELETE /teams-poc/meetings/:id ──────────────────────────────────────────
// Removes a meeting record (any status) from the portal. This only deletes
// the local POC row — it does not cancel the underlying Teams meeting, which
// is out of scope for this proof of concept.
pub async fn delete_meeting(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let row = poc_meetings::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Meeting not found".to_string()))?;
    poc_meetings::Entity::delete_by_id(row.id)
        .exec(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── POST /teams-poc/meetings/:id/ingest-transcript ──────────────────────────
// By row id — used by the portal UI (paste / upload) and by a flow that
// scheduled the meeting through the portal (it has the id).
pub async fn ingest_transcript(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<IngestTranscriptRequest>,
) -> AppResult<Json<MeetingResponse>> {
    let updated =
        poc_meeting_service::process_transcript(&state.db, &state.http, &state.config, id, req.vtt_text)
            .await?;
    Ok(Json(updated.into()))
}

// ── POST /teams-poc/ingest ─────────────────────────────────────────────────
// The endpoint a Power Automate transcript flow calls. Correlates by
// `meeting_ref`; creates a row if none matches (unless INGEST_REJECT_UNKNOWN).
// Idempotent: a ref already `processing`/`completed` is returned as-is rather
// than reprocessed (so a flow retry after a slow response is harmless).
pub async fn ingest_by_ref(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<IngestByRefRequest>,
) -> AppResult<Json<MeetingResponse>> {
    check_ingest_key(&state, &headers)?;

    let meeting_ref = req.meeting_ref.trim();
    if meeting_ref.is_empty() {
        return Err(AppError::BadRequest("meeting_ref is required.".to_string()));
    }

    let existing = poc_meetings::Entity::find()
        .filter(poc_meetings::Column::ExternalRef.eq(meeting_ref))
        .one(&state.db)
        .await?;

    let row_id = match existing {
        Some(m) => {
            if matches!(m.status.as_str(), "processing" | "completed") {
                // Already handled — flow retry / duplicate notification.
                return Ok(Json(m.into()));
            }
            m.id
        }
        None => {
            if state.config.ingest_reject_unknown {
                return Err(AppError::NotFound(format!(
                    "No meeting scheduled through the portal matches meeting_ref '{meeting_ref}' \
                     (INGEST_REJECT_UNKNOWN is on)."
                )));
            }
            let start_time = optional_dt("start_time", req.start_time.as_deref())?;
            let end_time = optional_dt("end_time", req.end_time.as_deref())?;
            if let (Some(s), Some(e)) = (start_time, end_time) {
                if e <= s {
                    return Err(AppError::BadRequest(
                        "end_time must be after start_time.".to_string(),
                    ));
                }
            }

            let id = Uuid::new_v4();
            poc_meetings::ActiveModel {
                id: Set(id),
                subject: Set(req.subject.clone().filter(|s| !s.is_empty()).unwrap_or_else(|| {
                    let short_ref: String = meeting_ref.chars().take(10).collect();
                    format!("Ingested Teams meeting ({short_ref}…)")
                })),
                source: Set("flow_ingest".to_string()),
                status: Set("scheduled".to_string()),
                start_time: Set(start_time),
                end_time: Set(end_time),
                organizer_email: Set(req.organizer_email.clone().filter(|s| !s.is_empty())),
                attendees: Set(json!([])),
                external_ref: Set(Some(meeting_ref.to_string())),
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

    let updated = poc_meeting_service::process_transcript(
        &state.db,
        &state.http,
        &state.config,
        row_id,
        req.vtt_text,
    )
    .await?;
    Ok(Json(updated.into()))
}
