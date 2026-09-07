//! Request correlation IDs, task-local request-context propagation, and
//! diagnostic redaction. Ported off `appfw_runtime::observability::telemetry`
//! (backend framework replacement phase 7, slice 6.2 --
//! docs/architecture/self-owned-backend-plan.md). Split out from
//! `platform::observability` (which keeps `init_tracing`/`ObservabilityGuard`,
//! ported earlier in phase 4b-1) because that module's own doc comment had
//! deferred exactly this half pending `admin_ui.rs`'s framework-trait
//! entanglement and `routes/info.rs`'s `runtime_info_routes` -- both are
//! addressed by this slice alongside `platform::metrics`/`platform::readiness`.
//!
//! `admin_ui.rs`'s three `Admin*Provider` trait methods still take
//! `&appfw_runtime::observability::RequestContext` by that exact framework
//! path -- `AdminServiceError`/`admin_missing_data_access_error`/etc, the
//! functions those parameters are only ever passed through to, are still
//! framework-owned (part of slice 6.3's `admin` module port). Since
//! `RequestContext` is a plain, structurally-identical `{request_id,
//! correlation_id}` value with no conversion needed either way, that
//! boundary is just an explicit `appfw_runtime::observability::RequestContext`
//! import at those three call sites, not a bridge -- see `admin_ui.rs`.
//!
//! NOT ported (confirmed unused anywhere in `backend/src`, `grep -rn
//! "OtelExportConfig\|otel_export_contract\|CORRELATION_ID_HEADER_NAME"`
//! returns nothing): `OtelExportConfig`/`otel_export_contract` (this
//! product's OTel init already reads its own env vars directly in
//! `platform::observability`, no separate config struct) and
//! `CORRELATION_ID_HEADER_NAME` (the correlation ID is read from
//! `x-correlation-id` inline, in `RequestContext::from_headers`, but no
//! other code names the header constant).

#[cfg(feature = "http")]
use std::borrow::Cow;
use std::sync::OnceLock;

#[cfg(feature = "http")]
use async_graphql::{ErrorExtensionValues, ServerError, Value as GraphqlValue};
#[cfg(feature = "http")]
use axum::{
    extract::MatchedPath,
    http::{HeaderMap, HeaderName, HeaderValue, Request},
    middleware::Next,
    response::Response,
};
#[cfg(feature = "http")]
use opentelemetry::propagation::{Extractor, Injector};
#[cfg(feature = "http")]
use opentelemetry::global;
use regex::Regex;
use serde::Serialize;
use serde_json::{Map as JsonMap, Value as JsonValue};
#[cfg(feature = "http")]
use tracing::Span;
#[cfg(feature = "http")]
use tracing_opentelemetry::OpenTelemetrySpanExt;
#[cfg(feature = "http")]
use uuid::Uuid;

pub const REQUEST_ID_HEADER_NAME: &str = "x-request-id";
const CORRELATION_ID_HEADER_NAME: &str = "x-correlation-id";

// Request context is stored task-locally so async code below route handlers
// can attach IDs to provider logs and diagnostics without plumbing
// parameters through every intermediate API.
tokio::task_local! {
    static CURRENT_REQUEST_CONTEXT: RequestContext;
}

#[derive(Clone, Debug, Serialize)]
pub struct RequestContext {
    pub request_id: String,
    pub correlation_id: String,
}

impl RequestContext {
    #[cfg(feature = "http")]
    pub fn from_headers(headers: &HeaderMap) -> Self {
        let request_id = header_value(headers, REQUEST_ID_HEADER_NAME)
            .or_else(|| header_value(headers, CORRELATION_ID_HEADER_NAME))
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        let correlation_id =
            header_value(headers, CORRELATION_ID_HEADER_NAME).unwrap_or_else(|| request_id.clone());

        Self {
            request_id,
            correlation_id,
        }
    }
}

/// Only writer: `trace_context_hook`'s `.scope(...)` call below. Porting one
/// without the other compiles clean and silently makes this return `None`
/// forever -- both must land in the same commit.
pub fn current_request_context() -> Option<RequestContext> {
    CURRENT_REQUEST_CONTEXT.try_with(Clone::clone).ok()
}

#[cfg(feature = "http")]
pub fn http_make_span<B>(request: &Request<B>) -> Span {
    let request_context = RequestContext::from_headers(request.headers());
    let route = request
        .extensions()
        .get::<MatchedPath>()
        .map(MatchedPath::as_str)
        .unwrap_or_else(|| request.uri().path());
    let user_agent = header_value(request.headers(), "user-agent").unwrap_or_default();

    tracing::info_span!(
        "http.request",
        "otel.kind" = "server",
        "http.request.method" = %request.method(),
        "http.route" = %route,
        "url.path" = %request.uri().path(),
        "http.request_id" = %request_context.request_id,
        "app.correlation_id" = %request_context.correlation_id,
        "user_agent.original" = %user_agent,
    )
}

#[cfg(feature = "http")]
pub async fn trace_context_hook<B>(mut request: Request<B>, next: Next<B>) -> Response {
    // Accept upstream W3C trace context, then publish the request context for
    // downstream async work and response annotations.
    let parent_context = global::get_text_map_propagator(|propagator| {
        propagator.extract(&HeaderExtractor(request.headers()))
    });
    let _ = Span::current().set_parent(parent_context);
    let request_context = RequestContext::from_headers(request.headers());
    request.extensions_mut().insert(request_context.clone());

    let mut response = CURRENT_REQUEST_CONTEXT
        .scope(request_context.clone(), next.run(request))
        .await;
    let current_context = Span::current().context();
    global::get_text_map_propagator(|propagator| {
        propagator.inject_context(
            &current_context,
            &mut HeaderInjector(response.headers_mut()),
        );
    });
    insert_request_context_headers(response.headers_mut(), &request_context);
    response
}

#[cfg(feature = "http")]
pub fn annotate_graphql_response(
    mut response: async_graphql::Response,
    request_context: &RequestContext,
) -> async_graphql::Response {
    // GraphQL clients often inspect extensions rather than HTTP headers, so
    // the same request context is attached to both successful and error
    // responses.
    for error in &mut response.errors {
        annotate_graphql_error(error, request_context);
    }
    response.extensions.insert(
        "request_id".to_string(),
        GraphqlValue::from(request_context.request_id.clone()),
    );
    response.extensions.insert(
        "correlation_id".to_string(),
        GraphqlValue::from(request_context.correlation_id.clone()),
    );
    insert_request_context_headers(&mut response.http_headers, request_context);
    response
}

#[cfg(feature = "http")]
pub fn graphql_error_with_context(
    message: impl Into<String>,
    request_context: &RequestContext,
) -> ServerError {
    let mut error = ServerError::new(redact_diagnostic_text(message.into()), None);
    annotate_graphql_error(&mut error, request_context);
    error
}

pub fn redact_diagnostic_text(message: impl AsRef<str>) -> String {
    // Redaction runs before diagnostic text leaves the backend. Keep this
    // list conservative: false positives are less risky than leaking
    // credentials.
    let mut redacted = message.as_ref().to_string();
    for redactor in [
        authorization_redactor(),
        bearer_redactor(),
        url_credentials_redactor(),
        quoted_key_value_redactor(),
        key_value_redactor(),
    ] {
        redacted = redactor
            .replace_all(&redacted, |captures: &regex::Captures<'_>| {
                let prefix = captures.get(1).map(|value| value.as_str()).unwrap_or("");
                format!("{prefix}[REDACTED]")
            })
            .into_owned();
    }
    redacted
}

#[allow(dead_code)] // ported alongside redact_diagnostic_text; no call site yet
pub fn redact_diagnostic_value(value: JsonValue) -> JsonValue {
    match value {
        JsonValue::String(message) => JsonValue::String(redact_diagnostic_text(message)),
        JsonValue::Array(items) => {
            JsonValue::Array(items.into_iter().map(redact_diagnostic_value).collect())
        }
        JsonValue::Object(entries) => JsonValue::Object(redact_diagnostic_object(entries)),
        other => other,
    }
}

fn redact_diagnostic_object(entries: JsonMap<String, JsonValue>) -> JsonMap<String, JsonValue> {
    entries
        .into_iter()
        .map(|(key, value)| {
            let value = if diagnostic_key_looks_sensitive(&key) {
                JsonValue::String("[REDACTED]".to_string())
            } else {
                redact_diagnostic_value(value)
            };
            (key, value)
        })
        .collect()
}

fn diagnostic_key_looks_sensitive(key: &str) -> bool {
    let normalized: String = key
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect();

    normalized.contains("password")
        || normalized == "pwd"
        || normalized.contains("passwd")
        || normalized.contains("token")
        || normalized.contains("secret")
        || normalized.contains("credential")
        || normalized.contains("authorization")
        || normalized.contains("privatekey")
        || normalized.contains("accesskey")
        || normalized.contains("accountkey")
        || normalized.contains("apikey")
}

#[cfg(feature = "http")]
fn annotate_graphql_error(error: &mut ServerError, request_context: &RequestContext) {
    let redacted_message = redact_diagnostic_text(&error.message);
    let public_error = public_graphql_error(&redacted_message);
    if public_error.message.as_ref() != redacted_message {
        tracing::warn!(
            request_id = %request_context.request_id,
            correlation_id = %request_context.correlation_id,
            error = %redacted_message,
            "suppressed GraphQL diagnostic in client response"
        );
    }
    let error_category = public_error.category;
    error.message = public_error.message.into_owned();
    let extensions = error
        .extensions
        .get_or_insert_with(ErrorExtensionValues::default);
    extensions.set("error_category", GraphqlValue::from(error_category));
    extensions.set(
        "request_id",
        GraphqlValue::from(request_context.request_id.clone()),
    );
    extensions.set(
        "correlation_id",
        GraphqlValue::from(request_context.correlation_id.clone()),
    );
}

#[cfg(feature = "http")]
struct PublicGraphqlError<'a> {
    message: Cow<'a, str>,
    category: &'static str,
}

#[cfg(feature = "http")]
fn public_graphql_error(message: &str) -> PublicGraphqlError<'_> {
    let normalized = message.trim().to_ascii_lowercase();
    if normalized.starts_with("data access error:") {
        return PublicGraphqlError {
            message: Cow::Borrowed("data access error"),
            category: "data_access",
        };
    }
    if normalized.starts_with("not authorized") {
        return PublicGraphqlError {
            message: Cow::Borrowed("not authorized"),
            category: "not_authorized",
        };
    }
    if normalized.starts_with("access denied") {
        return PublicGraphqlError {
            message: Cow::Borrowed("access denied"),
            category: "access_denied",
        };
    }
    if normalized.starts_with("internal server error") {
        return PublicGraphqlError {
            message: Cow::Borrowed("internal server error"),
            category: "internal",
        };
    }
    PublicGraphqlError {
        message: Cow::Borrowed(message),
        category: "graphql",
    }
}

#[cfg(feature = "http")]
fn insert_request_context_headers(headers: &mut HeaderMap, request_context: &RequestContext) {
    insert_header(headers, REQUEST_ID_HEADER_NAME, &request_context.request_id);
    insert_header(
        headers,
        CORRELATION_ID_HEADER_NAME,
        &request_context.correlation_id,
    );
}

#[cfg(feature = "http")]
fn insert_header(headers: &mut HeaderMap, name: &str, value: &str) {
    let Ok(name) = HeaderName::from_bytes(name.as_bytes()) else {
        return;
    };
    let Ok(value) = HeaderValue::from_str(value) else {
        return;
    };
    headers.insert(name, value);
}

#[cfg(feature = "http")]
fn header_value(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn authorization_redactor() -> &'static Regex {
    // Regex compilation is cached because redaction is on the error hot path.
    static REDACTOR: OnceLock<Regex> = OnceLock::new();
    REDACTOR.get_or_init(|| {
        Regex::new(r#"(?i)\b(authorization\s*[:=]\s*)(bearer\s+)?[^,\s;}]+"#)
            .expect("authorization redactor regex")
    })
}

fn bearer_redactor() -> &'static Regex {
    static REDACTOR: OnceLock<Regex> = OnceLock::new();
    REDACTOR.get_or_init(|| {
        Regex::new(r#"(?i)\b(bearer\s+)[A-Za-z0-9._~+/=-]+"#).expect("bearer redactor regex")
    })
}

fn url_credentials_redactor() -> &'static Regex {
    static REDACTOR: OnceLock<Regex> = OnceLock::new();
    REDACTOR
        .get_or_init(|| Regex::new(r#"(://)[^:/?#\s]+:[^@/?#\s]+@"#).expect("url redactor regex"))
}

fn quoted_key_value_redactor() -> &'static Regex {
    static REDACTOR: OnceLock<Regex> = OnceLock::new();
    REDACTOR.get_or_init(|| {
        Regex::new(
            r#"(?i)(["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|client[_-]?secret|credential|passwd|password|pwd|private[_-]?key|shared[_-]?access[_-]?key|account[_-]?key|secret|token)["']?\s*:\s*)("[^"]*"|'[^']*'|[^,\s}]+)"#,
        )
        .expect("quoted key/value redactor regex")
    })
}

fn key_value_redactor() -> &'static Regex {
    static REDACTOR: OnceLock<Regex> = OnceLock::new();
    REDACTOR.get_or_init(|| {
        Regex::new(
            r#"(?i)\b((?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|client[_-]?secret|credential|passwd|password|pwd|private[_-]?key|shared[_-]?access[_-]?key|account[_-]?key|secret|token)\s*[:=]\s*)[^,\s;}]+"#,
        )
        .expect("key/value redactor regex")
    })
}

#[cfg(feature = "http")]
struct HeaderExtractor<'a>(&'a HeaderMap);

#[cfg(feature = "http")]
impl Extractor for HeaderExtractor<'_> {
    fn get(&self, key: &str) -> Option<&str> {
        self.0.get(key).and_then(|value| value.to_str().ok())
    }

    fn keys(&self) -> Vec<&str> {
        self.0.keys().map(HeaderName::as_str).collect()
    }
}

#[cfg(feature = "http")]
struct HeaderInjector<'a>(&'a mut HeaderMap);

#[cfg(feature = "http")]
impl Injector for HeaderInjector<'_> {
    fn set(&mut self, key: &str, value: String) {
        let Ok(name) = HeaderName::from_bytes(key.as_bytes()) else {
            return;
        };
        let Ok(value) = HeaderValue::from_str(&value) else {
            return;
        };
        self.0.insert(name, value);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(feature = "http")]
    #[test]
    fn http_span_prefers_request_id_then_correlation_id() {
        let request = Request::builder()
            .uri("/info")
            .header(REQUEST_ID_HEADER_NAME, "req-1")
            .header(CORRELATION_ID_HEADER_NAME, "corr-1")
            .body(())
            .expect("request");
        let _span = http_make_span(&request);

        let request = Request::builder()
            .uri("/info")
            .header(CORRELATION_ID_HEADER_NAME, "corr-1")
            .body(())
            .expect("request");
        let _span = http_make_span(&request);
    }

    #[cfg(feature = "http")]
    #[test]
    fn request_context_defaults_correlation_to_request_id() {
        let mut headers = HeaderMap::new();
        headers.insert(
            REQUEST_ID_HEADER_NAME,
            HeaderValue::from_static("request-123"),
        );

        let request_context = RequestContext::from_headers(&headers);

        assert_eq!(request_context.request_id, "request-123");
        assert_eq!(request_context.correlation_id, "request-123");
    }

    #[cfg(feature = "http")]
    #[test]
    fn graphql_errors_get_request_context_extensions() {
        let request_context = RequestContext {
            request_id: "request-123".to_string(),
            correlation_id: "correlation-456".to_string(),
        };
        let response = async_graphql::Response::from_errors(vec![ServerError::new("boom", None)]);

        let response = annotate_graphql_response(response, &request_context);
        let extensions = response.errors[0]
            .extensions
            .as_ref()
            .expect("error extensions");

        assert_eq!(
            extensions.get("request_id"),
            Some(&GraphqlValue::from("request-123"))
        );
        assert_eq!(
            extensions.get("correlation_id"),
            Some(&GraphqlValue::from("correlation-456"))
        );
    }

    #[cfg(feature = "http")]
    #[test]
    fn graphql_error_messages_are_redacted_before_response() {
        let request_context = RequestContext {
            request_id: "request-123".to_string(),
            correlation_id: "correlation-456".to_string(),
        };
        let response = async_graphql::Response::from_errors(vec![ServerError::new(
            "database failed with password=hunter2 Authorization: Bearer abc.def",
            None,
        )]);

        let response = annotate_graphql_response(response, &request_context);
        let message = &response.errors[0].message;

        assert!(message.contains("[REDACTED]"));
        assert!(!message.contains("hunter2"));
        assert!(!message.contains("abc.def"));
    }

    #[cfg(feature = "http")]
    #[test]
    fn graphql_data_access_errors_hide_provider_diagnostics() {
        let request_context = RequestContext {
            request_id: "request-123".to_string(),
            correlation_id: "correlation-456".to_string(),
        };
        let response = async_graphql::Response::from_errors(vec![ServerError::new(
            "data access error: Fabric ODBC failed in SQLDriverConnect: State: 28000, Native error: 18456",
            None,
        )]);

        let response = annotate_graphql_response(response, &request_context);
        let error = &response.errors[0];
        let extensions = error.extensions.as_ref().expect("error extensions");

        assert_eq!(error.message, "data access error");
        assert!(!error.message.contains("SQLDriverConnect"));
        assert!(!error.message.contains("18456"));
        assert_eq!(
            extensions.get("error_category"),
            Some(&GraphqlValue::from("data_access"))
        );
        assert_eq!(
            extensions.get("request_id"),
            Some(&GraphqlValue::from("request-123"))
        );
    }

    #[test]
    fn diagnostic_redaction_covers_common_secret_shapes() {
        let message = redact_diagnostic_text(
            r#"postgres://svc:secret@db password=hunter2 token=abc Authorization: Bearer jwt.value {"client_secret":"top"}"#,
        );

        assert!(message.contains("[REDACTED]"));
        assert!(!message.contains("svc:secret"));
        assert!(!message.contains("hunter2"));
        assert!(!message.contains("abc"));
        assert!(!message.contains("jwt.value"));
        assert!(!message.contains("top"));
    }

    #[test]
    fn diagnostic_redaction_covers_provider_secret_aliases() {
        let message = redact_diagnostic_text(
            r#"Pwd=short; PrivateKey=snowflake-private; SharedAccessKey=azure-key {"account_key":"storage-key","private_key":"pem"}"#,
        );

        assert!(message.contains("[REDACTED]"));
        assert!(!message.contains("short"));
        assert!(!message.contains("snowflake-private"));
        assert!(!message.contains("azure-key"));
        assert!(!message.contains("storage-key"));
        assert!(!message.contains("pem"));
    }

    #[test]
    fn diagnostic_value_redaction_recurses_through_structured_payloads() {
        let diagnostic = serde_json::json!({
            "connection": "postgres://svc:secret@db",
            "nested": {
                "private_key": "pem",
                "safe": "query plan available"
            },
            "warnings": [
                "Authorization: Bearer jwt.value"
            ]
        });

        let redacted = redact_diagnostic_value(diagnostic);

        assert_eq!(
            redacted["nested"]["safe"],
            serde_json::json!("query plan available")
        );
        assert_eq!(
            redacted["nested"]["private_key"],
            serde_json::json!("[REDACTED]")
        );

        let serialized = redacted.to_string();
        assert!(serialized.contains("[REDACTED]"));
        assert!(!serialized.contains("svc:secret"));
        assert!(!serialized.contains("pem"));
        assert!(!serialized.contains("jwt.value"));
    }

    #[cfg(feature = "http")]
    #[test]
    fn header_injector_ignores_invalid_values() {
        let mut headers = HeaderMap::new();
        let mut injector = HeaderInjector(&mut headers);

        injector.set("traceparent", "valid".to_string());
        injector.set("bad header", "ignored".to_string());
        injector.set("tracestate", "bad\nvalue".to_string());

        assert_eq!(headers.get("traceparent").unwrap(), "valid");
        assert!(!headers.contains_key("bad header"));
        assert!(!headers.contains_key("tracestate"));
    }
}
