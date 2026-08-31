use sea_orm::entity::prelude::*;
use serde::Serialize;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "workflow_stage_definitions")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub workflow_id: Uuid,
    pub stage_name: String,
    pub stage_code: String,
    pub sequence_order: i32,
    pub description: Option<String>,
    pub phase_name: String,
    pub assigned_roles: Option<Json>,
    pub prerequisites: Option<Json>,
    pub conditions: Option<Json>,
    pub parallel_execution: Option<bool>,
    pub auto_advance: Option<bool>,
    pub sla_days: Option<i32>,
    pub checklist_template: Option<Json>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::workflow_definitions::Entity",
        from = "Column::WorkflowId",
        to = "super::workflow_definitions::Column::Id"
    )]
    WorkflowDefinition,
}

impl ActiveModelBehavior for ActiveModel {}
