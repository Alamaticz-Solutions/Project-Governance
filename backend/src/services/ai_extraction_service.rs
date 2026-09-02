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
    } else if lower.ends_with(".xlsx") {
        xlsx_text(bytes)
    } else if lower.ends_with(".txt") {
        Ok(String::from_utf8_lossy(bytes).to_string())
    } else {
        Err(AppError::BadRequest(
            "Unsupported file format. Please upload PDF, DOCX, XLSX, or TXT.".to_string(),
        ))
    }
}

fn xlsx_text(bytes: &[u8]) -> AppResult<String> {
    use calamine::{Reader, Xlsx, open_workbook_from_rs};
    use std::io::Cursor;
    let cursor = Cursor::new(bytes);
    let mut excel: Xlsx<_> = open_workbook_from_rs(cursor).map_err(|e| AppError::BadRequest(format!("Could not read XLSX: {}", e)))?;
    let mut out = String::new();
    let sheet_names = excel.sheet_names().to_vec();
    for sheet_name in sheet_names {
        if let Ok(range) = excel.worksheet_range(&sheet_name) {
            for row in range.rows() {
                for cell in row {
                    out.push_str(&cell.to_string());
                    out.push(' ');
                }
                out.push('\n');
            }
        }
    }
    Ok(out)
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


pub async fn extract_team_fields(
    http: &reqwest::Client,
    config: &crate::config::AppConfig,
    text: &str,
    team: &str,
) -> AppResult<serde_json::Value> {
    if config.openai_api_key.is_empty() {
        return Err(AppError::BadRequest(
            "AI extraction is not configured (missing OPENAI_API_KEY).".to_string(),
        ));
    }

    let truncated: String = text.chars().take(8000).collect();
    
    let template = match team.to_lowercase().as_str() {
        "bta" => r#"{
            "projectName": "string",
            "requestorName": "string",
            "requestingDepartment": "string",
            "projectStatus": "one of: New Request | In Progress",
            "projectType": "one of: Digital Transformation | Infrastructure | Software Development",
            "primaryBTA": "string - name of the primary BTA / architect, else empty string",
            "targetBusinessDepartment": "string",
            "problemStatement": "string - the core problem or pain point being solved",
            "businessObjective": "string - the goal / desired outcome of the project",
            "businessValue": "string - quantified business value, ROI, savings or benefits",
            "strategicAlignment": "string - how this aligns to company strategy",
            "inScope": "string - what is included in this initiative",
            "outOfScope": "string - what is explicitly excluded",
            "isNewSolution": "boolean - true if this is a brand new solution, false if enhancing an existing one",
            "itInvolvement": "boolean - true if IT involvement is required",
            "systemsImpacted": "string - systems / applications impacted",
            "hasPhiData": "boolean - true if PHI/PII data is involved",
            "isHipaaApplicable": "boolean - true if HIPAA compliance applies",
            "dataClassification": "one of: restricted | internal | public (empty string if unknown)",
            "budgetEstimated": "string - estimated budget as a number only, no currency symbols",
            "budgetType": "one of: capex | opex | tbd",
            "vendorRequired": "boolean - true if an external vendor is required",
            "requestedStartDate": "string - requested start date in YYYY-MM-DD format",
            "requestedEndDate": "string - requested end date in YYYY-MM-DD format",
            "priority": "one of: CRITICAL | HIGH | MEDIUM | LOW",
            "riskLevel": "one of: HIGH | MEDIUM | LOW",
            "knownRisks": "string - known risks and mitigation plans",
            "dependencies": "string - key dependencies or blockers"
        }"#,
        "finance" => r#"{
            "totalCapex": "string - total capital expenditure, digits only",
            "totalOpex": "string - total operating expenditure, digits only",
            "totalRunCosts": "string - total ongoing run/maintenance costs, digits only",
            "grandTotal": "string - grand total cost, digits only",
            "memoOpex": "string - memo / notes about opex",
            "devImplCosts": "string - development and implementation costs, digits only",
            "softwareLicensing": "string - software licensing costs, digits only",
            "annualCosts": "string - recurring annual costs, digits only",
            "annualBenefits": "string - recurring annual benefits / savings, digits only",
            "paybackPeriod": "string - payback period, e.g. '18 months' or '1.5 years'",
            "roiPercentage": "string - ROI percentage, digits only (no % sign)",
            "financeNarrative": "string - short narrative summary of the financial case"
        }"#,
        "epmo" => r#"{
            "epmo_strategy": "one of: Yes | No - does the project align with organizational strategy?",
            "epmo_pic_needed": "one of: Yes | No - is Project Investment Committee (PIC) approval required?",
            "epmo_pm_required": "one of: Yes | No - is a dedicated project manager required?",
            "epmo_related_project": "one of: Yes | No - is this related to or dependent on an existing project?",
            "epmo_comments": "string - short summary / notes for the EPMO reviewer"
        }"#,
        "eac" => r#"{
            "projectName": "string",
            "projectType": "string - e.g. Digital Transformation, Infrastructure, Integration",
            "targetBusinessDepartment": "string - business department(s) that will use the solution",
            "problemStatement": "string - the problem or opportunity being addressed",
            "strategicAlignment": "string - how the project aligns to enterprise/IT strategy and architecture principles",
            "currentStateArchitecture": "string - description of the current-state systems, architecture and pain points"
        }"#,
        "pic" => r#"{
            "problemStatement": "string - the problem or opportunity statement",
            "scope": "string - high level scope of the project",
            "vendorName": "string - recommended vendor name",
            "vendorJustification": "string - why this vendor was selected",
            "vendorBenefits": "string - additional benefits / concessions from the vendor",
            "benefitCategory": "one of: Cost Reduction | Revenue Generation | Compliance Risk Avoidance | Clinical Efficiency",
            "annualValueY1": "string - quantified annual benefit in year 1, digits only",
            "annualValueY2": "string - quantified annual benefit in year 2, digits only",
            "benefitMethodology": "string - how the benefit was calculated / assumptions",
            "capex": "string - total capital expenditure, digits only",
            "npv": "string - net present value, digits only",
            "irr": "string - internal rate of return percentage, digits only (no % sign)",
            "paybackMonths": "string - payback period in months, digits only",
            "milestones": "string - key project milestones and target dates",
            "resourceAsk": "string - FTE / resource ask to deliver the project",
            "comments": "string - supporting information or preparation comments"
        }"#,
        _ => r#"{}"#
    };
    
    let prompt = format!(
        r#"Extract the following fields from the text below for the '{team}' team form.
Return the result as a valid JSON object ONLY. Each value below describes what to put in that key:
{template}

Rules:
- Replace every description with the actual extracted value.
- If a description says "one of: A | B | C", the value MUST be exactly one of those options (match the wording/casing shown). If none applies, use an empty string.
- If a description says "boolean", return a real JSON boolean (true or false), not a string. Default to false when the document does not indicate otherwise.
- Dates must be in YYYY-MM-DD format.
- Numbers (budgets, amounts) must be digits only with no currency symbols or commas.
- If a value is genuinely not present in the document, use an empty string "" (or false for booleans).
- Keep every key from the structure above; do not add extra keys.

Do not include markdown formatting like ```json in the output, just raw JSON.

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

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Invalid OpenAI response: {e}")))?;

    let content = body["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("OpenAI response missing content")))?;

    serde_json::from_str(content)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("OpenAI returned invalid JSON: {e}")))
}
