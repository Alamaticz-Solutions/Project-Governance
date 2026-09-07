//! Postgres error -> `RuntimeError` classification.
//!
//! Product-owned (backend framework replacement phase 3a --
//! docs/architecture/self-owned-backend-plan.md). Previously
//! `appfw_provider_postgres::error::postgres_runtime_error`. Still delegates
//! to `crate::platform::runtime::provider_error` for the stable error-kind mapping --
//! that module belongs to the runtime crate, not the postgres provider, and
//! is in scope for a later phase (see the design doc).

use crate::platform::errors::DataStoreError;
use crate::platform::runtime::{provider_error, provider_keys::FrameworkProvider, RuntimeError};

pub fn classify_postgres_error_code(code: &str, field: Option<&str>) -> Option<DataStoreError> {
    provider_error::classify_postgres_code(code, field).map(Into::into)
}

pub fn postgres_runtime_error(error: tokio_postgres::Error) -> RuntimeError {
    let message = error.to_string();
    if let Some(db_error) = error.as_db_error() {
        // Classified in `provider_error`'s own (still framework-owned)
        // `DataStoreError` terms here, not `classify_postgres_error_code`'s
        // self-owned return type above -- `stable_provider_error` (also not
        // yet ported) needs its `kind` argument in that same type. Converted
        // once, at the end, into the self-owned `RuntimeError::DataStore`.
        if let Some(kind) =
            provider_error::classify_postgres_code(db_error.code().code(), db_error.column())
        {
            return RuntimeError::DataStore(
                provider_error::stable_provider_error(FrameworkProvider::Postgres, message, kind)
                    .into(),
            );
        }
    }
    RuntimeError::DataStore(
        provider_error::normalize_provider_error(FrameworkProvider::Postgres, message).into(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_native_postgres_codes_to_stable_runtime_errors() {
        assert_eq!(
            classify_postgres_error_code("23505", None)
                .expect("duplicate code")
                .to_string(),
            "duplicate key: record already exists"
        );
        assert_eq!(
            classify_postgres_error_code("23503", None)
                .expect("foreign key code")
                .to_string(),
            "foreign key: record references a missing related record"
        );
        assert_eq!(
            classify_postgres_error_code("23502", Some("name"))
                .expect("required field code")
                .to_string(),
            "required field: name"
        );
        assert!(classify_postgres_error_code("00000", None).is_none());
    }
}
