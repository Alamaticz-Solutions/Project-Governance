//! Mutation-path orchestration: create/update/delete execution,
//! pre-mutation validation (primary key availability, foreign key
//! existence, uniqueness), and the audit-attempt/audit-mutation append
//! helper family built on top of `crate::data::audit_event::AuditEvent`.
//!
//! This orchestration is owned by this crate and dispatches through
//! `&dyn DatabaseClient` directly rather than a dedicated generic trait. The
//! two validation functions that check foreign-key existence and uniqueness
//! forward into `provider_find_item_json` / `provider_query_items_plan_json`,
//! reusing the read-path dispatch wrappers as-is.

#![allow(dead_code)]

/// The kind of mutation being traced, purely for metrics/tracing purposes.
/// Not to be confused with `crate::data::provider_plan::MutationKind`, which
/// describes what a mutation *plan* represents.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MutationTraceKind {
    Create,
    Update,
    Delete,
}

impl MutationTraceKind {
    pub fn provider_operation(self) -> crate::platform::runtime::RuntimeProviderOperation {
        match self {
            Self::Create => crate::platform::runtime::RuntimeProviderOperation::CreateItem,
            Self::Update => crate::platform::runtime::RuntimeProviderOperation::UpdateItem,
            Self::Delete => crate::platform::runtime::RuntimeProviderOperation::DeleteItem,
        }
    }

    pub fn provider_operation_counts(
        self,
        affected_rows: i64,
    ) -> crate::platform::runtime::RuntimeProviderOperationCounts {
        match self {
            Self::Create | Self::Update => crate::platform::runtime::RuntimeProviderOperationCounts::new(1, 1),
            Self::Delete => {
                crate::platform::runtime::RuntimeProviderOperationCounts::from_affected_rows(affected_rows)
            }
        }
    }
}

/// The outcome of a delete mutation, for audit purposes.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DeleteAuditOutcome {
    Mutation,
    NotApplied,
}

/// Determine whether/how a delete mutation should be audited, given whether
/// auditing is enabled for the entity and how many rows the delete affected.
pub fn delete_audit_outcome(audit_enabled: bool, deleted_count: i64) -> Option<DeleteAuditOutcome> {
    if !audit_enabled {
        None
    } else if deleted_count > 0 {
        Some(DeleteAuditOutcome::Mutation)
    } else {
        Some(DeleteAuditOutcome::NotApplied)
    }
}

/// Fail closed unless the provider declares support for `operation`.
///
/// Duplicated from `read_orchestration.rs` -- small enough not to share
/// cross-module.
fn ensure_provider_operation(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    operation: crate::platform::runtime::RuntimeProviderOperation,
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

pub async fn provider_create_item_plan_json(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    input: crate::platform::runtime::RuntimeProviderPlanInput<
        '_,
        crate::data::clients::database_client::ProviderMutationPlan,
    >,
) -> Result<crate::data::provider_plan::JsonObj, crate::routes::app_error::AppError> {
    ensure_provider_operation(
        provider,
        crate::platform::runtime::RuntimeProviderOperation::CreateItem,
    )?;
    provider.create_item_plan_json(input).await
}

pub async fn provider_update_item_plan_json(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    input: crate::platform::runtime::RuntimeProviderPlanInput<
        '_,
        crate::data::clients::database_client::ProviderMutationPlan,
    >,
) -> Result<crate::data::provider_plan::JsonObj, crate::routes::app_error::AppError> {
    ensure_provider_operation(
        provider,
        crate::platform::runtime::RuntimeProviderOperation::UpdateItem,
    )?;
    provider.update_item_plan_json(input).await
}

pub async fn provider_delete_item_plan_json(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    input: crate::platform::runtime::RuntimeProviderPlanInput<
        '_,
        crate::data::clients::database_client::ProviderMutationPlan,
    >,
) -> Result<i64, crate::routes::app_error::AppError> {
    ensure_provider_operation(
        provider,
        crate::platform::runtime::RuntimeProviderOperation::DeleteItem,
    )?;
    provider.delete_item_plan_json(input).await
}

/// Generic mutation executor: call the provider, trace the operation, and
/// return the result.
pub async fn execute_mutation<R, E, Fut>(
    kind: MutationTraceKind,
    provider_call: impl FnOnce() -> Fut,
    affected_rows: impl FnOnce(&R) -> i64,
    trace: impl FnOnce(
        crate::platform::runtime::RuntimeProviderOperation,
        std::time::Instant,
        crate::platform::runtime::RuntimeProviderOperationCounts,
    ),
) -> Result<R, E>
where
    Fut: std::future::Future<Output = Result<R, E>>,
{
    let started_at = std::time::Instant::now();
    let result = provider_call().await?;
    trace(
        kind.provider_operation(),
        started_at,
        kind.provider_operation_counts(affected_rows(&result)),
    );
    Ok(result)
}

pub async fn execute_create_item_plan_mutation(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    plan: crate::data::clients::database_client::ProviderMutationPlan,
    user: &crate::platform::runtime::extension::UserAuth,
    access: &crate::platform::runtime::PolicyAccess,
    trace: impl FnOnce(
        crate::platform::runtime::RuntimeProviderOperation,
        std::time::Instant,
        crate::platform::runtime::RuntimeProviderOperationCounts,
    ),
) -> Result<crate::data::provider_plan::JsonObj, crate::routes::app_error::AppError> {
    execute_mutation(
        MutationTraceKind::Create,
        || {
            provider_create_item_plan_json(
                provider,
                crate::platform::runtime::RuntimeProviderPlanInput::new(plan, user, access),
            )
        },
        |_result| 1,
        trace,
    )
    .await
}

pub async fn execute_update_item_plan_mutation(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    plan: crate::data::clients::database_client::ProviderMutationPlan,
    user: &crate::platform::runtime::extension::UserAuth,
    access: &crate::platform::runtime::PolicyAccess,
    trace: impl FnOnce(
        crate::platform::runtime::RuntimeProviderOperation,
        std::time::Instant,
        crate::platform::runtime::RuntimeProviderOperationCounts,
    ),
) -> Result<crate::data::provider_plan::JsonObj, crate::routes::app_error::AppError> {
    execute_mutation(
        MutationTraceKind::Update,
        || {
            provider_update_item_plan_json(
                provider,
                crate::platform::runtime::RuntimeProviderPlanInput::new(plan, user, access),
            )
        },
        |_result| 1,
        trace,
    )
    .await
}

pub async fn execute_delete_item_plan_mutation(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    plan: crate::data::clients::database_client::ProviderMutationPlan,
    user: &crate::platform::runtime::extension::UserAuth,
    access: &crate::platform::runtime::PolicyAccess,
    trace: impl FnOnce(
        crate::platform::runtime::RuntimeProviderOperation,
        std::time::Instant,
        crate::platform::runtime::RuntimeProviderOperationCounts,
    ),
) -> Result<i64, crate::routes::app_error::AppError> {
    execute_mutation(
        MutationTraceKind::Delete,
        || {
            provider_delete_item_plan_json(
                provider,
                crate::platform::runtime::RuntimeProviderPlanInput::new(plan, user, access),
            )
        },
        |deleted_count| *deleted_count,
        trace,
    )
    .await
}

pub async fn validate_primary_key_available(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    entity_type: std::sync::Arc<crate::schemas::system::EntityType>,
    selections: serde_json::Value,
    record_id: Option<String>,
    user: &crate::platform::runtime::extension::UserAuth,
    access: &crate::platform::policy::PolicyAccess,
) -> Result<(), crate::routes::app_error::AppError> {
    let Some(record_id) = record_id else {
        return Ok(());
    };
    let existing = crate::data::read_orchestration::provider_find_item_json(
        provider,
        entity_type,
        selections,
        record_id,
        user,
        access,
    )
    .await?;
    if existing.is_some() {
        return Err(crate::routes::app_error::AppError::DataStore(
            crate::platform::runtime::DataStoreError::DuplicateKey,
        ));
    }
    Ok(())
}

pub async fn validate_foreign_key_exists(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    entity_type: std::sync::Arc<crate::schemas::system::EntityType>,
    selections: serde_json::Value,
    record_id: Option<String>,
    user: &crate::platform::runtime::extension::UserAuth,
    access: &crate::platform::policy::PolicyAccess,
) -> Result<(), crate::routes::app_error::AppError> {
    let Some(record_id) = record_id else {
        return Ok(());
    };
    let existing = crate::data::read_orchestration::provider_find_item_json(
        provider,
        entity_type,
        selections,
        record_id,
        user,
        access,
    )
    .await?;
    if existing.is_none() {
        return Err(crate::routes::app_error::AppError::DataStore(
            crate::platform::runtime::DataStoreError::ForeignKeyViolation,
        ));
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub async fn validate_unique_record(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    plan: crate::data::clients::database_client::ProviderQueryPlan,
    user: &crate::platform::runtime::extension::UserAuth,
    access: &crate::platform::runtime::PolicyAccess,
    primary_key_name: &str,
    record: &serde_json::Map<String, serde_json::Value>,
    entity_name: &str,
    property_name: &str,
    message: &str,
) -> Result<(), crate::routes::app_error::AppError> {
    let candidates = crate::data::read_orchestration::provider_query_items_plan_json(
        provider,
        crate::platform::runtime::RuntimeProviderPlanInput::new(plan, user, access),
    )
    .await?;
    if crate::data::rules::validation::uniqueness_conflict(
        primary_key_name,
        record,
        &candidates.items,
    ) {
        return Err(crate::routes::app_error::AppError::Validation(format!(
            "{entity_name}.{property_name}: {message}"
        )));
    }
    Ok(())
}

/// Whether a filtered update should be checked for silent access-driven
/// denial: an access filter is in effect, a non-empty record id was
/// supplied, and the record wasn't already visible before the mutation.
pub fn should_check_filtered_update_denial(
    access_filter: Option<&serde_json::Value>,
    record_id: Option<&str>,
    access_visible_before: Option<&serde_json::Map<String, serde_json::Value>>,
) -> bool {
    access_filter.is_some()
        && record_id
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .is_some()
        && access_visible_before.is_none()
}

/// Resolve the audit record id for a mutation, preferring different sources
/// depending on the kind of mutation.
pub fn mutation_record_id(
    entity: &crate::product_api::RuntimeEntityMetadata,
    kind: MutationTraceKind,
    input: Option<&serde_json::Map<String, serde_json::Value>>,
    provider_result: Option<&serde_json::Map<String, serde_json::Value>>,
    before: Option<&serde_json::Map<String, serde_json::Value>>,
) -> Option<String> {
    match kind {
        MutationTraceKind::Create => provider_result
            .and_then(|record| crate::data::audit::record_id(entity, record))
            .or_else(|| input.and_then(|record| crate::data::audit::record_id(entity, record))),
        MutationTraceKind::Update => input
            .and_then(|record| crate::data::audit::record_id(entity, record))
            .or_else(|| {
                provider_result.and_then(|record| crate::data::audit::record_id(entity, record))
            })
            .or_else(|| before.and_then(|record| crate::data::audit::record_id(entity, record))),
        MutationTraceKind::Delete => input
            .and_then(|record| crate::data::audit::record_id(entity, record))
            .or_else(|| before.and_then(|record| crate::data::audit::record_id(entity, record))),
    }
}

pub async fn append_audit_mutation<E, Fut>(
    entity: &crate::product_api::RuntimeEntityMetadata,
    action: crate::platform::policy::AccessAction,
    user: &crate::platform::user_auth::UserAuth,
    record_id: Option<String>,
    before_json: Option<serde_json::Value>,
    after_json: Option<serde_json::Value>,
    access: &crate::platform::policy::PolicyAccess,
    append_event: impl FnOnce(crate::data::audit_event::AuditEvent) -> Fut,
) -> Result<(), E>
where
    Fut: std::future::Future<Output = Result<(), E>>,
{
    if !crate::data::audit::is_audited(entity) {
        return Ok(());
    }
    let event = crate::data::audit_event::AuditEvent::entity_mutation(
        entity,
        action,
        user,
        record_id,
        before_json,
        after_json,
        access,
    );
    append_event(event).await
}

pub async fn append_audit_attempt<E, Fut>(
    entity: &crate::product_api::RuntimeEntityMetadata,
    action: crate::platform::policy::AccessAction,
    user: Option<&crate::platform::user_auth::UserAuth>,
    outcome: &str,
    record_id: Option<String>,
    before_json: Option<serde_json::Value>,
    after_json: Option<serde_json::Value>,
    policy_json: Option<serde_json::Value>,
    append_event: impl FnOnce(crate::data::audit_event::AuditEvent) -> Fut,
) -> Result<(), E>
where
    Fut: std::future::Future<Output = Result<(), E>>,
{
    if !crate::data::audit::is_audited(entity) {
        return Ok(());
    }
    let event = crate::data::audit_event::AuditEvent::entity_attempt(
        entity,
        action,
        user,
        outcome,
        record_id,
        before_json,
        after_json,
        policy_json,
    );
    append_event(event).await
}

pub async fn append_audit_attempt_on_record_chain<E, AppendFut>(
    entity: &crate::product_api::RuntimeEntityMetadata,
    action: crate::platform::policy::AccessAction,
    user: Option<&crate::platform::user_auth::UserAuth>,
    outcome: &str,
    record_id: Option<String>,
    before_json: Option<serde_json::Value>,
    after_json: Option<serde_json::Value>,
    policy_json: Option<serde_json::Value>,
    append_event: impl FnOnce(crate::data::audit_event::AuditEvent) -> AppendFut,
) -> Result<(), E>
where
    AppendFut: std::future::Future<Output = Result<(), E>>,
{
    if !crate::data::audit::is_audited(entity) {
        return Ok(());
    }
    let event = crate::data::audit_event::AuditEvent::entity_attempt(
        entity,
        action,
        user,
        outcome,
        record_id,
        before_json,
        after_json,
        policy_json,
    );
    append_event(event).await
}

pub async fn append_missing_user_audit_attempt<E, Fut>(
    entity: &crate::product_api::RuntimeEntityMetadata,
    action: crate::platform::policy::AccessAction,
    record_id: Option<String>,
    error: impl ToString,
    append_event: impl FnOnce(crate::data::audit_event::AuditEvent) -> Fut,
) -> Result<(), E>
where
    Fut: std::future::Future<Output = Result<(), E>>,
{
    append_audit_attempt(
        entity,
        action,
        None,
        "denied",
        record_id,
        None,
        None,
        Some(crate::data::audit_event::policy_error_json(
            "missing_user",
            error,
        )),
        append_event,
    )
    .await
}

pub async fn append_policy_denied_audit_attempt_on_record_chain<E, AppendFut>(
    entity: &crate::product_api::RuntimeEntityMetadata,
    action: crate::platform::policy::AccessAction,
    user: &crate::platform::user_auth::UserAuth,
    record_id: Option<String>,
    before_json: Option<serde_json::Value>,
    attempted_json: Option<serde_json::Value>,
    access: &crate::platform::policy::PolicyAccess,
    append_event: impl FnOnce(crate::data::audit_event::AuditEvent) -> AppendFut,
) -> Result<(), E>
where
    AppendFut: std::future::Future<Output = Result<(), E>>,
{
    append_audit_attempt_on_record_chain(
        entity,
        action,
        Some(user),
        "denied",
        record_id,
        before_json,
        attempted_json,
        Some(crate::data::audit_event::policy_decision_json(
            access,
            "policy_denied",
        )),
        append_event,
    )
    .await
}

pub async fn append_policy_error_audit_attempt<E, Fut>(
    entity: &crate::product_api::RuntimeEntityMetadata,
    action: crate::platform::policy::AccessAction,
    user: &crate::platform::user_auth::UserAuth,
    record_id: Option<String>,
    attempted_json: Option<serde_json::Value>,
    error: impl ToString,
    append_event: impl FnOnce(crate::data::audit_event::AuditEvent) -> Fut,
) -> Result<(), E>
where
    Fut: std::future::Future<Output = Result<(), E>>,
{
    append_audit_attempt(
        entity,
        action,
        Some(user),
        "failed",
        record_id,
        None,
        attempted_json,
        Some(crate::data::audit_event::policy_error_json(
            "policy_evaluation_failed",
            error,
        )),
        append_event,
    )
    .await
}

pub async fn append_operation_failed_audit_attempt<E, Fut>(
    entity: &crate::product_api::RuntimeEntityMetadata,
    action: crate::platform::policy::AccessAction,
    user: &crate::platform::user_auth::UserAuth,
    record_id: Option<String>,
    before_json: Option<serde_json::Value>,
    after_json: Option<serde_json::Value>,
    error: impl ToString,
    append_event: impl FnOnce(crate::data::audit_event::AuditEvent) -> Fut,
) -> Result<(), E>
where
    Fut: std::future::Future<Output = Result<(), E>>,
{
    append_audit_attempt(
        entity,
        action,
        Some(user),
        "failed",
        record_id,
        before_json,
        after_json,
        Some(crate::data::audit_event::operation_error_json(
            "mutation_failed",
            error,
        )),
        append_event,
    )
    .await
}

pub async fn append_operation_not_applied_audit_attempt<E, Fut>(
    entity: &crate::product_api::RuntimeEntityMetadata,
    action: crate::platform::policy::AccessAction,
    user: &crate::platform::user_auth::UserAuth,
    record_id: Option<String>,
    before_json: Option<serde_json::Value>,
    append_event: impl FnOnce(crate::data::audit_event::AuditEvent) -> Fut,
) -> Result<(), E>
where
    Fut: std::future::Future<Output = Result<(), E>>,
{
    append_audit_attempt(
        entity,
        action,
        Some(user),
        "not_applied",
        record_id,
        before_json,
        None,
        Some(crate::data::audit_event::operation_decision_json(
            "no_rows_affected",
        )),
        append_event,
    )
    .await
}

pub async fn provider_append_audit_event(
    provider: &dyn crate::data::clients::database_client::DatabaseClient,
    event: crate::data::audit_event::AuditEvent,
) -> Result<(), crate::routes::app_error::AppError> {
    ensure_provider_operation(
        provider,
        crate::platform::runtime::RuntimeProviderOperation::AppendAuditEvent,
    )?;
    provider.append_audit_event(event).await
}
