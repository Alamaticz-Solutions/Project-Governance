use serde::Serialize;
use std::collections::HashMap;

use super::projects::PendingApprovalItem;

#[derive(Debug, Serialize)]
pub struct DashboardResponse {
    pub active_projects: u64,
    pub completed_projects: u64,
    pub on_hold_projects: u64,
    pub total_projects: u64,
    pub status_breakdown: HashMap<String, u64>,
    pub priority_breakdown: HashMap<String, u64>,
    pub high_risk_count: u64,
    pub recent_gate_reviews: Vec<super::gate_review::GateReviewResponse>,
    pub my_pending_tasks: Vec<PendingApprovalItem>,
}
