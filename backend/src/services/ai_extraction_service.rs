use serde_json::Value;

use crate::{config::AppConfig, error::{AppError, AppResult}};

/// Extracts raw text from an uploaded intake document (PDF/DOCX/TXT).
pub fn extract_text(filename: &str, bytes: &[u8]) -> AppResult<String> {
    let lower = filename.to_lowercase();
    if lower.ends_with(".pdf") {
        pdf_extract::extract_text_from_mem(bytes)
            .map_err(|e| AppError::BadRequest(format!("Could not read PDF: {e}")))
    } else if lower.ends_with(".docx") {
        let docx = docx_rs::read_docx(bytes)
            .map_err(|e| AppError::BadRequest(format!("Could not read DOCX: {e}")))?;
        Ok(docx_text(&docx))
    } else if lower.ends_with(".txt") {
        Ok(String::from_utf8_lossy(bytes).to_string())
    } else {
        Err(AppError::BadRequest(
            "Unsupported file format. Please upload PDF, DOCX, or TXT.".to_string(),
        ))
    }
}

fn docx_text(docx: &docx_rs::Docx) -> String {
    // docx-rs exposes the parsed document tree; a full JSON round-trip via its
    // own serializer is the simplest reliable way to pull all run text out of
    // arbitrarily nested paragraphs/tables without hand-walking the tree.
    let json = serde_json::to_value(&docx.document).unwrap_or(Value::Null);
    let mut out = String::new();
    collect_text_values(&json, &mut out);
    out
}

fn collect_text_values(value: &Value, out: &mut String) {
    match value {
        Value::Object(map) => {
            if let Some(Value::String(s)) = map.get("text") {
                out.push_str(s);
                out.push(' ');
            }
            for v in map.values() {
                collect_text_values(v, out);
            }
        }
        Value::Array(items) => {
            for v in items {
                collect_text_values(v, out);
            }
        }
        _ => {}
    }
}

/// Calls the OpenAI API to structure freeform intake-document text into the
/// intake wizard's fields. Replaces the legacy backend's undocumented Groq
/// call with the real, documented OpenAI integration.
pub async fn extract_intake_fields(
    http: &reqwest::Client,
    config: &AppConfig,
    text: &str,
) -> AppResult<Value> {
    if config.openai_api_key.is_empty() {
        return Err(AppError::BadRequest(
            "AI extraction is not configured (missing OPENAI_API_KEY).".to_string(),
        ));
    }

    let truncated: String = text.chars().take(5000).collect();
    let prompt = format!(
        r#"Extract the following fields from the text below to populate a project intake form.
Return the result as a valid JSON object ONLY, with these exact keys:
- "projectName": string
- "problemStatement": string
- "desiredOutcome": string
- "whatDoYouDoToday": string (optional, up to 1024 chars)
- "whatTranspiresIfWeDoNothing": string (optional, up to 1024 chars)
- "notesComments": string (optional)

If a field is not found in the text, leave it as an empty string. Do not include markdown formatting like ```json in the output, just raw JSON.

Text:
{truncated}"#
    );

    let response = http
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(&config.openai_api_key)
        .json(&serde_json::json!({
            "model": config.openai_model,
            "messages": [{ "role": "user", "content": prompt }],
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
