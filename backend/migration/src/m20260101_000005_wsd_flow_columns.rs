use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

// Reconciliation migration for **legacy databases**.
//
// `m20260101_000001_init_schema` guards its DDL with `if has_table("users")`,
// so on a database that already had a `users` table (the pre-existing
// governance DB) none of that migration's `CREATE TABLE` / enum DDL ran — it
// was only *recorded* as applied. Later work (V1's phase-based workflow
// engine) added `phase_name` / `prerequisites` / `conditions` to
// `workflow_stage_definitions` in that same file, and `seed_workflow_definitions`
// now inserts rows using those columns — which blows up on a legacy DB.
//
// This migration adds the columns idempotently. On a fresh database the
// columns already exist (created by migration 0001) and every statement is a
// no-op.
const UP_SQL: &str = r#"
ALTER TABLE workflow_stage_definitions ADD COLUMN IF NOT EXISTS phase_name    VARCHAR(100);
ALTER TABLE workflow_stage_definitions ADD COLUMN IF NOT EXISTS prerequisites JSONB;
ALTER TABLE workflow_stage_definitions ADD COLUMN IF NOT EXISTS conditions    JSONB;
"#;

// Intentionally not dropped on `down` — removing a column that a fresh DB's
// 0001 created would be wrong. This migration is a forward-only reconciliation.
const DOWN_SQL: &str = "SELECT 1;";

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.get_connection().execute_unprepared(UP_SQL).await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.get_connection().execute_unprepared(DOWN_SQL).await?;
        Ok(())
    }
}
