//! Env-var auth contract + redaction constants + client-credentials token
//! acquisition (ADR 0018: credential *delivery* is a platform precondition,
//! not framework-generated).

use std::env;
use std::time::{Duration, Instant};

use tokio::sync::RwLock;

/// The complete env-var contract. No other Graph env var is read anywhere.
pub const ENV_TENANT_ID: &str = "GRAPH_TENANT_ID";
pub const ENV_CLIENT_ID: &str = "GRAPH_CLIENT_ID";
pub const ENV_CLIENT_SECRET: &str = "GRAPH_CLIENT_SECRET";
pub const ENV_DEFAULT_ORGANIZER_ID: &str = "GRAPH_DEFAULT_ORGANIZER_ID";
pub const ENV_NOTIFICATION_CLIENT_STATE: &str = "GRAPH_NOTIFICATION_CLIENT_STATE";

/// Values that must never be logged, echoed in payloads, or serialized.
pub const REDACTION_CONSTANTS: &[&str] = &[ENV_CLIENT_SECRET, ENV_NOTIFICATION_CLIENT_STATE];

pub const SCOPE: &str = "https://graph.microsoft.com/.default";

#[derive(Clone, Debug)]
pub struct GraphAuthConfig {
    pub tenant_id: String,
    pub client_id: String,
    client_secret: String,
    pub default_organizer_id: String,
}

impl GraphAuthConfig {
    /// Read the contract from the environment. Returns `None` when the provider
    /// is not configured (no tenant / client / secret / organizer).
    pub fn from_env() -> Option<Self> {
        let tenant_id = env::var(ENV_TENANT_ID).ok().filter(|s| !s.is_empty())?;
        let client_id = env::var(ENV_CLIENT_ID).ok().filter(|s| !s.is_empty())?;
        let client_secret = env::var(ENV_CLIENT_SECRET).ok().filter(|s| !s.is_empty())?;
        let default_organizer_id = env::var(ENV_DEFAULT_ORGANIZER_ID)
            .ok()
            .filter(|s| !s.is_empty())?;
        Some(Self {
            tenant_id,
            client_id,
            client_secret,
            default_organizer_id,
        })
    }

    pub fn notification_client_state() -> Option<String> {
        env::var(ENV_NOTIFICATION_CLIENT_STATE)
            .ok()
            .filter(|s| !s.is_empty())
    }

    fn token_url(&self) -> String {
        format!(
            "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
            self.tenant_id
        )
    }
}

struct Cached {
    token: String,
    fetched_at: Instant,
    ttl: Duration,
}

/// Single-flight cached app-only token.
pub struct GraphToken {
    cfg: GraphAuthConfig,
    http: reqwest::Client,
    cache: RwLock<Option<Cached>>,
}

impl GraphToken {
    pub fn new(cfg: GraphAuthConfig, http: reqwest::Client) -> Self {
        Self {
            cfg,
            http,
            cache: RwLock::new(None),
        }
    }

    pub fn organizer_or_default<'a>(&'a self, organizer: Option<&'a str>) -> &'a str {
        organizer
            .filter(|s| !s.is_empty())
            .unwrap_or(&self.cfg.default_organizer_id)
    }

    pub async fn bearer(&self) -> anyhow::Result<String> {
        if let Some(c) = self.cache.read().await.as_ref() {
            if c.fetched_at.elapsed() + Duration::from_secs(60) < c.ttl {
                return Ok(c.token.clone());
            }
        }
        let mut guard = self.cache.write().await;
        if let Some(c) = guard.as_ref() {
            if c.fetched_at.elapsed() + Duration::from_secs(60) < c.ttl {
                return Ok(c.token.clone());
            }
        }
        // The underlying reqwest error can echo the URL/params — never surface it.
        let resp = self
            .http
            .post(self.cfg.token_url())
            .form(&[
                ("client_id", self.cfg.client_id.as_str()),
                ("client_secret", self.cfg.client_secret.as_str()),
                ("scope", SCOPE),
                ("grant_type", "client_credentials"),
            ])
            .send()
            .await
            .map_err(|_| anyhow::anyhow!("Graph token request failed"))?;
        let status = resp.status();
        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|_| anyhow::anyhow!("Graph token response was not JSON"))?;
        if !status.is_success() {
            let code = body
                .get("error")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            return Err(anyhow::anyhow!(
                "Graph token endpoint returned {status}: {code}"
            ));
        }
        let token = body
            .get("access_token")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Graph token response missing access_token"))?
            .to_string();
        let ttl_secs = body
            .get("expires_in")
            .and_then(|v| v.as_u64())
            .unwrap_or(3300);
        *guard = Some(Cached {
            token: token.clone(),
            fetched_at: Instant::now(),
            ttl: Duration::from_secs(ttl_secs),
        });
        Ok(token)
    }
}
