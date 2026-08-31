use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{config::AppConfig, error::{AppError, AppResult}};

#[derive(Debug, Serialize, Deserialize)]
pub struct MeetingExtractionResult {
    pub summary: String,
    pub decisions: Vec<String>,
    pub action_items: Vec<ActionItem>,
    pub agenda_items: Vec<AgendaItem>,
    pub contains_process_flow: bool,
    pub process_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActionItem {
    pub text: String,
    pub assignee: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgendaItem {
    pub project: String,
    pub department: Option<String>,
}

pub async fn extract_meeting_notes(
    http: &reqwest::Client,
    config: &AppConfig,
    transcript: &str,
) -> AppResult<MeetingExtractionResult> {
    if config.openai_api_key.is_empty() {
        return Err(AppError::BadRequest(
            "AI extraction is not configured (missing OPENAI_API_KEY).".to_string(),
        ));
    }

    let prompt = r#"
You are a governance meeting extraction agent. Turn the raw meeting transcript into structured output.

Extraction rules:
- Summary: 2-4 sentences capturing the overall outcome and tone. Do not pad with agenda-item restatement.
- Decisions: statements showing actual agreement or a ruling being made.
- Action items: capture as {text, assignee}. If ownership is unclear, set assignee to "Unassigned".
- Agenda items: {project, department}. Infer department only when strongly implied.
- Process flow detection: set contains_process_flow to true ONLY when the transcript describes an actual sequence of steps, handoffs, or decision points for how work gets done. Set process_name if true.

Return ONLY valid JSON matching this schema:
{
  "summary": "string",
  "decisions": ["string"],
  "action_items": [{"text": "string", "assignee": "string"}],
  "agenda_items": [{"project": "string", "department": "string or null"}],
  "contains_process_flow": boolean,
  "process_name": "string or null"
}
"#;

    let response = http
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(&config.openai_api_key)
        .json(&serde_json::json!({
            "model": config.openai_model,
            "messages": [
                { "role": "system", "content": prompt },
                { "role": "user", "content": transcript }
            ],
            "response_format": { "type": "json_object" },
        }))
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("OpenAI request failed: {e}")))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Internal(anyhow::anyhow!(
            "OpenAI request failed ({status}): {body}"
        )));
    }

    let body: Value = response
        .json()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Invalid OpenAI response: {e}")))?;

    let content = body["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("OpenAI response missing content")))?;

    serde_json::from_str(content)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("OpenAI returned invalid JSON: {e}")))
}

pub async fn generate_bpmn(
    http: &reqwest::Client,
    config: &AppConfig,
    transcript: &str,
) -> AppResult<String> {
    if config.openai_api_key.is_empty() {
        return Err(AppError::BadRequest(
            "AI extraction is not configured (missing OPENAI_API_KEY).".to_string(),
        ));
    }

    let prompt = r#"
You are a BPMN 2.0 export agent. Based on the provided business process description, generate valid BPMN 2.0 XML.
Use the namespace:
xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
exporter="bpmn-js (https://demo.bpmn.io)" exporterVersion="12.0.0"

Return ONLY the raw XML string starting with <?xml version="1.0" encoding="UTF-8"?>.
Do NOT wrap it in markdown block quotes (no ```xml).
"#;

    let response = http
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(&config.openai_api_key)
        .json(&serde_json::json!({
            "model": config.openai_model,
            "messages": [
                { "role": "system", "content": prompt },
                { "role": "user", "content": transcript }
            ]
        }))
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("OpenAI request failed: {e}")))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Internal(anyhow::anyhow!(
            "OpenAI request failed ({status}): {body}"
        )));
    }

    let body: Value = response
        .json()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Invalid OpenAI response: {e}")))?;

    let content = body["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("OpenAI response missing content")))?;

    let mut xml = content.trim().to_string();
    if xml.starts_with("```xml") {
        xml = xml.trim_start_matches("```xml").trim_start_matches('\n').to_string();
    }
    if xml.ends_with("```") {
        xml = xml.trim_end_matches("```").trim_end_matches('\n').to_string();
    }
    Ok(xml)
}
