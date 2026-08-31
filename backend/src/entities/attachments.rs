use sea_orm::entity::prelude::*;
use serde::Serialize;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize)]
#[sea_orm(table_name = "attachments")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub project_id: Uuid,
    pub file_name: String,
    pub file_type: Option<String>,
    pub file_size: Option<i32>,
    pub s3_key: Option<String>,
    pub s3_url: Option<String>,
    pub upload_status: Option<String>,
    pub uploaded_by_id: Option<Uuid>,
    pub ai_extracted: Option<bool>,
    pub ai_extraction_data: Option<Json>,
    pub uploaded_at: Option<DateTimeWithTimeZone>,
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
