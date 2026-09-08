//! Data-access layer: the `DataAccess` facade, the `DatabaseClient` trait and
//! its Postgres implementation, the query IR and its validation, provider
//! plan/identity types, record rules (computed/validation/version), the
//! hash-chained audit event, and the read/mutation orchestration pipelines.

pub use appfw_runtime::record_audit as audit;

pub(crate) mod audit_event;

pub(crate) mod data_access;

pub(crate) mod clients;

pub(crate) mod query_ir;

pub(crate) mod query_ir_validation;

pub(crate) mod provider_identity;

pub(crate) mod provider_plan;

pub(crate) mod rules;

pub(crate) mod read_orchestration;

pub(crate) mod mutation_orchestration;
