//! Server bootstrap: which runtime ingress transports this process should
//! host, parsed from the environment, plus the HTTP listener that binds a
//! socket and serves the assembled router until a shutdown signal.
//!
//! Product-owned (backend framework replacement phase 4b-5 -- previously
//! `appfw_runtime::host`). Designed independently against a behavior
//! specification, not derived from framework source. Pure deployment
//! plumbing: no dependency on the policy/RBAC/observability surface.
//!
//! The transport-selection types (`RuntimeIngressKind`, `RuntimeMode`,
//! `RuntimeHostPlan`, `HostError`) are always compiled -- `main.rs` consults
//! them before it knows whether it will serve HTTP. Only the pieces that
//! actually touch `axum` (`RuntimeHttpServerConfig`, `serve_http_router`)
//! are gated on the `http` feature.

use std::{collections::BTreeSet, env, fmt, str::FromStr};

/// Everything that can go wrong while working out what to host or standing up
/// the HTTP listener.
#[derive(Debug, thiserror::Error)]
pub(crate) enum HostError {
    #[error("invalid runtime mode: {0}")]
    InvalidMode(String),

    #[error("runtime ingress module `{0}` is not available in this build")]
    ModuleFeatureDisabled(&'static str),

    #[error("required environment variable `{0}` is not set")]
    MissingEnv(String),

    #[error("`{address}` is not a valid socket address")]
    InvalidSocketAddress {
        address: String,
        #[source]
        source: std::net::AddrParseError,
    },

    #[error("could not bind a listener at `{address}`")]
    Bind {
        address: String,
        #[source]
        source: std::io::Error,
    },

    #[error("could not hand the bound listener to the HTTP server")]
    ConvertListener(#[source] std::io::Error),

    #[error("could not start the HTTP server: {0}")]
    CreateServer(String),

    #[error("the HTTP server stopped with an error: {0}")]
    Serve(String),
}

/// A single runtime ingress transport. Each variant exists only when the
/// matching Cargo feature is compiled in; this product builds `http` only.
///
/// `chat` has no variant at all -- unlike the framework, this product never
/// forwards a `chat` feature to `appfw_runtime`, so the transport simply does
/// not exist here (matching `platform::routing`, which dropped it too).
#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub(crate) enum RuntimeIngressKind {
    #[cfg(feature = "http")]
    Http,
    #[cfg(feature = "mcp")]
    Mcp,
    #[cfg(feature = "kafka")]
    Kafka,
    #[cfg(feature = "sync")]
    Sync,
}

impl RuntimeIngressKind {
    /// The canonical lowercase token for this transport.
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            #[cfg(feature = "http")]
            Self::Http => "http",
            #[cfg(feature = "mcp")]
            Self::Mcp => "mcp",
            #[cfg(feature = "kafka")]
            Self::Kafka => "kafka",
            #[cfg(feature = "sync")]
            Self::Sync => "sync",
        }
    }
}

impl fmt::Display for RuntimeIngressKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for RuntimeIngressKind {
    type Err = HostError;

    /// Accepts the canonical token plus a few operator-friendly aliases,
    /// case-insensitively. A token that names a real transport whose feature
    /// is absent from this build is a `ModuleFeatureDisabled`; a token that
    /// names nothing is an `InvalidMode`.
    fn from_str(raw: &str) -> Result<Self, Self::Err> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "chat" | "ai-chat" | "conversation" => Err(HostError::ModuleFeatureDisabled("chat")),
            "http" | "graphql" | "admin" => {
                #[cfg(feature = "http")]
                {
                    Ok(Self::Http)
                }
                #[cfg(not(feature = "http"))]
                {
                    Err(HostError::ModuleFeatureDisabled("http"))
                }
            }
            "mcp" => {
                #[cfg(feature = "mcp")]
                {
                    Ok(Self::Mcp)
                }
                #[cfg(not(feature = "mcp"))]
                {
                    Err(HostError::ModuleFeatureDisabled("mcp"))
                }
            }
            "kafka" | "consumer" | "consumers" => {
                #[cfg(feature = "kafka")]
                {
                    Ok(Self::Kafka)
                }
                #[cfg(not(feature = "kafka"))]
                {
                    Err(HostError::ModuleFeatureDisabled("kafka"))
                }
            }
            "sync" | "sync-worker" | "sync-workers" => {
                #[cfg(feature = "sync")]
                {
                    Ok(Self::Sync)
                }
                #[cfg(not(feature = "sync"))]
                {
                    Err(HostError::ModuleFeatureDisabled("sync"))
                }
            }
            other => Err(HostError::InvalidMode(format!(
                "unknown runtime ingress module `{other}`"
            ))),
        }
    }
}

/// The set of ingress transports this process intends to run.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct RuntimeMode {
    kinds: BTreeSet<RuntimeIngressKind>,
}

// --- constructors ---------------------------------------------------------

impl RuntimeMode {
    /// Every transport this build supports.
    pub(crate) fn all() -> Self {
        #[allow(unused_mut)]
        let mut kinds = BTreeSet::new();
        #[cfg(feature = "http")]
        kinds.insert(RuntimeIngressKind::Http);
        #[cfg(feature = "mcp")]
        kinds.insert(RuntimeIngressKind::Mcp);
        #[cfg(feature = "kafka")]
        kinds.insert(RuntimeIngressKind::Kafka);
        #[cfg(feature = "sync")]
        kinds.insert(RuntimeIngressKind::Sync);
        Self { kinds }
    }

    pub(crate) fn from_kinds<const N: usize>(kinds: [RuntimeIngressKind; N]) -> Self {
        Self {
            kinds: kinds.into_iter().collect(),
        }
    }

    #[cfg(feature = "http")]
    pub(crate) fn http() -> Self {
        Self::from_kinds([RuntimeIngressKind::Http])
    }

    #[cfg(feature = "mcp")]
    pub(crate) fn mcp() -> Self {
        Self::from_kinds([RuntimeIngressKind::Mcp])
    }

    #[cfg(feature = "kafka")]
    pub(crate) fn consumers() -> Self {
        Self::from_kinds([RuntimeIngressKind::Kafka])
    }

    #[cfg(feature = "sync")]
    pub(crate) fn sync_workers() -> Self {
        Self::from_kinds([RuntimeIngressKind::Sync])
    }

    /// The mode a process runs when nothing is configured: the HTTP listener
    /// if this build has it, otherwise the single worker transport it does
    /// have, otherwise everything.
    pub(crate) fn default_mode() -> Self {
        #[cfg(feature = "http")]
        {
            Self::http()
        }
        #[cfg(all(not(feature = "http"), feature = "mcp"))]
        {
            Self::mcp()
        }
        #[cfg(all(not(any(feature = "http", feature = "mcp")), feature = "kafka"))]
        {
            Self::consumers()
        }
        #[cfg(all(
            not(any(feature = "http", feature = "mcp", feature = "kafka")),
            feature = "sync"
        ))]
        {
            Self::sync_workers()
        }
        #[cfg(not(any(feature = "http", feature = "mcp", feature = "kafka", feature = "sync")))]
        {
            Self::all()
        }
    }
}

// --- environment parsing ------------------------------------------------------

impl RuntimeMode {
    /// `APPFW_MODULES` (a comma list) wins if present; otherwise
    /// `APPFW_RUNTIME_MODE` (a single keyword); otherwise `default_mode()`.
    pub(crate) fn from_env() -> Result<Self, HostError> {
        if let Ok(modules) = env::var("APPFW_MODULES") {
            return Self::parse_modules(&modules);
        }
        match env::var("APPFW_RUNTIME_MODE") {
            Ok(mode) => Self::parse_mode(&mode),
            Err(_) => Ok(Self::default_mode()),
        }
    }

    /// A single keyword: `all`/empty, or one transport (with a couple of
    /// aliases each).
    pub(crate) fn parse_mode(value: &str) -> Result<Self, HostError> {
        match value.trim().to_ascii_lowercase().as_str() {
            "" | "all" => Ok(Self::all()),
            "http" | "server" | "serve-http" => single_transport_mode("http", {
                #[cfg(feature = "http")]
                {
                    Some(RuntimeIngressKind::Http)
                }
                #[cfg(not(feature = "http"))]
                {
                    None
                }
            }),
            "chat" | "serve-chat" | "conversation" => {
                Err(HostError::ModuleFeatureDisabled("chat"))
            }
            "mcp" | "serve-mcp" => single_transport_mode("mcp", {
                #[cfg(feature = "mcp")]
                {
                    Some(RuntimeIngressKind::Mcp)
                }
                #[cfg(not(feature = "mcp"))]
                {
                    None
                }
            }),
            "consumer" | "consumers" | "kafka" | "run-consumers" => {
                single_transport_mode("kafka", {
                    #[cfg(feature = "kafka")]
                    {
                        Some(RuntimeIngressKind::Kafka)
                    }
                    #[cfg(not(feature = "kafka"))]
                    {
                        None
                    }
                })
            }
            "sync" | "sync-worker" | "sync-workers" | "run-sync-workers" => {
                single_transport_mode("sync", {
                    #[cfg(feature = "sync")]
                    {
                        Some(RuntimeIngressKind::Sync)
                    }
                    #[cfg(not(feature = "sync"))]
                    {
                        None
                    }
                })
            }
            other => Err(HostError::InvalidMode(format!(
                "APPFW_RUNTIME_MODE must be one of all, http, chat, mcp, consumers, sync; got `{other}`"
            ))),
        }
    }

    /// A comma-separated list of transport tokens; at least one must resolve.
    pub(crate) fn parse_modules(value: &str) -> Result<Self, HostError> {
        let kinds = value
            .split(',')
            .map(str::trim)
            .filter(|token| !token.is_empty())
            .map(RuntimeIngressKind::from_str)
            .collect::<Result<BTreeSet<_>, _>>()?;

        if kinds.is_empty() {
            return Err(HostError::InvalidMode(
                "APPFW_MODULES must name at least one runtime ingress module".to_string(),
            ));
        }
        Ok(Self { kinds })
    }
}

// --- queries ----------------------------------------------------------------

impl RuntimeMode {
    pub(crate) fn enables(&self, kind: RuntimeIngressKind) -> bool {
        self.kinds.contains(&kind)
    }

    /// Whether any enabled transport is served over the shared HTTP listener
    /// -- plain HTTP, and (when the `mcp` feature is compiled in) MCP, which
    /// rides the same socket.
    pub(crate) fn enables_http_listener(&self) -> bool {
        #[cfg(feature = "http")]
        {
            self.enables(RuntimeIngressKind::Http) || {
                #[cfg(feature = "mcp")]
                {
                    self.enables(RuntimeIngressKind::Mcp)
                }
                #[cfg(not(feature = "mcp"))]
                {
                    false
                }
            }
        }
        #[cfg(not(feature = "http"))]
        {
            false
        }
    }

    pub(crate) fn module_names(&self) -> Vec<&'static str> {
        self.kinds.iter().map(|kind| kind.as_str()).collect()
    }
}

/// Turns "known alias, feature maybe absent" into the right result: `Some`
/// means the feature is compiled in, `None` means it isn't.
fn single_transport_mode(
    feature: &'static str,
    kind: Option<RuntimeIngressKind>,
) -> Result<RuntimeMode, HostError> {
    match kind {
        Some(kind) => Ok(RuntimeMode::from_kinds([kind])),
        None => Err(HostError::ModuleFeatureDisabled(feature)),
    }
}

/// The deployment decision `main.rs` acts on: what this process should host,
/// and whether that includes the HTTP listener or a worker transport.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct RuntimeHostPlan {
    mode: RuntimeMode,
}

impl RuntimeHostPlan {
    pub(crate) fn new(mode: RuntimeMode) -> Self {
        Self { mode }
    }

    #[allow(dead_code)]
    pub(crate) fn from_env() -> Result<Self, HostError> {
        RuntimeMode::from_env().map(Self::new)
    }

    pub(crate) fn mode(&self) -> &RuntimeMode {
        &self.mode
    }

    pub(crate) fn serves_http_listener(&self) -> bool {
        self.mode.enables_http_listener()
    }

    pub(crate) fn module_names(&self) -> Vec<&'static str> {
        self.mode.module_names()
    }

    /// Names of enabled transports that run as background workers rather than
    /// on the HTTP listener. Empty for an `http`-only build.
    pub(crate) fn worker_module_names(&self) -> Vec<&'static str> {
        #[allow(unused_mut)]
        let mut names = Vec::new();
        #[cfg(all(feature = "mcp", not(feature = "http")))]
        if self.mode.enables(RuntimeIngressKind::Mcp) {
            names.push(RuntimeIngressKind::Mcp.as_str());
        }
        #[cfg(feature = "kafka")]
        if self.mode.enables(RuntimeIngressKind::Kafka) {
            names.push(RuntimeIngressKind::Kafka.as_str());
        }
        #[cfg(feature = "sync")]
        if self.mode.enables(RuntimeIngressKind::Sync) {
            names.push(RuntimeIngressKind::Sync.as_str());
        }
        names
    }

    pub(crate) fn has_unsupported_worker_modules(&self) -> bool {
        !self.worker_module_names().is_empty()
    }

    pub(crate) fn has_multiple_worker_modules(&self) -> bool {
        self.worker_module_names().len() > 1
    }

    #[cfg(feature = "kafka")]
    pub(crate) fn runs_kafka_workers(&self) -> bool {
        self.mode.enables(RuntimeIngressKind::Kafka)
    }

    #[cfg(feature = "sync")]
    pub(crate) fn runs_sync_workers(&self) -> bool {
        self.mode.enables(RuntimeIngressKind::Sync)
    }

    #[cfg(feature = "sync")]
    pub(crate) fn has_sync_worker_with_listener_modules(&self) -> bool {
        self.runs_sync_workers() && self.serves_http_listener()
    }
}

#[cfg(feature = "http")]
pub(crate) use http_listener::{serve_http_router, RuntimeHttpServerConfig};

#[cfg(feature = "http")]
mod http_listener {
    use std::{env, net::SocketAddr};

    use axum::Router;
    use tokio::net::TcpListener;
    use tracing::{error, info};

    use super::HostError;

    /// Where the HTTP listener binds. `API_HOST` defaults to loopback;
    /// `API_PORT` is mandatory.
    #[derive(Clone, Debug, Eq, PartialEq)]
    pub(crate) struct RuntimeHttpServerConfig {
        pub host: String,
        pub port: String,
    }

    impl RuntimeHttpServerConfig {
        pub(crate) fn from_env() -> Result<Self, HostError> {
            let host = env::var("API_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
            let port =
                env::var("API_PORT").map_err(|_| HostError::MissingEnv("API_PORT".to_string()))?;
            Ok(Self { host, port })
        }

        pub(crate) fn address(&self) -> String {
            format!("{}:{}", self.host, self.port)
        }

        pub(crate) fn socket_addr(&self) -> Result<SocketAddr, HostError> {
            let address = self.address();
            address
                .parse()
                .map_err(|source| HostError::InvalidSocketAddress { address, source })
        }
    }

    /// Binds the configured address and serves `router` until Ctrl-C or
    /// SIGTERM, then drains in-flight requests before returning.
    pub(crate) async fn serve_http_router(
        router: Router,
        config: &RuntimeHttpServerConfig,
    ) -> Result<(), HostError> {
        let address = config.address();
        let socket_addr = config.socket_addr()?;

        let listener = TcpListener::bind(socket_addr)
            .await
            .map_err(|source| HostError::Bind {
                address: address.clone(),
                source,
            })?;

        info!(addr = %address, "backend listening");

        let std_listener = listener.into_std().map_err(HostError::ConvertListener)?;

        axum::Server::from_tcp(std_listener)
            .map_err(|source| HostError::CreateServer(source.to_string()))?
            .serve(router.into_make_service())
            .with_graceful_shutdown(wait_for_shutdown_signal())
            .await
            .map_err(|source| HostError::Serve(source.to_string()))?;

        info!(addr = %address, "backend shut down");
        Ok(())
    }

    /// Resolves when the process is asked to stop, by Ctrl-C or (on unix)
    /// SIGTERM. A failure to install a handler is logged and that arm simply
    /// never fires.
    async fn wait_for_shutdown_signal() {
        let interrupt = async {
            if let Err(error) = tokio::signal::ctrl_c().await {
                error!(error = %error, "could not listen for Ctrl-C");
            }
        };

        #[cfg(unix)]
        let terminate = async {
            match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
                Ok(mut stream) => {
                    stream.recv().await;
                }
                Err(error) => {
                    error!(error = %error, "could not listen for SIGTERM");
                    std::future::pending::<()>().await;
                }
            }
        };

        #[cfg(not(unix))]
        let terminate = std::future::pending::<()>();

        tokio::select! {
            _ = interrupt => {}
            _ = terminate => {}
        }

        info!("shutdown signal received, draining in-flight requests");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(feature = "http")]
    #[test]
    fn ingress_kind_round_trips_through_str() {
        assert_eq!(RuntimeIngressKind::Http.as_str(), "http");
        assert_eq!(RuntimeIngressKind::Http.to_string(), "http");
        assert_eq!(
            "http".parse::<RuntimeIngressKind>().unwrap(),
            RuntimeIngressKind::Http
        );
    }

    #[cfg(feature = "http")]
    #[test]
    fn ingress_kind_accepts_aliases_case_insensitively() {
        for alias in ["http", "HTTP", " GraphQL ", "admin"] {
            assert_eq!(
                alias.parse::<RuntimeIngressKind>().unwrap(),
                RuntimeIngressKind::Http
            );
        }
    }

    #[test]
    fn ingress_kind_reports_a_disabled_feature_distinctly_from_an_unknown_token() {
        // `kafka` is a real transport name but its feature is off in this
        // build; `wat` is not a transport at all.
        match "kafka".parse::<RuntimeIngressKind>() {
            Err(HostError::ModuleFeatureDisabled("kafka")) => {}
            other => panic!("expected ModuleFeatureDisabled(\"kafka\"), got {other:?}"),
        }
        match "wat".parse::<RuntimeIngressKind>() {
            Err(HostError::InvalidMode(_)) => {}
            other => panic!("expected InvalidMode, got {other:?}"),
        }
    }

    #[cfg(feature = "http")]
    #[test]
    fn parse_mode_maps_keywords_and_aliases() {
        assert_eq!(
            RuntimeMode::parse_mode("http").unwrap(),
            RuntimeMode::http()
        );
        assert_eq!(
            RuntimeMode::parse_mode("  SERVE-HTTP ").unwrap(),
            RuntimeMode::http()
        );
        assert_eq!(RuntimeMode::parse_mode("all").unwrap(), RuntimeMode::all());
        assert_eq!(RuntimeMode::parse_mode("").unwrap(), RuntimeMode::all());
    }

    #[test]
    fn parse_mode_rejects_unknown_keywords() {
        match RuntimeMode::parse_mode("banana") {
            Err(HostError::InvalidMode(message)) => assert!(message.contains("banana")),
            other => panic!("expected InvalidMode, got {other:?}"),
        }
    }

    #[cfg(feature = "http")]
    #[test]
    fn parse_modules_reads_a_comma_list_and_dedupes() {
        let mode = RuntimeMode::parse_modules("http, http , graphql").unwrap();
        assert_eq!(mode, RuntimeMode::http());
    }

    #[test]
    fn parse_modules_rejects_an_empty_list() {
        match RuntimeMode::parse_modules("  , ,") {
            Err(HostError::InvalidMode(message)) => assert!(message.contains("at least one")),
            other => panic!("expected InvalidMode, got {other:?}"),
        }
    }

    #[cfg(feature = "http")]
    #[test]
    fn http_mode_serves_the_http_listener_and_names_its_module() {
        let mode = RuntimeMode::http();
        assert!(mode.enables(RuntimeIngressKind::Http));
        assert!(mode.enables_http_listener());
        assert_eq!(mode.module_names(), vec!["http"]);
    }

    #[cfg(feature = "http")]
    #[test]
    fn host_plan_over_http_has_no_worker_modules() {
        let plan = RuntimeHostPlan::new(RuntimeMode::http());
        assert!(plan.serves_http_listener());
        assert!(plan.worker_module_names().is_empty());
        assert!(!plan.has_unsupported_worker_modules());
        assert!(!plan.has_multiple_worker_modules());
        assert_eq!(plan.module_names(), vec!["http"]);
    }

    #[cfg(feature = "http")]
    #[test]
    fn http_server_config_defaults_host_and_requires_port() {
        // Exercised without touching process env: construct directly.
        let config = RuntimeHttpServerConfig {
            host: "0.0.0.0".to_string(),
            port: "8080".to_string(),
        };
        assert_eq!(config.address(), "0.0.0.0:8080");
        assert_eq!(
            config.socket_addr().unwrap(),
            "0.0.0.0:8080".parse::<std::net::SocketAddr>().unwrap()
        );

        let bad = RuntimeHttpServerConfig {
            host: "not a host".to_string(),
            port: "nope".to_string(),
        };
        assert!(matches!(
            bad.socket_addr(),
            Err(HostError::InvalidSocketAddress { .. })
        ));
    }

    #[cfg(feature = "http")]
    #[test]
    fn http_server_config_from_env_errors_without_a_port() {
        // API_PORT is unset in the test process; API_HOST likewise, so the
        // host should fall back to loopback and the missing port should be
        // the only failure.
        let previous_host = env::var("API_HOST").ok();
        let previous_port = env::var("API_PORT").ok();
        env::remove_var("API_HOST");
        env::remove_var("API_PORT");

        match RuntimeHttpServerConfig::from_env() {
            Err(HostError::MissingEnv(name)) => assert_eq!(name, "API_PORT"),
            other => panic!("expected MissingEnv(\"API_PORT\"), got {other:?}"),
        }

        if let Some(value) = previous_host {
            env::set_var("API_HOST", value);
        }
        if let Some(value) = previous_port {
            env::set_var("API_PORT", value);
        }
    }
}
