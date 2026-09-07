//! Single chokepoint for the framework runtime crate (backend framework
//! replacement phase 7, slice 1 -- docs/architecture/self-owned-backend-plan.md).
//!
//! Every other file in `backend/src` that still needs a type or function
//! from `appfw_runtime` reaches it through this module (`crate::platform::
//! runtime::...`) instead of naming the crate directly. This is a purely
//! mechanical rewiring -- no behavior change, and `appfw_runtime` itself is
//! still the real implementation underneath every re-exported name here.
//! The point is git-diff visibility during the port: `grep -rl
//! "appfw_runtime" backend/src --include='*.rs'` now returns exactly this
//! file, so later slices can see their own progress by watching this
//! module shrink (an item moves from `pub use appfw_runtime::Foo;` to a
//! self-owned `pub use crate::platform::foo::Foo;` line) instead of
//! grepping 45 files for a moving target.
//!
//! `backend/Cargo.toml` still declares the real `appfw_runtime` path
//! dependency -- this module doesn't remove it, later slices do, ending
//! with slice 8's final cutover once every re-export below has been
//! replaced by self-owned code.

#![allow(unused_imports)]
#![allow(ambiguous_glob_reexports)]

pub use appfw_runtime::*;

// --- self-owned overrides ---------------------------------------------
//
// Each of these shadows the framework re-export above with a self-owned
// implementation (a Rust explicit `use` always wins over a glob import of
// the same name, so these lines are the only edit needed per symbol -- no
// call site elsewhere in `backend/src` changes). Move a name down here as
// each slice of docs/architecture/self-owned-backend-plan.md's Phase 7
// lands; when this list covers everything the glob above brings in, the
// glob itself -- and the `appfw_runtime` Cargo dependency -- comes out in
// slice 8.

// Slice 2 (leaf error/id types):
pub use crate::platform::errors::{
    ConfigError, DataStoreError, MetadataError, QueryBuildError, RuntimeAppError, RuntimeError,
};
//
// `provider_keys::FrameworkProvider`/`provider_error` were written here in
// slice 2 but held back at the time -- `RuntimeProviderIdentity::
// framework_provider(&self)` has a fixed return type, and
// `DatabaseClientRuntimeAdapter`/`PostgresClient` both implement that
// trait directly. See the slice 5 section below for where they actually
// get overridden, once `pool_stats` proved the fix.

// Slice 3 (auth/security -- partial):
//
// Every real call site reaches this through the submodule path
// (`crate::platform::runtime::security::SecurityConfig`, mirroring
// `appfw_runtime::security::SecurityConfig`), not the crate-root path --
// confirmed directly (`grep -rn "runtime::security::" backend/src`, 6
// hits, all `SecurityConfig`, nothing else from that submodule). So the
// override has to shadow the *module name* `security` itself, not a
// top-level re-export of the type; a top-level `pub use ...SecurityConfig`
// here would compile (Rust wouldn't complain) but silently do nothing,
// since it doesn't affect what `runtime::security::` resolves to.
pub mod security {
    pub use crate::platform::security_config::SecurityConfig;
}
//
// `AccessAction`/`PolicyAccess`/`UserAuth`/`RuntimePrincipalType`: the
// JWT-boundary bridges above are gone now that `RuntimeJwtExtractor` holds
// the self-owned `UserAuth` directly, and `DatabaseClientRuntimeAdapter`
// (the other thing that fixed these to framework types) was deleted in
// slice 5 -- so these four are safe to override too. `product_api.rs`'s
// bidirectional bridge `impl From<...>` blocks for all four were deleted
// at the same time this override landed (they'd otherwise become
// self-referential, conflicting with std's blanket `impl<T> From<T> for
// T`).
pub use crate::platform::policy::{AccessAction, PolicyAccess};
pub use crate::platform::user_auth::{RuntimePrincipalType, UserAuth};
pub mod extension {
    pub use crate::platform::user_auth::{RuntimePrincipalType, UserAuth};
}
//
// `RuntimeJwtExtractor`/`RuntimeHandlerContext`/`user_from_graphql_context`/
// `data_from_graphql_context` ARE overridden below: unlike `PolicyAccess`/
// `UserAuth` themselves, these are plain generic context-extension
// plumbing with no framework machinery and no fixed trait signature
// pinning them -- porting them (holding the self-owned `UserAuth`
// directly instead of the framework's) eliminates the `UserAuth::from`
// bridge at the JWT boundary entirely, not just relocates it. See
// `platform::graphql_context`'s own doc comment for the full reasoning.
// This does NOT touch real JWT/Okta verification, already self-owned in
// `platform::auth` since phase 4b-4.
pub use crate::platform::graphql_context::{
    data_from_graphql_context, user_from_graphql_context, RuntimeHandlerContext,
    RuntimeJwtExtractor,
};
//
// `RuntimeAuthState` alone is NOT overridden: `admin_ui.rs`'s
// `AdminRuntimeState` trait (framework-fixed, part of slice 6's admin.rs
// entanglement) requires it by that exact type.

// Slice 4 (query IR: filters, pagination, cost):
//
// `QueryCost`/`QueryCostBudget` are reached at the crate-root path
// (confirmed: `grep -n "runtime::QueryCost" backend/src`), but
// `data/query_ir.rs` (already self-owned, phase 5) reaches the other cost
// types through the `query_cost::` submodule path -- both need shadowing,
// same lesson as `security` above: check the exact path depth real
// callers use, don't assume a top-level override is enough.
pub use crate::platform::query_cost::{QueryCost, QueryCostBudget};
pub mod query_cost {
    pub use crate::platform::query_cost::{
        RuntimeAggregateCostInput, RuntimeFilterCostNode, RuntimeQueryCostInput,
        RuntimeRelationKind, RuntimeSelectionCostNode, RuntimeSelectionCostTree,
    };
}
pub use crate::platform::query_filter::RuntimeFilterOp;
pub mod query_filter {
    pub use crate::platform::query_filter::{
        conjunction_token, filter_token, normalize_filter_input, value_kind, RuntimeFilterObject,
        RuntimeFilterOp,
    };
}
//
// `query_ir` is shadowed only for the two pagination types real call sites
// use from that path (`RuntimePagination`/`RuntimePaginationStrategy`,
// confirmed via `grep -rn "runtime::query_ir::" backend/src` -- nothing
// else from that submodule is referenced). The framework's actual
// `query_ir` module (cursor signing, filter-AST-to-SQL-plan translation)
// is NOT ported -- `data/keyset_cursor.rs` and `data/query_ir.rs` already
// have their own self-owned equivalents from phase 5.
pub mod query_ir {
    pub use crate::platform::query_pagination::{RuntimePagination, RuntimePaginationStrategy};
}
pub(crate) use crate::platform::provider_time_period;
//
// The framework's filter-*capabilities* reporting API
// (`RuntimeFilterCapabilities` and friends, still reached via the glob
// above) is deliberately left framework-owned: its only consumer,
// `admin_ui.rs`, is itself still framework-owned pending slice 6.

// Slice 5 (provider contract -- leaf data types):
//
// `RuntimeJsonObj` is a type alias for `serde_json::Map<String, Value>`,
// not a distinct struct, so re-declaring it creates no new type and needs
// no override at all -- appfw_runtime::RuntimeJsonObj and this crate's own
// already name the same underlying type. Not listed below for that reason.
pub use crate::platform::provider_request::RuntimeProviderPlanInput;
pub use crate::platform::provider_result::{RuntimeJsonAggregateResult, RuntimeJsonQueryResult};
//
// `RuntimeProviderOperation`/`RuntimeProviderOperationCounts`: unlike the
// two above, these are NOT referenced by any *fixed* (non-default) method
// signature on `RuntimeProviderIdentity`/`RuntimeProviderDataClient` that
// `DatabaseClientRuntimeAdapter` must implement -- confirmed by reading
// the trait definition. Safe to override outright.
pub use crate::platform::provider_operation::{RuntimeProviderOperation, RuntimeProviderOperationCounts};
//
// `ProviderPoolStats` IS entangled, the same way `FrameworkProvider` is:
// `PostgresClient` implements the framework's fixed `RuntimeProviderIdentity`
// directly (not just via `DatabaseClientRuntimeAdapter`), and that impl's
// `pool_stats(&self) -> ProviderPoolStats` must return the framework's own
// type. See `postgres_client.rs`'s two side-by-side impl blocks (one for
// each trait, by design -- its own doc comment explains why) for how the
// fixed-trait block gets the framework type under an alias while
// everything else here follows this override.
pub use crate::platform::provider_pool_stats::ProviderPoolStats;
//
// `provider_keys::FrameworkProvider`/`provider_error`: unblocked now that
// `pool_stats` proved the alias-the-framework-type-for-the-fixed-block
// pattern works for `RuntimeProviderIdentity`. Same submodule-path lesson
// as `security`/`query_cost` -- both are reached via their submodule path,
// not the crate root, so both need a `pub mod` shadow, not a top-level
// `pub use`.
pub mod provider_keys {
    pub use crate::platform::provider_keys::FrameworkProvider;
}
pub mod provider_error {
    pub use crate::platform::provider_error::*;
}
//
// This makes `data/clients/database_client.rs`'s self-owned `DatabaseClient`
// trait (whose default method signatures already read these three names off
// this facade) pick up the self-owned versions automatically -- but
// `DatabaseClientRuntimeAdapter`'s impl of the *framework's* fixed
// `RuntimeProviderDataClient` trait now needs `.into()` at every forwarding
// call into `self.client` (self-owned `DatabaseClient`), both directions:
// framework-typed parameters in, self-owned-typed returns back out. See
// that impl block's own comments for the full accounting.
