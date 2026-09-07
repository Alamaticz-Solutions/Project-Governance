//! Core runtime error types, ported near-verbatim off `appfw_runtime`
//! (backend framework replacement phase 7, slice 2 --
//! docs/architecture/self-owned-backend-plan.md). Each of these six enums
//! is a plain `thiserror` data type -- variant names, fields, and `#[error]`
//! message strings are load-bearing (they're the exact text GraphQL clients
//! see via `async-graphql`'s blanket `From<E: std::error::Error> for Error`,
//! and `AppError::category()`/variant matches drive branching elsewhere in
//! this crate), so this is a byte-for-byte oracle port, not a redesign.
//!
//! This file used to also carry one-way `From<appfw_runtime::*Error>`
//! bridges for producers that, at the time, still returned the
//! framework's own error types (`RuntimeEntityMetadata`/
//! `RuntimePropertyMetadata`/`RuntimeFilterOp`). Deleted in slice 8:
//! confirmed dead by grep before removal -- every one of those producers
//! is self-owned now (`platform::model_metadata`/`platform::
//! query_filter`, both ported earlier in this same slice), and nothing
//! else anywhere in `backend/src` names `appfw_runtime::ConfigError`/
//! `DataStoreError`/`MetadataError`/`QueryBuildError`/`RuntimeError`.

use thiserror::Error;

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("failed to load runtime configuration: {0}")]
    Load(String),
    #[error("failed to read configuration file {path}: {message}")]
    Io { path: String, message: String },
    #[error("failed to parse configuration file {path}: {message}")]
    Parse { path: String, message: String },
    #[error("required environment variable is missing: {name}")]
    MissingEnvVar { name: String },
    #[error(
        "environment '{environment_name}' is not configured for data source '{data_source_name}'"
    )]
    MissingConfiguredEnvironment {
        data_source_name: String,
        environment_name: String,
    },
    #[error("invalid configuration path {path}: {message}")]
    InvalidPath { path: String, message: String },
    #[error("failed to load policy {path}: {message}")]
    PolicyLoad { path: String, message: String },
    #[error("data source not found: {0}")]
    MissingDataSource(String),
    #[error("data source environment not found for: {0}")]
    MissingDataSourceEnvironment(String),
    #[error("entity type not found: {schema_name}.{type_name}")]
    MissingEntityType {
        schema_name: String,
        type_name: String,
    },
    #[error("policy evaluation failed for {policy_key}: {message}")]
    PolicyEvaluation { policy_key: String, message: String },
    #[error("invalid policy result for {policy_key}: {message}")]
    InvalidPolicyResult { policy_key: String, message: String },
}

#[derive(Error, Debug)]
pub enum DataStoreError {
    #[error("duplicate key: record already exists")]
    DuplicateKey,
    #[error("foreign key: record references a missing related record")]
    ForeignKeyViolation,
    #[error("required field: {field}")]
    MissingRequiredValue { field: String },
    #[error("data store operation failed")]
    OperationFailed,
}

#[derive(Error, Debug)]
pub enum MetadataError {
    #[error("entity type not found: {schema_name}.{type_name}")]
    MissingEntityType {
        schema_name: String,
        type_name: String,
    },
    #[error("property not found: {entity_type}.{property_name}")]
    MissingProperty {
        entity_type: String,
        property_name: String,
    },
    #[error("primary key property not found for entity type: {entity_type}")]
    MissingPrimaryKey { entity_type: String },
    #[error("navigation metadata missing for property: {entity_type}.{property_name}")]
    MissingNavigation {
        entity_type: String,
        property_name: String,
    },
    #[error("many-to-many metadata missing for property: {entity_type}.{property_name}")]
    MissingManyToMany {
        entity_type: String,
        property_name: String,
    },
    #[error("invalid selection shape: {0}")]
    InvalidSelection(String),
    #[error("invalid computed metadata for property {property_name}: {message}")]
    InvalidComputedMetadata {
        property_name: String,
        message: String,
    },
}

#[derive(Error, Debug)]
pub enum QueryBuildError {
    #[error("invalid time period: {0}")]
    InvalidTimePeriod(String),
    #[error("time period '{period}' is unsupported for {data_type}")]
    UnsupportedTimePeriod { period: String, data_type: String },
    #[error("invalid date bound: {0}")]
    InvalidDateBound(String),
    #[error("failed to serialize query value: {0}")]
    SerializeValue(String),
}

#[derive(Error, Debug)]
pub enum RuntimeError {
    #[error("not authorized")]
    NotAuthorized,
    #[error("validation error: {0}")]
    Validation(String),
    #[error("access denied")]
    AccessDenied,
    #[error("invalid key or version")]
    InvalidKeyOrVersion,
    #[error(transparent)]
    Config(#[from] ConfigError),
    #[error(transparent)]
    Metadata(#[from] MetadataError),
    #[error(transparent)]
    QueryBuild(#[from] QueryBuildError),
    #[error(transparent)]
    DataStore(#[from] DataStoreError),
    #[error("data access error: {0}")]
    DataAccess(String),
    #[error("internal server error")]
    Internal(String),
}

#[derive(Error, Debug)]
pub enum RuntimeAppError {
    #[error("not authorized")]
    NotAuthorized,
    #[error("validation error: {0}")]
    Validation(String),
    #[error("access denied")]
    AccessDenied,
    #[error("invalid key or version")]
    InvalidKeyOrVersion,
    #[error(transparent)]
    Config(#[from] ConfigError),
    #[error(transparent)]
    Metadata(#[from] MetadataError),
    #[error(transparent)]
    QueryBuild(#[from] QueryBuildError),
    #[error(transparent)]
    DataStore(#[from] DataStoreError),
    #[error("data access error: {0}")]
    DataAccess(String),
    #[error("internal server error")]
    InternalServerError(#[from] anyhow::Error),
}

impl RuntimeError {
    #[allow(dead_code)] // tested below; GraphQL error categorization currently derives its own labels
    pub fn category(&self) -> &'static str {
        match self {
            RuntimeError::NotAuthorized => "not_authorized",
            RuntimeError::Validation(_) => "validation",
            RuntimeError::AccessDenied => "access_denied",
            RuntimeError::InvalidKeyOrVersion => "invalid_key_or_version",
            RuntimeError::Config(_) => "config",
            RuntimeError::Metadata(_) => "metadata",
            RuntimeError::QueryBuild(_) => "query_build",
            RuntimeError::DataStore(_) => "data_store",
            RuntimeError::DataAccess(_) => "data_access",
            RuntimeError::Internal(_) => "internal",
        }
    }
}

impl From<RuntimeError> for RuntimeAppError {
    fn from(error: RuntimeError) -> Self {
        match error {
            RuntimeError::NotAuthorized => RuntimeAppError::NotAuthorized,
            RuntimeError::Validation(message) => RuntimeAppError::Validation(message),
            RuntimeError::AccessDenied => RuntimeAppError::AccessDenied,
            RuntimeError::InvalidKeyOrVersion => RuntimeAppError::InvalidKeyOrVersion,
            RuntimeError::Config(error) => RuntimeAppError::Config(error),
            RuntimeError::Metadata(error) => RuntimeAppError::Metadata(error),
            RuntimeError::QueryBuild(error) => RuntimeAppError::QueryBuild(error),
            RuntimeError::DataStore(error) => RuntimeAppError::DataStore(error),
            RuntimeError::DataAccess(message) => RuntimeAppError::DataAccess(message),
            RuntimeError::Internal(message) => {
                RuntimeAppError::InternalServerError(anyhow::anyhow!(message))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runtime_error_categories_are_stable() {
        assert_eq!(RuntimeError::AccessDenied.category(), "access_denied");
        assert_eq!(
            RuntimeError::Validation("bad input".to_string()).category(),
            "validation"
        );
        assert_eq!(
            RuntimeError::DataStore(DataStoreError::DuplicateKey).category(),
            "data_store"
        );
    }

    #[test]
    fn runtime_app_error_maps_runtime_errors() {
        let error = RuntimeAppError::from(RuntimeError::AccessDenied);
        assert!(matches!(error, RuntimeAppError::AccessDenied));

        let error = RuntimeAppError::from(RuntimeError::DataAccess("provider failed".to_string()));
        assert!(
            matches!(error, RuntimeAppError::DataAccess(message) if message == "provider failed")
        );
    }
}
