//! Read-path query orchestration: the "validate → authorize → fetch →
//! evaluate → trace" pipeline for find/get/query/batch/aggregate reads,
//! routed through the product's own `DatabaseClient` trait object.
//!
//! This is a from-scratch, product-owned reimplementation of the read-path
//! orchestration previously supplied by `appfw_runtime::data_access`. It does
//! not delegate to or wrap that framework module's logic. See the phase 5
//! sub-slice 3b port spec for the rationale behind routing through
//! `&dyn DatabaseClient` directly instead of a new generic trait.

#![allow(dead_code)]

/// A structured, redaction-safe diagnostic describing how a query would be
/// (or was) executed against a provider.
#[derive(Clone, Debug, serde::Serialize)]
pub struct QueryPlanDiagnostic {
    pub schema_name: String,
    pub type_name: String,
    pub provider: String,
    pub data_source: String,
    pub pagination: PaginationDiagnostic,
    pub access_filter_applied: bool,
    pub cost: appfw_runtime::QueryCost,
    pub budget: appfw_runtime::QueryCostBudget,
    pub provider_diagnostic: serde_json::Value,
}

/// A structured description of the pagination window in effect for a query.
#[derive(Clone, Debug, serde::Serialize)]
pub struct PaginationDiagnostic {
    pub strategy: &'static str,
    pub skip: i32,
    pub limit: i32,
    pub after_present: bool,
}

/// The previous/next cursor pair produced by a page of results.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QueryCursors {
    pub previous_cursor: Option<String>,
    pub next_cursor: Option<String>,
}

/// The sort field/direction driving a read, needed to compute keyset cursors.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReadSort {
    pub field: String,
    pub direction: crate::data::query_ir::SortDirection,
}

/// The result of finalizing a page of `query_items`-shaped results: the
/// cursor pair plus the (evaluated) items for that page.
#[derive(Clone, Debug, PartialEq)]
pub struct QueryItemsFinalization {
    pub previous_cursor: Option<String>,
    pub next_cursor: Option<String>,
    pub items: Vec<serde_json::Map<String, serde_json::Value>>,
}

/// Build a redaction-safe pagination diagnostic from a resolved `Pagination`.
pub fn pagination_diagnostic(
    pagination: &crate::data::provider_plan::Pagination,
) -> PaginationDiagnostic {
    PaginationDiagnostic {
        strategy: match &pagination.strategy {
            crate::data::provider_plan::PaginationStrategy::Offset => "offset",
            crate::data::provider_plan::PaginationStrategy::Keyset { .. } => "keyset",
        },
        skip: pagination.skip,
        limit: pagination.limit,
        after_present: pagination.cursor_after().is_some(),
    }
}

/// Convert a batch of ids into a provider query limit, failing closed if the
/// batch is too large to represent as an `i32` limit.
pub fn batch_limit_for_ids(ids_len: usize) -> Result<i32, crate::routes::app_error::AppError> {
    i32::try_from(ids_len).map_err(|_| {
        crate::routes::app_error::AppError::Validation(
            "batch load size exceeds supported query limit".to_string(),
        )
    })
}

/// Build an `_in` filter over the primary key for a batch read.
pub fn primary_key_in_filter(
    primary_key_name: &str,
    ids: Vec<serde_json::Value>,
) -> Result<serde_json::Value, crate::routes::app_error::AppError> {
    let primary_key_name = primary_key_name.trim();
    if primary_key_name.is_empty() {
        return Err(crate::routes::app_error::AppError::Metadata(
            appfw_runtime::MetadataError::MissingPrimaryKey {
                entity_type: "batch read".to_string(),
            },
        ));
    }
    Ok(serde_json::json!({ primary_key_name: { "_in": ids } }))
}

/// Compute the next keyset cursor from a page of items, or `None` when
/// pagination is not keyset-based, the page is short (no more results), or
/// the sort field is missing/absent from the last item.
pub fn next_keyset_cursor_from_items(
    pagination: &crate::data::provider_plan::Pagination,
    sort_field: &str,
    sort_direction: crate::data::query_ir::SortDirection,
    items: &[serde_json::Map<String, serde_json::Value>],
) -> Result<Option<String>, crate::routes::app_error::AppError> {
    if !pagination.is_keyset() {
        return Ok(None);
    }
    let page_limit = usize::try_from(pagination.limit).unwrap_or(usize::MAX);
    if items.len() < page_limit {
        return Ok(None);
    }
    let sort_field = sort_field.trim();
    if sort_field.is_empty() {
        return Ok(None);
    }
    let Some(value) = items.last().and_then(|item| item.get(sort_field)).cloned() else {
        return Ok(None);
    };
    crate::data::keyset_cursor::encode_keyset_cursor(sort_field, sort_direction, value).map(Some)
}

/// Compute the previous/next cursor pair for a page of items.
pub fn keyset_cursors_from_items(
    pagination: &crate::data::provider_plan::Pagination,
    sort_field: &str,
    sort_direction: crate::data::query_ir::SortDirection,
    items: &[serde_json::Map<String, serde_json::Value>],
) -> Result<QueryCursors, crate::routes::app_error::AppError> {
    let previous_cursor = pagination.cursor_after();
    let next_cursor = next_keyset_cursor_from_items(pagination, sort_field, sort_direction, items)?;
    Ok(QueryCursors {
        previous_cursor,
        next_cursor,
    })
}

/// Apply a per-record evaluation callback (e.g. policy/field-level
/// evaluation) to an optional read record.
pub fn evaluate_optional_read_record<E>(
    record: Option<serde_json::Map<String, serde_json::Value>>,
    mut evaluate: impl FnMut(
        serde_json::Map<String, serde_json::Value>,
    ) -> Result<serde_json::Map<String, serde_json::Value>, E>,
) -> Result<Option<serde_json::Map<String, serde_json::Value>>, E> {
    record.map(&mut evaluate).transpose()
}

/// Apply a per-record evaluation callback to a list of read records.
pub fn evaluate_read_records<E>(
    items: Vec<serde_json::Map<String, serde_json::Value>>,
    mut evaluate: impl FnMut(
        serde_json::Map<String, serde_json::Value>,
    ) -> Result<serde_json::Map<String, serde_json::Value>, E>,
) -> Result<Vec<serde_json::Map<String, serde_json::Value>>, E> {
    items.into_iter().map(&mut evaluate).collect()
}

/// Finalize a page of `query_items`-shaped results: compute the cursor pair
/// and run the per-record evaluation callback over the page.
pub fn finalize_query_items_page<E>(
    pagination: &crate::data::provider_plan::Pagination,
    sort: Option<&ReadSort>,
    items: Vec<serde_json::Map<String, serde_json::Value>>,
    evaluate: impl FnMut(
        serde_json::Map<String, serde_json::Value>,
    ) -> Result<serde_json::Map<String, serde_json::Value>, E>,
) -> Result<QueryItemsFinalization, E>
where
    E: From<crate::routes::app_error::AppError>,
{
    let cursors = match sort {
        Some(sort) => keyset_cursors_from_items(pagination, &sort.field, sort.direction, &items)
            .map_err(E::from)?,
        None => QueryCursors {
            previous_cursor: pagination.cursor_after(),
            next_cursor: None,
        },
    };
    let items = evaluate_read_records(items, evaluate)?;
    Ok(QueryItemsFinalization {
        previous_cursor: cursors.previous_cursor,
        next_cursor: cursors.next_cursor,
        items,
    })
}

/// Execute a single-record ("optional") read: call the provider, trace the
/// operation, then run the per-record evaluation callback.
pub async fn execute_optional_read<E, Fut>(
    operation: appfw_runtime::RuntimeProviderOperation,
    provider_call: impl FnOnce() -> Fut,
    trace: impl FnOnce(
        appfw_runtime::RuntimeProviderOperation,
        std::time::Instant,
        appfw_runtime::RuntimeProviderOperationCounts,
    ),
    evaluate: impl FnMut(
        serde_json::Map<String, serde_json::Value>,
    ) -> Result<serde_json::Map<String, serde_json::Value>, E>,
) -> Result<Option<serde_json::Map<String, serde_json::Value>>, E>
where
    Fut:
        std::future::Future<Output = Result<Option<serde_json::Map<String, serde_json::Value>>, E>>,
{
    let started_at = std::time::Instant::now();
    let record = provider_call().await?;
    let result_count = if record.is_some() { 1 } else { 0 };
    trace(
        operation,
        started_at,
        appfw_runtime::RuntimeProviderOperationCounts::from_counts(result_count, result_count),
    );
    evaluate_optional_read_record(record, evaluate)
}

/// Execute a list-shaped read: call the provider, trace the operation, then
/// run the per-record evaluation callback over every item.
pub async fn execute_list_read<E, Fut>(
    operation: appfw_runtime::RuntimeProviderOperation,
    provider_call: impl FnOnce() -> Fut,
    trace: impl FnOnce(
        appfw_runtime::RuntimeProviderOperation,
        std::time::Instant,
        appfw_runtime::RuntimeProviderOperationCounts,
    ),
    evaluate: impl FnMut(
        serde_json::Map<String, serde_json::Value>,
    ) -> Result<serde_json::Map<String, serde_json::Value>, E>,
) -> Result<Vec<serde_json::Map<String, serde_json::Value>>, E>
where
    Fut: std::future::Future<Output = Result<Vec<serde_json::Map<String, serde_json::Value>>, E>>,
{
    let started_at = std::time::Instant::now();
    let items = provider_call().await?;
    let counts = appfw_runtime::RuntimeProviderOperationCounts::from_result_count(items.len());
    trace(operation, started_at, counts);
    evaluate_read_records(items, evaluate)
}

/// Execute a paged `query_items`-shaped read: call the provider, trace the
/// operation, then finalize the page (cursors + per-record evaluation) and
/// splice the finalized state back into the provider's result type.
pub async fn execute_query_page_read<R, E, Fut>(
    pagination: &crate::data::provider_plan::Pagination,
    sort: Option<&ReadSort>,
    provider_call: impl FnOnce() -> Fut,
    query_count: impl FnOnce(&R) -> i64,
    take_items: impl FnOnce(&mut R) -> Vec<serde_json::Map<String, serde_json::Value>>,
    apply_finalization: impl FnOnce(&mut R, QueryItemsFinalization),
    trace: impl FnOnce(
        appfw_runtime::RuntimeProviderOperation,
        std::time::Instant,
        appfw_runtime::RuntimeProviderOperationCounts,
    ),
    evaluate: impl FnMut(
        serde_json::Map<String, serde_json::Value>,
    ) -> Result<serde_json::Map<String, serde_json::Value>, E>,
) -> Result<R, E>
where
    Fut: std::future::Future<Output = Result<R, E>>,
    E: From<crate::routes::app_error::AppError>,
{
    let started_at = std::time::Instant::now();
    let mut result = provider_call().await?;
    let query_count = query_count(&result);
    let items = take_items(&mut result);
    trace(
        appfw_runtime::RuntimeProviderOperation::QueryItems,
        started_at,
        appfw_runtime::RuntimeProviderOperationCounts::from_counts(query_count, items.len() as i64),
    );
    let finalized = finalize_query_items_page(pagination, sort, items, evaluate)?;
    apply_finalization(&mut result, finalized);
    Ok(result)
}

/// Execute an aggregate read: call the provider, then trace the operation.
/// Aggregate reads carry no per-record evaluation callback.
pub async fn execute_aggregate_read<R, E, Fut>(
    provider_call: impl FnOnce() -> Fut,
    query_count: impl FnOnce(&R) -> i64,
    result_count: impl FnOnce(&R) -> i64,
    trace: impl FnOnce(
        appfw_runtime::RuntimeProviderOperation,
        std::time::Instant,
        appfw_runtime::RuntimeProviderOperationCounts,
    ),
) -> Result<R, E>
where
    Fut: std::future::Future<Output = Result<R, E>>,
{
    let started_at = std::time::Instant::now();
    let result = provider_call().await?;
    trace(
        appfw_runtime::RuntimeProviderOperation::AggregateItems,
        started_at,
        appfw_runtime::RuntimeProviderOperationCounts::from_counts(
            query_count(&result),
            result_count(&result),
        ),
    );
    Ok(result)
}

/// Fail closed unless the provider declares support for `operation`.
fn ensure_provider_operation(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    operation: appfw_runtime::RuntimeProviderOperation,
) -> Result<(), crate::routes::app_error::AppError> {
    use crate::data::provider_identity::ProviderIdentity;
    if ProviderIdentity::provider_declares_operation(provider, operation) {
        return Ok(());
    }
    let descriptor = ProviderIdentity::provider_descriptor(provider);
    Err(crate::routes::app_error::AppError::DataAccess(format!(
        "provider '{}' for data source '{}' does not declare operation '{}'",
        descriptor.provider_key(),
        descriptor.data_source_name(),
        operation.as_str()
    )))
}

pub async fn provider_health_check(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
) -> Result<(), crate::routes::app_error::AppError> {
    ensure_provider_operation(
        provider,
        appfw_runtime::RuntimeProviderOperation::HealthCheck,
    )?;
    provider.health_check().await
}

pub async fn provider_find_item_json(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    entity_type: std::sync::Arc<crate::schemas::system::EntityType>,
    selections: serde_json::Value,
    id: String,
    user: &appfw_runtime::extension::UserAuth,
    access: &crate::platform::policy::PolicyAccess,
) -> Result<Option<crate::data::provider_plan::JsonObj>, crate::routes::app_error::AppError> {
    ensure_provider_operation(provider, appfw_runtime::RuntimeProviderOperation::FindItem)?;
    provider
        .find_item_json(entity_type, selections, id, user, access)
        .await
}

pub async fn provider_get_items_plan_json(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    input: appfw_runtime::RuntimeProviderPlanInput<
        '_,
        crate::data::clients::database_client::ProviderQueryPlan,
    >,
) -> Result<Vec<crate::data::provider_plan::JsonObj>, crate::routes::app_error::AppError> {
    ensure_provider_operation(provider, appfw_runtime::RuntimeProviderOperation::GetItems)?;
    provider.get_items_plan_json(input).await
}

pub async fn provider_query_items_plan_json(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    input: appfw_runtime::RuntimeProviderPlanInput<
        '_,
        crate::data::clients::database_client::ProviderQueryPlan,
    >,
) -> Result<
    crate::data::clients::database_client::JsonQueryResult,
    crate::routes::app_error::AppError,
> {
    ensure_provider_operation(
        provider,
        appfw_runtime::RuntimeProviderOperation::QueryItems,
    )?;
    provider.query_items_plan_json(input).await
}

pub async fn provider_batch_get_items_plan_json(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    input: appfw_runtime::RuntimeProviderPlanInput<
        '_,
        crate::data::clients::database_client::ProviderQueryPlan,
    >,
) -> Result<Vec<crate::data::provider_plan::JsonObj>, crate::routes::app_error::AppError> {
    ensure_provider_operation(
        provider,
        appfw_runtime::RuntimeProviderOperation::BatchFindItemsByIds,
    )?;
    provider.batch_get_items_plan_json(input).await
}

pub async fn provider_aggregate_items_plan_json(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    input: appfw_runtime::RuntimeProviderPlanInput<
        '_,
        crate::data::clients::database_client::ProviderAggregatePlan,
    >,
) -> Result<
    crate::data::clients::database_client::JsonAggregateResult,
    crate::routes::app_error::AppError,
> {
    ensure_provider_operation(
        provider,
        appfw_runtime::RuntimeProviderOperation::AggregateItems,
    )?;
    provider.aggregate_items_plan_json(input).await
}

pub async fn provider_explain_query_plan(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    input: appfw_runtime::RuntimeProviderPlanInput<
        '_,
        &crate::data::clients::database_client::ProviderQueryPlan,
    >,
) -> Result<serde_json::Value, crate::routes::app_error::AppError> {
    ensure_provider_operation(
        provider,
        appfw_runtime::RuntimeProviderOperation::ExplainQueryPlan,
    )?;
    provider.explain_query_plan(input).await
}

pub async fn execute_find_item_read(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    entity_type: std::sync::Arc<crate::schemas::system::EntityType>,
    selections: serde_json::Value,
    id: String,
    user: &appfw_runtime::extension::UserAuth,
    access: &crate::platform::policy::PolicyAccess,
    trace: impl FnOnce(
        appfw_runtime::RuntimeProviderOperation,
        std::time::Instant,
        appfw_runtime::RuntimeProviderOperationCounts,
    ),
    evaluate: impl FnMut(
        crate::data::provider_plan::JsonObj,
    ) -> Result<
        crate::data::provider_plan::JsonObj,
        crate::routes::app_error::AppError,
    >,
) -> Result<Option<crate::data::provider_plan::JsonObj>, crate::routes::app_error::AppError> {
    execute_optional_read(
        appfw_runtime::RuntimeProviderOperation::FindItem,
        || provider_find_item_json(provider, entity_type, selections, id, user, access),
        trace,
        evaluate,
    )
    .await
}

pub async fn execute_get_items_plan_read(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    plan: crate::data::clients::database_client::ProviderQueryPlan,
    user: &appfw_runtime::extension::UserAuth,
    access: &appfw_runtime::PolicyAccess,
    trace: impl FnOnce(
        appfw_runtime::RuntimeProviderOperation,
        std::time::Instant,
        appfw_runtime::RuntimeProviderOperationCounts,
    ),
    evaluate: impl FnMut(
        crate::data::provider_plan::JsonObj,
    ) -> Result<
        crate::data::provider_plan::JsonObj,
        crate::routes::app_error::AppError,
    >,
) -> Result<Vec<crate::data::provider_plan::JsonObj>, crate::routes::app_error::AppError> {
    execute_list_read(
        appfw_runtime::RuntimeProviderOperation::GetItems,
        || {
            provider_get_items_plan_json(
                provider,
                appfw_runtime::RuntimeProviderPlanInput::new(plan, user, access),
            )
        },
        trace,
        evaluate,
    )
    .await
}

pub async fn execute_batch_get_items_plan_read(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    plan: crate::data::clients::database_client::ProviderQueryPlan,
    user: &appfw_runtime::extension::UserAuth,
    access: &appfw_runtime::PolicyAccess,
    trace: impl FnOnce(
        appfw_runtime::RuntimeProviderOperation,
        std::time::Instant,
        appfw_runtime::RuntimeProviderOperationCounts,
    ),
    evaluate: impl FnMut(
        crate::data::provider_plan::JsonObj,
    ) -> Result<
        crate::data::provider_plan::JsonObj,
        crate::routes::app_error::AppError,
    >,
) -> Result<Vec<crate::data::provider_plan::JsonObj>, crate::routes::app_error::AppError> {
    execute_list_read(
        appfw_runtime::RuntimeProviderOperation::BatchFindItemsByIds,
        || {
            provider_batch_get_items_plan_json(
                provider,
                appfw_runtime::RuntimeProviderPlanInput::new(plan, user, access),
            )
        },
        trace,
        evaluate,
    )
    .await
}

pub async fn execute_query_items_plan_read(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    plan: crate::data::clients::database_client::ProviderQueryPlan,
    pagination: &crate::data::provider_plan::Pagination,
    sort: Option<&ReadSort>,
    user: &appfw_runtime::extension::UserAuth,
    access: &appfw_runtime::PolicyAccess,
    trace: impl FnOnce(
        appfw_runtime::RuntimeProviderOperation,
        std::time::Instant,
        appfw_runtime::RuntimeProviderOperationCounts,
    ),
    evaluate: impl FnMut(
        crate::data::provider_plan::JsonObj,
    ) -> Result<
        crate::data::provider_plan::JsonObj,
        crate::routes::app_error::AppError,
    >,
) -> Result<
    crate::data::clients::database_client::JsonQueryResult,
    crate::routes::app_error::AppError,
> {
    execute_query_page_read(
        pagination,
        sort,
        || {
            provider_query_items_plan_json(
                provider,
                appfw_runtime::RuntimeProviderPlanInput::new(plan, user, access),
            )
        },
        |result| result.query_count,
        |result| std::mem::take(&mut result.items),
        |result, finalized| {
            result.items = finalized.items;
            result.previous_cursor = finalized.previous_cursor;
            result.next_cursor = finalized.next_cursor;
        },
        trace,
        evaluate,
    )
    .await
}

pub async fn execute_aggregate_items_plan_read(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    plan: crate::data::clients::database_client::ProviderAggregatePlan,
    user: &appfw_runtime::extension::UserAuth,
    access: &appfw_runtime::PolicyAccess,
    trace: impl FnOnce(
        appfw_runtime::RuntimeProviderOperation,
        std::time::Instant,
        appfw_runtime::RuntimeProviderOperationCounts,
    ),
) -> Result<
    crate::data::clients::database_client::JsonAggregateResult,
    crate::routes::app_error::AppError,
> {
    execute_aggregate_read(
        || {
            provider_aggregate_items_plan_json(
                provider,
                appfw_runtime::RuntimeProviderPlanInput::new(plan, user, access),
            )
        },
        |result| result.query_count,
        |result| result.items.len() as i64,
        trace,
    )
    .await
}
