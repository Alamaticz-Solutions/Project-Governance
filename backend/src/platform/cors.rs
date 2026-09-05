//! CORS policy: an explicit origin allow-list, fail-closed in managed
//! environments (an empty/unset `APP_CORS_ALLOWED_ORIGINS` yields an empty
//! allow-list, not a wildcard) since credentials are always enabled and
//! `tower_http::cors::Any` can never be combined with credentials.
//!
//! Product-owned (backend framework replacement phase 4 --
//! docs/architecture/self-owned-backend-plan.md). Previously
//! `appfw_runtime::cors`.

use axum::http::{header, HeaderName, HeaderValue, Method};
use std::{env, str::FromStr};
use tower_http::cors::CorsLayer;
use tracing::{error, warn};

const LOCAL_DEFAULT_ORIGIN: &str = "http://localhost:3000";

pub fn get() -> CorsLayer {
    CorsLayer::new()
        .allow_headers(vec![
            header::ACCEPT,
            header::ACCEPT_LANGUAGE,
            header::ACCEPT_ENCODING,
            header::AUTHORIZATION,
            header::CONTENT_LANGUAGE,
            header::ACCESS_CONTROL_ALLOW_METHODS,
            header::ACCESS_CONTROL_REQUEST_HEADERS,
            header::CONTENT_TYPE,
            header::REFERER,
            HeaderName::from_str("timezone").unwrap(),
        ])
        .allow_methods(vec![
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::HEAD,
            Method::OPTIONS,
            Method::PATCH,
        ])
        .allow_credentials(true)
        .allow_origin(resolve_allowed_origins())
    // Credentials are always enabled, so the origin list must remain an explicit
    // allow-list. Never combine `tower_http::cors::Any` (wildcard) with credentials.
}

/// Resolve the CORS allow-list from `APP_CORS_ALLOWED_ORIGINS` (comma separated).
///
/// Fail-closed: in managed (non-`local`) environments an empty/unset list yields
/// an empty allow-list so no cross-origin credentialed request is ever honored.
/// The localhost dev origin is only applied when `ENV_NAME=local`.
fn resolve_allowed_origins() -> Vec<HeaderValue> {
    let configured = parse_origins(env::var("APP_CORS_ALLOWED_ORIGINS").ok().as_deref());
    if !configured.is_empty() {
        return configured;
    }

    if is_local_env() {
        return parse_origins(Some(LOCAL_DEFAULT_ORIGIN));
    }

    error!(
        "APP_CORS_ALLOWED_ORIGINS is not set in a managed environment; CORS allow-list is empty (fail-closed)"
    );
    Vec::new()
}

fn is_local_env() -> bool {
    env::var("ENV_NAME").map(|v| v == "local").unwrap_or(false)
}

fn parse_origins(value: Option<&str>) -> Vec<HeaderValue> {
    value
        .into_iter()
        .flat_map(|raw| raw.split(','))
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
        .filter_map(|origin| match origin.parse::<HeaderValue>() {
            Ok(value) => Some(value),
            Err(error) => {
                warn!(origin = %origin, error = %error, "ignoring invalid CORS origin");
                None
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_comma_separated_origins_and_trims_whitespace() {
        let origins = parse_origins(Some("https://a.example.com, https://b.example.com"));
        assert_eq!(
            origins,
            vec![
                HeaderValue::from_static("https://a.example.com"),
                HeaderValue::from_static("https://b.example.com"),
            ]
        );
    }

    #[test]
    fn drops_empty_and_invalid_origin_entries() {
        // A HeaderValue may not contain control characters -- `\r` is the
        // deliberately-invalid entry here (a bare string with spaces is
        // actually a valid, if unusual, HeaderValue).
        let origins = parse_origins(Some(", https://ok.example.com, bad\rorigin,"));
        assert_eq!(
            origins,
            vec![HeaderValue::from_static("https://ok.example.com")]
        );
    }

    #[test]
    fn none_input_yields_no_origins() {
        assert!(parse_origins(None).is_empty());
    }
}
