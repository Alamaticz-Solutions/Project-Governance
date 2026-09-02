//! Teams meeting scheduling via a Power Automate flow.
//!
//! There is **no Microsoft Graph** in this path — no app registration, no
//! client secret, no admin consent. The portal makes one outbound HTTPS call
//! to a Power Automate flow's "When a HTTP request is received" trigger. That
//! flow runs the Teams connector's "Create a Teams meeting" action as **its
//! own connection identity** (whoever built the flow) and returns the join URL.
//!
//! Expected flow response body (a Power Automate "Response" action):
//! ```json
//! { "join_url": "https://teams.microsoft.com/l/meetup-join/...",
//!   "meeting_ref": "<Teams online-meeting id or any stable correlation key>" }
//! ```
//! `meeting_ref` is optional but recommended — it lets a later transcript
//! POST correlate back to this row.

use std::time::Duration;

use serde_json::Value;

use crate::{config::AppConfig, error::AppResult};

/// Upper bound on the outbound call to the Power Automate flow. The Teams
/// connector's "Create a Teams meeting" action can legitimately take a while,
/// but a throttled/hung flow must not block the portal's schedule request
/// indefinitely — a timeout here surfaces as a stored `error` the user retries.
const FLOW_CALL_TIMEOUT_SECS: u64 = 30;

pub struct ScheduledMeeting {
    pub join_url: Option<String>,
    pub meeting_ref: Option<String>,
    /// Set when the flow call did not return a usable result; the caller
    /// stores it on the row instead of failing the whole schedule request.
    pub error: Option<String>,
}

/// POST the meeting details to the configured Power Automate flow. Never
/// returns `Err` for a flow-side problem — a bad/absent response comes back as
/// `ScheduledMeeting { error: Some(..), .. }` so the portal can still persist a
/// row the user can see and retry.
pub async fn schedule_meeting_via_flow(
    http: &reqwest::Client,
    config: &AppConfig,
    subject: &str,
    start_iso: &str,
    end_iso: &str,
    organizer_email: Option<&str>,
    attendees: &[String],
) -> AppResult<ScheduledMeeting> {
    let payload = serde_json::json!({
        "subject": subject,
        "start_time": start_iso,
        "end_time": end_iso,
        "organizer_email": organizer_email.unwrap_or_default(),
        // Email addresses (internal or external) for the flow's Required
        // Attendees field. Bind this array directly to that field in the
        // "Create a Teams meeting" action — no per-item loop needed.
        "attendees": attendees,
    });

    let resp = match http
        .post(&config.power_automate_schedule_url)
        .json(&payload)
        .timeout(Duration::from_secs(FLOW_CALL_TIMEOUT_SECS))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            let reason = if e.is_timeout() {
                format!(
                    "Power Automate scheduling flow did not respond within {FLOW_CALL_TIMEOUT_SECS}s"
                )
            } else {
                format!("Could not reach the Power Automate scheduling flow: {e}")
            };
            return Ok(ScheduledMeeting {
                join_url: None,
                meeting_ref: None,
                error: Some(reason),
            });
        }
    };

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        return Ok(ScheduledMeeting {
            join_url: None,
            meeting_ref: None,
            error: Some(format!(
                "Power Automate scheduling flow returned {status}: {}",
                text.chars().take(500).collect::<String>()
            )),
        });
    }

    // The flow's Response action body. Be lenient about shape.
    let body: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
    let join_url = body
        .get("join_url")
        .or_else(|| body.get("joinUrl"))
        .or_else(|| body.get("joinWebUrl"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .filter(|s| !s.is_empty());
    let meeting_ref = body
        .get("meeting_ref")
        .or_else(|| body.get("meetingRef"))
        .or_else(|| body.get("id"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .filter(|s| !s.is_empty());

    if join_url.is_none() {
        return Ok(ScheduledMeeting {
            join_url: None,
            meeting_ref,
            error: Some(format!(
                "Power Automate flow responded {status} but with no join_url. Body: {}",
                text.chars().take(500).collect::<String>()
            )),
        });
    }

    Ok(ScheduledMeeting {
        join_url,
        meeting_ref,
        error: None,
    })
}
