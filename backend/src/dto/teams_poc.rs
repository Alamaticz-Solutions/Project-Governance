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
    /// Stored on the record; also forwarded to the Power Automate scheduling flow.
    pub organizer_email: Option<String>,
    /// Email addresses (internal or external) to invite. Forwarded to the
    /// flow's Required Attendees field; each gets the native Outlook meeting
    /// invite automatically.
    #[serde(default)]
    pub attendees: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct IngestTranscriptRequest {
    /// Raw WebVTT (or plain text) transcript content.
    pub vtt_text: String,
}

/// Body for `POST /teams-poc/ingest` — the endpoint a Power Automate transcript
/// flow calls. Correlates to an existing row by `meeting_ref`; if none matches
/// it creates one (unless `INGEST_REJECT_UNKNOWN=true`).
#[derive(Debug, Deserialize)]
pub struct IngestByRefRequest {
    /// The same value the scheduling flow returned as `meeting_ref` (Teams
    /// online-meeting id, join URL, iCalUId — any stable key).
    pub meeting_ref: String,
    pub vtt_text: String,
    /// Optional metadata used only when a new row has to be created.
    pub subject: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub organizer_email: Option<String>,
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
    pub attendees: Value,
    pub external_ref: Option<String>,
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
            attendees: m.attendees,
            external_ref: m.external_ref,
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
