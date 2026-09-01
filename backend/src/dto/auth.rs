use chrono::{DateTime, FixedOffset};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::entities::{sea_orm_active_enums::UserRole, users};

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    pub email: String,
    pub username: String,
    pub full_name: String,
    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,
    pub department: Option<String>,
    pub job_title: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub full_name: String,
    pub role: UserRole,
    pub department: Option<String>,
    pub job_title: Option<String>,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
    pub is_active: bool,
    pub is_verified: bool,
    pub last_login: Option<DateTime<FixedOffset>>,
    pub created_at: DateTime<FixedOffset>,
}

impl From<users::Model> for UserResponse {
    fn from(u: users::Model) -> Self {
        Self {
            id: u.id,
            email: u.email,
            username: u.username,
            full_name: u.full_name,
            role: u.role,
            department: u.department,
            job_title: u.job_title,
            phone: u.phone,
            avatar_url: u.avatar_url,
            is_active: u.is_active,
            is_verified: u.is_verified,
            last_login: u.last_login,
            created_at: u.created_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub user: UserResponse,
}

/// Admin-only user creation — the only way to mint a non-viewer/PM account.
/// Closes the gap where `/auth/register` used to let anyone self-assign
/// `admin`.
#[derive(Debug, Deserialize, Validate)]
pub struct AdminCreateUserRequest {
    pub email: String,
    pub username: String,
    pub full_name: String,
    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub password: String,
    pub role: UserRole,
    pub department: Option<String>,
    pub job_title: Option<String>,
}
