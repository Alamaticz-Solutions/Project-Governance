use sea_orm::entity::prelude::*;
use serde::Serialize;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "task_assignments")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub task_id: Uuid,
    pub assignee_id: Uuid,
    pub assigned_at: Option<DateTimeWithTimeZone>,
    pub assigned_by_id: Option<Uuid>,
    pub accepted_at: Option<DateTimeWithTimeZone>,
    pub completed_at: Option<DateTimeWithTimeZone>,
    pub notes: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::workflow_tasks::Entity",
        from = "Column::TaskId",
        to = "super::workflow_tasks::Column::Id"
    )]
    WorkflowTask,
}

impl ActiveModelBehavior for ActiveModel {}
