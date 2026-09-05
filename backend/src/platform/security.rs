//! Request-level rate limiting for the HTTP ingress layer.
//!
//! Product-owned (backend framework replacement phase 4b-2). Designed
//! independently against a behavior specification, not derived from
//! framework source. `SecurityConfig` itself stays framework-owned -- see
//! `platform::routing`'s doc comment for why.

use std::{num::NonZeroU32, sync::Arc};

use axum::{
    extract::State,
    http::{header, HeaderMap, Request, StatusCode},
    middleware::Next,
    response::Response,
};
use governor::{DefaultKeyedRateLimiter, Quota, RateLimiter};
use sha2::{Digest, Sha256};

/// Shared per-key token-bucket limiter, cloned into axum's middleware state.
#[derive(Clone)]
pub(crate) struct RateLimiterState {
    buckets: Arc<DefaultKeyedRateLimiter<String>>,
}

impl RateLimiterState {
    pub(crate) fn new(limit_per_second: u64, burst: u64) -> Self {
        let sustained = clamp_to_nonzero(limit_per_second);
        let peak = clamp_to_nonzero(burst.max(limit_per_second));
        let quota = Quota::per_second(sustained).allow_burst(peak);
        Self {
            buckets: Arc::new(RateLimiter::keyed(quota)),
        }
    }

    fn allow_key(&self, key: &str) -> bool {
        self.buckets.check_key(&key.to_owned()).is_ok()
    }
}

/// Axum middleware: rejects with 429 once the caller's bucket is empty.
pub(crate) async fn rate_limit_hook<B>(
    State(limiter): State<RateLimiterState>,
    request: Request<B>,
    next: Next<B>,
) -> Result<Response, StatusCode> {
    let key = rate_limit_key(&request);
    if limiter.allow_key(&key) {
        Ok(next.run(request).await)
    } else {
        Err(StatusCode::TOO_MANY_REQUESTS)
    }
}

/// Derives a stable per-caller bucket key. Order matters: prefer identity
/// signals that distinguish real callers sitting behind a shared NAT/proxy
/// over a bare IP, and never let a raw bearer token enter the key space.
fn rate_limit_key<B>(request: &Request<B>) -> String {
    let headers = request.headers();
    let extractors: [fn(&HeaderMap) -> Option<String>; 4] = [
        tenant_identity,
        authorization_identity,
        forwarded_client_ip,
        direct_client_ip,
    ];

    extractors
        .iter()
        .find_map(|extract| extract(headers))
        .unwrap_or_else(|| format!("path:{}", request.uri().path()))
}

fn tenant_identity(headers: &HeaderMap) -> Option<String> {
    trimmed_header(headers, "x-tenant-id").map(|value| format!("tenant:{}", lowercase(&value)))
}

fn authorization_identity(headers: &HeaderMap) -> Option<String> {
    trimmed_header(headers, header::AUTHORIZATION.as_str())
        .map(|token| format!("auth:{}", fingerprint(&token)))
}

fn forwarded_client_ip(headers: &HeaderMap) -> Option<String> {
    let chain = trimmed_header(headers, "x-forwarded-for")?;
    let first_hop = chain.split(',').next().unwrap_or(&chain).trim();
    if first_hop.is_empty() {
        None
    } else {
        Some(format!("ip:{}", lowercase(first_hop)))
    }
}

fn direct_client_ip(headers: &HeaderMap) -> Option<String> {
    trimmed_header(headers, "x-real-ip").map(|ip| format!("ip:{}", lowercase(&ip)))
}

fn trimmed_header(headers: &HeaderMap, name: &str) -> Option<String> {
    let value = headers.get(name)?.to_str().ok()?.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_owned())
    }
}

fn lowercase(value: &str) -> String {
    value.to_ascii_lowercase()
}

/// One-way fingerprint so the limiter's key space never retains a usable
/// bearer token.
fn fingerprint(value: &str) -> String {
    Sha256::digest(value.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn clamp_to_nonzero(value: u64) -> NonZeroU32 {
    NonZeroU32::new(value.clamp(1, u32::MAX as u64) as u32).expect("clamped to at least 1")
}

/// True only when this process is running on a local developer workstation
/// (`ENV_NAME=local`). Gates developer-only conveniences that must never
/// activate in a managed environment.
///
/// Unused today -- a precursor for the JWT-verification/local-auth-bypass
/// phase that follows this one.
#[allow(dead_code)]
pub(crate) fn is_dev_workstation_env() -> bool {
    std::env::var("ENV_NAME").is_ok_and(|value| value == "local")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn governor_limiter_is_keyed() {
        let limiter = RateLimiterState::new(1, 1);

        assert!(limiter.allow_key("tenant:a"));
        assert!(!limiter.allow_key("tenant:a"));
        assert!(limiter.allow_key("tenant:b"));
    }

    #[test]
    fn rate_limit_key_prefers_stable_identity_sources() {
        let request = Request::builder()
            .uri("/crm")
            .header("authorization", "Bearer abc")
            .body(())
            .expect("request");
        let key = rate_limit_key(&request);
        assert!(key.starts_with("auth:"));
        assert!(!key.contains("abc"));

        let request = Request::builder()
            .uri("/crm")
            .header("x-tenant-id", "Tenant-1")
            .header("authorization", "Bearer abc")
            .body(())
            .expect("request");
        assert_eq!(rate_limit_key(&request), "tenant:tenant-1");
    }

    #[test]
    fn dev_workstation_env_requires_exact_local_value() {
        use std::sync::{Mutex, OnceLock};
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        let _guard = LOCK.get_or_init(|| Mutex::new(())).lock();
        let prior = std::env::var("ENV_NAME").ok();

        std::env::set_var("ENV_NAME", "local");
        assert!(is_dev_workstation_env());

        std::env::set_var("ENV_NAME", "compose");
        assert!(!is_dev_workstation_env());

        match prior {
            Some(value) => std::env::set_var("ENV_NAME", value),
            None => std::env::remove_var("ENV_NAME"),
        }
    }
}
