//! Minimal Microsoft Graph client: client-credentials (app-only) token with a
//! cached, single-flight refresh, plus thin authed request helpers and Graph
//! error-body parsing. Raw `reqwest` — no Graph SDK for a handful of endpoints
//! (same approach `meeting_agent_service` takes for OpenAI).

use std::time::{Duration, Instant};

use serde::Deserialize;
use tokio::sync::RwLock;

use crate::{
    config::AppConfig,
    error::{AppError, AppResult},
};

const GRAPH_BASE: &str = "https://graph.microsoft.com/v1.0";
const TOKEN_SKEW: Duration = Duration::from_secs(60);
const CALL_TIMEOUT: Duration = Duration::from_secs(30);

struct CachedToken {
    value: String,
    expires_at: Instant,
}

pub struct GraphClient {
    http: reqwest::Client,
    tenant_id: String,
    client_id: String,
    client_secret: String,
    token: RwLock<Option<CachedToken>>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
}

impl GraphClient {
    pub fn new(cfg: &AppConfig, http: reqwest::Client) -> Self {
        Self {
            http,
            tenant_id: cfg.graph_tenant_id.clone(),
            client_id: cfg.graph_client_id.clone(),
            client_secret: cfg.graph_client_secret.clone(),
            token: RwLock::new(None),
        }
    }

    async fn token(&self) -> AppResult<String> {
        if let Some(t) = self.token.read().await.as_ref() {
            if t.expires_at > Instant::now() + TOKEN_SKEW {
                return Ok(t.value.clone());
            }
        }
        // Single-flight: re-check under the write lock before fetching.
        let mut guard = self.token.write().await;
        if let Some(t) = guard.as_ref() {
            if t.expires_at > Instant::now() + TOKEN_SKEW {
                return Ok(t.value.clone());
            }
        }

        let url = format!(
            "https://login.microsoftonline.com/{}/oauth2/v2.0/token",
            self.tenant_id
        );
        let resp = self
            .http
            .post(&url)
            .form(&[
                ("grant_type", "client_credentials"),
                ("scope", "https://graph.microsoft.com/.default"),
                ("client_id", self.client_id.as_str()),
                ("client_secret", self.client_secret.as_str()),
            ])
            .timeout(CALL_TIMEOUT)
            .send()
            .await
            .map_err(|e| AppError::Upstream {
                code: None,
                message: format!("Graph token request failed: {e}"),
                retryable: true,
            })?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Upstream {
                code: None,
                message: format!(
                    "Graph token endpoint returned {status}: {}",
                    body.chars().take(300).collect::<String>()
                ),
                retryable: status.is_server_error(),
            });
        }

        let tok: TokenResponse = resp.json().await.map_err(|e| AppError::Upstream {
            code: None,
            message: format!("Graph token response parse failed: {e}"),
            retryable: false,
        })?;
        let value = tok.access_token;
        *guard = Some(CachedToken {
            value: value.clone(),
            expires_at: Instant::now() + Duration::from_secs(tok.expires_in),
        });
        Ok(value)
    }

    async fn send(&self, req: reqwest::RequestBuilder) -> AppResult<reqwest::Response> {
        let token = self.token().await?;
        req.bearer_auth(token)
            .timeout(CALL_TIMEOUT)
            .send()
            .await
            .map_err(|e| AppError::Upstream {
                code: None,
                message: format!("Graph request failed: {e}"),
                retryable: true,
            })
    }

    pub async fn get(&self, path: &str) -> AppResult<reqwest::Response> {
        self.send(self.http.get(format!("{GRAPH_BASE}{path}"))).await
    }

    pub async fn get_query(
        &self,
        path: &str,
        query: &[(&str, &str)],
    ) -> AppResult<reqwest::Response> {
        self.send(self.http.get(format!("{GRAPH_BASE}{path}")).query(query))
            .await
    }

    pub async fn get_with_accept(
        &self,
        path: &str,
        accept: &str,
    ) -> AppResult<reqwest::Response> {
        self.send(
            self.http
                .get(format!("{GRAPH_BASE}{path}"))
                .header(reqwest::header::ACCEPT, accept),
        )
        .await
    }

    pub async fn post_json<B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> AppResult<reqwest::Response> {
        self.send(self.http.post(format!("{GRAPH_BASE}{path}")).json(body))
            .await
    }

    pub async fn patch_json<B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> AppResult<reqwest::Response> {
        self.send(self.http.patch(format!("{GRAPH_BASE}{path}")).json(body))
            .await
    }

    /// DELETE that treats both 2xx and 404 as success.
    pub async fn delete(&self, path: &str) -> AppResult<()> {
        let resp = self.send(self.http.delete(format!("{GRAPH_BASE}{path}"))).await?;
        if resp.status().is_success() || resp.status() == reqwest::StatusCode::NOT_FOUND {
            Ok(())
        } else {
            Err(graph_error(resp).await)
        }
    }
}

/// Turn a non-success Graph response into an [`AppError::Upstream`], pulling the
/// machine `code` from `error.innerError.code` (preferred) or `error.code`.
pub async fn graph_error(resp: reqwest::Response) -> AppError {
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    let parsed: Option<serde_json::Value> = serde_json::from_str(&body).ok();

    let (code, message) = parsed
        .as_ref()
        .and_then(|v| v.get("error"))
        .map(|e| {
            let inner = e
                .get("innerError")
                .and_then(|i| i.get("code"))
                .and_then(|c| c.as_str());
            let outer = e.get("code").and_then(|c| c.as_str());
            let msg = e
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("")
                .to_string();
            (inner.or(outer).map(str::to_string), msg)
        })
        .unwrap_or_else(|| (None, body.chars().take(300).collect()));

    AppError::Upstream {
        code,
        message: format!("Microsoft Graph {status}: {message}"),
        retryable: status.is_server_error()
            || status == reqwest::StatusCode::TOO_MANY_REQUESTS,
    }
}
