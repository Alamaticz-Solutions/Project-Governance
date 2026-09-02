use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

/// No-op placeholder. This version is already recorded as applied in
/// `seaql_migrations` on the shared production database — it was created
/// by a separate "Teams meeting" feature/codebase, not this one. The file
/// itself was never part of this repo, so SeaORM has nothing to run here;
/// this stub exists only so `Migrator::up` recognizes the recorded version
/// and doesn't error with "migration file is missing". Do not add real
/// schema changes here — the actual `meetings`/`poc_meetings`/etc. tables
/// are owned and evolved by that other codebase.
#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Ok(())
    }
}
