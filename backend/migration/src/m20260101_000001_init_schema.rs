use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

const UP_SQL: &str = r#"
-- ══════════════════════════════════════════════════════════════════
-- ENUM TYPES
-- ══════════════════════════════════════════════════════════════════
DROP TYPE IF EXISTS gate_code CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS approval_decision CASCADE;
DROP TYPE IF EXISTS task_status CASCADE;
DROP TYPE IF EXISTS workflow_stage_status CASCADE;
DROP TYPE IF EXISTS project_risk CASCADE;
DROP TYPE IF EXISTS project_priority CASCADE;
DROP TYPE IF EXISTS project_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

CREATE TYPE user_role AS ENUM (
    'admin','project_manager','bta','epmo','finance','vendor_screening',
    'analysis_team','eac','cab','security','taf','trc','pic','viewer'
);

CREATE TYPE project_status AS ENUM (
    'draft','active','on_hold','completed','cancelled','archived','in_delivery'
);

CREATE TYPE project_priority AS ENUM ('critical','high','medium','low');

CREATE TYPE project_risk AS ENUM ('very_high','high','medium','low');

CREATE TYPE workflow_stage_status AS ENUM (
    'locked','eligible','in_progress','pending_approval','completed','skipped','rejected','changes_requested'
);

CREATE TYPE task_status AS ENUM (
    'pending','in_progress','completed','overdue','cancelled'
);

CREATE TYPE approval_decision AS ENUM (
    'approved','rejected','needs_info','deferred'
);

CREATE TYPE notification_type AS ENUM (
    'project_created','task_assigned','task_completed','approval_required',
    'approved','rejected','overdue','stage_advanced','comment_added'
);

CREATE TYPE gate_code AS ENUM (
    'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','CAB'
);

-- ══════════════════════════════════════════════════════════════════
-- USERS & ROLES
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE users (
    id              UUID PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    username        VARCHAR(100) NOT NULL UNIQUE,
    full_name       VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'viewer',
    department      VARCHAR(100),
    job_title       VARCHAR(150),
    phone           VARCHAR(30),
    avatar_url      VARCHAR(500),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_verified     BOOLEAN NOT NULL DEFAULT false,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ
);
CREATE INDEX ix_users_email ON users(email);
CREATE INDEX ix_users_username ON users(username);
CREATE INDEX ix_users_email_active ON users(email, is_active);

-- ══════════════════════════════════════════════════════════════════
-- PROJECTS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE projects (
    id                          UUID PRIMARY KEY,
    project_number              VARCHAR(20) NOT NULL UNIQUE,
    project_name                VARCHAR(300) NOT NULL,
    business_unit               VARCHAR(150) NOT NULL,
    department                  VARCHAR(150),
    manager_id                  UUID NOT NULL REFERENCES users(id),
    sponsor_name                VARCHAR(200),
    sponsor_email               VARCHAR(255),
    description                 TEXT,
    problem_statement           TEXT,
    business_value              TEXT,
    strategic_alignment         TEXT,
    requestor_name              VARCHAR(255),
    request_type                VARCHAR(100),
    desired_outcome             TEXT,
    what_do_you_do_today        TEXT,
    what_transpires_if_nothing  TEXT,
    notes                       TEXT,
    budget_estimated            DOUBLE PRECISION,
    budget_approved             DOUBLE PRECISION,
    budget_type                 VARCHAR(50),
    requested_start_date        TIMESTAMPTZ,
    requested_end_date          TIMESTAMPTZ,
    actual_start_date           TIMESTAMPTZ,
    actual_end_date             TIMESTAMPTZ,
    priority                    project_priority NOT NULL DEFAULT 'medium',
    risk_level                  project_risk DEFAULT 'medium',
    status                      project_status NOT NULL DEFAULT 'draft',
    it_involvement              BOOLEAN DEFAULT false,
    vendor_required              BOOLEAN DEFAULT false,
    has_phi_data                BOOLEAN DEFAULT false,
    is_clinical                 BOOLEAN DEFAULT false,
    is_hipaa_applicable         BOOLEAN DEFAULT false,
    smartsheet_row_id           VARCHAR(100),
    smartsheet_sheet_url        VARCHAR(500),
    jira_ticket_id              VARCHAR(100),
    duplicate_of_id             UUID REFERENCES projects(id),
    is_duplicate                BOOLEAN DEFAULT false,
    ai_extracted_data           JSONB,
    current_stage                VARCHAR(100),
    current_status               VARCHAR(50),
    current_owner_role           VARCHAR(100),
    last_stage_completed         VARCHAR(100),
    workflow_status              VARCHAR(50) DEFAULT 'In Progress',
    submitted_at                 TIMESTAMPTZ,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                   TIMESTAMPTZ,
    archived_at                  TIMESTAMPTZ
);
CREATE INDEX ix_projects_number ON projects(project_number);
CREATE INDEX ix_projects_status_priority ON projects(status, priority);
CREATE INDEX ix_projects_manager ON projects(manager_id);
CREATE INDEX ix_projects_created ON projects(created_at);

CREATE TABLE project_stakeholders (
    id          UUID PRIMARY KEY,
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id),
    role        VARCHAR(100),
    added_at    TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_project_stakeholder UNIQUE (project_id, user_id)
);

CREATE TABLE project_fields (
    id                 UUID PRIMARY KEY,
    project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    field_name         VARCHAR(255) NOT NULL,
    field_value        JSONB,
    is_ai_suggested    BOOLEAN DEFAULT false,
    ai_confidence      DOUBLE PRECISION,
    ai_source_document VARCHAR(500),
    ai_extracted_text  TEXT,
    updated_at         TIMESTAMPTZ DEFAULT now(),
    updated_by_id      UUID REFERENCES users(id),
    CONSTRAINT uq_project_field UNIQUE (project_id, field_name)
);

-- ══════════════════════════════════════════════════════════════════
-- WORKFLOW ENGINE (schema fidelity only — not exercised by current business logic)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE workflow_definitions (
    id          UUID PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    version     INTEGER DEFAULT 1,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE workflow_stage_definitions (
    id                  UUID PRIMARY KEY,
    workflow_id         UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    stage_name          VARCHAR(200) NOT NULL,
    stage_code          VARCHAR(50) NOT NULL,
    sequence_order      INTEGER NOT NULL,
    description         TEXT,
    phase_name          VARCHAR(100) NOT NULL,
    assigned_roles      JSONB,
    prerequisites       JSONB,
    conditions          JSONB,
    parallel_execution  BOOLEAN DEFAULT false,
    auto_advance        BOOLEAN DEFAULT false,
    sla_days            INTEGER,
    checklist_template  JSONB,
    CONSTRAINT uq_workflow_stage_code UNIQUE (workflow_id, stage_code)
);
CREATE INDEX ix_stage_def_order ON workflow_stage_definitions(workflow_id, sequence_order);

CREATE TABLE workflow_instances (
    id                UUID PRIMARY KEY,
    project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    definition_id     UUID NOT NULL REFERENCES workflow_definitions(id),
    current_stage_id  UUID,
    status            VARCHAR(50) DEFAULT 'active',
    started_at        TIMESTAMPTZ DEFAULT now(),
    completed_at      TIMESTAMPTZ
);

CREATE TABLE workflow_stages (
    id                    UUID PRIMARY KEY,
    workflow_instance_id  UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    stage_definition_id   UUID NOT NULL REFERENCES workflow_stage_definitions(id),
    stage_name            VARCHAR(200) NOT NULL,
    stage_code            VARCHAR(50) NOT NULL,
    sequence_order        INTEGER NOT NULL,
    status                workflow_stage_status NOT NULL DEFAULT 'locked',
    started_at            TIMESTAMPTZ,
    completed_at          TIMESTAMPTZ,
    due_date              TIMESTAMPTZ,
    notes                 TEXT
);
CREATE INDEX ix_wf_stage_status ON workflow_stages(workflow_instance_id, status);

ALTER TABLE workflow_instances
    ADD CONSTRAINT fk_wf_instance_current_stage
    FOREIGN KEY (current_stage_id) REFERENCES workflow_stages(id);

CREATE TABLE workflow_tasks (
    id                UUID PRIMARY KEY,
    stage_id          UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
    task_name         VARCHAR(300) NOT NULL,
    task_description  TEXT,
    task_type         VARCHAR(50),
    assigned_role     user_role,
    status            task_status NOT NULL DEFAULT 'pending',
    is_required       BOOLEAN DEFAULT true,
    sequence_order    INTEGER DEFAULT 0,
    due_date          TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    notes             TEXT,
    metadata          JSONB
);
CREATE INDEX ix_task_stage_status ON workflow_tasks(stage_id, status);

CREATE TABLE task_assignments (
    id             UUID PRIMARY KEY,
    task_id        UUID NOT NULL REFERENCES workflow_tasks(id) ON DELETE CASCADE,
    assignee_id    UUID NOT NULL REFERENCES users(id),
    assigned_at    TIMESTAMPTZ DEFAULT now(),
    assigned_by_id UUID REFERENCES users(id),
    accepted_at    TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    notes          TEXT,
    CONSTRAINT uq_task_assignee UNIQUE (task_id, assignee_id)
);

CREATE TABLE checklist_items (
    id              UUID PRIMARY KEY,
    task_id         UUID NOT NULL REFERENCES workflow_tasks(id) ON DELETE CASCADE,
    item_text       VARCHAR(500) NOT NULL,
    is_completed    BOOLEAN DEFAULT false,
    completed_by_id UUID REFERENCES users(id),
    completed_at    TIMESTAMPTZ,
    sequence_order  INTEGER DEFAULT 0
);

-- ══════════════════════════════════════════════════════════════════
-- GATE REVIEWS
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE gate_reviews (
    id              UUID PRIMARY KEY,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    gate_code       gate_code NOT NULL,
    gate_name       VARCHAR(200) NOT NULL,
    committee       VARCHAR(200),
    assigned_role   user_role,
    status          VARCHAR(50) DEFAULT 'pending',
    decision        approval_decision,
    decision_by_id  UUID REFERENCES users(id),
    decision_at     TIMESTAMPTZ,
    decision_notes  TEXT,
    checklist_items JSONB,
    submitted_at    TIMESTAMPTZ DEFAULT now(),
    due_date        TIMESTAMPTZ,
    priority        project_priority
);
CREATE INDEX ix_gate_review_project_gate ON gate_reviews(project_id, gate_code);
CREATE INDEX ix_gate_review_status ON gate_reviews(status);

-- ══════════════════════════════════════════════════════════════════
-- RISK REGISTER / ATTACHMENTS / COMMENTS (schema fidelity only)
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE risk_items (
    id                UUID PRIMARY KEY,
    project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    risk_title        VARCHAR(300) NOT NULL,
    risk_description  TEXT,
    risk_category     VARCHAR(100),
    severity          project_risk NOT NULL,
    probability       VARCHAR(50),
    impact            VARCHAR(50),
    mitigation_plan   TEXT,
    owner_id          UUID REFERENCES users(id),
    status            VARCHAR(50) DEFAULT 'open',
    identified_at     TIMESTAMPTZ DEFAULT now(),
    resolved_at       TIMESTAMPTZ
);

CREATE TABLE attachments (
    id                  UUID PRIMARY KEY,
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_name           VARCHAR(500) NOT NULL,
    file_type           VARCHAR(100),
    file_size           INTEGER,
    s3_key              VARCHAR(1000),
    s3_url              VARCHAR(1000),
    upload_status       VARCHAR(50) DEFAULT 'pending',
    uploaded_by_id      UUID REFERENCES users(id),
    ai_extracted        BOOLEAN DEFAULT false,
    ai_extraction_data  JSONB,
    uploaded_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE comments (
    id              UUID PRIMARY KEY,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id         UUID REFERENCES workflow_tasks(id) ON DELETE CASCADE,
    gate_review_id  UUID REFERENCES gate_reviews(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES users(id),
    content         TEXT NOT NULL,
    parent_id       UUID REFERENCES comments(id),
    is_internal     BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);

-- ══════════════════════════════════════════════════════════════════
-- AUDIT HISTORY
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE audit_history (
    id               UUID PRIMARY KEY,
    project_id       UUID REFERENCES projects(id) ON DELETE CASCADE,
    entity_type      VARCHAR(100) NOT NULL,
    entity_id        VARCHAR(100) NOT NULL,
    action           VARCHAR(200) NOT NULL,
    old_values       JSONB,
    new_values       JSONB,
    performed_by_id  UUID REFERENCES users(id),
    ip_address       VARCHAR(50),
    user_agent       VARCHAR(500),
    performed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_project_date ON audit_history(project_id, performed_at);
CREATE INDEX ix_audit_entity ON audit_history(entity_type, entity_id);
CREATE INDEX ix_audit_date ON audit_history(performed_at);

-- ══════════════════════════════════════════════════════════════════
-- NOTIFICATIONS & EMAIL QUEUE
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE notifications (
    id                 UUID PRIMARY KEY,
    recipient_id       UUID NOT NULL REFERENCES users(id),
    project_id         UUID REFERENCES projects(id),
    notification_type  notification_type NOT NULL,
    title              VARCHAR(300) NOT NULL,
    message            TEXT NOT NULL,
    action_url         VARCHAR(500),
    is_read            BOOLEAN DEFAULT false,
    created_at         TIMESTAMPTZ DEFAULT now(),
    read_at            TIMESTAMPTZ
);
CREATE INDEX ix_notification_recipient_read ON notifications(recipient_id, is_read);

CREATE TABLE email_queue (
    id             UUID PRIMARY KEY,
    to_email       VARCHAR(255) NOT NULL,
    to_name        VARCHAR(200),
    subject        VARCHAR(500) NOT NULL,
    template_name  VARCHAR(100),
    template_data  JSONB,
    html_body      TEXT,
    text_body      TEXT,
    status         VARCHAR(50) DEFAULT 'pending',
    attempts       INTEGER DEFAULT 0,
    max_attempts   INTEGER DEFAULT 3,
    error_message  TEXT,
    scheduled_at   TIMESTAMPTZ DEFAULT now(),
    sent_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ix_email_queue_status ON email_queue(status, scheduled_at);

CREATE TABLE project_approvals (
    id                 UUID PRIMARY KEY,
    project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    approval_stage     VARCHAR(100) NOT NULL,
    assigned_role      user_role NOT NULL,
    assigned_user_id   UUID REFERENCES users(id),
    status             VARCHAR(50) NOT NULL DEFAULT 'Pending',
    decision           VARCHAR(50),
    comments           TEXT,
    approved_by        UUID REFERENCES users(id),
    approved_at        TIMESTAMPTZ,
    sequence_order     INTEGER NOT NULL DEFAULT 0,
    notification_sent  BOOLEAN NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ
);

-- ══════════════════════════════════════════════════════════════════
-- KNOWLEDGE BASE (RAG)
-- ══════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge_documents (
    id            UUID PRIMARY KEY,
    title         VARCHAR(500) NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    source_url    VARCHAR(1000),
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE knowledge_chunks (
    id             UUID PRIMARY KEY,
    document_id    UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_text     TEXT NOT NULL,
    metadata       JSONB,
    embedding      vector(1536),
    sequence_order INTEGER
);
"#;

const DOWN_SQL: &str = r#"
DROP TABLE IF EXISTS knowledge_chunks CASCADE;
DROP TABLE IF EXISTS knowledge_documents CASCADE;
DROP TABLE IF EXISTS project_approvals CASCADE;
DROP TABLE IF EXISTS email_queue CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS audit_history CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS risk_items CASCADE;
DROP TABLE IF EXISTS gate_reviews CASCADE;
DROP TABLE IF EXISTS checklist_items CASCADE;
DROP TABLE IF EXISTS task_assignments CASCADE;
DROP TABLE IF EXISTS workflow_tasks CASCADE;
DROP TABLE IF EXISTS workflow_stages CASCADE;
DROP TABLE IF EXISTS workflow_instances CASCADE;
DROP TABLE IF EXISTS workflow_stage_definitions CASCADE;
DROP TABLE IF EXISTS workflow_definitions CASCADE;
DROP TABLE IF EXISTS project_fields CASCADE;
DROP TABLE IF EXISTS project_stakeholders CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS gate_code;
DROP TYPE IF EXISTS notification_type;
DROP TYPE IF EXISTS approval_decision;
DROP TYPE IF EXISTS task_status;
DROP TYPE IF EXISTS workflow_stage_status;
DROP TYPE IF EXISTS project_risk;
DROP TYPE IF EXISTS project_priority;
DROP TYPE IF EXISTS project_status;
DROP TYPE IF EXISTS user_role;
"#;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Guards against this migration's `up()` being invoked more than once
        // for the same database (observed under some connection-pool/driver
        // combinations) — without this check a second invocation crashes with
        // "relation already exists" instead of being a harmless no-op.
        if manager.has_table("users").await? {
            return Ok(());
        }
        manager.get_connection().execute_unprepared(UP_SQL).await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        db.execute_unprepared(DOWN_SQL).await?;
        Ok(())
    }
}
