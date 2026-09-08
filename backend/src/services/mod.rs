//! Business-workflow service layer for the governance engine.
//!
//! Durable business workflows live here and are called from the handlers.
//! Framework/runtime access stays behind `crate::product_api`.
//!
//! Governance workflow engine (spec 002 / .appfw/specs):
//!   support                 shared helpers (actor, selection builders, user-id resolution)
//!   audit                   semantic governance events -> AuditEvent (append-only)
//!   notification            in-app notification fan-out -> Notification
//!   gate_eligibility        prerequisite evaluation over the seeded stage-definition DAG
//!   approval_state_machine  submit_decision / fast_track_complete / cancel
//!   gate_review             per-gate decision submission
//!   transition              per-gate lifecycle transitions on `WorkflowStage`
//!   workspace               project workspace payload assembly
//!   meeting_scheduling      G1 governed Graph writes (schedule/cancel a Teams meeting)
//!   meeting_transcript      `Meeting.process_transcript`: fetch transcript -> parse -> AI insights
//!   graph                   Microsoft Graph external-API provider (client, auth, reads, writes)
//!   ai_extraction           spec 004 AI-egress boundary: PHI gate -> OpenAI document extraction
//!   directory               live Microsoft Graph org-directory search (Meeting Center attendees)

pub mod ai_extraction;
pub mod approval_state_machine;
pub mod audit;
pub mod directory;
pub mod gate_eligibility;
pub mod gate_review;
pub mod graph;
pub mod meeting_transcript;
pub mod meeting_scheduling;
pub mod notification;
pub mod support;
pub mod transition;
pub mod workspace;
