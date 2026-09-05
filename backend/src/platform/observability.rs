//! Tracing/OpenTelemetry setup.
//!
//! Product-owned (backend framework replacement phase 4b-1 -- previously
//! `appfw_runtime::observability::{init_tracing, ObservabilityGuard}`).
//!
//! `RequestContext`, `current_request_context`, and `MetricsRegistry` are
//! deliberately NOT ported here despite living in the same framework module.
//! They cross the framework/product boundary at call sites this slice can't
//! safely move alone:
//!   - `admin_ui.rs` implements framework-defined traits from
//!     `appfw_runtime::admin` (`AdminPolicyExplainProvider`,
//!     `AdminAuditTimelineProvider`, `AdminQueryDiagnoseProvider`) whose
//!     method signatures take `&appfw_runtime::observability::RequestContext`
//!     -- that type is fixed by the framework's trait, not by us.
//!   - `routes/info.rs` passes `MetricsRegistry` by value into the
//!     framework's own `runtime_info_routes(...)`, which builds the
//!     `/metrics`/`/metrics.json` handlers around it internally.
//! Both must be ported together with `appfw_runtime::admin` (admin.rs,
//! ~2,463 lines -- not accounted for in the original phase 4 scoping table)
//! and the `host.rs`/`readiness.rs` info-route surface, or `DataAccess`'s
//! `metrics: MetricsRegistry` field and `admin_ui.rs`'s `&RequestContext`
//! parameters won't type-check against the framework's own router/trait
//! plumbing. Left as `appfw_runtime::observability::{RequestContext,
//! MetricsRegistry, current_request_context}` until that sub-phase.

use std::{env, error::Error, time::Duration};

use opentelemetry::{global, trace::TracerProvider as _, KeyValue};
use opentelemetry_otlp::{MetricExporter, SpanExporter};
use opentelemetry_sdk::metrics::SdkMeterProvider;
use opentelemetry_sdk::{propagation::TraceContextPropagator, trace::SdkTracerProvider, Resource};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

const DEFAULT_TRACING_FILTER: &str = "backend=info,appfw_runtime=info,tower_http=info";

#[derive(Clone, Debug)]
struct ObservabilityConfig {
    service_name: String,
    environment: String,
    json_logs: bool,
    otel_enabled: bool,
}

impl ObservabilityConfig {
    fn from_env() -> Self {
        let otel_enabled = env_bool("APP_OTEL_ENABLED", false);
        let service_name = env::var("OTEL_SERVICE_NAME")
            .or_else(|_| env::var("APP_SERVICE_NAME"))
            .unwrap_or_else(|_| "backend".to_string());
        let environment = env::var("ENV_NAME").unwrap_or_else(|_| "local".to_string());
        Self {
            service_name,
            environment,
            json_logs: env_bool("APP_LOG_JSON", false),
            otel_enabled,
        }
    }

    fn env_filter(&self) -> EnvFilter {
        EnvFilter::try_from_default_env()
            .or_else(|_| EnvFilter::try_new(default_filter_from_log_level()))
            .unwrap_or_else(|_| EnvFilter::new(DEFAULT_TRACING_FILTER))
    }
}

fn default_filter_from_log_level() -> String {
    let level = env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string());
    ["backend", "appfw_runtime", "tower_http"]
        .into_iter()
        .map(|target| format!("{target}={level}"))
        .collect::<Vec<_>>()
        .join(",")
}

fn env_bool(name: &str, default: bool) -> bool {
    env::var(name)
        .ok()
        .map(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(default)
}

#[derive(Default)]
pub struct ObservabilityGuard {
    tracer_provider: Option<SdkTracerProvider>,
    meter_provider: Option<SdkMeterProvider>,
}

impl ObservabilityGuard {
    pub fn shutdown(mut self) {
        self.shutdown_provider();
    }

    fn shutdown_provider(&mut self) {
        if let Some(provider) = self.meter_provider.take() {
            if let Err(error) = provider.shutdown_with_timeout(Duration::from_secs(5)) {
                eprintln!("failed to shutdown OpenTelemetry meter provider: {error}");
            }
        }
        if let Some(provider) = self.tracer_provider.take() {
            if let Err(error) = provider.shutdown_with_timeout(Duration::from_secs(5)) {
                eprintln!("failed to shutdown OpenTelemetry tracer provider: {error}");
            }
        }
    }
}

impl Drop for ObservabilityGuard {
    fn drop(&mut self) {
        self.shutdown_provider();
    }
}

pub fn init_tracing() -> ObservabilityGuard {
    let config = ObservabilityConfig::from_env();

    // OpenTelemetry is opt-in. Local logs remain the fallback so a broken OTLP
    // collector never prevents the backend from starting in development.
    if config.otel_enabled {
        match init_tracing_with_otel(&config) {
            Ok(guard) => return guard,
            Err(error) => {
                eprintln!(
                    "failed to initialize OpenTelemetry tracing; falling back to local logs: {error}"
                );
            }
        }
    }

    if let Err(error) = init_local_tracing(&config) {
        eprintln!("failed to initialize tracing subscriber: {error}");
    }
    ObservabilityGuard::default()
}

fn init_tracing_with_otel(
    config: &ObservabilityConfig,
) -> Result<ObservabilityGuard, Box<dyn Error + Send + Sync>> {
    global::set_text_map_propagator(TraceContextPropagator::new());

    let resource = Resource::builder()
        .with_service_name(config.service_name.clone())
        .with_attribute(KeyValue::new(
            "deployment.environment.name",
            config.environment.clone(),
        ))
        .build();
    let exporter = SpanExporter::builder().build()?;
    let tracer_provider = SdkTracerProvider::builder()
        .with_resource(resource.clone())
        .with_batch_exporter(exporter)
        .build();
    global::set_tracer_provider(tracer_provider.clone());

    let metric_exporter = MetricExporter::builder().build()?;
    let meter_provider = SdkMeterProvider::builder()
        .with_resource(resource)
        .with_periodic_exporter(metric_exporter)
        .build();
    global::set_meter_provider(meter_provider.clone());

    let tracer = tracer_provider.tracer("backend");
    let telemetry_layer = tracing_opentelemetry::layer().with_tracer(tracer);
    let env_filter = config.env_filter();

    if config.json_logs {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(telemetry_layer)
            .with(fmt::layer().json().with_target(true))
            .try_init()?;
    } else {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(telemetry_layer)
            .with(fmt::layer().compact().with_target(true))
            .try_init()?;
    }

    Ok(ObservabilityGuard {
        tracer_provider: Some(tracer_provider),
        meter_provider: Some(meter_provider),
    })
}

fn init_local_tracing(config: &ObservabilityConfig) -> Result<(), Box<dyn Error + Send + Sync>> {
    let env_filter = config.env_filter();

    if config.json_logs {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(fmt::layer().json().with_target(true))
            .try_init()?;
    } else {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(fmt::layer().compact().with_target(true))
            .try_init()?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::OnceLock;

    fn env_lock() -> std::sync::MutexGuard<'static, ()> {
        static LOCK: OnceLock<std::sync::Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| std::sync::Mutex::new(()))
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    #[test]
    fn observability_config_uses_safe_local_defaults() {
        let _lock = env_lock();
        env::remove_var("APP_OTEL_ENABLED");
        env::remove_var("APP_LOG_JSON");
        env::remove_var("APP_SERVICE_NAME");
        env::remove_var("OTEL_SERVICE_NAME");
        env::remove_var("ENV_NAME");

        let config = ObservabilityConfig::from_env();

        assert_eq!(config.service_name, "backend");
        assert_eq!(config.environment, "local");
        assert!(!config.json_logs);
        assert!(!config.otel_enabled);
    }

    #[test]
    fn log_level_fallback_includes_runtime_and_tower_targets() {
        let _lock = env_lock();
        let prior = env::var("LOG_LEVEL").ok();
        env::set_var("LOG_LEVEL", "warn");

        let filter = default_filter_from_log_level();

        assert!(filter.contains("backend=warn"));
        assert!(filter.contains("appfw_runtime=warn"));
        assert!(filter.contains("tower_http=warn"));

        if let Some(value) = prior {
            env::set_var("LOG_LEVEL", value);
        } else {
            env::remove_var("LOG_LEVEL");
        }
    }
}
