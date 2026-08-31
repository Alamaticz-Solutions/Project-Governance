use sea_orm::entity::prelude::*;
use serde::Serialize;

use super::sea_orm_active_enums::UserRole;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "project_approvals")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub project_id: Uuid,
    pub approval_stage: String,
    pub assigned_role: UserRole,
    pub assigned_user_id: Option<Uuid>,
    pub status: String,
    pub decision: Option<String>,
    pub comments: Option<String>,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTimeWithTimeZone>,
    pub sequence_order: i32,
    pub notification_sent: bool,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::projects::Entity",
        from = "Column::ProjectId",
        to = "super::projects::Column::Id"
    )]
    Project,
}

impl Related<super::projects::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Project.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
