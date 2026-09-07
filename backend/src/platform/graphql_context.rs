//! The two async-graphql request-context extension types every generated
//! resolver reads: the current authenticated user, and the per-request
//! handler bundle (data access client + entity type + GraphQL selection
//! set). Independent reimplementation of
//! `appfw_runtime::extension::{RuntimeJwtExtractor, RuntimeHandlerContext,
//! user_from_graphql_context, data_from_graphql_context}` (backend
//! framework replacement phase 7, slice 3's remainder --
//! docs/architecture/self-owned-backend-plan.md).
//!
//! This does NOT touch real JWT/Okta verification -- that's entirely
//! self-owned already in `platform::auth` (phase 4b-4). This module only
//! replaces the plumbing that carries `platform::auth::resolve_user`'s
//! output into generated resolvers via async-graphql's typed context data,
//! which is why it was scoped separately: the framework's own
//! `RuntimeJwtExtractor` held the framework's `extension::UserAuth`, so
//! every resolver needed a `UserAuth::from(...)` bridge at the boundary
//! (`graphql_gateway.rs` built the framework struct on the way in,
//! `product_api::user_from_context` converted back out) -- both entirely
//! for the sake of using the framework's own struct as the context-data
//! lookup key. Since `RuntimeJwtExtractor`/`RuntimeHandlerContext` are
//! plain generic data (no framework machinery, not referenced by any
//! fixed trait signature), holding this crate's own `UserAuth` directly
//! removes that bridge entirely: `graphql_gateway.rs` inserts
//! `Arc<UserAuth>` (self-owned) straight through, and every resolver reads
//! it back as the same self-owned type, no conversion anywhere in between.

use std::sync::Arc;

use serde_json::Value;

use crate::platform::user_auth::UserAuth;

#[derive(Debug, Clone)]
pub struct RuntimeJwtExtractor {
    pub user: Option<Arc<UserAuth>>,
}

pub fn user_from_graphql_context(ctx: &async_graphql::Context<'_>) -> Option<UserAuth> {
    ctx.data_opt::<RuntimeJwtExtractor>()
        .and_then(|jwt_extractor| jwt_extractor.user.as_ref().map(|user| (**user).clone()))
}

pub fn data_from_graphql_context<D>(ctx: &async_graphql::Context<'_>) -> Arc<D>
where
    D: Send + Sync + 'static,
{
    ctx.data_unchecked::<Arc<D>>().clone()
}

#[derive(Clone)]
pub struct RuntimeHandlerContext<D, E> {
    pub user: Option<UserAuth>,
    pub data_access: Arc<D>,
    pub entity_type: Arc<E>,
    pub selections: Value,
}

impl<D, E> RuntimeHandlerContext<D, E> {
    pub fn new(
        user: Option<UserAuth>,
        data_access: Arc<D>,
        entity_type: Arc<E>,
        selections: Value,
    ) -> Self {
        Self {
            user,
            data_access,
            entity_type,
            selections,
        }
    }

    pub fn into_handler_parts(self) -> (Option<UserAuth>, Arc<D>, Arc<E>, Value) {
        (
            self.user,
            self.data_access,
            self.entity_type,
            self.selections,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_graphql::{EmptyMutation, EmptySubscription, Object, Schema};

    struct Query;

    #[Object]
    impl Query {
        async fn current_user_name(&self, ctx: &async_graphql::Context<'_>) -> Option<String> {
            Some(user_from_graphql_context(ctx)?.user_name)
        }
    }

    #[tokio::test]
    async fn user_from_graphql_context_reads_the_inserted_extractor() {
        let schema = Schema::new(Query, EmptyMutation, EmptySubscription);
        let user = UserAuth::human(
            "tenant-1",
            "casey",
            "UTC",
            vec!["admin".to_string()],
            vec![],
            "token",
        );
        let request = async_graphql::Request::new("{ currentUserName }").data(RuntimeJwtExtractor {
            user: Some(Arc::new(user)),
        });

        let response = schema.execute(request).await;
        assert!(response.errors.is_empty(), "{:?}", response.errors);
        assert_eq!(
            response.data.into_json().unwrap()["currentUserName"],
            "casey"
        );
    }

    #[tokio::test]
    async fn user_from_graphql_context_is_none_when_absent() {
        let schema = Schema::new(Query, EmptyMutation, EmptySubscription);
        let request = async_graphql::Request::new("{ currentUserName }")
            .data(RuntimeJwtExtractor { user: None });

        let response = schema.execute(request).await;
        assert!(response.errors.is_empty(), "{:?}", response.errors);
        assert!(response.data.into_json().unwrap()["currentUserName"].is_null());
    }

    #[test]
    fn handler_context_round_trips_its_parts() {
        let user = UserAuth::service(
            "tenant-1",
            "svc",
            vec!["admin".to_string()],
            vec![],
        );
        let context = RuntimeHandlerContext::new(
            Some(user.clone()),
            Arc::new(42u32),
            Arc::new("entity".to_string()),
            serde_json::json!({ "selection_set": [] }),
        );

        let (parts_user, data_access, entity_type, selections) = context.into_handler_parts();
        assert_eq!(parts_user.map(|u| u.user_name), Some("svc".to_string()));
        assert_eq!(*data_access, 42);
        assert_eq!(*entity_type, "entity");
        assert_eq!(selections, serde_json::json!({ "selection_set": [] }));
    }
}
