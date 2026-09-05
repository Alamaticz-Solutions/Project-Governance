//! Product-owned computed-property evaluation, ported off `appfw_runtime`
//! (backend framework replacement phase 5).

use std::collections::HashMap;

use appfw_runtime::{MetadataError, RuntimeError};
use inflector::cases::camelcase::{is_camel_case, to_camel_case};
use inflector::cases::pascalcase::{is_pascal_case, to_pascal_case};
use inflector::cases::tablecase::{is_table_case, to_table_case};
use inflector::cases::titlecase::{is_title_case, to_title_case};
use inflector::string::pluralize::to_plural;
use serde_json::{Map, Value};

use crate::platform::identifier::to_snake_case_lenient;

/// Which computed-property strategy applies to a property.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeComputedKind {
    Concatenate,
    Format,
    Word,
    Inflection,
    DateTimeNow,
    None,
}

/// Evaluates a computed property, dispatching on `computed`.
pub fn try_compute_property(
    computed: RuntimeComputedKind,
    property_name: &str,
    meta: Option<&Value>,
    record: &Map<String, Value>,
) -> Result<Option<Value>, RuntimeError> {
    match computed {
        RuntimeComputedKind::None => Ok(None),
        RuntimeComputedKind::DateTimeNow => {
            Ok(Some(Value::String(chrono::Utc::now().to_rfc3339())))
        }
        RuntimeComputedKind::Concatenate => compute_concatenate(property_name, meta, record),
        RuntimeComputedKind::Format => compute_format(property_name, meta, record),
        RuntimeComputedKind::Word => compute_word(property_name, meta, record),
        RuntimeComputedKind::Inflection => compute_inflection(property_name, meta, record),
    }
}

fn computed_block<'a>(
    meta: Option<&'a Value>,
    property_name: &str,
    block_name: &str,
) -> Result<&'a Value, RuntimeError> {
    meta.and_then(|meta| meta.get(block_name)).ok_or_else(|| {
        RuntimeError::Metadata(MetadataError::InvalidComputedMetadata {
            property_name: property_name.to_string(),
            message: format!("missing '{}' metadata block", block_name),
        })
    })
}

fn read_string_array_field(
    block: &Value,
    property_name: &str,
    field_name: &str,
) -> Result<Vec<String>, RuntimeError> {
    let items = block
        .get(field_name)
        .and_then(Value::as_array)
        .ok_or_else(|| {
            RuntimeError::Metadata(MetadataError::InvalidComputedMetadata {
                property_name: property_name.to_string(),
                message: format!("'{}' must be an array", field_name),
            })
        })?;

    let mut result = Vec::with_capacity(items.len());
    for item in items {
        let item = item.as_str().ok_or_else(|| {
            RuntimeError::Metadata(MetadataError::InvalidComputedMetadata {
                property_name: property_name.to_string(),
                message: format!("'{}' items must be strings", field_name),
            })
        })?;
        result.push(to_snake_case_lenient(item));
    }
    Ok(result)
}

fn read_string_field(
    block: &Value,
    property_name: &str,
    field_name: &str,
) -> Result<String, RuntimeError> {
    block
        .get(field_name)
        .and_then(Value::as_str)
        .map(|value| value.to_string())
        .ok_or_else(|| {
            RuntimeError::Metadata(MetadataError::InvalidComputedMetadata {
                property_name: property_name.to_string(),
                message: format!("'{}' must be a string", field_name),
            })
        })
}

fn read_optional_string_field(block: &Value, field_name: &str) -> Option<String> {
    block
        .get(field_name)
        .and_then(Value::as_str)
        .map(|value| value.to_string())
}

fn strip_quotes(value: &str) -> String {
    value.chars().filter(|ch| *ch != '"').collect()
}

fn compute_concatenate(
    property_name: &str,
    meta: Option<&Value>,
    record: &Map<String, Value>,
) -> Result<Option<Value>, RuntimeError> {
    let block = computed_block(meta, property_name, "ConcatenateComputed")?;
    let prop_names = read_string_array_field(block, property_name, "prop_names")?;
    let delimiter = read_optional_string_field(block, "delimiter").unwrap_or_default();

    let parts: Vec<String> = prop_names
        .iter()
        .filter_map(|name| record.get(name))
        .filter_map(Value::as_str)
        .map(strip_quotes)
        .collect();

    Ok(Some(Value::String(parts.join(&delimiter))))
}

fn compute_format(
    property_name: &str,
    meta: Option<&Value>,
    record: &Map<String, Value>,
) -> Result<Option<Value>, RuntimeError> {
    let block = computed_block(meta, property_name, "FormatComputed")?;
    let prop_names = read_string_array_field(block, property_name, "propNames")?;
    let template = read_string_field(block, property_name, "template")?;

    let mut vars: HashMap<String, String> = HashMap::new();
    for name in &prop_names {
        if let Some(value) = record.get(name).and_then(Value::as_str) {
            vars.insert(name.clone(), strip_quotes(value));
        }
    }

    let rendered = strfmt::strfmt(&template, &vars).map_err(|err| {
        RuntimeError::Validation(format!("format computed property failed: {}", err))
    })?;

    Ok(Some(Value::String(rendered)))
}

fn compute_word(
    property_name: &str,
    meta: Option<&Value>,
    record: &Map<String, Value>,
) -> Result<Option<Value>, RuntimeError> {
    let block = computed_block(meta, property_name, "WordComputed")?;
    let source_field =
        to_snake_case_lenient(&read_string_field(block, property_name, "sourceField")?);

    let result = record
        .get(&source_field)
        .and_then(Value::as_str)
        .map(|value| value.replace(' ', "_").to_lowercase())
        .unwrap_or_default();

    Ok(Some(Value::String(result)))
}

fn compute_inflection(
    property_name: &str,
    meta: Option<&Value>,
    record: &Map<String, Value>,
) -> Result<Option<Value>, RuntimeError> {
    let block = computed_block(meta, property_name, "InflectionComputed")?;
    let source_field =
        to_snake_case_lenient(&read_string_field(block, property_name, "sourceField")?);
    let name = to_snake_case_lenient(&read_string_field(block, property_name, "name")?);

    let source = match record.get(&source_field).and_then(Value::as_str) {
        Some(value) => value.to_string(),
        None => return Ok(Some(Value::String(String::new()))),
    };

    let result = match name.as_str() {
        "pascal_1" => {
            if is_pascal_case(&source) {
                source
            } else {
                to_pascal_case(&source)
            }
        }
        "pascal_n" => {
            let pascal_1 = if is_pascal_case(&source) {
                source
            } else {
                to_pascal_case(&source)
            };
            to_plural(&pascal_1)
        }
        "snake_1" => to_snake_case_lenient(&source),
        "snake_n" => {
            if is_table_case(&source) {
                source
            } else {
                to_table_case(&source)
            }
        }
        "caption_1" | "caption" => {
            if is_title_case(&source) {
                source
            } else {
                to_title_case(&source)
            }
        }
        "caption_n" => {
            let caption_1 = if is_title_case(&source) {
                source
            } else {
                to_title_case(&source)
            };
            to_plural(&caption_1)
        }
        "camel" => {
            if is_camel_case(&source) {
                source
            } else {
                to_camel_case(&source)
            }
        }
        other => {
            tracing::warn!(
                inflection = other,
                "unrecognized inflection name, passing source value through unchanged"
            );
            source
        }
    };

    Ok(Some(Value::String(result)))
}

#[cfg(test)]
mod tests {
    use chrono::{DateTime, Utc};
    use serde_json::json;

    use super::*;

    fn record(value: Value) -> Map<String, Value> {
        value.as_object().expect("record object").clone()
    }

    fn expect_string(result: Option<Value>) -> String {
        result
            .expect("computed value")
            .as_str()
            .expect("computed string")
            .to_string()
    }

    #[test]
    fn computed_none_returns_no_value() {
        let result = try_compute_property(
            RuntimeComputedKind::None,
            "name",
            None,
            &record(json!({ "name": "Acme" })),
        )
        .expect("none computed should succeed");

        assert!(result.is_none());
    }

    #[test]
    fn concatenate_computed_joins_string_fields_with_delimiter() {
        let meta = json!({
            "ConcatenateComputed": {
                "prop_names": ["firstName", "last_name"],
                "delimiter": " "
            }
        });

        let result = try_compute_property(
            RuntimeComputedKind::Concatenate,
            "full_name",
            Some(&meta),
            &record(json!({
                "first_name": "Ada",
                "last_name": "Lovelace"
            })),
        )
        .expect("concatenate should compute");

        assert_eq!(expect_string(result), "Ada Lovelace");
    }

    #[test]
    fn concatenate_computed_ignores_missing_and_non_string_fields() {
        let meta = json!({
            "ConcatenateComputed": {
                "prop_names": ["name", "missing", "count"],
                "delimiter": "-"
            }
        });

        let result = try_compute_property(
            RuntimeComputedKind::Concatenate,
            "display",
            Some(&meta),
            &record(json!({ "name": "Acme", "count": 12 })),
        )
        .expect("concatenate should skip unusable values");

        assert_eq!(expect_string(result), "Acme");
    }

    #[test]
    fn format_computed_renders_template_with_snake_case_field_names() {
        let meta = json!({
            "FormatComputed": {
                "propNames": ["firstName", "lastName"],
                "template": "{first_name} <{last_name}>"
            }
        });

        let result = try_compute_property(
            RuntimeComputedKind::Format,
            "label",
            Some(&meta),
            &record(json!({
                "first_name": "Ada",
                "last_name": "Lovelace"
            })),
        )
        .expect("format should compute");

        assert_eq!(expect_string(result), "Ada <Lovelace>");
    }

    #[test]
    fn format_computed_fails_when_template_variable_is_missing() {
        let meta = json!({
            "FormatComputed": {
                "propNames": ["firstName"],
                "template": "{first_name} {last_name}"
            }
        });

        let err = try_compute_property(
            RuntimeComputedKind::Format,
            "label",
            Some(&meta),
            &record(json!({ "first_name": "Ada" })),
        )
        .expect_err("missing template variable should fail");

        assert!(err.to_string().contains("format computed property failed"));
    }

    #[test]
    fn word_computed_normalizes_source_field_to_lower_underscore_word() {
        let meta = json!({
            "WordComputed": {
                "sourceField": "displayName"
            }
        });

        let result = try_compute_property(
            RuntimeComputedKind::Word,
            "slug",
            Some(&meta),
            &record(json!({ "display_name": "North America Sales" })),
        )
        .expect("word should compute");

        assert_eq!(expect_string(result), "north_america_sales");
    }

    #[test]
    fn word_computed_returns_empty_string_when_source_field_is_missing() {
        let meta = json!({
            "WordComputed": {
                "sourceField": "displayName"
            }
        });

        let result = try_compute_property(
            RuntimeComputedKind::Word,
            "slug",
            Some(&meta),
            &record(json!({})),
        )
        .expect("missing word source should be tolerated");

        assert_eq!(expect_string(result), "");
    }

    #[test]
    fn inflection_computed_supports_all_declared_inflections() {
        let cases = [
            ("pascal_1", "knowledge article", "KnowledgeArticle"),
            ("pascal_n", "knowledge article", "KnowledgeArticles"),
            ("snake_1", "KnowledgeArticle", "knowledge_article"),
            ("snake_n", "KnowledgeArticle", "knowledge_articles"),
            ("caption_1", "knowledge article", "Knowledge Article"),
            ("caption_n", "knowledge article", "Knowledge Articles"),
            ("camel", "knowledge article", "knowledgeArticle"),
            ("caption", "knowledge article", "Knowledge Article"),
        ];

        for (name, source, expected) in cases {
            let meta = json!({
                "InflectionComputed": {
                    "sourceField": "sourceName",
                    "name": name
                }
            });

            let result = try_compute_property(
                RuntimeComputedKind::Inflection,
                "computed_name",
                Some(&meta),
                &record(json!({ "source_name": source })),
            )
            .unwrap_or_else(|err| panic!("inflection {name} should compute: {err}"));

            assert_eq!(expect_string(result), expected, "inflection {name}");
        }
    }

    #[test]
    fn inflection_computed_returns_source_for_unknown_inflection_name() {
        let meta = json!({
            "InflectionComputed": {
                "sourceField": "sourceName",
                "name": "unknown_shape"
            }
        });

        let result = try_compute_property(
            RuntimeComputedKind::Inflection,
            "computed_name",
            Some(&meta),
            &record(json!({ "source_name": "Knowledge Article" })),
        )
        .expect("unknown inflection should fall back to source value");

        assert_eq!(expect_string(result), "Knowledge Article");
    }

    #[test]
    fn inflection_computed_returns_empty_string_when_source_field_is_missing() {
        let meta = json!({
            "InflectionComputed": {
                "sourceField": "sourceName",
                "name": "snake_1"
            }
        });

        let result = try_compute_property(
            RuntimeComputedKind::Inflection,
            "computed_name",
            Some(&meta),
            &record(json!({})),
        )
        .expect("missing inflection source should be tolerated");

        assert_eq!(expect_string(result), "");
    }

    #[test]
    fn datetime_now_computed_returns_valid_rfc3339_utc_timestamp() {
        let before = Utc::now();
        let result = try_compute_property(
            RuntimeComputedKind::DateTimeNow,
            "updated_at",
            None,
            &record(json!({})),
        )
        .expect("datetime now should compute");
        let after = Utc::now();

        let value = expect_string(result);
        let parsed = DateTime::parse_from_rfc3339(&value)
            .expect("computed datetime should be RFC3339")
            .with_timezone(&Utc);

        assert!(parsed >= before);
        assert!(parsed <= after);
    }

    #[test]
    fn missing_computed_metadata_block_fails_closed() {
        let err = try_compute_property(
            RuntimeComputedKind::Concatenate,
            "full_name",
            None,
            &record(json!({})),
        )
        .expect_err("missing computed metadata should fail");

        assert!(matches!(
            err,
            RuntimeError::Metadata(MetadataError::InvalidComputedMetadata { .. })
        ));
        assert!(err
            .to_string()
            .contains("missing 'ConcatenateComputed' metadata block"));
    }

    #[test]
    fn malformed_string_array_metadata_fails_closed() {
        let meta = json!({
            "ConcatenateComputed": {
                "prop_names": "firstName"
            }
        });

        let err = try_compute_property(
            RuntimeComputedKind::Concatenate,
            "full_name",
            Some(&meta),
            &record(json!({})),
        )
        .expect_err("malformed prop_names should fail");

        assert!(matches!(
            err,
            RuntimeError::Metadata(MetadataError::InvalidComputedMetadata { .. })
        ));
        assert!(err.to_string().contains("'prop_names' must be an array"));
    }

    #[test]
    fn non_string_array_item_metadata_fails_closed() {
        let meta = json!({
            "ConcatenateComputed": {
                "prop_names": ["firstName", 12]
            }
        });

        let err = try_compute_property(
            RuntimeComputedKind::Concatenate,
            "full_name",
            Some(&meta),
            &record(json!({})),
        )
        .expect_err("non-string prop_names item should fail");

        assert!(matches!(
            err,
            RuntimeError::Metadata(MetadataError::InvalidComputedMetadata { .. })
        ));
        assert!(err
            .to_string()
            .contains("'prop_names' items must be strings"));
    }

    #[test]
    fn malformed_string_metadata_fails_closed() {
        let meta = json!({
            "FormatComputed": {
                "propNames": ["firstName"],
                "template": 42
            }
        });

        let err = try_compute_property(
            RuntimeComputedKind::Format,
            "label",
            Some(&meta),
            &record(json!({ "first_name": "Ada" })),
        )
        .expect_err("non-string template should fail");

        assert!(matches!(
            err,
            RuntimeError::Metadata(MetadataError::InvalidComputedMetadata { .. })
        ));
        assert!(err.to_string().contains("'template' must be a string"));
    }
}
