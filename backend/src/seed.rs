use chrono::Utc;
use sea_orm::{ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use uuid::Uuid;

use crate::{
    auth::password::hash_password,
    entities::{sea_orm_active_enums::UserRole, users},
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
