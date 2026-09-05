//! Product-owned cross-cutting infrastructure: identifier casing, record
//! locators, secret loading, CORS, observability, server bootstrap, router
//! assembly, rate limiting, JWT authentication, the GraphQL gateway, RBAC
//! policy decision types and tenant scoping. Ported off `appfw_runtime`
//! piece by piece (backend framework replacement phases 4-5 --
//! docs/architecture/self-owned-backend-plan.md). Not a generator output
//! -- hand-written support code, same as `data/clients/postgres`.

#[cfg(feature = "http")]
pub(crate) mod auth;

#[cfg(feature = "http")]
pub(crate) mod cors;

#[cfg(feature = "http")]
pub(crate) mod graphql_gateway;

// Not `http`-gated: `main.rs` consults the transport-selection types before it
// knows whether it will serve HTTP. The `axum`-dependent pieces inside are
// gated instead.
pub(crate) mod host;

pub(crate) mod identifier;

pub(crate) mod observability;

pub(crate) mod policy;

pub(crate) mod record_locator;

#[cfg(feature = "http")]
pub(crate) mod routing;

pub(crate) mod secrets;

#[cfg(feature = "http")]
pub(crate) mod security;

pub(crate) mod tenant_isolation;

pub(crate) mod user_auth;
