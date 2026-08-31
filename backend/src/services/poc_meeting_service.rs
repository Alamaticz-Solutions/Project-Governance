//! Orchestration for the Teams meeting + VTT POC: turns a raw WebVTT
//! transcript into the same structured output the legacy Meeting Center
//! produced (summary / decisions / action items / agenda / optional BPMN),
//! reusing `meeting_agent_service`.

use sea_orm::{ActiveModelTrait, ActiveValue::Set, DatabaseConnection, EntityTrait};
use serde_json::json;
use uuid::Uuid;

use crate::{
    config::AppConfig,
    entities::poc_meetings,
    error::{AppError, AppResult},
    services::meeting_agent_service,
};

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

/// Runs the full extraction pipeline against a meeting row and persists the
/// results. Safe to call from either the manual-ingest handler or the Graph
/// webhook handler.
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

    let transcript_text = parse_vtt(&vtt);
    if transcript_text.trim().is_empty() {
        return Err(AppError::BadRequest("Transcript is empty after parsing.".to_string()));
    }

    // mark processing
    let mut am: poc_meetings::ActiveModel = meeting.into();
    am.status = Set("processing".to_string());
    am.transcript_vtt = Set(Some(vtt.clone()));
    am.transcript_text = Set(Some(transcript_text.clone()));
    am.updated_at = Set(Some(now()));
    let meeting = am.update(db).await?;

    let extraction = match meeting_agent_service::extract_meeting_notes(http, config, &transcript_text)
        .await
    {
        Ok(e) => e,
        Err(e) => {
            let mut am: poc_meetings::ActiveModel = meeting.into();
            am.status = Set("failed".to_string());
            am.error_message = Set(Some(format!("Extraction failed: {e}")));
            am.updated_at = Set(Some(now()));
            return Ok(am.update(db).await?);
        }
    };

    // Best-effort BPMN — a failure here must not fail the whole ingest.
    let (bpmn_xml, bpmn_status) = if extraction.contains_process_flow {
        match meeting_agent_service::generate_bpmn(http, config, &transcript_text).await {
            Ok(xml) => (Some(xml), Some("generated".to_string())),
            Err(e) => {
                tracing::warn!(error = %e, "POC BPMN generation failed");
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
