-- ═══════════════════════════════════════════════════════════════════════════
-- Align the legacy remote `governance` DB enum types with the merged Rust
-- branch (poc/teams-meeting-vtt).
--
-- The Rust entities (src/entities/sea_orm_active_enums.rs) expect:
--   * type names  : snake_case   (user_role, project_status, ...)
--   * label values: lowercase    (admin, project_manager, ...)
--     EXCEPT gate_code, whose labels stay uppercase (A..S, CAB).
--
-- The legacy DB currently has:
--   * type names  : concatenated (userrole, projectstatus, ...)
--   * label values: UPPERCASE    (ADMIN, PROJECT_MANAGER, ...)
--
-- ALTER TYPE ... RENAME VALUE / RENAME TO are metadata-only: existing rows
-- keep working, no data is rewritten, no column is dropped. Fully reversible
-- (swap the names back).
--
-- ⚠  SHARED SCHEMA. Any other client of this database (e.g. the legacy
--    FastAPI backend) that expects `userrole` / 'ADMIN' will break after this.
--    Run only if the Rust backend is the sole consumer of this DB.
--
-- Idempotent: every step is guarded, safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Rename the enum TYPES: <concat> -> <snake_case> ────────────────────
DO $$
DECLARE
    r record;
    renames text[][] := ARRAY[
        ['userrole','user_role'],
        ['projectstatus','project_status'],
        ['projectpriority','project_priority'],
        ['projectrisk','project_risk'],
        ['workflowstagestatus','workflow_stage_status'],
        ['taskstatus','task_status'],
        ['approvaldecision','approval_decision'],
        ['notificationtype','notification_type'],
        ['gatecode','gate_code']
    ];
    i int;
BEGIN
    FOR i IN 1 .. array_length(renames, 1) LOOP
        IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                   WHERE n.nspname = 'public' AND t.typname = renames[i][1])
           AND NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                   WHERE n.nspname = 'public' AND t.typname = renames[i][2])
        THEN
            EXECUTE format('ALTER TYPE public.%I RENAME TO %I', renames[i][1], renames[i][2]);
            RAISE NOTICE 'renamed type % -> %', renames[i][1], renames[i][2];
        END IF;
    END LOOP;
END $$;

-- ── 2. Rename LABEL VALUES to lowercase (all enums except gate_code) ──────
DO $$
DECLARE
    pair text[];
    pairs text[][] := ARRAY[
        -- enum_type              , OLD_LABEL           , new_label
        ['user_role','ADMIN','admin'],
        ['user_role','PROJECT_MANAGER','project_manager'],
        ['user_role','BTA','bta'],
        ['user_role','EPMO','epmo'],
        ['user_role','FINANCE','finance'],
        ['user_role','VENDOR_SCREENING','vendor_screening'],
        ['user_role','ANALYSIS_TEAM','analysis_team'],
        ['user_role','EAC','eac'],
        ['user_role','CAB','cab'],
        ['user_role','SECURITY','security'],
        ['user_role','TAF','taf'],
        ['user_role','TRC','trc'],
        ['user_role','PIC','pic'],
        ['user_role','VIEWER','viewer'],

        ['project_status','DRAFT','draft'],
        ['project_status','ACTIVE','active'],
        ['project_status','ON_HOLD','on_hold'],
        ['project_status','IN_DELIVERY','in_delivery'],
        ['project_status','COMPLETED','completed'],
        ['project_status','CANCELLED','cancelled'],
        ['project_status','ARCHIVED','archived'],

        ['project_priority','CRITICAL','critical'],
        ['project_priority','HIGH','high'],
        ['project_priority','MEDIUM','medium'],
        ['project_priority','LOW','low'],

        ['project_risk','VERY_HIGH','very_high'],
        ['project_risk','HIGH','high'],
        ['project_risk','MEDIUM','medium'],
        ['project_risk','LOW','low'],

        ['task_status','PENDING','pending'],
        ['task_status','IN_PROGRESS','in_progress'],
        ['task_status','COMPLETED','completed'],
        ['task_status','OVERDUE','overdue'],
        ['task_status','CANCELLED','cancelled'],

        ['approval_decision','APPROVED','approved'],
        ['approval_decision','REJECTED','rejected'],
        ['approval_decision','NEEDS_INFO','needs_info'],
        ['approval_decision','DEFERRED','deferred'],

        ['notification_type','PROJECT_CREATED','project_created'],
        ['notification_type','TASK_ASSIGNED','task_assigned'],
        ['notification_type','TASK_COMPLETED','task_completed'],
        ['notification_type','APPROVAL_REQUIRED','approval_required'],
        ['notification_type','APPROVED','approved'],
        ['notification_type','REJECTED','rejected'],
        ['notification_type','OVERDUE','overdue'],
        ['notification_type','STAGE_ADVANCED','stage_advanced'],
        ['notification_type','COMMENT_ADDED','comment_added'],

        ['workflow_stage_status','PENDING','pending'],
        ['workflow_stage_status','ACTIVE','active'],
        ['workflow_stage_status','COMPLETED','completed'],
        ['workflow_stage_status','SKIPPED','skipped'],
        ['workflow_stage_status','BLOCKED','blocked']
    ];
BEGIN
    FOREACH pair SLICE 1 IN ARRAY pairs LOOP
        IF EXISTS (
            SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = pair[1] AND e.enumlabel = pair[2]
        ) AND NOT EXISTS (
            SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = pair[1] AND e.enumlabel = pair[3]
        ) THEN
            EXECUTE format('ALTER TYPE public.%I RENAME VALUE %L TO %L', pair[1], pair[2], pair[3]);
            RAISE NOTICE 'renamed %.% -> %', pair[1], pair[2], pair[3];
        END IF;
    END LOOP;
END $$;

-- ── 3. workflow_stage_status: add the labels the merged branch introduced ─
--     (V1's phase-based engine; existing rows keep their old lowercase labels)
ALTER TYPE public.workflow_stage_status ADD VALUE IF NOT EXISTS 'locked';
ALTER TYPE public.workflow_stage_status ADD VALUE IF NOT EXISTS 'eligible';
ALTER TYPE public.workflow_stage_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE public.workflow_stage_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE public.workflow_stage_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE public.workflow_stage_status ADD VALUE IF NOT EXISTS 'changes_requested';

COMMIT;

-- ── verify ──────────────────────────────────────────────────────────────
SELECT t.typname,
       string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS labels
FROM   pg_type t
JOIN   pg_enum e ON e.enumtypid = t.oid
JOIN   pg_namespace n ON n.oid = t.typnamespace
WHERE  n.nspname = 'public'
GROUP  BY t.typname
ORDER  BY t.typname;
