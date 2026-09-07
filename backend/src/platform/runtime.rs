//! Single chokepoint for what used to be the framework runtime crate
//! (backend framework replacement phase 7 --
//! docs/architecture/self-owned-backend-plan.md). As of slice 8's final
//! cutover, this module is fully self-owned: `appfw_runtime` is no longer
//! a dependency of `backend` at all (removed from `backend/Cargo.toml` in
//! the same commit as this file's own glob re-export), and every name
//! below points at this crate's own code under `crate::platform::*`.
//!
//! Every other file in `backend/src` that needs one of these types or
//! functions still reaches it through this module
//! (`crate::platform::runtime::...`) rather than the self-owned module
//! directly -- that indirection is kept deliberately even though the
//! framework is gone, since dozens of call sites across the crate already
//! depend on this exact path shape (including the submodule-vs-crate-root
//! distinction documented slice-by-slice below) and repointing all of
//! them to their new home directly would be a large, purely cosmetic
//! diff with no behavior change. `grep -rl "appfw_runtime" backend/src
//! --include='*.rs'` now returns nothing live (comment-only historical
//! mentions aside) -- confirmed as this slice's own verification step.

#![allow(unused_imports)]

// --- self-owned overrides ---------------------------------------------
//
// Each of these used to shadow a framework re-export brought in by a
// `pub use appfw_runtime::*;` glob at the top of this file (a Rust
// explicit `use` always wins over a glob import of the same name); that
// glob is gone as of slice 8, so every name below is now the only
// definition of itself rather than a shadow. Left in place slice-by-slice
// (rather than collapsed into one flat list) since each comment still
// documents real, non-obvious facts -- which path real call sites use
// (crate-root vs submodule), which types were entangled with a
// framework-fixed trait signature, and so on.

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
// `RuntimeAuthState` was, for a while, deliberately left un-overridden:
// `admin_ui.rs`'s `AdminRuntimeState` trait (framework-fixed, part of
// slice 6's `admin` entanglement) required it by that exact type. Slice
// 6.3 ported `admin` itself and deleted `RuntimeAuthState` outright -- see
// that section below.

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
// The filter-*capabilities* reporting API (`RuntimeFilterCapabilities` and
// friends) moved to `platform::query_filter` in slice 6.3, once its only
// consumer (`admin_ui.rs`) went self-owned -- see the slice 6.3 section
// below for the override.

// Slice 5 (provider contract -- leaf data types):
//
// `RuntimeJsonObj` is a type alias for `serde_json::Map<String, Value>`,
// not a distinct struct -- while the framework glob was still present
// (through slice 8's cutover), re-declaring it here would have created no
// new type, since `appfw_runtime::RuntimeJsonObj` and this crate's own
// already named the same underlying type, so it needed no override to
// resolve correctly and was deliberately left off this list. Once the
// glob came out in slice 8, callers reaching it at the crate-root path
// (`data/clients/database_client.rs`) had nothing left to resolve to, so
// it needs an explicit re-export like everything else here after all.
pub use crate::platform::provider_result::RuntimeJsonObj;
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

// Slice 6.1 (trivial platform-plumbing leaves -- no fixed traits, no route
// entanglement):
//
// `connection_security` is reached via its submodule path
// (`runtime::connection_security::{validate, Provider, ...}`, confirmed by
// `grep -rn "runtime::connection_security::" backend/src`), so this needs a
// `pub mod` shadow, same lesson as `security`/`query_cost` above.
pub mod connection_security {
    pub use crate::platform::connection_security::*;
}
//
// `json` likewise: `data/data_access.rs` imports `runtime::json as
// json_utils`, a submodule path. `JsonObj` is `RuntimeJsonObj` under a
// different name (no new type, same as `RuntimeJsonObj` itself needed no
// override in slice 5) -- only the two conversion functions are real code.
pub mod json {
    pub use crate::platform::json_utils::*;
}
//
// `product_ui::product_ui_routes_if_present` is reached via its submodule
// path too (`runtime::product_ui::product_ui_routes_if_present`,
// `routes/mod.rs`). Self-contained axum router builder, `http`-gated same
// as the framework original.
#[cfg(feature = "http")]
pub mod product_ui {
    pub use crate::platform::product_ui::*;
}
//
// `tenant_isolation` was already self-owned from phase 5 (`platform::
// tenant_isolation`) but was never routed through this facade -- it's
// reached directly (`crate::platform::tenant_isolation::...`), not via
// `crate::platform::runtime::tenant_isolation`, so it never needed an
// override here and isn't listed above for that reason.
//
// `RuntimeHandlerContext` and friends were already overridden in slice 3's
// remainder above (see the `graphql_context` section).

// Slice 6.2 (observability + readiness/info routes -- landed as one atomic
// unit, not split across commits): `RequestContext` is stored in a
// `tokio::task_local!`, written only by `trace_context_hook`'s `.scope(...)`
// call and read only by `current_request_context()` -- porting one without
// the other compiles clean and silently makes the reader return `None`
// forever. `MetricsRegistry` is pinned by `RuntimeReadinessProbe::
// record_pool_stats(&self, metrics: &MetricsRegistry)`, a fixed method
// `routes/info.rs`'s `ProviderReadinessCheck` implements, and by
// `runtime_info_routes` building its `/metrics`/`/metrics.json` handlers
// around it internally -- so `platform::readiness` had to move in the same
// commit as `platform::metrics`, not later.
//
// Reached via the submodule path everywhere (`runtime::observability::...`,
// confirmed via `grep -rn "runtime::observability::" backend/src`), so this
// needs a `pub mod` shadow, same lesson as `security`/`query_cost`/etc.
pub mod observability {
    pub use crate::platform::metrics::MetricsRegistry;
    pub use crate::platform::request_context::{
        current_request_context, redact_diagnostic_text, redact_diagnostic_value, RequestContext,
    };
    #[cfg(feature = "http")]
    pub use crate::platform::metrics::metrics_hook;
    #[cfg(feature = "http")]
    pub use crate::platform::request_context::{
        annotate_graphql_response, graphql_error_with_context, http_make_span,
        trace_context_hook, REQUEST_ID_HEADER_NAME,
    };
}
//
// `runtime_info_routes`/`RuntimeHealthCheck`/`RuntimeReadinessProbe`/
// `RuntimeReadinessState` are reached at the crate-root path
// (`routes/info.rs`'s `crate::platform::runtime::{runtime_info_routes,
// RuntimeHealthCheck, RuntimeReadinessProbe, RuntimeReadinessState}`), not a
// submodule, so a top-level `pub use` is correct here (unlike
// `observability` above).
#[cfg(feature = "http")]
pub use crate::platform::readiness::{
    runtime_info_routes, RuntimeHealthCheck, RuntimeReadinessProbe, RuntimeReadinessState,
};
// Slice 6.3 (admin diagnostics UI backend): `admin_ui.rs` now reaches every
// `Admin*` name via `runtime::admin::` (confirmed: `grep -rn
// "runtime::admin::" backend/src` -- the only hits are `admin_ui.rs`'s own
// import list), a submodule path, so this needs a `pub mod` shadow, same
// lesson as `security`/`query_cost`/`observability` above. `RequestContext`
// inside `platform::admin_runtime` is this crate's own self-owned type
// (`platform::request_context::RequestContext`, ported slice 6.2) -- no
// bridge, `admin_ui.rs` no longer names the framework path at all.
#[cfg(feature = "http")]
pub mod admin {
    pub use crate::platform::admin_runtime::*;
}
//
// `RuntimeFilterCapabilities`/`RuntimeFilterDataTypeCapability` are reached
// at the crate-root path (`admin_ui.rs`'s `use ...RuntimeFilterCapabilities`),
// so a top-level override is correct here, unlike `admin` above.
pub use crate::platform::query_filter::{RuntimeFilterCapabilities, RuntimeFilterDataTypeCapability};
//
// Slice 8 (final surface -- backend framework replacement phase 7):
//
// `model_metadata` is reached everywhere via its submodule path
// (`runtime::model_metadata::{RuntimeDataType, RuntimeEntityMetadata,
// ...}`, confirmed via `grep -rn "runtime::model_metadata::"
// backend/src`), so this needs a `pub mod` shadow, same lesson as
// `security`/`query_cost`/`observability`/`admin` above. Ported near-
// verbatim from the framework's `model_metadata.rs` (634 lines) -- see
// `platform::model_metadata`'s own doc comment for which methods have
// live call sites in this repo versus which are kept only because
// they're part of the type's public API surface.
pub mod model_metadata {
    pub use crate::platform::model_metadata::*;
}
//
// `record_locator::RECORD_LOCATOR_FIELD` is reached via its submodule path
// too (`product_api.rs`'s `record_locator::RECORD_LOCATOR_FIELD`).
// `platform::record_locator` already existed as a fully self-owned module
// since phase 4 (it already carries this exact constant, confirmed by
// reading the file) but was never routed through this facade -- this is
// purely a shadow pointing at existing code, no new code.
pub mod record_locator {
    pub use crate::platform::record_locator::*;
}
//
// `graphiql::html` is likewise reached via its submodule path
// (`platform::graphql_gateway`'s `use crate::platform::runtime::{graphiql,
// ...}`). Ported verbatim as `platform::graphiql` -- a pure string
// template, no auth logic.
#[cfg(feature = "http")]
pub mod graphiql {
    pub use crate::platform::graphiql::*;
}
//
// `RuntimeProviderDescriptor` is NOT overridden -- it was never actually
// used as a type anywhere in `backend/src` (confirmed: `grep -rn
// "RuntimeProviderDescriptor" backend/src` finds only its own two import
// lines, in `product_api.rs` and `data/data_access.rs`; both files use
// the already-self-owned `data::provider_identity::ProviderDescriptor`
// for the real work). Both dead import lines are deleted instead of
// ported.
//
// `RuntimeProviderRegistry` is self-owned now (`platform::provider_registry`,
// ported verbatim from the framework's `provider_registry.rs`) -- reached
// at the crate-root path (`routes/mod.rs`'s `use crate::platform::runtime::
// {..., RuntimeProviderRegistry}`), so a top-level override is correct
// here, unlike `model_metadata`/`record_locator`/`graphiql` above.
// `routes/mod.rs`'s `.into()` bridge calls at its two call sites (into
// `RuntimeProviderRegistry::create`/`::register`) are removed in the same
// commit -- both were converting the self-owned `FrameworkProvider` into
// the framework's own type for a framework-owned registry that no longer
// exists.
#[cfg(feature = "http")]
pub use crate::platform::provider_registry::RuntimeProviderRegistry;
//
// `data_access` (imported by `data/data_access.rs` as `runtime_data_access`)
// is NOT overridden -- the import was dead code (confirmed: `grep -n
// "runtime_data_access::" backend/src/data/data_access.rs` returns
// nothing; the alias import itself is the only reference). Deleted
// outright rather than ported.
//
// `RuntimeAuditEvent`/`RuntimeAuditQuery` are NOT overridden -- confirmed
// by grep that `product_api.rs`'s re-export of these two names has no
// consumer anywhere in `backend/src` (`data/audit_event.rs`'s own
// `AuditEvent`/`AuditQuery` are the self-owned types every production
// call site actually uses, since phase 5). The only other reference is
// `data/audit_event.rs`'s oracle test, which names `appfw_runtime::
// RuntimeAuditEvent` directly (not through this facade) -- see that
// test's own comment for how it was retired once the `appfw_runtime`
// dependency came out entirely in this same slice. Both names are
// deleted from `product_api.rs`'s import list rather than ported.
//
// `HandlerResult<T>`/`JsonValue` are trivial aliases
// (`anyhow::Result<T>` / `serde_json::Value` respectively, confirmed
// against the framework's `lib.rs`), reached at the crate-root path
// (`product_api.rs`'s `use crate::platform::runtime::{HandlerResult,
// JsonValue, ...}`), so top-level definitions are correct here.
pub type HandlerResult<T> = anyhow::Result<T>;
pub type JsonValue = serde_json::Value;

// `RuntimeAuthState` is NOT overridden -- it is deleted outright. It only
// ever existed to satisfy `AdminRuntimeState::auth_state`'s fixed return
// type while `admin` was framework-owned; now that this crate owns that
// trait (`platform::admin_runtime::AdminRuntimeState::auth_state(&self) ->
// JwtAuthConfig`), nothing in `backend/src` constructs a `RuntimeAuthState`
// any more (confirmed: `grep -rn "RuntimeAuthState" backend/src` returns
// nothing after this slice). `platform::auth::JwtAuthConfig` -- this
// product's real JWT config, already self-owned since phase 4b-4 -- carries
// the same three values under its own field names and is threaded
// end-to-end instead (`main.rs` -> `routes::get_routes` -> `admin_ui::
// get_routes`).
