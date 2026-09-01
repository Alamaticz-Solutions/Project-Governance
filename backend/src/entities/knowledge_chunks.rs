use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "knowledge_chunks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub document_id: Uuid,
    pub chunk_text: String,
    pub metadata: Option<Json>,
    pub sequence_order: Option<i32>,
    // Omitting `embedding vector(1536)` because SeaORM does not natively support pgvector.
    // We will query/update the embedding field using raw SQL or sqlx directly.
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::knowledge_documents::Entity",
        from = "Column::DocumentId",
        to = "super::knowledge_documents::Column::Id",
        on_update = "NoAction",
        on_delete = "Cascade"
    )]
    Document,
}

impl Related<super::knowledge_documents::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Document.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
