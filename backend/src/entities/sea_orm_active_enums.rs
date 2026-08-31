//! Postgres native enum types shared across entities.
//! Values are lowercase snake_case, matching the `CREATE TYPE ... AS ENUM`
//! labels in `m20260101_000001_init_schema.rs` and the string unions the
//! frontend expects (see `frontend/src/lib/types.ts`). The one exception is
//! `GateCode`, whose Postgres labels are uppercase (`'A'..'S','CAB'`).
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "user_role")]
pub enum UserRole {
    #[sea_orm(string_value = "admin")]
    Admin,
    #[sea_orm(string_value = "project_manager")]
    ProjectManager,
    #[sea_orm(string_value = "bta")]
    Bta,
    #[sea_orm(string_value = "epmo")]
    Epmo,
    #[sea_orm(string_value = "finance")]
    Finance,
    #[sea_orm(string_value = "vendor_screening")]
    VendorScreening,
    #[sea_orm(string_value = "analysis_team")]
    AnalysisTeam,
    #[sea_orm(string_value = "eac")]
    Eac,
    #[sea_orm(string_value = "cab")]
    Cab,
    #[sea_orm(string_value = "security")]
    Security,
    #[sea_orm(string_value = "taf")]
    Taf,
    #[sea_orm(string_value = "trc")]
    Trc,
    #[sea_orm(string_value = "pic")]
    Pic,
    #[sea_orm(string_value = "viewer")]
    Viewer,
}

impl UserRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            UserRole::Admin => "admin",
            UserRole::ProjectManager => "project_manager",
            UserRole::Bta => "bta",
            UserRole::Epmo => "epmo",
            UserRole::Finance => "finance",
            UserRole::VendorScreening => "vendor_screening",
            UserRole::AnalysisTeam => "analysis_team",
            UserRole::Eac => "eac",
            UserRole::Cab => "cab",
            UserRole::Security => "security",
            UserRole::Taf => "taf",
            UserRole::Trc => "trc",
            UserRole::Pic => "pic",
            UserRole::Viewer => "viewer",
        }
    }

    pub fn from_str_opt(s: &str) -> Option<Self> {
        Some(match s.to_lowercase().as_str() {
            "admin" => UserRole::Admin,
            "project_manager" => UserRole::ProjectManager,
            "bta" => UserRole::Bta,
            "epmo" => UserRole::Epmo,
            "finance" => UserRole::Finance,
            "vendor_screening" => UserRole::VendorScreening,
            "analysis_team" => UserRole::AnalysisTeam,
            "eac" => UserRole::Eac,
            "cab" => UserRole::Cab,
            "security" => UserRole::Security,
            "taf" => UserRole::Taf,
            "trc" => UserRole::Trc,
            "pic" => UserRole::Pic,
            "viewer" => UserRole::Viewer,
            _ => return None,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "project_status")]
pub enum ProjectStatus {
    #[sea_orm(string_value = "draft")]
    Draft,
    #[sea_orm(string_value = "active")]
    Active,
    #[sea_orm(string_value = "on_hold")]
    OnHold,
    #[sea_orm(string_value = "completed")]
    Completed,
    #[sea_orm(string_value = "cancelled")]
    Cancelled,
    #[sea_orm(string_value = "archived")]
    Archived,
    #[sea_orm(string_value = "in_delivery")]
    InDelivery,
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "project_priority")]
pub enum ProjectPriority {
    #[sea_orm(string_value = "critical")]
    Critical,
    #[sea_orm(string_value = "high")]
    High,
    #[sea_orm(string_value = "medium")]
    Medium,
    #[sea_orm(string_value = "low")]
    Low,
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "project_risk")]
pub enum ProjectRisk {
    #[sea_orm(string_value = "very_high")]
    VeryHigh,
    #[sea_orm(string_value = "high")]
    High,
    #[sea_orm(string_value = "medium")]
    Medium,
    #[sea_orm(string_value = "low")]
    Low,
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "workflow_stage_status")]
pub enum WorkflowStageStatus {
    #[sea_orm(string_value = "locked")]
    Locked,
    #[sea_orm(string_value = "eligible")]
    Eligible,
    #[sea_orm(string_value = "in_progress")]
    InProgress,
    #[sea_orm(string_value = "pending_approval")]
    PendingApproval,
    #[sea_orm(string_value = "completed")]
    Completed,
    #[sea_orm(string_value = "skipped")]
    Skipped,
    #[sea_orm(string_value = "rejected")]
    Rejected,
    #[sea_orm(string_value = "changes_requested")]
    ChangesRequested,
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "task_status")]
pub enum TaskStatus {
    #[sea_orm(string_value = "pending")]
    Pending,
    #[sea_orm(string_value = "in_progress")]
    InProgress,
    #[sea_orm(string_value = "completed")]
    Completed,
    #[sea_orm(string_value = "overdue")]
    Overdue,
    #[sea_orm(string_value = "cancelled")]
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "approval_decision")]
pub enum ApprovalDecision {
    #[sea_orm(string_value = "approved")]
    Approved,
    #[sea_orm(string_value = "rejected")]
    Rejected,
    #[sea_orm(string_value = "needs_info")]
    NeedsInfo,
    #[sea_orm(string_value = "deferred")]
    Deferred,
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "notification_type")]
pub enum NotificationType {
    #[sea_orm(string_value = "project_created")]
    ProjectCreated,
    #[sea_orm(string_value = "task_assigned")]
    TaskAssigned,
    #[sea_orm(string_value = "task_completed")]
    TaskCompleted,
    #[sea_orm(string_value = "approval_required")]
    ApprovalRequired,
    #[sea_orm(string_value = "approved")]
    Approved,
    #[sea_orm(string_value = "rejected")]
    Rejected,
    #[sea_orm(string_value = "overdue")]
    Overdue,
    #[sea_orm(string_value = "stage_advanced")]
    StageAdvanced,
    #[sea_orm(string_value = "comment_added")]
    CommentAdded,
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "gate_code")]
pub enum GateCode {
    #[sea_orm(string_value = "A")]
    A,
    #[sea_orm(string_value = "B")]
    B,
    #[sea_orm(string_value = "C")]
    C,
    #[sea_orm(string_value = "D")]
    D,
    #[sea_orm(string_value = "E")]
    E,
    #[sea_orm(string_value = "F")]
    F,
    #[sea_orm(string_value = "G")]
    G,
    #[sea_orm(string_value = "H")]
    H,
    #[sea_orm(string_value = "I")]
    I,
    #[sea_orm(string_value = "J")]
    J,
    #[sea_orm(string_value = "K")]
    K,
    #[sea_orm(string_value = "L")]
    L,
    #[sea_orm(string_value = "M")]
    M,
    #[sea_orm(string_value = "N")]
    N,
    #[sea_orm(string_value = "O")]
    O,
    #[sea_orm(string_value = "P")]
    P,
    #[sea_orm(string_value = "Q")]
    Q,
    #[sea_orm(string_value = "R")]
    R,
    #[sea_orm(string_value = "S")]
    S,
    #[sea_orm(string_value = "CAB")]
    Cab,
}
