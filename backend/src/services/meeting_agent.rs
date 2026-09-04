//! `Meeting.process_transcript` orchestration (spec 003 owns this custom
//! method). Steps:
//!   1. obtain the transcript — a governed Graph READ via the named-operation
//!      registry, OR a manually pasted / uploaded VTT (no Graph call);
//!   2. parse VTT -> plain text;
//!   3. AI extraction — spec 004's single AI-egress boundary + pre-egress PHI
//!      classification gate. That module is NOT built yet, so extraction is
//!      recorded as `ai_status: pending` and no content is sent anywhere;
//!   4. persist onto the Meeting row (generated Update, honoring the
//!      concurrency facet).
//!
//! Portal-created meetings / cancels / subscriptions are Graph WRITES and are
//! write_gated (spec 003). This method never performs a Graph write.

use std::{sync::Arc, time::Duration};

use chrono::Utc;
use serde_json::json;

use crate::{
    product_api::{DataAccess, HandlerResult, JsonValue, UserAuth},
    schemas::governance::{InputMeeting, MeetingProjection},
    services::{
        audit,
        graph::{GraphClient, ReadOperation},
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
            field("graph_online_meeting_id"),
            field("graph_organizer_user_id"),
            field("graph_transcript_id"),
            field("join_url"),
            field("transcript_vtt"),
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
        source: p.source.clone().unwrap_or_else(|| "external".to_string()),
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

/// Strip WEBVTT headers, cue identifiers, and `hh:mm:ss.mmm --> …` timing lines,
/// leaving the spoken text.
fn vtt_to_text(vtt: &str) -> String {
    let mut out = String::new();
    for line in vtt.lines() {
        let t = line.trim();
        if t.is_empty()
            || t == "WEBVTT"
            || t.starts_with("NOTE ")
            || t.starts_with("STYLE")
            || t.contains("-->")
            || t.chars().all(|c| c.is_ascii_digit())
        {
            continue;
        }
        if !out.is_empty() {
            out.push(' ');
        }
        out.push_str(t);
    }
    out
}

/// `payload`: `{ "vtt"?: string, "organizer"?: string }`.
/// If `vtt` is present it is used verbatim (manual paste — no Graph call).
pub async fn process_transcript(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    meeting_id: String,
    payload: JsonValue,
) -> HandlerResult<JsonValue> {
    require_user(user)?;
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

    // --- 1. obtain the transcript ---
    let (vtt, source) = if let Some(pasted) = payload.get("vtt").and_then(|v| v.as_str()) {
        (pasted.to_string(), "manual_paste")
    } else {
        let online_id = meeting.graph_online_meeting_id.clone().ok_or_else(|| {
            anyhow::anyhow!(
                "no transcript source: meeting has no graph_online_meeting_id and no vtt was pasted"
            )
        })?;
        let transcript_id = meeting
            .graph_transcript_id
            .clone()
            .ok_or_else(|| anyhow::anyhow!("meeting has no graph_transcript_id to fetch"))?;
        let http = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(120))
            .build()
            .map_err(|_| anyhow::anyhow!("failed to build http client"))?;
        let client = GraphClient::from_env(http).ok_or_else(|| {
            anyhow::anyhow!("Microsoft Graph is not configured (see spec 003 auth contract)")
        })?;
        let organizer = payload
            .get("organizer")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| meeting.graph_organizer_user_id.clone())
            .or_else(|| meeting.organizer_email.clone())
            .unwrap_or_else(|| client.default_organizer());
        let res = client
            .read(ReadOperation::GetOnlineMeetingTranscript {
                organizer,
                online_meeting_id: online_id,
                transcript_id,
            })
            .await?;
        let text = res
            .get("text")
            .and_then(|t| t.as_str())
            .ok_or_else(|| anyhow::anyhow!("transcript response carried no text"))?
            .to_string();
        (text, "graph_read")
    };

    let text = vtt_to_text(&vtt);

    // --- 3. AI extraction — deferred to spec 004's egress boundary ---
    // No content is sent anywhere. Store the raw material; mark extraction pending.
    let ai_status =
        "pending: spec 004 AI-egress boundary + pre-egress PHI classification gate not yet built";

    // --- 4. persist ---
    let mut input = meeting_input(&meeting);
    input.transcript_vtt = Some(vtt);
    input.transcript_text = Some(text.clone());
    input.status = "transcript_captured".to_string();
    input.summary = None;
    input.bpmn_status = Some("ai_pending".to_string());

    let saved = data_access
        .update_item::<InputMeeting, MeetingProjection>(
            meeting_type,
            selection("meeting", &[field("id"), field("status"), field("version")]),
            input,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    audit::record(
        data_access,
        user,
        None,
        "Meeting",
        &meeting_id,
        "TRANSCRIPT_CAPTURED",
        Some(json!({ "source": source, "chars": text.len() })),
    )
    .await?;

    Ok(json!({
        "ok": true,
        "meeting_id": meeting_id,
        "transcript_source": source,
        "transcript_chars": text.len(),
        "status": saved.status,
        "version": saved.version,
        "ai_status": ai_status,
        "note": "transcript stored; summary/decisions/action-items pending the governed AI-egress boundary (spec 004)",
    }))
}
