//! Core runtime error types, ported near-verbatim off `appfw_runtime`
//! (backend framework replacement phase 7, slice 2 --
//! docs/architecture/self-owned-backend-plan.md). Each of these six enums
//! is a plain `thiserror` data type -- variant names, fields, and `#[error]`
//! message strings are load-bearing (they're the exact text GraphQL clients
//! see via `async-graphql`'s blanket `From<E: std::error::Error> for Error`,
//! and `AppError::category()`/variant matches drive branching elsewhere in
//! this crate), so this is a byte-for-byte oracle port, not a redesign.

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

// --- bridges from the still-framework-owned producers of these errors -----
//
// `RuntimeEntityMetadata`/`RuntimePropertyMetadata`/`RuntimeFilterOp` (not
// yet ported -- slices 4/5) still return `appfw_runtime`'s own
// `MetadataError`/`RuntimeError` from their methods. `?` only performs one
// `From` hop, so a call site returning `Result<_, RuntimeAppError>` needs a
// direct conversion from the framework's type, not just from this module's
// same-named one. Each bridge maps every variant exactly (same category,
// same message shape) rather than collapsing into a generic error, so
// nothing observable (HTTP/GraphQL error text, `category()`) changes
// depending on which side of the port produced the error.

impl From<appfw_runtime::ConfigError> for ConfigError {
    fn from(error: appfw_runtime::ConfigError) -> Self {
        match error {
            appfw_runtime::ConfigError::Load(message) => ConfigError::Load(message),
            appfw_runtime::ConfigError::Io { path, message } => ConfigError::Io { path, message },
            appfw_runtime::ConfigError::Parse { path, message } => {
                ConfigError::Parse { path, message }
            }
            appfw_runtime::ConfigError::MissingEnvVar { name } => {
                ConfigError::MissingEnvVar { name }
            }
            appfw_runtime::ConfigError::MissingConfiguredEnvironment {
                data_source_name,
                environment_name,
            } => ConfigError::MissingConfiguredEnvironment {
                data_source_name,
                environment_name,
            },
            appfw_runtime::ConfigError::InvalidPath { path, message } => {
                ConfigError::InvalidPath { path, message }
            }
            appfw_runtime::ConfigError::PolicyLoad { path, message } => {
                ConfigError::PolicyLoad { path, message }
            }
            appfw_runtime::ConfigError::MissingDataSource(name) => {
                ConfigError::MissingDataSource(name)
            }
            appfw_runtime::ConfigError::MissingDataSourceEnvironment(name) => {
                ConfigError::MissingDataSourceEnvironment(name)
            }
            appfw_runtime::ConfigError::MissingEntityType {
                schema_name,
                type_name,
            } => ConfigError::MissingEntityType {
                schema_name,
                type_name,
            },
            appfw_runtime::ConfigError::PolicyEvaluation {
                policy_key,
                message,
            } => ConfigError::PolicyEvaluation {
                policy_key,
                message,
            },
            appfw_runtime::ConfigError::InvalidPolicyResult {
                policy_key,
                message,
            } => ConfigError::InvalidPolicyResult {
                policy_key,
                message,
            },
        }
    }
}

impl From<appfw_runtime::DataStoreError> for DataStoreError {
    fn from(error: appfw_runtime::DataStoreError) -> Self {
        match error {
            appfw_runtime::DataStoreError::DuplicateKey => DataStoreError::DuplicateKey,
            appfw_runtime::DataStoreError::ForeignKeyViolation => {
                DataStoreError::ForeignKeyViolation
            }
            appfw_runtime::DataStoreError::MissingRequiredValue { field } => {
                DataStoreError::MissingRequiredValue { field }
            }
            appfw_runtime::DataStoreError::OperationFailed => DataStoreError::OperationFailed,
        }
    }
}

impl From<appfw_runtime::MetadataError> for MetadataError {
    fn from(error: appfw_runtime::MetadataError) -> Self {
        match error {
            appfw_runtime::MetadataError::MissingEntityType {
                schema_name,
                type_name,
            } => MetadataError::MissingEntityType {
                schema_name,
                type_name,
            },
            appfw_runtime::MetadataError::MissingProperty {
                entity_type,
                property_name,
            } => MetadataError::MissingProperty {
                entity_type,
                property_name,
            },
            appfw_runtime::MetadataError::MissingPrimaryKey { entity_type } => {
                MetadataError::MissingPrimaryKey { entity_type }
            }
            appfw_runtime::MetadataError::MissingNavigation {
                entity_type,
                property_name,
            } => MetadataError::MissingNavigation {
                entity_type,
                property_name,
            },
            appfw_runtime::MetadataError::MissingManyToMany {
                entity_type,
                property_name,
            } => MetadataError::MissingManyToMany {
                entity_type,
                property_name,
            },
            appfw_runtime::MetadataError::InvalidSelection(message) => {
                MetadataError::InvalidSelection(message)
            }
            appfw_runtime::MetadataError::InvalidComputedMetadata {
                property_name,
                message,
            } => MetadataError::InvalidComputedMetadata {
                property_name,
                message,
            },
        }
    }
}

impl From<appfw_runtime::QueryBuildError> for QueryBuildError {
    fn from(error: appfw_runtime::QueryBuildError) -> Self {
        match error {
            appfw_runtime::QueryBuildError::InvalidTimePeriod(message) => {
                QueryBuildError::InvalidTimePeriod(message)
            }
            appfw_runtime::QueryBuildError::UnsupportedTimePeriod { period, data_type } => {
                QueryBuildError::UnsupportedTimePeriod { period, data_type }
            }
            appfw_runtime::QueryBuildError::InvalidDateBound(message) => {
                QueryBuildError::InvalidDateBound(message)
            }
            appfw_runtime::QueryBuildError::SerializeValue(message) => {
                QueryBuildError::SerializeValue(message)
            }
        }
    }
}

impl From<appfw_runtime::RuntimeError> for RuntimeError {
    fn from(error: appfw_runtime::RuntimeError) -> Self {
        match error {
            appfw_runtime::RuntimeError::NotAuthorized => RuntimeError::NotAuthorized,
            appfw_runtime::RuntimeError::Validation(message) => RuntimeError::Validation(message),
            appfw_runtime::RuntimeError::AccessDenied => RuntimeError::AccessDenied,
            appfw_runtime::RuntimeError::InvalidKeyOrVersion => RuntimeError::InvalidKeyOrVersion,
            appfw_runtime::RuntimeError::Config(error) => RuntimeError::Config(error.into()),
            appfw_runtime::RuntimeError::Metadata(error) => RuntimeError::Metadata(error.into()),
            appfw_runtime::RuntimeError::QueryBuild(error) => {
                RuntimeError::QueryBuild(error.into())
            }
            appfw_runtime::RuntimeError::DataStore(error) => {
                RuntimeError::DataStore(error.into())
            }
            appfw_runtime::RuntimeError::DataAccess(message) => {
                RuntimeError::DataAccess(message)
            }
            appfw_runtime::RuntimeError::Internal(message) => RuntimeError::Internal(message),
        }
    }
}

// Direct (single-hop) bridges into `RuntimeAppError` for `?` at call sites
// whose function signature names `AppError`/`RuntimeAppError` directly.
impl From<appfw_runtime::RuntimeError> for RuntimeAppError {
    fn from(error: appfw_runtime::RuntimeError) -> Self {
        RuntimeError::from(error).into()
    }
}

impl From<appfw_runtime::MetadataError> for RuntimeAppError {
    fn from(error: appfw_runtime::MetadataError) -> Self {
        RuntimeAppError::Metadata(error.into())
    }
}

impl From<appfw_runtime::ConfigError> for RuntimeAppError {
    fn from(error: appfw_runtime::ConfigError) -> Self {
        RuntimeAppError::Config(error.into())
    }
}

impl From<appfw_runtime::DataStoreError> for RuntimeAppError {
    fn from(error: appfw_runtime::DataStoreError) -> Self {
        RuntimeAppError::DataStore(error.into())
    }
}

impl From<appfw_runtime::QueryBuildError> for RuntimeAppError {
    fn from(error: appfw_runtime::QueryBuildError) -> Self {
        RuntimeAppError::QueryBuild(error.into())
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
