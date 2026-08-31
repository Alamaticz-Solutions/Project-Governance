use sea_orm::entity::prelude::*;
use serde::Serialize;

use super::sea_orm_active_enums::UserRole;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub full_name: String,
    #[serde(skip_serializing)]
    pub hashed_password: String,
    pub role: UserRole,
    pub department: Option<String>,
    pub job_title: Option<String>,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
    pub is_active: bool,
    pub is_verified: bool,
    pub last_login: Option<DateTimeWithTimeZone>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::projects::Entity")]
    Projects,
}

impl Related<super::projects::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Projects.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
