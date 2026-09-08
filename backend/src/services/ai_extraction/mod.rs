//! AI document extraction (Dev's `AIPopulationDropzone` / intake auto-fill,
//! spec 004). Was previously an honest inert stub -- `IntakeScreen.tsx`'s own
//! doc comment said "the extraction egress boundary does not exist on this
//! branch yet." This module is that boundary: [`extract_intake`],
//! [`extract_team_fields`], and [`extract_meeting_insights`] are the only
//! places in this crate that ever reach [`openai_client::extract_structured`],
//! and all three refuse to call it at all once [`phi_gate::scan`] finds
//! anything.
//!
//! Pipeline: `phi_gate::scan` (refuse if PHI/PII indicators found) ->
//! `openai_client::extract_structured` (the one OpenAI call site) ->
//! `audit::record` (retained evidence either way -- allowed or blocked).
//! [`extract_intake`]/[`extract_team_fields`] additionally run
//! `text_extract::extract_text` first to decode an uploaded/pasted document
//! into text; `extract_meeting_insights` skips that step because its caller
//! (`services::meeting_agent::process_transcript`) already has plain text
//! from the parsed VTT.

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

/// Meeting-transcript field set, for [`extract_meeting_insights`] -- the
/// third call site of the AI-egress boundary. Unlike the flat-string
/// intake/team-review forms, these mix string/array/boolean, so the shape
/// is spelled out explicitly for the model.
const MEETING_INSIGHT_FIELDS: &str = "\
- summary: a string, a concise 2-4 sentence summary of what the meeting covered and what was decided
- decisions: a JSON array of strings, each one a distinct decision that was made
- action_items: a JSON array of strings, each one a specific action item (include an owner's name in the string if the transcript names one)
- agenda_items: a JSON array of strings, each one a distinct topic or agenda item discussed
- contains_process_flow: a boolean, true only if the meeting discussed a specific business process or workflow in enough step-by-step detail that it could be diagrammed
- process_name: a string naming that process if contains_process_flow is true, otherwise an empty string";

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
    run_extraction_on_text(
        data_access,
        user,
        audit_project_id,
        audit_entity_id,
        field_descriptions,
        &text,
    )
    .await
}

/// The PHI-gate -> OpenAI -> audit core, shared by every call site once it
/// already has plain text in hand (from `text_extract`, or from an
/// already-parsed transcript).
async fn run_extraction_on_text(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    audit_project_id: Option<String>,
    audit_entity_id: &str,
    field_descriptions: &str,
    text: &str,
) -> Result<JsonValue, ExtractionError> {
    let char_count = text.chars().count();

    let findings = phi_gate::scan(text);
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
    match openai_client::extract_structured(&cfg, &http, text, field_descriptions).await {
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

/// Called from `services::meeting_agent::process_transcript` once a
/// transcript's VTT has been parsed to plain text -- summarizes it into
/// `summary`/`decisions`/`action_items`/`agenda_items`/
/// `contains_process_flow`/`process_name` for the `Meeting` row. Returns the
/// raw `Result` (not wrapped in `outcome_json`, unlike the two GraphQL entry
/// points above) so the caller can persist different `bpmn_status` values
/// for the blocked-by-PHI and failed cases rather than just reporting them.
/// The caller is expected to have already authenticated the user
/// (`process_transcript` calls `require_user` itself), so this does not
/// duplicate that check.
pub async fn extract_meeting_insights(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    meeting_id: &str,
    text: &str,
) -> Result<JsonValue, ExtractionError> {
    run_extraction_on_text(data_access, user, None, meeting_id, MEETING_INSIGHT_FIELDS, text).await
}
