//! The GraphQL HTTP entrypoint: POST for queries/mutations, GET for the
//! GraphiQL explorer, wired to `platform::auth`'s bearer-token resolution
//! and the introspection allow-list gate.
//!
//! Product-owned (backend framework replacement phase 4b-4). Designed
//! independently against a behavior specification -- not derived from
//! framework source. Replaces
//! `appfw_runtime::routing::runtime_graphql_schema_routes`, the last piece
//! of the GraphQL request path that stayed framework-owned after phase 4b-2
//! (see `platform::routing`'s doc comment, now out of date on this point).
//!
//! Kept framework-owned, imported as opaque types/functions:
//!   - `SecurityConfig` -- RBAC-bypass entanglement in `config/app_config.rs`
//!     (phase-5 territory); only read here, never redefined.
//!   - `RequestContext`, `annotate_graphql_response`,
//!     `graphql_error_with_context` -- operate on `RequestContext`'s
//!     framework-owned storage, deferred since phase 4b-1 because
//!     `admin_ui.rs`'s framework-trait signatures fix that type. Same
//!     pattern `platform::routing` already uses for `metrics_hook`/
//!     `trace_context_hook`.
//!   - `RuntimeJwtExtractor` -- a plain
//!     `{ user: Option<Arc<appfw_runtime::extension::UserAuth>> }` holder;
//!     `appfw_runtime::user_from_graphql_context` (used by every generated
//!     resolver via `product_api::user_from_context`) looks it up by
//!     concrete type from the request's data. `platform::auth::resolve_user`
//!     now returns the product-owned `UserAuth`
//!     (`platform::user_auth`, phase 5), so this module converts it to the
//!     framework's own type right here, at the one point that struct is
//!     built -- the framework type itself must stay exactly as every
//!     resolver already expects it.
//!   - `graphiql::html` -- a static HTML page generator with no auth logic;
//!     out of scope for an authentication-boundary port.
//!
//! GraphQL errors are always returned as HTTP 200 with an `errors` array
//! (never a 401/403) -- this matches both async-graphql's own convention and
//! the pre-port baseline captured in `phase4b-baseline/baseline.md`.

use appfw_runtime::{
    graphiql,
    observability::{annotate_graphql_response, graphql_error_with_context, RequestContext},
    security::SecurityConfig,
    RuntimeJwtExtractor,
};
use async_graphql::{ObjectType, Schema, SubscriptionType};
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{
    extract::{Extension, State},
    http::HeaderMap,
    response::Html,
    routing::{get, post},
    Router,
};

use crate::platform::auth::{authorize_introspection, resolve_user, JwtAuthConfig};

#[derive(Clone)]
struct GatewayState {
    auth: JwtAuthConfig,
    security: SecurityConfig,
}

type Schemas<Query, Mutation, Subscription> = (
    Schema<Query, Mutation, Subscription>,
    Schema<Query, Mutation, Subscription>,
);

/// Mounts a schema at `path`: `POST path` executes queries/mutations behind
/// bearer-token auth, `GET path` serves the GraphiQL explorer.
pub(crate) fn mount<Query, Mutation, Subscription>(
    path: &'static str,
    schema: Schema<Query, Mutation, Subscription>,
    introspection_schema: Schema<Query, Mutation, Subscription>,
    auth: JwtAuthConfig,
    security: SecurityConfig,
) -> Router
where
    Query: ObjectType + 'static,
    Mutation: ObjectType + 'static,
    Subscription: SubscriptionType + 'static,
{
    Router::new()
        .route(path, post(handle_graphql::<Query, Mutation, Subscription>))
        .route(path, get(move || async move { Html(graphiql::html(path)) }))
        .layer(Extension((schema, introspection_schema)))
        .with_state(GatewayState { auth, security })
}

async fn handle_graphql<Query, Mutation, Subscription>(
    State(state): State<GatewayState>,
    headers: HeaderMap,
    Extension((schema, introspection_schema)): Extension<Schemas<Query, Mutation, Subscription>>,
    request: GraphQLRequest,
) -> GraphQLResponse
where
    Query: ObjectType + 'static,
    Mutation: ObjectType + 'static,
    Subscription: SubscriptionType + 'static,
{
    let request_context = RequestContext::from_headers(&headers);
    let request = request.into_inner();
    let is_introspection = request.query.contains("__schema") || request.query.contains("__type");

    let user = match resolve_user(&state.auth, &headers).await {
        Ok(user) => user,
        Err(error) => return rejected(error, &request_context),
    };

    if is_introspection {
        if let Err(error) = authorize_introspection(&state.security, user.as_deref()) {
            return rejected(error, &request_context);
        }
    }

    let schema_for_request = if is_introspection {
        &introspection_schema
    } else {
        &schema
    };

    // Deep-clones every field (including a fresh Arc allocation) on every
    // request -- `user_from_graphql_context`/`user_from_context` then clone
    // it again back to the product type. Temporary by construction: this
    // boundary disappears once phase 5 removes the framework's
    // `RuntimeJwtExtractor`/`user_from_graphql_context`, at which point
    // `resolve_user`'s `Arc<UserAuth>` can flow straight through with no
    // conversion at all. Not worth optimizing before then.
    let user =
        user.map(|user| std::sync::Arc::new(appfw_runtime::extension::UserAuth::from(&*user)));
    let request = request.data(RuntimeJwtExtractor { user });
    let response = schema_for_request.execute(request).await;
    annotate_graphql_response(response, &request_context).into()
}

fn rejected(
    error: appfw_runtime::RuntimeError,
    request_context: &RequestContext,
) -> GraphQLResponse {
    GraphQLResponse::from(async_graphql::Response::from_errors(vec![
        graphql_error_with_context(error.to_string(), request_context),
    ]))
}
