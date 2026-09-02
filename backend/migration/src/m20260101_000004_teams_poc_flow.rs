use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

// Retires the Microsoft Graph columns on `poc_meetings`. The POC now schedules
// Teams meetings via a Power Automate flow (outbound webhook) and ingests
// transcripts via `POST /teams-poc/ingest`, so the only identifier we still
// need is a generic external reference (the Teams online-meeting id, or the
// join URL, or whatever key the flow correlates on).
//
//   graph_online_meeting_id  ->  external_ref   (kept, renamed)
//   graph_organizer_id       ->  dropped
//   graph_transcript_id      ->  dropped
//
// `poc_meetings` is a standalone POC table with no downstream consumers, so
// this is safe. Guarded so it is a no-op if partially applied.
const UP_SQL: &str = r#"
ALTER TABLE poc_meetings RENAME COLUMN graph_online_meeting_id TO external_ref;
ALTER TABLE poc_meetings DROP COLUMN IF EXISTS graph_organizer_id;
ALTER TABLE poc_meetings DROP COLUMN IF EXISTS graph_transcript_id;
ALTER INDEX IF EXISTS ix_poc_meetings_graph_id RENAME TO ix_poc_meetings_external_ref;
"#;

const DOWN_SQL: &str = r#"
ALTER INDEX IF EXISTS ix_poc_meetings_external_ref RENAME TO ix_poc_meetings_graph_id;
ALTER TABLE poc_meetings RENAME COLUMN external_ref TO graph_online_meeting_id;
ALTER TABLE poc_meetings ADD COLUMN IF NOT EXISTS graph_organizer_id  VARCHAR(128);
ALTER TABLE poc_meetings ADD COLUMN IF NOT EXISTS graph_transcript_id VARCHAR(512);
"#;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Already migrated? (column renamed away) → no-op.
        if !manager.has_column("poc_meetings", "graph_online_meeting_id").await? {
            return Ok(());
        }
        manager
            .get_connection()
            .execute_unprepared(UP_SQL)
            .await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(DOWN_SQL)
            .await?;
        Ok(())
    }
}
