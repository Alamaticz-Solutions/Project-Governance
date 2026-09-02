mod auth;
mod config;
pub mod domain;
mod dto;
mod entities;
mod error;
mod handlers;
mod middleware;
mod routes;
mod seed;
mod services;
mod state;
mod graphql;

use std::sync::Arc;
use std::time::Duration;

use config::AppConfig;
use migration::MigratorTrait;
use sea_orm::Database;
use state::AppState;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    let config = AppConfig::from_env();
    tracing::info!(app = %config.app_name, env = %config.environment, "starting governance backend");

    let db = Database::connect(&config.database_url).await?;
    migration::Migrator::up(&db, None).await?;
    tracing::info!("migrations applied");

    seed::seed_demo_users(&db).await?;
    seed::seed_workflow_definitions(&db).await?;

    // Recover POC meetings left stuck in `processing` by a prior crash/restart.
    crate::services::poc_meeting_service::spawn_stuck_meeting_reaper(db.clone());

    let schema = graphql::build_schema();
    let s3 = crate::services::s3_service::S3Service::new(&config).await;

    // Shared outbound HTTP client. Bounded so a hung upstream (OpenAI, the
    // Power Automate flow) can never pin a request forever; individual call
    // sites tighten this further where a shorter bound is appropriate.
    let http = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(300))
        .build()
        .expect("failed to build HTTP client");

    let state = AppState {
        db,
        config: Arc::new(config.clone()),
        http,
        schema,
        s3: Arc::new(s3),
    };

    let app = routes::build_router(state);

    let listener = tokio::net::TcpListener::bind((config.server_host.as_str(), config.server_port)).await?;
    tracing::info!(addr = %listener.local_addr()?, "listening");
    axum::serve(listener, app).await?;

    Ok(())
}
