//! Teams meeting scheduling + transcript retrieval via Microsoft Graph
//! (app-only). Replaces `power_automate_service`.
//!
//! Scheduling creates a **calendar event** (`POST /users/{organizer}/events`
//! with `isOnlineMeeting: true`), not a standalone `/onlineMeetings` — the
//! latter is not calendar-backed and its transcripts are unreachable via Graph,
//! and it sends no invitations.

use chrono::{DateTime, FixedOffset, Utc};
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter,
};
use serde::Deserialize;
use serde_json::json;

use crate::{
    config::AppConfig,
    entities::poc_meetings,
    error::{AppError, AppResult},
    services::{
        graph_client::{graph_error, GraphClient},
        poc_meeting_service,
    },
};

fn now() -> DateTime<FixedOffset> {
    Utc::now().into()
}

// ── Scheduling ─────────────────────────────────────────────────────────────

pub struct ScheduledMeeting {
    pub join_url: Option<String>,
    pub graph_event_id: Option<String>,
    pub graph_online_meeting_id: Option<String>,
    /// Set when Graph could not complete the request; the caller still persists
    /// a retryable row (mirrors the old `power_automate_service` contract).
    pub error: Option<String>,
}

/// `POST /users/{organizer}/events` (calendar-backed Teams meeting) then resolve
/// the `onlineMeeting.id` from the join URL. Never returns `Err` for a
/// Graph-side failure — it comes back as `error: Some(..)`.
pub async fn schedule_meeting_via_graph(
    graph: &GraphClient,
    organizer_id: &str,
    subject: &str,
    start: DateTime<FixedOffset>,
    end: DateTime<FixedOffset>,
    attendees: &[String],
) -> AppResult<ScheduledMeeting> {
    let attendee_json: Vec<_> = attendees
        .iter()
        .filter(|a| !a.trim().is_empty())
        .map(|a| json!({ "emailAddress": { "address": a.trim() }, "type": "required" }))
        .collect();

    let body = json!({
        "subject": subject,
        "body": { "contentType": "HTML", "content": "Scheduled via the Governance Portal." },
        "start": { "dateTime": start.naive_utc().format("%Y-%m-%dT%H:%M:%S").to_string(), "timeZone": "UTC" },
        "end":   { "dateTime": end.naive_utc().format("%Y-%m-%dT%H:%M:%S").to_string(),   "timeZone": "UTC" },
        "attendees": attendee_json,
        "isOnlineMeeting": true,
        "onlineMeetingProvider": "teamsForBusiness",
        "allowNewTimeProposals": false
    });

    let fail = |msg: String| ScheduledMeeting {
        join_url: None,
        graph_event_id: None,
        graph_online_meeting_id: None,
        error: Some(msg),
    };

    let path = format!("/users/{organizer_id}/events");
    let resp = match graph.post_json(&path, &body).await {
        Ok(r) => r,
        Err(e) => return Ok(fail(e.to_string())),
    };
    if !resp.status().is_success() {
        return Ok(fail(graph_error(resp).await.to_string()));
    }

    #[derive(Deserialize)]
    struct EventResp {
        id: String,
        #[serde(rename = "onlineMeeting")]
        online_meeting: Option<OnlineMeetingInfo>,
    }
    #[derive(Deserialize)]
    struct OnlineMeetingInfo {
        #[serde(rename = "joinUrl")]
        join_url: Option<String>,
    }

    let event: EventResp = match resp.json().await {
        Ok(e) => e,
        Err(e) => return Ok(fail(format!("Event created but response parse failed: {e}"))),
    };
    let join_url = event.online_meeting.and_then(|m| m.join_url);

    // Best-effort id resolution; the transcript webhook has a fallback path.
    let online_meeting_id = match &join_url {
        Some(url) => resolve_online_meeting_id(graph, organizer_id, url)
            .await
            .unwrap_or(None),
        None => None,
    };

    Ok(ScheduledMeeting {
        join_url,
        graph_event_id: Some(event.id),
        graph_online_meeting_id: online_meeting_id,
        error: None,
    })
}

/// `GET /users/{organizer}/onlineMeetings?$filter=JoinWebUrl eq '{joinUrl}'`.
/// Graph matches on the join URL **without** its `?context=…` query part.
pub async fn resolve_online_meeting_id(
    graph: &GraphClient,
    organizer_id: &str,
    join_url: &str,
) -> AppResult<Option<String>> {
    let base = join_url.split('?').next().unwrap_or(join_url);
    let filter = format!("JoinWebUrl eq '{}'", base.replace('\'', "''"));
    let path = format!("/users/{organizer_id}/onlineMeetings");
    let resp = graph.get_query(&path, &[("$filter", filter.as_str())]).await?;
    if !resp.status().is_success() {
        return Err(graph_error(resp).await);
    }
    #[derive(Deserialize)]
    struct ListResp {
        value: Vec<IdOnly>,
    }
    #[derive(Deserialize)]
    struct IdOnly {
        id: String,
    }
    let list: ListResp = resp.json().await.map_err(|e| AppError::Upstream {
        code: None,
        message: format!("onlineMeetings $filter parse failed: {e}"),
        retryable: false,
    })?;
    Ok(list.value.into_iter().next().map(|m| m.id))
}

/// `DELETE /users/{organizer}/events/{eventId}` — sends cancellations to
/// attendees. 404 is treated as already-gone.
pub async fn cancel_event(
    graph: &GraphClient,
    organizer_id: &str,
    event_id: &str,
) -> AppResult<()> {
    graph
        .delete(&format!("/users/{organizer_id}/events/{event_id}"))
        .await
}

// ── Transcript retrieval ───────────────────────────────────────────────────

/// `GET …/transcripts/{id}/content?$format=text/vtt`, falling back to the
/// unattributed plain-text format when speaker attribution is disabled.
pub async fn fetch_transcript_vtt(
    graph: &GraphClient,
    organizer_id: &str,
    online_meeting_id: &str,
    transcript_id: &str,
) -> AppResult<String> {
    let path = format!(
        "/users/{organizer_id}/onlineMeetings/{online_meeting_id}/transcripts/{transcript_id}/content"
    );

    let read_body = |resp: reqwest::Response| async move {
        resp.text().await.map_err(|e| AppError::Upstream {
            code: None,
            message: format!("transcript body read failed: {e}"),
            retryable: true,
        })
    };

    let resp = graph.get_query(&path, &[("$format", "text/vtt")]).await?;
    if resp.status().is_success() {
        return read_body(resp).await;
    }

    let err = graph_error(resp).await;
    let attribution_disabled = matches!(
        &err,
        AppError::Upstream { code: Some(c), .. } if c == "SpeakerAttributionNotAllowed"
    );
    if attribution_disabled {
        let resp2 = graph
            .get_with_accept(&path, "application/vnd.microsoft.graph.transcript+text")
            .await?;
        if resp2.status().is_success() {
            return read_body(resp2).await;
        }
        return Err(graph_error(resp2).await);
    }
    Err(err)
}

// ── Notification → ingest orchestration ────────────────────────────────────

/// Identifiers pulled out of a transcript change-notification `resource` string
/// (`users/{org}/onlineMeetings('MSo…')/transcripts('MSM…')`).
pub struct TranscriptRef {
    pub organizer_id: String,
    pub online_meeting_id: String,
    pub transcript_id: String,
}

pub fn parse_transcript_resource(resource: &str) -> Option<TranscriptRef> {
    let after_users = resource.split("users/").nth(1)?;
    let organizer_id = after_users
        .split(['/', '('])
        .next()?
        .trim_matches('\'')
        .to_string();
    let online_meeting_id = extract_seg(after_users, "onlineMeetings")?;
    let transcript_id = extract_seg(after_users, "transcripts")?;
    if organizer_id.is_empty() || online_meeting_id.is_empty() || transcript_id.is_empty() {
        return None;
    }
    Some(TranscriptRef {
        organizer_id,
        online_meeting_id,
        transcript_id,
    })
}

/// Pull the id segment after `key`, handling both `key('id')` and `key/id/…`.
fn extract_seg(s: &str, key: &str) -> Option<String> {
    let i = s.find(key)?;
    let rest = &s[i + key.len()..];
    if let Some(p) = rest.strip_prefix('(') {
        let end = p.find(')')?;
        return Some(p[..end].trim_matches('\'').to_string());
    }
    if let Some(p) = rest.strip_prefix('/') {
        let end = p.find('/').unwrap_or(p.len());
        return Some(p[..end].trim_matches('\'').to_string());
    }
    None
}

/// Correlate a transcript notification to a portal-scheduled meeting, download
/// the VTT, and run the (unchanged) extraction pipeline.
pub async fn ingest_from_notification(
    db: &DatabaseConnection,
    graph: &GraphClient,
    http: &reqwest::Client,
    config: &AppConfig,
    tref: TranscriptRef,
) -> AppResult<()> {
    let row = match poc_meetings::Entity::find()
        .filter(poc_meetings::Column::GraphOnlineMeetingId.eq(tref.online_meeting_id.as_str()))
        .one(db)
        .await?
    {
        Some(r) => Some(r),
        None => backfill_by_join_url(db, graph, &tref).await?,
    };

    let Some(row) = row else {
        tracing::info!(
            meeting = %tref.online_meeting_id,
            "transcript notification for a meeting not scheduled via the portal — ignored"
        );
        return Ok(());
    };

    // Duplicate notification for a transcript we already have.
    if row.graph_transcript_id.as_deref() == Some(tref.transcript_id.as_str())
        && matches!(row.status.as_str(), "processing" | "completed")
    {
        return Ok(());
    }

    let row_id = row.id;
    let vtt = fetch_transcript_vtt(
        graph,
        &tref.organizer_id,
        &tref.online_meeting_id,
        &tref.transcript_id,
    )
    .await?;

    // Note which transcript we're about to process (idempotency aid).
    if let Some(m) = poc_meetings::Entity::find_by_id(row_id).one(db).await? {
        let mut am: poc_meetings::ActiveModel = m.into();
        am.graph_transcript_id = Set(Some(tref.transcript_id.clone()));
        am.updated_at = Set(Some(now()));
        am.update(db).await?;
    }

    poc_meeting_service::process_transcript(db, http, config, row_id, vtt).await?;
    Ok(())
}

/// Fallback correlation: the $filter lookup at schedule time missed, so use the
/// notification's meeting id to fetch the meeting, read its `joinWebUrl`, and
/// match it against a pending row — backfilling `graph_online_meeting_id`.
async fn backfill_by_join_url(
    db: &DatabaseConnection,
    graph: &GraphClient,
    tref: &TranscriptRef,
) -> AppResult<Option<poc_meetings::Model>> {
    let resp = graph
        .get(&format!(
            "/users/{}/onlineMeetings/{}",
            tref.organizer_id, tref.online_meeting_id
        ))
        .await?;
    if !resp.status().is_success() {
        return Err(graph_error(resp).await);
    }
    #[derive(Deserialize)]
    struct MeetingJoin {
        #[serde(rename = "joinWebUrl")]
        join_web_url: Option<String>,
    }
    let m: MeetingJoin = resp.json().await.map_err(|e| AppError::Upstream {
        code: None,
        message: format!("onlineMeeting get parse failed: {e}"),
        retryable: false,
    })?;
    let Some(join) = m.join_web_url else {
        return Ok(None);
    };
    let base = join.split('?').next().unwrap_or(&join);

    let candidates = poc_meetings::Entity::find()
        .filter(poc_meetings::Column::GraphOnlineMeetingId.is_null())
        .filter(poc_meetings::Column::JoinUrl.is_not_null())
        .all(db)
        .await?;

    for c in candidates {
        let matches = c
            .join_url
            .as_deref()
            .map(|u| u.split('?').next().unwrap_or(u) == base)
            .unwrap_or(false);
        if matches {
            let id = c.id;
            let mut am: poc_meetings::ActiveModel = c.into();
            am.graph_online_meeting_id = Set(Some(tref.online_meeting_id.clone()));
            am.external_ref = Set(Some(tref.online_meeting_id.clone()));
            am.updated_at = Set(Some(now()));
            am.update(db).await?;
            return Ok(poc_meetings::Entity::find_by_id(id).one(db).await?);
        }
    }
    Ok(None)
}
