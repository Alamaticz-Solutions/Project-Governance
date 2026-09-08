//! `User.search_directory` -- live Microsoft Graph org-directory search
//! (read registry, `ReadOperation::SearchDirectoryUsers`). That
//! operation was registered and live-verified by
//! `graph::client::live::token_acquisition_and_one_directory_read` since
//! spec 003, but no handler ever called it -- the Meeting Center attendee
//! picker fell back to listing this app's own seeded `User` rows instead of
//! the real org directory. This is that handler.

use std::{sync::Arc, time::Duration};

use serde_json::json;

use crate::{
    product_api::{DataAccess, HandlerResult, JsonValue, UserAuth},
    services::{
        graph::{GraphClient, ReadOperation},
        support::require_user,
    },
};

/// `User.searchDirectory(query)`. Graph's `$search` on `/users` needs a
/// property-scoped phrase (`displayName:x`), not a bare token -- a bare
/// token 400s with `Request_UnsupportedQuery` (see the live connection test
/// this mirrors). Fails open with an empty, honestly-labeled result when
/// Graph isn't configured, rather than an error -- an unconfigured
/// directory shouldn't block scheduling a meeting.
pub async fn search_directory(
    _data_access: &Arc<DataAccess>,
    user: &Option<UserAuth>,
    query: String,
) -> HandlerResult<JsonValue> {
    require_user(user)?;

    let term = query.trim();
    if term.len() < 2 {
        return Ok(json!({ "configured": true, "users": [] }));
    }

    let http = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|_| anyhow::anyhow!("failed to build http client"))?;
    let Some(client) = GraphClient::from_env(http) else {
        return Ok(json!({ "configured": false, "users": [] }));
    };

    let body = client
        .read(ReadOperation::SearchDirectoryUsers {
            term: format!("displayName:{term}"),
        })
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    let users: Vec<JsonValue> = body
        .get("value")
        .and_then(|v| v.as_array())
        .map(|rows| {
            rows.iter()
                .filter_map(|r| {
                    let email = r
                        .get("mail")
                        .and_then(|v| v.as_str())
                        .filter(|s| !s.is_empty())
                        .or_else(|| r.get("userPrincipalName").and_then(|v| v.as_str()))?;
                    let name = r
                        .get("displayName")
                        .and_then(|v| v.as_str())
                        .filter(|s| !s.is_empty())
                        .unwrap_or(email);
                    Some(json!({
                        "id": r.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                        "name": name,
                        "email": email,
                    }))
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(json!({ "configured": true, "users": users }))
}
