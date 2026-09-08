//! Product-owned cross-cutting infrastructure: secret loading, CORS,
//! observability, server bootstrap, router assembly, rate limiting,
//! JWT authentication, the GraphQL gateway, and tenant scoping.

#[cfg(feature = "http")]
pub(crate) mod auth;

#[cfg(feature = "http")]
pub(crate) mod cors;

#[cfg(feature = "http")]
pub(crate) mod graphql_gateway;

pub(crate) mod host;

pub(crate) mod identifier {
    pub use appfw_runtime::identifier::*;
}

pub(crate) mod observability;

pub(crate) mod policy {
    pub use appfw_runtime::{AccessAction, PolicyAccess};
}

pub(crate) mod record_locator {
    pub use appfw_runtime::record_locator::*;
}

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
