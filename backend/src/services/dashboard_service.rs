use std::collections::HashMap;

use sea_orm::{DatabaseConnection, EntityTrait, QueryOrder, QuerySelect};

use crate::{
    auth::CurrentUser,
    dto::{dashboard::DashboardResponse, gate_review::GateReviewResponse},
    entities::{
        gate_reviews, projects,
        sea_orm_active_enums::{ProjectRisk, ProjectStatus},
    },
    error::AppResult,
    services::project_service,
};

pub async fn get_dashboard(
    db: &DatabaseConnection,
    current_user: &CurrentUser,
) -> AppResult<DashboardResponse> {
    let all_projects = projects::Entity::find().all(db).await?;
    let total_projects = all_projects.len() as u64;

    let mut status_breakdown: HashMap<String, u64> = HashMap::new();
    let mut priority_breakdown: HashMap<String, u64> = HashMap::new();
    let mut active_projects = 0u64;
    let mut completed_projects = 0u64;
    let mut on_hold_projects = 0u64;
    let mut high_risk_count = 0u64;

    for project in &all_projects {
        *status_breakdown.entry(format!("{:?}", project.status)).or_default() += 1;
        *priority_breakdown.entry(format!("{:?}", project.priority)).or_default() += 1;

        match project.status {
            ProjectStatus::Active => active_projects += 1,
            ProjectStatus::Completed => completed_projects += 1,
            ProjectStatus::OnHold => on_hold_projects += 1,
            _ => {}
        }
        if matches!(project.risk_level, Some(ProjectRisk::High) | Some(ProjectRisk::VeryHigh)) {
            high_risk_count += 1;
        }
    }

    let recent_gate_reviews = gate_reviews::Entity::find()
        .order_by_desc(gate_reviews::Column::SubmittedAt)
        .limit(5)
        .all(db)
        .await?
        .into_iter()
        .map(GateReviewResponse::from)
        .collect();

    let my_pending_tasks = project_service::get_pending_approvals(db, current_user).await?;

    Ok(DashboardResponse {
        active_projects,
        completed_projects,
        on_hold_projects,
        total_projects,
        status_breakdown,
        priority_breakdown,
        high_risk_count,
        recent_gate_reviews,
        my_pending_tasks,
    })
}
