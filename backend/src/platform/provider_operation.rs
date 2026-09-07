//! The fixed set of operations a provider client can support, and a
//! stable query/result-row counter shape for tracing them. Ported
//! near-verbatim off `appfw_runtime::provider_bridge`'s
//! `RuntimeProviderOperation`/`RuntimeProviderOperationCounts` (backend
//! framework replacement phase 7, slice 5 --
//! docs/architecture/self-owned-backend-plan.md): plain data, no framework
//! machinery.
//!
//! Unlike `RuntimeProviderPlanInput`/`RuntimeJsonQueryResult` (slice 5
//! part 1), these two types are NOT referenced by any fixed (non-default)
//! method signature on `appfw_runtime::provider_bridge::
//! RuntimeProviderIdentity`/`RuntimeProviderDataClient` that
//! `DatabaseClientRuntimeAdapter` must implement -- confirmed by reading
//! that trait definition: `provider_declares_operation`/
//! `provider_operation_contracts` (the only framework methods mentioning
//! `RuntimeProviderOperation`) have default bodies the adapter doesn't
//! override, so overriding the name here doesn't collide with a required
//! trait-impl signature the way `FrameworkProvider`/`ProviderPoolStats`
//! still do.

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RuntimeProviderOperation {
    HealthCheck,
    ExplainQueryPlan,
    CreateItem,
    UpdateItem,
    DeleteItem,
    FindItem,
    GetItems,
    QueryItems,
    BatchFindItemsByIds,
    AggregateItems,
    AppendAuditEvent,
    QueryAuditEvents,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RuntimeProviderOperationCounts {
    pub query_count: u64,
    pub result_count: u64,
}

impl RuntimeProviderOperation {
    pub const ALL: [RuntimeProviderOperation; 12] = [
        RuntimeProviderOperation::HealthCheck,
        RuntimeProviderOperation::ExplainQueryPlan,
        RuntimeProviderOperation::CreateItem,
        RuntimeProviderOperation::UpdateItem,
        RuntimeProviderOperation::DeleteItem,
        RuntimeProviderOperation::FindItem,
        RuntimeProviderOperation::GetItems,
        RuntimeProviderOperation::QueryItems,
        RuntimeProviderOperation::BatchFindItemsByIds,
        RuntimeProviderOperation::AggregateItems,
        RuntimeProviderOperation::AppendAuditEvent,
        RuntimeProviderOperation::QueryAuditEvents,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            RuntimeProviderOperation::HealthCheck => "health_check",
            RuntimeProviderOperation::ExplainQueryPlan => "explain_query_plan",
            RuntimeProviderOperation::CreateItem => "create_item",
            RuntimeProviderOperation::UpdateItem => "update_item",
            RuntimeProviderOperation::DeleteItem => "delete_item",
            RuntimeProviderOperation::FindItem => "find_item",
            RuntimeProviderOperation::GetItems => "get_items",
            RuntimeProviderOperation::QueryItems => "query_items",
            RuntimeProviderOperation::BatchFindItemsByIds => "batch_find_items_by_ids",
            RuntimeProviderOperation::AggregateItems => "aggregate_items",
            RuntimeProviderOperation::AppendAuditEvent => "append_audit_event",
            RuntimeProviderOperation::QueryAuditEvents => "query_audit_events",
        }
    }
}

impl RuntimeProviderOperationCounts {
    pub fn new(query_count: u64, result_count: u64) -> Self {
        Self {
            query_count,
            result_count,
        }
    }

    pub fn from_result_count(result_count: usize) -> Self {
        let result_count = u64::try_from(result_count).unwrap_or(u64::MAX);
        Self::new(result_count, result_count)
    }

    pub fn from_counts(query_count: i64, result_count: i64) -> Self {
        Self::new(
            non_negative_count(query_count),
            non_negative_count(result_count),
        )
    }

    pub fn from_affected_rows(affected_rows: i64) -> Self {
        let count = non_negative_count(affected_rows);
        Self::new(count, count)
    }
}

fn non_negative_count(value: i64) -> u64 {
    u64::try_from(value).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn as_str_covers_every_operation_with_a_stable_token() {
        for operation in RuntimeProviderOperation::ALL {
            assert!(!operation.as_str().is_empty());
        }
        assert_eq!(RuntimeProviderOperation::CreateItem.as_str(), "create_item");
        assert_eq!(
            RuntimeProviderOperation::QueryAuditEvents.as_str(),
            "query_audit_events"
        );
    }

    #[test]
    fn counts_from_affected_rows_clamps_negative_to_zero() {
        let counts = RuntimeProviderOperationCounts::from_affected_rows(-1);
        assert_eq!(counts.query_count, 0);
        assert_eq!(counts.result_count, 0);
    }

    #[test]
    fn counts_from_result_count_mirrors_query_and_result() {
        let counts = RuntimeProviderOperationCounts::from_result_count(7);
        assert_eq!(counts.query_count, 7);
        assert_eq!(counts.result_count, 7);
    }
}
