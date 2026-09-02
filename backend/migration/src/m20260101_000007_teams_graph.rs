use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

// Re-introduces Microsoft Graph identifiers on `poc_meetings` (the POC switched
// Graph -> Power Automate in migration 0004; this switches it back, direct
// Graph API this time) and adds `graph_subscriptions` to track the tenant-wide
// transcript change-notification subscription.
//
//   graph_event_id           calendar event id (for cancel/delete)
//   graph_online_meeting_id  the `MSo…` onlineMeeting id — transcript correlation key
//   graph_organizer_user_id  which mailbox hosts the meeting
//   graph_transcript_id      last processed transcript id (idempotency aid)
//
// `external_ref` (from migration 0004) is kept and mirrors
// `graph_online_meeting_id` for display continuity.
const UP_SQL: &str = r#"
ALTER TABLE poc_meetings ADD COLUMN IF NOT EXISTS graph_event_id          VARCHAR(512);
ALTER TABLE poc_meetings ADD COLUMN IF NOT EXISTS graph_online_meeting_id VARCHAR(512);
ALTER TABLE poc_meetings ADD COLUMN IF NOT EXISTS graph_organizer_user_id VARCHAR(128);
ALTER TABLE poc_meetings ADD COLUMN IF NOT EXISTS graph_transcript_id     VARCHAR(512);
CREATE INDEX IF NOT EXISTS ix_poc_meetings_graph_online_meeting_id
    ON poc_meetings(graph_online_meeting_id);

CREATE TABLE IF NOT EXISTS graph_subscriptions (
    id                   UUID PRIMARY KEY,
    subscription_id      VARCHAR(128)  NOT NULL UNIQUE,
    resource             VARCHAR(300)  NOT NULL,
    notification_url     VARCHAR(1024) NOT NULL,
    client_state         VARCHAR(128)  NOT NULL,
    expiration_date_time TIMESTAMPTZ   NOT NULL,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_graph_subscriptions_resource
    ON graph_subscriptions(resource);
"#;

const DOWN_SQL: &str = r#"
DROP TABLE IF EXISTS graph_subscriptions;
DROP INDEX IF EXISTS ix_poc_meetings_graph_online_meeting_id;
ALTER TABLE poc_meetings DROP COLUMN IF EXISTS graph_event_id;
ALTER TABLE poc_meetings DROP COLUMN IF EXISTS graph_online_meeting_id;
ALTER TABLE poc_meetings DROP COLUMN IF EXISTS graph_organizer_user_id;
ALTER TABLE poc_meetings DROP COLUMN IF EXISTS graph_transcript_id;
"#;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        if manager
            .has_column("poc_meetings", "graph_online_meeting_id")
            .await?
            && manager.has_table("graph_subscriptions").await?
        {
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
