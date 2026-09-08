//! The single OpenAI egress point (spec 004). Every call in this crate that
//! reaches `api.openai.com` goes through [`extract_structured`] -- mirrors
//! how `services::graph::client`/`writes` are the sole Graph call sites.
//! Never called directly by a handler; always through
//! `super::run_extraction_on_text` (reached via `extract_intake`/
//! `extract_team_fields`/`extract_meeting_insights`), which runs
//! `phi_gate::scan` first and refuses to call this at all if it finds
//! anything.

use std::time::Duration;

use serde::Deserialize;

/// A string that must never be logged, echoed in payloads, or serialized --
/// same pattern as `services::graph::auth::SecretString`.
#[derive(Clone)]
pub struct SecretString(String);

impl SecretString {
    pub fn expose_secret(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Debug for SecretString {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("\"[REDACTED]\"")
    }
}

pub const ENV_API_KEY: &str = "OPENAI_API_KEY";
pub const ENV_MODEL: &str = "OPENAI_MODEL";
const DEFAULT_MODEL: &str = "gpt-4o";
const CHAT_COMPLETIONS_URL: &str = "https://api.openai.com/v1/chat/completions";
/// Cap on the document text sent per call -- keeps cost and latency bounded
/// and stays well under the model's context window regardless of document
/// size; extraction accuracy on a longer document degrades gracefully
/// (later content is simply not seen) rather than the call failing outright.
const MAX_INPUT_CHARS: usize = 24_000;

#[derive(Clone)]
pub struct OpenAiConfig {
    api_key: SecretString,
    pub model: String,
}

impl OpenAiConfig {
    /// Returns `None` when the provider is not configured -- the M10-style
    /// fail-closed pattern: no key, no call, ever.
    pub fn from_env() -> Option<Self> {
        let api_key = std::env::var(ENV_API_KEY)
            .ok()
            .filter(|s| !s.is_empty())?;
        let model = std::env::var(ENV_MODEL).unwrap_or_else(|_| DEFAULT_MODEL.to_string());
        Some(Self {
            api_key: SecretString(api_key),
            model,
        })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum OpenAiError {
    #[error("OpenAI is not configured (OPENAI_API_KEY unset)")]
    NotConfigured,
    #[error("OpenAI request failed (transport)")]
    Transport,
    #[error("OpenAI returned {status}: {code}")]
    Api { status: u16, code: String },
    #[error("OpenAI response was not valid JSON")]
    BadResponse,
    #[error("OpenAI's extracted-fields payload was not valid JSON: {0}")]
    BadExtraction(String),
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[derive(Deserialize)]
struct ChatMessage {
    content: Option<String>,
}

/// Ask the model to extract `field_descriptions` (a human-readable prompt
/// fragment naming each target field and what it means) out of `text`,
/// returned as a flat JSON object. Only ever reached after `phi_gate::scan`
/// has already found nothing.
pub async fn extract_structured(
    cfg: &OpenAiConfig,
    http: &reqwest::Client,
    text: &str,
    field_descriptions: &str,
) -> Result<serde_json::Value, OpenAiError> {
    let truncated: String = text.chars().take(MAX_INPUT_CHARS).collect();
    let system_prompt = format!(
        "You extract structured project-governance data from a document or \
         meeting transcript. Return ONLY a JSON object (no prose, no markdown \
         fences) with exactly these fields, using the type stated for each \
         one, and an empty value for that type (empty string, empty array, or \
         false) for any field with no evidence in the source text:\n{field_descriptions}"
    );

    let body = serde_json::json!({
        "model": cfg.model,
        "temperature": 0,
        "response_format": { "type": "json_object" },
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": truncated },
        ],
    });

    let resp = http
        .post(CHAT_COMPLETIONS_URL)
        .timeout(Duration::from_secs(60))
        .bearer_auth(cfg.api_key.expose_secret())
        .json(&body)
        .send()
        .await
        .map_err(|_| OpenAiError::Transport)?;

    let status = resp.status();
    let bytes = resp.bytes().await.map_err(|_| OpenAiError::Transport)?;

    if !status.is_success() {
        let value: serde_json::Value =
            serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null);
        let code = value
            .get("error")
            .and_then(|e| e.get("code").or_else(|| e.get("type")))
            .and_then(|c| c.as_str())
            .unwrap_or("unknown")
            .to_string();
        return Err(OpenAiError::Api {
            status: status.as_u16(),
            code,
        });
    }

    let parsed: ChatCompletionResponse =
        serde_json::from_slice(&bytes).map_err(|_| OpenAiError::BadResponse)?;
    let content = parsed
        .choices
        .into_iter()
        .next()
        .and_then(|c| c.message.content)
        .ok_or(OpenAiError::BadResponse)?;

    serde_json::from_str(&content).map_err(|e| OpenAiError::BadExtraction(e.to_string()))
}
