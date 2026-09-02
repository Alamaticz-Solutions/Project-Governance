use std::sync::Arc;

use sea_orm::DatabaseConnection;

use crate::config::AppConfig;
use crate::graphql::AppSchema;
use crate::services::graph_client::GraphClient;
use crate::services::s3_service::S3Service;

/// Shared application state, constructed once at boot and cloned (cheap `Arc`
/// clone) into every Axum handler via `State<AppState>`.
#[derive(Clone)]
pub struct AppState {
    pub db: DatabaseConnection,
    pub config: Arc<AppConfig>,
    pub http: reqwest::Client,
    pub schema: AppSchema,
    pub s3: Arc<S3Service>,
    /// `Some` when Microsoft Graph is configured (`AppConfig::graph_enabled`);
    /// `None` falls back to local-stub meeting links.
    pub graph: Option<Arc<GraphClient>>,
}
