//! In-app notification fan-out (design §21). Backed by generated CRUD on the
//! `Notification` entity; this is the net-new writer the workflow engine calls
//! (legacy `notification_service` only had list/mark-read).

use std::sync::Arc;

use serde_json::json;

use crate::{
    product_api::{DataAccess, HandlerResult, UserAuth},
    schemas::governance::{InputNotification, NotificationProjection, NotificationType, UserProjection},
    services::support::{entity, field, selection},
};

async fn insert(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    recipient_id: String,
    project_id: Option<String>,
    ntype: NotificationType,
    title: &str,
    message: &str,
) -> HandlerResult<()> {
    let ntype_json =
        serde_json::to_value(&ntype).map_err(|e| anyhow::anyhow!(e.to_string()))?;
    let input = InputNotification {
        id: None,
        recipient_id,
        project_id,
        notification_type: serde_json::from_value(ntype_json)
            .map_err(|e| anyhow::anyhow!(e.to_string()))?,
        title: title.to_string(),
        message: message.to_string(),
        action_url: None,
        is_read: Some(false),
        created_at: None,
        read_at: None,
    };
    let sel = selection("notification", &[field("id")]);
    let notif_type = entity(data_access, "Notification")?;
    data_access
        .create_item::<InputNotification, NotificationProjection>(
            notif_type,
            sel,
            input,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    Ok(())
}

/// Notify a single user by id.
#[allow(dead_code)] // used by future custom methods (task assignment, meeting scheduled)
pub async fn notify_user(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    recipient_id: String,
    project_id: Option<String>,
    ntype: NotificationType,
    title: &str,
    message: &str,
) -> HandlerResult<()> {
    insert(data_access, user, recipient_id, project_id, ntype, title, message).await
}

/// Notify every active user holding `role` (SCREAMING_SNAKE, e.g. "EPMO").
pub async fn notify_role(
    data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    role: &str,
    project_id: Option<String>,
    ntype: NotificationType,
    title: &str,
    message: &str,
) -> HandlerResult<()> {
    let users_type = entity(data_access, "User")?;
    let sel = selection("users", &[field("id"), field("role"), field("is_active")]);
    let recipients = data_access
        .query_items::<UserProjection>(
            users_type,
            sel,
            Some(json!({ "_and": [
                { "role": { "_eq": role } },
                { "is_active": { "_eq": true } }
            ]})),
            None,
            0,
            200,
            None,
            user.clone(),
        )
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    for r in recipients.items {
        if let Some(id) = r.id {
            // ntype is Copy-free; rebuild per recipient via serde round-trip
            let ntype_json =
                serde_json::to_value(&ntype).map_err(|e| anyhow::anyhow!(e.to_string()))?;
            let n: NotificationType = serde_json::from_value(ntype_json)
                .map_err(|e| anyhow::anyhow!(e.to_string()))?;
            insert(data_access, user, id, project_id.clone(), n, title, message).await?;
        }
    }
    Ok(())
}
