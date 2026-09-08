//! Product-owned cross-cutting infrastructure: identifier casing, secret loading,
//! CORS, observability, server bootstrap, router assembly, rate limiting,
//! JWT authentication, the GraphQL gateway, and tenant scoping.

#[cfg(feature = "http")]
pub(crate) mod admin_runtime;

#[cfg(feature = "http")]
pub(crate) mod auth;

pub(crate) mod connection_security;

#[cfg(feature = "http")]
pub(crate) mod cors;

#[cfg(feature = "http")]
pub(crate) mod graphql_gateway;

pub(crate) mod host;

pub(crate) mod identifier;

pub(crate) mod json_utils;

pub(crate) mod metrics;

pub(crate) mod observability;

pub(crate) mod policy {
    pub use appfw_runtime::{AccessAction, PolicyAccess};
}

#[cfg(feature = "http")]
pub(crate) mod product_ui;

#[cfg(feature = "http")]
pub(crate) mod readiness;

pub(crate) mod record_locator {
    pub use appfw_runtime::record_locator::*;
}

pub(crate) mod request_context;

#[cfg(feature = "http")]
pub(crate) mod routing;

pub(crate) mod runtime;

pub(crate) mod secrets;

#[cfg(feature = "http")]
pub(crate) mod security;

pub(crate) mod tenant_isolation;

pub(crate) mod user_auth {
    pub use appfw_runtime::extension::{RuntimePrincipalType, UserAuth};
}
