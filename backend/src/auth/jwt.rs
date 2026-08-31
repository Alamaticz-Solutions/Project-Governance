use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    pub exp: i64,
    #[serde(rename = "type")]
    pub token_type: String,
}

pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
}

pub fn issue_token_pair(
    secret: &str,
    user_id: Uuid,
    role: &str,
    email: &str,
    access_minutes: i64,
    refresh_days: i64,
) -> AppResult<TokenPair> {
    let access = encode_token(
        secret,
        Claims {
            sub: user_id.to_string(),
            role: Some(role.to_string()),
            email: Some(email.to_string()),
            exp: (Utc::now() + Duration::minutes(access_minutes)).timestamp(),
            token_type: "access".to_string(),
        },
    )?;

    let refresh = encode_token(
        secret,
        Claims {
            sub: user_id.to_string(),
            role: None,
            email: None,
            exp: (Utc::now() + Duration::days(refresh_days)).timestamp(),
            token_type: "refresh".to_string(),
        },
    )?;

    Ok(TokenPair {
        access_token: access,
        refresh_token: refresh,
    })
}

fn encode_token(secret: &str, claims: Claims) -> AppResult<String> {
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(anyhow::anyhow!("token encode failed: {e}")))
}

pub fn decode_token(secret: &str, token: &str) -> AppResult<Claims> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|_| AppError::Unauthorized("Invalid or expired token".to_string()))
}
