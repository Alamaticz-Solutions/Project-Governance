use chrono::Utc;
use sea_orm::{ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, QuerySelect};
use uuid::Uuid;

use crate::{
    dto::notification::NotificationResponse,
    entities::notifications,
    error::AppResult,
};

pub async fn list_for_user(db: &DatabaseConnection, user_id: Uuid) -> AppResult<Vec<NotificationResponse>> {
    let items = notifications::Entity::find()
        .filter(notifications::Column::RecipientId.eq(user_id))
        .order_by_desc(notifications::Column::CreatedAt)
        .limit(50)
        .all(db)
        .await?;
    Ok(items.into_iter().map(NotificationResponse::from).collect())
}

pub async fn mark_all_read(db: &DatabaseConnection, user_id: Uuid) -> AppResult<u64> {
    let unread = notifications::Entity::find()
        .filter(notifications::Column::RecipientId.eq(user_id))
        .filter(notifications::Column::IsRead.eq(false))
        .all(db)
        .await?;
    let count = unread.len() as u64;
    let now = Utc::now();
    for item in unread {
        let mut am: notifications::ActiveModel = item.into();
        am.is_read = Set(Some(true));
        am.read_at = Set(Some(now.into()));
        am.update(db).await?;
    }
    Ok(count)
}
