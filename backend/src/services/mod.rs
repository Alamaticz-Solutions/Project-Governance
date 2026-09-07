//! Product-owned service layer.
//!
//! Add durable business workflows here and call them from product-owned
//! handlers. Keep framework/runtime access behind `crate::product_api`.
//!
//! Governance workflow engine (spec 002 / .appfw/specs):
//!   support                 shared helpers (actor, selection builders, user-id resolution)
//!   audit                   semantic governance events -> AuditEvent (append-only)
//!   notification            in-app notification fan-out -> Notification
//!   gate_eligibility        prerequisite evaluation over the seeded stage-definition DAG
//!   approval_state_machine  submit_decision / fast_track_complete / cancel
//!   workspace               project workspace payload assembly
//!   meeting_scheduling      M10 / G1 governed Graph writes (schedule/cancel a Teams meeting)
//!   ai_extraction           spec 004 AI-egress boundary: PHI gate -> OpenAI document extraction

pub mod ai_extraction;
pub mod approval_state_machine;
pub mod audit;
pub mod gate_eligibility;
pub mod gate_review;
pub mod graph;
pub mod meeting_agent;
pub mod meeting_scheduling;
pub mod notification;
pub mod support;
pub mod transition;
pub mod workspace;
