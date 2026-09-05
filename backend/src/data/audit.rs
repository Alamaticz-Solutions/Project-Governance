//! Leaf helpers for record-audit history, ported from the framework's
//! `appfw_runtime::record_audit` module as an independent reimplementation.
//!
//! Scope note: the framework's `RuntimeAuditEvent` type and its audit-chain
//! machinery are NOT ported here. That machinery stays framework-owned
//! because it's baked into the `RuntimeProviderDataClient` trait implemented
//! elsewhere in this codebase. This module only carries the small set of
//! pure helper functions that this product's own code calls directly.

use appfw_runtime::RuntimeAuditQuery;

use crate::product_api::RuntimeEntityMetadata;

/// True when the entity's metadata carries the `"audited"` facet.
pub(crate) fn is_audited(entity: &RuntimeEntityMetadata) -> bool {
    entity.facets.iter().any(|facet| facet == "audited")
}

/// The audit table's storage name: the entity's plural snake-case name with
/// an `_audit` suffix (e.g. entity.snake_n == "accounts" -> "accounts_audit").
pub(crate) fn audit_table_name(entity: &RuntimeEntityMetadata) -> String {
    format!("{}_audit", entity.snake_n)
}

/// Clamps a requested audit-history page size into the allowed range
/// [1, 100] inclusive. A requested limit of 0 or negative becomes 1; a
/// requested limit above 100 becomes 100; anything in between is unchanged.
pub(crate) fn audit_query_limit(limit: i64) -> i64 {
    limit.clamp(1, 100)
}

/// Builds a query descriptor for an entity's audit history: schema name and
/// entity display name come from the entity metadata, the audit table name
/// is derived via `audit_table_name`, and the requested `limit` is passed
/// through `audit_query_limit`.
pub(crate) fn audit_query(
    entity: &RuntimeEntityMetadata,
    tenant_id: impl Into<String>,
    record_id: impl Into<String>,
    limit: i64,
) -> RuntimeAuditQuery {
    RuntimeAuditQuery::new(
        entity.schema_name.clone(),
        entity.pascal_1.clone(),
        audit_table_name(entity),
        tenant_id,
        record_id,
        audit_query_limit(limit),
    )
}

/// A GraphQL selection-set JSON value that selects every one of the entity's
/// natively-stored properties (i.e. `prop.is_native_storage()` is true) and
/// nothing else, at depth one (no nested selections).
pub(crate) fn audit_selection(entity: &RuntimeEntityMetadata) -> serde_json::Value {
    let selection_set: Vec<serde_json::Value> = entity
        .properties
        .iter()
        .filter(|prop| prop.is_native_storage())
        .map(|prop| {
            serde_json::json!({
                "name": prop.name,
                "selection_set": [],
            })
        })
        .collect();

    serde_json::json!({
        "name": entity.snake_n,
        "selection_set": selection_set,
    })
}

/// Extracts the entity's primary-key value from a record as a string, or
/// `None` if the entity has no primary key, the record doesn't have that
/// key, or the value doesn't convert via `value_to_string`.
pub(crate) fn record_id(
    entity: &RuntimeEntityMetadata,
    record: &serde_json::Map<String, serde_json::Value>,
) -> Option<String> {
    let pk = entity.primary_key()?;
    let value = record.get(&pk.name)?;
    value_to_string(value)
}

/// Converts a JSON scalar to a display string for audit purposes:
/// - a non-empty string returns its contents
/// - an empty string returns `None`
/// - a number returns its string representation
/// - a boolean returns `"true"` or `"false"`
/// - anything else (null, array, object) returns `None`
pub(crate) fn value_to_string(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(s) if !s.is_empty() => Some(s.clone()),
        serde_json::Value::String(_) => None,
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::Bool(b) => Some(b.to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::{json, Map, Value};

    use super::*;
    use crate::product_api::{
        RuntimeDataType, RuntimeEntityRef, RuntimeNavByForeignKey, RuntimePropertyMetadata,
    };

    fn entity(
        facets: Vec<String>,
        properties: Vec<RuntimePropertyMetadata>,
    ) -> RuntimeEntityMetadata {
        RuntimeEntityMetadata {
            id: "test-entity".to_string(),
            schema_name: "test".to_string(),
            schema_id: None,
            pascal_1: "Widget".to_string(),
            pascal_n: "Widgets".to_string(),
            snake_1: "widget".to_string(),
            snake_n: "widgets".to_string(),
            caption_1: "Widget".to_string(),
            caption_n: "Widgets".to_string(),
            is_union: false,
            base_type: None,
            is_table: true,
            facets,
            meta: None,
            standard_methods: Vec::new(),
            custom_methods: Vec::new(),
            properties,
        }
    }

    fn prop(name: &str, is_key: bool) -> RuntimePropertyMetadata {
        RuntimePropertyMetadata {
            id: format!("{name}-id"),
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
            meta: None,
        }
    }

    /// A nav-to-one property: `is_native_storage()` is keyed off `data_type`
    /// (native storage is everything except NavToOne/NavToMany/ManyToMany),
    /// so this must be excluded from `audit_selection`. `nav_by_fk` and
    /// `nested_entity_type` are also populated to match a realistic nav
    /// property, though `data_type` is what actually drives exclusion.
    fn nav_prop(name: &str) -> RuntimePropertyMetadata {
        RuntimePropertyMetadata {
            data_type: RuntimeDataType::NavToOne,
            nav_by_fk: Some(RuntimeNavByForeignKey {
                schema_name: "test".to_string(),
                type_name: "Owner".to_string(),
                prop_name: format!("{name}_id"),
                filter: None,
                resolved: RuntimeEntityRef {
                    schema_name: "test".to_string(),
                    type_name: "Owner".to_string(),
                },
            }),
            nested_entity_type: Some(RuntimeEntityRef {
                schema_name: "test".to_string(),
                type_name: "Nested".to_string(),
            }),
            ..prop(name, false)
        }
    }

    fn record(value: Value) -> Map<String, Value> {
        value.as_object().unwrap().clone()
    }

    #[test]
    fn is_audited_checks_the_audited_facet() {
        let audited = entity(vec!["audited".to_string()], Vec::new());
        assert!(is_audited(&audited));

        let not_audited = entity(vec!["other".to_string()], Vec::new());
        assert!(!is_audited(&not_audited));
    }

    #[test]
    fn audit_table_name_appends_audit_suffix() {
        let entity = RuntimeEntityMetadata {
            snake_n: "accounts".to_string(),
            ..entity(Vec::new(), Vec::new())
        };

        assert_eq!(audit_table_name(&entity), "accounts_audit");
    }

    #[test]
    fn audit_query_limit_clamps_into_one_through_one_hundred() {
        assert_eq!(audit_query_limit(0), 1);
        assert_eq!(audit_query_limit(-5), 1);
        assert_eq!(audit_query_limit(50), 50);
        assert_eq!(audit_query_limit(250), 100);
    }

    #[test]
    fn audit_query_uses_entity_topology_and_normalizes_limit() {
        let entity = RuntimeEntityMetadata {
            schema_name: "crm".to_string(),
            pascal_1: "Account".to_string(),
            snake_n: "accounts".to_string(),
            ..entity(Vec::new(), Vec::new())
        };

        let query = audit_query(&entity, "tenant-1", "account-1", 250);

        assert_eq!(query.schema_name, "crm");
        assert_eq!(query.entity_name, "Account");
        assert_eq!(query.audit_table_name, "accounts_audit");
        assert_eq!(query.tenant_id, "tenant-1");
        assert_eq!(query.record_id, "account-1");
        assert_eq!(query.limit, 100);
    }

    #[test]
    fn audit_selection_includes_only_natively_stored_properties_in_order() {
        let entity = entity(
            Vec::new(),
            vec![
                prop("id", true),
                prop("name", false),
                nav_prop("owner"),
                prop("status", false),
            ],
        );

        let selection = audit_selection(&entity);

        assert_eq!(
            selection,
            json!({
                "name": "widgets",
                "selection_set": [
                    { "name": "id", "selection_set": [] },
                    { "name": "name", "selection_set": [] },
                    { "name": "status", "selection_set": [] },
                ],
            })
        );
    }

    #[test]
    fn record_id_reads_the_primary_key_value() {
        let entity = entity(Vec::new(), vec![prop("id", true), prop("name", false)]);
        let record = record(json!({ "id": "account-1", "name": "Acme" }));

        assert_eq!(record_id(&entity, &record), Some("account-1".to_string()));
    }

    #[test]
    fn record_id_is_none_without_a_usable_primary_key_value() {
        let entity = entity(Vec::new(), vec![prop("id", true), prop("name", false)]);
        let record = record(json!({ "name": "Acme" }));

        assert_eq!(record_id(&entity, &record), None);
    }

    #[test]
    fn value_to_string_converts_scalars_and_rejects_others() {
        assert_eq!(value_to_string(&json!("hello")), Some("hello".to_string()));
        assert_eq!(value_to_string(&json!("")), None);
        assert_eq!(value_to_string(&json!(42)), Some("42".to_string()));
        assert_eq!(value_to_string(&json!(true)), Some("true".to_string()));
        assert_eq!(value_to_string(&json!(null)), None);
        assert_eq!(value_to_string(&json!([1, 2])), None);
        assert_eq!(value_to_string(&json!({"a": 1})), None);
    }
}
