use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

// Adds a JSONB list of attendee email addresses, set by the portal when
// scheduling and forwarded to the Power Automate flow so it can populate the
// Teams meeting's Required Attendees. External (non-org) addresses are
// allowed — Outlook's calendar-invite mechanism, which "Create a Teams
// meeting" is built on, supports them.
const UP_SQL: &str = r#"
ALTER TABLE poc_meetings ADD COLUMN IF NOT EXISTS attendees JSONB NOT NULL DEFAULT '[]'::jsonb;
"#;

const DOWN_SQL: &str = r#"
ALTER TABLE poc_meetings DROP COLUMN IF EXISTS attendees;
"#;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        if manager.has_column("poc_meetings", "attendees").await? {
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
