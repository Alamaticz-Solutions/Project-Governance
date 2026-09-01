use sea_orm::entity::prelude::*;
use serde::Serialize;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "checklist_items")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub task_id: Uuid,
    pub item_text: String,
    pub is_completed: Option<bool>,
    pub completed_by_id: Option<Uuid>,
    pub completed_at: Option<DateTimeWithTimeZone>,
    pub sequence_order: Option<i32>,
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
