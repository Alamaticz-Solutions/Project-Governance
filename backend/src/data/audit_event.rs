//! Tamper-evident, hash-chained audit event record: 21-field shape,
//! construction helpers, redaction, diffing, and SHA-256 hash-chain
//! finalization. Ported off `appfw_runtime`'s `RuntimeAuditEvent` as an
//! independent reimplementation (backend framework replacement phase 5,
//! sub-slice 4a).
//!
//! Every audit event this system writes is chained to the previous one via a
//! SHA-256 hash of its own canonicalized JSON representation (`event_hash`,
//! chained forward via `prev_hash`), and that hash is already persisted for
//! historical events. If this module's JSON serialization drifts from the
//! framework's even slightly -- a field renamed, retyped, or made
//! present/absent differently -- new hashes stop verifying against the
//! existing chain, silently, with no test failure to catch it locally. See
//! `oracle_test` below, which is the test that actually catches that class of
//! drift; do not weaken or remove it.

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuditQuery {
    pub schema_name: String,
    pub entity_name: String,
    pub audit_table_name: String,
    pub tenant_id: String,
    pub record_id: String,
    pub limit: i64,
}

impl AuditQuery {
    pub fn new(
        schema_name: impl Into<String>,
        entity_name: impl Into<String>,
        audit_table_name: impl Into<String>,
        tenant_id: impl Into<String>,
        record_id: impl Into<String>,
        limit: i64,
    ) -> Self {
        Self {
            schema_name: schema_name.into(),
            entity_name: entity_name.into(),
            audit_table_name: audit_table_name.into(),
            tenant_id: tenant_id.into(),
            record_id: record_id.into(),
            limit: audit_query_limit(limit),
        }
    }

    pub fn for_entity(
        entity: &crate::product_api::RuntimeEntityMetadata,
        tenant_id: impl Into<String>,
        record_id: impl Into<String>,
        limit: i64,
    ) -> Self {
        Self::new(
            entity.schema_name.clone(),
            entity.pascal_1.clone(),
            crate::data::audit::audit_table_name(entity),
            tenant_id,
            record_id,
            limit,
        )
    }
}

fn audit_query_limit(limit: i64) -> i64 {
    limit.clamp(1, 100)
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct AuditEvent {
    pub audit_id: String,
    pub occurred_at: chrono::DateTime<chrono::Utc>,
    pub tenant_id: Option<String>,
    pub actor_user_name: String,
    pub actor_roles: Vec<String>,
    pub action: String,
    pub outcome: String,
    pub schema_name: String,
    pub entity_name: String,
    pub table_name: String,
    pub audit_table_name: String,
    pub record_id: Option<String>,
    pub before_json: Option<serde_json::Value>,
    pub after_json: Option<serde_json::Value>,
    pub diff_json: serde_json::Value,
    pub policy_json: Option<serde_json::Value>,
    pub redactions_json: serde_json::Value,
    pub chain_scope: String,
    pub prev_hash: Option<String>,
    pub event_hash: String,
    pub signature: Option<String>,
}

impl AuditEvent {
    pub fn entity_mutation(
        entity: &crate::product_api::RuntimeEntityMetadata,
        action: crate::platform::policy::AccessAction,
        user: &crate::platform::user_auth::UserAuth,
        record_id: Option<String>,
        before_json: Option<serde_json::Value>,
        after_json: Option<serde_json::Value>,
        access: &crate::platform::policy::PolicyAccess,
    ) -> Self {
        Self::entity_attempt(
            entity,
            action,
            Some(user),
            "succeeded",
            record_id,
            before_json,
            after_json,
            Some(policy_json(access)),
        )
    }

    pub fn entity_attempt(
        entity: &crate::product_api::RuntimeEntityMetadata,
        action: crate::platform::policy::AccessAction,
        user: Option<&crate::platform::user_auth::UserAuth>,
        outcome: &str,
        record_id: Option<String>,
        before_json: Option<serde_json::Value>,
        after_json: Option<serde_json::Value>,
        policy_json: Option<serde_json::Value>,
    ) -> Self {
        Self::entity_event(
            entity,
            action.as_str(),
            user,
            outcome,
            record_id,
            before_json,
            after_json,
            policy_json,
        )
    }

    pub fn entity_event(
        entity: &crate::product_api::RuntimeEntityMetadata,
        action: impl Into<String>,
        user: Option<&crate::platform::user_auth::UserAuth>,
        outcome: &str,
        record_id: Option<String>,
        before_json: Option<serde_json::Value>,
        after_json: Option<serde_json::Value>,
        policy_json: Option<serde_json::Value>,
    ) -> Self {
        let table_name = entity.snake_n.clone();
        let audit_table_name = crate::data::audit::audit_table_name(entity);
        let tenant_id = user.and_then(|user| non_empty(&user.tenant_id).map(str::to_string));
        let actor_user_name = user
            .map(|user| user.user_name.clone())
            .unwrap_or_else(|| "anonymous".to_string());
        let actor_roles = user.map(|user| user.roles.clone()).unwrap_or_default();
        let redacted = redact_payloads(entity, before_json, after_json);
        let chain_scope = chain_scope(entity, tenant_id.as_deref(), record_id.as_deref());

        Self {
            audit_id: uuid::Uuid::new_v4().to_string(),
            occurred_at: chrono::Utc::now(),
            tenant_id,
            actor_user_name,
            actor_roles,
            action: action.into(),
            outcome: outcome.to_string(),
            schema_name: entity.schema_name.clone(),
            entity_name: entity.pascal_1.clone(),
            table_name,
            audit_table_name,
            record_id,
            diff_json: diff(redacted.before_json.as_ref(), redacted.after_json.as_ref()),
            before_json: redacted.before_json,
            after_json: redacted.after_json,
            policy_json,
            redactions_json: redacted.redactions_json,
            chain_scope,
            prev_hash: None,
            event_hash: String::new(),
            signature: None,
        }
    }

    pub fn finalize(
        mut self,
        prev_hash: Option<String>,
    ) -> Result<Self, crate::routes::app_error::AppError> {
        self.prev_hash = prev_hash;
        self.event_hash = self.compute_hash()?;
        Ok(self)
    }

    fn compute_hash(&self) -> Result<String, crate::routes::app_error::AppError> {
        let mut payload = self.clone();
        payload.event_hash.clear();
        payload.signature = None;
        compute_hash(&payload)
    }

    pub fn continue_record_chain(self, last_event: Option<&serde_json::Value>) -> Self {
        continue_record_chain(self, last_event)
    }
}

/// Deliberately a no-op in every code path -- both branches return `event`
/// completely unchanged. This is not a bug to fix; it's the exact behavior
/// being preserved from the reference implementation. Do not make this
/// actually chain.
pub fn continue_record_chain(
    event: AuditEvent,
    last_event: Option<&serde_json::Value>,
) -> AuditEvent {
    if let Some(last_event) = last_event.and_then(serde_json::Value::as_object) {
        let same_tenant = audit_str(last_event, "tenant_id") == event.tenant_id.as_deref();
        let same_chain = audit_str(last_event, "chain_scope") == Some(event.chain_scope.as_str());
        if !same_tenant || !same_chain {
            return event;
        }
    }
    event
}

fn audit_str<'a>(
    event: &'a serde_json::Map<String, serde_json::Value>,
    key: &str,
) -> Option<&'a str> {
    event
        .get(key)
        .or_else(|| event.get(&key.to_ascii_uppercase()))
        .and_then(serde_json::Value::as_str)
}

pub fn chain_scope(
    entity: &crate::product_api::RuntimeEntityMetadata,
    tenant_id: Option<&str>,
    record_id: Option<&str>,
) -> String {
    let mut scope = format!("{}.{}", entity.schema_name, entity.pascal_1);
    if let Some(tenant_id) = tenant_id.and_then(non_empty) {
        scope.push(':');
        scope.push_str(tenant_id);
    }
    if let Some(record_id) = record_id.and_then(non_empty) {
        scope.push(':');
        scope.push_str(record_id);
    }
    scope
}

pub struct RedactedAuditPayload {
    pub before_json: Option<serde_json::Value>,
    pub after_json: Option<serde_json::Value>,
    pub redactions_json: serde_json::Value,
}

pub fn redact_payloads(
    entity: &crate::product_api::RuntimeEntityMetadata,
    before_json: Option<serde_json::Value>,
    after_json: Option<serde_json::Value>,
) -> RedactedAuditPayload {
    let mut redacted_properties = std::collections::BTreeSet::new();
    let before_json =
        before_json.map(|value| redact_record_value(entity, value, &mut redacted_properties));
    let after_json =
        after_json.map(|value| redact_record_value(entity, value, &mut redacted_properties));

    RedactedAuditPayload {
        before_json,
        after_json,
        redactions_json: serde_json::json!({
            "omitted_actor_fields": ["token"],
            "redacted_properties": redacted_properties.into_iter().collect::<Vec<_>>(),
            "strategy": "replace_value",
        }),
    }
}

fn redact_record_value(
    entity: &crate::product_api::RuntimeEntityMetadata,
    value: serde_json::Value,
    redacted_properties: &mut std::collections::BTreeSet<String>,
) -> serde_json::Value {
    let serde_json::Value::Object(mut obj) = value else {
        return value;
    };

    for prop in &entity.properties {
        if obj.contains_key(&prop.name) && should_redact_property(prop) {
            obj.insert(prop.name.clone(), serde_json::json!({ "_redacted": true }));
            redacted_properties.insert(prop.name.clone());
        }
    }

    serde_json::Value::Object(obj)
}

fn should_redact_property(prop: &crate::product_api::RuntimePropertyMetadata) -> bool {
    meta_requests_redaction(prop.meta.as_ref()) || name_looks_sensitive(&prop.name)
}

fn meta_requests_redaction(meta: Option<&serde_json::Value>) -> bool {
    let Some(meta) = meta else {
        return false;
    };
    bool_at(meta, &["audit", "redact"])
        || bool_at(meta, &["audit", "omit"])
        || bool_at(meta, &["sensitive"])
        || bool_at(meta, &["pii"])
        || bool_at(meta, &["secret"])
        || string_at(meta, &["audit", "classification"])
            .map(|classification| {
                matches!(
                    classification,
                    "confidential" | "restricted" | "secret" | "sensitive"
                )
            })
            .unwrap_or(false)
}

fn bool_at(value: &serde_json::Value, path: &[&str]) -> bool {
    path.iter()
        .try_fold(value, |curr, part| curr.get(*part))
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false)
}

fn string_at<'a>(value: &'a serde_json::Value, path: &[&str]) -> Option<&'a str> {
    path.iter()
        .try_fold(value, |curr, part| curr.get(*part))
        .and_then(serde_json::Value::as_str)
}

fn name_looks_sensitive(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    [
        "access_key",
        "api_key",
        "credential",
        "password",
        "private_key",
        "refresh_token",
        "secret",
        "social_security",
        "ssn",
        "token",
    ]
    .iter()
    .any(|marker| name.contains(marker))
}

pub fn diff(
    before: Option<&serde_json::Value>,
    after: Option<&serde_json::Value>,
) -> serde_json::Value {
    let before_obj = before.and_then(serde_json::Value::as_object);
    let after_obj = after.and_then(serde_json::Value::as_object);
    let mut result = serde_json::Map::new();

    let mut keys = before_obj
        .into_iter()
        .flat_map(|obj| obj.keys().cloned())
        .collect::<Vec<_>>();
    keys.extend(after_obj.into_iter().flat_map(|obj| obj.keys().cloned()));
    keys.sort();
    keys.dedup();

    for key in keys {
        let before_value = before
            .and_then(serde_json::Value::as_object)
            .and_then(|obj| obj.get(&key))
            .cloned()
            .unwrap_or(serde_json::Value::Null);
        let after_value = after
            .and_then(serde_json::Value::as_object)
            .and_then(|obj| obj.get(&key))
            .cloned()
            .unwrap_or(serde_json::Value::Null);
        if before_value != after_value {
            result.insert(
                key,
                serde_json::json!({ "before": before_value, "after": after_value }),
            );
        }
    }

    serde_json::Value::Object(result)
}

pub fn policy_json(access: &crate::platform::policy::PolicyAccess) -> serde_json::Value {
    serde_json::json!({ "allow": access.allow, "filter": access.filter })
}

pub fn policy_decision_json(
    access: &crate::platform::policy::PolicyAccess,
    reason: &str,
) -> serde_json::Value {
    serde_json::json!({
        "allow": access.allow,
        "filter": access.filter,
        "decision": { "reason": reason },
    })
}

pub fn policy_error_json(reason: &str, error: impl ToString) -> serde_json::Value {
    serde_json::json!({
        "allow": false,
        "filter": null,
        "decision": { "reason": reason, "error": error.to_string() },
    })
}

pub fn operation_error_json(reason: &str, error: impl ToString) -> serde_json::Value {
    serde_json::json!({ "decision": { "reason": reason, "error": error.to_string() } })
}

pub fn operation_decision_json(reason: &str) -> serde_json::Value {
    serde_json::json!({ "decision": { "reason": reason } })
}

pub fn compute_hash<T>(payload: &T) -> Result<String, crate::routes::app_error::AppError>
where
    T: serde::Serialize,
{
    let payload = canonicalize_value(
        serde_json::to_value(payload)
            .map_err(|err| crate::routes::app_error::AppError::DataAccess(err.to_string()))?,
    );
    let bytes = serde_json::to_vec(&payload)
        .map_err(|err| crate::routes::app_error::AppError::DataAccess(err.to_string()))?;
    let mut hasher = <sha2::Sha256 as sha2::Digest>::new();
    sha2::Digest::update(&mut hasher, bytes);
    Ok(format!("{:x}", sha2::Digest::finalize(hasher)))
}

fn canonicalize_value(value: serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Array(values) => {
            serde_json::Value::Array(values.into_iter().map(canonicalize_value).collect())
        }
        serde_json::Value::Object(map) => {
            let mut entries = map.into_iter().collect::<Vec<_>>();
            entries.sort_by(|(left, _), (right, _)| left.cmp(right));
            serde_json::Value::Object(
                entries
                    .into_iter()
                    .map(|(key, value)| (key, canonicalize_value(value)))
                    .collect(),
            )
        }
        value => value,
    }
}

fn non_empty(value: &str) -> Option<&str> {
    let value = value.trim();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::platform::policy::{AccessAction, PolicyAccess};
    use crate::platform::user_auth::UserAuth;
    use crate::product_api::{RuntimeDataType, RuntimeEntityMetadata, RuntimePropertyMetadata};
    use serde_json::json;

    fn entity() -> RuntimeEntityMetadata {
        RuntimeEntityMetadata {
            id: "entity-1".to_string(),
            schema_name: "crm".to_string(),
            schema_id: None,
            pascal_1: "Account".to_string(),
            pascal_n: "Accounts".to_string(),
            snake_1: "account".to_string(),
            snake_n: "accounts".to_string(),
            caption_1: "Account".to_string(),
            caption_n: "Accounts".to_string(),
            is_union: false,
            base_type: None,
            is_table: true,
            facets: vec!["audited".to_string()],
            meta: None,
            standard_methods: Vec::new(),
            custom_methods: Vec::new(),
            properties: vec![
                prop("id", true, None),
                prop("name", false, None),
                prop("api_token", false, None),
                prop("email", false, Some(json!({ "audit": { "redact": true } }))),
            ],
        }
    }

    fn prop(name: &str, is_key: bool, meta: Option<serde_json::Value>) -> RuntimePropertyMetadata {
        RuntimePropertyMetadata {
            id: format!("prop-{name}"),
            name: name.to_string(),
            caption: name.to_string(),
            data_type: RuntimeDataType::String,
            is_key,
            is_caption: false,
            is_required: false,
            is_read_only: false,
            is_concurrency_control: false,
            default_value: None,
            foreign_key: None,
            nav_by_fk: None,
            many_to_many: None,
            nested_entity_type: None,
            enum_type_name: None,
            meta,
        }
    }

    #[test]
    fn redaction_replaces_sensitive_properties_before_diffing() {
        let entity = entity();
        let redacted = redact_payloads(
            &entity,
            Some(json!({
                "id": "account-1", "name": "Old",
                "api_token": "old-token", "email": "old@example.com"
            })),
            Some(json!({
                "id": "account-1", "name": "New",
                "api_token": "new-token", "email": "new@example.com"
            })),
        );

        assert_eq!(
            redacted.before_json.as_ref().unwrap()["api_token"],
            json!({ "_redacted": true })
        );
        assert_eq!(
            redacted.after_json.as_ref().unwrap()["email"],
            json!({ "_redacted": true })
        );
        let diff_result = diff(redacted.before_json.as_ref(), redacted.after_json.as_ref());
        assert_eq!(diff_result["name"]["before"], json!("Old"));
        assert!(diff_result.get("api_token").is_none());
        assert_eq!(
            redacted.redactions_json["redacted_properties"][0],
            "api_token"
        );
        assert_eq!(redacted.redactions_json["redacted_properties"][1], "email");
    }

    #[test]
    fn audit_helpers_are_metadata_driven() {
        let entity = entity();
        assert_eq!(
            chain_scope(&entity, Some("tenant-1"), Some("account-1")),
            "crm.Account:tenant-1:account-1"
        );
    }

    #[test]
    fn policy_and_operation_evidence_json_is_stable() {
        let access = PolicyAccess::allow_with_filter(json!({ "tenant_id": { "_eq": "tenant-1" } }));

        assert_eq!(
            policy_decision_json(&access, "policy_denied"),
            json!({
                "allow": true,
                "filter": { "tenant_id": { "_eq": "tenant-1" } },
                "decision": { "reason": "policy_denied" }
            })
        );
        assert_eq!(
            operation_error_json("mutation_failed", "boom"),
            json!({ "decision": { "reason": "mutation_failed", "error": "boom" } })
        );
    }

    #[test]
    fn audit_event_builds_and_finalizes_stable_payload() {
        let entity = entity();
        let user = UserAuth::human(
            "tenant-1",
            "alex",
            "UTC",
            vec!["admin".to_string()],
            Vec::new(),
            "do-not-store",
        );
        let access = PolicyAccess::allow_all();

        let event = AuditEvent::entity_mutation(
            &entity,
            AccessAction::Update,
            &user,
            Some("account-1".to_string()),
            Some(json!({ "id": "account-1", "api_token": "old" })),
            Some(json!({ "id": "account-1", "api_token": "new", "name": "Acme" })),
            &access,
        );

        assert_eq!(event.schema_name, "crm");
        assert_eq!(event.entity_name, "Account");
        assert_eq!(event.table_name, "accounts");
        assert_eq!(event.audit_table_name, "accounts_audit");
        assert_eq!(event.chain_scope, "crm.Account:tenant-1:account-1");
        assert_eq!(
            event.after_json.as_ref().unwrap()["api_token"],
            json!({ "_redacted": true })
        );

        let finalized = event
            .finalize(Some("previous-hash".to_string()))
            .expect("finalized event");
        assert_eq!(finalized.prev_hash.as_deref(), Some("previous-hash"));
        assert!(!finalized.event_hash.is_empty());
    }

    #[test]
    fn continue_record_chain_is_a_true_no_op() {
        // continue_record_chain is deliberately inert -- it must return the
        // event completely unchanged in every case, regardless of whether
        // the last event matches on tenant/chain_scope or not. This test
        // exists specifically to catch a well-meaning "fix" that makes it
        // actually chain: any such change must fail this test.
        let entity = entity();
        let user = UserAuth::human(
            "tenant-new",
            "alex",
            "UTC",
            vec!["admin".to_string()],
            Vec::new(),
            "do-not-store",
        );
        let build_event = || {
            AuditEvent::entity_mutation(
                &entity,
                AccessAction::Update,
                &user,
                Some("account-1".to_string()),
                None,
                Some(json!({ "id": "account-1" })),
                &PolicyAccess::allow_all(),
            )
        };

        // Case 1: no last event at all.
        let event = build_event();
        let before = format!("{event:?}");
        let after = event.continue_record_chain(None);
        assert_eq!(format!("{after:?}"), before);

        // Case 2: last event matches tenant+chain_scope exactly.
        let event = build_event();
        let matching_last_event = json!({
            "tenant_id": event.tenant_id.clone(),
            "chain_scope": event.chain_scope.clone(),
        });
        let continued = event
            .clone()
            .continue_record_chain(Some(&matching_last_event));
        assert_eq!(continued.audit_id, event.audit_id);
        assert_eq!(continued.tenant_id, event.tenant_id);
        assert_eq!(continued.chain_scope, event.chain_scope);
        assert_eq!(continued.prev_hash, event.prev_hash);
        assert_eq!(continued.event_hash, event.event_hash);

        // Case 3: last event does NOT match (different tenant/chain_scope) --
        // still must return the event completely unchanged, not "start a new chain"
        // or mutate anything.
        let event = build_event();
        let mismatched_last_event = json!({
            "tenant_id": "some-other-tenant",
            "chain_scope": "crm.Account:some-other-tenant:other-record",
        });
        let continued = event
            .clone()
            .continue_record_chain(Some(&mismatched_last_event));
        assert_eq!(continued.tenant_id, event.tenant_id);
        assert_eq!(continued.chain_scope, event.chain_scope);
        assert_eq!(continued.audit_id, event.audit_id);
    }

    #[test]
    fn audit_query_uses_entity_topology_and_normalizes_limit() {
        let entity = entity();
        let query = AuditQuery::for_entity(&entity, "tenant-1", "account-1", 250);

        assert_eq!(query.schema_name, "crm");
        assert_eq!(query.entity_name, "Account");
        assert_eq!(query.audit_table_name, "accounts_audit");
        assert_eq!(query.tenant_id, "tenant-1");
        assert_eq!(query.record_id, "account-1");
        assert_eq!(query.limit, 100);

        assert_eq!(
            AuditQuery::for_entity(&entity, "tenant-1", "account-2", 0).limit,
            1
        );
    }
}

#[cfg(test)]
mod oracle_test {
    use super::*;
    use crate::platform::policy::{AccessAction, PolicyAccess};
    use crate::platform::user_auth::UserAuth;
    use crate::product_api::{RuntimeDataType, RuntimeEntityMetadata, RuntimePropertyMetadata};
    use serde_json::json;

    fn entity() -> RuntimeEntityMetadata {
        RuntimeEntityMetadata {
            id: "entity-1".to_string(),
            schema_name: "crm".to_string(),
            schema_id: None,
            pascal_1: "Account".to_string(),
            pascal_n: "Accounts".to_string(),
            snake_1: "account".to_string(),
            snake_n: "accounts".to_string(),
            caption_1: "Account".to_string(),
            caption_n: "Accounts".to_string(),
            is_union: false,
            base_type: None,
            is_table: true,
            facets: vec!["audited".to_string()],
            meta: None,
            standard_methods: Vec::new(),
            custom_methods: Vec::new(),
            properties: vec![
                RuntimePropertyMetadata {
                    id: "prop-id".to_string(),
                    name: "id".to_string(),
                    caption: "id".to_string(),
                    data_type: RuntimeDataType::String,
                    is_key: true,
                    is_caption: false,
                    is_required: false,
                    is_read_only: false,
                    is_concurrency_control: false,
                    default_value: None,
                    foreign_key: None,
                    nav_by_fk: None,
                    many_to_many: None,
                    nested_entity_type: None,
                    enum_type_name: None,
                    meta: None,
                },
                RuntimePropertyMetadata {
                    id: "prop-api_token".to_string(),
                    name: "api_token".to_string(),
                    caption: "api_token".to_string(),
                    data_type: RuntimeDataType::String,
                    is_key: false,
                    is_caption: false,
                    is_required: false,
                    is_read_only: false,
                    is_concurrency_control: false,
                    default_value: None,
                    foreign_key: None,
                    nav_by_fk: None,
                    many_to_many: None,
                    nested_entity_type: None,
                    enum_type_name: None,
                    meta: None,
                },
            ],
        }
    }

    /// Verifies this module's `AuditEvent::entity_mutation` produces the exact
    /// same JSON shape (field names, types, presence) as the real framework
    /// `crate::platform::runtime::RuntimeAuditEvent::entity_mutation`, and that both
    /// produce the same `event_hash` given the same (patched-for-determinism)
    /// input. This is a persisted-data contract: existing audit rows' hashes
    /// were computed by the framework's serialization, so any drift here
    /// would make new hash-chain links unverifiable against historical rows.
    #[test]
    fn matches_framework_audit_event_json_shape_and_hash() {
        let entity = entity();
        let record_id = Some("account-1".to_string());
        let before = Some(json!({ "id": "account-1", "api_token": "old" }));
        let after = Some(json!({ "id": "account-1", "api_token": "new" }));

        // --- Framework side (real appfw_runtime types) ---
        let framework_user = crate::platform::runtime::extension::UserAuth::human(
            "tenant-1",
            "alex",
            "UTC",
            vec!["admin".to_string()],
            Vec::new(),
            "do-not-store",
        );
        let framework_access = crate::platform::runtime::PolicyAccess::allow_all();
        let framework_event = crate::platform::runtime::RuntimeAuditEvent::entity_mutation(
            &entity,
            crate::platform::runtime::AccessAction::Update,
            &framework_user,
            record_id.clone(),
            before.clone(),
            after.clone(),
            &framework_access,
        );

        // --- Product side (this module) ---
        let product_user = UserAuth::human(
            "tenant-1",
            "alex",
            "UTC",
            vec!["admin".to_string()],
            Vec::new(),
            "do-not-store",
        );
        let product_access = PolicyAccess::allow_all();
        let mut product_event = AuditEvent::entity_mutation(
            &entity,
            AccessAction::Update,
            &product_user,
            record_id,
            before,
            after,
            &product_access,
        );

        // Copy the two inherently non-deterministic fields so the comparison
        // below isolates everything that SHOULD be identical given identical
        // inputs.
        product_event.audit_id = framework_event.audit_id.clone();
        product_event.occurred_at = framework_event.occurred_at;

        let framework_json =
            serde_json::to_value(&framework_event).expect("framework event serializes");
        let product_json = serde_json::to_value(&product_event).expect("product event serializes");
        assert_eq!(
            framework_json, product_json,
            "AuditEvent must serialize to the exact same JSON shape as RuntimeAuditEvent"
        );

        let framework_finalized = framework_event
            .finalize(Some("shared-prev-hash".to_string()))
            .expect("framework finalize succeeds");
        let product_finalized = product_event
            .finalize(Some("shared-prev-hash".to_string()))
            .expect("product finalize succeeds");

        assert_eq!(
            framework_finalized.event_hash, product_finalized.event_hash,
            "event_hash must match the framework's hash for identical event data -- \
             a mismatch here means new audit rows would be unverifiable against the \
             existing hash chain"
        );
    }
}
