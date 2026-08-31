use chrono::{DateTime, FixedOffset};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::entities::gate_reviews;

#[derive(Debug, Serialize)]
pub struct GateReviewResponse {
    pub id: Uuid,
    pub project_id: Uuid,
    pub gate_code: String,
    pub gate_name: String,
    pub committee: Option<String>,
    pub assigned_role: Option<String>,
    pub status: Option<String>,
    pub decision: Option<String>,
    pub decision_by_id: Option<Uuid>,
    pub decision_at: Option<DateTime<FixedOffset>>,
    pub decision_notes: Option<String>,
    pub submitted_at: Option<DateTime<FixedOffset>>,
    pub due_date: Option<DateTime<FixedOffset>>,
    pub priority: Option<String>,
}

impl From<gate_reviews::Model> for GateReviewResponse {
    fn from(g: gate_reviews::Model) -> Self {
        Self {
            id: g.id,
            project_id: g.project_id,
            gate_code: format!("{:?}", g.gate_code),
            gate_name: g.gate_name,
            committee: g.committee,
            assigned_role: g.assigned_role.map(|r| r.as_str().to_string()),
            status: g.status,
            decision: g.decision.map(|d| format!("{:?}", d)),
            decision_by_id: g.decision_by_id,
            decision_at: g.decision_at,
            decision_notes: g.decision_notes,
            submitted_at: g.submitted_at,
            due_date: g.due_date,
            priority: g.priority.map(|p| format!("{:?}", p)),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct GateDecisionRequest {
    pub decision: String,
    pub notes: Option<String>,
}
