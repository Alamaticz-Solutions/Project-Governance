use chrono::{DateTime, FixedOffset};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::entities::audit_history;

#[derive(Debug, Serialize)]
pub struct AuditHistoryResponse {
    pub id: Uuid,
    pub project_id: Option<Uuid>,
    pub entity_type: String,
    pub entity_id: String,
    pub action: String,
    pub old_values: Option<Value>,
    pub new_values: Option<Value>,
    pub performed_by_id: Option<Uuid>,
    pub performed_at: DateTime<FixedOffset>,
}

impl From<audit_history::Model> for AuditHistoryResponse {
    fn from(a: audit_history::Model) -> Self {
        Self {
            id: a.id,
            project_id: a.project_id,
            entity_type: a.entity_type,
            entity_id: a.entity_id,
            action: a.action,
            old_values: a.old_values,
            new_values: a.new_values,
            performed_by_id: a.performed_by_id,
            performed_at: a.performed_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    pub project_id: Option<Uuid>,
    pub entity_type: Option<String>,
}
