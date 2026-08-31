use sea_orm::entity::prelude::*;
use serde::Serialize;

use super::sea_orm_active_enums::NotificationType;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "notifications")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub recipient_id: Uuid,
    pub project_id: Option<Uuid>,
    pub notification_type: NotificationType,
    pub title: String,
    pub message: String,
    pub action_url: Option<String>,
    pub is_read: Option<bool>,
    pub created_at: Option<DateTimeWithTimeZone>,
    pub read_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::RecipientId",
        to = "super::users::Column::Id"
    )]
    Recipient,
    #[sea_orm(
        belongs_to = "super::projects::Entity",
        from = "Column::ProjectId",
        to = "super::projects::Column::Id"
    )]
    Project,
}

impl ActiveModelBehavior for ActiveModel {}
