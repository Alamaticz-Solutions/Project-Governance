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

pub mod approval_state_machine;
pub mod audit;
pub mod gate_eligibility;
pub mod notification;
pub mod support;
pub mod workspace;
