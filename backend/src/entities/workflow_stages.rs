use sea_orm::entity::prelude::*;
use serde::Serialize;

use super::sea_orm_active_enums::WorkflowStageStatus;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "workflow_stages")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub workflow_instance_id: Uuid,
    pub stage_definition_id: Uuid,
    pub stage_name: String,
    pub stage_code: String,
    pub sequence_order: i32,
    pub status: WorkflowStageStatus,
    pub started_at: Option<DateTimeWithTimeZone>,
    pub completed_at: Option<DateTimeWithTimeZone>,
    pub due_date: Option<DateTimeWithTimeZone>,
    pub notes: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::workflow_instances::Entity",
        from = "Column::WorkflowInstanceId",
        to = "super::workflow_instances::Column::Id"
    )]
    WorkflowInstance,
}

impl ActiveModelBehavior for ActiveModel {}
