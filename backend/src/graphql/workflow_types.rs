use async_graphql::SimpleObject;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(SimpleObject)]
pub struct GqlWorkflowStage {
    pub id: Uuid,
    pub workflow_instance_id: Uuid,
    pub stage_definition_id: Uuid,
    pub stage_name: String,
    pub stage_code: String,
    pub sequence_order: i32,
    pub status: String,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub due_date: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}

#[derive(SimpleObject)]
pub struct GqlWorkflowDefinition {
    pub id: Uuid,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}
