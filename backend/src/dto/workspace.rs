use chrono::{DateTime, FixedOffset};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::entities::gate_submissions;

use super::projects::ProjectResponse;

#[derive(Debug, Serialize)]
pub struct GateSubmissionResponse {
    pub stage: String,
    pub status: String,
    pub decision: Option<String>,
    pub data: Value,
    pub submitted_at: Option<DateTime<FixedOffset>>,
}

impl From<gate_submissions::Model> for GateSubmissionResponse {
    fn from(m: gate_submissions::Model) -> Self {
        Self {
            stage: m.stage,
            status: m.status,
            decision: m.decision,
            data: m.data,
            submitted_at: m.submitted_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct WorkspaceResponse {
    pub project: ProjectResponse,
    pub stage_order: Vec<&'static str>,
    pub submissions: Vec<GateSubmissionResponse>,
}

#[derive(Debug, Deserialize)]
pub struct SaveStageRequest {
    pub data: Value,
    pub decision: Option<String>,
    #[serde(default)]
    pub advance: bool,
}
