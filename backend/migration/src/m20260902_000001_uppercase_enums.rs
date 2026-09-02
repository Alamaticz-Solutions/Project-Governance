use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

// Aligns the database's Postgres enum types with the entity layer after
// `origin/Dev` commit bf0a2ed switched every enum mapping to
// SCREAMING_SNAKE_CASE labels + underscore-free type names
// (`user_role`/`admin` -> `userrole`/`ADMIN`).
//
// On a database still carrying the old lowercase types this migration:
//   1. (re)creates the UPPERCASE target types if missing,
//   2. retypes each live enum column with `USING upper(col::text)::target`
//      (every old label maps to its target by simple upper-casing),
//   3. restores the column defaults in their new casing,
//   4. drops the now-unused lowercase types.
//
// Guarded: if `user_role` no longer exists (a fresh DB where
// m20260101_000001_init_schema already created the UPPERCASE types), it is a
// no-op.
const UP_SQL: &str = r#"
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    RETURN;
  END IF;

  -- 1. target types (already present as orphans on the shared DB; created here
  --    for a fresh DB or a partial state).
  BEGIN CREATE TYPE userrole AS ENUM ('ADMIN','PROJECT_MANAGER','BTA','EPMO','FINANCE','VENDOR_SCREENING','ANALYSIS_TEAM','EAC','CAB','SECURITY','TAF','TRC','PIC','VIEWER'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE TYPE projectstatus AS ENUM ('DRAFT','ACTIVE','ON_HOLD','IN_DELIVERY','COMPLETED','CANCELLED','ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE TYPE projectpriority AS ENUM ('CRITICAL','HIGH','MEDIUM','LOW'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE TYPE projectrisk AS ENUM ('VERY_HIGH','HIGH','MEDIUM','LOW'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE TYPE approvaldecision AS ENUM ('APPROVED','REJECTED','NEEDS_INFO','DEFERRED'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE TYPE notificationtype AS ENUM ('PROJECT_CREATED','TASK_ASSIGNED','TASK_COMPLETED','APPROVAL_REQUIRED','APPROVED','REJECTED','OVERDUE','STAGE_ADVANCED','COMMENT_ADDED'); EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN CREATE TYPE gatecode AS ENUM ('A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','CAB'); EXCEPTION WHEN duplicate_object THEN NULL; END;

  -- 2. drop defaults, retype columns, 3. restore defaults (uppercased)
  ALTER TABLE users            ALTER COLUMN role          DROP DEFAULT;
  ALTER TABLE projects         ALTER COLUMN status        DROP DEFAULT;
  ALTER TABLE projects         ALTER COLUMN priority      DROP DEFAULT;
  ALTER TABLE projects         ALTER COLUMN risk_level    DROP DEFAULT;

  ALTER TABLE users            ALTER COLUMN role          TYPE userrole        USING upper(role::text)::userrole;
  ALTER TABLE gate_reviews     ALTER COLUMN assigned_role TYPE userrole        USING upper(assigned_role::text)::userrole;
  ALTER TABLE project_approvals ALTER COLUMN assigned_role TYPE userrole       USING upper(assigned_role::text)::userrole;
  ALTER TABLE projects         ALTER COLUMN status        TYPE projectstatus   USING upper(status::text)::projectstatus;
  ALTER TABLE projects         ALTER COLUMN priority      TYPE projectpriority USING upper(priority::text)::projectpriority;
  ALTER TABLE gate_reviews     ALTER COLUMN priority      TYPE projectpriority USING upper(priority::text)::projectpriority;
  ALTER TABLE projects         ALTER COLUMN risk_level    TYPE projectrisk     USING upper(risk_level::text)::projectrisk;
  ALTER TABLE gate_reviews     ALTER COLUMN decision      TYPE approvaldecision USING upper(decision::text)::approvaldecision;
  ALTER TABLE gate_reviews     ALTER COLUMN gate_code     TYPE gatecode        USING upper(gate_code::text)::gatecode;
  ALTER TABLE notifications    ALTER COLUMN notification_type TYPE notificationtype USING upper(notification_type::text)::notificationtype;

  ALTER TABLE users    ALTER COLUMN role       SET DEFAULT 'VIEWER';
  ALTER TABLE projects ALTER COLUMN status     SET DEFAULT 'DRAFT';
  ALTER TABLE projects ALTER COLUMN priority   SET DEFAULT 'MEDIUM';
  ALTER TABLE projects ALTER COLUMN risk_level SET DEFAULT 'MEDIUM';

  -- 4. drop the now-unused lowercase types.
  --    workflow_stage_status / task_status are included: on the target DB the
  --    workflow_stages / workflow_tasks tables were already removed and no
  --    column is typed with them, while the entity layer now expects
  --    `workflowstagestatus` / `taskstatus` (5 UPPERCASE labels). The label
  --    sets differ (locked/eligible/… vs PENDING/ACTIVE/…), so a fresh-DB
  --    build that actually needs those tables must (re)create the enums with
  --    the new labels + a value mapping in m20260101_000001_init_schema — this
  --    migration only removes the dead lowercase types where they exist.
  -- Each drop is individually guarded: `IF EXISTS` covers absence, and the
  -- EXCEPTION covers a type that some column on this particular DB is still
  -- typed with (skip it rather than abort the whole migration + startup).
  BEGIN DROP TYPE IF EXISTS user_role;               EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END;
  BEGIN DROP TYPE IF EXISTS project_status;          EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END;
  BEGIN DROP TYPE IF EXISTS project_priority;        EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END;
  BEGIN DROP TYPE IF EXISTS project_risk;            EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END;
  BEGIN DROP TYPE IF EXISTS approval_decision;       EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END;
  BEGIN DROP TYPE IF EXISTS notification_type;       EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END;
  BEGIN DROP TYPE IF EXISTS gate_code;               EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END;
  BEGIN DROP TYPE IF EXISTS checklist_result_status; EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END;
  BEGIN DROP TYPE IF EXISTS workflow_stage_status;   EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END;
  BEGIN DROP TYPE IF EXISTS task_status;             EXCEPTION WHEN dependent_objects_still_exist THEN NULL; END;
END $$;
"#;

// Not reversed: this is a forward-only alignment. A rollback would have to
// recreate the lowercase types and lowercase all the data again, which is not
// something any environment needs.
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
