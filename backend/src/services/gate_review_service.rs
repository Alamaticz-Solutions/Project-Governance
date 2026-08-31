use chrono::Utc;
use sea_orm::{ActiveModelTrait, ActiveValue::Set, EntityTrait};
use uuid::Uuid;

use crate::{
    auth::CurrentUser,
    dto::gate_review::{GateDecisionRequest, GateReviewResponse},
    entities::{gate_reviews, sea_orm_active_enums::ApprovalDecision},
    error::{AppError, AppResult},
    services::support::record_audit,
};

pub async fn list_gate_reviews(db: &sea_orm::DatabaseConnection) -> AppResult<Vec<GateReviewResponse>> {
    let reviews = gate_reviews::Entity::find().all(db).await?;
    Ok(reviews.into_iter().map(GateReviewResponse::from).collect())
}

pub async fn get_gate_review(db: &sea_orm::DatabaseConnection, id: Uuid) -> AppResult<GateReviewResponse> {
    let review = gate_reviews::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound("Gate review not found".to_string()))?;
    Ok(review.into())
}

/// Records a decision on a gate review. Closes the legacy gap where this
/// endpoint had no role check at all — only the review's assigned role (or
/// an admin) may decide it.
pub async fn submit_gate_decision(
    db: &sea_orm::DatabaseConnection,
    current_user: &CurrentUser,
    gate_id: Uuid,
    payload: GateDecisionRequest,
) -> AppResult<GateReviewResponse> {
    let review = gate_reviews::Entity::find_by_id(gate_id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound("Gate review not found".to_string()))?;

    let is_admin = current_user.role == crate::entities::sea_orm_active_enums::UserRole::Admin;
    let role_matches = review
        .assigned_role
        .as_ref()
        .is_some_and(|r| *r == current_user.role);
    if !is_admin && !role_matches {
        return Err(AppError::Forbidden(
            "You are not assigned to review this gate.".to_string(),
        ));
    }

    let decision = match payload.decision.to_lowercase().as_str() {
        "approve" | "approved" => ApprovalDecision::Approved,
        "reject" | "rejected" => ApprovalDecision::Rejected,
        "defer" | "deferred" => ApprovalDecision::Deferred,
        _ => ApprovalDecision::NeedsInfo,
    };

    let project_id = review.project_id;
    let mut am: gate_reviews::ActiveModel = review.into();
    am.decision = Set(Some(decision.clone()));
    am.status = Set(Some(format!("{:?}", decision).to_lowercase()));
    am.decision_by_id = Set(Some(current_user.id));
    am.decision_at = Set(Some(Utc::now().into()));
    am.decision_notes = Set(payload.notes.clone());
    let updated = am.update(db).await?;

    record_audit(
        db,
        Some(project_id),
        "gate_review",
        &updated.id.to_string(),
        "gate_decision",
        None,
        Some(serde_json::json!({ "decision": payload.decision, "notes": payload.notes })),
        Some(current_user.id),
    )
    .await?;

    Ok(updated.into())
}
