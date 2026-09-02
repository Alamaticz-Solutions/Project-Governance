//! Orchestration for the Teams meeting + VTT POC: turns a raw WebVTT
//! transcript into the same structured output the legacy Meeting Center
//! produced (summary / decisions / action items / agenda / optional BPMN),
//! reusing `meeting_agent_service`.

use std::time::Duration;

use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter,
};
use serde_json::json;
use uuid::Uuid;

use crate::{
    config::AppConfig,
    entities::poc_meetings,
    error::{AppError, AppResult},
    services::meeting_agent_service,
};

/// How long the LLM extraction step may run before the request gives up and
/// marks the row `failed`. Without this bound a hung upstream call would pin
/// the row in `processing` for the lifetime of the process.
const EXTRACTION_TIMEOUT_SECS: u64 = 240;

/// Minutes a row may sit in `processing` before the background sweep
/// (`spawn_stuck_meeting_reaper`) marks it `failed`. Covers a backend
/// crash/restart or a cancelled request that left the row mid-pipeline —
/// without this the detail page polls such a row forever with no recovery.
const STUCK_PROCESSING_MINUTES: i64 = 15;

/// Collapses a WebVTT caption file into plain, speaker-attributed lines.
/// Falls back to returning the input unchanged when it isn't VTT (e.g. a
/// plain `.txt` transcript pasted in).
pub fn parse_vtt(raw: &str) -> String {
    let looks_like_vtt = raw.trim_start().starts_with("WEBVTT");
    if !looks_like_vtt {
        return raw.trim().to_string();
    }

    let mut lines: Vec<String> = Vec::new();
    for line in raw.lines() {
        let l = line.trim();
        if l.is_empty()
            || l == "WEBVTT"
            || l.starts_with("NOTE")
            || l.contains("-->")
            || l.chars().all(|c| c.is_ascii_digit())
        {
            continue;
        }
        // `<v Speaker Name>text</v>` → `Speaker Name: text`
        let cleaned = if let Some(rest) = l.strip_prefix("<v ") {
            if let Some((speaker, tail)) = rest.split_once('>') {
                let text = tail.replace("</v>", "").trim().to_string();
                format!("{}: {}", speaker.trim(), text)
            } else {
                l.to_string()
            }
        } else {
            l.to_string()
        };
        lines.push(cleaned);
    }
    lines.join("\n")
}

fn now() -> chrono::DateTime<chrono::FixedOffset> {
    chrono::Utc::now().into()
}

async fn mark_failed(
    db: &DatabaseConnection,
    meeting: poc_meetings::Model,
    message: String,
) -> AppResult<poc_meetings::Model> {
    let mut am: poc_meetings::ActiveModel = meeting.into();
    am.status = Set("failed".to_string());
    am.error_message = Set(Some(message));
    am.updated_at = Set(Some(now()));
    Ok(am.update(db).await?)
}

/// Runs the full extraction pipeline against a meeting row and persists the
/// results. Safe to call from either the manual-ingest handler or the flow
/// webhook handler, and safe to call concurrently for the same row: the
/// `scheduled`/`failed` → `processing` transition is done as a single
/// conditional UPDATE, so only one caller ever runs the (expensive, LLM-backed)
/// pipeline. A duplicate/racing call gets the current row back untouched.
pub async fn process_transcript(
    db: &DatabaseConnection,
    http: &reqwest::Client,
    config: &AppConfig,
    meeting_id: Uuid,
    vtt: String,
) -> AppResult<poc_meetings::Model> {
    let meeting = poc_meetings::Entity::find_by_id(meeting_id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound("Meeting not found".to_string()))?;

    // Fast path: already handled or in flight — never reprocess.
    if matches!(meeting.status.as_str(), "processing" | "completed") {
        return Ok(meeting);
    }

    let transcript_text = parse_vtt(&vtt);
    if transcript_text.trim().is_empty() {
        return Err(AppError::BadRequest("Transcript is empty after parsing.".to_string()));
    }

    // Atomically claim the row. Only the caller that flips it out of
    // scheduled/failed into `processing` proceeds; a concurrent caller sees
    // rows_affected == 0 and returns the current row instead of running the
    // pipeline a second time (duplicate flow delivery / UI double-submit).
    let claim = poc_meetings::ActiveModel {
        status: Set("processing".to_string()),
        transcript_vtt: Set(Some(vtt.clone())),
        transcript_text: Set(Some(transcript_text.clone())),
        updated_at: Set(Some(now())),
        ..Default::default()
    };
    let claimed = poc_meetings::Entity::update_many()
        .set(claim)
        .filter(poc_meetings::Column::Id.eq(meeting_id))
        .filter(poc_meetings::Column::Status.is_in(["scheduled", "failed"]))
        .exec(db)
        .await?;

    if claimed.rows_affected == 0 {
        // Lost the race — return whatever the winning caller left behind.
        return poc_meetings::Entity::find_by_id(meeting_id)
            .one(db)
            .await?
            .ok_or_else(|| AppError::NotFound("Meeting not found".to_string()));
    }

    let meeting = poc_meetings::Entity::find_by_id(meeting_id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound("Meeting not found".to_string()))?;

    // Bound the LLM call so a slow/hung upstream can't strand the row.
    let extraction = match tokio::time::timeout(
        Duration::from_secs(EXTRACTION_TIMEOUT_SECS),
        meeting_agent_service::extract_meeting_notes(http, config, &transcript_text),
    )
    .await
    {
        Ok(Ok(e)) => e,
        Ok(Err(e)) => {
            return mark_failed(db, meeting, format!("Extraction failed: {e}")).await;
        }
        Err(_) => {
            return mark_failed(
                db,
                meeting,
                format!("Extraction timed out after {EXTRACTION_TIMEOUT_SECS}s — please retry."),
            )
            .await;
        }
    };

    // Best-effort BPMN — a failure here must not fail the whole ingest.
    let (bpmn_xml, bpmn_status) = if extraction.contains_process_flow {
        match tokio::time::timeout(
            Duration::from_secs(EXTRACTION_TIMEOUT_SECS),
            meeting_agent_service::generate_bpmn(http, config, &transcript_text),
        )
        .await
        {
            Ok(Ok(xml)) => (Some(xml), Some("generated".to_string())),
            Ok(Err(e)) => {
                tracing::warn!(error = %e, "POC BPMN generation failed");
                (None, Some("failed".to_string()))
            }
            Err(_) => {
                tracing::warn!("POC BPMN generation timed out");
                (None, Some("failed".to_string()))
            }
        }
    } else {
        (None, None)
    };

    let mut am: poc_meetings::ActiveModel = meeting.into();
    am.status = Set("completed".to_string());
    am.summary = Set(Some(extraction.summary.clone()));
    am.decisions = Set(json!(extraction.decisions));
    am.action_items = Set(serde_json::to_value(&extraction.action_items).unwrap_or(json!([])));
    am.agenda_items = Set(serde_json::to_value(&extraction.agenda_items).unwrap_or(json!([])));
    am.contains_process_flow = Set(extraction.contains_process_flow);
    am.process_name = Set(extraction.process_name.clone());
    am.bpmn_xml = Set(bpmn_xml);
    am.bpmn_status = Set(bpmn_status);
    am.error_message = Set(None);
    am.updated_at = Set(Some(now()));
    Ok(am.update(db).await?)
}

/// Background sweep: every 60s, any row still `processing` whose `updated_at`
/// is older than `STUCK_PROCESSING_MINUTES` is flipped to `failed` with a
/// retry-able message. This is the recovery path for a crash/restart/OOM or a
/// cancelled request that left a row mid-pipeline.
pub fn spawn_stuck_meeting_reaper(db: DatabaseConnection) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(60));
        loop {
            tick.tick().await;
            let cutoff = now() - chrono::Duration::minutes(STUCK_PROCESSING_MINUTES);
            let reap = poc_meetings::ActiveModel {
                status: Set("failed".to_string()),
                error_message: Set(Some(format!(
                    "Processing did not complete within {STUCK_PROCESSING_MINUTES} minutes \
                     (the backend may have restarted). Re-ingest the transcript to retry."
                ))),
                updated_at: Set(Some(now())),
                ..Default::default()
            };
            match poc_meetings::Entity::update_many()
                .set(reap)
                .filter(poc_meetings::Column::Status.eq("processing"))
                .filter(poc_meetings::Column::UpdatedAt.lt(cutoff))
                .exec(&db)
                .await
            {
                Ok(r) if r.rows_affected > 0 => {
                    tracing::warn!(count = r.rows_affected, "reaped stuck 'processing' POC meetings")
                }
                Ok(_) => {}
                Err(e) => tracing::error!(error = %e, "POC meeting reaper sweep failed"),
            }
        }
    });
}
