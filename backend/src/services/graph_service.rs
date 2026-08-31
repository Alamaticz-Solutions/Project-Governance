//! Microsoft Graph integration for the Teams meeting + VTT POC.
//!
//! Auth model: **app-only / client credentials**. A single Entra app
//! registration with the `OnlineMeetings.ReadWrite.All` and
//! `OnlineMeetingTranscript.Read.All` *application* permissions (admin
//! consented), plus a Teams *application access policy* granting that app id
//! against the organizer account(s). No user sign-in is involved — the app
//! acts with the organizer's authority for meeting creation and artifact
//! retrieval, which is why the tenant-level "only participants can view the
//! transcript" restriction does not apply to this path.
//!
//! For the POC the bearer token is fetched per call. Production should cache
//! it (expires in ~1h) behind a `tokio::sync::Mutex<Option<(String, Instant)>>`.

use serde_json::Value;

use crate::{
    config::AppConfig,
    error::{AppError, AppResult},
};

const GRAPH_BASE: &str = "https://graph.microsoft.com/v1.0";

fn require_configured(config: &AppConfig) -> AppResult<()> {
    if config.graph_configured() {
        Ok(())
    } else {
        Err(AppError::BadRequest(
            "Microsoft Graph is not configured. Set GRAPH_TENANT_ID / GRAPH_CLIENT_ID / \
             GRAPH_CLIENT_SECRET to enable Teams scheduling and automatic transcript ingest."
                .to_string(),
        ))
    }
}

/// Client-credentials grant against the tenant token endpoint.
async fn acquire_token(http: &reqwest::Client, config: &AppConfig) -> AppResult<String> {
    require_configured(config)?;

    let url = format!(
        "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
        config.graph_tenant_id
    );
    let params = [
        ("client_id", config.graph_client_id.as_str()),
        ("client_secret", config.graph_client_secret.as_str()),
        ("scope", "https://graph.microsoft.com/.default"),
        ("grant_type", "client_credentials"),
    ];

    let resp = http
        .post(&url)
        .form(&params)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Graph token request failed: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(anyhow::anyhow!(
            "Graph token request failed ({status}): {body}"
        )));
    }

    let body: Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Invalid Graph token response: {e}")))?;

    body["access_token"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("Graph token response missing access_token")))
}

pub struct CreatedMeeting {
    pub online_meeting_id: String,
    pub join_url: String,
    pub organizer_id: String,
}

/// `POST /users/{organizerId}/onlineMeetings` — creates a Teams meeting link.
/// This is the direct analog of a Google Calendar event with a Meet link
/// created via `conferenceData.createRequest`.
pub async fn create_teams_meeting(
    http: &reqwest::Client,
    config: &AppConfig,
    subject: &str,
    start_iso: &str,
    end_iso: &str,
    organizer_id: &str,
) -> AppResult<CreatedMeeting> {
    let token = acquire_token(http, config).await?;

    let url = format!("{GRAPH_BASE}/users/{organizer_id}/onlineMeetings");
    let payload = serde_json::json!({
        "subject": subject,
        "startDateTime": start_iso,
        "endDateTime": end_iso,
    });

    let resp = http
        .post(&url)
        .bearer_auth(&token)
        .json(&payload)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Graph createMeeting failed: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(anyhow::anyhow!(
            "Graph createMeeting failed ({status}): {body}"
        )));
    }

    let body: Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Invalid createMeeting response: {e}")))?;

    let online_meeting_id = body["id"]
        .as_str()
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("createMeeting response missing id")))?
        .to_string();
    let join_url = body["joinWebUrl"].as_str().unwrap_or_default().to_string();

    Ok(CreatedMeeting {
        online_meeting_id,
        join_url,
        organizer_id: organizer_id.to_string(),
    })
}

/// Fetches a specific transcript's content as WebVTT.
/// `GET /users/{organizerId}/onlineMeetings/{meetingId}/transcripts/{transcriptId}/content?$format=text/vtt`
pub async fn fetch_transcript_vtt(
    http: &reqwest::Client,
    config: &AppConfig,
    organizer_id: &str,
    online_meeting_id: &str,
    transcript_id: &str,
) -> AppResult<String> {
    let token = acquire_token(http, config).await?;

    let url = format!(
        "{GRAPH_BASE}/users/{organizer_id}/onlineMeetings/{online_meeting_id}/transcripts/{transcript_id}/content?$format=text/vtt"
    );

    let resp = http
        .get(&url)
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Graph transcript fetch failed: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(anyhow::anyhow!(
            "Graph transcript fetch failed ({status}): {body}"
        )));
    }

    resp.text()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Could not read transcript body: {e}")))
}

/// Fetches the newest transcript for a meeting (used when a change
/// notification only gives us the meeting id, not the transcript id).
pub async fn latest_transcript_id(
    http: &reqwest::Client,
    config: &AppConfig,
    organizer_id: &str,
    online_meeting_id: &str,
) -> AppResult<Option<String>> {
    let token = acquire_token(http, config).await?;
    let url =
        format!("{GRAPH_BASE}/users/{organizer_id}/onlineMeetings/{online_meeting_id}/transcripts");

    let resp = http
        .get(&url)
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Graph list transcripts failed: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(anyhow::anyhow!(
            "Graph list transcripts failed ({status}): {body}"
        )));
    }

    let body: Value = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Invalid list transcripts response: {e}")))?;

    let id = body["value"]
        .as_array()
        .and_then(|arr| arr.last())
        .and_then(|t| t["id"].as_str())
        .map(str::to_string);
    Ok(id)
}

/// Creates a tenant-wide change-notification subscription for meeting
/// transcripts. Short-lived (~1h max without lifecycle notifications) — a
/// scheduled renewal job is required in production; the POC exposes a manual
/// `POST /teams-poc/subscriptions/renew` trigger instead.
pub async fn create_transcript_subscription(
    http: &reqwest::Client,
    config: &AppConfig,
) -> AppResult<Value> {
    let token = acquire_token(http, config).await?;

    if config.graph_notification_url.is_empty() {
        return Err(AppError::BadRequest(
            "GRAPH_NOTIFICATION_URL must be set (public HTTPS URL Graph will POST to).".to_string(),
        ));
    }

    // ~55 minutes out — the ceiling for this resource without a
    // lifecycleNotificationUrl.
    let expiry = chrono::Utc::now() + chrono::Duration::minutes(55);

    let payload = serde_json::json!({
        "changeType": "created",
        "notificationUrl": config.graph_notification_url,
        "resource": "communications/onlineMeetings/getAllTranscripts",
        "includeResourceData": false,
        "expirationDateTime": expiry.to_rfc3339(),
        "clientState": config.graph_webhook_client_state,
    });

    let resp = http
        .post(format!("{GRAPH_BASE}/subscriptions"))
        .bearer_auth(&token)
        .json(&payload)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Graph subscription create failed: {e}")))?;

    let status = resp.status();
    let body: Value = resp.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(AppError::Internal(anyhow::anyhow!(
            "Graph subscription create failed ({status}): {body}"
        )));
    }
    Ok(body)
}
