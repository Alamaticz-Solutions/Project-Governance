//! Product-owned cross-cutting infrastructure: identifier casing, record
//! locators, secret loading, CORS, observability, server bootstrap, router
//! assembly, rate limiting, JWT authentication, the GraphQL gateway, RBAC
//! policy decision types and tenant scoping. Ported off `appfw_runtime`
//! piece by piece (backend framework replacement phases 4-5 --
//! docs/architecture/self-owned-backend-plan.md). Not a generator output
//! -- hand-written support code, same as `data/clients/postgres`.

// Named `admin_runtime`, not `admin`: the crate root already has a binary-side
// `mod admin_ui;` (see `backend/src/main.rs`) that consumes this module, and
// a same-named `platform::admin` would be confusing next to it even though
// Rust itself would not collide on the two paths.
#[cfg(feature = "http")]
pub(crate) mod admin_runtime;

#[cfg(feature = "http")]
pub(crate) mod auth;

pub(crate) mod connection_security;

// `cors.rs` uses `axum`/`tower_http` unconditionally, both optional
// dependencies pulled in only by the `http` feature -- must be gated the
// same way as its sibling axum-dependent modules (`auth`, `graphql_gateway`,
// `routing`, `security`, `admin_runtime`, `product_ui`, `readiness`).
// Confirmed missing (`cargo check -p backend --no-default-features
// --features provider-postgres` failed with E0433 on both `axum` and
// `tower_http` before this fix) -- a real, pre-existing gap, not something
// backend framework replacement phase 7 introduced.
#[cfg(feature = "http")]
pub(crate) mod cors;

pub(crate) mod errors;

// Not `http`-gated: `product_api::HandlerContext` (a `RuntimeHandlerContext`
// alias) is used by generated handler code unconditionally, same reasoning
// as `host`/`security_config` below.
pub(crate) mod graphql_context;

#[cfg(feature = "http")]
pub(crate) mod graphql_gateway;

#[cfg(feature = "http")]
pub(crate) mod graphiql;

// Not `http`-gated: `main.rs` consults the transport-selection types before it
// knows whether it will serve HTTP. The `axum`-dependent pieces inside are
// gated instead.
pub(crate) mod host;

pub(crate) mod identifier;

pub(crate) mod json_utils;

pub(crate) mod metrics;

pub(crate) mod model_metadata;

pub(crate) mod observability;

pub(crate) mod policy;

pub(crate) mod provider_error;

pub(crate) mod provider_keys;

pub(crate) mod provider_operation;

pub(crate) mod provider_pool_stats;

#[cfg(feature = "http")]
pub(crate) mod provider_registry;

pub(crate) mod provider_request;

pub(crate) mod provider_result;

pub(crate) mod provider_time_period;

#[cfg(feature = "http")]
pub(crate) mod product_ui;

pub(crate) mod query_cost;

pub(crate) mod query_filter;

pub(crate) mod query_pagination;

#[cfg(feature = "http")]
pub(crate) mod readiness;

pub(crate) mod record_locator;

pub(crate) mod request_context;

#[cfg(feature = "http")]
pub(crate) mod routing;

pub(crate) mod runtime;

pub(crate) mod secrets;

#[cfg(feature = "http")]
pub(crate) mod security;

pub(crate) mod security_config;

pub(crate) mod tenant_isolation;

pub(crate) mod user_auth;
