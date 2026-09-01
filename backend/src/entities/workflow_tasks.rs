use sea_orm::entity::prelude::*;
use serde::Serialize;

use super::sea_orm_active_enums::{TaskStatus, UserRole};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "workflow_tasks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub stage_id: Uuid,
    pub task_name: String,
    pub task_description: Option<String>,
    pub task_type: Option<String>,
    pub assigned_role: Option<UserRole>,
    pub status: TaskStatus,
    pub is_required: Option<bool>,
    pub sequence_order: Option<i32>,
    pub due_date: Option<DateTimeWithTimeZone>,
    pub completed_at: Option<DateTimeWithTimeZone>,
    pub notes: Option<String>,
    #[sea_orm(column_name = "metadata")]
    pub metadata: Option<Json>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::workflow_stages::Entity",
        from = "Column::StageId",
        to = "super::workflow_stages::Column::Id"
    )]
    WorkflowStage,
}

impl ActiveModelBehavior for ActiveModel {}
