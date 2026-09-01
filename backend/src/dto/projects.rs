use chrono::{DateTime, FixedOffset};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::entities::{
    projects,
    sea_orm_active_enums::{ProjectPriority, ProjectRisk, ProjectStatus},
    users,
};

#[derive(Debug, Deserialize)]
pub struct ProjectCreateRequest {
    pub project_name: String,
    pub business_unit: String,
    pub department: Option<String>,
    pub requestor_name: Option<String>,
    pub request_type: Option<String>,
    pub sponsor_name: Option<String>,
    pub sponsor_email: Option<String>,
    pub description: Option<String>,
    pub problem_statement: Option<String>,
    pub desired_outcome: Option<String>,
    pub what_do_you_do_today: Option<String>,
    pub what_transpires_if_nothing: Option<String>,
    pub notes: Option<String>,
    pub business_value: Option<String>,
    pub strategic_alignment: Option<String>,
    pub budget_estimated: Option<f64>,
    pub budget_type: Option<String>,
    pub requested_start_date: Option<DateTime<FixedOffset>>,
    pub requested_end_date: Option<DateTime<FixedOffset>>,
    #[serde(default = "default_priority")]
    pub priority: ProjectPriority,
    #[serde(default = "default_risk")]
    pub risk_level: ProjectRisk,
    #[serde(default)]
    pub it_involvement: bool,
    #[serde(default)]
    pub vendor_required: bool,
    #[serde(default)]
    pub has_phi_data: bool,
    #[serde(default)]
    pub is_clinical: bool,
    #[serde(default)]
    pub is_hipaa_applicable: bool,
}

fn default_priority() -> ProjectPriority {
    ProjectPriority::Medium
}
fn default_risk() -> ProjectRisk {
    ProjectRisk::Medium
}

#[derive(Debug, Deserialize, Serialize, Default)]
pub struct ProjectUpdateRequest {
    pub project_name: Option<String>,
    pub description: Option<String>,
    pub problem_statement: Option<String>,
    pub business_value: Option<String>,
    pub budget_estimated: Option<f64>,
    pub priority: Option<ProjectPriority>,
    pub risk_level: Option<ProjectRisk>,
    pub status: Option<ProjectStatus>,
    pub requested_start_date: Option<DateTime<FixedOffset>>,
    pub requested_end_date: Option<DateTime<FixedOffset>>,
    pub sponsor_name: Option<String>,
    pub sponsor_email: Option<String>,
    pub it_involvement: Option<bool>,
    pub vendor_required: Option<bool>,
    pub has_phi_data: Option<bool>,
    pub is_clinical: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ProjectManagerSummary {
    pub id: Uuid,
    pub full_name: String,
    pub email: String,
    pub role: String,
}

impl From<users::Model> for ProjectManagerSummary {
    fn from(u: users::Model) -> Self {
        Self {
            id: u.id,
            full_name: u.full_name,
            email: u.email,
            role: u.role.as_str().to_string(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ProjectResponse {
    pub id: Uuid,
    pub project_number: String,
    pub project_name: String,
    pub business_unit: String,
    pub department: Option<String>,
    pub requestor_name: Option<String>,
    pub request_type: Option<String>,
    pub sponsor_name: Option<String>,
    pub sponsor_email: Option<String>,
    pub description: Option<String>,
    pub problem_statement: Option<String>,
    pub desired_outcome: Option<String>,
    pub what_do_you_do_today: Option<String>,
    pub what_transpires_if_nothing: Option<String>,
    pub notes: Option<String>,
    pub business_value: Option<String>,
    pub budget_estimated: Option<f64>,
    pub budget_approved: Option<f64>,
    pub budget_type: Option<String>,
    pub priority: ProjectPriority,
    pub risk_level: Option<ProjectRisk>,
    pub status: ProjectStatus,
    pub it_involvement: bool,
    pub vendor_required: bool,
    pub has_phi_data: bool,
    pub is_clinical: bool,
    pub is_hipaa_applicable: bool,
    pub smartsheet_row_id: Option<String>,
    pub requested_start_date: Option<DateTime<FixedOffset>>,
    pub requested_end_date: Option<DateTime<FixedOffset>>,
    pub actual_start_date: Option<DateTime<FixedOffset>>,
    pub submitted_at: Option<DateTime<FixedOffset>>,
    pub current_stage: Option<String>,
    pub current_status: Option<String>,
    pub current_owner_role: Option<String>,
    pub last_stage_completed: Option<String>,
    pub workflow_status: Option<String>,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: Option<DateTime<FixedOffset>>,
    pub ai_extracted_data: Option<Value>,
    pub project_manager: Option<ProjectManagerSummary>,
}

impl ProjectResponse {
    pub fn from_model(p: projects::Model, manager: Option<users::Model>) -> Self {
        Self {
            id: p.id,
            project_number: p.project_number,
            project_name: p.project_name,
            business_unit: p.business_unit,
            department: p.department,
            requestor_name: p.requestor_name,
            request_type: p.request_type,
            sponsor_name: p.sponsor_name,
            sponsor_email: p.sponsor_email,
            description: p.description,
            problem_statement: p.problem_statement,
            desired_outcome: p.desired_outcome,
            what_do_you_do_today: p.what_do_you_do_today,
            what_transpires_if_nothing: p.what_transpires_if_nothing,
            notes: p.notes,
            business_value: p.business_value,
            budget_estimated: p.budget_estimated,
            budget_approved: p.budget_approved,
            budget_type: p.budget_type,
            priority: p.priority,
            risk_level: p.risk_level,
            status: p.status,
            it_involvement: p.it_involvement.unwrap_or(false),
            vendor_required: p.vendor_required.unwrap_or(false),
            has_phi_data: p.has_phi_data.unwrap_or(false),
            is_clinical: p.is_clinical.unwrap_or(false),
            is_hipaa_applicable: p.is_hipaa_applicable.unwrap_or(false),
            smartsheet_row_id: p.smartsheet_row_id,
            requested_start_date: p.requested_start_date,
            requested_end_date: p.requested_end_date,
            actual_start_date: p.actual_start_date,
            submitted_at: p.submitted_at,
            current_stage: p.current_stage,
            current_status: p.current_status,
            current_owner_role: p.current_owner_role,
            last_stage_completed: p.last_stage_completed,
            workflow_status: p.workflow_status,
            created_at: p.created_at,
            updated_at: p.updated_at,
            ai_extracted_data: p.ai_extracted_data,
            project_manager: manager.map(ProjectManagerSummary::from),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ProjectListResponse {
    pub items: Vec<ProjectResponse>,
    pub total: u64,
    pub page: u64,
    pub page_size: u64,
    pub total_pages: u64,
}

#[derive(Debug, Deserialize)]
pub struct ProjectListQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_page_size")]
    pub page_size: u64,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub search: Option<String>,
}
fn default_page() -> u64 {
    1
}
fn default_page_size() -> u64 {
    20
}

#[derive(Debug, Deserialize)]
pub struct IntakeEmailRequest {
    pub project_id: String,
    pub email: String,
    pub data: Value,
}

#[derive(Debug, Deserialize)]
pub struct DecisionSubmitRequest {
    pub stage: String,
    pub decision: String,
    pub comments: Option<String>,
    pub project_updates: Option<serde_json::Map<String, Value>>,
}

/// Mirrors the ad-hoc `project_data` payload the legacy `/approvals/pending`
/// endpoint built by hand (camelCase keys — the frontend binds to these
/// directly, so the shape is preserved exactly).
#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PendingApprovalProjectData {
    pub id: String,
    pub project_number: String,
    pub project_name: String,
    pub business_unit: String,
    pub department: Option<String>,
    pub requestor_name: Option<String>,
    pub request_type: Option<String>,
    pub sponsor_name: Option<String>,
    pub sponsor_email: Option<String>,
    pub description: Option<String>,
    pub problem_statement: Option<String>,
    pub desired_outcome: Option<String>,
    pub what_do_you_do_today: Option<String>,
    pub what_transpires_if_nothing: Option<String>,
    pub notes: Option<String>,
    pub strategic_alignment: Option<String>,
    pub current_state_architecture: Value,
    pub current_state_pain_points: Value,
    pub current_state_systems: Value,
    pub solution_overview: Value,
    pub tech_stack: Value,
    pub data_strategy: Value,
    pub security_strategy: Value,
    pub integration_strategy: Value,
    pub infrastructure_requirements: Value,
    pub compliance_standards: Value,
    pub how_addresses_compliance: Value,
    pub funding_source: Value,
    pub budget_breakdown: Value,
    pub human_resources: Value,
    pub impact_operations: Value,
    pub impact_revenue: Value,
    pub impact_savings: Value,
    pub impact_customer: Value,
    pub impact_competitive: Value,
    pub rationale: Value,
    pub scalability: Value,
    pub future_readiness: Value,
    pub feasibility_statement: Value,
    pub it_capabilities_alignment: Value,
    pub new_skills_required: Value,
    pub stakeholders: Value,
    pub risks_list: Value,
    pub milestones: Value,
    pub solutions_considered: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingApprovalItem {
    pub id: String,
    pub project_id: String,
    pub project_number: String,
    pub project_name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub priority: String,
    pub submitted_by: String,
    pub submitted_date: String,
    pub status: String,
    pub project_data: PendingApprovalProjectData,
    pub approval_id: String,
}
