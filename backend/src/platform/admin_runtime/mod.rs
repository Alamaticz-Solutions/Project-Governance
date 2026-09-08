//! Admin diagnostics UI backend: API contracts, route registration, and
//! response shaping for `/admin`, `/admin/model`, and
//! `/admin/troubleshooting/*`. Ported off `appfw_runtime::admin` (backend
//! framework replacement phase 7, slice 6.3 --
//! docs/architecture/self-owned-backend-plan.md). Structurally a
//! near-verbatim port -- the framework module had no vendor-specific
//! machinery of its own beyond the two things adjusted below.
//!
//! Two real departures from the framework source, both required, not
//! stylistic:
//!
//! 1. `admin_user_from_headers`/`is_admin_user` (the auth gate for every
//!    admin route) used the framework's own `auth::RuntimeJwtExtractor`
//!    (real JWT verification via `RuntimeAuthState`). That extractor is a
//!    different type from this product's self-owned
//!    `platform::graphql_context::RuntimeJwtExtractor` (a bare data
//!    holder), so it could not simply be re-typed. This port instead calls
//!    this product's own `platform::auth::{resolve_user, JwtAuthConfig}`
//!    directly (already self-owned since phase 4b-4, the same call
//!    `platform::graphql_gateway` makes for the GraphQL ingress) -- one
//!    auth path for the whole backend instead of two.
//! 2. `AdminRuntimeState::auth_state` now returns `platform::auth::
//!    JwtAuthConfig` (this product's real JWT config: `issuer`, `audience`,
//!    `client_id`) instead of the framework's `RuntimeAuthState`
//!    (`jwt_issuer`, `jwt_audience`, `okta_client_id` -- the same three
//!    values under different field names). `RuntimeAuthState` was only ever
//!    needed to satisfy this trait's fixed return type while `admin` was
//!    framework-owned; now that this crate owns the trait, that constraint
//!    is gone and `RuntimeAuthState` is deleted outright (see
//!    `backend/src/main.rs`, `backend/src/routes/mod.rs`, and
//!    `backend/src/admin_ui.rs`, none of which construct it any more).
//!
//! Everything else -- every `Admin*` data struct, the four provider traits,
//! `admin_runtime_routes`/`admin_route_shell`'s real axum route
//! registration (including the `/admin/assets` `ServeDir` nesting),
//! the schema-summary/health helpers, and `AdminServiceError` -- is a
//! structural port with self-owned types substituted 1:1 for their
//! framework equivalents (`platform::policy::{AccessAction, PolicyAccess}`,
//! `platform::user_auth::UserAuth`, `platform::request_context::
//! RequestContext`, `platform::query_cost::{QueryCost, QueryCostBudget}`,
//! `platform::provider_keys::FrameworkProvider`).
//!
//! `RuntimeQueryPlanDiagnostic`/`RuntimePaginationDiagnostic` (previously
//! `appfw_runtime::data_access`, ~20 lines, plain serializable structs) are
//! ported here too, since `AdminQueryDiagnoseProvider::diagnose_query`'s
//! return type is the only thing that ever needed them.
//!
//! `provider_capabilities` (this module's sibling file) carries the
//! Postgres-only-scoped port of `appfw_runtime::provider_capabilities` +
//! `provider_contract_types` -- see that file's own doc comment. The
//! filter-*capabilities* reporting API (`RuntimeFilterCapabilities` and
//! friends) lives in `platform::query_filter` instead, alongside the filter
//! operator vocabulary it classifies -- see that module's doc comment for
//! the same Postgres-only scoping.

pub mod provider_capabilities;

use async_trait::async_trait;
use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::{get, post, MethodRouter},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    env,
    future::Future,
    path::{Path, PathBuf},
};
use tower_http::services::ServeDir;
use tracing::warn;

use crate::data::provider_plan::PaginationPolicy;
use crate::platform::auth::{resolve_user, JwtAuthConfig};
use crate::platform::policy::{AccessAction, PolicyAccess};
use crate::platform::runtime::provider_keys::FrameworkProvider;
use crate::platform::runtime::query_cost::{QueryCost, QueryCostBudget};
use crate::platform::runtime::query_filter::{
    runtime_filter_capabilities_for_provider, RuntimeFilterCapabilities,
    RuntimeFilterDataTypeCapability,
};
use crate::platform::request_context::{redact_diagnostic_text, redact_diagnostic_value, RequestContext};
use crate::platform::runtime::model_metadata::RuntimeDataType;
use crate::platform::user_auth::UserAuth;

pub const ADMIN_ROLE: &str = "admin";
pub const ADMIN_TROUBLESHOOTING_ENV_VAR: &str = "APP_ADMIN_TROUBLESHOOTING_ENABLED";
pub const ADMIN_UI_DIST_DIR_ENV_VAR: &str = "APP_ADMIN_UI_DIST_DIR";
pub const ADMIN_MIGRATIONS_DIR_ENV_VAR: &str = "APP_MIGRATIONS_DIR";
pub const ADMIN_INDEX_PATH: &str = "/admin";
pub const ADMIN_INDEX_SLASH_PATH: &str = "/admin/";
pub const ADMIN_MODEL_PATH: &str = "/admin/model";
pub const ADMIN_TROUBLESHOOTING_PATH: &str = "/admin/troubleshooting";
pub const ADMIN_POLICY_EXPLAIN_PATH: &str = "/admin/troubleshooting/policy/explain";
pub const ADMIN_AUDIT_TIMELINE_PATH: &str = "/admin/troubleshooting/audit";
pub const ADMIN_QUERY_DIAGNOSE_PATH: &str = "/admin/troubleshooting/query/diagnose";
pub const ADMIN_ASSETS_PATH: &str = "/admin/assets";
pub const ADMIN_TROUBLESHOOTING_DISABLED_MESSAGE: &str =
    "admin troubleshooting is disabled; set APP_ADMIN_TROUBLESHOOTING_ENABLED=true to enable it";

#[derive(Debug, Serialize)]
pub struct AdminError {
    pub error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_context: Option<RequestContext>,
}

impl AdminError {
    pub fn with_context(error: impl Into<String>, request_context: &RequestContext) -> Self {
        Self {
            error: redact_diagnostic_text(error.into()),
            request_context: Some(request_context.clone()),
        }
    }

    pub fn troubleshooting_disabled(request_context: &RequestContext) -> Self {
        Self::with_context(ADMIN_TROUBLESHOOTING_DISABLED_MESSAGE, request_context)
    }
}

#[derive(Debug, Deserialize)]
pub struct AdminPolicyExplainRequest {
    pub schema_name: String,
    pub type_name: String,
    pub action: String,
}

#[derive(Debug, Serialize)]
pub struct AdminPolicyExplainResponse {
    pub enabled: bool,
    pub request_context: RequestContext,
    pub policy_key: String,
    pub schema_name: String,
    pub type_name: String,
    pub action: String,
    pub user_name: String,
    pub roles: Vec<String>,
    pub decision: AdminPolicyDecision,
}

#[derive(Debug)]
pub struct AdminPolicyExplainSubject {
    pub policy_key: String,
    pub schema_name: String,
    pub type_name: String,
}

#[derive(Debug)]
pub struct AdminPolicyExplainResult {
    pub subject: AdminPolicyExplainSubject,
    pub decision: AdminPolicyDecision,
}

pub fn admin_policy_explain_result(
    policy_key: impl Into<String>,
    schema_name: impl Into<String>,
    type_name: impl Into<String>,
    decision: AdminPolicyDecision,
) -> AdminPolicyExplainResult {
    AdminPolicyExplainResult {
        subject: AdminPolicyExplainSubject {
            policy_key: policy_key.into(),
            schema_name: schema_name.into(),
            type_name: type_name.into(),
        },
        decision,
    }
}

#[derive(Debug, Deserialize)]
pub struct AdminAuditTimelineRequest {
    pub schema_name: String,
    pub type_name: String,
    pub record_id: String,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct AdminAuditTimelineResponse {
    pub enabled: bool,
    pub request_context: RequestContext,
    pub audited: bool,
    pub schema_name: String,
    pub type_name: String,
    pub record_id: String,
    pub events: Vec<Value>,
    pub current_policy: AdminPolicyDecision,
    pub message: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct AdminMigration {
    pub id: String,
    pub name: String,
    pub schema: Option<String>,
    pub data_source: String,
    pub dialect: String,
    pub phase: String,
    pub path: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AdminHealthItem {
    pub status: &'static str,
    pub label: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct AdminProviderCapability {
    pub area_key: &'static str,
    pub area_label: &'static str,
    pub status: &'static str,
    pub reason: Option<&'static str>,
    pub evidence: Vec<AdminCapabilityEvidence>,
}

#[derive(Debug, Serialize)]
pub struct AdminCapabilityEvidence {
    pub kind: &'static str,
    pub contract: &'static str,
}

#[derive(Debug, Serialize)]
pub struct AdminModel<TEntityType, TDataSourceType, TFilterCapabilities> {
    pub backend_version: String,
    pub troubleshooting_enabled: bool,
    pub schemas: Vec<AdminSchema<TDataSourceType, TFilterCapabilities>>,
    pub entity_types: Vec<TEntityType>,
}

#[derive(Debug, Serialize)]
pub struct AdminSchema<TDataSourceType, TFilterCapabilities> {
    pub id: String,
    pub name: String,
    pub description: String,
    pub data_source_name: String,
    pub data_source_type: Option<TDataSourceType>,
    pub filter_capabilities: Option<TFilterCapabilities>,
    pub latest_migration: Option<AdminMigration>,
    pub health: AdminSchemaHealth,
}

#[derive(Debug, Serialize)]
pub struct AdminSchemaHealth {
    pub migration_status: AdminHealthItem,
    pub pending_drift: AdminHealthItem,
    pub connectivity: AdminHealthItem,
    pub entity_count: usize,
    pub table_entity_count: usize,
    pub migration_count: usize,
    pub provider_capabilities: Vec<AdminProviderCapability>,
}

#[derive(Debug)]
pub struct AdminSchemaSummaryInput<'a, TDataSourceType, TFilterCapabilities> {
    pub id: String,
    pub name: String,
    pub description: String,
    pub data_source_name: String,
    pub data_source_type: Option<TDataSourceType>,
    pub filter_capabilities: Option<TFilterCapabilities>,
    pub migration_dialect: Option<&'a str>,
    pub data_access_configured: bool,
    pub entity_count: usize,
    pub table_entity_count: usize,
    pub provider_capabilities: Vec<AdminProviderCapability>,
}

#[derive(Debug, Deserialize)]
struct AdminMigrationManifest {
    migrations: Vec<AdminMigration>,
}

#[derive(Debug)]
pub struct AdminAuditTimelineSubject {
    pub schema_name: String,
    pub type_name: String,
}

#[derive(Debug)]
pub struct AdminAuditTimelineResult {
    pub subject: AdminAuditTimelineSubject,
    pub audited: bool,
    pub events: Vec<Value>,
    pub current_policy: AdminPolicyDecision,
    pub message: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AdminQueryDiagnoseRequest {
    pub schema_name: String,
    pub type_name: String,
    pub filter: Option<Value>,
    pub sort: Option<Value>,
    pub skip: Option<i32>,
    pub limit: Option<i32>,
    pub after: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AdminQueryDiagnoseResponse {
    pub enabled: bool,
    pub request_context: RequestContext,
    pub diagnostic: RuntimeQueryPlanDiagnostic,
}

/// A structured, redaction-safe diagnostic describing how a query would be
/// (or was) executed against a provider. Ported off
/// `appfw_runtime::data_access::RuntimeQueryPlanDiagnostic` -- the only
/// thing that ever needed this shape was `AdminQueryDiagnoseProvider`'s
/// return type, now self-owned. Built from the self-owned `QueryCost`/
/// `QueryCostBudget` (`platform::query_cost`), same as the framework's did.
#[derive(Clone, Debug, Serialize)]
pub struct RuntimeQueryPlanDiagnostic {
    pub schema_name: String,
    pub type_name: String,
    pub provider: String,
    pub data_source: String,
    pub pagination: RuntimePaginationDiagnostic,
    pub access_filter_applied: bool,
    pub cost: QueryCost,
    pub budget: QueryCostBudget,
    pub provider_diagnostic: Value,
}

#[derive(Clone, Debug, Serialize)]
pub struct RuntimePaginationDiagnostic {
    pub strategy: &'static str,
    pub skip: i32,
    pub limit: i32,
    pub after_present: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminServiceStatus {
    Unauthorized,
    BadRequest,
    Forbidden,
    InternalServerError,
}

#[derive(Debug)]
pub struct AdminServiceError {
    pub status: AdminServiceStatus,
    pub error: AdminError,
}

impl AdminServiceError {
    pub fn unauthorized(error: impl Into<String>, request_context: &RequestContext) -> Self {
        Self {
            status: AdminServiceStatus::Unauthorized,
            error: AdminError::with_context(error, request_context),
        }
    }

    pub fn bad_request(error: impl Into<String>, request_context: &RequestContext) -> Self {
        Self {
            status: AdminServiceStatus::BadRequest,
            error: AdminError::with_context(error, request_context),
        }
    }

    pub fn forbidden(error: impl Into<String>, request_context: &RequestContext) -> Self {
        Self {
            status: AdminServiceStatus::Forbidden,
            error: AdminError::with_context(error, request_context),
        }
    }

    pub fn internal(error: impl Into<String>, request_context: &RequestContext) -> Self {
        Self {
            status: AdminServiceStatus::InternalServerError,
            error: AdminError::with_context(error, request_context),
        }
    }

    pub fn troubleshooting_disabled(request_context: &RequestContext) -> Self {
        Self {
            status: AdminServiceStatus::Forbidden,
            error: AdminError::troubleshooting_disabled(request_context),
        }
    }
}

pub fn admin_dist_dir(product_manifest_dir: impl AsRef<Path>) -> PathBuf {
    env::var_os(ADMIN_UI_DIST_DIR_ENV_VAR)
        .map(PathBuf::from)
        .unwrap_or_else(|| product_manifest_dir.as_ref().join("admin_dist"))
}

pub fn admin_assets_dir(product_manifest_dir: impl AsRef<Path>) -> PathBuf {
    admin_dist_dir(product_manifest_dir).join("assets")
}

pub async fn admin_index_response(product_manifest_dir: impl AsRef<Path>) -> Response {
    let index_path = admin_dist_dir(product_manifest_dir).join("index.html");
    match tokio::fs::read_to_string(&index_path).await {
        Ok(html) => (
            [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
            Html(html),
        )
            .into_response(),
        Err(err) => (
            StatusCode::SERVICE_UNAVAILABLE,
            format!(
                "admin UI bundle not found at {} ({err}). Run `cd admin_ui && npm install && npm run build`.",
                index_path.display()
            ),
        )
            .into_response(),
    }
}

pub fn admin_route_shell<S>(
    product_manifest_dir: impl AsRef<Path>,
    index: MethodRouter<S>,
    index_slash: MethodRouter<S>,
    model: MethodRouter<S>,
    troubleshooting_status: MethodRouter<S>,
    policy_explain: MethodRouter<S>,
    audit_timeline: MethodRouter<S>,
    query_diagnose: MethodRouter<S>,
) -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    let assets_dir = admin_assets_dir(product_manifest_dir);

    Router::new()
        .route(ADMIN_INDEX_PATH, index)
        .route(ADMIN_INDEX_SLASH_PATH, index_slash)
        .route(ADMIN_MODEL_PATH, model)
        .route(ADMIN_TROUBLESHOOTING_PATH, troubleshooting_status)
        .route(ADMIN_POLICY_EXPLAIN_PATH, policy_explain)
        .route(ADMIN_AUDIT_TIMELINE_PATH, audit_timeline)
        .route(ADMIN_QUERY_DIAGNOSE_PATH, query_diagnose)
        .nest_service(ADMIN_ASSETS_PATH, ServeDir::new(assets_dir))
}

pub fn admin_migrations_manifest_path(product_manifest_dir: impl AsRef<Path>) -> PathBuf {
    env::var_os(ADMIN_MIGRATIONS_DIR_ENV_VAR)
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            product_manifest_dir
                .as_ref()
                .join("../database/_pkg/migrations")
        })
        .join("manifest.yaml")
}

pub async fn load_admin_migrations_manifest(
    product_manifest_dir: impl AsRef<Path>,
) -> Vec<AdminMigration> {
    let path = admin_migrations_manifest_path(product_manifest_dir);
    match tokio::fs::read_to_string(&path).await {
        Ok(contents) => match serde_yaml::from_str::<AdminMigrationManifest>(&contents) {
            Ok(manifest) => manifest.migrations,
            Err(err) => {
                warn!(
                    path = %path.display(),
                    error = %err,
                    "unable to parse admin UI migration manifest"
                );
                Vec::new()
            }
        },
        Err(_) => Vec::new(),
    }
}

pub fn admin_schema_migrations(
    schema_name: &str,
    data_source_name: &str,
    dialect: &str,
    migrations: &[AdminMigration],
) -> Vec<AdminMigration> {
    migrations
        .iter()
        .filter(|migration| {
            migration.data_source == data_source_name
                && migration.dialect == dialect
                && migration
                    .schema
                    .as_ref()
                    .is_none_or(|migration_schema| migration_schema == schema_name)
        })
        .cloned()
        .collect()
}

pub fn admin_migration_dialect(provider: FrameworkProvider) -> &'static str {
    match provider {
        FrameworkProvider::Postgres => "postgresql",
        FrameworkProvider::Mongo => "mongodb",
        FrameworkProvider::Mssql => "mssql",
        FrameworkProvider::FabricSqlAnalytics => "fabric_sql_analytics_readonly",
        FrameworkProvider::Snowflake => "snowflake",
        FrameworkProvider::Neo4j => "neo4j",
        FrameworkProvider::ServiceNow
        | FrameworkProvider::Workday
        | FrameworkProvider::Icims
        | FrameworkProvider::Salesforce
        | FrameworkProvider::Anaplan
        | FrameworkProvider::OracleFinancials => "external_api_readonly",
        FrameworkProvider::AiSearch => "ai_search_readonly",
    }
}

pub fn latest_admin_migration(migrations: &[AdminMigration]) -> Option<AdminMigration> {
    migrations
        .iter()
        .max_by(|left, right| left.id.cmp(&right.id).then(left.name.cmp(&right.name)))
        .cloned()
}

pub fn admin_migration_status(migrations: &[AdminMigration]) -> AdminHealthItem {
    match latest_admin_migration(migrations) {
        Some(migration) => AdminHealthItem {
            status: "ok",
            label: "Migration package available".to_string(),
            message: format!(
                "{} migration entr{} found. Latest: {} ({}, {}).",
                migrations.len(),
                if migrations.len() == 1 { "y" } else { "ies" },
                migration.name,
                migration.id,
                migration.phase,
            ),
        },
        None => AdminHealthItem {
            status: "warning",
            label: "No migration metadata".to_string(),
            message: "No migration entry was found for this schema and data source.".to_string(),
        },
    }
}

pub fn admin_generated_drift_status() -> AdminHealthItem {
    AdminHealthItem {
        status: "unknown",
        label: "Not evaluated by server".to_string(),
        message: "Run `scripts/appfw generate --check --json` to detect pending generated drift."
            .to_string(),
    }
}

pub fn admin_connectivity_status(data_access_configured: bool) -> AdminHealthItem {
    if data_access_configured {
        AdminHealthItem {
            status: "ok",
            label: "Ready".to_string(),
            message: "Data access initialized for this schema during route startup.".to_string(),
        }
    } else {
        AdminHealthItem {
            status: "error",
            label: "Not initialized".to_string(),
            message: "No data access client is registered for this schema.".to_string(),
        }
    }
}

pub fn admin_missing_data_access_error(
    schema_name: &str,
    request_context: &RequestContext,
) -> AdminServiceError {
    AdminServiceError::internal(
        format!("data access is not configured for schema '{schema_name}'"),
        request_context,
    )
}

pub fn admin_schema_health(
    migrations: &[AdminMigration],
    data_access_configured: bool,
    entity_count: usize,
    table_entity_count: usize,
    provider_capabilities: Vec<AdminProviderCapability>,
) -> AdminSchemaHealth {
    AdminSchemaHealth {
        migration_status: admin_migration_status(migrations),
        pending_drift: admin_generated_drift_status(),
        connectivity: admin_connectivity_status(data_access_configured),
        entity_count,
        table_entity_count,
        migration_count: migrations.len(),
        provider_capabilities,
    }
}

pub fn admin_schema_summary<TDataSourceType, TFilterCapabilities>(
    input: AdminSchemaSummaryInput<'_, TDataSourceType, TFilterCapabilities>,
    migrations: &[AdminMigration],
) -> AdminSchema<TDataSourceType, TFilterCapabilities> {
    let schema_migrations = input
        .migration_dialect
        .map(|dialect| {
            admin_schema_migrations(&input.name, &input.data_source_name, dialect, migrations)
        })
        .unwrap_or_default();
    let latest_migration = latest_admin_migration(&schema_migrations);
    let health = admin_schema_health(
        &schema_migrations,
        input.data_access_configured,
        input.entity_count,
        input.table_entity_count,
        input.provider_capabilities,
    );

    AdminSchema {
        id: input.id,
        name: input.name,
        description: input.description,
        data_source_name: input.data_source_name,
        data_source_type: input.data_source_type,
        filter_capabilities: input.filter_capabilities,
        latest_migration,
        health,
    }
}

/// Renders `admin_runtime::provider_capabilities::postgres_capabilities()`
/// into the admin JSON shape. `provider` is only ever
/// `Some(FrameworkProvider::Postgres)` in this product (see this module's
/// and `provider_capabilities`'s doc comments); every other variant reports
/// an empty capability list rather than fabricating the framework's
/// per-provider matrix data for a provider this product never configures.
pub fn admin_provider_capabilities_for_provider(
    provider: Option<FrameworkProvider>,
) -> Vec<AdminProviderCapability> {
    match provider {
        Some(FrameworkProvider::Postgres) => {
            admin_provider_capabilities(provider_capabilities::postgres_capabilities())
        }
        _ => Vec::new(),
    }
}

pub fn admin_provider_capabilities(
    capabilities: &[provider_capabilities::ProviderCapability],
) -> Vec<AdminProviderCapability> {
    capabilities.iter().map(admin_provider_capability).collect()
}

pub fn admin_provider_capability(
    capability: &provider_capabilities::ProviderCapability,
) -> AdminProviderCapability {
    AdminProviderCapability {
        area_key: capability.area.key(),
        area_label: capability.area.label(),
        status: capability.status.label(),
        reason: capability.status.reason(),
        evidence: capability
            .evidence
            .iter()
            .map(|evidence| AdminCapabilityEvidence {
                kind: evidence.label(),
                contract: evidence.contract(),
            })
            .collect(),
    }
}

pub fn admin_filter_capabilities_for_provider<TProvider, TDataType>(
    provider: TProvider,
    runtime_provider: FrameworkProvider,
    map_data_type: impl Fn(RuntimeDataType) -> TDataType,
) -> RuntimeFilterCapabilities<TProvider, TDataType> {
    let runtime_capabilities = runtime_filter_capabilities_for_provider(runtime_provider);

    RuntimeFilterCapabilities {
        provider,
        data_types: runtime_capabilities
            .data_types
            .into_iter()
            .map(|capability| RuntimeFilterDataTypeCapability {
                data_type: map_data_type(capability.data_type),
                operators: capability.operators,
            })
            .collect(),
    }
}

pub fn admin_service_status_code(status: AdminServiceStatus) -> StatusCode {
    match status {
        AdminServiceStatus::Unauthorized => StatusCode::UNAUTHORIZED,
        AdminServiceStatus::BadRequest => StatusCode::BAD_REQUEST,
        AdminServiceStatus::Forbidden => StatusCode::FORBIDDEN,
        AdminServiceStatus::InternalServerError => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

pub fn admin_service_error_response(err: AdminServiceError) -> Response {
    (admin_service_status_code(err.status), Json(err.error)).into_response()
}

/// The auth gate for every admin route: resolves the caller from the
/// request's bearer token via this product's own `platform::auth::
/// resolve_user` (already self-owned since phase 4b-4 -- the same path
/// `platform::graphql_gateway` uses for the GraphQL ingress), then requires
/// the `admin` role. Deliberately NOT a literal port of the framework's
/// `admin_user_from_headers` (which called the framework's own
/// `auth::RuntimeJwtExtractor` for real JWT verification) -- see this
/// module's doc comment.
pub async fn admin_user_from_headers(
    auth_config: &JwtAuthConfig,
    headers: HeaderMap,
    request_context: &RequestContext,
) -> Result<UserAuth, AdminServiceError> {
    let user = resolve_user(auth_config, &headers)
        .await
        .map_err(|err| AdminServiceError::unauthorized(err.to_string(), request_context))?;
    let Some(user) = user else {
        return Err(AdminServiceError::forbidden(
            "admin role required",
            request_context,
        ));
    };
    if is_admin_user(&user) {
        Ok((*user).clone())
    } else {
        Err(AdminServiceError::forbidden(
            "admin role required",
            request_context,
        ))
    }
}

#[async_trait]
pub trait AdminPolicyExplainProvider: Sync {
    async fn explain_policy_access(
        &self,
        schema_name: &str,
        type_name: &str,
        action: AccessAction,
        user: &UserAuth,
        request_context: &RequestContext,
    ) -> Result<AdminPolicyExplainResult, AdminServiceError>;
}

#[async_trait]
pub trait AdminAuditTimelineProvider: Sync {
    async fn load_audit_timeline(
        &self,
        schema_name: &str,
        type_name: &str,
        record_id: &str,
        limit: i64,
        user: &UserAuth,
        request_context: &RequestContext,
    ) -> Result<AdminAuditTimelineResult, AdminServiceError>;
}

#[async_trait]
pub trait AdminQueryDiagnoseProvider: Sync {
    async fn diagnose_query(
        &self,
        schema_name: &str,
        type_name: &str,
        filter: Option<Value>,
        sort: Option<Value>,
        skip: i32,
        limit: i32,
        after: Option<String>,
        user: UserAuth,
        request_context: &RequestContext,
    ) -> Result<RuntimeQueryPlanDiagnostic, AdminServiceError>;
}

pub trait AdminModelProvider {
    type EntityType;
    type DataSourceType;
    type FilterCapabilities;

    fn admin_schemas(
        &self,
        migrations: &[AdminMigration],
    ) -> Vec<AdminSchema<Self::DataSourceType, Self::FilterCapabilities>>;

    fn admin_entity_types(&self) -> Vec<Self::EntityType>;
}

pub trait AdminRuntimeState: Clone + Send + Sync + 'static {
    type ModelProvider<'a>: AdminModelProvider + Send + Sync + 'a
    where
        Self: 'a;
    type PolicyExplainProvider<'a>: AdminPolicyExplainProvider + Send + 'a
    where
        Self: 'a;
    type AuditTimelineProvider<'a>: AdminAuditTimelineProvider + Send + 'a
    where
        Self: 'a;
    type QueryDiagnoseProvider<'a>: AdminQueryDiagnoseProvider + Send + 'a
    where
        Self: 'a;

    fn product_manifest_dir() -> &'static str;
    fn backend_version() -> &'static str;
    fn auth_state(&self) -> JwtAuthConfig;
    fn troubleshooting_enabled(&self) -> bool;
    fn model_provider(&self) -> Self::ModelProvider<'_>;
    fn policy_explain_provider(&self) -> Self::PolicyExplainProvider<'_>;
    fn audit_timeline_provider(&self) -> Self::AuditTimelineProvider<'_>;
    fn query_diagnose_provider(&self) -> Self::QueryDiagnoseProvider<'_>;
}

pub fn admin_runtime_routes<S>() -> Router<S>
where
    S: AdminRuntimeState,
    for<'a> <S::ModelProvider<'a> as AdminModelProvider>::EntityType: Serialize,
    for<'a> <S::ModelProvider<'a> as AdminModelProvider>::DataSourceType: Serialize,
    for<'a> <S::ModelProvider<'a> as AdminModelProvider>::FilterCapabilities: Serialize,
{
    admin_route_shell(
        S::product_manifest_dir(),
        get(admin_index_endpoint::<S>),
        get(admin_index_endpoint::<S>),
        get(admin_model_endpoint::<S>),
        get(admin_troubleshooting_status_endpoint::<S>),
        post(admin_policy_explain_endpoint::<S>),
        post(admin_audit_timeline_endpoint::<S>),
        post(admin_query_diagnose_endpoint::<S>),
    )
}

async fn admin_index_endpoint<S>() -> Response
where
    S: AdminRuntimeState,
{
    admin_index_response(S::product_manifest_dir()).await
}

async fn admin_model_endpoint<S>(State(state): State<S>, headers: HeaderMap) -> Response
where
    S: AdminRuntimeState,
    for<'a> <S::ModelProvider<'a> as AdminModelProvider>::EntityType: Serialize,
    for<'a> <S::ModelProvider<'a> as AdminModelProvider>::DataSourceType: Serialize,
    for<'a> <S::ModelProvider<'a> as AdminModelProvider>::FilterCapabilities: Serialize,
{
    let auth_config = state.auth_state();
    let troubleshooting_enabled = state.troubleshooting_enabled();
    let provider = state.model_provider();
    admin_model_response(
        &auth_config,
        headers,
        &provider,
        S::product_manifest_dir(),
        S::backend_version(),
        troubleshooting_enabled,
    )
    .await
}

async fn admin_troubleshooting_status_endpoint<S>(
    State(state): State<S>,
    headers: HeaderMap,
) -> Response
where
    S: AdminRuntimeState,
{
    admin_troubleshooting_status_response(
        &state.auth_state(),
        headers,
        state.troubleshooting_enabled(),
    )
    .await
}

async fn admin_policy_explain_endpoint<S>(
    State(state): State<S>,
    headers: HeaderMap,
    Json(request): Json<AdminPolicyExplainRequest>,
) -> Response
where
    S: AdminRuntimeState,
{
    let auth_config = state.auth_state();
    let troubleshooting_enabled = state.troubleshooting_enabled();
    let provider = state.policy_explain_provider();
    admin_policy_explain_response(
        &provider,
        &auth_config,
        headers,
        troubleshooting_enabled,
        request,
    )
    .await
}

async fn admin_audit_timeline_endpoint<S>(
    State(state): State<S>,
    headers: HeaderMap,
    Json(request): Json<AdminAuditTimelineRequest>,
) -> Response
where
    S: AdminRuntimeState,
{
    let auth_config = state.auth_state();
    let troubleshooting_enabled = state.troubleshooting_enabled();
    let provider = state.audit_timeline_provider();
    admin_audit_timeline_response(
        &provider,
        &auth_config,
        headers,
        troubleshooting_enabled,
        request,
    )
    .await
}

async fn admin_query_diagnose_endpoint<S>(
    State(state): State<S>,
    headers: HeaderMap,
    Json(request): Json<AdminQueryDiagnoseRequest>,
) -> Response
where
    S: AdminRuntimeState,
{
    let auth_config = state.auth_state();
    let troubleshooting_enabled = state.troubleshooting_enabled();
    let provider = state.query_diagnose_provider();
    admin_query_diagnose_response(
        &provider,
        &auth_config,
        headers,
        troubleshooting_enabled,
        request,
    )
    .await
}

pub async fn admin_model<P>(
    provider: &P,
    product_manifest_dir: impl AsRef<Path>,
    backend_version: impl Into<String>,
    troubleshooting_enabled: bool,
) -> AdminModel<P::EntityType, P::DataSourceType, P::FilterCapabilities>
where
    P: AdminModelProvider + ?Sized,
{
    let migrations = load_admin_migrations_manifest(product_manifest_dir).await;

    AdminModel {
        backend_version: backend_version.into(),
        troubleshooting_enabled,
        schemas: provider.admin_schemas(&migrations),
        entity_types: provider.admin_entity_types(),
    }
}

pub async fn admin_model_response<P>(
    auth_config: &JwtAuthConfig,
    headers: HeaderMap,
    provider: &P,
    product_manifest_dir: impl AsRef<Path>,
    backend_version: impl Into<String>,
    troubleshooting_enabled: bool,
) -> Response
where
    P: AdminModelProvider + ?Sized,
    P::EntityType: Serialize,
    P::DataSourceType: Serialize,
    P::FilterCapabilities: Serialize,
{
    let request_context = RequestContext::from_headers(&headers);
    match admin_user_from_headers(auth_config, headers, &request_context).await {
        Ok(_) => Json(
            admin_model(
                provider,
                product_manifest_dir,
                backend_version,
                troubleshooting_enabled,
            )
            .await,
        )
        .into_response(),
        Err(err) => admin_service_error_response(err),
    }
}

pub async fn admin_troubleshooting_status_response(
    auth_config: &JwtAuthConfig,
    headers: HeaderMap,
    enabled: bool,
) -> Response {
    let request_context = RequestContext::from_headers(&headers);
    match admin_user_from_headers(auth_config, headers, &request_context).await {
        Ok(_) => Json(admin_troubleshooting_status(enabled, request_context)).into_response(),
        Err(err) => admin_service_error_response(err),
    }
}

pub async fn admin_policy_explain_response(
    provider: &(impl AdminPolicyExplainProvider + ?Sized),
    auth_config: &JwtAuthConfig,
    headers: HeaderMap,
    troubleshooting_enabled: bool,
    request: AdminPolicyExplainRequest,
) -> Response {
    let request_context = RequestContext::from_headers(&headers);
    let user = match admin_user_from_headers(auth_config, headers, &request_context).await {
        Ok(user) => user,
        Err(err) => return admin_service_error_response(err),
    };

    match explain_admin_policy(
        provider,
        troubleshooting_enabled,
        request_context,
        request,
        &user,
    )
    .await
    {
        Ok(response) => Json(response).into_response(),
        Err(err) => admin_service_error_response(err),
    }
}

pub async fn explain_admin_policy(
    provider: &(impl AdminPolicyExplainProvider + ?Sized),
    troubleshooting_enabled: bool,
    request_context: RequestContext,
    request: AdminPolicyExplainRequest,
    user: &UserAuth,
) -> Result<AdminPolicyExplainResponse, AdminServiceError> {
    if !troubleshooting_enabled {
        return Err(AdminServiceError::troubleshooting_disabled(
            &request_context,
        ));
    }

    let action = parse_admin_access_action(&request.action).ok_or_else(|| {
        AdminServiceError::bad_request(
            "action must be one of read, create, update, delete",
            &request_context,
        )
    })?;

    let result = provider
        .explain_policy_access(
            &request.schema_name,
            &request.type_name,
            action,
            user,
            &request_context,
        )
        .await?;

    Ok(AdminPolicyExplainResponse {
        enabled: true,
        request_context,
        policy_key: result.subject.policy_key,
        schema_name: result.subject.schema_name,
        type_name: result.subject.type_name,
        action: action.to_string(),
        user_name: user.user_name.clone(),
        roles: user.roles.clone(),
        decision: result.decision,
    })
}

pub async fn admin_query_diagnose_response(
    provider: &(impl AdminQueryDiagnoseProvider + ?Sized),
    auth_config: &JwtAuthConfig,
    headers: HeaderMap,
    troubleshooting_enabled: bool,
    request: AdminQueryDiagnoseRequest,
) -> Response {
    let request_context = RequestContext::from_headers(&headers);
    let user = match admin_user_from_headers(auth_config, headers, &request_context).await {
        Ok(user) => user,
        Err(err) => return admin_service_error_response(err),
    };

    match admin_query_diagnose(
        provider,
        troubleshooting_enabled,
        request_context,
        request,
        user,
    )
    .await
    {
        Ok(response) => Json(response).into_response(),
        Err(err) => admin_service_error_response(err),
    }
}

pub async fn admin_query_diagnose(
    provider: &(impl AdminQueryDiagnoseProvider + ?Sized),
    troubleshooting_enabled: bool,
    request_context: RequestContext,
    request: AdminQueryDiagnoseRequest,
    user: UserAuth,
) -> Result<AdminQueryDiagnoseResponse, AdminServiceError> {
    if !troubleshooting_enabled {
        return Err(AdminServiceError::troubleshooting_disabled(
            &request_context,
        ));
    }

    let (skip, limit) = PaginationPolicy::from_env()
        .normalize(request.skip, request.limit)
        .map_err(|err| AdminServiceError::bad_request(err.to_string(), &request_context))?;

    let mut diagnostic = provider
        .diagnose_query(
            &request.schema_name,
            &request.type_name,
            request.filter,
            request.sort,
            skip,
            limit,
            request.after,
            user,
            &request_context,
        )
        .await?;
    diagnostic.provider_diagnostic = redact_diagnostic_value(diagnostic.provider_diagnostic);

    Ok(AdminQueryDiagnoseResponse {
        enabled: true,
        request_context,
        diagnostic,
    })
}

pub async fn admin_audit_timeline_response(
    provider: &(impl AdminAuditTimelineProvider + ?Sized),
    auth_config: &JwtAuthConfig,
    headers: HeaderMap,
    troubleshooting_enabled: bool,
    request: AdminAuditTimelineRequest,
) -> Response {
    let request_context = RequestContext::from_headers(&headers);
    let user = match admin_user_from_headers(auth_config, headers, &request_context).await {
        Ok(user) => user,
        Err(err) => return admin_service_error_response(err),
    };

    match admin_audit_timeline(
        provider,
        troubleshooting_enabled,
        request_context,
        request,
        &user,
    )
    .await
    {
        Ok(response) => Json(response).into_response(),
        Err(err) => admin_service_error_response(err),
    }
}

pub async fn admin_audit_timeline(
    provider: &(impl AdminAuditTimelineProvider + ?Sized),
    troubleshooting_enabled: bool,
    request_context: RequestContext,
    request: AdminAuditTimelineRequest,
    user: &UserAuth,
) -> Result<AdminAuditTimelineResponse, AdminServiceError> {
    if !troubleshooting_enabled {
        return Err(AdminServiceError::troubleshooting_disabled(
            &request_context,
        ));
    }

    let result = provider
        .load_audit_timeline(
            &request.schema_name,
            &request.type_name,
            &request.record_id,
            request.limit.unwrap_or(25),
            user,
            &request_context,
        )
        .await?;

    if !result.current_policy.allow {
        return Err(AdminServiceError::forbidden(
            "read access denied for audit timeline",
            &request_context,
        ));
    }

    let audited = result.audited;
    let events = if audited { result.events } else { Vec::new() };
    let message = if audited {
        result.message
    } else {
        result
            .message
            .or_else(|| Some("Entity is not configured with the audited facet.".to_string()))
    };

    Ok(AdminAuditTimelineResponse {
        enabled: true,
        request_context,
        audited,
        schema_name: result.subject.schema_name,
        type_name: result.subject.type_name,
        record_id: request.record_id,
        events,
        current_policy: result.current_policy,
        message,
    })
}

pub async fn admin_audit_timeline_for_subject<F, Fut>(
    subject: AdminAuditTimelineSubject,
    current_policy: AdminPolicyDecision,
    audited: bool,
    message: Option<String>,
    load_events: F,
) -> Result<AdminAuditTimelineResult, AdminServiceError>
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = Result<Vec<Value>, AdminServiceError>>,
{
    if !current_policy.allow {
        return Ok(AdminAuditTimelineResult {
            subject,
            audited: false,
            events: Vec::new(),
            current_policy,
            message,
        });
    }

    if !audited {
        return Ok(AdminAuditTimelineResult {
            subject,
            audited: false,
            events: Vec::new(),
            current_policy,
            message,
        });
    }

    let events = load_events().await?;

    Ok(AdminAuditTimelineResult {
        subject,
        audited: true,
        events,
        current_policy,
        message,
    })
}

#[derive(Serialize)]
pub struct AdminTroubleshootingStatus {
    pub enabled: bool,
    pub env_var: &'static str,
    pub request_context: RequestContext,
    pub features: Vec<AdminTroubleshootingFeature>,
}

#[derive(Serialize)]
pub struct AdminTroubleshootingFeature {
    pub id: &'static str,
    pub label: &'static str,
    pub enabled: bool,
    pub path: &'static str,
}

#[derive(Debug, Serialize)]
pub struct AdminPolicyDecision {
    pub allow: bool,
    pub filter: Option<Value>,
}

impl From<PolicyAccess> for AdminPolicyDecision {
    fn from(access: PolicyAccess) -> Self {
        Self {
            allow: access.allow,
            filter: access.filter,
        }
    }
}

pub fn admin_troubleshooting_status(
    enabled: bool,
    request_context: RequestContext,
) -> AdminTroubleshootingStatus {
    AdminTroubleshootingStatus {
        enabled,
        env_var: ADMIN_TROUBLESHOOTING_ENV_VAR,
        request_context,
        features: vec![
            AdminTroubleshootingFeature {
                id: "policy_explain",
                label: "Policy Explainability",
                enabled,
                path: "/admin/troubleshooting/policy/explain",
            },
            AdminTroubleshootingFeature {
                id: "audit_timeline",
                label: "Audit Timeline",
                enabled,
                path: "/admin/troubleshooting/audit",
            },
            AdminTroubleshootingFeature {
                id: "query_diagnose",
                label: "Query Diagnostics",
                enabled,
                path: "/admin/troubleshooting/query/diagnose",
            },
        ],
    }
}

pub fn is_admin_user(user: &UserAuth) -> bool {
    user.roles.iter().any(|role| role == ADMIN_ROLE)
}

pub fn parse_admin_access_action(action: &str) -> Option<AccessAction> {
    match action.to_ascii_lowercase().as_str() {
        "read" => Some(AccessAction::Read),
        "create" => Some(AccessAction::Create),
        "update" => Some(AccessAction::Update),
        "delete" => Some(AccessAction::Delete),
        _ => None,
    }
}
