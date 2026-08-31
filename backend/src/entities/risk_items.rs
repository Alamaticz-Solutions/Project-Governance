use sea_orm::entity::prelude::*;
use serde::Serialize;

use super::sea_orm_active_enums::ProjectRisk;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "risk_items")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub project_id: Uuid,
    pub risk_title: String,
    pub risk_description: Option<String>,
    pub risk_category: Option<String>,
    pub severity: ProjectRisk,
    pub probability: Option<String>,
    pub impact: Option<String>,
    pub mitigation_plan: Option<String>,
    pub owner_id: Option<Uuid>,
    pub status: Option<String>,
    pub identified_at: Option<DateTimeWithTimeZone>,
    pub resolved_at: Option<DateTimeWithTimeZone>,
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

impl ActiveModelBehavior for ActiveModel {}
