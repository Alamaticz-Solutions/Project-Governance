use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, QuerySelect};

use crate::{
    dto::audit::{AuditHistoryResponse, AuditQuery},
    entities::audit_history,
    error::AppResult,
};

pub async fn list_audit(db: &DatabaseConnection, query: AuditQuery) -> AppResult<Vec<AuditHistoryResponse>> {
    let mut finder = audit_history::Entity::find();
    if let Some(project_id) = query.project_id {
        finder = finder.filter(audit_history::Column::ProjectId.eq(project_id));
    }
    if let Some(entity_type) = query.entity_type {
        finder = finder.filter(audit_history::Column::EntityType.eq(entity_type));
    }
    let items = finder
        .order_by_desc(audit_history::Column::PerformedAt)
        .limit(200)
        .all(db)
        .await?;
    Ok(items.into_iter().map(AuditHistoryResponse::from).collect())
}
