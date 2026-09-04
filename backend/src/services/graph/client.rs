//! Executor: a named READ operation + bound params -> classified, redacted
//! result. This is the ONLY place an outbound Graph HTTP call is made, and it
//! can only be reached through `ReadOperation`. There is no `get(path)`.

use std::sync::Arc;

use super::{
    auth::{GraphAuthConfig, GraphToken},
    identity::GRAPH_BASE,
    registry::ReadOperation,
    response::{classify, redact, retry_after_from, GraphError, MAX_BODY_BYTES},
};

pub struct GraphClient {
    token: Arc<GraphToken>,
    http: reqwest::Client,
}

impl GraphClient {
    /// Returns `None` when the provider is not configured (missing env contract).
    pub fn from_env(http: reqwest::Client) -> Option<Self> {
        let cfg = GraphAuthConfig::from_env()?;
        Some(Self {
            token: Arc::new(GraphToken::new(cfg, http.clone())),
            http,
        })
    }

    pub fn default_organizer<'a>(&'a self) -> String {
        self.token.organizer_or_default(None).to_string()
    }

    /// Execute a registered read. Returns the (redacted) JSON body, or the
    /// transcript text for the transcript-content operation.
    #[tracing::instrument(
        name = "graph.read",
        skip(self, op),
        fields(operation = op.name(), phi_possible = op.phi_possible())
    )]
    pub async fn read(&self, op: ReadOperation) -> anyhow::Result<serde_json::Value> {
        let plan = op.plan();
        let url = format!("{GRAPH_BASE}{}", plan.path);
        tracing::info!(path = %plan.path, method = %plan.method, "outbound Microsoft Graph read");
        let bearer = self.token.bearer().await?;

        let mut req = self
            .http
            .request(plan.method.clone(), &url)
            .bearer_auth(bearer)
            .header(reqwest::header::ACCEPT, plan.accept.join(", "));
        for (k, v) in &plan.query {
            req = req.query(&[(k, v)]);
        }
        for (k, v) in &plan.headers {
            req = req.header(*k, v);
        }
        if let Some(body) = op.body() {
            req = req.json(&body);
        }

        let resp = req
            .send()
            .await
            .map_err(|_| anyhow::anyhow!("graph {} request failed (transport)", op.name()))?;

        let status = resp.status();
        let retry_after = retry_after_from(resp.headers());
        let ct = resp
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_ascii_lowercase();

        let bytes = resp
            .bytes()
            .await
            .map_err(|_| anyhow::anyhow!("graph {} body read failed", op.name()))?;
        if bytes.len() > MAX_BODY_BYTES {
            return Err(anyhow::anyhow!(
                "graph {} response exceeded {} bytes",
                op.name(),
                MAX_BODY_BYTES
            ));
        }

        if !status.is_success() {
            let body: serde_json::Value =
                serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null);
            let mut err = classify(status, &body);
            if let GraphError::RateLimited { retry_after: ra } = &mut err {
                *ra = retry_after;
            }
            tracing::warn!(
                status = status.as_u16(),
                "Microsoft Graph read returned an error status"
            );
            return Err(anyhow::Error::new(err));
        }
        tracing::info!(
            status = status.as_u16(),
            bytes = bytes.len(),
            "Microsoft Graph read ok"
        );

        // transcript content comes back as text/vtt, not JSON
        if matches!(op, ReadOperation::GetOnlineMeetingTranscript { .. })
            || (!ct.contains("json") && !bytes.is_empty())
        {
            let text = String::from_utf8_lossy(&bytes).into_owned();
            return Ok(serde_json::json!({ "content_type": ct, "text": text }));
        }

        let value: serde_json::Value =
            serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null);
        Ok(redact(value))
    }
}
