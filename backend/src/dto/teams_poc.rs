use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::entities::poc_meetings;

#[derive(Debug, Deserialize)]
pub struct ScheduleMeetingRequest {
    pub subject: String,
    /// ISO-8601 (e.g. `2026-09-01T10:00:00Z`)
    pub start_time: String,
    pub end_time: String,
    /// Overrides `GRAPH_DEFAULT_ORGANIZER_ID` when set.
    pub organizer_id: Option<String>,
    pub organizer_email: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct IngestTranscriptRequest {
    /// Raw WebVTT (or plain text) transcript content.
    pub vtt_text: String,
}

#[derive(Debug, Serialize)]
pub struct MeetingResponse {
    pub id: Uuid,
    pub subject: String,
    pub source: String,
    pub status: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub organizer_email: Option<String>,
    pub graph_online_meeting_id: Option<String>,
    pub join_url: Option<String>,
    pub transcript_text: Option<String>,
    pub summary: Option<String>,
    pub decisions: Value,
    pub action_items: Value,
    pub agenda_items: Value,
    pub contains_process_flow: bool,
    pub process_name: Option<String>,
    pub bpmn_xml: Option<String>,
    pub bpmn_status: Option<String>,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

impl From<poc_meetings::Model> for MeetingResponse {
    fn from(m: poc_meetings::Model) -> Self {
        Self {
            id: m.id,
            subject: m.subject,
            source: m.source,
            status: m.status,
            start_time: m.start_time.map(|d| d.to_rfc3339()),
            end_time: m.end_time.map(|d| d.to_rfc3339()),
            organizer_email: m.organizer_email,
            graph_online_meeting_id: m.graph_online_meeting_id,
            join_url: m.join_url,
            transcript_text: m.transcript_text,
            summary: m.summary,
            decisions: m.decisions,
            action_items: m.action_items,
            agenda_items: m.agenda_items,
            contains_process_flow: m.contains_process_flow,
            process_name: m.process_name,
            bpmn_xml: m.bpmn_xml,
            bpmn_status: m.bpmn_status,
            error_message: m.error_message,
            created_at: m.created_at.to_rfc3339(),
            updated_at: m.updated_at.map(|d| d.to_rfc3339()),
        }
    }
}
