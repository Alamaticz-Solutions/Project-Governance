//! Semantic governance audit events (design §18) — distinct from the framework
//! `audited` facet, which records row-level CRUD diffs. Written to the
//! append-only `AuditEvent` entity (legacy `audit_history`); `standard_methods`
//! exclude Update/Delete.

use std::sync::Arc;

use chrono::Utc;

use crate::{
    product_api::{DataAccess, HandlerResult, JsonValue, UserAuth},
    schemas::governance::{AuditEventProjection, InputAuditEvent},
    services::support::{entity, field, resolve_user_id, selection},
};

/// Governance event names (subset of design §18 useful to the wired subset).
pub const GATE_APPROVED: &str = "GATE_APPROVED";
pub const GATE_REJECTED: &str = "GATE_REJECTED";
pub const GATE_RETURNED: &str = "GATE_CHANGES_REQUESTED";
pub const GATE_STARTED: &str = "GATE_STARTED";
pub const GATE_SKIPPED: &str = "GATE_SKIPPED";
#[allow(dead_code)]
pub const GATE_SUBMITTED: &str = "GATE_SUBMITTED";
pub const WORKFLOW_ADVANCED: &str = "WORKFLOW_ADVANCED";
pub const PROJECT_CANCELLED: &str = "PROJECT_CANCELLED";

pub async fn record(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    project_id: Option<String>,
    entity_type: &str,
    entity_id: &str,
    action: &str,
    new_values: Option<JsonValue>,
) -> HandlerResult<()> {
    let performed_by_id = resolve_user_id(data_access, user).await?;
    let audit_type = entity(data_access, "AuditEvent")?;
    let input = InputAuditEvent {
        id: None,
        project_id,
        entity_type: entity_type.to_string(),
        entity_id: entity_id.to_string(),
        action: action.to_string(),
        old_values: None,
        new_values,
        performed_by_id,
        ip_address: None,
        user_agent: None,
        performed_at: Utc::now(),
    };
    let sel = selection("audit_event", &[field("id"), field("action")]);
    data_access
        .create_item::<InputAuditEvent, AuditEventProjection>(audit_type, sel, input, user.clone())
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    Ok(())
}
