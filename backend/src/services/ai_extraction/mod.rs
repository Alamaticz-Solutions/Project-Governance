//! AI document extraction (Dev's `AIPopulationDropzone` / intake auto-fill,
//! spec 004). Was previously an honest inert stub -- `IntakeScreen.tsx`'s own
//! doc comment said "the extraction egress boundary does not exist on this
//! branch yet." This module is that boundary: [`extract_intake`] and
//! [`extract_team_fields`] are the only two places in this crate that ever
//! reach [`openai_client::extract_structured`], and both refuse to call it
//! at all once [`phi_gate::scan`] finds anything.
//!
//! Pipeline, every call: `text_extract::extract_text` (decode the upload) ->
//! `phi_gate::scan` (refuse if PHI/PII indicators found) ->
//! `openai_client::extract_structured` (the one OpenAI call site) ->
//! `audit::record` (retained evidence either way -- allowed or blocked).

pub mod openai_client;
pub mod phi_gate;
pub mod text_extract;

use std::sync::Arc;

use serde_json::json;

use crate::{
    product_api::{DataAccess, HandlerResult, JsonValue, UserAuth},
    services::{audit, support::require_user},
};

use openai_client::OpenAiConfig;

/// The intake form's field set (`IntakeScreen.tsx`'s `Draft`), described for
/// the model prompt. Kept as a plain string constant next to the frontend
/// field list it must stay in sync with -- see `frontend/src/features/
/// intake/IntakeScreen.tsx`'s `Draft` interface.
const INTAKE_FIELDS: &str = "\
- project_name: the proposed project's name/title
- department: the requesting department
- sponsor_name: the executive sponsor's name
- sponsor_email: the executive sponsor's email
- requestor_name: the person requesting the project
- request_type: the type of request (e.g. New, Enhancement, Replacement)
- problem_statement: the problem or opportunity being addressed
- business_value: the expected business value
- desired_outcome: what success looks like
- budget_estimated: a numeric budget estimate if mentioned (digits only, no currency symbol)";

/// Field descriptions per gate-review team, matching each bespoke form's
/// field list (`frontend/src/features/workspace/forms/*ReviewForm.tsx`).
/// Only the fields the AI can plausibly fill from a document are listed --
/// checklist Yes/No items and internally-computed fields are left for the
/// human reviewer.
fn team_fields(team: &str) -> Option<&'static str> {
    match team {
        "epmo" => Some(
            "\
- epmo_comments: any notes relevant to EPMO intake review",
        ),
        "bta" => Some(
            "\
- projectName: the project's name
- requestorName: who requested it
- requestingDepartment: the requesting department
- problemStatement: the problem being solved
- businessObjective: the business objective
- businessValue: the expected business value
- strategicAlignment: how it aligns with strategy
- inScope: what is in scope
- outOfScope: what is explicitly out of scope
- systemsImpacted: systems that will be impacted
- budgetEstimated: a numeric budget estimate if mentioned
- knownRisks: known risks
- dependencies: known dependencies",
        ),
        "eac" => Some(
            "\
- projectName: the project's name
- projectType: the type of project
- requestorName: who requested it
- problemStatement: the problem being solved
- strategicAlignment: how it aligns with strategy
- currentStateArchitecture: description of the current architecture
- currentStatePainPoints: current pain points
- solutionOverview: overview of the proposed solution
- techStack: proposed technology stack",
        ),
        "finance" => Some(
            "\
- totalCapex: total capital expenditure, numeric if mentioned
- totalOpex: total operating expenditure, numeric if mentioned
- annualCosts: estimated annual costs, numeric if mentioned
- annualBenefits: estimated annual benefits, numeric if mentioned
- financeNarrative: a narrative summary of the financial case",
        ),
        "pic" => Some(
            "\
- problemStatement: the problem being solved
- scope: the project scope
- vendorName: the recommended vendor, if any
- vendorJustification: why that vendor
- benefitCategory: the category of benefit
- milestones: key milestones
- resourceAsk: resources being requested",
        ),
        _ => None,
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ExtractionError {
    #[error(transparent)]
    Extract(#[from] text_extract::ExtractError),
    // Not currently constructed -- extract_team_fields short-circuits an
    // unknown team before entering run_extraction, returning its own
    // outcome_json rather than raising this variant. Kept on the enum as
    // the honest place for that case to live if that short-circuit ever
    // moves inside run_extraction.
    #[allow(dead_code)]
    #[error("unknown team `{0}`")]
    UnknownTeam(String),
    #[error("document was blocked by the PHI/PII pre-egress gate")]
    PhiBlocked,
    #[error(transparent)]
    OpenAi(#[from] openai_client::OpenAiError),
}

async fn run_extraction(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    audit_project_id: Option<String>,
    audit_entity_id: &str,
    field_descriptions: &str,
    payload: &JsonValue,
) -> Result<JsonValue, ExtractionError> {
    let text = text_extract::extract_text(payload)?;
    let char_count = text.chars().count();

    let findings = phi_gate::scan(&text);
    if !findings.is_empty() {
        let _ = audit::record(
            data_access,
            user,
            audit_project_id,
            "AiExtraction",
            audit_entity_id,
            "AI_EXTRACTION_BLOCKED_PHI",
            Some(json!({
                "char_count": char_count,
                "finding_kinds": findings.iter().map(|f| f.kind).collect::<Vec<_>>(),
            })),
        )
        .await;
        return Err(ExtractionError::PhiBlocked);
    }

    let Some(cfg) = OpenAiConfig::from_env() else {
        let _ = audit::record(
            data_access,
            user,
            audit_project_id,
            "AiExtraction",
            audit_entity_id,
            "AI_EXTRACTION_FAILED",
            Some(json!({ "char_count": char_count, "reason": "not_configured" })),
        )
        .await;
        return Err(ExtractionError::OpenAi(openai_client::OpenAiError::NotConfigured));
    };

    let http = reqwest::Client::new();
    match openai_client::extract_structured(&cfg, &http, &text, field_descriptions).await {
        Ok(data) => {
            let _ = audit::record(
                data_access,
                user,
                audit_project_id,
                "AiExtraction",
                audit_entity_id,
                "AI_EXTRACTION_SUCCEEDED",
                Some(json!({ "char_count": char_count, "model": cfg.model })),
            )
            .await;
            Ok(data)
        }
        Err(e) => {
            let _ = audit::record(
                data_access,
                user,
                audit_project_id,
                "AiExtraction",
                audit_entity_id,
                "AI_EXTRACTION_FAILED",
                Some(json!({ "char_count": char_count, "reason": e.to_string() })),
            )
            .await;
            Err(ExtractionError::OpenAi(e))
        }
    }
}

fn outcome_json(result: Result<JsonValue, ExtractionError>) -> JsonValue {
    match result {
        Ok(data) => json!({ "success": true, "blocked": false, "data": data }),
        Err(ExtractionError::PhiBlocked) => json!({
            "success": false,
            "blocked": true,
            "reason": "This document appears to contain PHI/PII (a SSN-, MRN-, \
                       DOB-, or patient-name-shaped value, or contact details) and \
                       was not sent to the extraction service. Redact it and paste \
                       the relevant text directly, or enter the fields manually.",
        }),
        Err(e) => json!({ "success": false, "blocked": false, "reason": e.to_string() }),
    }
}

/// `Project.extractIntake(payload)` -- no project exists yet at intake time,
/// so this is not tied to a project id (unlike `extract_team_fields`).
pub async fn extract_intake(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    payload: JsonValue,
) -> HandlerResult<JsonValue> {
    require_user(user)?;
    let result = run_extraction(data_access, user, None, "intake", INTAKE_FIELDS, &payload).await;
    Ok(outcome_json(result))
}

/// `Project.extractTeamFields(projectId, team, payload)` -- pre-fills one of
/// the bespoke gate review forms from an uploaded/pasted document.
pub async fn extract_team_fields(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    project_id: String,
    team: String,
    payload: JsonValue,
) -> HandlerResult<JsonValue> {
    require_user(user)?;
    let Some(field_descriptions) = team_fields(&team) else {
        return Ok(json!({
            "success": false,
            "blocked": false,
            "reason": format!("unknown team `{team}`"),
        }));
    };
    let result = run_extraction(
        data_access,
        user,
        Some(project_id.clone()),
        &project_id,
        field_descriptions,
        &payload,
    )
    .await;
    Ok(outcome_json(result))
}
