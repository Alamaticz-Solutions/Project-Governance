//! HTTP router assembly and the shared middleware stack mounted on every
//! merged router.
//!
//! Product-owned (backend framework replacement phase 4b-2). Designed
//! independently against a behavior specification -- not derived from
//! framework source.
//!
//! Kept framework-owned, deliberately NOT ported here:
//!   - `SecurityConfig` -- threaded into `config/app_config.rs`'s RBAC-bypass
//!     logic (`bypass_policies_in_local`, `allow_missing_policies_in_local`,
//!     phase-5 territory) and is the parameter type of
//!     `appfw_runtime::routing::runtime_graphql_schema_routes` (below), so
//!     its type can't move independently of that function.
//!   - `MetricsRegistry`, `RequestContext`, `current_request_context` --
//!     deferred in phase 4b-1 (see `platform::observability`'s doc comment)
//!     because `admin_ui.rs`'s framework-trait implementations and
//!     `routes/info.rs`'s `runtime_info_routes(...)` both fix these types.
//!   - `trace_context_hook`, `http_make_span`, `metrics_hook`,
//!     `REQUEST_ID_HEADER_NAME` -- all operate on `RequestContext`'s
//!     framework-owned storage, so they move together with it later.
//!   - `RuntimeJwtExtractor`, `RuntimeAuthState`, `UserAuth`, and
//!     `runtime_graphql_schema_routes` itself (the GraphQL route + JWT
//!     extraction + introspection-auth-gate handler) -- phase 4b-4, blocked
//!     on standing up a real JWT accept/reject test environment (see
//!     phase4b-baseline/baseline.md). Called unchanged from
//!     `routes/governance.rs` and `routes/system.rs`.
//!
//! `chat` is unreachable in this product (`backend/Cargo.toml` never defines
//! or forwards a `chat` feature to `appfw_runtime`) and is dropped entirely.
//! `mcp` is very likely dead too (no Dockerfile, compose file, or CI in this
//! repo ever enables it) but is still a live `backend/Cargo.toml` feature
//! with a real call site in `routes/mod.rs`, so its cfg-gated branch is kept
//! -- actually removing `mcp` is a separate, not-yet-authorized cleanup.

use std::{env, time::Duration};

use appfw_runtime::{
    host::{RuntimeIngressKind, RuntimeMode},
    observability::{
        http_make_span, metrics_hook, trace_context_hook, MetricsRegistry, REQUEST_ID_HEADER_NAME,
    },
    security::SecurityConfig,
};
use axum::{
    body::{boxed, Full},
    extract::DefaultBodyLimit,
    http::{header, HeaderName, HeaderValue, Response, StatusCode},
    middleware, Router,
};
use tower_http::{
    catch_panic::CatchPanicLayer,
    cors::CorsLayer,
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    set_header::SetResponseHeaderLayer,
    timeout::TimeoutLayer,
    trace::{DefaultOnResponse, TraceLayer},
};
use tracing::Level;

use crate::platform::security::{rate_limit_hook, RateLimiterState};

const REQUEST_TIMEOUT_ENV: &str = "APP_REQUEST_TIMEOUT_MS";
const REQUEST_TIMEOUT_DEFAULT_MS: u64 = 30_000;

/// Sub-routers a caller mounts before the common gating/middleware stack is
/// applied.
#[derive(Default)]
pub(crate) struct RuntimeRouteSet {
    info: Option<Router>,
    admin: Option<Router>,
    product_ui: Option<Router>,
    #[cfg(feature = "mcp")]
    mcp: Option<Router>,
    schemas: Vec<Router>,
}

impl RuntimeRouteSet {
    pub(crate) fn new() -> Self {
        Self::default()
    }

    pub(crate) fn with_info(mut self, router: Router) -> Self {
        self.info = Some(router);
        self
    }

    pub(crate) fn with_admin(mut self, router: Router) -> Self {
        self.admin = Some(router);
        self
    }

    pub(crate) fn with_product_ui(mut self, router: Router) -> Self {
        self.product_ui = Some(router);
        self
    }

    #[cfg(feature = "mcp")]
    pub(crate) fn with_mcp(mut self, router: Router) -> Self {
        self.mcp = Some(router);
        self
    }

    pub(crate) fn with_schema(mut self, router: Router) -> Self {
        self.schemas.push(router);
        self
    }

    /// Folds every mounted sub-router into one, gated by which ingress kinds
    /// `mode` enables and by the security flags controlling optional
    /// surfaces (admin UI, product UI, MCP).
    fn merge_enabled(self, mode: &RuntimeMode, security: &SecurityConfig) -> Router {
        let mut router = Router::new();

        if mode.enables(RuntimeIngressKind::Http) {
            if let Some(info) = self.info {
                router = router.merge(info);
            }
            if security.admin_ui_enabled {
                if let Some(admin) = self.admin {
                    router = router.merge(admin);
                }
            }
            for schema in self.schemas {
                router = router.merge(schema);
            }
            if security.product_ui_enabled {
                if let Some(product_ui) = self.product_ui {
                    router = router.merge(product_ui);
                }
            }
        }

        #[cfg(feature = "mcp")]
        {
            // MCP is an independent ingress surface from plain HTTP for mode
            // selection purposes, even though it currently rides the same
            // HTTP transport.
            if security.mcp_enabled && mode.enables(RuntimeIngressKind::Mcp) {
                if let Some(mcp) = self.mcp {
                    router = router.merge(mcp);
                }
            }
        }

        router
    }
}

/// Assembles a router covering every ingress kind this deployment supports.
#[allow(dead_code)]
pub(crate) fn assemble_runtime_router(
    routes: RuntimeRouteSet,
    cors: CorsLayer,
    metrics: MetricsRegistry,
    security: &SecurityConfig,
) -> Router {
    assemble_runtime_router_for_mode(routes, cors, metrics, security, &RuntimeMode::all())
}

/// Assembles a router restricted to the ingress kinds `mode` enables.
pub(crate) fn assemble_runtime_router_for_mode(
    routes: RuntimeRouteSet,
    cors: CorsLayer,
    metrics: MetricsRegistry,
    security: &SecurityConfig,
    mode: &RuntimeMode,
) -> Router {
    let merged = routes.merge_enabled(mode, security);
    guard_with_middleware(merged, Some(cors), metrics, security)
}

/// Applies the shared middleware stack to an already-assembled router.
#[allow(dead_code)]
pub(crate) fn apply_runtime_layers(
    router: Router,
    cors: CorsLayer,
    metrics: MetricsRegistry,
    security: &SecurityConfig,
) -> Router {
    guard_with_middleware(router, Some(cors), metrics, security)
}

/// The full middleware stack, ordered from innermost (closest to the route
/// handlers) to outermost. The order is load-bearing, not cosmetic:
///
///   1. body-size limit + rate limiter -- cheap rejections resolved before
///      any real handler work happens.
///   2. the caller-supplied CORS layer (when given) wraps (1), so a browser
///      reading a 413 or 429 rejection still sees CORS headers on that
///      response, not only on successful ones.
///   3. tracing/metrics/request-id instrumentation.
///   4. fixed security response headers, applied to every outcome above,
///      errors included.
///   5. a total request timeout, bounding how long any handler may hold a
///      connection open.
///   6. panic isolation, outermost of all, so a panic anywhere below turns
///      into a clean 500 instead of dropping the connection.
fn guard_with_middleware(
    router: Router,
    cors: Option<CorsLayer>,
    metrics: MetricsRegistry,
    security: &SecurityConfig,
) -> Router {
    let request_id_header = HeaderName::from_static(REQUEST_ID_HEADER_NAME);

    let mut router = router
        .layer(DefaultBodyLimit::max(security.request_body_limit_bytes))
        .layer(middleware::from_fn_with_state(
            RateLimiterState::new(security.rate_limit_per_second, security.rate_limit_burst),
            rate_limit_hook,
        ));

    if let Some(cors) = cors {
        router = router.layer(cors);
    }

    router = router
        .layer(middleware::from_fn_with_state(metrics, metrics_hook))
        .layer(middleware::from_fn(trace_context_hook))
        .layer(PropagateRequestIdLayer::new(request_id_header.clone()))
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(http_make_span)
                .on_response(DefaultOnResponse::new().level(Level::INFO)),
        )
        .layer(SetRequestIdLayer::new(request_id_header, MakeRequestUuid));

    for (name, value) in fixed_security_headers(is_managed_environment()) {
        router = router.layer(SetResponseHeaderLayer::if_not_present(name, value));
    }

    router
        .layer(TimeoutLayer::new(configured_request_timeout()))
        .layer(CatchPanicLayer::custom(on_handler_panic))
}

/// Total request timeout, configurable via `APP_REQUEST_TIMEOUT_MS`
/// (default 30 seconds).
fn configured_request_timeout() -> Duration {
    let millis = env::var(REQUEST_TIMEOUT_ENV)
        .ok()
        .and_then(|raw| raw.parse::<u64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(REQUEST_TIMEOUT_DEFAULT_MS);
    Duration::from_millis(millis)
}

/// Fixed, secret-free 500 for any panic that escapes a handler -- never
/// echoes the panic payload back to the client.
fn on_handler_panic(
    _payload: Box<dyn std::any::Any + Send + 'static>,
) -> Response<axum::body::BoxBody> {
    Response::builder()
        .status(StatusCode::INTERNAL_SERVER_ERROR)
        .header(header::CONTENT_TYPE, "application/json")
        .body(boxed(Full::from(
            r#"{"errors":[{"message":"internal server error"}]}"#,
        )))
        .expect("fixed panic response is well-formed")
}

/// Fixed security headers applied to every response, plus the CSP for the
/// current deployment tier.
fn fixed_security_headers(managed: bool) -> Vec<(HeaderName, HeaderValue)> {
    let mut headers = vec![
        (
            header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ),
        (header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY")),
        (
            header::REFERRER_POLICY,
            HeaderValue::from_static("no-referrer"),
        ),
        (
            header::CONTENT_SECURITY_POLICY,
            content_security_policy(managed),
        ),
    ];

    if managed {
        headers.push((
            header::STRICT_TRANSPORT_SECURITY,
            HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        ));
    }

    headers
}

/// Content-Security-Policy for the current deployment tier. Managed
/// (non-local) environments get a strict, self-only policy; local
/// development relaxes script/style/connect rules so the GraphiQL UI and its
/// websocket subscriptions keep working.
fn content_security_policy(managed: bool) -> HeaderValue {
    let directives: &[(&str, &str)] = if managed {
        &[
            ("base-uri", "'self'"),
            ("default-src", "'self'"),
            ("script-src", "'self'"),
            ("style-src", "'self'"),
            ("img-src", "'self' data:"),
            ("font-src", "'self' data:"),
            ("connect-src", "'self'"),
            ("object-src", "'none'"),
            ("frame-ancestors", "'none'"),
            ("form-action", "'self'"),
        ]
    } else {
        &[
            ("base-uri", "'self'"),
            ("default-src", "'self'"),
            ("script-src", "'self' 'unsafe-inline' 'unsafe-eval' https:"),
            ("style-src", "'self' 'unsafe-inline' https:"),
            ("img-src", "'self' data: https:"),
            ("font-src", "'self' data: https:"),
            ("connect-src", "'self' https: wss:"),
            ("object-src", "'none'"),
            ("frame-ancestors", "'none'"),
        ]
    };

    let policy = directives
        .iter()
        .map(|(name, value)| format!("{name} {value}"))
        .collect::<Vec<_>>()
        .join("; ");

    HeaderValue::from_str(&policy).expect("directive list has no control characters")
}

/// A "managed" deployment has an explicit, non-local `ENV_NAME` -- anything
/// other than a developer's own workstation.
fn is_managed_environment() -> bool {
    env::var("ENV_NAME")
        .map(|value| !value.is_empty() && value != "local")
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Method, Request},
        routing::{get, post},
    };
    use tower::ServiceExt;

    /// Builds a `SecurityConfig` via the framework's own `from_env()` rather
    /// than a field-literal: `SecurityConfig`'s `#[cfg(feature = "chat"/"mcp")]`
    /// fields are gated on `appfw_runtime`'s own feature flags, which this
    /// workspace's Cargo feature-unification can turn on independently of
    /// `backend`'s own `mcp` feature (confirmed: `cargo test` here activates
    /// `appfw_runtime/mcp` even with `--features "http,provider-postgres"`
    /// and no `mcp` requested, almost certainly via another workspace member's
    /// dependency on `appfw_runtime`). A literal naming every field would
    /// need to track that mismatch exactly; going through `from_env()` and
    /// mutating only the fields a test cares about sidesteps it entirely.
    fn security(
        admin_ui_enabled: bool,
        #[allow(unused_variables)] mcp_enabled: bool,
    ) -> SecurityConfig {
        let mut config = SecurityConfig::from_env();
        config.admin_ui_enabled = admin_ui_enabled;
        config.admin_troubleshooting_enabled = false;
        config.product_ui_enabled = true;
        #[cfg(feature = "mcp")]
        {
            config.mcp_enabled = mcp_enabled;
        }
        config.graphql_introspection_enabled = false;
        config.graphql_max_depth = 12;
        config.graphql_max_complexity = 500;
        config.request_body_limit_bytes = 1024 * 1024;
        config.rate_limit_per_second = 100;
        config.rate_limit_burst = 100;
        config
    }

    fn ok_route(path: &'static str) -> Router {
        Router::new().route(path, get(|| async { "ok" }))
    }

    fn body_route(path: &'static str) -> Router {
        Router::new().route(path, post(|_body: String| async { "ok" }))
    }

    async fn status(router: Router, path: &str) -> StatusCode {
        router
            .oneshot(
                Request::builder()
                    .uri(path)
                    .body(Body::empty())
                    .expect("request"),
            )
            .await
            .expect("response")
            .status()
    }

    async fn request_status(router: Router, request: Request<Body>) -> StatusCode {
        router.oneshot(request).await.expect("response").status()
    }

    #[tokio::test]
    async fn mounts_info_and_schema_routes_without_optional_surfaces() {
        let security = security(false, false);
        let route_set = RuntimeRouteSet::new()
            .with_info(ok_route("/info"))
            .with_admin(ok_route("/admin"))
            .with_schema(ok_route("/crm"));
        #[cfg(feature = "mcp")]
        let route_set = route_set.with_mcp(ok_route("/mcp"));
        let router = assemble_runtime_router(
            route_set,
            CorsLayer::new(),
            MetricsRegistry::from_env(),
            &security,
        );

        assert_eq!(status(router.clone(), "/info").await, 200);
        assert_eq!(status(router.clone(), "/crm").await, 200);
        assert_eq!(status(router.clone(), "/admin").await, 404);
        assert_eq!(status(router, "/mcp").await, 404);
    }

    #[cfg(feature = "mcp")]
    #[tokio::test]
    async fn mounts_admin_and_mcp_only_when_enabled() {
        let security = security(true, true);
        let router = assemble_runtime_router(
            RuntimeRouteSet::new()
                .with_admin(ok_route("/admin"))
                .with_mcp(ok_route("/mcp")),
            CorsLayer::new(),
            MetricsRegistry::from_env(),
            &security,
        );

        assert_eq!(status(router.clone(), "/admin").await, 200);
        assert_eq!(status(router, "/mcp").await, 200);
    }

    #[cfg(feature = "mcp")]
    #[tokio::test]
    async fn runtime_mode_can_disable_mcp_route() {
        let security = security(true, true);
        let router = assemble_runtime_router_for_mode(
            RuntimeRouteSet::new()
                .with_info(ok_route("/info"))
                .with_mcp(ok_route("/mcp"))
                .with_schema(ok_route("/crm")),
            CorsLayer::new(),
            MetricsRegistry::from_env(),
            &security,
            &RuntimeMode::http(),
        );

        assert_eq!(status(router.clone(), "/info").await, 200);
        assert_eq!(status(router.clone(), "/crm").await, 200);
        assert_eq!(status(router, "/mcp").await, 404);
    }

    #[tokio::test]
    async fn runtime_router_applies_configured_request_body_limit() {
        let mut security = security(false, false);
        security.request_body_limit_bytes = 8;
        let router = assemble_runtime_router(
            RuntimeRouteSet::new().with_schema(body_route("/crm")),
            CorsLayer::new(),
            MetricsRegistry::from_env(),
            &security,
        );

        let status = request_status(
            router,
            Request::builder()
                .method(Method::POST)
                .uri("/crm")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"query":"{ value }"}"#))
                .expect("request"),
        )
        .await;

        assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
    }

    #[tokio::test]
    async fn runtime_router_applies_configured_rate_limit() {
        let mut security = security(false, false);
        security.rate_limit_per_second = 1;
        security.rate_limit_burst = 1;
        let router = assemble_runtime_router(
            RuntimeRouteSet::new().with_schema(ok_route("/crm")),
            CorsLayer::new(),
            MetricsRegistry::from_env(),
            &security,
        );

        let first = request_status(
            router.clone(),
            Request::builder()
                .method(Method::GET)
                .uri("/crm")
                .header("authorization", "Bearer runtime-router-rate-limit")
                .body(Body::empty())
                .expect("request"),
        )
        .await;
        let second = request_status(
            router,
            Request::builder()
                .method(Method::GET)
                .uri("/crm")
                .header("authorization", "Bearer runtime-router-rate-limit")
                .body(Body::empty())
                .expect("request"),
        )
        .await;

        assert_eq!(first, StatusCode::OK);
        assert_eq!(second, StatusCode::TOO_MANY_REQUESTS);
    }

    /// The caller-supplied CORS layer must wrap the body/rate limiters so
    /// legacy/product-route 429 and 413 rejections stay CORS-readable in
    /// browsers, on both `assemble_runtime_router` and `apply_runtime_layers`.
    #[tokio::test]
    async fn rate_and_body_limit_rejections_carry_caller_cors() {
        let legacy_origin = HeaderValue::from_static("https://legacy.example.com");
        let legacy_cors = || {
            CorsLayer::new()
                .allow_methods([Method::GET, Method::POST])
                .allow_origin(legacy_origin.clone())
        };

        let mut rate_security = security(false, false);
        rate_security.rate_limit_per_second = 1;
        rate_security.rate_limit_burst = 1;
        let rate_router = assemble_runtime_router(
            RuntimeRouteSet::new().with_schema(ok_route("/crm")),
            legacy_cors(),
            MetricsRegistry::from_env(),
            &rate_security,
        );
        let rate_request = || {
            Request::builder()
                .method(Method::GET)
                .uri("/crm")
                .header(header::ORIGIN, "https://legacy.example.com")
                .header(header::AUTHORIZATION, "Bearer legacy-cors-rate-limit")
                .body(Body::empty())
                .expect("rate-limited request")
        };
        let first = rate_router
            .clone()
            .oneshot(rate_request())
            .await
            .expect("first response");
        assert_eq!(first.status(), StatusCode::OK);
        let limited = rate_router
            .oneshot(rate_request())
            .await
            .expect("rate-limited response");
        assert_eq!(limited.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(
            limited.headers().get(header::ACCESS_CONTROL_ALLOW_ORIGIN),
            Some(&legacy_origin)
        );

        let mut body_security = security(false, false);
        body_security.request_body_limit_bytes = 8;
        let body_router = assemble_runtime_router(
            RuntimeRouteSet::new().with_schema(body_route("/crm")),
            legacy_cors(),
            MetricsRegistry::from_env(),
            &body_security,
        );
        let oversized = body_router
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/crm")
                    .header(header::ORIGIN, "https://legacy.example.com")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"query":"{ value }"}"#))
                    .expect("oversized request"),
            )
            .await
            .expect("body-limited response");
        assert_eq!(oversized.status(), StatusCode::PAYLOAD_TOO_LARGE);
        assert_eq!(
            oversized.headers().get(header::ACCESS_CONTROL_ALLOW_ORIGIN),
            Some(&legacy_origin)
        );

        let mut layered_security = security(false, false);
        layered_security.rate_limit_per_second = 1;
        layered_security.rate_limit_burst = 1;
        let layered = apply_runtime_layers(
            ok_route("/product"),
            legacy_cors(),
            MetricsRegistry::from_env(),
            &layered_security,
        );
        let layered_request = || {
            Request::builder()
                .method(Method::GET)
                .uri("/product")
                .header(header::ORIGIN, "https://legacy.example.com")
                .header(header::AUTHORIZATION, "Bearer layered-cors-rate-limit")
                .body(Body::empty())
                .expect("layered request")
        };
        let first_layered = layered
            .clone()
            .oneshot(layered_request())
            .await
            .expect("first layered response");
        assert_eq!(first_layered.status(), StatusCode::OK);
        let layered_limited = layered
            .oneshot(layered_request())
            .await
            .expect("layered rate-limited response");
        assert_eq!(layered_limited.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(
            layered_limited
                .headers()
                .get(header::ACCESS_CONTROL_ALLOW_ORIGIN),
            Some(&legacy_origin)
        );
    }

    #[test]
    fn managed_csp_excludes_local_graphiql_conveniences() {
        let header = content_security_policy(true);
        let csp = header.to_str().expect("static CSP should be valid");

        assert!(!csp.contains("'unsafe-inline'"));
        assert!(!csp.contains("'unsafe-eval'"));
        assert!(csp.contains("script-src 'self'"));
        assert!(csp.contains("connect-src 'self'"));
    }

    #[test]
    fn local_csp_keeps_graphiql_conveniences() {
        let header = content_security_policy(false);
        let csp = header.to_str().expect("static CSP should be valid");

        assert!(csp.contains("'unsafe-inline'"));
        assert!(csp.contains("'unsafe-eval'"));
        assert!(csp.contains("wss:"));
    }
}
