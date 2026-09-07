//! Provider identity for the Graph client (`client.rs`/`writes.rs` build every
//! request URL from `GRAPH_BASE`). A `GraphProviderDescriptor` bundling this
//! with a key/display name/API version (mirroring
//! `SalesforceProviderDescriptor`) was trimmed 2026-09-08: nothing ever
//! constructed it, in product code or tests -- re-add only once something
//! actually consumes provider identity as a value (e.g. a multi-provider
//! admin listing), not speculatively.

pub const GRAPH_BASE: &str = "https://graph.microsoft.com/v1.0";
