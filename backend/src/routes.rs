use axum::{
    http::Method,
    middleware,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::{handlers, middleware::request_logging, state::AppState};

pub fn build_router(state: AppState) -> Router {
    let origins: Vec<_> = state
        .config
        .allowed_origins
        .iter()
        .filter_map(|o| o.parse().ok())
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
        .allow_headers(tower_http::cors::Any);

    // axum 0.7 uses `:name` path-parameter syntax (the `{name}` style is
    // axum 0.8+) — every dynamic segment below must use the colon form or it
    // silently fails to match anything at all.
    let api_v1 = Router::new()
        .route("/auth/login", post(handlers::auth::login))
        .route("/auth/register", post(handlers::auth::register))
        .route("/auth/refresh", post(handlers::auth::refresh))
        .route("/auth/me", get(handlers::auth::me))
        .route(
            "/projects",
            get(handlers::projects::list).post(handlers::projects::create),
        )
        .route("/projects/send-intake-email", post(handlers::projects::send_intake_email))
        .route("/projects/extract-intake", post(handlers::projects::extract_intake))
        .route("/projects/approvals/pending", get(handlers::projects::pending_approvals))
        .route(
            "/projects/:project_id",
            get(handlers::projects::get)
                .patch(handlers::projects::update)
                .delete(handlers::projects::delete),
        )
        .route(
            "/projects/:project_id/submit-decision",
            post(handlers::projects::submit_decision),
        )
        .route(
            "/projects/:project_id/documents",
            get(handlers::projects::list_documents)
        )
        .route(
            "/projects/:project_id/documents/:doc_id/download",
            get(handlers::projects::download_document)
        )
        .route(
            "/projects/:project_id/extract-team-fields/:team",
            post(handlers::projects::extract_team_fields)
        )
        .route(
            "/projects/:project_id/fast-track-complete",
            post(handlers::projects::fast_track_complete),
        )
        .route("/projects/:project_id/workspace", get(handlers::workspace::get))
        .route(
            "/projects/:project_id/workspace/:stage",
            post(handlers::workspace::save_stage),
        )
        .route("/gate-reviews", get(handlers::gate_reviews::list))
        .route("/gate-reviews/:gate_id", get(handlers::gate_reviews::get))
        .route("/gate-reviews/:gate_id/decision", post(handlers::gate_reviews::decide))
        .route("/dashboard", get(handlers::dashboard::get))
        .route("/notifications", get(handlers::notifications::list))
        .route("/notifications/mark-all-read", post(handlers::notifications::mark_all_read))
        .route("/audit", get(handlers::audit::list))
        .route(
            "/users",
            get(handlers::users::list_users).post(handlers::users::create_user),
        )
        .route("/graphql", post(handlers::graphql::graphql_handler));

    Router::new()
        .route("/", get(root))
        .route("/health", get(health))
        .nest("/api/v1", api_v1)
        .layer(middleware::from_fn(request_logging::log_requests))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

async fn root() -> Json<serde_json::Value> {
    Json(json!({ "service": "governance-backend", "status": "ok" }))
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "healthy" }))
}
