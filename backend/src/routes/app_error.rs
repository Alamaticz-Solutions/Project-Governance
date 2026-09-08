//! Crate-wide error alias: `AppError` is the framework's `RuntimeAppError`,
//! re-exported here (with its component error types) so handlers and services
//! name it through `crate::routes::app_error`.

#[allow(unused_imports)]
pub use crate::platform::runtime::{
    ConfigError, DataStoreError, MetadataError, QueryBuildError, RuntimeError,
};
pub type AppError = crate::platform::runtime::RuntimeAppError;
