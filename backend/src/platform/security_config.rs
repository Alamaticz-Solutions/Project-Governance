//! Runtime security configuration, loaded once from environment variables at
//! process start. Independent reimplementation of
//! `appfw_runtime::security::SecurityConfig` (backend framework replacement
//! phase 7, slice 3 -- docs/architecture/self-owned-backend-plan.md).
//!
//! Not `http`-feature-gated: `main.rs` calls `SecurityConfig::from_env()`
//! and `.validate_runtime_safety()` before it knows whether this process
//! will serve HTTP at all, and `config/app_config.rs`'s RBAC-bypass checks
//! (`bypass_policies_in_local`/`allow_missing_policies_in_local`) are used
//! regardless of transport. The axum-dependent rate limiter that reads a
//! couple of these fields stays in `platform::security` (`http`-gated).
//!
//! Scoped down from the framework's version: the `chat`/`mcp`
//! feature-gated fields (`chat_enabled`, `mcp_enabled`, and their sibling
//! gate-configuration fields) are dropped entirely, matching this
//! product's own decision to delete `mcp`/`kafka`/`sync` outright (slice
//! 1) rather than port them -- this product never declared a `chat`
//! feature at all, and now never declares `mcp` either.

use std::env;

use crate::platform::errors::ConfigError;

#[derive(Clone, Debug)]
pub struct SecurityConfig {
    pub admin_ui_enabled: bool,
    pub admin_troubleshooting_enabled: bool,
    pub product_ui_enabled: bool,
    pub graphql_introspection_enabled: bool,
    pub graphql_introspection_required_roles: Vec<String>,
    pub graphql_introspection_required_scopes: Vec<String>,
    pub graphql_max_depth: usize,
    pub graphql_max_complexity: usize,
    pub request_body_limit_bytes: usize,
    pub rate_limit_per_second: u64,
    pub rate_limit_burst: u64,
}

impl SecurityConfig {
    pub fn from_env() -> Self {
        Self {
            admin_ui_enabled: env_bool("APP_ADMIN_UI_ENABLED", true),
            admin_troubleshooting_enabled: env_bool("APP_ADMIN_TROUBLESHOOTING_ENABLED", false),
            product_ui_enabled: env_bool("APP_PRODUCT_UI_ENABLED", true),
            graphql_introspection_enabled: env_bool(
                "APP_GRAPHQL_INTROSPECTION_ENABLED",
                is_dev_workstation_env(),
            ),
            graphql_introspection_required_roles: env_csv_or(
                "APP_GRAPHQL_INTROSPECTION_REQUIRED_ROLES",
                &["admin"],
            ),
            graphql_introspection_required_scopes: env_csv_or(
                "APP_GRAPHQL_INTROSPECTION_REQUIRED_SCOPES",
                &[
                    "developer",
                    "appfw:developer",
                    "appfw:graphql.introspection",
                ],
            ),
            graphql_max_depth: env_usize("APP_GRAPHQL_MAX_DEPTH", 12),
            graphql_max_complexity: env_usize("APP_GRAPHQL_MAX_COMPLEXITY", 500),
            request_body_limit_bytes: env_usize("APP_REQUEST_BODY_LIMIT_BYTES", 1024 * 1024),
            rate_limit_per_second: env_u64("APP_RATE_LIMIT_PER_SECOND", 100),
            rate_limit_burst: env_u64("APP_RATE_LIMIT_BURST", 100),
        }
    }

    pub fn validate_runtime_safety(&self) -> Result<(), ConfigError> {
        ensure_local_only_flag("APP_ALLOW_MISSING_POLICIES_IN_LOCAL")?;
        ensure_local_only_flag("APP_BYPASS_POLICIES_IN_LOCAL")?;

        if self.graphql_introspection_enabled {
            ensure_security_gate_configured(
                "GraphQL introspection",
                &self.graphql_introspection_required_roles,
                &self.graphql_introspection_required_scopes,
            )?;
        }

        if env_bool("APP_ENABLE_LOCAL_TEST_AUTH", false) && !Self::local_test_auth_enabled() {
            return Err(ConfigError::Load(
                "APP_ENABLE_LOCAL_TEST_AUTH is only allowed for ENV_NAME=local or compose provider certification CI"
                    .to_string(),
            ));
        }

        Ok(())
    }

    pub fn allow_missing_policies_in_local() -> bool {
        is_dev_workstation_env() && env_bool("APP_ALLOW_MISSING_POLICIES_IN_LOCAL", false)
    }

    pub fn bypass_policies_in_local() -> bool {
        is_dev_workstation_env() && env_bool("APP_BYPASS_POLICIES_IN_LOCAL", false)
    }

    pub fn local_test_auth_enabled() -> bool {
        env_bool("APP_ENABLE_LOCAL_TEST_AUTH", false)
            && (is_dev_workstation_env() || is_provider_certification_ci_env())
    }
}

/// True only when this process is running on a local developer workstation
/// (`ENV_NAME=local`). Gates developer-only conveniences that must never
/// activate in a managed environment.
pub(crate) fn is_dev_workstation_env() -> bool {
    env::var("ENV_NAME").map(|v| v == "local").unwrap_or(false)
}

fn is_provider_certification_ci_env() -> bool {
    env::var("ENV_NAME")
        .map(|v| v == "compose")
        .unwrap_or(false)
        && env_bool("APP_PROVIDER_CERTIFICATION_CI", false)
}

fn ensure_local_only_flag(name: &str) -> Result<(), ConfigError> {
    if env_bool(name, false) && !is_dev_workstation_env() {
        Err(ConfigError::Load(format!(
            "{name} is only allowed when ENV_NAME=local"
        )))
    } else {
        Ok(())
    }
}

fn ensure_security_gate_configured(
    label: &str,
    roles: &[String],
    scopes: &[String],
) -> Result<(), ConfigError> {
    if roles.is_empty() && scopes.is_empty() {
        Err(ConfigError::Load(format!(
            "{label} must configure at least one required role or scope"
        )))
    } else {
        Ok(())
    }
}

fn env_usize(name: &str, default: usize) -> usize {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(default)
}

fn env_u64(name: &str, default: u64) -> u64 {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(default)
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

fn env_csv_or(name: &str, default: &[&str]) -> Vec<String> {
    match env::var(name) {
        Ok(value) => value
            .split(',')
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string)
            .collect(),
        Err(_) => default.iter().map(|value| (*value).to_string()).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    fn with_env_lock<T>(f: impl FnOnce() -> T) -> T {
        let _guard = LOCK.get_or_init(|| Mutex::new(())).lock();
        f()
    }

    #[test]
    fn defaults_are_safe_out_of_the_box() {
        with_env_lock(|| {
            for name in [
                "APP_ADMIN_UI_ENABLED",
                "APP_ADMIN_TROUBLESHOOTING_ENABLED",
                "APP_PRODUCT_UI_ENABLED",
                "APP_GRAPHQL_INTROSPECTION_ENABLED",
                "ENV_NAME",
            ] {
                env::remove_var(name);
            }
            let config = SecurityConfig::from_env();
            assert!(config.admin_ui_enabled);
            assert!(!config.admin_troubleshooting_enabled);
            assert!(config.product_ui_enabled);
            assert!(!config.graphql_introspection_enabled);
            assert_eq!(config.graphql_max_depth, 12);
            assert_eq!(config.graphql_max_complexity, 500);
            assert_eq!(config.request_body_limit_bytes, 1024 * 1024);
        });
    }

    #[test]
    fn introspection_defaults_on_only_on_local_workstation() {
        with_env_lock(|| {
            env::remove_var("APP_GRAPHQL_INTROSPECTION_ENABLED");
            env::set_var("ENV_NAME", "local");
            assert!(SecurityConfig::from_env().graphql_introspection_enabled);

            env::set_var("ENV_NAME", "production");
            assert!(!SecurityConfig::from_env().graphql_introspection_enabled);
            env::remove_var("ENV_NAME");
        });
    }

    #[test]
    fn local_only_flags_are_rejected_outside_local() {
        with_env_lock(|| {
            env::remove_var("ENV_NAME");
            env::set_var("APP_BYPASS_POLICIES_IN_LOCAL", "true");
            let config = SecurityConfig::from_env();
            assert!(matches!(
                config.validate_runtime_safety(),
                Err(ConfigError::Load(message)) if message.contains("APP_BYPASS_POLICIES_IN_LOCAL")
            ));
            env::remove_var("APP_BYPASS_POLICIES_IN_LOCAL");
        });
    }

    #[test]
    fn local_only_flags_are_accepted_on_local_workstation() {
        with_env_lock(|| {
            env::set_var("ENV_NAME", "local");
            env::set_var("APP_BYPASS_POLICIES_IN_LOCAL", "true");
            let config = SecurityConfig::from_env();
            assert!(config.validate_runtime_safety().is_ok());
            assert!(SecurityConfig::bypass_policies_in_local());
            env::remove_var("APP_BYPASS_POLICIES_IN_LOCAL");
            env::remove_var("ENV_NAME");
        });
    }

    #[test]
    fn introspection_requires_a_role_or_scope_gate_when_enabled() {
        with_env_lock(|| {
            env::set_var("APP_GRAPHQL_INTROSPECTION_ENABLED", "true");
            env::set_var("APP_GRAPHQL_INTROSPECTION_REQUIRED_ROLES", "");
            env::set_var("APP_GRAPHQL_INTROSPECTION_REQUIRED_SCOPES", "");
            let config = SecurityConfig::from_env();
            assert!(config.validate_runtime_safety().is_err());
            env::remove_var("APP_GRAPHQL_INTROSPECTION_ENABLED");
            env::remove_var("APP_GRAPHQL_INTROSPECTION_REQUIRED_ROLES");
            env::remove_var("APP_GRAPHQL_INTROSPECTION_REQUIRED_SCOPES");
        });
    }
}
