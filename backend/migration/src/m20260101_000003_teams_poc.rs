use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

// POC-only table. Deliberately standalone (no FK to `projects`) so the Teams
// meeting / VTT automation POC can be run, demoed and torn down without
// touching the governance schema. If the POC graduates, this collapses into
// the real `meetings` table from the legacy backend.
const UP_SQL: &str = r#"
CREATE TABLE poc_meetings (
    id                       UUID PRIMARY KEY,
    subject                  VARCHAR(300) NOT NULL,
    source                   VARCHAR(30)  NOT NULL DEFAULT 'local_stub',
    status                   VARCHAR(30)  NOT NULL DEFAULT 'scheduled',

    start_time               TIMESTAMPTZ,
    end_time                 TIMESTAMPTZ,
    organizer_email          VARCHAR(255),

    graph_online_meeting_id  VARCHAR(512),
    graph_organizer_id       VARCHAR(128),
    graph_transcript_id      VARCHAR(512),
    join_url                 VARCHAR(1024),

    transcript_vtt           TEXT,
    transcript_text          TEXT,

    summary                  TEXT,
    decisions                JSONB NOT NULL DEFAULT '[]'::jsonb,
    action_items             JSONB NOT NULL DEFAULT '[]'::jsonb,
    agenda_items             JSONB NOT NULL DEFAULT '[]'::jsonb,
    contains_process_flow    BOOLEAN NOT NULL DEFAULT false,
    process_name             VARCHAR(300),
    bpmn_xml                 TEXT,
    bpmn_status              VARCHAR(30),

    error_message            TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ
);
CREATE INDEX ix_poc_meetings_graph_id ON poc_meetings(graph_online_meeting_id);
CREATE INDEX ix_poc_meetings_status   ON poc_meetings(status);
"#;

const DOWN_SQL: &str = "DROP TABLE IF EXISTS poc_meetings CASCADE;";

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        if manager.has_table("poc_meetings").await? {
            return Ok(());
        }
        manager.get_connection().execute_unprepared(UP_SQL).await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.get_connection().execute_unprepared(DOWN_SQL).await?;
        Ok(())
    }
}
