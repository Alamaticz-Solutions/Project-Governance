use sea_orm::entity::prelude::*;
use serde::Serialize;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "email_queue")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub to_email: String,
    pub to_name: Option<String>,
    pub subject: String,
    pub template_name: Option<String>,
    pub template_data: Option<Json>,
    pub html_body: Option<String>,
    pub text_body: Option<String>,
    pub status: Option<String>,
    pub attempts: Option<i32>,
    pub max_attempts: Option<i32>,
    pub error_message: Option<String>,
    pub scheduled_at: Option<DateTimeWithTimeZone>,
    pub sent_at: Option<DateTimeWithTimeZone>,
    pub created_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
