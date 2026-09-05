//! Bearer-token authentication for the GraphQL ingress: resolving an
//! `Authorization` header into a `UserAuth`, either via real RS256
//! verification against an OIDC-style issuer or (local development / opted-in
//! CI only) a deterministic test-user shorthand.
//!
//! Product-owned (backend framework replacement phase 4b-4). Designed
//! independently against a behavior specification -- not derived from
//! framework source.
//!
//! `UserAuth` (`platform::user_auth`) is product-owned as of backend
//! framework replacement phase 5. This module constructs it directly via its
//! own `UserAuth::human(..)` constructor.
//!
//! Kept framework-owned, deliberately NOT redefined here:
//!   - `appfw_runtime::RuntimeJwtExtractor` -- a plain
//!     `{ user: Option<Arc<appfw_runtime::extension::UserAuth>> }` holder
//!     that `appfw_runtime::user_from_graphql_context` (used throughout
//!     `backend/src/product_api.rs` and every generated resolver via
//!     `product_api::user_from_context`) looks up by concrete type from the
//!     async-graphql request context. Redefining this type would silently
//!     break every resolver that reads the current user. This module
//!     computes the product-owned `UserAuth` value; the caller
//!     (`platform::graphql_gateway`) converts it to the framework's own
//!     `UserAuth` and builds the framework struct literal around it.
//!   - `RuntimeError` -- the shared failure enum for `NotAuthorized` /
//!     `AccessDenied`; reused as-is, not reimplemented.
//!
//! `IxJwtVerifier` and the rest of `auth.rs`'s `#[cfg(feature = "chat")]`
//! surface, and all of `delegated_auth.rs` (OAuth delegated-token exchange,
//! SaaS write idempotency/certification -- zero references anywhere in
//! `backend/src`), are dropped entirely rather than ported: `chat` is never
//! forwarded to `appfw_runtime` by this product's `Cargo.toml`, and nothing
//! here ever calls into the delegated-auth surface.

use std::{collections::HashSet, sync::Arc};

use appfw_runtime::{ConfigError, RuntimeError};
use axum::http::HeaderMap;
use okta_jwt_verifier::Verifier;
use serde_json::Value;

use crate::platform::user_auth::UserAuth;
use tracing::warn;

use crate::platform::security::is_dev_workstation_env;

const LOCAL_TEST_TOKEN_PREFIX: &str = "appfw-local:";
const DEFAULT_AUDIENCE: &str = "api://default";

/// The three OIDC-style values needed to verify a bearer token: which issuer
/// signed it, which audience it must be scoped to, and which client it must
/// have been issued to.
#[derive(Clone, Debug)]
pub(crate) struct JwtAuthConfig {
    pub issuer: String,
    pub audience: String,
    pub client_id: String,
}

impl JwtAuthConfig {
    pub(crate) fn from_env() -> Result<Self, ConfigError> {
        Ok(Self {
            issuer: require_env("OKTA_ISSUER")?,
            audience: std::env::var("OKTA_AUDIENCE").unwrap_or_else(|_| DEFAULT_AUDIENCE.into()),
            client_id: require_env("OKTA_CLIENT_ID")?,
        })
    }
}

fn require_env(name: &str) -> Result<String, ConfigError> {
    std::env::var(name)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| ConfigError::MissingEnvVar { name: name.into() })
}

/// Resolves the caller's identity for one request. Returns `None` only for
/// an anonymous request in an environment that permits one (local dev with
/// no bearer token at all); every other outcome is either `Some(user)` or a
/// rejection.
pub(crate) async fn resolve_user(
    config: &JwtAuthConfig,
    headers: &HeaderMap,
) -> Result<Option<Arc<UserAuth>>, RuntimeError> {
    let bearer = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");

    let local_dev = is_dev_workstation_env();
    let ci_test_auth_allowed = local_test_auth_allowed();

    if bearer.is_empty() && !local_dev {
        return Err(RuntimeError::NotAuthorized);
    }

    let timezone = resolve_timezone(headers);

    if local_dev {
        return Ok(Some(Arc::new(match local_test_user(bearer, &timezone)? {
            Some(user) => user,
            None => local_admin_user(bearer, &timezone),
        })));
    }

    if ci_test_auth_allowed {
        if let Some(user) = local_test_user(bearer, &timezone)? {
            warn!("accepted a local test-auth token outside local development");
            return Ok(Some(Arc::new(user)));
        }
    }

    verify_bearer(bearer, config, &timezone)
        .await
        .map(|user| Some(Arc::new(user)))
}

/// `APP_ENABLE_LOCAL_TEST_AUTH` opts a non-local environment into accepting
/// the `appfw-local:` shorthand token instead of real verification. This
/// must never be a passive/implicit CI detection (e.g. a generic `CI=true`
/// check) -- it's a security-relevant bypass, so it requires both the
/// explicit opt-in flag AND a deliberate, product-specific certification-run
/// marker (`APP_PROVIDER_CERTIFICATION_CI`), never a workstation.
fn local_test_auth_allowed() -> bool {
    env_flag("APP_ENABLE_LOCAL_TEST_AUTH") && (is_dev_workstation_env() || certification_run())
}

fn certification_run() -> bool {
    env_flag("APP_PROVIDER_CERTIFICATION_CI")
}

fn env_flag(name: &str) -> bool {
    std::env::var(name)
        .map(|value| matches!(value.to_ascii_lowercase().as_str(), "1" | "true" | "yes"))
        .unwrap_or(false)
}

fn resolve_timezone(headers: &HeaderMap) -> String {
    ["x-timezone", "timezone"]
        .into_iter()
        .find_map(|name| headers.get(name)?.to_str().ok())
        .and_then(|raw| raw.parse::<chrono_tz::Tz>().ok())
        .map(|tz| tz.to_string())
        .unwrap_or_else(|| chrono_tz::UTC.to_string())
}

/// The fixed local-development identity: full admin access, used whenever no
/// `appfw-local:` shorthand token is present on a local-dev request.
fn local_admin_user(token: &str, timezone: &str) -> UserAuth {
    UserAuth::human(
        "local",
        "local-dev",
        timezone.to_string(),
        vec!["admin".to_string()],
        vec!["appfw:mcp".to_string(), "appfw:mcp.admin".to_string()],
        token.to_string(),
    )
}

/// Parses `Bearer appfw-local:tenant=..;user=..;roles=..;scopes=..` into a
/// deterministic test user, without touching real JWT verification. Returns
/// `Ok(None)` for anything that isn't shaped like this scheme at all (a real
/// external JWT, or no `Authorization` header) so callers fall through to
/// their next option; returns `Err` only once the token has committed to
/// being a local-test token but is malformed -- fail closed rather than
/// silently ignore an unrecognized directive.
fn local_test_user(authorization: &str, timezone: &str) -> Result<Option<UserAuth>, RuntimeError> {
    let Some(token) = authorization.trim().strip_prefix("Bearer ") else {
        return Ok(None);
    };
    let token = token.trim();
    let Some(directives) = token.strip_prefix(LOCAL_TEST_TOKEN_PREFIX) else {
        return Ok(None);
    };

    let mut tenant_id: Option<String> = None;
    let mut user_name: Option<String> = None;
    let mut roles: Option<Vec<String>> = None;
    let mut scopes: Vec<String> = Vec::new();

    for directive in directives
        .split(';')
        .map(str::trim)
        .filter(|d| !d.is_empty())
    {
        let (key, value) = directive
            .split_once('=')
            .ok_or(RuntimeError::NotAuthorized)?;
        let value = value.trim();
        match key.trim() {
            "tenant" => tenant_id = Some(value.to_string()),
            "user" => user_name = Some(value.to_string()),
            "roles" => roles = Some(csv_list(value)),
            "scopes" | "scp" => scopes = csv_list(value),
            _ => return Err(RuntimeError::NotAuthorized),
        }
    }

    let tenant_id = non_empty(tenant_id).ok_or(RuntimeError::NotAuthorized)?;
    let user_name = non_empty(user_name).ok_or(RuntimeError::NotAuthorized)?;
    let roles = roles
        .filter(|list| !list.is_empty())
        .ok_or(RuntimeError::NotAuthorized)?;

    Ok(Some(UserAuth::human(
        tenant_id,
        user_name,
        timezone.to_string(),
        roles,
        scopes.drain(..).collect(),
        token.to_string(),
    )))
}

fn csv_list(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .map(str::to_string)
        .collect()
}

fn non_empty(value: Option<String>) -> Option<String> {
    value.filter(|v| !v.is_empty())
}

/// Real verification: fetches the issuer's signing keys, checks the token's
/// signature/issuer/audience/client-id/expiry, and builds a `UserAuth` from
/// its claims.
async fn verify_bearer(
    authorization: &str,
    config: &JwtAuthConfig,
    timezone: &str,
) -> Result<UserAuth, RuntimeError> {
    let token = authorization
        .trim()
        .strip_prefix("Bearer ")
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .ok_or(RuntimeError::NotAuthorized)?;

    let mut audience = HashSet::new();
    audience.insert(config.audience.clone());

    let verifier = Verifier::new(&config.issuer).await.map_err(|error| {
        warn!(error = %error, "failed to build JWT verifier for the configured issuer");
        RuntimeError::NotAuthorized
    })?;

    let verified = verifier
        .client_id(&config.client_id)
        .audience(audience)
        .verify::<Value>(token)
        .await
        .map_err(|error| {
            warn!(error = %error, "bearer token failed verification");
            RuntimeError::NotAuthorized
        })?;

    let claims = verified
        .claims
        .as_object()
        .ok_or(RuntimeError::NotAuthorized)?;

    let tenant_id = claim_str(claims, "company");
    let subject = claim_str(claims, "sub");
    let roles = claim_str_array(claims, "groups");
    let scopes = claim_space_delimited(claims, "scp");

    Ok(UserAuth::human(
        tenant_id,
        subject,
        timezone.to_string(),
        roles,
        scopes,
        token.to_string(),
    ))
}

fn claim_str(claims: &serde_json::Map<String, Value>, key: &str) -> String {
    claims
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn claim_str_array(claims: &serde_json::Map<String, Value>, key: &str) -> Vec<String> {
    claims
        .get(key)
        .and_then(Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .map(String::from)
                .collect()
        })
        .unwrap_or_default()
}

/// The `scp` claim is a single space-delimited string (standard OAuth2
/// scope-claim shape), not a JSON array and not comma-delimited.
fn claim_space_delimited(claims: &serde_json::Map<String, Value>, key: &str) -> Vec<String> {
    claims
        .get(key)
        .and_then(Value::as_str)
        .map(|value| value.split(' ').map(String::from).collect())
        .unwrap_or_default()
}

/// Gate on `{ __schema }` / `{ __type }` introspection queries: only an
/// authenticated caller whose roles or scopes match the configured
/// allow-list may introspect, and only when introspection is enabled at
/// all.
pub(crate) fn authorize_introspection(
    security: &appfw_runtime::security::SecurityConfig,
    user: Option<&UserAuth>,
) -> Result<(), RuntimeError> {
    if !security.graphql_introspection_enabled {
        return Err(RuntimeError::NotAuthorized);
    }
    let user = user.ok_or(RuntimeError::NotAuthorized)?;
    let role_match = security
        .graphql_introspection_required_roles
        .iter()
        .any(|required| user.roles.iter().any(|role| role == required));
    let scope_match = security
        .graphql_introspection_required_scopes
        .iter()
        .any(|required| user.scopes.iter().any(|scope| scope == required));
    if role_match || scope_match {
        Ok(())
    } else {
        Err(RuntimeError::AccessDenied)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers_with_auth(value: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::AUTHORIZATION,
            value.parse().expect("valid header value"),
        );
        headers
    }

    #[test]
    fn local_test_user_builds_non_admin_identity() {
        let user = local_test_user(
            "Bearer appfw-local:user=casey;tenant=tenant-1;roles=account_ca_reader,analyst",
            "UTC",
        )
        .expect("parses")
        .expect("produces a user");

        assert_eq!(user.user_name, "casey");
        assert_eq!(user.tenant_id, "tenant-1");
        assert_eq!(user.roles, vec!["account_ca_reader", "analyst"]);
        assert_eq!(user.timezone, "UTC");
        assert!(user.scopes.is_empty());
    }

    #[test]
    fn local_test_user_reads_scopes_key() {
        let user = local_test_user(
            "Bearer appfw-local:user=casey;tenant=t1;roles=analyst;scopes=appfw:mcp.read,appfw:mcp.admin",
            "UTC",
        )
        .expect("parses")
        .expect("produces a user");

        assert_eq!(user.scopes, vec!["appfw:mcp.read", "appfw:mcp.admin"]);
    }

    #[test]
    fn local_test_user_accepts_scp_alias() {
        let user = local_test_user(
            "Bearer appfw-local:user=casey;tenant=t1;roles=analyst;scp=appfw:mcp.read",
            "UTC",
        )
        .expect("parses")
        .expect("produces a user");

        assert_eq!(user.scopes, vec!["appfw:mcp.read"]);
    }

    #[test]
    fn non_bearer_authorization_is_not_a_local_test_token() {
        let result = local_test_user("appfw-local:user=casey;tenant=t1;roles=analyst", "UTC")
            .expect("not malformed, just not this scheme");
        assert!(result.is_none());
    }

    #[test]
    fn external_bearer_tokens_pass_through_untouched() {
        let result = local_test_user("Bearer some.external.jwt", "UTC").expect("not malformed");
        assert!(result.is_none());
    }

    #[test]
    fn unrecognized_directive_fails_closed() {
        let result = local_test_user(
            "Bearer appfw-local:user=casey;tenant=t1;roles=analyst;unknown=x",
            "UTC",
        );
        assert!(matches!(result, Err(RuntimeError::NotAuthorized)));
    }

    #[test]
    fn missing_equals_sign_fails_closed() {
        let result = local_test_user("Bearer appfw-local:user", "UTC");
        assert!(matches!(result, Err(RuntimeError::NotAuthorized)));
    }

    #[test]
    fn claim_str_array_reads_groups_not_roles() {
        let claims: serde_json::Map<String, Value> = serde_json::json!({
            "roles": ["should-not-be-used"],
            "groups": ["admin", "analyst"],
        })
        .as_object()
        .unwrap()
        .clone();

        assert_eq!(claim_str_array(&claims, "groups"), vec!["admin", "analyst"]);
    }

    #[test]
    fn claim_space_delimited_splits_scp_on_spaces() {
        let claims: serde_json::Map<String, Value> = serde_json::json!({
            "scp": "appfw:mcp appfw:mcp.admin",
        })
        .as_object()
        .unwrap()
        .clone();

        assert_eq!(
            claim_space_delimited(&claims, "scp"),
            vec!["appfw:mcp", "appfw:mcp.admin"]
        );
    }

    #[test]
    fn resolve_timezone_falls_back_to_utc() {
        let headers = HeaderMap::new();
        assert_eq!(resolve_timezone(&headers), "UTC");
    }

    #[test]
    fn resolve_timezone_reads_a_valid_iana_zone() {
        let mut headers = HeaderMap::new();
        headers.insert("x-timezone", "America/New_York".parse().unwrap());
        assert_eq!(resolve_timezone(&headers), "America/New_York");
    }

    #[test]
    fn resolve_timezone_ignores_garbage_and_falls_back() {
        let mut headers = HeaderMap::new();
        headers.insert("timezone", "not-a-zone".parse().unwrap());
        assert_eq!(resolve_timezone(&headers), "UTC");
    }

    #[test]
    fn local_test_auth_requires_explicit_opt_in_flag_not_bare_ci() {
        // A bare CI=true must never be sufficient on its own to enable the
        // local-test-auth bypass outside a developer workstation.
        std::env::remove_var("APP_ENABLE_LOCAL_TEST_AUTH");
        std::env::remove_var("APP_PROVIDER_CERTIFICATION_CI");
        std::env::set_var("CI", "true");
        assert!(!local_test_auth_allowed());
        std::env::remove_var("CI");
    }

    #[tokio::test]
    async fn resolve_user_rejects_missing_bearer_outside_local_dev() {
        // Only meaningful when ENV_NAME isn't "local" in this process; the
        // container-based live probes (see phase4b-baseline/baseline.md)
        // cover the ENV_NAME=local case end-to-end already.
        if is_dev_workstation_env() {
            return;
        }
        let config = JwtAuthConfig {
            issuer: "http://127.0.0.1:1/unused".to_string(),
            audience: "api://test".to_string(),
            client_id: "test-client".to_string(),
        };
        let result = resolve_user(&config, &HeaderMap::new()).await;
        assert!(matches!(result, Err(RuntimeError::NotAuthorized)));
    }

    #[tokio::test]
    async fn resolve_user_rejects_garbage_bearer_when_verification_is_unreachable() {
        if is_dev_workstation_env() {
            return;
        }
        let config = JwtAuthConfig {
            issuer: "http://127.0.0.1:1/unused".to_string(),
            audience: "api://test".to_string(),
            client_id: "test-client".to_string(),
        };
        let result = resolve_user(&config, &headers_with_auth("Bearer garbage.token.value")).await;
        assert!(matches!(result, Err(RuntimeError::NotAuthorized)));
    }
}
