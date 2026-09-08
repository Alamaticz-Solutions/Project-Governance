//! Provider identity for the Microsoft Graph client: `client.rs` and
//! `writes.rs` build every request URL from `GRAPH_BASE`. There is
//! deliberately no descriptor struct bundling a key/display name/API version
//! here -- nothing consumes provider identity as a value today; add one only
//! when a caller actually needs it (e.g. a multi-provider admin listing).

pub const GRAPH_BASE: &str = "https://graph.microsoft.com/v1.0";
