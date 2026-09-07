use crate::platform::runtime::security::SecurityConfig;
// Product-owned (backend framework replacement phase 4 -- previously
// `appfw_runtime::cors`/`observability`/`auth`/`host`).
use dotenv::dotenv;
#[cfg(feature = "http")]
use platform::auth::JwtAuthConfig;
#[cfg(feature = "http")]
use platform::cors;
#[cfg(feature = "http")]
use platform::host::RuntimeHttpServerConfig;
use platform::host::{RuntimeHostPlan, RuntimeMode};
use platform::observability::init_tracing;
#[cfg(feature = "http")]
use std::sync::Arc;
use tracing::error;
#[cfg(feature = "http")]
use tracing::info;

#[cfg(feature = "http")]
mod admin_ui;
mod config;
mod data;
mod handlers;
mod platform;
mod product_api;
mod routes;
mod schemas;
mod services;

#[cfg(feature = "http")]
use config::app_config::AppConfig;
#[cfg(feature = "http")]
use routes::get_routes;

/// Tokio worker-thread stack size, in MiB, when `BACKEND_WORKER_STACK_MIB`
/// is unset or unparseable. See [`main`] for why this is not the 2 MiB
/// tokio default.
const DEFAULT_WORKER_STACK_MIB: usize = 128;

/// Resolve the tokio worker-thread stack size (bytes) from
/// `BACKEND_WORKER_STACK_MIB`, falling back to [`DEFAULT_WORKER_STACK_MIB`].
fn worker_stack_bytes() -> usize {
    let mib = std::env::var("BACKEND_WORKER_STACK_MIB")
        .ok()
        .and_then(|raw| raw.trim().parse::<usize>().ok())
        .filter(|mib| *mib > 0)
        .unwrap_or(DEFAULT_WORKER_STACK_MIB);
    mib * 1024 * 1024
}

/// Entry point. Deliberately NOT `#[tokio::main]`: the self-owned
/// `platform::host` that replaced `appfw_runtime` (backend framework
/// replacement phase 7 final cutover) never re-established the larger
/// worker-thread stack the old framework host ran with, so worker threads
/// got tokio's 2 MiB default. The phase-7-ported self-owned read path
/// (read-orchestration -> projection resolvers -> filter-IR -> regorus
/// eval) recurses deeply enough on a real query to overflow 2 MiB and
/// abort the whole process (`thread 'tokio-rt-worker' has overflowed its
/// stack`) -- deep, not infinite, recursion (it completes with
/// `RUST_MIN_STACK=128MiB`). Until that recursion is flattened this builds
/// the multi-thread runtime by hand with a generous, env-overridable
/// worker stack. `thread_stack_size` is reserved address space committed
/// lazily by the OS, not resident memory, so a large value is cheap.
fn main() {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .thread_stack_size(worker_stack_bytes())
        .build()
        .expect("failed to build tokio runtime");
    runtime.block_on(run());
}

async fn run() {
    dotenv().ok();
    let observability_guard = init_tracing();
    let security = SecurityConfig::from_env();
    if let Err(e) = security.validate_runtime_safety() {
        error!(error = %e, "unsafe security configuration");
        std::process::exit(1);
    }

    let runtime_mode = match RuntimeMode::from_env() {
        Ok(mode) => mode,
        Err(e) => {
            error!(error = %e, "invalid runtime mode configuration");
            std::process::exit(1);
        }
    };
    let host_plan = RuntimeHostPlan::new(runtime_mode);

    if host_plan.has_multiple_worker_modules() {
        error!(
            modules = ?host_plan.module_names(),
            workers = ?host_plan.worker_module_names(),
            "multiple runtime worker modules are selected; run one worker mode per process until a worker supervisor is available"
        );
        observability_guard.shutdown();
        std::process::exit(1);
    }

    if host_plan.has_unsupported_worker_modules() {
        error!(
            modules = ?host_plan.module_names(),
            workers = ?host_plan.worker_module_names(),
            "this product backend does not yet provide runtime worker modules"
        );
        observability_guard.shutdown();
        std::process::exit(1);
    }

    #[cfg(feature = "http")]
    if host_plan.serves_http_listener() {
        let app_config = match AppConfig::init().await {
            Ok(config) => Arc::new(config),
            Err(e) => {
                error!(error = %e, "failed to initialize app config");
                std::process::exit(1);
            }
        };
        let jwt_auth = match JwtAuthConfig::from_env() {
            Ok(config) => config,
            Err(e) => {
                error!(error = %e, "failed to initialize JWT auth configuration");
                std::process::exit(1);
            }
        };

        info!(auth_configured = true, "Okta configuration loaded");

        let cors = cors::get();

        let routes = match get_routes(
            cors,
            app_config.clone(),
            jwt_auth,
            security,
            host_plan.mode().clone(),
        )
        .await
        {
            Ok(routes) => routes,
            Err(e) => {
                error!(error = %e, "failed to build routes");
                std::process::exit(1);
            }
        };

        let http_config = match RuntimeHttpServerConfig::from_env() {
            Ok(config) => config,
            Err(e) => {
                error!(error = %e, "invalid HTTP server configuration");
                std::process::exit(1);
            }
        };

        if let Err(e) = platform::host::serve_http_router(routes, &http_config).await {
            error!(error = %e, "backend runtime host error");
            std::process::exit(1);
        }

        observability_guard.shutdown();
        return;
    }

    error!(
        modules = ?host_plan.module_names(),
        "this product backend has no enabled runtime ingress modules it can host"
    );
    observability_guard.shutdown();
    std::process::exit(1);
}
