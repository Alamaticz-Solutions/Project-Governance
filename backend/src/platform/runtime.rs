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
// `provider_keys::FrameworkProvider` and `provider_error` are NOT overridden
// yet, even though self-owned equivalents exist at `platform::provider_keys`/
// `platform::provider_error` -- `appfw_runtime::provider_bridge::
// RuntimeProviderIdentity::framework_provider(&self)` has a fixed (not
// generic/associated) return type of the framework's own internal
// `FrameworkProvider`, and `DatabaseClientRuntimeAdapter` (still
// framework-owned, deferred per phase 5's notes) implements that trait.
// Shadowing the name here would make every such impl a type mismatch
// against a same-named-but-different type. Move these down once slice 5
// replaces `RuntimeProviderIdentity`/`DatabaseClientRuntimeAdapter` itself.

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
// `AccessAction`/`PolicyAccess` (already self-owned at `platform::policy`)
// and `UserAuth`/`RuntimePrincipalType` (already self-owned at
// `platform::user_auth`) are NOT overridden here, and never will be by this
// mechanism: `product_api.rs` already re-exports the self-owned versions as
// its own canonical `AccessAction`/`PolicyAccess`/`UserAuth`/
// `RuntimePrincipalType`, with explicit bidirectional `From` bridges to
// this facade's (still framework-owned) `PolicyAccess`/`extension::UserAuth`
// at the one real boundary -- where `RuntimeJwtExtractor`'s JWT extraction
// and the framework's Rego-evaluation glue still produce/consume the
// framework's own types. Overriding the names here would make those bridge
// `impl From<...>`s self-referential (a type converting into itself),
// which conflicts with std's blanket `impl<T> From<T> for T` -- a compile
// error, not a no-op. They come out once `RuntimeJwtExtractor` itself is
// replaced (the remainder of this slice).
//
// `RuntimeJwtExtractor`/`RuntimeAuthState` themselves are also not
// overridden: real JWT/Okta verification, not yet ported.

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
// This makes `data/clients/database_client.rs`'s self-owned `DatabaseClient`
// trait (whose default method signatures already read these three names off
// this facade) pick up the self-owned versions automatically -- but
// `DatabaseClientRuntimeAdapter`'s impl of the *framework's* fixed
// `RuntimeProviderDataClient` trait now needs `.into()` at every forwarding
// call into `self.client` (self-owned `DatabaseClient`), both directions:
// framework-typed parameters in, self-owned-typed returns back out. See
// that impl block's own comments for the full accounting.
