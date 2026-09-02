use sea_orm::entity::prelude::*;

/// Tracks the Microsoft Graph change-notification subscription(s) the backend
/// keeps alive — currently just the tenant-wide transcript subscription
/// (`communications/onlineMeetings/getAllTranscripts`). One row per distinct
/// `resource`.
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "graph_subscriptions")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    /// The id Graph assigned to the subscription.
    #[sea_orm(unique)]
    pub subscription_id: String,
    pub resource: String,
    pub notification_url: String,
    pub client_state: String,
    pub expiration_date_time: DateTimeWithTimeZone,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
