//! Provider certification/capability data surfaced on the admin schema
//! health panel. Ported off `appfw_runtime::provider_capabilities` +
//! `appfw_runtime::provider_contract_types` (backend framework replacement
//! phase 7, slice 6.3).
//!
//! Scoped down hard from the framework's version: `provider_capabilities.rs`
//! there is 2,185 lines carrying a full certification matrix for five
//! database providers (Postgres/Mongo/MSSQL/FabricSqlAnalytics/Snowflake)
//! plus graph-read (Neo4j) and SaaS (ServiceNow/Workday/Icims/Salesforce/
//! Anaplan/OracleFinancials) profiles. This product only ever configures a
//! `PostgreSQL` data source -- confirmed directly:
//! `backend/config/generated/data_sources.yaml` has exactly one
//! `data_source_type: PostgreSQL` entry, and `backend/Cargo.toml`'s
//! `default = ["http", "provider-postgres"]` never enables another provider
//! feature -- so only the Postgres certification matrix
//! (`semantic_profile(FrameworkProvider::Postgres)` in the framework) is
//! ported here. The graph-read/SaaS profile types and the other four
//! database providers' matrices are dropped entirely rather than ported
//! unused. Same scoping precedent as the mcp/kafka/sync deletion and phase
//! 6's CRM-specific-hardcoding drop (see `platform::routing`'s doc comment
//! and `docs/architecture/self-owned-backend-plan.md`'s Phase 7 section).
//!
//! `ExecutableContract`/`EXECUTABLE_CONTRACTS` (the framework's registry of
//! which test names certify which contract area) is also dropped: nothing
//! in `admin_provider_capabilities_for_provider`'s call chain reads it --
//! only the per-area `status`/`reason`/`evidence` on each `ProviderCapability`
//! ever reaches the admin JSON response.
//!
//! **The `status`/`evidence` values are NOT a verbatim port**, despite an
//! earlier draft of this file claiming they were -- checked directly, and
//! that claim was wrong. The framework's evidence citations name specific
//! test functions in ITS OWN test suite: `data::clients::contract_tests::*`
//! and `data::query_ir::tests::*` (`appfw_runtime`'s own crate-relative unit
//! tests) and `provider_contracts::*`/`provider_semantic_contracts::*`
//! (test modules in the framework's OWN `api_tests` crate --
//! `app-framework/api_tests/src/{provider_contracts,
//! provider_semantic_contracts}.rs`). This product's own `api_tests` crate
//! was decoupled from the framework's test harness in slice 7, but those
//! two contract-test files were never copied into it (`find api_tests/src`
//! confirms this), and `backend/src` has no `data::clients::contract_tests`
//! or `data::query_ir::tests::aggregate_plan_parses_...` module at all. A
//! literal port would have cited ten test names that do not exist anywhere
//! in this repository -- fabricated evidence in an admin diagnostics panel,
//! not a faithful port. Fixed by checking every citation against this
//! product's real test suite (`grep -rl <test-name> backend api_tests`):
//! three had a genuine same-name equivalent at a different (real) path here
//! -- `redaction_replaces_sensitive_properties_before_diffing` and
//! `continue_record_chain_is_a_true_no_op` in `data::audit_event::tests`,
//! and `stored_procedure_call_quotes_identifiers_and_placeholders` in
//! `data::clients::postgres::routine_sql::tests` -- kept, with the path
//! corrected to where they actually live. The other ten had no equivalent;
//! rather than invent one, those areas are downgraded from
//! `CapabilityStatus::LiveCertified` (a specific, checkable claim this repo
//! cannot back) to `CapabilityStatus::Implemented` with an honest reason
//! string and an empty evidence list -- the capability is still believed to
//! work (this product exercises these code paths in its own integration
//! tests under different names), just not backed by a named-test citation
//! the way the framework's original panel implied.

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ProviderContractArea {
    ScalarFilters,
    RelationshipFiltering,
    Sorting,
    Pagination,
    NativeProjection,
    RelationshipProjection,
    ManyToManyProjection,
    ManyToManyMutation,
    ManyToManyFiltering,
    Aggregation,
    AggregateFilters,
    PreparedStatementExecution,
    StoredRoutineInvocation,
    AccessFilters,
    TenantIsolation,
    ErrorNormalization,
    Concurrency,
    Audit,
}

impl ProviderContractArea {
    pub fn label(self) -> &'static str {
        match self {
            ProviderContractArea::ScalarFilters => "scalar filters",
            ProviderContractArea::RelationshipFiltering => "relationship filtering",
            ProviderContractArea::Sorting => "sorting",
            ProviderContractArea::Pagination => "pagination",
            ProviderContractArea::NativeProjection => "native projection",
            ProviderContractArea::RelationshipProjection => "relationship projection",
            ProviderContractArea::ManyToManyProjection => "many-to-many projection",
            ProviderContractArea::ManyToManyMutation => "many-to-many mutation",
            ProviderContractArea::ManyToManyFiltering => "many-to-many filtering",
            ProviderContractArea::Aggregation => "aggregation",
            ProviderContractArea::AggregateFilters => "aggregate filters",
            ProviderContractArea::PreparedStatementExecution => "prepared statement execution",
            ProviderContractArea::StoredRoutineInvocation => "stored routine invocation",
            ProviderContractArea::AccessFilters => "access filters",
            ProviderContractArea::TenantIsolation => "tenant isolation",
            ProviderContractArea::ErrorNormalization => "error normalization",
            ProviderContractArea::Concurrency => "concurrency",
            ProviderContractArea::Audit => "audit",
        }
    }

    pub fn key(self) -> &'static str {
        match self {
            ProviderContractArea::ScalarFilters => "scalar_filters",
            ProviderContractArea::RelationshipFiltering => "relationship_filtering",
            ProviderContractArea::Sorting => "sorting",
            ProviderContractArea::Pagination => "pagination",
            ProviderContractArea::NativeProjection => "native_projection",
            ProviderContractArea::RelationshipProjection => "relationship_projection",
            ProviderContractArea::ManyToManyProjection => "many_to_many_projection",
            ProviderContractArea::ManyToManyMutation => "many_to_many_mutation",
            ProviderContractArea::ManyToManyFiltering => "many_to_many_filtering",
            ProviderContractArea::Aggregation => "aggregation",
            ProviderContractArea::AggregateFilters => "aggregate_filters",
            ProviderContractArea::PreparedStatementExecution => "prepared_statement_execution",
            ProviderContractArea::StoredRoutineInvocation => "stored_routine_invocation",
            ProviderContractArea::AccessFilters => "access_filters",
            ProviderContractArea::TenantIsolation => "tenant_isolation",
            ProviderContractArea::ErrorNormalization => "error_normalization",
            ProviderContractArea::Concurrency => "concurrency",
            ProviderContractArea::Audit => "audit",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CapabilityStatus {
    Implemented(&'static str),
    LiveCertified,
    Partial(&'static str),
    Unsupported(&'static str),
}

impl CapabilityStatus {
    pub fn reason(self) -> Option<&'static str> {
        match self {
            CapabilityStatus::Implemented(reason)
            | CapabilityStatus::Partial(reason)
            | CapabilityStatus::Unsupported(reason) => Some(reason),
            CapabilityStatus::LiveCertified => None,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            CapabilityStatus::Implemented(_) => "implemented",
            CapabilityStatus::LiveCertified => "live-certified",
            CapabilityStatus::Partial(_) => "partial",
            CapabilityStatus::Unsupported(_) => "unsupported",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CertificationEvidence {
    CompilerContract(&'static str),
    LiveContract(&'static str),
}

impl CertificationEvidence {
    pub fn contract(self) -> &'static str {
        match self {
            CertificationEvidence::CompilerContract(contract)
            | CertificationEvidence::LiveContract(contract) => contract,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            CertificationEvidence::CompilerContract(_) => "compiler-contract",
            CertificationEvidence::LiveContract(_) => "live-contract",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ProviderCapability {
    pub area: ProviderContractArea,
    pub status: CapabilityStatus,
    pub evidence: &'static [CertificationEvidence],
}

// The only three evidence citations that survive this port: real test
// functions that exist in THIS product's own test suite (confirmed via
// `grep -rn` on the exact function name), with their actual current path,
// not the framework's. See this file's doc comment for why the other ten
// framework citations were not carried over.
const AUDIT_REDACTION_TEST: &str =
    "data::audit_event::tests::redaction_replaces_sensitive_properties_before_diffing";
const AUDIT_CHAIN_TEST: &str = "data::audit_event::tests::continue_record_chain_is_a_true_no_op";
const POSTGRES_STORED_ROUTINE_TEST: &str =
    "data::clients::postgres::routine_sql::tests::stored_procedure_call_quotes_identifiers_and_placeholders";

const AUDIT_EVIDENCE: &[CertificationEvidence] = &[
    CertificationEvidence::CompilerContract(AUDIT_REDACTION_TEST),
    CertificationEvidence::CompilerContract(AUDIT_CHAIN_TEST),
];
const POSTGRES_STORED_ROUTINE_EVIDENCE: &[CertificationEvidence] = &[
    CertificationEvidence::CompilerContract(POSTGRES_STORED_ROUTINE_TEST),
];

const NO_LIVE_CONTRACT_IN_THIS_PRODUCT: &str = "implemented against PostgreSQL and exercised by this product's own integration tests, but the framework's own named live-certification test for this area was never reproduced in this product's test suite -- see provider_capabilities.rs's doc comment";

const fn implemented(
    area: ProviderContractArea,
    reason: &'static str,
    evidence: &'static [CertificationEvidence],
) -> ProviderCapability {
    ProviderCapability {
        area,
        status: CapabilityStatus::Implemented(reason),
        evidence,
    }
}

// `live_certified()` (a constructor for `CapabilityStatus::LiveCertified`)
// was removed: nothing in this file can back that specific claim honestly
// any more (see the doc comment above) -- every capability that would have
// used it now goes through `implemented()` instead. The `LiveCertified`
// variant itself stays in `CapabilityStatus` since it's part of the public
// shape this admin panel's JSON contract exposes, in case a future slice
// reproduces real live-certification tests in this product's own suite.

const fn partial(
    area: ProviderContractArea,
    reason: &'static str,
    evidence: &'static [CertificationEvidence],
) -> ProviderCapability {
    ProviderCapability {
        area,
        status: CapabilityStatus::Partial(reason),
        evidence,
    }
}

const fn unsupported(
    area: ProviderContractArea,
    reason: &'static str,
    evidence: &'static [CertificationEvidence],
) -> ProviderCapability {
    ProviderCapability {
        area,
        status: CapabilityStatus::Unsupported(reason),
        evidence,
    }
}

/// Scoped to Postgres, matching the framework's `POSTGRES_CAPABILITIES`
/// (`appfw_runtime::provider_capabilities`) on which areas are covered and
/// at what level (implemented/partial/unsupported) -- but NOT a verbatim
/// port of `status`/`evidence` for most areas: see this file's doc comment
/// for why ten `LiveCertified` claims were downgraded to `Implemented` with
/// an honest reason instead of citing a test that doesn't exist here.
const POSTGRES_CAPABILITIES: [ProviderCapability; 18] = [
    implemented(
        ProviderContractArea::ScalarFilters,
        NO_LIVE_CONTRACT_IN_THIS_PRODUCT,
        &[],
    ),
    implemented(
        ProviderContractArea::RelationshipFiltering,
        NO_LIVE_CONTRACT_IN_THIS_PRODUCT,
        &[],
    ),
    implemented(
        ProviderContractArea::Sorting,
        NO_LIVE_CONTRACT_IN_THIS_PRODUCT,
        &[],
    ),
    implemented(
        ProviderContractArea::Pagination,
        NO_LIVE_CONTRACT_IN_THIS_PRODUCT,
        &[],
    ),
    implemented(
        ProviderContractArea::NativeProjection,
        NO_LIVE_CONTRACT_IN_THIS_PRODUCT,
        &[],
    ),
    implemented(
        ProviderContractArea::RelationshipProjection,
        NO_LIVE_CONTRACT_IN_THIS_PRODUCT,
        &[],
    ),
    implemented(
        ProviderContractArea::ManyToManyProjection,
        NO_LIVE_CONTRACT_IN_THIS_PRODUCT,
        &[],
    ),
    partial(
        ProviderContractArea::ManyToManyMutation,
        "provider mutation helpers exist; generated GraphQL many-to-many input still needs typed target-key parity",
        &[],
    ),
    unsupported(
        ProviderContractArea::ManyToManyFiltering,
        "relationship filtering through junction tables is not implemented",
        &[],
    ),
    implemented(
        ProviderContractArea::Aggregation,
        NO_LIVE_CONTRACT_IN_THIS_PRODUCT,
        &[],
    ),
    implemented(
        ProviderContractArea::AggregateFilters,
        NO_LIVE_CONTRACT_IN_THIS_PRODUCT,
        &[],
    ),
    implemented(
        ProviderContractArea::PreparedStatementExecution,
        "appfw-provider-postgres exposes cached prepared query/execute helpers; stored routine live certification is tracked separately",
        &[],
    ),
    implemented(
        ProviderContractArea::StoredRoutineInvocation,
        "quoting/placeholder generation for stored-procedure calls is unit-tested in this product",
        POSTGRES_STORED_ROUTINE_EVIDENCE,
    ),
    implemented(
        ProviderContractArea::AccessFilters,
        NO_LIVE_CONTRACT_IN_THIS_PRODUCT,
        &[],
    ),
    implemented(
        ProviderContractArea::TenantIsolation,
        NO_LIVE_CONTRACT_IN_THIS_PRODUCT,
        &[],
    ),
    implemented(
        ProviderContractArea::ErrorNormalization,
        NO_LIVE_CONTRACT_IN_THIS_PRODUCT,
        &[],
    ),
    implemented(
        ProviderContractArea::Concurrency,
        NO_LIVE_CONTRACT_IN_THIS_PRODUCT,
        &[],
    ),
    implemented(
        ProviderContractArea::Audit,
        "redaction and chain-continuation behavior are unit-tested in this product",
        AUDIT_EVIDENCE,
    ),
];

/// The Postgres certification matrix, in framework declaration order.
///
/// Only `FrameworkProvider::Postgres` has a matrix at all in this product --
/// see this module's doc comment. Every other provider is handled by the
/// caller (`admin_provider_capabilities_for_provider`) without reaching this
/// function.
pub fn postgres_capabilities() -> &'static [ProviderCapability] {
    &POSTGRES_CAPABILITIES
}
