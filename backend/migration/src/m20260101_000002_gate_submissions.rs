use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

const UP_SQL: &str = r#"
CREATE TABLE gate_submissions (
    id            UUID PRIMARY KEY,
    project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    stage         VARCHAR(50) NOT NULL,
    status        VARCHAR(30) NOT NULL DEFAULT 'in_progress',
    decision      VARCHAR(30),
    data          JSONB NOT NULL DEFAULT '{}'::jsonb,
    submitted_by  UUID REFERENCES users(id),
    submitted_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ,
    CONSTRAINT uq_gate_submission_stage UNIQUE (project_id, stage)
);
CREATE INDEX ix_gate_submissions_project ON gate_submissions(project_id);
"#;

const DOWN_SQL: &str = "DROP TABLE IF EXISTS gate_submissions CASCADE;";

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
