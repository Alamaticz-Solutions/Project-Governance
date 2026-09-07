//! Live-server GraphQL test harness. Independent reimplementation of
//! `appfw_test::harness` (backend framework replacement phase 7, slice 7 --
//! docs/architecture/self-owned-backend-plan.md): connects to an already
//! running backend over HTTP and asserts on its GraphQL responses. Not
//! part of the `backend` binary itself -- a separate integration-test CLI
//! crate, so this carries none of the production JWT/Okta verification
//! concerns slice 3's remainder does. `contracts` (the framework's schema/
//! type-contract test helpers) is not ported: confirmed unused by every
//! test file in this crate.

mod assertions;
mod auth;
mod config;
mod graphql_client;
mod result_store;
mod scenario;

pub use config::{provider_certification_enabled, should_run_provider_certification};
pub use scenario::TestContext;
