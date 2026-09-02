use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

/// Tables that no service reads or writes (verified by source review) and that
/// are dropped by this migration. See `DB_CLEANUP_PLAN.md` section 3.
///
/// `workflow_definitions` and `workflow_stage_definitions` were removed from
/// this list after inspecting the live production DB: they hold real rows
/// (1 and 19 respectively) even though current app code never reads them.
/// The safety guard below would abort on them anyway, but excluding them
/// keeps that abort from blocking every future deploy.
const UNUSED_TABLES: &[&str] = &[
    "knowledge_chunks",
    "knowledge_documents",
    "checklist_items",
    "task_assignments",
    "workflow_tasks",
    "workflow_stages",
    "workflow_instances",
    "risk_items",
    "attachments",
    "comments",
    "email_queue",
    "project_stakeholders",
    "project_fields",
];

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let conn = manager.get_connection();
        let backend = conn.get_database_backend();

        // ── SAFETY GUARD ──────────────────────────────────────────────
        // Refuse to drop any table that actually contains rows. On a fresh
        // or dev database every table is empty and this is a no-op. On a
        // database where one of these tables was somehow populated, the
        // migration aborts with a clear message instead of destroying data.
        for table in UNUSED_TABLES {
            let exists = manager.has_table(*table).await?;
            if !exists {
                continue;
            }
            let row = conn
                .query_one(sea_orm::Statement::from_string(
                    backend,
                    format!("SELECT count(*) AS c FROM \"{table}\""),
                ))
                .await?;
            let count: i64 = row
                .map(|r| r.try_get_by_index::<i64>(0))
                .transpose()?
                .unwrap_or(0);
            if count > 0 {
                return Err(DbErr::Custom(format!(
                    "Refusing to drop table `{table}`: it contains {count} row(s). \
                     This table is considered unused by the application. If the data \
                     is genuinely disposable, back it up and TRUNCATE the table, then \
                     re-run migrations. See DB_CLEANUP_PLAN.md section 3."
                )));
            }
        }

        // ── DROP ──────────────────────────────────────────────────────
        let sql = r#"
            DROP TABLE IF EXISTS knowledge_chunks CASCADE;
            DROP TABLE IF EXISTS knowledge_documents CASCADE;
            DROP TABLE IF EXISTS checklist_items CASCADE;
            DROP TABLE IF EXISTS task_assignments CASCADE;
            DROP TABLE IF EXISTS workflow_tasks CASCADE;
            DROP TABLE IF EXISTS workflow_stages CASCADE;
            DROP TABLE IF EXISTS workflow_instances CASCADE;
            DROP TABLE IF EXISTS risk_items CASCADE;
            DROP TABLE IF EXISTS attachments CASCADE;
            DROP TABLE IF EXISTS comments CASCADE;
            DROP TABLE IF EXISTS email_queue CASCADE;
            DROP TABLE IF EXISTS project_stakeholders CASCADE;
            DROP TABLE IF EXISTS project_fields CASCADE;
            DROP EXTENSION IF EXISTS vector;

            -- Enum types orphaned once the tables above were removed.
            DROP TYPE IF EXISTS workflow_stage_status CASCADE;
            DROP TYPE IF EXISTS task_status CASCADE;
        "#;
        conn.execute_unprepared(sql).await?;
        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        // Intentionally irreversible: these tables carried no application data.
        // Restore from the init migration's history if you truly need them back.
        Ok(())
    }
}
