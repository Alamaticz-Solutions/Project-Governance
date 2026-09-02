use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

/// Single application-wide error type. Every handler returns `Result<T, AppError>`
/// so error → HTTP status mapping happens in exactly one place.
#[derive(thiserror::Error, Debug)]
pub enum AppError {
    #[error("{0}")]
    NotFound(String),

    #[error("{0}")]
    BadRequest(String),

    #[error("{0}")]
    Unauthorized(String),

    #[error("{0}")]
    Forbidden(String),

    #[error("{0}")]
    Conflict(String),

    #[error(transparent)]
    Database(#[from] sea_orm::DbErr),

    #[error(transparent)]
    Internal(#[from] anyhow::Error),

    /// An upstream integration (e.g. Microsoft Graph) returned an error.
    /// `code` carries the provider's machine code (e.g.
    /// `GraphAccessToTranscriptsDisabled`) when present, so callers can branch;
    /// `retryable` distinguishes transient failures from permanent ones.
    #[error("{message}")]
    Upstream {
        code: Option<String>,
        message: String,
        retryable: bool,
    },
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg.clone()),
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg.clone()),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg.clone()),
            AppError::Database(err) => {
                tracing::error!(error = %err, "database error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                )
            }
            AppError::Internal(err) => {
                tracing::error!(error = %err, "internal error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                )
            }
            AppError::Upstream { code, message, .. } => {
                tracing::error!(code = ?code, "upstream integration error: {message}");
                (StatusCode::BAD_GATEWAY, message.clone())
            }
        };

        (status, Json(json!({ "detail": message }))).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;
