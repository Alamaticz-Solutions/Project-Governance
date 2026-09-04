//! Rate-limit / error classification, redacted payloads, result caps.

use std::time::Duration;

/// Result payloads are capped so a hostile / huge response cannot pin memory.
pub const MAX_BODY_BYTES: usize = 4 * 1024 * 1024;

#[derive(Debug)]
pub enum GraphError {
    /// 401/403 — token / permission problem. Not retryable.
    Unauthorized { code: String },
    /// 404 — the named resource does not exist for this tenant/organizer.
    NotFound,
    /// 429 / 503 — throttled. `retry_after` is honored by the caller.
    RateLimited { retry_after: Option<Duration> },
    /// 5xx other than 503.
    Upstream { status: u16, code: String },
    /// 4xx other than 401/403/404/429.
    BadRequest { status: u16, code: String },
    /// transport / decode failure (message is pre-redacted).
    Transport { message: String },
}

impl std::fmt::Display for GraphError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Unauthorized { code } => write!(f, "graph unauthorized ({code})"),
            Self::NotFound => write!(f, "graph resource not found"),
            Self::RateLimited { retry_after } => write!(
                f,
                "graph rate limited (retry after {}s)",
                retry_after.map(|d| d.as_secs()).unwrap_or(0)
            ),
            Self::Upstream { status, code } => write!(f, "graph upstream {status} ({code})"),
            Self::BadRequest { status, code } => write!(f, "graph bad request {status} ({code})"),
            Self::Transport { message } => write!(f, "graph transport error: {message}"),
        }
    }
}
impl std::error::Error for GraphError {}

fn error_code(body: &serde_json::Value) -> String {
    body.get("error")
        .and_then(|e| {
            e.get("code").and_then(|c| c.as_str()).or_else(|| {
                e.get("innerError")
                    .and_then(|i| i.get("code"))
                    .and_then(|c| c.as_str())
            })
        })
        .unwrap_or("unknown")
        .to_string()
}

pub fn classify(status: reqwest::StatusCode, body: &serde_json::Value) -> GraphError {
    let s = status.as_u16();
    match s {
        401 | 403 => GraphError::Unauthorized {
            code: error_code(body),
        },
        404 => GraphError::NotFound,
        429 | 503 => GraphError::RateLimited { retry_after: None },
        400 | 402 | 405..=428 | 430..=499 => GraphError::BadRequest {
            status: s,
            code: error_code(body),
        },
        500..=599 => GraphError::Upstream {
            status: s,
            code: error_code(body),
        },
        _ => GraphError::BadRequest {
            status: s,
            code: error_code(body),
        },
    }
}

pub fn retry_after_from(headers: &reqwest::header::HeaderMap) -> Option<Duration> {
    // Framework-owned parser: handles both delta-seconds and HTTP-date forms.
    headers
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|v| v.to_str().ok())
        .and_then(appfw_saas_core::rate_limit::parse_retry_after_seconds)
        .map(Duration::from_secs)
}

/// Redact a Graph payload before it is logged or returned to a non-Graph
/// caller: first the framework-owned key-level redaction (tokens, secrets,
/// authorization-like keys), then strip the Graph-notification-specific fields
/// (`clientState`, `resourceData`, `@odata.context`) that must never propagate.
pub fn redact(value: serde_json::Value) -> serde_json::Value {
    let mut value = appfw_saas_core::redaction::redact_json_value(value);
    fn scrub(v: &mut serde_json::Value) {
        match v {
            serde_json::Value::Object(map) => {
                for k in ["clientState", "@odata.context", "resourceData"] {
                    map.remove(k);
                }
                for child in map.values_mut() {
                    scrub(child);
                }
            }
            serde_json::Value::Array(items) => items.iter_mut().for_each(scrub),
            _ => {}
        }
    }
    scrub(&mut value);
    value
}
