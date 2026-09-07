//! The two pagination strategies a provider plan can carry: classic
//! offset/limit, or a signed keyset cursor. Ported near-verbatim off
//! `appfw_runtime::query_ir`'s `RuntimePagination`/`RuntimePaginationStrategy`
//! (backend framework replacement phase 7, slice 4 --
//! docs/architecture/self-owned-backend-plan.md).
//!
//! Scoped to just these two types: `RuntimeKeysetCursor`/
//! `RuntimeSortDirection` and the rest of the framework's `query_ir` module
//! (cursor signing/verification, filter-AST-to-SQL-plan translation) are
//! NOT ported here -- `data/keyset_cursor.rs` already has its own
//! self-owned keyset cursor signing (phase 5), and `data/query_ir.rs`
//! already has its own self-owned `FilterAst`/plan translation (also
//! phase 5). This module covers only the plain data shape `data_access.rs`
//! converts its own `Pagination`/`PaginationStrategy` into on the way to a
//! provider plan.

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RuntimePagination {
    pub skip: i32,
    pub limit: i32,
    pub strategy: RuntimePaginationStrategy,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RuntimePaginationStrategy {
    Offset,
    Keyset { after: Option<String> },
}

// Bridge into the framework's still-live `appfw_runtime::query_ir::
// RuntimePagination` (consumed by `pagination_diagnostic`, part of the
// admin diagnose_query path deferred to slice 5) -- identical shape,
// genuinely distinct types.
impl From<RuntimePagination> for appfw_runtime::query_ir::RuntimePagination {
    fn from(pagination: RuntimePagination) -> Self {
        Self {
            skip: pagination.skip,
            limit: pagination.limit,
            strategy: match pagination.strategy {
                RuntimePaginationStrategy::Offset => {
                    appfw_runtime::query_ir::RuntimePaginationStrategy::Offset
                }
                RuntimePaginationStrategy::Keyset { after } => {
                    appfw_runtime::query_ir::RuntimePaginationStrategy::Keyset { after }
                }
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn offset_and_keyset_strategies_are_distinct() {
        let offset = RuntimePagination {
            skip: 0,
            limit: 25,
            strategy: RuntimePaginationStrategy::Offset,
        };
        let keyset = RuntimePagination {
            skip: 0,
            limit: 25,
            strategy: RuntimePaginationStrategy::Keyset {
                after: Some("cursor-token".to_string()),
            },
        };
        assert_ne!(offset, keyset);
        assert_eq!(
            keyset.strategy,
            RuntimePaginationStrategy::Keyset {
                after: Some("cursor-token".to_string())
            }
        );
    }
}
