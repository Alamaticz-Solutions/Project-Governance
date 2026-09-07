//! Postgres error -> `RuntimeError` classification.
//!
//! Product-owned (backend framework replacement phase 3a --
//! docs/architecture/self-owned-backend-plan.md). Previously
//! `appfw_provider_postgres::error::postgres_runtime_error`. Delegates to
//! `crate::platform::runtime::provider_error` for the stable error-kind
//! mapping -- that module is self-owned too (`platform::provider_error`,
//! phase 7 slice 8), just factored separately since it belongs
//! conceptually to the runtime facade, not the postgres provider.

use crate::platform::errors::DataStoreError;
use crate::platform::runtime::{provider_error, provider_keys::FrameworkProvider, RuntimeError};

#[allow(dead_code)] // tested directly below; production path goes through postgres_runtime_error
pub fn classify_postgres_error_code(code: &str, field: Option<&str>) -> Option<DataStoreError> {
    provider_error::classify_postgres_code(code, field).map(Into::into)
}

pub fn postgres_runtime_error(error: tokio_postgres::Error) -> RuntimeError {
    let message = error.to_string();
    if let Some(db_error) = error.as_db_error() {
        // Classified in `provider_error`'s own `DataStoreError` terms here,
        // not `classify_postgres_error_code`'s return type above -- both are
        // this crate's self-owned `DataStoreError` (`platform::errors`) by
        // this point, so this is just picking the right helper for
        // `stable_provider_error`'s `kind` argument, not a framework
        // boundary any more.
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
