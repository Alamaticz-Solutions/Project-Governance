//! Product-owned cross-cutting infrastructure: identifier casing, record
//! locators, secret loading, CORS. Ported off `appfw_runtime` piece by piece
//! (backend framework replacement phase 4 --
//! docs/architecture/self-owned-backend-plan.md). Not a generator output --
//! hand-written support code, same as `data/clients/postgres`.

#[cfg(feature = "http")]
pub(crate) mod cors;

pub(crate) mod identifier;

pub(crate) mod record_locator;

pub(crate) mod secrets;
