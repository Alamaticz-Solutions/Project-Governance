//! Microsoft Graph SaaS / external-API provider (spec 003 reads, spec 003
//! §Non-goal-1 writes).
//!
//! Replaces the legacy ungoverned `graph_client.rs` (generic `get(path)` /
//! `post_json(path)` against `graph.microsoft.com`). Structure mirrors
//! `appfw_provider_salesforce`'s module shape:
//!
//!   identity          the pinned Graph API base URL
//!   auth              env-var auth contract + redaction constants + token acquisition
//!   registry          the allow-listed named READ operations (no caller-chosen endpoints)
//!   request           safe request-plan builder — fixed path + field lists per operation
//!   response          rate-limit / error classification, redacted payloads, caps
//!   client            executor: named READ operation + bound params -> classified result
//!   writes            G1 governed-write stack: the only non-GET call site,
//!                     named mutations, idempotency ledger, policy gate, audit
//!   vendor_contract   honest per-operation status tiers (4-status vocab)
//!
//! Nothing here is `live_certified`. Reads execute; the tier records only that
//! no retained live contract run exists (spec 003 Open decision D5). Writes
//! (`schedule_teams_meeting`, `cancel_calendar_event`) execute behind the
//! full G1 stack but are likewise not `live_certified` until a
//! retained live write run has passed (see
//! spec 003 §7).

pub mod auth;
pub mod client;
pub mod identity;
pub mod registry;
pub mod request;
pub mod response;
pub mod vendor_contract;
pub mod writes;

pub use client::GraphClient;
pub use registry::ReadOperation;
pub use writes::{WriteContext, WriteOperation};
