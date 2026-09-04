//! The allow-listed named READ operations. Callers select an operation and
//! supply bound value parameters — they cannot choose endpoints or fields.
//!
//! Derived 1:1 from the legacy handlers (`teams_poc.rs`, `graph_meeting_service.rs`).
//! Nothing is invented. Every write equivalent lives in `writes.rs` and is
//! write_gated.

use super::request::{odata_string_literal, path_segment, RequestPlan};

#[derive(Debug, Clone)]
pub enum ReadOperation {
    /// `GET /users/{organizer}/onlineMeetings?$filter=JoinWebUrl eq '{join_url}'`
    GetOnlineMeetingByJoinUrl { organizer: String, join_url: String },
    /// `GET /users/{organizer}/onlineMeetings/{online_meeting_id}`
    GetOnlineMeeting {
        organizer: String,
        online_meeting_id: String,
    },
    /// `GET /users/{organizer}/onlineMeetings/{id}/transcripts/{transcript_id}/content`
    GetOnlineMeetingTranscript {
        organizer: String,
        online_meeting_id: String,
        transcript_id: String,
    },
    /// `GET /users?$search="{term}"&$select=id,displayName,mail,userPrincipalName&$top=10`
    SearchDirectoryUsers { term: String },
    /// `POST /users/{organizer}/calendar/getSchedule` — vendor-side read (no mutation)
    CheckOrganizerAvailability {
        organizer: String,
        schedules: Vec<String>,
        start_iso: String,
        end_iso: String,
    },
}

impl ReadOperation {
    pub fn name(&self) -> &'static str {
        match self {
            Self::GetOnlineMeetingByJoinUrl { .. } => "get_online_meeting_by_join_url",
            Self::GetOnlineMeeting { .. } => "get_online_meeting",
            Self::GetOnlineMeetingTranscript { .. } => "get_online_meeting_transcript",
            Self::SearchDirectoryUsers { .. } => "search_directory_users",
            Self::CheckOrganizerAvailability { .. } => "check_organizer_availability",
        }
    }

    /// True when the operation may return PHI-possible content (clinical-project
    /// meeting `subject` / transcript text). Callers must apply the pre-egress
    /// PHI decision gate (spec 004) before persisting or forwarding.
    pub fn phi_possible(&self) -> bool {
        matches!(
            self,
            Self::GetOnlineMeeting { .. } | Self::GetOnlineMeetingTranscript { .. }
        )
    }

    pub fn plan(&self) -> RequestPlan {
        match self {
            Self::GetOnlineMeetingByJoinUrl {
                organizer,
                join_url,
            } => RequestPlan::get(format!("/users/{}/onlineMeetings", path_segment(organizer)))
                .query(
                    "$filter",
                    format!("JoinWebUrl eq {}", odata_string_literal(join_url)),
                ),

            Self::GetOnlineMeeting {
                organizer,
                online_meeting_id,
            } => RequestPlan::get(format!(
                "/users/{}/onlineMeetings/{}",
                path_segment(organizer),
                path_segment(online_meeting_id)
            )),

            Self::GetOnlineMeetingTranscript {
                organizer,
                online_meeting_id,
                transcript_id,
            } => RequestPlan::get(format!(
                "/users/{}/onlineMeetings/{}/transcripts/{}/content",
                path_segment(organizer),
                path_segment(online_meeting_id),
                path_segment(transcript_id)
            ))
            .query("$format", "text/vtt")
            .accept(vec![
                "text/vtt",
                "application/vnd.microsoft.graph.transcript+text",
                "text/plain",
            ]),

            Self::SearchDirectoryUsers { term } => RequestPlan::get("/users")
                // $search value is a quoted phrase; reqwest escapes it as a param value
                .query("$search", format!("\"{}\"", term.replace('"', "")))
                .query("$select", "id,displayName,mail,userPrincipalName")
                .query("$top", "10")
                .header("ConsistencyLevel", "eventual"),

            Self::CheckOrganizerAvailability {
                organizer,
                schedules: _,
                start_iso: _,
                end_iso: _,
            } => RequestPlan::post(format!(
                "/users/{}/calendar/getSchedule",
                path_segment(organizer)
            )),
        }
    }

    /// JSON body for the one POST-shaped read.
    pub fn body(&self) -> Option<serde_json::Value> {
        match self {
            Self::CheckOrganizerAvailability {
                schedules,
                start_iso,
                end_iso,
                ..
            } => Some(serde_json::json!({
                "schedules": schedules,
                "startTime": { "dateTime": start_iso, "timeZone": "UTC" },
                "endTime": { "dateTime": end_iso, "timeZone": "UTC" },
                "availabilityViewInterval": 30
            })),
            _ => None,
        }
    }
}
