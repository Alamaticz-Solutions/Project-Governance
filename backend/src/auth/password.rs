use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

use crate::error::{AppError, AppResult};

pub fn hash_password(plain: &str) -> AppResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(plain.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("password hash failed: {e}")))
}

pub fn verify_password(plain: &str, hashed: &str) -> bool {
    let Ok(parsed_hash) = PasswordHash::new(hashed) else {
        return false;
    };
    Argon2::default()
        .verify_password(plain.as_bytes(), &parsed_hash)
        .is_ok()
}
