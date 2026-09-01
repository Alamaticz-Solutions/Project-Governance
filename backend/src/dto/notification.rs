use chrono::{DateTime, FixedOffset};
use serde::Serialize;
use uuid::Uuid;

use crate::entities::notifications;

#[derive(Debug, Serialize)]
pub struct NotificationResponse {
    pub id: Uuid,
    pub project_id: Option<Uuid>,
    pub notification_type: String,
    pub title: String,
    pub message: String,
    pub action_url: Option<String>,
    pub is_read: bool,
    pub created_at: Option<DateTime<FixedOffset>>,
    pub read_at: Option<DateTime<FixedOffset>>,
}

impl From<notifications::Model> for NotificationResponse {
    fn from(n: notifications::Model) -> Self {
        Self {
            id: n.id,
            project_id: n.project_id,
            notification_type: format!("{:?}", n.notification_type),
            title: n.title,
            message: n.message,
            action_url: n.action_url,
            is_read: n.is_read.unwrap_or(false),
            created_at: n.created_at,
            read_at: n.read_at,
        }
    }
}
