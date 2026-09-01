use chrono::Utc;
use sea_orm::{ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use uuid::Uuid;
use validator::Validate;

use crate::{
    auth::{
        jwt::{decode_token, issue_token_pair},
        password::{hash_password, verify_password},
    },
    config::AppConfig,
    dto::auth::{RegisterRequest, TokenResponse, UserResponse},
    entities::{sea_orm_active_enums::UserRole, users},
    error::{AppError, AppResult},
    services::support::record_audit,
};

pub async fn login(
    db: &DatabaseConnection,
    config: &AppConfig,
    email: &str,
    password: &str,
) -> AppResult<TokenResponse> {
    let user = users::Entity::find()
        .filter(users::Column::Email.eq(email.to_lowercase()))
        .one(db)
        .await?
        .ok_or_else(|| AppError::Unauthorized("Incorrect email or password".to_string()))?;

    if !verify_password(password, &user.hashed_password) {
        return Err(AppError::Unauthorized("Incorrect email or password".to_string()));
    }
    if !user.is_active {
        return Err(AppError::Unauthorized("Account is deactivated".to_string()));
    }

    let pair = issue_token_pair(
        &config.jwt_secret,
        user.id,
        user.role.as_str(),
        &user.email,
        config.access_token_expire_minutes,
        config.refresh_token_expire_days,
    )?;

    let mut am: users::ActiveModel = user.clone().into();
    am.last_login = Set(Some(Utc::now().into()));
    let user = am.update(db).await?;

    record_audit(
        db,
        None,
        "user",
        &user.id.to_string(),
        "login",
        None,
        None,
        Some(user.id),
    )
    .await?;

    Ok(TokenResponse {
        access_token: pair.access_token,
        refresh_token: pair.refresh_token,
        token_type: "bearer".to_string(),
        user: user.into(),
    })
}

/// Public self-registration. Closes the legacy gap where `role` was taken
/// directly from the request body — anyone could register as `admin`.
/// Self-service accounts are always created as `viewer`; every other role
/// must go through `admin_create_user` by an authenticated admin.
pub async fn register(db: &DatabaseConnection, payload: RegisterRequest) -> AppResult<UserResponse> {
    payload
        .validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let existing = users::Entity::find()
        .filter(users::Column::Email.eq(payload.email.to_lowercase()))
        .one(db)
        .await?;
    if existing.is_some() {
        return Err(AppError::Conflict("Email is already registered".to_string()));
    }

    let hashed = hash_password(&payload.password)?;
    let user = users::ActiveModel {
        id: Set(Uuid::new_v4()),
        email: Set(payload.email.to_lowercase()),
        username: Set(payload.username),
        full_name: Set(payload.full_name),
        hashed_password: Set(hashed),
        role: Set(UserRole::Viewer),
        department: Set(payload.department),
        job_title: Set(payload.job_title),
        is_active: Set(true),
        is_verified: Set(false),
        created_at: Set(Utc::now().into()),
        ..Default::default()
    };
    let user = user.insert(db).await?;
    Ok(user.into())
}

pub async fn admin_create_user(
    db: &DatabaseConnection,
    payload: crate::dto::auth::AdminCreateUserRequest,
) -> AppResult<UserResponse> {
    payload
        .validate()
        .map_err(|e| AppError::BadRequest(e.to_string()))?;

    let existing = users::Entity::find()
        .filter(users::Column::Email.eq(payload.email.to_lowercase()))
        .one(db)
        .await?;
    if existing.is_some() {
        return Err(AppError::Conflict("Email is already registered".to_string()));
    }

    let hashed = hash_password(&payload.password)?;
    let user = users::ActiveModel {
        id: Set(Uuid::new_v4()),
        email: Set(payload.email.to_lowercase()),
        username: Set(payload.username),
        full_name: Set(payload.full_name),
        hashed_password: Set(hashed),
        role: Set(payload.role),
        department: Set(payload.department),
        job_title: Set(payload.job_title),
        is_active: Set(true),
        is_verified: Set(true),
        created_at: Set(Utc::now().into()),
        ..Default::default()
    };
    let user = user.insert(db).await?;
    Ok(user.into())
}

pub async fn refresh(
    db: &DatabaseConnection,
    config: &AppConfig,
    refresh_token: &str,
) -> AppResult<TokenResponse> {
    let claims = decode_token(&config.jwt_secret, refresh_token)?;
    if claims.token_type != "refresh" {
        return Err(AppError::Unauthorized("Expected a refresh token".to_string()));
    }

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Unauthorized("Invalid token subject".to_string()))?;
    let user = users::Entity::find_by_id(user_id)
        .one(db)
        .await?
        .filter(|u| u.is_active)
        .ok_or_else(|| AppError::Unauthorized("User not found or inactive".to_string()))?;

    let pair = issue_token_pair(
        &config.jwt_secret,
        user.id,
        user.role.as_str(),
        &user.email,
        config.access_token_expire_minutes,
        config.refresh_token_expire_days,
    )?;

    Ok(TokenResponse {
        access_token: pair.access_token,
        refresh_token: pair.refresh_token,
        token_type: "bearer".to_string(),
        user: user.into(),
    })
}
