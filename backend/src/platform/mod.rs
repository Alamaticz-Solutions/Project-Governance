//! Product-owned cross-cutting infrastructure: identifier casing, record
//! locators, secret loading, CORS, observability, router assembly, rate
//! limiting, JWT authentication, the GraphQL gateway. Ported off
//! `appfw_runtime` piece by piece (backend framework replacement phase 4 --
//! docs/architecture/self-owned-backend-plan.md). Not a generator output --
//! hand-written support code, same as `data/clients/postgres`.

#[cfg(feature = "http")]
pub(crate) mod auth;

#[cfg(feature = "http")]
pub(crate) mod cors;

#[cfg(feature = "http")]
pub(crate) mod graphql_gateway;

pub(crate) mod identifier;

pub(crate) mod observability;

pub(crate) mod record_locator;

#[cfg(feature = "http")]
pub(crate) mod routing;

pub(crate) mod secrets;

#[cfg(feature = "http")]
pub(crate) mod security;
