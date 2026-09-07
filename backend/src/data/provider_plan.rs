use crate::routes::app_error::AppError;

/// The pagination strategy in effect for a query.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PaginationStrategy {
    Offset,
    Keyset { after: Option<String> },
}

/// A resolved, validated pagination window for a query.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Pagination {
    pub skip: i32,
    pub limit: i32,
    pub strategy: PaginationStrategy,
}

impl Pagination {
    pub fn new(skip: i32, limit: i32) -> Result<Self, AppError> {
        PaginationPolicy::from_env().validate(skip, limit)?;
        Ok(Self {
            skip,
            limit,
            strategy: PaginationStrategy::Offset,
        })
    }

    pub fn keyset(after: Option<String>, limit: i32) -> Result<Self, AppError> {
        PaginationPolicy::from_env().validate(0, limit)?;
        Ok(Self {
            skip: 0,
            limit,
            strategy: PaginationStrategy::Keyset { after },
        })
    }

    pub fn is_keyset(&self) -> bool {
        matches!(self.strategy, PaginationStrategy::Keyset { .. })
    }

    pub fn cursor_after(&self) -> Option<String> {
        match &self.strategy {
            PaginationStrategy::Offset => None,
            PaginationStrategy::Keyset { after } => after.clone(),
        }
    }
}

/// Server-side policy governing acceptable pagination windows.
#[derive(Clone, Debug, Eq, PartialEq, serde::Serialize)]
pub struct PaginationPolicy {
    pub default_page_size: i32,
    pub max_page_size: i32,
}

impl PaginationPolicy {
    pub const DEFAULT_PAGE_SIZE: i32 = 50;
    pub const DEFAULT_MAX_PAGE_SIZE: i32 = 250;

    pub fn from_env() -> Self {
        let max_page_size = env_i32("APP_QUERY_MAX_PAGE_SIZE", Self::DEFAULT_MAX_PAGE_SIZE, 1);
        let default_page_size =
            env_i32("APP_QUERY_DEFAULT_PAGE_SIZE", Self::DEFAULT_PAGE_SIZE, 1).min(max_page_size);
        Self {
            default_page_size,
            max_page_size,
        }
    }

    pub fn normalize(&self, skip: Option<i32>, limit: Option<i32>) -> Result<(i32, i32), AppError> {
        let skip = skip.unwrap_or(0);
        let limit = limit.unwrap_or(self.default_page_size);
        self.validate(skip, limit)?;
        Ok((skip, limit))
    }

    pub fn validate(&self, skip: i32, limit: i32) -> Result<(), AppError> {
        if skip < 0 {
            Err(AppError::Validation(
                "pagination skip must be greater than or equal to 0".to_string(),
            ))
        } else if limit <= 0 {
            Err(AppError::Validation(
                "pagination limit must be greater than 0".to_string(),
            ))
        } else if limit > self.max_page_size {
            Err(AppError::Validation(format!(
                "pagination limit {} exceeds maximum page size {}",
                limit, self.max_page_size
            )))
        } else {
            Ok(())
        }
    }
}

fn env_i32(name: &str, default: i32, min: i32) -> i32 {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse::<i32>().ok())
        .filter(|value| *value >= min)
        .unwrap_or(default)
}

/// A fully-resolved plan for a provider-backed query, carrying both the
/// product's typed representation of each clause and its provider-ready
/// JSON form.
#[derive(Clone, Debug, PartialEq)]
pub struct ProviderQueryPlan<E, Selection, Filter, Sort, AccessFilter> {
    pub entity_type: E,
    pub selection: Selection,
    pub filter: Option<Filter>,
    pub access_filter: Option<AccessFilter>,
    pub sort: Sort,
    pub pagination: Pagination,
    selection_json: serde_json::Value,
    filter_json: Option<serde_json::Value>,
    sort_json: Option<serde_json::Value>,
    access_filter_json: Option<serde_json::Value>,
}

impl<E, Selection, Filter, Sort, AccessFilter>
    ProviderQueryPlan<E, Selection, Filter, Sort, AccessFilter>
{
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        entity_type: E,
        selection: Selection,
        filter: Option<Filter>,
        access_filter: Option<AccessFilter>,
        sort: Sort,
        pagination: Pagination,
        selection_json: serde_json::Value,
        filter_json: Option<serde_json::Value>,
        sort_json: Option<serde_json::Value>,
        access_filter_json: Option<serde_json::Value>,
    ) -> Self {
        Self {
            entity_type,
            selection,
            filter,
            access_filter,
            sort,
            pagination,
            selection_json,
            filter_json,
            sort_json,
            access_filter_json,
        }
    }

    pub fn selection_json(&self) -> serde_json::Value {
        self.selection_json.clone()
    }

    pub fn filter_json(&self) -> Option<serde_json::Value> {
        self.filter_json.clone()
    }

    pub fn sort_json(&self) -> Option<serde_json::Value> {
        self.sort_json.clone()
    }

    pub fn access_filter_json(&self) -> Option<serde_json::Value> {
        self.access_filter_json.clone()
    }
}

/// A fully-resolved plan for a provider-backed aggregate query.
#[derive(Clone, Debug, PartialEq)]
pub struct ProviderAggregatePlan<E, Filter, AccessFilter, GroupBy, Metric, Having, Sort> {
    pub entity_type: E,
    pub filter: Option<Filter>,
    pub access_filter: Option<AccessFilter>,
    pub group_by: Vec<GroupBy>,
    pub metrics: Vec<Metric>,
    pub having: Option<Having>,
    pub sort: Sort,
    pub pagination: Pagination,
    filter_json: Option<serde_json::Value>,
    access_filter_json: Option<serde_json::Value>,
}

impl<E, Filter, AccessFilter, GroupBy, Metric, Having, Sort>
    ProviderAggregatePlan<E, Filter, AccessFilter, GroupBy, Metric, Having, Sort>
{
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        entity_type: E,
        filter: Option<Filter>,
        access_filter: Option<AccessFilter>,
        group_by: Vec<GroupBy>,
        metrics: Vec<Metric>,
        having: Option<Having>,
        sort: Sort,
        pagination: Pagination,
        filter_json: Option<serde_json::Value>,
        access_filter_json: Option<serde_json::Value>,
    ) -> Self {
        Self {
            entity_type,
            filter,
            access_filter,
            group_by,
            metrics,
            having,
            sort,
            pagination,
            filter_json,
            access_filter_json,
        }
    }

    #[allow(dead_code)] // mirrors ProviderQueryPlan's accessor; no aggregate caller reads it back yet
    pub fn filter_json(&self) -> Option<serde_json::Value> {
        self.filter_json.clone()
    }

    #[allow(dead_code)]
    pub fn access_filter_json(&self) -> Option<serde_json::Value> {
        self.access_filter_json.clone()
    }
}

/// The kind of mutation a `ProviderMutationPlan` represents.
#[derive(Clone, Debug, PartialEq)]
pub enum MutationKind {
    Create,
    Update {
        read_version: Option<serde_json::Value>,
    },
    Delete {
        read_version: Option<serde_json::Value>,
    },
}

/// A fully-resolved plan for a provider-backed mutation.
#[derive(Clone, Debug, PartialEq)]
pub struct ProviderMutationPlan<E> {
    pub kind: MutationKind,
    pub entity: E,
    pub selection: serde_json::Value,
    pub input: JsonObj,
    pub access_filter: Option<serde_json::Value>,
}

impl<E> ProviderMutationPlan<E> {
    pub fn new(
        kind: MutationKind,
        entity: E,
        selection: serde_json::Value,
        input: JsonObj,
        access_filter: Option<serde_json::Value>,
    ) -> Self {
        Self {
            kind,
            entity,
            selection,
            input,
            access_filter,
        }
    }

    pub fn selection_json(&self) -> serde_json::Value {
        self.selection.clone()
    }

    pub fn access_filter_json(&self) -> Option<serde_json::Value> {
        self.access_filter.clone()
    }

    pub fn read_version(&self) -> Option<serde_json::Value> {
        match &self.kind {
            MutationKind::Create => None,
            MutationKind::Update { read_version } | MutationKind::Delete { read_version } => {
                read_version.clone()
            }
        }
    }
}

pub(crate) type JsonObj = serde_json::Map<String, serde_json::Value>;

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Map};

    #[test]
    fn pagination_policy_applies_defaults_and_maximums() {
        let policy = PaginationPolicy {
            default_page_size: 25,
            max_page_size: 100,
        };

        assert_eq!(policy.normalize(None, None).expect("defaults"), (0, 25));
        assert_eq!(
            policy
                .normalize(Some(5), Some(50))
                .expect("explicit pagination"),
            (5, 50)
        );
        assert!(policy.normalize(Some(-1), Some(10)).is_err());
        assert!(policy.normalize(Some(0), Some(101)).is_err());
    }

    #[test]
    fn pagination_strategy_tracks_offset_and_keyset_modes() {
        let offset = Pagination {
            skip: 5,
            limit: 25,
            strategy: PaginationStrategy::Offset,
        };
        assert!(!offset.is_keyset());
        assert_eq!(offset.cursor_after(), None);

        let keyset = Pagination {
            skip: 0,
            limit: 25,
            strategy: PaginationStrategy::Keyset {
                after: Some("cursor".to_string()),
            },
        };
        assert!(keyset.is_keyset());
        assert_eq!(keyset.cursor_after(), Some("cursor".to_string()));
    }

    #[test]
    fn query_plan_preserves_provider_ready_json() {
        let plan = ProviderQueryPlan::new(
            "Account",
            "selection-ast",
            Some("filter-ast"),
            Some("access-filter-ast"),
            "sort-ast",
            Pagination::new(5, 25).expect("valid pagination"),
            json!({ "name": "accounts", "selection_set": [] }),
            Some(json!({ "name": { "_eq": "Acme" } })),
            Some(json!([{ "field": "name", "direction": "asc" }])),
            Some(json!({ "tenant_id": { "_eq": "tenant-1" } })),
        );

        assert_eq!(plan.entity_type, "Account");
        assert_eq!(plan.selection, "selection-ast");
        assert_eq!(plan.filter, Some("filter-ast"));
        assert_eq!(plan.access_filter, Some("access-filter-ast"));
        assert_eq!(plan.sort, "sort-ast");
        assert_eq!(plan.pagination.skip, 5);
        assert_eq!(plan.pagination.limit, 25);
        assert_eq!(
            plan.selection_json(),
            json!({ "name": "accounts", "selection_set": [] })
        );
        assert_eq!(
            plan.filter_json(),
            Some(json!({ "name": { "_eq": "Acme" } }))
        );
        assert_eq!(
            plan.sort_json(),
            Some(json!([{ "field": "name", "direction": "asc" }]))
        );
        assert_eq!(
            plan.access_filter_json(),
            Some(json!({ "tenant_id": { "_eq": "tenant-1" } }))
        );
    }

    #[test]
    fn aggregate_plan_preserves_provider_ready_json() {
        let plan = ProviderAggregatePlan::new(
            "Account",
            Some("filter-ast"),
            Some("access-filter-ast"),
            vec!["group-by-industry"],
            vec!["metric-count"],
            Some("having-ast"),
            "sort-ast",
            Pagination::new(0, 10).expect("valid pagination"),
            Some(json!({ "is_active": { "_eq": true } })),
            Some(json!({ "tenant_id": { "_eq": "tenant-1" } })),
        );

        assert_eq!(plan.entity_type, "Account");
        assert_eq!(plan.filter, Some("filter-ast"));
        assert_eq!(plan.access_filter, Some("access-filter-ast"));
        assert_eq!(plan.group_by, vec!["group-by-industry"]);
        assert_eq!(plan.metrics, vec!["metric-count"]);
        assert_eq!(plan.having, Some("having-ast"));
        assert_eq!(plan.sort, "sort-ast");
        assert_eq!(plan.pagination.skip, 0);
        assert_eq!(plan.pagination.limit, 10);
        assert_eq!(
            plan.filter_json(),
            Some(json!({ "is_active": { "_eq": true } }))
        );
        assert_eq!(
            plan.access_filter_json(),
            Some(json!({ "tenant_id": { "_eq": "tenant-1" } }))
        );
    }

    #[test]
    fn mutation_plan_preserves_provider_ready_json() {
        let input = Map::from_iter([("id".to_string(), json!("account-1"))]);
        let plan = ProviderMutationPlan::new(
            MutationKind::Update {
                read_version: Some(json!(7)),
            },
            "Account",
            json!({ "name": "accounts", "selection_set": [] }),
            input.clone(),
            Some(json!({ "tenant_id": { "_eq": "tenant-1" } })),
        );

        assert_eq!(plan.entity, "Account");
        assert_eq!(
            plan.selection_json(),
            json!({ "name": "accounts", "selection_set": [] })
        );
        assert_eq!(plan.input, input);
        assert_eq!(
            plan.access_filter_json(),
            Some(json!({ "tenant_id": { "_eq": "tenant-1" } }))
        );
        assert_eq!(plan.read_version(), Some(json!(7)));
    }
}
