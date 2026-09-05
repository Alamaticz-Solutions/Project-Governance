//! Independent reimplementation of a handful of pure leaf validators/parsers
//! that historically lived in `appfw_runtime::query_ir`. This module does
//! **not** cover pagination or the signed keyset-cursor subsystem — those
//! remain framework-owned. See phase 5 slice 4b for scope.
#![allow(dead_code)]

use crate::product_api::{RuntimeDataType, RuntimePropertyMetadata};
use crate::routes::app_error::AppError;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum AggregateFunction {
    Count,
    CountDistinct,
    Sum,
    Avg,
    Min,
    Max,
}

impl AggregateFunction {
    /// Case-insensitive parse. Accepts these tokens (all case-insensitive):
    /// "count" -> Count; "count_distinct", "countdistinct", "count-distinct" -> CountDistinct;
    /// "sum" -> Sum; "avg", "average" -> Avg; "min" -> Min; "max" -> Max.
    pub(crate) fn from_name(value: &str) -> Result<Self, AppError> {
        let lowered = value.to_ascii_lowercase();
        match lowered.as_str() {
            "count" => Ok(Self::Count),
            "count_distinct" | "countdistinct" | "count-distinct" => Ok(Self::CountDistinct),
            "sum" => Ok(Self::Sum),
            "avg" | "average" => Ok(Self::Avg),
            "min" => Ok(Self::Min),
            "max" => Ok(Self::Max),
            _ => Err(AppError::Validation(format!(
                "unknown aggregate function '{value}'"
            ))),
        }
    }

    /// Stable string token: Count -> "count", CountDistinct -> "count_distinct",
    /// Sum -> "sum", Avg -> "avg", Min -> "min", Max -> "max".
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Count => "count",
            Self::CountDistinct => "count_distinct",
            Self::Sum => "sum",
            Self::Avg => "avg",
            Self::Min => "min",
            Self::Max => "max",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct AggregateFieldDescriptor {
    pub name: String,
    pub data_type: RuntimeDataType,
}

impl AggregateFieldDescriptor {
    pub(crate) fn new(name: impl Into<String>, data_type: RuntimeDataType) -> Self {
        Self {
            name: name.into(),
            data_type,
        }
    }
}

impl From<&RuntimePropertyMetadata> for AggregateFieldDescriptor {
    fn from(property: &RuntimePropertyMetadata) -> Self {
        Self::new(property.name.clone(), property.data_type)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum SortDirection {
    Asc,
    Desc,
}

impl SortDirection {
    /// Reads a JSON value as a sort direction: the string "desc"
    /// (case-insensitive) -> Desc; every other value (any other string,
    /// non-string, or absent) -> Asc. This is a lenient default-to-ascending
    /// reader, not a strict parser -- it never errors.
    pub(crate) fn from_value(value: &serde_json::Value) -> Self {
        match value.as_str() {
            Some(s) if s.eq_ignore_ascii_case("desc") => Self::Desc,
            _ => Self::Asc,
        }
    }

    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Asc => "asc",
            Self::Desc => "desc",
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct SortSpecInput {
    pub field: String,
    pub direction: SortDirection,
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct ScalarFilterPredicate {
    pub op: appfw_runtime::RuntimeFilterOp,
    pub value: serde_json::Value,
}

/// A short display name for a JSON value's kind, for error messages.
pub(crate) fn value_kind(value: &serde_json::Value) -> &'static str {
    match value {
        serde_json::Value::Null => "null",
        serde_json::Value::Bool(_) => "boolean",
        serde_json::Value::Number(_) => "number",
        serde_json::Value::String(_) => "string",
        serde_json::Value::Array(_) => "array",
        serde_json::Value::Object(_) => "object",
    }
}

/// Normalizes an optional JSON input into an object, treating `None`,
/// `Some(Value::Null)`, and an empty JSON object all as "no object" (`None`).
/// Also accepts a JSON-encoded object as a *string*.
pub(crate) fn normalize_object_input(
    input: Option<serde_json::Value>,
    label: &str,
) -> Result<Option<serde_json::Map<String, serde_json::Value>>, AppError> {
    let value = match input {
        None => return Ok(None),
        Some(serde_json::Value::Null) => return Ok(None),
        Some(v) => v,
    };

    match value {
        serde_json::Value::Object(obj) => {
            if obj.is_empty() {
                Ok(None)
            } else {
                Ok(Some(obj))
            }
        }
        serde_json::Value::String(s) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                return Ok(None);
            }
            let parsed: serde_json::Value = serde_json::from_str(trimmed).map_err(|e| {
                AppError::Validation(format!("{label} string is not valid JSON: {e}"))
            })?;
            match parsed {
                serde_json::Value::Object(obj) => {
                    if obj.is_empty() {
                        Ok(None)
                    } else {
                        Ok(Some(obj))
                    }
                }
                other => Err(AppError::Validation(format!(
                    "{label} must be a JSON object or a JSON-encoded object string, got {}",
                    value_kind(&other)
                ))),
            }
        }
        other => Err(AppError::Validation(format!(
            "{label} must be a JSON object or a JSON-encoded object string, got {}",
            value_kind(&other)
        ))),
    }
}

/// Same idea for arrays: `None`/`Null` -> `None`; a JSON array -> `Some(items)`
/// (even if empty); a string -> trimmed, empty -> `None`, else if it starts
/// with '[' parse as JSON array, otherwise wrap it as a single-element array.
pub(crate) fn normalize_array_input(
    input: Option<serde_json::Value>,
    label: &str,
) -> Result<Option<Vec<serde_json::Value>>, AppError> {
    let value = match input {
        None => return Ok(None),
        Some(serde_json::Value::Null) => return Ok(None),
        Some(v) => v,
    };

    match value {
        serde_json::Value::Array(items) => Ok(Some(items)),
        serde_json::Value::String(s) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                return Ok(None);
            }
            if trimmed.starts_with('[') {
                let parsed: serde_json::Value = serde_json::from_str(trimmed).map_err(|e| {
                    AppError::Validation(format!("{label} string is not valid JSON: {e}"))
                })?;
                match parsed {
                    serde_json::Value::Array(items) => Ok(Some(items)),
                    other => Err(AppError::Validation(format!(
                        "{label} must be a JSON array or a JSON-encoded array string, got {}",
                        value_kind(&other)
                    ))),
                }
            } else {
                Ok(Some(vec![serde_json::Value::String(trimmed.to_string())]))
            }
        }
        other => Err(AppError::Validation(format!(
            "{label} must be a JSON array or a JSON-encoded array string, got {}",
            value_kind(&other)
        ))),
    }
}

/// Requires `value` to be a JSON string; error "{label} must be a string" otherwise.
pub(crate) fn expect_string(value: serde_json::Value, label: &str) -> Result<String, AppError> {
    match value {
        serde_json::Value::String(s) => Ok(s),
        _ => Err(AppError::Validation(format!("{label} must be a string"))),
    }
}

/// Removes `key` from `obj` and requires it to be present and a string.
pub(crate) fn take_string(
    obj: &mut serde_json::Map<String, serde_json::Value>,
    key: &str,
    label: &str,
) -> Result<String, AppError> {
    match obj.remove(key) {
        Some(v) => expect_string(v, label),
        None => Err(AppError::Validation(format!("{label} requires '{key}'"))),
    }
}

/// Tries each key in `keys`, in order; removes and returns the first one
/// present as a string.
pub(crate) fn take_string_any(
    obj: &mut serde_json::Map<String, serde_json::Value>,
    keys: &[&str],
    label: &str,
) -> Result<String, AppError> {
    for key in keys {
        if let Some(v) = obj.remove(*key) {
            return expect_string(v, label);
        }
    }
    Err(AppError::Validation(format!(
        "{label} requires one of: {}",
        keys.join(", ")
    )))
}

/// Requires `value` to be a JSON array of objects (used for filter
/// conjunctions like `_and`/`_or`).
pub(crate) fn normalize_filter_conjunction_items(
    key: &str,
    value: serde_json::Value,
) -> Result<Vec<serde_json::Map<String, serde_json::Value>>, AppError> {
    let items = match value {
        serde_json::Value::Array(items) => items,
        _ => {
            return Err(AppError::Validation(format!(
                "filter conjunction '{key}' expects an array"
            )))
        }
    };

    items
        .into_iter()
        .map(|item| match item {
            serde_json::Value::Object(obj) => Ok(obj),
            _ => Err(AppError::Validation(format!(
                "filter conjunction '{key}' expects object items"
            ))),
        })
        .collect()
}

/// Requires `value` to be a JSON object (used for one relationship-filter field).
pub(crate) fn expect_relationship_filter_object(
    relationship_kind: &str,
    field_name: &str,
    value: serde_json::Value,
) -> Result<serde_json::Map<String, serde_json::Value>, AppError> {
    match value {
        serde_json::Value::Object(obj) => Ok(obj),
        _ => Err(AppError::Validation(format!(
            "{relationship_kind} filter '{field_name}' expects an object"
        ))),
    }
}

/// Parses a single scalar filter value into one or more operator predicates.
pub(crate) fn scalar_filter_predicates(
    field_name: &str,
    value: serde_json::Value,
) -> Result<Vec<ScalarFilterPredicate>, AppError> {
    match value {
        serde_json::Value::Object(obj) => {
            if obj.len() == 1 && obj.contains_key("$oid") {
                return Ok(vec![ScalarFilterPredicate {
                    op: appfw_runtime::RuntimeFilterOp::Eq,
                    value: serde_json::Value::Object(obj),
                }]);
            }
            if obj.is_empty() {
                return Err(AppError::Validation(format!(
                    "filter operator object for '{field_name}' must not be empty"
                )));
            }
            obj.into_iter()
                .map(|(key, val)| {
                    let op = appfw_runtime::RuntimeFilterOp::from_token(&key)?;
                    Ok(ScalarFilterPredicate { op, value: val })
                })
                .collect()
        }
        other => Ok(vec![ScalarFilterPredicate {
            op: appfw_runtime::RuntimeFilterOp::Eq,
            value: other,
        }]),
    }
}

/// Parses a sort input into an ordered list of field/direction pairs,
/// preserving the object's key order. `None` input -> empty vec.
pub(crate) fn parse_sort_specs(
    input: Option<serde_json::Value>,
) -> Result<Vec<SortSpecInput>, AppError> {
    let obj = normalize_object_input(input, "sort")?;
    let Some(obj) = obj else {
        return Ok(Vec::new());
    };

    Ok(obj
        .into_iter()
        .map(|(field, value)| SortSpecInput {
            field,
            direction: SortDirection::from_value(&value),
        })
        .collect())
}

/// A valid aggregate output alias: non-empty, first character is an ASCII
/// letter or underscore, every subsequent character is an ASCII
/// alphanumeric or underscore.
pub(crate) fn validate_aggregate_output_alias(alias: &str) -> Result<(), AppError> {
    let mut chars = alias.chars();
    let Some(first) = chars.next() else {
        return Err(AppError::Validation(
            "aggregate output alias must not be empty".to_string(),
        ));
    };
    if !(first.is_ascii_alphabetic() || first == '_') {
        return Err(AppError::Validation(format!(
            "aggregate output alias '{alias}' must start with a letter or underscore"
        )));
    }
    for c in chars {
        if !(c.is_ascii_alphanumeric() || c == '_') {
            return Err(AppError::Validation(format!(
                "aggregate output alias '{alias}' may contain only letters, numbers, and underscores"
            )));
        }
    }
    Ok(())
}

/// Errors on the first duplicate found (case-sensitive) when iterating in order.
pub(crate) fn validate_unique_aggregate_aliases<I, S>(aliases: I) -> Result<(), AppError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut seen: Vec<String> = Vec::new();
    for alias in aliases {
        let alias = alias.as_ref();
        if seen.iter().any(|s| s == alias) {
            return Err(AppError::Validation(format!(
                "duplicate aggregate output alias '{alias}'"
            )));
        }
        seen.push(alias.to_string());
    }
    Ok(())
}

/// True iff `alias` case-sensitively equals one of `aliases`.
pub(crate) fn aggregate_alias_exists<I, S>(aliases: I, alias: &str) -> bool
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    aliases.into_iter().any(|a| a.as_ref() == alias)
}

/// A field is groupable iff its data type is a scalar-aggregate type.
pub(crate) fn ensure_aggregate_groupable(field: &AggregateFieldDescriptor) -> Result<(), AppError> {
    if field.data_type.is_scalar_aggregate() {
        Ok(())
    } else {
        Err(AppError::Validation(format!(
            "property '{}' with type {:?} cannot be used in group_by",
            field.name, field.data_type
        )))
    }
}

/// Validates a metric field against its aggregate function.
pub(crate) fn validate_aggregate_metric_field(
    function: AggregateFunction,
    field: Option<&AggregateFieldDescriptor>,
) -> Result<(), AppError> {
    match function {
        AggregateFunction::Count => {
            if let Some(field) = field {
                if !field.data_type.is_scalar_aggregate() {
                    return Err(AppError::Validation(format!(
                        "property '{}' with type {:?} cannot be used in aggregate metrics",
                        field.name, field.data_type
                    )));
                }
            }
            Ok(())
        }
        AggregateFunction::CountDistinct => {
            let field = field.ok_or_else(|| {
                AppError::Validation("count_distinct metrics require a field".to_string())
            })?;
            if !field.data_type.is_scalar_aggregate() {
                return Err(AppError::Validation(format!(
                    "property '{}' with type {:?} cannot be used in aggregate metrics",
                    field.name, field.data_type
                )));
            }
            Ok(())
        }
        AggregateFunction::Sum | AggregateFunction::Avg => {
            let field = field.ok_or_else(|| {
                AppError::Validation(format!(
                    "{} metrics require a numeric field",
                    function.as_str()
                ))
            })?;
            if !field.data_type.is_numeric() {
                return Err(AppError::Validation(format!(
                    "{} metric field '{}' must be numeric",
                    function.as_str(),
                    field.name
                )));
            }
            Ok(())
        }
        AggregateFunction::Min | AggregateFunction::Max => {
            let field = field.ok_or_else(|| {
                AppError::Validation(format!("{} metrics require a field", function.as_str()))
            })?;
            if !field.data_type.is_scalar_aggregate() {
                return Err(AppError::Validation(format!(
                    "property '{}' with type {:?} cannot be used in aggregate metrics",
                    field.name, field.data_type
                )));
            }
            Ok(())
        }
    }
}

/// Default alias for a metric.
pub(crate) fn default_aggregate_metric_alias(
    function: AggregateFunction,
    field_name: Option<&str>,
) -> String {
    match (function, field_name) {
        (AggregateFunction::Count, None) => "count".to_string(),
        (function, Some(name)) => format!("{}_{}", function.as_str(), name),
        (function, None) => function.as_str().to_string(),
    }
}

/// Only these operators are valid in an aggregate HAVING clause: Eq, Ne, Lt,
/// Lte, Gt, Gte, In, NotIn.
pub(crate) fn ensure_aggregate_having_op(
    op: appfw_runtime::RuntimeFilterOp,
) -> Result<(), AppError> {
    use appfw_runtime::RuntimeFilterOp;
    match op {
        RuntimeFilterOp::Eq
        | RuntimeFilterOp::Ne
        | RuntimeFilterOp::Lt
        | RuntimeFilterOp::Lte
        | RuntimeFilterOp::Gt
        | RuntimeFilterOp::Gte
        | RuntimeFilterOp::In
        | RuntimeFilterOp::NotIn => Ok(()),
        other => Err(AppError::Validation(format!(
            "operator '{}' is not supported in aggregate having",
            other.as_filter_token()
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aggregate_function_names_are_parsed_case_insensitively() {
        assert_eq!(
            AggregateFunction::from_name("COUNT").expect("count"),
            AggregateFunction::Count
        );
        assert_eq!(
            AggregateFunction::from_name("count-distinct").expect("count distinct"),
            AggregateFunction::CountDistinct
        );
        assert_eq!(AggregateFunction::Avg.as_str(), "avg");
        assert!(AggregateFunction::from_name("median").is_err());
    }

    #[test]
    fn aggregate_alias_validation_rules() {
        validate_aggregate_output_alias("total_age").expect("valid alias");
        validate_unique_aggregate_aliases(["is_active", "total_age"]).expect("unique aliases");
        assert!(validate_aggregate_output_alias("1bad").is_err());
        assert!(validate_unique_aggregate_aliases(["count", "count"]).is_err());
        assert!(aggregate_alias_exists(["count", "total_age"], "total_age"));
    }

    #[test]
    fn aggregate_metric_validation_uses_field_descriptors() {
        let age = AggregateFieldDescriptor::new("age", RuntimeDataType::Int32);
        let name = AggregateFieldDescriptor::new("name", RuntimeDataType::String);
        let contacts = AggregateFieldDescriptor::new("contacts", RuntimeDataType::NavToMany);

        validate_aggregate_metric_field(AggregateFunction::Sum, Some(&age)).expect("sum numeric");
        validate_aggregate_metric_field(AggregateFunction::CountDistinct, Some(&name))
            .expect("count distinct scalar");
        ensure_aggregate_groupable(&name).expect("string groupable");

        assert!(validate_aggregate_metric_field(AggregateFunction::Sum, Some(&name)).is_err());
        assert!(validate_aggregate_metric_field(AggregateFunction::CountDistinct, None).is_err());
        assert!(ensure_aggregate_groupable(&contacts).is_err());
        assert_eq!(
            default_aggregate_metric_alias(AggregateFunction::Sum, Some("age")),
            "sum_age"
        );
    }

    #[test]
    fn aggregate_having_operator_policy() {
        ensure_aggregate_having_op(appfw_runtime::RuntimeFilterOp::Gte).expect("gte supported");
        assert!(ensure_aggregate_having_op(appfw_runtime::RuntimeFilterOp::Contains).is_err());
    }

    #[test]
    fn parser_input_normalization() {
        assert_eq!(
            normalize_object_input(Some(serde_json::json!(r#"{"name":"Acme"}"#)), "filter")
                .expect("object string")
                .expect("object")["name"],
            serde_json::json!("Acme")
        );
        assert_eq!(
            normalize_array_input(Some(serde_json::json!("name")), "group_by")
                .expect("array")
                .expect("array"),
            vec![serde_json::json!("name")]
        );
        assert!(normalize_object_input(Some(serde_json::json!([1])), "filter").is_err());
        assert!(
            normalize_array_input(Some(serde_json::json!({ "name": "Acme" })), "group_by").is_err()
        );
    }

    #[test]
    fn parser_string_extraction() {
        let mut obj = serde_json::json!({ "field": "age", "function": "sum" })
            .as_object()
            .cloned()
            .expect("object");

        assert_eq!(
            take_string(&mut obj, "field", "metric").expect("field"),
            "age"
        );
        assert_eq!(
            take_string_any(&mut obj, &["fn", "function"], "metric function").expect("function"),
            "sum"
        );
        assert!(take_string_any(&mut obj, &["fn", "function"], "metric function").is_err());
        assert!(expect_string(serde_json::json!(1), "metric alias").is_err());
    }

    #[test]
    fn filter_conjunction_and_relationship_shape_checks() {
        let items = normalize_filter_conjunction_items(
            "_and",
            serde_json::json!([{ "name": { "_eq": "Acme" } }, { "age": { "_gt": 10 } }]),
        )
        .expect("conjunction items");
        assert_eq!(items.len(), 2);

        let relation = expect_relationship_filter_object(
            "navigation",
            "industry",
            serde_json::json!({ "name": "Tech" }),
        )
        .expect("relationship filter");
        assert_eq!(relation["name"], serde_json::json!("Tech"));

        assert!(normalize_filter_conjunction_items("_and", serde_json::json!({})).is_err());
        assert!(expect_relationship_filter_object(
            "navigation",
            "industry",
            serde_json::json!("Tech")
        )
        .is_err());
    }

    #[test]
    fn scalar_filter_predicate_parsing() {
        let predicates =
            scalar_filter_predicates("age", serde_json::json!({ "_gt": 10, "_lt": 20 }))
                .expect("predicates");
        assert_eq!(predicates.len(), 2);
        assert!(predicates
            .iter()
            .any(|p| p.op == appfw_runtime::RuntimeFilterOp::Gt));
        assert!(predicates
            .iter()
            .any(|p| p.op == appfw_runtime::RuntimeFilterOp::Lt));

        let default_eq =
            scalar_filter_predicates("name", serde_json::json!("Acme")).expect("default eq");
        assert_eq!(default_eq[0].op, appfw_runtime::RuntimeFilterOp::Eq);
        assert_eq!(default_eq[0].value, serde_json::json!("Acme"));

        let object_id =
            scalar_filter_predicates("id", serde_json::json!({ "$oid": "abc" })).expect("oid");
        assert_eq!(object_id[0].op, appfw_runtime::RuntimeFilterOp::Eq);
        assert!(scalar_filter_predicates("age", serde_json::json!({})).is_err());
        assert!(scalar_filter_predicates("age", serde_json::json!({ "_bogus": 1 })).is_err());
    }

    #[test]
    fn sort_specs_parse_fields_and_directions() {
        let specs = parse_sort_specs(Some(serde_json::json!({
            "created_at": "desc",
            "name": "asc"
        })))
        .expect("sort specs");

        assert_eq!(
            specs,
            vec![
                SortSpecInput {
                    field: "created_at".to_string(),
                    direction: SortDirection::Desc
                },
                SortSpecInput {
                    field: "name".to_string(),
                    direction: SortDirection::Asc
                },
            ]
        );

        assert!(parse_sort_specs(Some(serde_json::json!(["name"]))).is_err());
    }
}
