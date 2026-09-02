use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

/// NO-OP (was: "drop unused tables").
///
/// The upstream version of this migration dropped a set of tables it
/// considered unused (`attachments`, `workflow_stages`, `workflow_tasks`,
/// `workflow_instances`, `comments`, `risk_items`, …) plus the
/// `workflow_stage_status` / `task_status` enum types.
///
/// That conflicts with features on this branch:
///   * `attachments` is written by `projects::extract_team_fields` (AI form
///     auto-population document upload) and read by `list_documents` /
///     `download_document`. The live DB currently holds 27 rows, so the
///     upstream safety-guard would also abort startup outright.
///   * `workflow_stages` / `workflow_stage_status` are used by
///     `services::workflow_engine::TransitionService` and the GraphQL
///     `workflow_stages` query.
///
/// Kept as a registered no-op so `seaql_migrations` history stays linear and
/// in sync with upstream. Revisit the table cleanup once the attachment and
/// workflow-stage features are either removed or migrated off these tables.
#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}
