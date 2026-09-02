use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait,
    QueryFilter,
};
use uuid::Uuid;

use crate::{
    auth::password::hash_password,
    entities::{sea_orm_active_enums::UserRole, users, workflow_definitions, workflow_stage_definitions},
};

const DEMO_PASSWORD: &str = "Demo1234!";

/// Idempotently seeds one demo user per role, mirroring `app/db/seed.py`.
/// Demo project seeding stayed disabled in the legacy backend too — only
/// users are seeded so a fresh environment has someone to log in as.
pub async fn seed_demo_users(db: &DatabaseConnection) -> anyhow::Result<()> {
    let demo_users = [
        ("admin@abchealth.com", "admin", "Alex Administrator", UserRole::Admin),
        ("pm@abchealth.com", "pm_user", "Priya Manager", UserRole::ProjectManager),
        ("bta@abchealth.com", "bta_user", "Bailey Alignment", UserRole::Bta),
        ("epmo@abchealth.com", "epmo_user", "Emery Pmo", UserRole::Epmo),
        ("eac@abchealth.com", "eac_user", "Ellis Architecture", UserRole::Eac),
        ("pic@abchealth.com", "pic_user", "Pat Investment", UserRole::Pic),
        ("finance@abchealth.com", "finance_user", "Frankie Finance", UserRole::Finance),
    ];

    let hashed = hash_password(DEMO_PASSWORD)?;

    for (email, username, full_name, role) in demo_users {
        let existing = users::Entity::find()
            .filter(users::Column::Email.eq(email))
            .one(db)
            .await?;
        if let Some(existing_user) = existing {
            if !existing_user.hashed_password.starts_with("$argon2") {
                let mut active_user: users::ActiveModel = existing_user.into();
                active_user.hashed_password = Set(hashed.clone());
                active_user.update(db).await?;
                tracing::info!(email, "updated legacy password hash for demo user");
            }
            continue;
        }

        let user = users::ActiveModel {
            id: Set(Uuid::new_v4()),
            email: Set(email.to_string()),
            username: Set(username.to_string()),
            full_name: Set(full_name.to_string()),
            hashed_password: Set(hashed.clone()),
            role: Set(role),
            is_active: Set(true),
            is_verified: Set(true),
            created_at: Set(Utc::now().into()),
            ..Default::default()
        };
        user.insert(db).await?;
        tracing::info!(email, "seeded demo user");
    }

    Ok(())
}

pub async fn seed_workflow_definitions(db: &DatabaseConnection) -> anyhow::Result<()> {
    // Check if the workflow already exists — and that it actually has its
    // stage rows. A previous run could have inserted the parent definition
    // and then failed partway through the (non-transactional) stage loop,
    // leaving a headless definition that would otherwise be skipped forever.
    let existing = workflow_definitions::Entity::find()
        .filter(workflow_definitions::Column::Name.eq("Standard Project Lifecycle v2"))
        .one(db)
        .await?;

    // Reuse the existing definition row if there is one (adding only the
    // missing stage rows) rather than deleting and recreating it. A delete
    // would assume every FK to `workflow_definitions` cascades —
    // `workflow_stage_definitions.workflow_id` does, but
    // `workflow_instances.definition_id` does not, so on any DB where an
    // instance already references this definition the delete raises a FK
    // violation and aborts startup.
    let workflow_id = if let Some(wf) = existing {
        let stage_count = workflow_stage_definitions::Entity::find()
            .filter(workflow_stage_definitions::Column::WorkflowId.eq(wf.id))
            .count(db)
            .await?;
        if stage_count > 0 {
            tracing::info!("Workflow definition already seeded.");
            return Ok(());
        }
        tracing::warn!("Found a workflow definition with no stages — adding its stage rows.");
        wf.id
    } else {
        let workflow_id = Uuid::new_v4();
        let workflow = workflow_definitions::ActiveModel {
            id: Set(workflow_id),
            name: Set("Standard Project Lifecycle v2".to_string()),
            version: Set(Some(1)),
            description: Set(Some("The 5-phase DAG process for project governance".to_string())),
            is_active: Set(Some(true)),
            ..Default::default()
        };
        workflow.insert(db).await?;
        workflow_id
    };

    let phases = vec![
        ("Intake-BTA", "INTAKE_BTA", 1, "BTA Intake review", None),
        ("Intake-EPMO", "INTAKE_EPMO", 1, "EPMO Intake review", None),
        
        ("BTA-Meeting", "BTA_MEETING", 2, "BTA Meeting alignment", Some(serde_json::json!({"gates": ["INTAKE_BTA"]}))),
        ("PM", "PM_ASSIGN", 2, "Project Manager assignment", Some(serde_json::json!({"gates": ["INTAKE_EPMO"]}))),
        
        ("VCR", "VCR_REVIEW", 3, "Vendor Compliance Review", Some(serde_json::json!({"gates": ["BTA_MEETING", "PM_ASSIGN"]}))),
        
        ("VRA", "VRA_REVIEW", 4, "Vendor Risk Assessment", Some(serde_json::json!({"gates": ["VCR_REVIEW"]}))),
        ("EAC", "EAC_REVIEW", 4, "Enterprise Architecture Committee", Some(serde_json::json!({"gates": ["VCR_REVIEW"]}))),
        ("PIC", "PIC_REVIEW", 4, "Project Investment Committee", Some(serde_json::json!({"gates": ["VCR_REVIEW"]}))),
        
        ("Intake-TRC", "INTAKE_TRC", 5, "TRC Intake", Some(serde_json::json!({"gates": ["VRA_REVIEW", "EAC_REVIEW", "PIC_REVIEW"]}))),
        ("Intake-SRA", "INTAKE_SRA", 5, "SRA Intake", Some(serde_json::json!({"gates": ["VRA_REVIEW", "EAC_REVIEW", "PIC_REVIEW"]}))),
        
        ("TRC", "TRC_REVIEW", 6, "Technical Review Committee", Some(serde_json::json!({"gates": ["INTAKE_TRC"]}))),
        ("SRA", "SRA_REVIEW", 6, "Security Risk Assessment", Some(serde_json::json!({"gates": ["INTAKE_SRA"]}))),
        
        ("APM", "APM_REVIEW", 7, "Application Portfolio Management", Some(serde_json::json!({"gates": ["TRC_REVIEW", "SRA_REVIEW"]}))),
        
        ("Intake-ST", "INTAKE_ST", 8, "Service Transition Intake", Some(serde_json::json!({"gates": ["APM_REVIEW"]}))),
        
        ("ST-Runbook", "ST_RUNBOOK", 9, "Service Transition Runbook", Some(serde_json::json!({"gates": ["INTAKE_ST"]}))),
        ("TechRB", "TECH_RB", 9, "Technical Runbook", Some(serde_json::json!({"gates": ["INTAKE_ST"]}))),
        ("Vendor ST", "VENDOR_ST", 9, "Vendor Service Transition", Some(serde_json::json!({"gates": ["INTAKE_ST"]}))),
        
        ("CAB-CT", "CAB_CT", 10, "Change Advisory Board - CT", Some(serde_json::json!({"gates": ["ST_RUNBOOK", "TECH_RB", "VENDOR_ST"]}))),
        ("CAB-ER", "CAB_ER", 11, "Change Advisory Board - ER", Some(serde_json::json!({"gates": ["CAB_CT"]}))),
    ];

    for (name, code, order, desc, prereqs) in phases {
        let stage = workflow_stage_definitions::ActiveModel {
            id: Set(Uuid::new_v4()),
            workflow_id: Set(workflow_id),
            stage_name: Set(name.to_string()),
            stage_code: Set(code.to_string()),
            sequence_order: Set(order),
            description: Set(Some(desc.to_string())),
            phase_name: Set(name.to_string()), // phase_name is same as stage_name for these high-level gates
            assigned_roles: Set(Some(serde_json::json!(["admin"]))),
            prerequisites: Set(prereqs),
            conditions: Set(Some(serde_json::json!({"rules": []}))), // eligible by default once prereqs met
            parallel_execution: Set(Some(false)),
            auto_advance: Set(Some(false)),
            sla_days: Set(Some(5)),
            checklist_template: Set(Some(serde_json::json!([]))),
            ..Default::default()
        };
        stage.insert(db).await?;
    }

    tracing::info!("Seeded 5-phase workflow definitions");
    Ok(())
}
