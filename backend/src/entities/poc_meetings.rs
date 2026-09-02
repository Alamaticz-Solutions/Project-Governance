use sea_orm::entity::prelude::*;
use serde::Serialize;

/// POC-only meeting record for the Teams-scheduling + VTT-ingest proof of
/// concept. Standalone (no relations) by design — see the
/// `m20260101_000003_teams_poc` migration.
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "poc_meetings")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub subject: String,
    /// `local_stub` | `flow_scheduled` | `flow_ingest` | `manual_ingest`
    pub source: String,
    /// `scheduled` | `processing` | `completed` | `failed`
    pub status: String,

    pub start_time: Option<DateTimeWithTimeZone>,
    pub end_time: Option<DateTimeWithTimeZone>,
    pub organizer_email: Option<String>,
    /// Attendee email addresses (internal or external) forwarded to the
    /// scheduling flow's Required Attendees field.
    pub attendees: Json,

    /// Correlation key (mirrors `graph_online_meeting_id`) kept for display
    /// continuity with earlier POC iterations.
    pub external_ref: Option<String>,
    pub join_url: Option<String>,

    /// Calendar event id — used to cancel/delete the event in Graph.
    pub graph_event_id: Option<String>,
    /// The `MSo…` onlineMeeting id. Matches the `meetingId` carried by a
    /// transcript change notification.
    pub graph_online_meeting_id: Option<String>,
    /// Entra object id of the mailbox that hosts this meeting.
    pub graph_organizer_user_id: Option<String>,
    /// Id of the transcript already processed for this row (idempotency aid
    /// against duplicate notifications).
    pub graph_transcript_id: Option<String>,

    pub transcript_vtt: Option<String>,
    pub transcript_text: Option<String>,

    pub summary: Option<String>,
    pub decisions: Json,
    pub action_items: Json,
    pub agenda_items: Json,
    pub contains_process_flow: bool,
    pub process_name: Option<String>,
    pub bpmn_xml: Option<String>,
    pub bpmn_status: Option<String>,

    pub error_message: Option<String>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
