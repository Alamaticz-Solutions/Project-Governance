use sea_orm::entity::prelude::*;
use serde::Serialize;

use super::sea_orm_active_enums::{ApprovalDecision, GateCode, ProjectPriority, UserRole};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "gate_reviews")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub project_id: Uuid,
    pub gate_code: GateCode,
    pub gate_name: String,
    pub committee: Option<String>,
    pub assigned_role: Option<UserRole>,
    pub status: Option<String>,
    pub decision: Option<ApprovalDecision>,
    pub decision_by_id: Option<Uuid>,
    pub decision_at: Option<DateTimeWithTimeZone>,
    pub decision_notes: Option<String>,
    pub checklist_items: Option<Json>,
    pub submitted_at: Option<DateTimeWithTimeZone>,
    pub due_date: Option<DateTimeWithTimeZone>,
    pub priority: Option<ProjectPriority>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::projects::Entity",
        from = "Column::ProjectId",
        to = "super::projects::Column::Id"
    )]
    Project,
}

impl Related<super::projects::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Project.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
