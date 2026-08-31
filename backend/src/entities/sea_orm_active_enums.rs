//! Postgres native enum types shared across entities.
//! Mirrors the enum columns in `models.py` — values are lowercase snake_case
//! matching each Python enum member's `.value`.
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "user_role")]
pub enum UserRole {
    #[sea_orm(string_value = "ADMIN")]
    Admin,
    #[sea_orm(string_value = "PROJECT_MANAGER")]
    ProjectManager,
    #[sea_orm(string_value = "BTA")]
    Bta,
    #[sea_orm(string_value = "EPMO")]
    Epmo,
    #[sea_orm(string_value = "FINANCE")]
    Finance,
    #[sea_orm(string_value = "VENDOR_SCREENING")]
    VendorScreening,
    #[sea_orm(string_value = "ANALYSIS_TEAM")]
    AnalysisTeam,
    #[sea_orm(string_value = "EAC")]
    Eac,
    #[sea_orm(string_value = "CAB")]
    Cab,
    #[sea_orm(string_value = "SECURITY")]
    Security,
    #[sea_orm(string_value = "TAF")]
    Taf,
    #[sea_orm(string_value = "TRC")]
    Trc,
    #[sea_orm(string_value = "PIC")]
    Pic,
    #[sea_orm(string_value = "VIEWER")]
    Viewer,
}

impl UserRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            UserRole::Admin => "ADMIN",
            UserRole::ProjectManager => "PROJECT_MANAGER",
            UserRole::Bta => "BTA",
            UserRole::Epmo => "EPMO",
            UserRole::Finance => "FINANCE",
            UserRole::VendorScreening => "VENDOR_SCREENING",
            UserRole::AnalysisTeam => "ANALYSIS_TEAM",
            UserRole::Eac => "EAC",
            UserRole::Cab => "CAB",
            UserRole::Security => "SECURITY",
            UserRole::Taf => "TAF",
            UserRole::Trc => "TRC",
            UserRole::Pic => "PIC",
            UserRole::Viewer => "VIEWER",
        }
    }

    pub fn from_str_opt(s: &str) -> Option<Self> {
        Some(match s.to_uppercase().as_str() {
            "ADMIN" => UserRole::Admin,
            "PROJECT_MANAGER" => UserRole::ProjectManager,
            "BTA" => UserRole::Bta,
            "EPMO" => UserRole::Epmo,
            "FINANCE" => UserRole::Finance,
            "VENDOR_SCREENING" => UserRole::VendorScreening,
            "ANALYSIS_TEAM" => UserRole::AnalysisTeam,
            "EAC" => UserRole::Eac,
            "CAB" => UserRole::Cab,
            "SECURITY" => UserRole::Security,
            "TAF" => UserRole::Taf,
            "TRC" => UserRole::Trc,
            "PIC" => UserRole::Pic,
            "VIEWER" => UserRole::Viewer,
            _ => return None,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "project_status")]
pub enum ProjectStatus {
    #[sea_orm(string_value = "DRAFT")]
    Draft,
    #[sea_orm(string_value = "ACTIVE")]
    Active,
    #[sea_orm(string_value = "ON_HOLD")]
    OnHold,
    #[sea_orm(string_value = "COMPLETED")]
    Completed,
    #[sea_orm(string_value = "CANCELLED")]
    Cancelled,
    #[sea_orm(string_value = "ARCHIVED")]
    Archived,
    #[sea_orm(string_value = "IN_DELIVERY")]
    InDelivery,
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "project_priority")]
pub enum ProjectPriority {
    #[sea_orm(string_value = "CRITICAL")]
    Critical,
    #[sea_orm(string_value = "HIGH")]
    High,
    #[sea_orm(string_value = "MEDIUM")]
    Medium,
    #[sea_orm(string_value = "LOW")]
    Low,
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "project_risk")]
pub enum ProjectRisk {
    #[sea_orm(string_value = "VERY_HIGH")]
    VeryHigh,
    #[sea_orm(string_value = "HIGH")]
    High,
    #[sea_orm(string_value = "MEDIUM")]
    Medium,
    #[sea_orm(string_value = "LOW")]
    Low,
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "workflow_stage_status")]
pub enum WorkflowStageStatus {
    #[sea_orm(string_value = "LOCKED")]
    Locked,
    #[sea_orm(string_value = "ELIGIBLE")]
    Eligible,
    #[sea_orm(string_value = "IN_PROGRESS")]
    InProgress,
    #[sea_orm(string_value = "PENDING_APPROVAL")]
    PendingApproval,
    #[sea_orm(string_value = "COMPLETED")]
    Completed,
    #[sea_orm(string_value = "SKIPPED")]
    Skipped,
    #[sea_orm(string_value = "REJECTED")]
    Rejected,
    #[sea_orm(string_value = "CHANGES_REQUESTED")]
    ChangesRequested,
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "task_status")]
pub enum TaskStatus {
    #[sea_orm(string_value = "PENDING")]
    Pending,
    #[sea_orm(string_value = "IN_PROGRESS")]
    InProgress,
    #[sea_orm(string_value = "COMPLETED")]
    Completed,
    #[sea_orm(string_value = "OVERDUE")]
    Overdue,
    #[sea_orm(string_value = "CANCELLED")]
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "approval_decision")]
pub enum ApprovalDecision {
    #[sea_orm(string_value = "APPROVED")]
    Approved,
    #[sea_orm(string_value = "REJECTED")]
    Rejected,
    #[sea_orm(string_value = "NEEDS_INFO")]
    NeedsInfo,
    #[sea_orm(string_value = "DEFERRED")]
    Deferred,
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "notification_type")]
pub enum NotificationType {
    #[sea_orm(string_value = "PROJECT_CREATED")]
    ProjectCreated,
    #[sea_orm(string_value = "TASK_ASSIGNED")]
    TaskAssigned,
    #[sea_orm(string_value = "TASK_COMPLETED")]
    TaskCompleted,
    #[sea_orm(string_value = "APPROVAL_REQUIRED")]
    ApprovalRequired,
    #[sea_orm(string_value = "APPROVED")]
    Approved,
    #[sea_orm(string_value = "REJECTED")]
    Rejected,
    #[sea_orm(string_value = "OVERDUE")]
    Overdue,
    #[sea_orm(string_value = "STAGE_ADVANCED")]
    StageAdvanced,
    #[sea_orm(string_value = "COMMENT_ADDED")]
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
