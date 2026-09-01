use sea_orm::entity::prelude::*;
use serde::Serialize;

use super::sea_orm_active_enums::{ProjectPriority, ProjectRisk, ProjectStatus};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "projects")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub project_number: String,
    pub project_name: String,
    pub business_unit: String,
    pub department: Option<String>,
    pub manager_id: Uuid,
    pub sponsor_name: Option<String>,
    pub sponsor_email: Option<String>,
    pub description: Option<String>,
    pub problem_statement: Option<String>,
    pub business_value: Option<String>,
    pub strategic_alignment: Option<String>,
    pub requestor_name: Option<String>,
    pub request_type: Option<String>,
    pub desired_outcome: Option<String>,
    pub what_do_you_do_today: Option<String>,
    pub what_transpires_if_nothing: Option<String>,
    pub notes: Option<String>,
    pub budget_estimated: Option<f64>,
    pub budget_approved: Option<f64>,
    pub budget_type: Option<String>,
    pub requested_start_date: Option<DateTimeWithTimeZone>,
    pub requested_end_date: Option<DateTimeWithTimeZone>,
    pub actual_start_date: Option<DateTimeWithTimeZone>,
    pub actual_end_date: Option<DateTimeWithTimeZone>,
    pub priority: ProjectPriority,
    pub risk_level: Option<ProjectRisk>,
    pub status: ProjectStatus,
    pub it_involvement: Option<bool>,
    pub vendor_required: Option<bool>,
    pub has_phi_data: Option<bool>,
    pub is_clinical: Option<bool>,
    pub is_hipaa_applicable: Option<bool>,
    pub smartsheet_row_id: Option<String>,
    pub smartsheet_sheet_url: Option<String>,
    pub jira_ticket_id: Option<String>,
    pub duplicate_of_id: Option<Uuid>,
    pub is_duplicate: Option<bool>,
    pub ai_extracted_data: Option<Json>,
    pub current_stage: Option<String>,
    pub current_status: Option<String>,
    pub current_owner_role: Option<String>,
    pub last_stage_completed: Option<String>,
    pub workflow_status: Option<String>,
    pub submitted_at: Option<DateTimeWithTimeZone>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: Option<DateTimeWithTimeZone>,
    pub archived_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::ManagerId",
        to = "super::users::Column::Id"
    )]
    Manager,
    #[sea_orm(has_many = "super::project_approvals::Entity")]
    ProjectApprovals,
    #[sea_orm(has_many = "super::gate_reviews::Entity")]
    GateReviews,
    #[sea_orm(has_many = "super::project_fields::Entity")]
    ProjectFields,
}

impl Related<super::users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Manager.def()
    }
}

impl Related<super::project_approvals::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ProjectApprovals.def()
    }
}

impl Related<super::gate_reviews::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::GateReviews.def()
    }
}

impl Related<super::project_fields::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ProjectFields.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
