//! The governance workflow engine: project CRUD plus the sequential
//! EPMO → BTA → Finance → EAC → PIC → TRC approval state machine.
//!
//! This is a direct, behavior-preserving port of `submit_decision` in the
//! legacy `projects.py`, split into one function per stage transition for
//! readability. The `sequence_order` value assigned when leaving "Prepare
//! for EAC" is `5` here (the legacy Python duplicated Finance's `3` — a
//! copy-paste bug with no observable effect, fixed during the port).

use std::collections::HashMap;

use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait,
    PaginatorTrait, QueryFilter, QueryOrder, TransactionTrait,
};
use serde_json::{Map, Value};
use uuid::Uuid;

use crate::{
    auth::CurrentUser,
    dto::projects::{
        DecisionSubmitRequest, PendingApprovalItem, PendingApprovalProjectData,
        ProjectCreateRequest, ProjectListQuery, ProjectListResponse, ProjectResponse,
        ProjectUpdateRequest,
    },
    entities::{
        gate_reviews, gate_submissions, project_approvals, projects,
        sea_orm_active_enums::{ApprovalDecision, GateCode, NotificationType, ProjectStatus, UserRole},
        users,
    },
    error::{AppError, AppResult},
    services::support::{notify_user, notify_users_with_role, record_audit},
};

fn parse_project_status(s: &str) -> Option<ProjectStatus> {
    Some(match s.to_lowercase().as_str() {
        "draft" => ProjectStatus::Draft,
        "active" => ProjectStatus::Active,
        "on_hold" => ProjectStatus::OnHold,
        "completed" => ProjectStatus::Completed,
        "cancelled" => ProjectStatus::Cancelled,
        "archived" => ProjectStatus::Archived,
        _ => return None,
    })
}

fn parse_project_priority(s: &str) -> Option<crate::entities::sea_orm_active_enums::ProjectPriority> {
    use crate::entities::sea_orm_active_enums::ProjectPriority;
    Some(match s.to_lowercase().as_str() {
        "critical" => ProjectPriority::Critical,
        "high" => ProjectPriority::High,
        "medium" => ProjectPriority::Medium,
        "low" => ProjectPriority::Low,
        _ => return None,
    })
}

fn parse_project_risk(s: &str) -> Option<crate::entities::sea_orm_active_enums::ProjectRisk> {
    use crate::entities::sea_orm_active_enums::ProjectRisk;
    Some(match s.to_lowercase().as_str() {
        "very_high" => ProjectRisk::VeryHigh,
        "high" => ProjectRisk::High,
        "medium" => ProjectRisk::Medium,
        "low" => ProjectRisk::Low,
        _ => return None,
    })
}

fn generate_project_number(seq: u64) -> String {
    let year = Utc::now().format("%Y");
    format!("GOV-{year}-{seq:05}")
}

pub async fn list_projects(
    db: &DatabaseConnection,
    query: ProjectListQuery,
) -> AppResult<ProjectListResponse> {
    let mut finder = projects::Entity::find();

    // Filtering by a raw &str against an enum column makes sea-query cast the
    // literal to a guessed Postgres type name ("projectstatus") instead of
    // the real one ("project_status"), which the DB then rejects outright.
    // Parsing into the actual enum first makes sea-query emit the correct
    // cast, since it then knows the column's real ActiveEnum type. Parsed by
    // hand (not serde) because the enums' Serialize/Deserialize derive uses
    // the Rust variant name ("Active"), while callers pass the DB-style
    // lowercase value ("active") that the rest of this API's query params use.
    if let Some(status) = &query.status {
        let parsed = parse_project_status(status)
            .ok_or_else(|| AppError::BadRequest(format!("Invalid status '{status}'")))?;
        finder = finder.filter(projects::Column::Status.eq(parsed));
    }
    if let Some(priority) = &query.priority {
        let parsed = parse_project_priority(priority)
            .ok_or_else(|| AppError::BadRequest(format!("Invalid priority '{priority}'")))?;
        finder = finder.filter(projects::Column::Priority.eq(parsed));
    }
    if let Some(search) = &query.search {
        let pattern = format!("%{search}%");
        finder = finder.filter(
            projects::Column::ProjectName
                .like(&pattern)
                .or(projects::Column::ProjectNumber.like(&pattern))
                .or(projects::Column::BusinessUnit.like(&pattern)),
        );
    }

    let paginator = finder
        .order_by_desc(projects::Column::CreatedAt)
        .paginate(db, query.page_size.max(1));
    let total = paginator.num_items().await?;
    let page_index = query.page.max(1) - 1;
    let items = paginator.fetch_page(page_index).await?;

    // Batch-load managers in one round trip instead of one query per project —
    // matters a lot once the database isn't on localhost.
    let manager_ids: Vec<Uuid> = items.iter().map(|p| p.manager_id).collect();
    let managers: HashMap<Uuid, users::Model> = users::Entity::find()
        .filter(users::Column::Id.is_in(manager_ids))
        .all(db)
        .await?
        .into_iter()
        .map(|u| (u.id, u))
        .collect();

    let responses = items
        .into_iter()
        .map(|project| {
            let manager = managers.get(&project.manager_id).cloned();
            ProjectResponse::from_model(project, manager)
        })
        .collect();

    let total_pages = if total == 0 {
        0
    } else {
        (total + query.page_size - 1) / query.page_size
    };

    Ok(ProjectListResponse {
        items: responses,
        total,
        page: query.page,
        page_size: query.page_size,
        total_pages,
    })
}

pub async fn create_project(
    db: &DatabaseConnection,
    current_user: &CurrentUser,
    payload: ProjectCreateRequest,
) -> AppResult<ProjectResponse> {
    let count = projects::Entity::find().count(db).await?;
    let project_number = generate_project_number(count + 1);
    let now = Utc::now();
    let project_id = Uuid::new_v4();

    let project = projects::ActiveModel {
        id: Set(project_id),
        project_number: Set(project_number.clone()),
        project_name: Set(payload.project_name.clone()),
        business_unit: Set(payload.business_unit),
        department: Set(payload.department),
        manager_id: Set(current_user.id),
        sponsor_name: Set(payload.sponsor_name),
        sponsor_email: Set(payload.sponsor_email),
        description: Set(payload.description),
        problem_statement: Set(payload.problem_statement),
        business_value: Set(payload.business_value),
        strategic_alignment: Set(payload.strategic_alignment),
        requestor_name: Set(payload.requestor_name),
        request_type: Set(payload.request_type),
        desired_outcome: Set(payload.desired_outcome),
        what_do_you_do_today: Set(payload.what_do_you_do_today),
        what_transpires_if_nothing: Set(payload.what_transpires_if_nothing),
        notes: Set(payload.notes),
        budget_estimated: Set(payload.budget_estimated),
        budget_type: Set(payload.budget_type),
        requested_start_date: Set(payload.requested_start_date),
        requested_end_date: Set(payload.requested_end_date),
        priority: Set(payload.priority),
        risk_level: Set(Some(payload.risk_level)),
        status: Set(ProjectStatus::Active),
        it_involvement: Set(Some(payload.it_involvement)),
        vendor_required: Set(Some(payload.vendor_required)),
        has_phi_data: Set(Some(payload.has_phi_data)),
        is_clinical: Set(Some(payload.is_clinical)),
        is_hipaa_applicable: Set(Some(payload.is_hipaa_applicable)),
        current_stage: Set(Some("EPMO Review".to_string())),
        current_status: Set(Some("Pending".to_string())),
        current_owner_role: Set(Some("epmo".to_string())),
        workflow_status: Set(Some("Intake complete".to_string())),
        submitted_at: Set(Some(now.into())),
        created_at: Set(now.into()),
        ..Default::default()
    };
    let project = project.insert(db).await?;

    // Intake is satisfied by this very call — record it as an already-complete
    // workspace stage so the workspace UI can show it as done from the start.
    let intake_submission = gate_submissions::ActiveModel {
        id: Set(Uuid::new_v4()),
        project_id: Set(project.id),
        stage: Set("intake".to_string()),
        status: Set("submitted".to_string()),
        decision: Set(Some("complete".to_string())),
        data: Set(serde_json::json!({
            "projectName": project.project_name,
            "businessUnit": project.business_unit,
            "requestorName": project.requestor_name,
            "problemStatement": project.problem_statement,
            "budgetEstimated": project.budget_estimated,
            "priority": format!("{:?}", project.priority),
        })),
        submitted_by: Set(Some(current_user.id)),
        submitted_at: Set(Some(now.into())),
        created_at: Set(now.into()),
        ..Default::default()
    };
    intake_submission.insert(db).await?;

    // Fix: Insert the actual first approval task so it appears in the Pending Reviews inbox!
    insert_next_approval(db, project.id, "EPMO Review", UserRole::Epmo, 1).await?;

    notify_users_with_role(
        db,
        UserRole::Epmo,
        project.id,
        NotificationType::ApprovalRequired,
        "New Project Intake Submitted",
        &format!(
            "Project '{}' has been submitted and needs initial EPMO Review.",
            project.project_name
        ),
        "/team-inbox",
    )
    .await?;

    notify_users_with_role(
        db,
        UserRole::Security,
        project.id,
        NotificationType::ApprovalRequired,
        "New Project Needs SRA / DFD Review",
        &format!(
            "Project '{}' has been submitted and needs a Security Risk Assessment.",
            project.project_name
        ),
        "/projects",
    )
    .await?;

    record_audit(
        db,
        Some(project.id),
        "project",
        &project.id.to_string(),
        "project_created",
        None,
        Some(serde_json::json!({
            "project_number": project_number,
            "project_name": payload.project_name,
        })),
        Some(current_user.id),
    )
    .await?;

    tracing::info!(project_number = %project_number, user = %current_user.email, "project created");

    let manager = users::Entity::find_by_id(project.manager_id).one(db).await?;
    Ok(ProjectResponse::from_model(project, manager))
}

async fn find_project_by_id_or_number(
    db: &DatabaseConnection,
    id_or_number: &str,
) -> AppResult<projects::Model> {
    let project = if let Ok(uuid) = Uuid::parse_str(id_or_number) {
        projects::Entity::find_by_id(uuid).one(db).await?
    } else {
        projects::Entity::find()
            .filter(projects::Column::ProjectNumber.eq(id_or_number))
            .one(db)
            .await?
    };
    project.ok_or_else(|| AppError::NotFound("Project not found".to_string()))
}

pub async fn get_project(db: &DatabaseConnection, id_or_number: &str) -> AppResult<ProjectResponse> {
    let project = find_project_by_id_or_number(db, id_or_number).await?;
    let manager = users::Entity::find_by_id(project.manager_id).one(db).await?;
    Ok(ProjectResponse::from_model(project, manager))
}

pub async fn update_project(
    db: &DatabaseConnection,
    current_user: &CurrentUser,
    project_id: Uuid,
    payload: ProjectUpdateRequest,
) -> AppResult<ProjectResponse> {
    let project = projects::Entity::find_by_id(project_id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound("Project not found".to_string()))?;

    // Fix for the legacy gap: PATCH previously had no permission check at all.
    let is_owner = project.manager_id == current_user.id;
    let is_privileged = matches!(current_user.role, UserRole::Admin | UserRole::Epmo);
    if !is_owner && !is_privileged {
        return Err(AppError::Forbidden(
            "Only the project's manager, an EPMO reviewer, or an admin may edit this project."
                .to_string(),
        ));
    }

    let old_values = serde_json::to_value(&payload).unwrap_or(Value::Null);
    let mut am: projects::ActiveModel = project.into();

    if let Some(v) = payload.project_name { am.project_name = Set(v); }
    if let Some(v) = payload.description { am.description = Set(Some(v)); }
    if let Some(v) = payload.problem_statement { am.problem_statement = Set(Some(v)); }
    if let Some(v) = payload.business_value { am.business_value = Set(Some(v)); }
    if let Some(v) = payload.budget_estimated { am.budget_estimated = Set(Some(v)); }
    if let Some(v) = payload.priority { am.priority = Set(v); }
    if let Some(v) = payload.risk_level { am.risk_level = Set(Some(v)); }
    if let Some(v) = payload.status { am.status = Set(v); }
    if let Some(v) = payload.requested_start_date { am.requested_start_date = Set(Some(v)); }
    if let Some(v) = payload.requested_end_date { am.requested_end_date = Set(Some(v)); }
    if let Some(v) = payload.sponsor_name { am.sponsor_name = Set(Some(v)); }
    if let Some(v) = payload.sponsor_email { am.sponsor_email = Set(Some(v)); }
    if let Some(v) = payload.it_involvement { am.it_involvement = Set(Some(v)); }
    if let Some(v) = payload.vendor_required { am.vendor_required = Set(Some(v)); }
    if let Some(v) = payload.has_phi_data { am.has_phi_data = Set(Some(v)); }
    if let Some(v) = payload.is_clinical { am.is_clinical = Set(Some(v)); }
    am.updated_at = Set(Some(Utc::now().into()));

    let updated = am.update(db).await?;

    record_audit(
        db,
        Some(updated.id),
        "project",
        &updated.id.to_string(),
        "project_updated",
        Some(old_values),
        None,
        Some(current_user.id),
    )
    .await?;

    let manager = users::Entity::find_by_id(updated.manager_id).one(db).await?;
    Ok(ProjectResponse::from_model(updated, manager))
}

pub async fn delete_project(
    db: &DatabaseConnection,
    current_user: &CurrentUser,
    project_id: Uuid,
) -> AppResult<()> {
    if !matches!(current_user.role, UserRole::Admin | UserRole::Epmo) {
        return Err(AppError::Forbidden("Insufficient permissions".to_string()));
    }

    let project = projects::Entity::find_by_id(project_id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound("Project not found".to_string()))?;

    let mut am: projects::ActiveModel = project.into();
    am.status = Set(ProjectStatus::Cancelled);
    let updated = am.update(db).await?;

    record_audit(
        db,
        Some(updated.id),
        "project",
        &updated.id.to_string(),
        "project_cancelled",
        None,
        None,
        Some(current_user.id),
    )
    .await?;
    Ok(())
}

pub async fn get_pending_approvals(
    db: &DatabaseConnection,
    current_user: &CurrentUser,
) -> AppResult<Vec<PendingApprovalItem>> {
    let mut finder =
        project_approvals::Entity::find().filter(project_approvals::Column::Status.eq("Pending"));

    if !matches!(current_user.role, UserRole::Admin | UserRole::Epmo) {
        finder = finder.filter(project_approvals::Column::AssignedRole.eq(current_user.role.clone()));
    }

    let approvals = finder.all(db).await?;
    let mut results = Vec::with_capacity(approvals.len());

    for approval in approvals {
        let Some(project) = projects::Entity::find_by_id(approval.project_id).one(db).await? else {
            continue;
        };
        let manager = users::Entity::find_by_id(project.manager_id).one(db).await?;
        let submitted_by = manager.map(|m| m.full_name).unwrap_or_else(|| "Unknown".to_string());

        let ai = project.ai_extracted_data.clone().unwrap_or(Value::Null);
        let extract = |key: &str| ai.get(key).cloned().unwrap_or(Value::Null);
        let extract_arr = |key: &str| ai.get(key).cloned().unwrap_or_else(|| Value::Array(vec![]));

        let project_data = PendingApprovalProjectData {
            id: project.id.to_string(),
            project_number: project.project_number.clone(),
            project_name: project.project_name.clone(),
            business_unit: project.business_unit.clone(),
            department: project.department.clone(),
            requestor_name: project.requestor_name.clone(),
            request_type: project.request_type.clone(),
            sponsor_name: project.sponsor_name.clone(),
            sponsor_email: project.sponsor_email.clone(),
            description: project.description.clone(),
            problem_statement: project.problem_statement.clone(),
            desired_outcome: project.desired_outcome.clone(),
            what_do_you_do_today: project.what_do_you_do_today.clone(),
            what_transpires_if_nothing: project.what_transpires_if_nothing.clone(),
            notes: project.notes.clone(),
            strategic_alignment: project.strategic_alignment.clone(),
            current_state_architecture: extract("currentStateArchitecture"),
            current_state_pain_points: extract("currentStatePainPoints"),
            current_state_systems: extract("currentStateSystems"),
            solution_overview: extract("solutionOverview"),
            tech_stack: extract("techStack"),
            data_strategy: extract("dataStrategy"),
            security_strategy: extract("securityStrategy"),
            integration_strategy: extract("integrationStrategy"),
            infrastructure_requirements: extract("infrastructureRequirements"),
            compliance_standards: extract("complianceStandards"),
            how_addresses_compliance: extract("howAddressesCompliance"),
            funding_source: extract("fundingSource"),
            budget_breakdown: extract("budgetBreakdown"),
            human_resources: extract("humanResources"),
            impact_operations: extract("impactOperations"),
            impact_revenue: extract("impactRevenue"),
            impact_savings: extract("impactSavings"),
            impact_customer: extract("impactCustomer"),
            impact_competitive: extract("impactCompetitive"),
            rationale: extract("rationale"),
            scalability: extract("scalability"),
            future_readiness: extract("futureReadiness"),
            feasibility_statement: extract("feasibilityStatement"),
            it_capabilities_alignment: extract("itCapabilitiesAlignment"),
            new_skills_required: extract("newSkillsRequired"),
            stakeholders: extract_arr("stakeholders"),
            risks_list: extract_arr("risksList"),
            milestones: extract_arr("milestones"),
            solutions_considered: extract_arr("solutionsConsidered"),
        };

        results.push(PendingApprovalItem {
            id: format!("TSK-{}{}", approval.sequence_order, approval.id.to_string()[..4].to_uppercase()),
            project_id: project.id.to_string(),
            project_number: project.project_number.clone(),
            project_name: project.project_name.clone(),
            kind: approval.approval_stage.clone(),
            priority: format!("{:?}", project.priority),
            submitted_by,
            submitted_date: approval.created_at.format("%Y-%m-%d %I:%M %p").to_string(),
            status: approval.status.clone(),
            project_data,
            approval_id: approval.id.to_string(),
        });
    }

    Ok(results)
}

const DIRECT_FIELDS: &[&str] = &[
    "project_name", "business_unit", "department", "sponsor_name", "sponsor_email",
    "description", "problem_statement", "business_value", "strategic_alignment",
    "budget_estimated", "budget_approved", "budget_type", "priority", "risk_level",
];

fn camel_to_snake_remap(key: &str) -> &str {
    match key {
        "projectName" => "project_name",
        "businessUnit" => "business_unit",
        "sponsorName" => "sponsor_name",
        "sponsorEmail" => "sponsor_email",
        "problemStatement" => "problem_statement",
        "businessValue" => "business_value",
        "strategicAlignment" => "strategic_alignment",
        "budgetEstimated" => "budget_estimated",
        "budgetApproved" => "budget_approved",
        "budgetType" => "budget_type",
        other => other,
    }
}

/// Applies `project_updates` from a decision submission: known fields land on
/// typed columns, everything else is merged into the freeform
/// `ai_extracted_data` JSON blob — mirrors `projects.py:491-535`.
fn apply_project_updates(
    am: &mut projects::ActiveModel,
    ai_data: &mut Map<String, Value>,
    updates: &Map<String, Value>,
) {
    for (key, value) in updates {
        let db_key = camel_to_snake_remap(key);
        if !DIRECT_FIELDS.contains(&db_key) {
            ai_data.insert(key.clone(), value.clone());
            continue;
        }

        match db_key {
            "project_name" => if let Some(s) = value.as_str() { am.project_name = Set(s.to_string()); },
            "business_unit" => if let Some(s) = value.as_str() { am.business_unit = Set(s.to_string()); },
            "department" => am.department = Set(value.as_str().map(str::to_string)),
            "sponsor_name" => am.sponsor_name = Set(value.as_str().map(str::to_string)),
            "sponsor_email" => am.sponsor_email = Set(value.as_str().map(str::to_string)),
            "description" => am.description = Set(value.as_str().map(str::to_string)),
            "problem_statement" => am.problem_statement = Set(value.as_str().map(str::to_string)),
            "business_value" => am.business_value = Set(value.as_str().map(str::to_string)),
            "strategic_alignment" => am.strategic_alignment = Set(value.as_str().map(str::to_string)),
            "budget_estimated" => am.budget_estimated = Set(value.as_f64()),
            "budget_approved" => am.budget_approved = Set(value.as_f64()),
            "budget_type" => am.budget_type = Set(value.as_str().map(str::to_string)),
            "priority" => if let Some(s) = value.as_str() {
                if let Some(p) = parse_project_priority(s) {
                    am.priority = Set(p);
                }
            },
            "risk_level" => if let Some(s) = value.as_str() {
                if let Some(r) = parse_project_risk(s) {
                    am.risk_level = Set(Some(r));
                }
            },
            _ => { ai_data.insert(key.clone(), value.clone()); }
        }
    }
}

pub async fn submit_decision(
    db: &DatabaseConnection,
    current_user: &CurrentUser,
    project_id: Uuid,
    payload: DecisionSubmitRequest,
) -> AppResult<ProjectResponse> {
    let txn = db.begin().await?;

    let project = projects::Entity::find_by_id(project_id)
        .one(&txn)
        .await?
        .ok_or_else(|| AppError::NotFound("Project not found".to_string()))?;

    let required_role = project.current_owner_role.clone().unwrap_or_default();
    // `current_owner_role` is stored lowercase (see the `Set(Some("bta"...))`
    // calls below) while `UserRole::as_str()` yields SCREAMING_SNAKE_CASE, so
    // this comparison must be case-insensitive or every non-admin is Forbidden.
    if !current_user.role.as_str().eq_ignore_ascii_case(&required_role)
        && current_user.role != UserRole::Admin
    {
        return Err(AppError::Forbidden(format!(
            "You (role: {}) do not have permission at this stage (required: {}).",
            current_user.role.as_str(),
            required_role
        )));
    }

    let existing_pending = project_approvals::Entity::find()
        .filter(project_approvals::Column::ProjectId.eq(project_id))
        .filter(project_approvals::Column::ApprovalStage.eq(payload.stage.as_str()))
        .filter(project_approvals::Column::Status.eq("Pending"))
        .one(&txn)
        .await?;

    let approval = match existing_pending {
        Some(a) => a,
        None => {
            let already_approved = project_approvals::Entity::find()
                .filter(project_approvals::Column::ProjectId.eq(project_id))
                .filter(project_approvals::Column::ApprovalStage.eq(payload.stage.as_str()))
                .filter(project_approvals::Column::Status.eq("Approved"))
                .one(&txn)
                .await?;
            if already_approved.is_some() {
                return Err(AppError::BadRequest("This stage has already been approved.".to_string()));
            }
            let fallback = project_approvals::ActiveModel {
                id: Set(Uuid::new_v4()),
                project_id: Set(project_id),
                approval_stage: Set(payload.stage.clone()),
                assigned_role: Set(current_user.role.clone()),
                status: Set("Pending".to_string()),
                sequence_order: Set(1),
                notification_sent: Set(false),
                created_at: Set(Utc::now().into()),
                ..Default::default()
            };
            fallback.insert(&txn).await?
        }
    };

    let mut project_am: projects::ActiveModel = project.clone().into();
    let mut ai_data = project
        .ai_extracted_data
        .clone()
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default();

    if let Some(updates) = &payload.project_updates {
        apply_project_updates(&mut project_am, &mut ai_data, updates);
        project_am.ai_extracted_data = Set(Some(Value::Object(ai_data)));
    }

    let mut approval_am: project_approvals::ActiveModel = approval.clone().into();
    let decision_val = payload.decision.to_lowercase();
    let now = Utc::now();

    if matches!(decision_val.as_str(), "approve" | "approve alignment" | "complete") {
        approval_am.status = Set("Approved".to_string());
        approval_am.decision = Set(Some("Approve".to_string()));
        approval_am.approved_by = Set(Some(current_user.id));
        approval_am.approved_at = Set(Some(now.into()));
        approval_am.comments = Set(payload.comments.clone());

        match payload.stage.as_str() {
            "EPMO Review" => advance_epmo_to_bta(&txn, &mut project_am, &project).await?,
            "BTA Review" => advance_bta_to_finance(&txn, &mut project_am, &project).await?,
            "Finance Review" => advance_finance_to_eac(&txn, &mut project_am, &project).await?,
            "Prepare for EAC" | "EAC Review" | "EAC Committee Review" | "EAC Meeting" => {
                advance_eac_to_pic(&txn, &mut project_am, &project).await?
            }
            "Prepare for PIC" | "PIC Meeting" => {
                complete_pic_to_trc(&txn, &mut project_am, &project, current_user, &payload).await?
            }
            _ => {}
        }
    } else if matches!(decision_val.as_str(), "reject" | "defer" | "defer initiative") {
        approval_am.status = Set("Rejected".to_string());
        approval_am.decision = Set(Some("Reject".to_string()));
        approval_am.approved_by = Set(Some(current_user.id));
        approval_am.approved_at = Set(Some(now.into()));
        approval_am.comments = Set(payload.comments.clone());

        project_am.current_status = Set(Some("Deferred".to_string()));
        project_am.workflow_status = Set(Some("Deferred".to_string()));
        project_am.status = Set(ProjectStatus::OnHold);

        notify_user(
            &txn,
            project.manager_id,
            Some(project.id),
            NotificationType::Rejected,
            "Project Alignment Deferred",
            &format!(
                "The review of project {} has been deferred. Comments: {}",
                project.project_name,
                payload.comments.clone().unwrap_or_default()
            ),
            Some(&format!("/projects/{}", project.id)),
        )
        .await?;
    } else if matches!(
        decision_val.as_str(),
        "need more information" | "request clarification" | "returned"
    ) {
        approval_am.status = Set("Returned".to_string());
        approval_am.decision = Set(Some("Needs Info".to_string()));
        approval_am.approved_by = Set(Some(current_user.id));
        approval_am.approved_at = Set(Some(now.into()));
        approval_am.comments = Set(payload.comments.clone());

        project_am.current_status = Set(Some("Returned".to_string()));
        project_am.current_owner_role = Set(Some("project_manager".to_string()));

        notify_user(
            &txn,
            project.manager_id,
            Some(project.id),
            NotificationType::CommentAdded,
            "Clarification Requested on Project Proposal",
            &format!(
                "Clarification is requested for project {}. Comments: {}",
                project.project_name,
                payload.comments.clone().unwrap_or_default()
            ),
            Some(&format!("/projects/{}", project.id)),
        )
        .await?;
    }

    let approval = approval_am.update(&txn).await?;
    project_am.updated_at = Set(Some(now.into()));
    let updated_project = project_am.update(&txn).await?;

    let mut data_obj = serde_json::Map::new();
    if let Some(updates) = &payload.project_updates {
        for (k, v) in updates {
            data_obj.insert(k.clone(), v.clone());
        }
    }
    if let Some(ref comments) = payload.comments {
        let prefix = payload.stage.to_lowercase().split_whitespace().next().unwrap_or("").to_string();
        data_obj.insert(format!("{}_comments", prefix), Value::String(comments.clone()));
    }
    
    let gate_sub_am = gate_submissions::ActiveModel {
        id: Set(Uuid::new_v4()),
        project_id: Set(project_id),
        stage: Set(payload.stage.clone()),
        status: Set(approval.status.clone()),
        decision: Set(approval.decision.clone()),
        data: Set(Value::Object(data_obj)),
        submitted_by: Set(Some(current_user.id)),
        submitted_at: Set(Some(now.into())),
        created_at: Set(now.into()),
        updated_at: Set(Some(now.into())),
        ..Default::default()
    };
    gate_sub_am.insert(&txn).await?;

    record_audit(
        &txn,
        Some(updated_project.id),
        "project_approval",
        &approval.id.to_string(),
        &format!("stage_decision_{}", payload.stage.to_lowercase().replace(' ', "_")),
        Some(serde_json::json!({ "stage": payload.stage, "status": "Pending" })),
        Some(serde_json::json!({
            "status": approval.status,
            "decision": approval.decision,
            "comments": payload.comments,
        })),
        Some(current_user.id),
    )
    .await?;

    txn.commit().await?;

    let manager = users::Entity::find_by_id(updated_project.manager_id).one(db).await?;
    Ok(ProjectResponse::from_model(updated_project, manager))
}

async fn advance_epmo_to_bta(
    txn: &sea_orm::DatabaseTransaction,
    project_am: &mut projects::ActiveModel,
    project: &projects::Model,
) -> AppResult<()> {
    project_am.current_stage = Set(Some("BTA Review".to_string()));
    project_am.current_status = Set(Some("Pending".to_string()));
    project_am.current_owner_role = Set(Some("bta".to_string()));
    project_am.last_stage_completed = Set(Some("EPMO Review".to_string()));
    project_am.workflow_status = Set(Some("EPMO Complete - Ready for BTA".to_string()));

    insert_next_approval(txn, project.id, "BTA Review", UserRole::Bta, 2).await?;
    notify_users_with_role(
        txn,
        UserRole::Bta,
        project.id,
        NotificationType::ApprovalRequired,
        "New Project for BTA Review",
        &format!("Project '{}' has passed EPMO and needs BTA Review.", project.project_name),
        "/bta-review",
    )
    .await?;
    Ok(())
}

async fn advance_bta_to_finance(
    txn: &sea_orm::DatabaseTransaction,
    project_am: &mut projects::ActiveModel,
    project: &projects::Model,
) -> AppResult<()> {
    project_am.current_stage = Set(Some("Finance Review".to_string()));
    project_am.current_status = Set(Some("Pending".to_string()));
    project_am.current_owner_role = Set(Some("finance".to_string()));
    project_am.last_stage_completed = Set(Some("BTA Review".to_string()));
    project_am.workflow_status = Set(Some("BTA Review Completed".to_string()));

    insert_next_approval(txn, project.id, "Finance Review", UserRole::Finance, 3).await?;
    notify_users_with_role(
        txn,
        UserRole::Finance,
        project.id,
        NotificationType::ApprovalRequired,
        "Finance Review Required",
        &format!(
            "Project '{}' has been approved by BTA and requires Finance Review.",
            project.project_name
        ),
        "/finance-review",
    )
    .await?;
    Ok(())
}

async fn advance_finance_to_eac(
    txn: &sea_orm::DatabaseTransaction,
    project_am: &mut projects::ActiveModel,
    project: &projects::Model,
) -> AppResult<()> {
    project_am.current_stage = Set(Some("Prepare for EAC".to_string()));
    project_am.current_status = Set(Some("Pending".to_string()));
    project_am.current_owner_role = Set(Some("eac".to_string()));
    project_am.last_stage_completed = Set(Some("Finance Review".to_string()));
    project_am.workflow_status = Set(Some("Finance Review Completed".to_string()));

    insert_next_approval(txn, project.id, "Prepare for EAC", UserRole::Eac, 4).await?;
    notify_users_with_role(
        txn,
        UserRole::Eac,
        project.id,
        NotificationType::ApprovalRequired,
        "Prepare for EAC Required",
        &format!(
            "Project '{}' has passed Finance Review and needs EAC Preparation.",
            project.project_name
        ),
        "/prepare-eac",
    )
    .await?;
    Ok(())
}

async fn advance_eac_to_pic(
    txn: &sea_orm::DatabaseTransaction,
    project_am: &mut projects::ActiveModel,
    project: &projects::Model,
) -> AppResult<()> {
    project_am.current_stage = Set(Some("Prepare for PIC".to_string()));
    project_am.current_status = Set(Some("Pending".to_string()));
    project_am.current_owner_role = Set(Some("pic".to_string()));
    project_am.last_stage_completed = Set(Some("EAC Review".to_string()));
    project_am.workflow_status = Set(Some("EAC Review Completed".to_string()));

    // Legacy Python duplicated Finance's sequence_order (3) here; fixed to 5.
    insert_next_approval(txn, project.id, "Prepare for PIC", UserRole::Pic, 5).await?;
    notify_users_with_role(
        txn,
        UserRole::Pic,
        project.id,
        NotificationType::ApprovalRequired,
        "Prepare for PIC Required",
        &format!(
            "Project '{}' has received EAC approval and needs PIC Preparation.",
            project.project_name
        ),
        "/prepare-pic",
    )
    .await?;
    Ok(())
}

async fn complete_pic_to_trc(
    txn: &sea_orm::DatabaseTransaction,
    project_am: &mut projects::ActiveModel,
    project: &projects::Model,
    current_user: &CurrentUser,
    payload: &DecisionSubmitRequest,
) -> AppResult<()> {
    project_am.current_stage = Set(Some("TRC Vetting & Gate Review".to_string()));
    project_am.current_status = Set(Some("Approved".to_string()));
    project_am.current_owner_role = Set(Some("trc".to_string()));
    project_am.last_stage_completed = Set(Some("PIC Review".to_string()));
    project_am.workflow_status = Set(Some("PIC Review Completed".to_string()));
    project_am.status = Set(ProjectStatus::Completed);

    let gate_review = gate_reviews::ActiveModel {
        id: Set(Uuid::new_v4()),
        project_id: Set(project.id),
        gate_code: Set(GateCode::P),
        gate_name: Set("PIC Approval".to_string()),
        committee: Set(Some("Project Improvement Committee".to_string())),
        assigned_role: Set(Some(UserRole::Pic)),
        status: Set(Some("approved".to_string())),
        decision: Set(Some(ApprovalDecision::Approved)),
        decision_by_id: Set(Some(current_user.id)),
        decision_at: Set(Some(Utc::now().into())),
        decision_notes: Set(payload.comments.clone()),
        ..Default::default()
    };
    gate_review.insert(txn).await?;

    notify_user(
        txn,
        project.manager_id,
        Some(project.id),
        NotificationType::Approved,
        "PIC Alignment Approved",
        &format!(
            "Your project {} has received PIC approval and has progressed to TRC Vetting.",
            project.project_name
        ),
        Some(&format!("/projects/{}", project.id)),
    )
    .await?;
    Ok(())
}

async fn insert_next_approval<C: sea_orm::ConnectionTrait>(
    txn: &C,
    project_id: Uuid,
    stage: &str,
    role: UserRole,
    sequence_order: i32,
) -> AppResult<()> {
    let approval = project_approvals::ActiveModel {
        id: Set(Uuid::new_v4()),
        project_id: Set(project_id),
        approval_stage: Set(stage.to_string()),
        assigned_role: Set(role),
        status: Set("Pending".to_string()),
        sequence_order: Set(sequence_order),
        notification_sent: Set(true),
        created_at: Set(Utc::now().into()),
        ..Default::default()
    };
    approval.insert(txn).await?;
    Ok(())
}

pub async fn fast_track_complete(
    db: &DatabaseConnection,
    current_user: &CurrentUser,
    project_id: Uuid,
) -> AppResult<ProjectResponse> {
    if current_user.role != UserRole::Admin {
        return Err(AppError::Forbidden("Only admins can fast-track projects".to_string()));
    }

    let txn = db.begin().await?;
    let project = projects::Entity::find_by_id(project_id)
        .one(&txn)
        .await?
        .ok_or_else(|| AppError::NotFound("Project not found".to_string()))?;

    let mut am: projects::ActiveModel = project.clone().into();
    am.current_stage = Set(Some("TRC Vetting & Gate Review".to_string()));
    am.current_status = Set(Some("Approved".to_string()));
    am.current_owner_role = Set(Some("trc".to_string()));
    am.last_stage_completed = Set(Some("PIC Meeting".to_string()));
    am.workflow_status = Set(Some("PIC Review Completed".to_string()));
    am.status = Set(ProjectStatus::Completed);
    let updated_project = am.update(&txn).await?;

    let pending = project_approvals::Entity::find()
        .filter(project_approvals::Column::ProjectId.eq(project_id))
        .filter(project_approvals::Column::Status.eq("Pending"))
        .all(&txn)
        .await?;
    let now = Utc::now();
    for approval in pending {
        let mut approval_am: project_approvals::ActiveModel = approval.into();
        approval_am.status = Set("Approved".to_string());
        approval_am.decision = Set(Some("Approve".to_string()));
        approval_am.approved_by = Set(Some(current_user.id));
        approval_am.approved_at = Set(Some(now.into()));
        approval_am.comments = Set(Some("Auto-approved via Admin Fast-Track".to_string()));
        approval_am.update(&txn).await?;
    }

    record_audit(
        &txn,
        Some(updated_project.id),
        "project",
        &updated_project.id.to_string(),
        "admin_fast_track_complete",
        None,
        Some(serde_json::json!({ "status": "COMPLETED" })),
        Some(current_user.id),
    )
    .await?;

    txn.commit().await?;
    let manager = users::Entity::find_by_id(updated_project.manager_id).one(db).await?;
    Ok(ProjectResponse::from_model(updated_project, manager))
}
