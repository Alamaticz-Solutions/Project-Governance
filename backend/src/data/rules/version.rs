//! Product-owned optimistic-concurrency versioning, ported off
//! `appfw_runtime` (backend framework replacement phase 5).

use appfw_runtime::model_metadata::{
    RuntimeDataType, RuntimeEntityMetadata, RuntimePropertyMetadata,
};
use appfw_runtime::RuntimeError;
use serde_json::{Map, Value};

/// JavaScript's `Number.MAX_SAFE_INTEGER`. Browser admin clients round-trip
/// version numbers through JS's IEEE-754 doubles, and a previous scheme
/// (nanosecond timestamps) silently overflowed this and broke
/// optimistic-concurrency saves -- so any out-of-range current value is
/// treated as if it were absent (defaulting to `0`) rather than propagated.
const JS_MAX_SAFE_INTEGER: i64 = 9_007_199_254_740_991;

/// Reads the entity's current concurrency-control value out of `input`, if
/// the entity has a concurrency-control property and `input` carries a value
/// for it.
pub fn get_record_version(
    entity: &RuntimeEntityMetadata,
    input: &Map<String, Value>,
) -> Result<Option<Value>, RuntimeError> {
    let Some(prop) = entity
        .properties
        .iter()
        .find(|prop| prop.is_concurrency_control)
    else {
        return Ok(None);
    };

    Ok(input.get(&prop.name).cloned())
}

/// Computes the next concurrency-control value for `prop`, based on its
/// current value in `record`.
pub fn new_record_version(
    prop: &RuntimePropertyMetadata,
    record: &Map<String, Value>,
) -> Result<Option<Value>, RuntimeError> {
    if prop.data_type != RuntimeDataType::Int64 {
        return Err(RuntimeError::Validation(format!(
            "unsupported type for concurrency control '{}'",
            prop.name
        )));
    }

    let current = current_int64_version(record, &prop.name);
    let next = current.saturating_add(1);

    Ok(Some(Value::from(next)))
}

fn current_int64_version(record: &Map<String, Value>, name: &str) -> i64 {
    let Some(value) = record.get(name) else {
        return 0;
    };

    let parsed = value
        .as_i64()
        .or_else(|| value.as_str().and_then(|s| s.parse::<i64>().ok()));

    match parsed {
        Some(n) if (0..=JS_MAX_SAFE_INTEGER).contains(&n) => n,
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn record(value: Value) -> Map<String, Value> {
        value.as_object().expect("record object").clone()
    }

    fn entity_with_version_prop(prop: RuntimePropertyMetadata) -> RuntimeEntityMetadata {
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
            facets: Vec::new(),
            meta: None,
            standard_methods: Vec::new(),
            custom_methods: Vec::new(),
            properties: vec![property("id", RuntimeDataType::Uuid), prop],
        }
    }

    fn property(name: &str, data_type: RuntimeDataType) -> RuntimePropertyMetadata {
        RuntimePropertyMetadata {
            id: format!("prop-{name}"),
            name: name.to_string(),
            caption: name.to_string(),
            data_type,
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
        }
    }

    fn version_prop(name: &str, data_type: RuntimeDataType) -> RuntimePropertyMetadata {
        let mut prop = property(name, data_type);
        prop.is_concurrency_control = true;
        prop
    }

    #[test]
    fn get_record_version_returns_configured_concurrency_value() {
        let entity = entity_with_version_prop(version_prop("version", RuntimeDataType::Int64));
        let input = record(json!({
            "id": "00000000-0000-4000-8000-000000000001",
            "version": 42
        }));

        let version = get_record_version(&entity, &input).expect("version lookup should succeed");

        assert_eq!(version, Some(json!(42)));
    }

    #[test]
    fn get_record_version_returns_none_when_entity_has_no_concurrency_prop() {
        let mut entity = entity_with_version_prop(property("version", RuntimeDataType::Int64));
        for prop in &mut entity.properties {
            prop.is_concurrency_control = false;
        }
        let input = record(json!({ "version": 42 }));

        let version = get_record_version(&entity, &input).expect("version lookup should succeed");

        assert!(version.is_none());
    }

    #[test]
    fn get_record_version_uses_configured_property_name() {
        let entity = entity_with_version_prop(version_prop("row_version", RuntimeDataType::Int64));
        let input = record(json!({
            "version": 12,
            "row_version": 99
        }));

        let version = get_record_version(&entity, &input).expect("version lookup should succeed");

        assert_eq!(version, Some(json!(99)));
    }

    #[test]
    fn new_record_version_increments_int64_counter() {
        let prop = version_prop("version", RuntimeDataType::Int64);

        let first = new_record_version(&prop, &record(json!({})))
            .expect("new version should be generated")
            .expect("version value");
        assert_eq!(first, json!(1));

        let second = new_record_version(&prop, &record(json!({ "version": 7 })))
            .expect("new version should be generated")
            .expect("version value");
        assert_eq!(second, json!(8));
    }

    #[test]
    fn new_record_version_resets_javascript_unsafe_counters() {
        let prop = version_prop("version", RuntimeDataType::Int64);
        let unsafe_nano = 1_755_051_234_567_890_123_i64;
        let next = new_record_version(&prop, &record(json!({ "version": unsafe_nano })))
            .expect("new version should be generated")
            .expect("version value");
        assert_eq!(next, json!(1));
    }

    #[test]
    fn new_record_version_rejects_unsupported_concurrency_type() {
        let prop = version_prop("version", RuntimeDataType::String);

        let err = new_record_version(&prop, &record(json!({})))
            .expect_err("unsupported version type should fail");

        assert!(matches!(err, RuntimeError::Validation(_)));
        assert!(err
            .to_string()
            .contains("unsupported type for concurrency control 'version'"));
    }
}
