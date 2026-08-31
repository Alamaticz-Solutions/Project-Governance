use chrono::Utc;
use sea_orm::{ActiveValue::Set, ConnectionTrait, EntityTrait, QueryFilter, ColumnTrait};
use serde_json::Value;
use uuid::Uuid;

use crate::entities::{
    audit_history, notifications,
    sea_orm_active_enums::{NotificationType, UserRole},
    users,
};

/// Notifies every user holding `role` about a project event. Collapses the
/// four near-identical "load all users with role X, insert a Notification
/// per user" blocks that were duplicated at every stage transition in the
/// legacy `submit_decision` endpoint into one reusable call.
pub async fn notify_users_with_role<C: ConnectionTrait>(
    db: &C,
    role: UserRole,
    project_id: Uuid,
    notification_type: NotificationType,
    title: &str,
    message: &str,
    action_url: &str,
) -> Result<(), sea_orm::DbErr> {
    let recipients = users::Entity::find()
        .filter(users::Column::Role.eq(role))
        .all(db)
        .await?;

    for recipient in recipients {
        notify_user(
            db,
            recipient.id,
            Some(project_id),
            notification_type.clone(),
            title,
            message,
            Some(action_url),
        )
        .await?;
    }
    Ok(())
}

pub async fn notify_user<C: ConnectionTrait>(
    db: &C,
    recipient_id: Uuid,
    project_id: Option<Uuid>,
    notification_type: NotificationType,
    title: &str,
    message: &str,
    action_url: Option<&str>,
) -> Result<(), sea_orm::DbErr> {
    let notification = notifications::ActiveModel {
        id: Set(Uuid::new_v4()),
        recipient_id: Set(recipient_id),
        project_id: Set(project_id),
        notification_type: Set(notification_type),
        title: Set(title.to_string()),
        message: Set(message.to_string()),
        action_url: Set(action_url.map(|s| s.to_string())),
        is_read: Set(Some(false)),
        created_at: Set(Some(Utc::now().into())),
        read_at: Set(None),
    };
    notifications::Entity::insert(notification).exec(db).await?;
    Ok(())
}

/// Records one audit-trail row. Every mutation in the legacy backend wrote
/// one of these by hand; centralizing it here means every service call site
/// looks the same and none of them can forget a field.
#[allow(clippy::too_many_arguments)]
pub async fn record_audit<C: ConnectionTrait>(
    db: &C,
    project_id: Option<Uuid>,
    entity_type: &str,
    entity_id: &str,
    action: &str,
    old_values: Option<Value>,
    new_values: Option<Value>,
    performed_by_id: Option<Uuid>,
) -> Result<(), sea_orm::DbErr> {
    let audit = audit_history::ActiveModel {
        id: Set(Uuid::new_v4()),
        project_id: Set(project_id),
        entity_type: Set(entity_type.to_string()),
        entity_id: Set(entity_id.to_string()),
        action: Set(action.to_string()),
        old_values: Set(old_values),
        new_values: Set(new_values),
        performed_by_id: Set(performed_by_id),
        ip_address: Set(None),
        user_agent: Set(None),
        performed_at: Set(Utc::now().into()),
    };
    audit_history::Entity::insert(audit).exec(db).await?;
    Ok(())
}
