use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "knowledge_documents")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub title: String,
    pub document_type: String,
    pub source_url: Option<String>,
    pub created_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::knowledge_chunks::Entity")]
    KnowledgeChunks,
}

impl Related<super::knowledge_chunks::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::KnowledgeChunks.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
