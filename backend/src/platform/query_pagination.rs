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

#[allow(dead_code)] // ported near-verbatim, tested below; see this file's header comment
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RuntimePagination {
    pub skip: i32,
    pub limit: i32,
    pub strategy: RuntimePaginationStrategy,
}

#[allow(dead_code)]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RuntimePaginationStrategy {
    Offset,
    Keyset { after: Option<String> },
}

// The bridge into the framework's `appfw_runtime::query_ir::
// RuntimePagination` that used to live here (backend framework
// replacement phase 7) is deleted as of slice 8: confirmed dead by grep
// before removal -- `data/read_orchestration.rs::pagination_diagnostic`
// (its only stated consumer) returns this crate's own self-owned
// `PaginationDiagnostic` directly, not the framework's type, and bridges
// separately into `platform::admin_runtime`'s self-owned
// `RuntimePaginationDiagnostic` for `admin_ui.rs`'s
// `AdminQueryDiagnoseProvider` impl (see that file's own comment).

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
