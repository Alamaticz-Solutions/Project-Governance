//! Keeps the tenant-wide transcript change-notification subscription
//! (`communications/onlineMeetings/getAllTranscripts`) alive.
//!
//! Constraints that shape this module (from the Graph change-notification docs):
//! - Application permission `OnlineMeetingTranscript.Read.All` only.
//! - `lifecycleNotificationUrl` is **mandatory** for any expiry > 1 hour.
//! - A notification fires only if the subscription exists **before**
//!   transcription starts ⇒ the subscription must be continuously alive, so it
//!   is created once (tenant-wide) and renewed, never created per meeting.
//! - Max expiry for this resource ≈ 4230 minutes (~3 days).

use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, FixedOffset, Utc};
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::{
    config::AppConfig,
    entities::graph_subscriptions,
    error::{AppError, AppResult},
    services::graph_client::{graph_error, GraphClient},
};

const TRANSCRIPT_RESOURCE: &str = "communications/onlineMeetings/getAllTranscripts";
const RENEW_EVERY: Duration = Duration::from_secs(6 * 3600);

fn now() -> DateTime<FixedOffset> {
    Utc::now().into()
}

fn notification_url(cfg: &AppConfig) -> String {
    format!(
        "{}/api/v1/teams-poc/graph-notifications",
        cfg.graph_notification_base_url
    )
}
fn lifecycle_url(cfg: &AppConfig) -> String {
    format!(
        "{}/api/v1/teams-poc/graph-lifecycle",
        cfg.graph_notification_base_url
    )
}

#[derive(Deserialize)]
struct SubResp {
    id: String,
    #[serde(rename = "expirationDateTime")]
    expiration_date_time: DateTime<FixedOffset>,
}

/// On boot: make sure a live transcript subscription exists that points at
/// *this* deployment's notification URL. Recreates it if missing, expiring
/// soon, or aimed at a stale URL (e.g. after an ngrok restart).
pub async fn ensure_subscription(
    graph: &GraphClient,
    cfg: &AppConfig,
    db: &DatabaseConnection,
) -> AppResult<()> {
    let want_url = notification_url(cfg);

    if let Some(row) = find_row(db).await? {
        let fresh = row.expiration_date_time > now() + chrono::Duration::hours(6);
        if row.notification_url == want_url && fresh {
            tracing::info!(sub = %row.subscription_id, "Graph transcript subscription is current");
            return Ok(());
        }
        let _ = graph
            .delete(&format!("/subscriptions/{}", row.subscription_id))
            .await;
        let _ = graph_subscriptions::Entity::delete_by_id(row.id)
            .exec(db)
            .await;
    }

    let created = create_subscription(graph, cfg).await?;
    graph_subscriptions::ActiveModel {
        id: Set(Uuid::new_v4()),
        subscription_id: Set(created.id.clone()),
        resource: Set(TRANSCRIPT_RESOURCE.to_string()),
        notification_url: Set(want_url),
        client_state: Set(cfg.graph_notification_client_state.clone()),
        expiration_date_time: Set(created.expiration_date_time),
        created_at: Set(now()),
        updated_at: Set(None),
    }
    .insert(db)
    .await?;
    tracing::info!(sub = %created.id, "created Graph transcript subscription");
    Ok(())
}

async fn find_row(db: &DatabaseConnection) -> AppResult<Option<graph_subscriptions::Model>> {
    Ok(graph_subscriptions::Entity::find()
        .filter(graph_subscriptions::Column::Resource.eq(TRANSCRIPT_RESOURCE))
        .one(db)
        .await?)
}

async fn create_subscription(graph: &GraphClient, cfg: &AppConfig) -> AppResult<SubResp> {
    let expiry = now() + chrono::Duration::minutes(cfg.graph_subscription_minutes);
    let body = json!({
        "changeType": "created",
        "notificationUrl": notification_url(cfg),
        "lifecycleNotificationUrl": lifecycle_url(cfg),
        "resource": TRANSCRIPT_RESOURCE,
        "includeResourceData": false,
        "expirationDateTime": expiry.to_rfc3339(),
        "clientState": cfg.graph_notification_client_state,
    });
    let resp = graph.post_json("/subscriptions", &body).await?;
    if !resp.status().is_success() {
        return Err(graph_error(resp).await);
    }
    resp.json().await.map_err(|e| AppError::Upstream {
        code: None,
        message: format!("subscription create response parse failed: {e}"),
        retryable: false,
    })
}

/// Background task: every 6h, renew the subscription if it is within 12h of
/// expiry; recreate it on a 404.
pub fn spawn_subscription_renewer(
    graph: Arc<GraphClient>,
    cfg: AppConfig,
    db: DatabaseConnection,
) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(RENEW_EVERY);
        loop {
            tick.tick().await;
            if let Err(e) = renew_once(&graph, &cfg, &db).await {
                tracing::error!(error = %e, "Graph subscription renewal failed");
            }
        }
    });
}

async fn renew_once(
    graph: &GraphClient,
    cfg: &AppConfig,
    db: &DatabaseConnection,
) -> AppResult<()> {
    let Some(row) = find_row(db).await? else {
        return ensure_subscription(graph, cfg, db).await;
    };
    if row.expiration_date_time > now() + chrono::Duration::hours(12) {
        return Ok(());
    }

    let expiry = now() + chrono::Duration::minutes(cfg.graph_subscription_minutes);
    let resp = graph
        .patch_json(
            &format!("/subscriptions/{}", row.subscription_id),
            &json!({ "expirationDateTime": expiry.to_rfc3339() }),
        )
        .await?;

    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        let _ = graph_subscriptions::Entity::delete_by_id(row.id)
            .exec(db)
            .await;
        return ensure_subscription(graph, cfg, db).await;
    }
    if !resp.status().is_success() {
        return Err(graph_error(resp).await);
    }

    let updated: SubResp = resp.json().await.map_err(|e| AppError::Upstream {
        code: None,
        message: format!("subscription renew response parse failed: {e}"),
        retryable: false,
    })?;
    let mut am: graph_subscriptions::ActiveModel = row.into();
    am.expiration_date_time = Set(updated.expiration_date_time);
    am.updated_at = Set(Some(now()));
    am.update(db).await?;
    tracing::info!("renewed Graph transcript subscription");
    Ok(())
}
