// These tables mirror the legacy Postgres schema for fidelity (workflow
// engine, risk register, attachments, comments, email queue) but — matching
// the app's actual current behavior — aren't wired into any service yet.
#![allow(dead_code)]

pub mod sea_orm_active_enums;

pub mod attachments;
pub mod audit_history;
pub mod checklist_items;
pub mod comments;
pub mod email_queue;
pub mod gate_reviews;
pub mod gate_submissions;
pub mod notifications;
pub mod poc_meetings;
pub mod project_approvals;
pub mod project_stakeholders;
pub mod projects;
pub mod project_fields;
pub mod risk_items;
pub mod task_assignments;
pub mod users;
pub mod workflow_definitions;
pub mod workflow_stage_definitions;
pub mod workflow_stages;
pub mod workflow_tasks;
pub mod workflow_instances;
pub mod knowledge_documents;
pub mod knowledge_chunks;
