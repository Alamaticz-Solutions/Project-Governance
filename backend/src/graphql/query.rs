use async_graphql::{Context, Object};
use uuid::Uuid;
use sea_orm::{EntityTrait, QueryFilter, ColumnTrait};
use crate::state::AppState;
use crate::entities::{workflow_stages, workflow_stage_definitions};
use crate::graphql::workflow_types::GqlWorkflowStage;

pub struct QueryRoot;

#[Object]
impl QueryRoot {
    async fn health_check(&self) -> &str {
        "GraphQL is up and running"
    }

    async fn get_gates(
        &self,
        ctx: &Context<'_>,
        workflow_instance_id: Uuid,
    ) -> async_graphql::Result<Vec<GqlWorkflowStage>> {
        let state = ctx.data::<AppState>().unwrap();
        let db = &state.db;

        let gates = workflow_stages::Entity::find()
            .filter(workflow_stages::Column::WorkflowInstanceId.eq(workflow_instance_id))
            .all(db)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        Ok(gates.into_iter().map(|g| GqlWorkflowStage {
            id: g.id,
            workflow_instance_id: g.workflow_instance_id,
            stage_definition_id: g.stage_definition_id,
            stage_name: g.stage_name,
            stage_code: g.stage_code,
            sequence_order: g.sequence_order,
            status: g.status.as_str().to_string(),
            started_at: g.started_at.map(|d| d.with_timezone(&chrono::Utc)),
            completed_at: g.completed_at.map(|d| d.with_timezone(&chrono::Utc)),
            due_date: g.due_date.map(|d| d.with_timezone(&chrono::Utc)),
            notes: g.notes,
        }).collect())
    }
}
