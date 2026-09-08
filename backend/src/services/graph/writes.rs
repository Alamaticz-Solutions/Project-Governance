//! G1 governed-write stack. Every Microsoft Graph WRITE passes through
//! [`execute`] -- the ONLY function in this crate that can issue a non-GET
//! request to `graph.microsoft.com` (G1.1 `GovernedWriteEnforcement`;
//! mirrors how `client::GraphClient::read` is the sole outbound READ path).
//! `execute` runs, in order, every one of the 8 G1 components before it ever
//! reaches the network:
//!
//!   G1.1 GovernedWriteEnforcement    this module is the only mutation path
//!   G1.2 DelegatedActorContext       `WriteContext` carries the acting UserAuth
//!   G1.3 TokenStoreIsolation         `write_auth_config()` uses a distinct app registration
//!   G1.4 NamedMutationRegistry       `WriteOperation`, allow-listed, no caller endpoints
//!   G1.5 MutationRequestBinding      `WriteOperation::plan/body`, typed + escaped
//!   G1.6 IdempotencyAndReplayProtection  `graph_write_attempts` ledger, checked first
//!   G1.7 WritePolicyAndScopeEnforcement  `policy_check`, role + tenant gate
//!   G1.8 WriteAuditAndEvidence       `AuditEvent` + the ledger row, every outcome
//!
//! Design: spec 003. Three
//! operations are wired to a callable custom method today
//! (`ScheduleTeamsMeeting`, plus `CancelOnlineMeeting`/`CancelCalendarEvent`
//! -- `Meeting.cancel_via_graph` picks whichever matches what
//! `schedule_via_graph` actually created); the subscription/SharePoint
//! operations are registered (G1.4/G1.5 apply to them too) but have no
//! GraphQL entry point yet -- `POST /subscriptions` needs a public HTTPS
//! callback this environment does not have (spec 003 D2), and SharePoint
//! upload has no request plan at all (spec 004 D1 has not chosen it).

use std::sync::Arc;

use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::{
    product_api::{DataAccess, UserAuth},
    schemas::governance::{GraphWriteAttemptProjection, InputGraphWriteAttempt},
    services::{audit, support::entity},
};

use super::{
    auth::{GraphAuthConfig, GraphToken},
    identity::GRAPH_BASE,
    request::{path_segment, RequestPlan},
    response::{classify, redact, GraphError},
};

/// The 8 write-area contracts. Every one below is implemented by this module
/// (not `Unsupported`); kept as a named list because
/// `vendor_contract.rs`'s docs-check transcribes from it.
#[allow(dead_code)] // tested below (write_areas_list_stays_at_eight_items); no docs-check consumes it yet
pub const G1_WRITE_AREAS: &[&str] = &[
    "GovernedWriteEnforcement",
    "DelegatedActorContext",
    "TokenStoreIsolation",
    "NamedMutationRegistry",
    "MutationRequestBinding",
    "IdempotencyAndReplayProtection",
    "WritePolicyAndScopeEnforcement",
    "WriteAuditAndEvidence",
];

/// G1.2 DelegatedActorContext. The acting human, carried alongside the
/// app-only Graph credential actually used to make the call (client
/// credentials, not delegated/OBO -- see the plan doc's G1.2 decision).
/// Every write is attributed to this actor in the audit trail and the
/// idempotency ledger even though Graph itself only ever sees the app.
#[derive(Debug, Clone)]
pub struct WriteContext {
    pub actor: String,
    pub roles: Vec<String>,
    pub tenant_id: String,
}

impl WriteContext {
    pub fn from_user(user: &UserAuth) -> Self {
        Self {
            actor: user.user_name.clone(),
            roles: user.roles.iter().map(|r| r.to_ascii_lowercase()).collect(),
            tenant_id: user.tenant_id.clone(),
        }
    }
}

/// G1.4 NamedMutationRegistry. Allow-listed write candidates only -- no
/// caller-constructed operation, no `post_json(path)`. Field shapes are
/// typed, not raw JSON, so G1.5 binding is enforced by the type system: a
/// caller cannot add an unbound field to the request body.
#[derive(Debug, Clone)]
pub enum WriteOperation {
    /// `POST /users/{organizer}/onlineMeetings`. Creates a Teams meeting as
    /// its own Graph resource (an "online meeting"), distinct from a
    /// calendar event -- this call alone does NOT put anything on the
    /// organizer's calendar. `organizer` must be an AAD object id (a GUID);
    /// Graph rejects a UPN/email here with `400 InvalidArgument: "The
    /// userId in request URL is not a valid GUID."` (found live,
    /// 2026-09-07, against the lventur.com tenant). The response carries
    /// `joinWebUrl`, which `schedule_via_graph` persists as `join_url`.
    ///
    /// **Not the wired path.** `schedule_via_graph` uses
    /// `ScheduleCalendarEvent` instead (calendar entry + attendee invites +
    /// Graph-reachable transcripts). Kept as a registered operation for a
    /// caller that deliberately wants a bare, calendar-less meeting link.
    #[allow(dead_code)]
    ScheduleTeamsMeeting {
        organizer: String,
        subject: String,
        start_iso: String,
        end_iso: String,
        attendees: Vec<String>,
    },
    /// `POST /users/{organizer}/events` -- a calendar-backed Teams meeting.
    /// Unlike `ScheduleTeamsMeeting`, this puts an event on the organizer's
    /// Outlook/Teams calendar and Graph **emails invitations** to
    /// `attendees`. `isOnlineMeeting: true` + `onlineMeetingProvider:
    /// "teamsForBusiness"` makes Graph provision the Teams meeting; the
    /// response carries `id` (persisted as `graph_event_id`) and
    /// `onlineMeeting.joinUrl`. Cancelling this via `CancelCalendarEvent`
    /// sends cancellation notices to the attendees. This is the path
    /// `schedule_via_graph` uses. `start_iso`/`end_iso` are RFC3339; the
    /// body splits them into Graph's `{ dateTime, timeZone: "UTC" }` shape.
    ScheduleCalendarEvent {
        organizer: String,
        subject: String,
        start_iso: String,
        end_iso: String,
        attendees: Vec<String>,
    },
    /// `DELETE /users/{organizer}/onlineMeetings/{online_meeting_id}` --
    /// cancels the online-meeting resource `ScheduleTeamsMeeting` created.
    /// This, not `CancelCalendarEvent`, is what actually cleans up a
    /// meeting scheduled through this stack (see `ScheduleTeamsMeeting`'s
    /// doc comment: no separate calendar event exists to delete).
    CancelOnlineMeeting {
        organizer: String,
        online_meeting_id: String,
    },
    /// `DELETE /users/{organizer}/events/{event_id}` -- cancels a genuine
    /// calendar event. Only applicable when a meeting's `graph_event_id`
    /// is actually set (e.g. a future portal path that schedules via
    /// `POST /events` with `isOnlineMeeting: true` instead of
    /// `/onlineMeetings` directly); `ScheduleTeamsMeeting` above never sets
    /// it, so `cancel_via_graph` prefers `CancelOnlineMeeting`.
    CancelCalendarEvent { organizer: String, event_id: String },
    /// `POST /subscriptions` -- tenant-wide transcript change-notification.
    /// Registered (G1.4/G1.5 apply) but not reachable from any handler: it
    /// needs a public HTTPS `notification_url` this environment lacks.
    #[allow(dead_code)]
    CreateSubscription {
        resource: String,
        notification_url: String,
        client_state: String,
        expiration_iso: String,
    },
    /// `PATCH /subscriptions/{id}` -- renew. Not wired to a handler (same
    /// reason as `CreateSubscription`).
    #[allow(dead_code)]
    RenewSubscription {
        subscription_id: String,
        expiration_iso: String,
    },
    /// `DELETE /subscriptions/{id}`. Not wired to a handler.
    #[allow(dead_code)]
    DeleteSubscription { subscription_id: String },
    /// `PUT /sites/{id}/drives/{id}/root:/…:/content` -- SharePoint upload
    /// (spec 004 D1 owns whether this is ever built at all). Registered as a
    /// placeholder only; `plan()`/`body()` return `None`.
    #[allow(dead_code)]
    SharePointUpload {
        site_id: String,
        drive_id: String,
        path: String,
    },
}

impl WriteOperation {
    pub fn name(&self) -> &'static str {
        match self {
            Self::ScheduleTeamsMeeting { .. } => "schedule_teams_meeting",
            Self::ScheduleCalendarEvent { .. } => "schedule_calendar_event",
            Self::CancelOnlineMeeting { .. } => "cancel_online_meeting",
            Self::CancelCalendarEvent { .. } => "cancel_calendar_event",
            Self::CreateSubscription { .. } => "create_subscription",
            Self::RenewSubscription { .. } => "renew_subscription",
            Self::DeleteSubscription { .. } => "delete_subscription",
            Self::SharePointUpload { .. } => "sharepoint_upload",
        }
    }

    /// The G1.7 policy action this operation is gated behind.
    fn policy_action(&self) -> &'static str {
        match self {
            Self::ScheduleTeamsMeeting { .. } | Self::ScheduleCalendarEvent { .. } => {
                "schedule_teams_meeting"
            }
            // Same gate as CancelCalendarEvent -- both are "cancel the
            // meeting I scheduled", just against the right Graph resource.
            Self::CancelOnlineMeeting { .. } | Self::CancelCalendarEvent { .. } => {
                "cancel_calendar_event"
            }
            Self::CreateSubscription { .. }
            | Self::RenewSubscription { .. }
            | Self::DeleteSubscription { .. } => "manage_subscription",
            Self::SharePointUpload { .. } => "sharepoint_upload",
        }
    }

    /// G1.5 MutationRequestBinding: fixed method + path template per
    /// operation, path segments escaped via `request::path_segment` (never
    /// string-concatenated).
    fn plan(&self) -> Option<RequestPlan> {
        match self {
            Self::ScheduleTeamsMeeting { organizer, .. } => Some(RequestPlan::post(format!(
                "/users/{}/onlineMeetings",
                path_segment(organizer)
            ))),
            Self::ScheduleCalendarEvent { organizer, .. } => Some(RequestPlan::post(format!(
                "/users/{}/events",
                path_segment(organizer)
            ))),
            Self::CancelOnlineMeeting {
                organizer,
                online_meeting_id,
            } => Some(RequestPlan {
                method: reqwest::Method::DELETE,
                path: format!(
                    "/users/{}/onlineMeetings/{}",
                    path_segment(organizer),
                    path_segment(online_meeting_id)
                ),
                query: Vec::new(),
                headers: Vec::new(),
                accept: vec!["application/json"],
            }),
            Self::CancelCalendarEvent {
                organizer,
                event_id,
            } => Some(RequestPlan {
                method: reqwest::Method::DELETE,
                path: format!(
                    "/users/{}/events/{}",
                    path_segment(organizer),
                    path_segment(event_id)
                ),
                query: Vec::new(),
                headers: Vec::new(),
                accept: vec!["application/json"],
            }),
            Self::CreateSubscription { .. } => {
                Some(RequestPlan::post("/subscriptions".to_string()))
            }
            Self::RenewSubscription {
                subscription_id, ..
            } => Some(RequestPlan {
                method: reqwest::Method::PATCH,
                path: format!("/subscriptions/{}", path_segment(subscription_id)),
                query: Vec::new(),
                headers: Vec::new(),
                accept: vec!["application/json"],
            }),
            Self::DeleteSubscription { subscription_id } => Some(RequestPlan {
                method: reqwest::Method::DELETE,
                path: format!("/subscriptions/{}", path_segment(subscription_id)),
                query: Vec::new(),
                headers: Vec::new(),
                accept: vec!["application/json"],
            }),
            // Not shipped -- spec 004 D1 has not chosen SharePoint. No plan
            // means `execute` refuses it before any request is built.
            Self::SharePointUpload { .. } => None,
        }
    }

    /// G1.5: typed body construction, never a caller-supplied JSON merge.
    fn body(&self) -> Option<serde_json::Value> {
        match self {
            Self::ScheduleTeamsMeeting {
                subject,
                start_iso,
                end_iso,
                attendees,
                ..
            } => {
                // `participants` is omitted entirely when there are no
                // attendees -- an empty `participants.attendees: []` was
                // rejected live by Graph with `400 InvalidArgument`
                // (verified 2026-09-07 against the lventur.com tenant).
                let mut body = serde_json::json!({
                    "subject": subject,
                    "startDateTime": start_iso,
                    "endDateTime": end_iso,
                });
                if !attendees.is_empty() {
                    body["participants"] = serde_json::json!({
                        "attendees": attendees.iter().map(|a| serde_json::json!({
                            "upn": a,
                            "role": "attendee",
                        })).collect::<Vec<_>>(),
                    });
                }
                Some(body)
            }
            Self::ScheduleCalendarEvent {
                subject,
                start_iso,
                end_iso,
                attendees,
                ..
            } => {
                // Graph `/events` wants `{ dateTime, timeZone }`, not an
                // RFC3339 string. Normalize to naive UTC + explicit "UTC".
                let dt = |iso: &str| {
                    chrono::DateTime::parse_from_rfc3339(iso)
                        .map(|d| {
                            d.with_timezone(&chrono::Utc)
                                .format("%Y-%m-%dT%H:%M:%S")
                                .to_string()
                        })
                        .unwrap_or_else(|_| iso.to_string())
                };
                Some(serde_json::json!({
                    "subject": subject,
                    "body": {
                        "contentType": "HTML",
                        "content": "Scheduled via the Governance Portal."
                    },
                    "start": { "dateTime": dt(start_iso), "timeZone": "UTC" },
                    "end":   { "dateTime": dt(end_iso),   "timeZone": "UTC" },
                    "attendees": attendees.iter().map(|a| serde_json::json!({
                        "emailAddress": { "address": a },
                        "type": "required",
                    })).collect::<Vec<_>>(),
                    "isOnlineMeeting": true,
                    "onlineMeetingProvider": "teamsForBusiness",
                    "allowNewTimeProposals": false,
                }))
            }
            Self::CreateSubscription {
                resource,
                notification_url,
                client_state,
                expiration_iso,
            } => Some(serde_json::json!({
                "changeType": "created,updated",
                "resource": resource,
                "notificationUrl": notification_url,
                "clientState": client_state,
                "expirationDateTime": expiration_iso,
            })),
            Self::RenewSubscription { expiration_iso, .. } => Some(serde_json::json!({
                "expirationDateTime": expiration_iso,
            })),
            Self::CancelOnlineMeeting { .. }
            | Self::CancelCalendarEvent { .. }
            | Self::DeleteSubscription { .. } => None,
            Self::SharePointUpload { .. } => None,
        }
    }

    /// G1.6 idempotency-key input: every bound parameter, stable field
    /// order. Hashed together with `operation` name to form the ledger key.
    fn fingerprint_fields(&self) -> Vec<(&'static str, String)> {
        match self {
            Self::ScheduleTeamsMeeting {
                organizer,
                subject,
                start_iso,
                end_iso,
                attendees,
            }
            | Self::ScheduleCalendarEvent {
                organizer,
                subject,
                start_iso,
                end_iso,
                attendees,
            } => vec![
                ("organizer", organizer.clone()),
                ("subject", subject.clone()),
                ("start_iso", start_iso.clone()),
                ("end_iso", end_iso.clone()),
                ("attendees", attendees.join(",")),
            ],
            Self::CancelOnlineMeeting {
                organizer,
                online_meeting_id,
            } => vec![
                ("organizer", organizer.clone()),
                ("online_meeting_id", online_meeting_id.clone()),
            ],
            Self::CancelCalendarEvent {
                organizer,
                event_id,
            } => vec![
                ("organizer", organizer.clone()),
                ("event_id", event_id.clone()),
            ],
            Self::CreateSubscription {
                resource,
                notification_url,
                ..
            } => vec![
                ("resource", resource.clone()),
                ("notification_url", notification_url.clone()),
            ],
            Self::RenewSubscription {
                subscription_id, ..
            } => vec![("subscription_id", subscription_id.clone())],
            Self::DeleteSubscription { subscription_id } => {
                vec![("subscription_id", subscription_id.clone())]
            }
            Self::SharePointUpload {
                site_id,
                drive_id,
                path,
            } => vec![
                ("site_id", site_id.clone()),
                ("drive_id", drive_id.clone()),
                ("path", path.clone()),
            ],
        }
    }
}

fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// G1.6: `sha256(operation || sorted-field=value pairs)`. Deterministic for
/// the same bound parameters, so a genuine retry (same organizer/subject/
/// time/attendees, say, from a double-clicked "Schedule" button) collapses
/// onto one ledger row instead of creating two Teams meetings.
fn fingerprint(op: &WriteOperation) -> String {
    let mut fields = op.fingerprint_fields();
    fields.sort_by(|a, b| a.0.cmp(b.0));
    let joined = fields
        .into_iter()
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join("&");
    sha256_hex(&format!("{}::{joined}", op.name()))
}

/// The caller-supplied idempotency key (from `payload.idempotency_key`, if
/// the caller sent one) folded together with the operation name, so a key
/// reused for a *different* operation cannot collide. When absent, falls
/// back to the deterministic request fingerprint itself.
fn idempotency_key(op: &WriteOperation, caller_key: Option<&str>) -> String {
    match caller_key {
        Some(k) if !k.trim().is_empty() => sha256_hex(&format!("{}::{}", op.name(), k)),
        _ => fingerprint(op),
    }
}

#[derive(Debug, Serialize)]
pub struct WriteOutcome {
    pub operation: &'static str,
    pub graph_resource_id: Option<String>,
    pub idempotent_replay: bool,
    /// The redacted Graph response body, when this call actually reached
    /// the network (`None` on an idempotent replay -- the caller already
    /// applied the first attempt's response, there is nothing new to read).
    /// Lets a caller like `schedule_via_graph` pull fields `resource_id`
    /// doesn't carry (e.g. `joinWebUrl`) without a second round trip.
    pub graph_response: Option<serde_json::Value>,
}

#[derive(Debug, thiserror::Error)]
pub enum WriteError {
    #[error("write denied: {0}")]
    PolicyDenied(String),
    #[error("{0} is not an executable write yet: {1}")]
    NotImplemented(&'static str, &'static str),
    #[error("idempotency conflict: same key, different request")]
    IdempotencyConflict,
    #[error("Microsoft Graph is not configured for writes (see spec 003 auth contract)")]
    NotConfigured,
    #[error("graph write failed: {0}")]
    Graph(#[from] GraphError),
    #[error("internal error: {0}")]
    Internal(#[from] anyhow::Error),
}

/// G1.7 WritePolicyAndScopeEnforcement. Provisional role matrix -- ties to
/// the P5 gate matrix (not yet in the repo; see docs/architecture/open-decisions.md). Mirrors the Rego
/// shape used everywhere else in this product, kept in Rust here because
/// this gate runs before any entity/DataAccess call exists to evaluate a
/// Rego policy against.
fn policy_check(ctx: &WriteContext, op: &WriteOperation) -> Result<(), WriteError> {
    let allowed_roles: &[&str] = match op.policy_action() {
        "schedule_teams_meeting" | "cancel_calendar_event" => {
            &["admin", "project_manager", "epmo"]
        }
        // Nothing has a handler for these yet; deny outright regardless of
        // role until a subscription callback / SharePoint decision exists.
        "manage_subscription" | "sharepoint_upload" => &[],
        _ => &[],
    };
    if allowed_roles.is_empty() {
        return Err(WriteError::PolicyDenied(format!(
            "{} has no authorized role (not wired to a handler yet)",
            op.policy_action()
        )));
    }
    if !ctx.roles.iter().any(|r| allowed_roles.contains(&r.as_str())) {
        return Err(WriteError::PolicyDenied(format!(
            "actor `{}` (roles: {:?}) may not perform `{}`",
            ctx.actor,
            ctx.roles,
            op.policy_action()
        )));
    }
    Ok(())
}

/// G1.3 TokenStoreIsolation: writes use a distinct app registration from
/// reads where one is configured (`GRAPH_WRITE_CLIENT_ID`/`_SECRET`), so a
/// compromised read path cannot escalate to a write. Falls back to the read
/// credential set with a loud warning when the write-specific pair is
/// absent, so a partial local setup still degrades to "works, less
/// isolated" rather than silently doing nothing.
fn write_auth_config() -> Option<GraphAuthConfig> {
    if let Some(cfg) = GraphAuthConfig::from_write_env() {
        return Some(cfg);
    }
    tracing::warn!(
        "GRAPH_WRITE_CLIENT_ID/GRAPH_WRITE_CLIENT_SECRET not set; falling back to the read \
         Graph app registration for writes (G1.3 token isolation degraded -- see \
         spec 003 \u{a7}G1.3)"
    );
    GraphAuthConfig::from_env()
}

/// G1.1 + G1.5: the ONLY place a non-GET request reaches
/// `graph.microsoft.com`. Not exported from `mod.rs`; reachable only from
/// [`execute`] in this file.
async fn send_mutation(
    http: &reqwest::Client,
    bearer: &str,
    plan: &RequestPlan,
    body: Option<&serde_json::Value>,
) -> Result<serde_json::Value, WriteError> {
    let url = format!("{GRAPH_BASE}{}", plan.path);
    tracing::info!(path = %plan.path, method = %plan.method, "outbound Microsoft Graph write");
    let mut req = http
        .request(plan.method.clone(), &url)
        .bearer_auth(bearer)
        .header(reqwest::header::ACCEPT, plan.accept.join(", "));
    for (k, v) in &plan.query {
        req = req.query(&[(k, v)]);
    }
    for (k, v) in &plan.headers {
        req = req.header(*k, v);
    }
    if let Some(body) = body {
        req = req.json(body);
    }

    let resp = req.send().await.map_err(|_| {
        WriteError::Graph(GraphError::Unauthorized {
            code: "transport".to_string(),
        })
    })?;
    let status = resp.status();
    let bytes = resp.bytes().await.unwrap_or_default();
    let value: serde_json::Value =
        serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null);

    if !status.is_success() {
        let message = value
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
            .unwrap_or("");
        tracing::warn!(
            status = status.as_u16(),
            error_message = message,
            "Microsoft Graph write returned an error status"
        );
        return Err(WriteError::Graph(classify(status, &value)));
    }
    tracing::info!(status = status.as_u16(), "Microsoft Graph write ok");
    Ok(redact(value))
}

/// Pull a resulting resource id off a successful write response, per
/// operation (Graph's response shape differs by endpoint; a `DELETE`
/// carries no body at all).
fn resource_id_from_response(
    op: &WriteOperation,
    response: &serde_json::Value,
) -> Option<String> {
    match op {
        WriteOperation::ScheduleTeamsMeeting { .. }
        | WriteOperation::ScheduleCalendarEvent { .. }
        | WriteOperation::CreateSubscription { .. }
        | WriteOperation::RenewSubscription { .. } => response
            .get("id")
            .and_then(|v| v.as_str())
            .map(str::to_string),
        WriteOperation::CancelOnlineMeeting {
            online_meeting_id, ..
        } => Some(online_meeting_id.clone()),
        WriteOperation::CancelCalendarEvent { event_id, .. } => Some(event_id.clone()),
        WriteOperation::DeleteSubscription { subscription_id } => Some(subscription_id.clone()),
        WriteOperation::SharePointUpload { .. } => None,
    }
}

/// G1.1 GovernedWriteEnforcement -- the single entry point every governed
/// Graph write goes through. Runs G1.7 (policy) -> G1.6 (idempotency lookup)
/// -> G1.3 (write-isolated token) -> G1.1/G1.5 (the actual call, via
/// [`send_mutation`]) -> G1.6 (record outcome) -> G1.8 (audit), in that
/// order. Denies closed on any missing piece: a policy miss, an
/// unimplemented plan, or a missing write credential all return `Err`
/// before any network call.
#[tracing::instrument(
    name = "graph.write",
    skip(data_access, ctx, op, meeting_id),
    fields(operation = op.name(), actor = %ctx.actor)
)]
pub async fn execute(
    data_access: &Arc<DataAccess>,
    ctx: &WriteContext,
    op: WriteOperation,
    meeting_id: Option<&str>,
    caller_idempotency_key: Option<&str>,
) -> Result<WriteOutcome, WriteError> {
    // G1.7
    if let Err(e) = policy_check(ctx, &op) {
        audit_attempt(data_access, ctx, &op, "DENIED", None, Some(e.to_string())).await;
        return Err(e);
    }

    // G1.5 -- refuse before touching the ledger or the network if this
    // operation has no request plan (SharePoint upload: not shipped).
    let Some(plan) = op.plan() else {
        let e = WriteError::NotImplemented(op.name(), "spec 004 has not chosen SharePoint");
        audit_attempt(data_access, ctx, &op, "DENIED", None, Some(e.to_string())).await;
        return Err(e);
    };

    // G1.6 -- idempotency lookup before any Graph call. A prior `pending`/
    // `failed` attempt with the exact same key+fingerprint reuses its row
    // (via `existing_id`) rather than inserting a new one -- otherwise every
    // retry of a failed write would pile up a fresh ledger row for the same
    // logical attempt, which is itself a violation of "one row per logical
    // write" that a naive read of `find_attempt` could miss.
    let key = idempotency_key(&op, caller_idempotency_key);
    let print = fingerprint(&op);
    let mut existing_id: Option<String> = None;
    match find_attempt(data_access, ctx, &key).await {
        Ok(Some(existing)) => {
            if existing.request_fingerprint.as_deref() != Some(print.as_str()) {
                let e = WriteError::IdempotencyConflict;
                audit_attempt(data_access, ctx, &op, "DENIED", None, Some(e.to_string())).await;
                return Err(e);
            }
            if existing.status.as_deref() == Some("succeeded") {
                return Ok(WriteOutcome {
                    operation: op.name(),
                    graph_resource_id: existing.graph_resource_id.clone(),
                    idempotent_replay: true,
                    graph_response: None,
                });
            }
            // A prior `pending`/`failed` attempt with this exact key+fingerprint:
            // fall through and retry the Graph call itself, reusing this row.
            existing_id = existing.id;
        }
        Ok(None) => {}
        Err(e) => {
            audit_attempt(data_access, ctx, &op, "DENIED", None, Some(e.to_string())).await;
            return Err(WriteError::Internal(e));
        }
    }
    let attempt_id = match existing_id {
        Some(id) => id,
        None => {
            match record_pending_attempt(data_access, ctx, &op, &key, &print, meeting_id).await {
                Ok(id) => id,
                Err(e) => {
                    audit_attempt(data_access, ctx, &op, "DENIED", None, Some(e.to_string())).await;
                    return Err(WriteError::Internal(e));
                }
            }
        }
    };

    // G1.3
    let Some(cfg) = write_auth_config() else {
        let e = WriteError::NotConfigured;
        let _ = complete_attempt(
            data_access,
            ctx,
            &attempt_id,
            "failed",
            None,
            Some("not_configured"),
        )
        .await;
        audit_attempt(data_access, ctx, &op, "FAILED", None, Some(e.to_string())).await;
        return Err(e);
    };
    let http = reqwest::Client::new();
    let token = GraphToken::new(cfg, http.clone());
    let bearer = match token.bearer().await {
        Ok(t) => t,
        Err(e) => {
            let _ = complete_attempt(
                data_access,
                ctx,
                &attempt_id,
                "failed",
                None,
                Some("token_acquisition_failed"),
            )
            .await;
            audit_attempt(data_access, ctx, &op, "FAILED", None, Some(e.to_string())).await;
            return Err(WriteError::Internal(e));
        }
    };

    // G1.1 + G1.5: the actual call.
    let body = op.body();
    match send_mutation(&http, &bearer, &plan, body.as_ref()).await {
        Ok(response) => {
            let resource_id = resource_id_from_response(&op, &response);
            let _ = complete_attempt(
                data_access,
                ctx,
                &attempt_id,
                "succeeded",
                resource_id.as_deref(),
                None,
            )
            .await;
            audit_attempt(
                data_access,
                ctx,
                &op,
                "SUCCEEDED",
                resource_id.as_deref(),
                None,
            )
            .await;
            Ok(WriteOutcome {
                operation: op.name(),
                graph_resource_id: resource_id,
                idempotent_replay: false,
                graph_response: Some(response),
            })
        }
        Err(e) => {
            let code = match &e {
                WriteError::Graph(g) => Some(g.to_string()),
                _ => None,
            };
            let _ = complete_attempt(
                data_access,
                ctx,
                &attempt_id,
                "failed",
                None,
                code.as_deref(),
            )
            .await;
            audit_attempt(data_access, ctx, &op, "FAILED", None, Some(e.to_string())).await;
            Err(e)
        }
    }
}

// --- G1.6 ledger + G1.8 audit plumbing -------------------------------------

async fn find_attempt(
    data_access: &Arc<DataAccess>,
    ctx: &WriteContext,
    key: &str,
) -> anyhow::Result<Option<GraphWriteAttemptProjection>> {
    let ty = entity(data_access, "GraphWriteAttempt")?;
    let sel = crate::services::support::selection(
        "graph_write_attempt",
        &[
            crate::services::support::field("id"),
            crate::services::support::field("status"),
            crate::services::support::field("graph_resource_id"),
            crate::services::support::field("request_fingerprint"),
        ],
    );
    let res = data_access
        .query_items::<GraphWriteAttemptProjection>(
            ty,
            sel,
            Some(serde_json::json!({ "idempotency_key": { "_eq": key } })),
            None,
            0,
            1,
            None,
            Some(system_user(ctx)),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    Ok(res.items.into_iter().next())
}

async fn record_pending_attempt(
    data_access: &Arc<DataAccess>,
    ctx: &WriteContext,
    op: &WriteOperation,
    key: &str,
    print: &str,
    meeting_id: Option<&str>,
) -> anyhow::Result<String> {
    let ty = entity(data_access, "GraphWriteAttempt")?;
    let sel = crate::services::support::selection(
        "graph_write_attempt",
        &[crate::services::support::field("id")],
    );
    let input = InputGraphWriteAttempt {
        id: None,
        idempotency_key: key.to_string(),
        operation: op.name().to_string(),
        actor: ctx.actor.clone(),
        tenant_id: Some(ctx.tenant_id.clone()),
        request_fingerprint: print.to_string(),
        status: "pending".to_string(),
        graph_resource_id: None,
        error_code: None,
        meeting_id: meeting_id.map(str::to_string),
        created_at: chrono::Utc::now(),
        completed_at: None,
    };
    let saved = data_access
        .create_item::<InputGraphWriteAttempt, GraphWriteAttemptProjection>(
            ty,
            sel,
            input,
            Some(system_user(ctx)),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    saved
        .id
        .ok_or_else(|| anyhow::anyhow!("no id returned for GraphWriteAttempt"))
}

async fn complete_attempt(
    data_access: &Arc<DataAccess>,
    ctx: &WriteContext,
    attempt_id: &str,
    status: &str,
    graph_resource_id: Option<&str>,
    error_code: Option<&str>,
) -> anyhow::Result<()> {
    let ty = entity(data_access, "GraphWriteAttempt")?;
    let sel = crate::services::support::selection(
        "graph_write_attempt",
        &[crate::services::support::field("id")],
    );
    let existing = data_access
        .find_item::<GraphWriteAttemptProjection>(
            ty.clone(),
            crate::services::support::selection(
                "graph_write_attempt",
                &[
                    crate::services::support::field("idempotency_key"),
                    crate::services::support::field("operation"),
                    crate::services::support::field("actor"),
                    crate::services::support::field("tenant_id"),
                    crate::services::support::field("request_fingerprint"),
                    crate::services::support::field("meeting_id"),
                    crate::services::support::field("created_at"),
                ],
            ),
            attempt_id.to_string(),
            Some(system_user(ctx)),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?
        .ok_or_else(|| anyhow::anyhow!("GraphWriteAttempt {attempt_id} vanished"))?;

    let input = InputGraphWriteAttempt {
        id: Some(attempt_id.to_string()),
        idempotency_key: existing.idempotency_key.unwrap_or_default(),
        operation: existing.operation.unwrap_or_default(),
        actor: existing.actor.unwrap_or_default(),
        tenant_id: existing.tenant_id,
        request_fingerprint: existing.request_fingerprint.unwrap_or_default(),
        status: status.to_string(),
        graph_resource_id: graph_resource_id.map(str::to_string),
        error_code: error_code.map(str::to_string),
        meeting_id: existing.meeting_id,
        created_at: existing.created_at.unwrap_or_else(chrono::Utc::now),
        completed_at: Some(chrono::Utc::now()),
    };
    data_access
        .update_item::<InputGraphWriteAttempt, GraphWriteAttemptProjection>(
            ty,
            sel,
            input,
            Some(system_user(ctx)),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    Ok(())
}

/// G1.8: append an `AuditEvent` for every attempt regardless of outcome
/// (allow, deny, success, failure) -- the retained evidence that a governed
/// write actually happened. Carries the actor and a reason/outcome, never
/// the bound Graph parameters themselves (those live only as the hashed
/// `request_fingerprint` in the ledger row, and the Graph response is
/// already `redact`ed before this point).
async fn audit_attempt(
    data_access: &Arc<DataAccess>,
    ctx: &WriteContext,
    op: &WriteOperation,
    outcome: &str,
    graph_resource_id: Option<&str>,
    reason: Option<String>,
) {
    let action = format!("GRAPH_WRITE_{}_{outcome}", op.name().to_ascii_uppercase());
    let details = serde_json::json!({
        "actor": ctx.actor,
        "roles": ctx.roles,
        "graph_resource_id": graph_resource_id,
        "reason": reason,
    });
    let user = Some(system_user(ctx));
    if let Err(e) = audit::record(
        data_access,
        &user,
        None,
        "GraphWriteAttempt",
        op.name(),
        &action,
        Some(details),
    )
    .await
    {
        tracing::error!(error = %e, "failed to write G1.8 audit event for a Graph write attempt");
    }
}

/// `DataAccess` calls need a `UserAuth` for policy evaluation on the local
/// governance tables (GraphWriteAttempt / AuditEvent), distinct from Graph's
/// own auth. Reuses the acting user's identity so the local Rego policies
/// see the real actor and roles.
fn system_user(ctx: &WriteContext) -> UserAuth {
    UserAuth::human(
        ctx.tenant_id.clone(),
        ctx.actor.clone(),
        "UTC".to_string(),
        ctx.roles.clone(),
        Vec::new(),
        String::new(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn op() -> WriteOperation {
        WriteOperation::ScheduleTeamsMeeting {
            organizer: "Manoj@lventur.com".into(),
            subject: "Q3 Review".into(),
            start_iso: "2026-09-10T15:00:00Z".into(),
            end_iso: "2026-09-10T15:30:00Z".into(),
            attendees: vec!["a@x.com".into(), "b@x.com".into()],
        }
    }

    #[test]
    fn fingerprint_is_deterministic() {
        assert_eq!(fingerprint(&op()), fingerprint(&op()));
    }

    #[test]
    fn fingerprint_differs_when_a_bound_value_changes() {
        let mut changed = op();
        if let WriteOperation::ScheduleTeamsMeeting { subject, .. } = &mut changed {
            *subject = "Different meeting".into();
        }
        assert_ne!(fingerprint(&op()), fingerprint(&changed));
    }

    #[test]
    fn idempotency_key_without_a_caller_key_falls_back_to_the_fingerprint() {
        assert_eq!(idempotency_key(&op(), None), fingerprint(&op()));
        assert_eq!(idempotency_key(&op(), Some("  ")), fingerprint(&op()));
    }

    #[test]
    fn idempotency_key_with_a_caller_key_does_not_equal_the_bare_fingerprint() {
        let with_key = idempotency_key(&op(), Some("my-request-id"));
        assert_ne!(with_key, fingerprint(&op()));
        assert_eq!(with_key, idempotency_key(&op(), Some("my-request-id")));
    }

    #[test]
    fn policy_denies_a_role_outside_the_write_matrix() {
        let ctx = WriteContext {
            actor: "viewer@x.com".into(),
            roles: vec!["viewer".into()],
            tenant_id: "t1".into(),
        };
        assert!(policy_check(&ctx, &op()).is_err());
    }

    #[test]
    fn policy_allows_admin_project_manager_and_epmo() {
        for role in ["admin", "project_manager", "epmo"] {
            let ctx = WriteContext {
                actor: "x".into(),
                roles: vec![role.into()],
                tenant_id: "t1".into(),
            };
            assert!(
                policy_check(&ctx, &op()).is_ok(),
                "role {role} should be allowed"
            );
        }
    }

    #[test]
    fn subscription_operations_are_denied_regardless_of_role() {
        let ctx = WriteContext {
            actor: "admin@x.com".into(),
            roles: vec!["admin".into()],
            tenant_id: "t1".into(),
        };
        let sub = WriteOperation::DeleteSubscription {
            subscription_id: "s1".into(),
        };
        assert!(policy_check(&ctx, &sub).is_err());
    }

    #[test]
    fn schedule_teams_meeting_plan_targets_the_organizer_online_meetings_endpoint() {
        let plan = op().plan().expect("plan");
        assert_eq!(plan.method, reqwest::Method::POST);
        assert_eq!(plan.path, "/users/Manoj@lventur.com/onlineMeetings");
    }

    #[test]
    fn cancel_calendar_event_plan_is_a_delete_on_the_event() {
        let cancel = WriteOperation::CancelCalendarEvent {
            organizer: "Manoj@lventur.com".into(),
            event_id: "AAMk123".into(),
        };
        let plan = cancel.plan().expect("plan");
        assert_eq!(plan.method, reqwest::Method::DELETE);
        assert_eq!(plan.path, "/users/Manoj@lventur.com/events/AAMk123");
    }

    #[test]
    fn sharepoint_upload_has_no_plan_and_is_refused_before_any_network_call() {
        let upload = WriteOperation::SharePointUpload {
            site_id: "s".into(),
            drive_id: "d".into(),
            path: "p".into(),
        };
        assert!(upload.plan().is_none());
    }

    #[test]
    fn write_areas_list_stays_at_eight_items() {
        assert_eq!(G1_WRITE_AREAS.len(), 8);
    }
}
