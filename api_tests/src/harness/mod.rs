//! Live-server GraphQL test harness: connects to an already running backend
//! over HTTP and asserts on its GraphQL responses. A standalone integration-test
//! crate, separate from the `backend` binary.

mod assertions;
mod auth;
mod config;
mod graphql_client;
mod result_store;
mod scenario;

pub use config::{provider_certification_enabled, should_run_provider_certification};
pub use scenario::TestContext;
