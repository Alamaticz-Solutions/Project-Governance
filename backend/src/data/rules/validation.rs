//! Product-owned field validation, ported off `appfw_runtime` (backend
//! framework replacement phase 5).

use std::cmp::Ordering;

use appfw_runtime::model_metadata::{
    RuntimeDataType, RuntimeEntityMetadata, RuntimePropertyMetadata,
};
use appfw_runtime::RuntimeError;
use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use regex::{Regex, RegexBuilder};
use serde_json::{Map, Value};

use crate::platform::policy::AccessAction;

/// Validates every property of `record` against `entity`'s metadata. Only
/// runs on writes (`Create`/`Update`) -- reads and deletes are not
/// validated. Uniqueness validators are intentionally skipped here; they are
/// enforced elsewhere against live data, not against the in-memory record.
pub fn validate_record(
    entity: &RuntimeEntityMetadata,
    record: &Map<String, Value>,
    action: AccessAction,
) -> Result<(), RuntimeError> {
    if action != AccessAction::Create && action != AccessAction::Update {
        return Ok(());
    }

    for prop in &entity.properties {
        let value = record.get(&prop.name);
        let missing = value.map(value_is_missing).unwrap_or(true);

        if prop.is_required && !prop.is_read_only && missing {
            return Err(property_error(entity, prop, None, "is required"));
        }

        for validator in property_validators(&prop.name, prop.meta.as_ref())? {
            let kind = validator_kind(validator)?;
            match kind {
                ValidatorKind::Uniqueness => continue,
                ValidatorKind::StringLength => {
                    if !missing {
                        validate_string_length(entity, prop, validator, value.unwrap())?;
                    }
                }
                ValidatorKind::ArrayLength => {
                    if !missing {
                        validate_array_length(entity, prop, validator, value.unwrap())?;
                    }
                }
                ValidatorKind::StringPattern => {
                    if !missing {
                        validate_string_pattern(entity, prop, validator, value.unwrap())?;
                    }
                }
                ValidatorKind::ValueRange => {
                    if !missing {
                        validate_value_range(entity, prop, validator, value.unwrap(), record)?;
                    }
                }
                ValidatorKind::Function => {
                    validate_function(entity, prop, validator, value, record)?;
                }
            }
        }
    }

    Ok(())
}

/// A value counts as "missing" if it's JSON `null`, or a JSON string whose
/// trimmed content is empty. Every other JSON type is never "missing"
/// regardless of content.
fn value_is_missing(value: &Value) -> bool {
    match value {
        Value::Null => true,
        Value::String(s) => s.trim().is_empty(),
        _ => false,
    }
}

pub fn property_validators<'a>(
    property_name: &str,
    meta: Option<&'a Value>,
) -> Result<Vec<&'a Value>, RuntimeError> {
    let Some(meta) = meta else {
        return Ok(Vec::new());
    };
    let Some(validators) = meta.get("validators") else {
        return Ok(Vec::new());
    };

    let array = validators.as_array().ok_or_else(|| {
        RuntimeError::Validation(format!(
            "{} validators metadata must be an array",
            property_name
        ))
    })?;

    Ok(array.iter().collect())
}

pub fn is_validator_named(validator: &Value, expected_name: &str) -> bool {
    normalize_validator_name(validator_name_field(validator))
        == normalize_validator_name(expected_name)
}

pub fn validator_message(validator: &Value, default_message: &str) -> String {
    match validator.get("message").and_then(Value::as_str) {
        Some(message) if !message.trim().is_empty() => message.to_string(),
        _ => default_message.to_string(),
    }
}

fn validator_name_field(validator: &Value) -> &str {
    validator.get("name").and_then(Value::as_str).unwrap_or("")
}

fn strip_ascii_whitespace_underscore_hyphen(value: &str) -> String {
    value
        .chars()
        .filter(|ch| !(ch.is_ascii_whitespace() || *ch == '_' || *ch == '-'))
        .collect()
}

fn normalize_validator_name(name: &str) -> String {
    let stripped = name.strip_suffix("Validator").unwrap_or(name);
    strip_ascii_whitespace_underscore_hyphen(&stripped.to_lowercase())
}

fn normalize_source_name(name: &str) -> String {
    strip_ascii_whitespace_underscore_hyphen(&name.to_lowercase())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ValidatorKind {
    ValueRange,
    ArrayLength,
    StringLength,
    StringPattern,
    Uniqueness,
    Function,
}

fn validator_kind(validator: &Value) -> Result<ValidatorKind, RuntimeError> {
    let name = validator
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| RuntimeError::Validation("validator is missing name".to_string()))?;

    match normalize_validator_name(name).as_str() {
        "valuerange" => Ok(ValidatorKind::ValueRange),
        "arraylength" => Ok(ValidatorKind::ArrayLength),
        "stringlength" => Ok(ValidatorKind::StringLength),
        "stringpattern" => Ok(ValidatorKind::StringPattern),
        "uniqueness" => Ok(ValidatorKind::Uniqueness),
        "function" => Ok(ValidatorKind::Function),
        _ => Err(RuntimeError::Validation(format!(
            "unsupported validator '{}'",
            name
        ))),
    }
}

fn validate_string_length(
    entity: &RuntimeEntityMetadata,
    prop: &RuntimePropertyMetadata,
    validator: &Value,
    value: &Value,
) -> Result<(), RuntimeError> {
    let s = value.as_str().ok_or_else(|| {
        property_error(
            entity,
            prop,
            Some(validator),
            "StringLength expects a string value",
        )
    })?;
    let len = s.chars().count();

    if let Some(min) = optional_usize(validator, "min")
        .map_err(|message| property_error(entity, prop, Some(validator), &message))?
    {
        if len < min {
            return Err(property_error(
                entity,
                prop,
                Some(validator),
                &format!("must be at least {min} characters"),
            ));
        }
    }
    if let Some(max) = optional_usize(validator, "max")
        .map_err(|message| property_error(entity, prop, Some(validator), &message))?
    {
        if len > max {
            return Err(property_error(
                entity,
                prop,
                Some(validator),
                &format!("must be at most {max} characters"),
            ));
        }
    }
    Ok(())
}

fn validate_array_length(
    entity: &RuntimeEntityMetadata,
    prop: &RuntimePropertyMetadata,
    validator: &Value,
    value: &Value,
) -> Result<(), RuntimeError> {
    let arr = value.as_array().ok_or_else(|| {
        property_error(
            entity,
            prop,
            Some(validator),
            "ArrayLength expects an array value",
        )
    })?;
    let len = arr.len();

    if let Some(min) = optional_usize(validator, "min")
        .map_err(|message| property_error(entity, prop, Some(validator), &message))?
    {
        if len < min {
            return Err(property_error(
                entity,
                prop,
                Some(validator),
                &format!("must contain at least {min} item(s)"),
            ));
        }
    }
    if let Some(max) = optional_usize(validator, "max")
        .map_err(|message| property_error(entity, prop, Some(validator), &message))?
    {
        if len > max {
            return Err(property_error(
                entity,
                prop,
                Some(validator),
                &format!("must contain at most {max} item(s)"),
            ));
        }
    }
    Ok(())
}

fn validate_string_pattern(
    entity: &RuntimeEntityMetadata,
    prop: &RuntimePropertyMetadata,
    validator: &Value,
    value: &Value,
) -> Result<(), RuntimeError> {
    let s = value.as_str().ok_or_else(|| {
        property_error(
            entity,
            prop,
            Some(validator),
            "StringPattern expects a string value",
        )
    })?;

    let raw_pattern = validator
        .get("pattern")
        .and_then(Value::as_str)
        .or_else(|| validator.get("expression").and_then(Value::as_str))
        .ok_or_else(|| {
            property_error(
                entity,
                prop,
                Some(validator),
                "StringPattern is missing pattern",
            )
        })?;

    let (pattern, flags) = split_regex_pattern(raw_pattern);
    let regex = build_regex(pattern, flags).map_err(|message| {
        property_error(
            entity,
            prop,
            Some(validator),
            &format!("StringPattern is invalid: {message}"),
        )
    })?;

    if !regex.is_match(s) {
        return Err(property_error(
            entity,
            prop,
            Some(validator),
            "does not match the required pattern",
        ));
    }
    Ok(())
}

fn validate_value_range(
    entity: &RuntimeEntityMetadata,
    prop: &RuntimePropertyMetadata,
    validator: &Value,
    value: &Value,
    record: &Map<String, Value>,
) -> Result<(), RuntimeError> {
    let current = comparable_from_value(prop.data_type, value)
        .map_err(|message| property_error(entity, prop, Some(validator), &message))?;

    if let Some(min_raw) = resolve_range_bound(validator, "min", "min_source", record)
        .map_err(|message| property_error(entity, prop, Some(validator), &message))?
    {
        let min = comparable_from_value(prop.data_type, &min_raw)
            .map_err(|message| property_error(entity, prop, Some(validator), &message))?;
        let ordering = current
            .compare(&min)
            .map_err(|message| property_error(entity, prop, Some(validator), &message))?;
        if ordering == Ordering::Less {
            return Err(property_error(
                entity,
                prop,
                Some(validator),
                "is below the allowed minimum",
            ));
        }
    }

    if let Some(max_raw) = resolve_range_bound(validator, "max", "max_source", record)
        .map_err(|message| property_error(entity, prop, Some(validator), &message))?
    {
        let max = comparable_from_value(prop.data_type, &max_raw)
            .map_err(|message| property_error(entity, prop, Some(validator), &message))?;
        let ordering = current
            .compare(&max)
            .map_err(|message| property_error(entity, prop, Some(validator), &message))?;
        if ordering == Ordering::Greater {
            return Err(property_error(
                entity,
                prop,
                Some(validator),
                "is above the allowed maximum",
            ));
        }
    }

    Ok(())
}

fn validate_function(
    entity: &RuntimeEntityMetadata,
    prop: &RuntimePropertyMetadata,
    validator: &Value,
    value: Option<&Value>,
    record: &Map<String, Value>,
) -> Result<(), RuntimeError> {
    let func = validator
        .get("func")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            property_error(
                entity,
                prop,
                Some(validator),
                "Function validator is missing func",
            )
        })?;

    let parts: Vec<&str> = func.split(':').collect();
    let this_missing = value.map(value_is_missing).unwrap_or(true);

    match parts.as_slice() {
        ["required_when", field_name, expected] => {
            if record_value_matches(record, field_name, expected) && this_missing {
                return Err(property_error(entity, prop, Some(validator), "is required"));
            }
            Ok(())
        }
        ["forbidden_when", field_name, expected] => {
            if record_value_matches(record, field_name, expected) && !this_missing {
                return Err(property_error(
                    entity,
                    prop,
                    Some(validator),
                    "is not allowed",
                ));
            }
            Ok(())
        }
        ["gte_field", field_name] => {
            if this_missing {
                return Ok(());
            }
            let Some(other_raw) = lookup_record_value(record, field_name) else {
                return Ok(());
            };
            if value_is_missing(other_raw) {
                return Ok(());
            }
            let this_value = value.expect("this_missing checked above");
            let this = comparable_from_value(prop.data_type, this_value)
                .map_err(|message| property_error(entity, prop, Some(validator), &message))?;
            let other = comparable_from_value(prop.data_type, other_raw)
                .map_err(|message| property_error(entity, prop, Some(validator), &message))?;
            let ordering = this
                .compare(&other)
                .map_err(|message| property_error(entity, prop, Some(validator), &message))?;
            if ordering == Ordering::Less {
                return Err(property_error(
                    entity,
                    prop,
                    Some(validator),
                    "must be greater than or equal to the referenced field",
                ));
            }
            Ok(())
        }
        ["lte_field", field_name] => {
            if this_missing {
                return Ok(());
            }
            let Some(other_raw) = lookup_record_value(record, field_name) else {
                return Ok(());
            };
            if value_is_missing(other_raw) {
                return Ok(());
            }
            let this_value = value.expect("this_missing checked above");
            let this = comparable_from_value(prop.data_type, this_value)
                .map_err(|message| property_error(entity, prop, Some(validator), &message))?;
            let other = comparable_from_value(prop.data_type, other_raw)
                .map_err(|message| property_error(entity, prop, Some(validator), &message))?;
            let ordering = this
                .compare(&other)
                .map_err(|message| property_error(entity, prop, Some(validator), &message))?;
            if ordering == Ordering::Greater {
                return Err(property_error(
                    entity,
                    prop,
                    Some(validator),
                    "must be less than or equal to the referenced field",
                ));
            }
            Ok(())
        }
        _ => Err(property_error(
            entity,
            prop,
            Some(validator),
            &format!("unsupported business validator function '{}'", func),
        )),
    }
}

#[derive(Debug, Clone)]
enum Comparable {
    Number(f64),
    String(String),
    Date(NaiveDate),
    DateTime(NaiveDateTime),
    Time(NaiveTime),
}

impl Comparable {
    fn compare(&self, other: &Self) -> Result<Ordering, String> {
        match (self, other) {
            (Comparable::Number(a), Comparable::Number(b)) => a
                .partial_cmp(b)
                .ok_or_else(|| "range comparison encountered a non-finite number".to_string()),
            (Comparable::String(a), Comparable::String(b)) => Ok(a.cmp(b)),
            (Comparable::Date(a), Comparable::Date(b)) => Ok(a.cmp(b)),
            (Comparable::DateTime(a), Comparable::DateTime(b)) => Ok(a.cmp(b)),
            (Comparable::Time(a), Comparable::Time(b)) => Ok(a.cmp(b)),
            _ => Err("range comparison values have incompatible types".to_string()),
        }
    }
}

fn number_from_value(value: &Value) -> Result<f64, String> {
    if let Some(n) = value.as_f64() {
        return Ok(n);
    }
    if let Some(s) = value.as_str() {
        return s
            .parse::<f64>()
            .map_err(|_| "numeric range validation expects a number".to_string());
    }
    Err("numeric range validation expects a number".to_string())
}

fn string_from_value(value: &Value) -> Result<String, String> {
    match value {
        Value::String(s) => Ok(s.clone()),
        Value::Number(n) => Ok(n.to_string()),
        Value::Bool(b) => Ok(b.to_string()),
        _ => Err("range validation expects a scalar value".to_string()),
    }
}

fn comparable_from_value(data_type: RuntimeDataType, value: &Value) -> Result<Comparable, String> {
    match data_type {
        RuntimeDataType::Int8
        | RuntimeDataType::Int16
        | RuntimeDataType::Int32
        | RuntimeDataType::Int64
        | RuntimeDataType::Float32
        | RuntimeDataType::Float64 => Ok(Comparable::Number(number_from_value(value)?)),
        RuntimeDataType::Date => {
            let s = string_from_value(value)?;
            let date = NaiveDate::parse_from_str(&s, "%Y-%m-%d")
                .map_err(|err| format!("invalid date value '{}': {}", s, err))?;
            Ok(Comparable::Date(date))
        }
        RuntimeDataType::DateTime => {
            let s = string_from_value(value)?;
            Ok(Comparable::DateTime(parse_datetime(&s)?))
        }
        RuntimeDataType::Time => {
            let s = string_from_value(value)?;
            Ok(Comparable::Time(parse_time(&s)?))
        }
        RuntimeDataType::String | RuntimeDataType::Enum => {
            Ok(Comparable::String(string_from_value(value)?))
        }
        other => Err(format!("ValueRange is unsupported for {:?}", other)),
    }
}

fn parse_datetime(value: &str) -> Result<NaiveDateTime, String> {
    if let Ok(dt) = DateTime::parse_from_rfc3339(value) {
        return Ok(dt.with_timezone(&Utc).naive_utc());
    }
    if let Ok(dt) = NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S%.f") {
        return Ok(dt);
    }
    match NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S%.f") {
        Ok(dt) => Ok(dt),
        Err(err) => Err(format!("invalid date-time value '{}': {}", value, err)),
    }
}

fn parse_time(value: &str) -> Result<NaiveTime, String> {
    if let Ok(t) = NaiveTime::parse_from_str(value, "%H:%M:%S%.f") {
        return Ok(t);
    }
    match NaiveTime::parse_from_str(value, "%H:%M") {
        Ok(t) => Ok(t),
        Err(err) => Err(format!("invalid time value '{}': {}", value, err)),
    }
}

fn validator_source(validator: &Value, source_key: &str) -> String {
    let raw = validator
        .get(source_key)
        .and_then(Value::as_str)
        .unwrap_or("Literal");
    normalize_source_name(raw)
}

fn resolve_range_bound<'a>(
    validator: &'a Value,
    value_key: &str,
    source_key: &str,
    record: &'a Map<String, Value>,
) -> Result<Option<Value>, String> {
    let Some(raw) = validator.get(value_key) else {
        return Ok(None);
    };
    if raw.is_null() {
        return Ok(None);
    }

    let source = validator_source(validator, source_key);
    match source.as_str() {
        "literal" => Ok(Some(raw.clone())),
        "fieldreference" => {
            let field_name = raw.as_str().ok_or_else(|| {
                format!(
                    "{} must be a field name when {} is FieldReference",
                    value_key, source_key
                )
            })?;
            let looked_up = lookup_record_value(record, field_name);
            match looked_up {
                Some(value) if !value_is_missing(value) => Ok(Some(value.clone())),
                _ => Err(format!(
                    "range bound references missing field '{}'",
                    field_name
                )),
            }
        }
        "expression" | "function" => Err(format!(
            "{} range bound sources are not supported at runtime",
            source
        )),
        other => Err(format!("unsupported range bound source '{}'", other)),
    }
}

pub fn render_uniqueness_filter(
    filter: &str,
    record: &Map<String, Value>,
) -> Result<Value, RuntimeError> {
    let parsed: Value = serde_json::from_str(filter).map_err(|err| {
        RuntimeError::Validation(format!("uniqueness filter must be valid JSON: {}", err))
    })?;

    render_filter_value(&parsed, record).map_err(RuntimeError::Validation)
}

fn render_filter_value(value: &Value, record: &Map<String, Value>) -> Result<Value, String> {
    match value {
        Value::String(s) => render_filter_string(s, record),
        Value::Object(map) => {
            let mut result = Map::new();
            for (key, v) in map {
                result.insert(key.clone(), render_filter_value(v, record)?);
            }
            Ok(Value::Object(result))
        }
        Value::Array(items) => {
            let mut result = Vec::with_capacity(items.len());
            for item in items {
                result.push(render_filter_value(item, record)?);
            }
            Ok(Value::Array(result))
        }
        other => Ok(other.clone()),
    }
}

fn extract_placeholder_field(s: &str) -> Option<&str> {
    if let Some(inner) = s
        .strip_prefix("{{")
        .and_then(|rest| rest.strip_suffix("}}"))
    {
        return Some(inner);
    }
    if let Some(inner) = s.strip_prefix("${").and_then(|rest| rest.strip_suffix("}")) {
        return Some(inner);
    }
    if let Some(inner) = s.strip_prefix('$') {
        if !inner.starts_with('{') {
            return Some(inner);
        }
    }
    if let Some(inner) = s.strip_prefix('{').and_then(|rest| rest.strip_suffix('}')) {
        return Some(inner);
    }
    None
}

fn render_filter_string(s: &str, record: &Map<String, Value>) -> Result<Value, String> {
    let Some(field_name) = extract_placeholder_field(s) else {
        return Ok(Value::String(s.to_string()));
    };

    if field_name.trim().is_empty() {
        return Ok(Value::String(s.to_string()));
    }

    match lookup_record_value(record, field_name) {
        Some(value) if !value_is_missing(value) => Ok(value.clone()),
        _ => Err(format!(
            "uniqueness filter references missing field '{}'",
            field_name
        )),
    }
}

// Not yet called by a product call site (mirrors an appfw_runtime export
// that also had no in-product caller), but kept as public API surface for
// whichever slice later builds the uniqueness-conflict check into
// data_access.rs's own filter-based query, rather than dropping it.
#[allow(dead_code)]
pub fn uniqueness_conflict(
    pk_name: &str,
    record: &Map<String, Value>,
    candidates: &[Map<String, Value>],
) -> bool {
    let current_pk = record.get(pk_name).and_then(value_to_string);

    candidates.iter().any(|candidate| {
        let candidate_pk = candidate.get(pk_name).and_then(value_to_string);
        match (&current_pk, &candidate_pk) {
            (Some(current), Some(candidate)) => current != candidate,
            _ => true,
        }
    })
}

fn value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(s) if !s.is_empty() => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        Value::Bool(b) => Some(b.to_string()),
        _ => None,
    }
}

fn lookup_record_value<'a>(record: &'a Map<String, Value>, field_name: &str) -> Option<&'a Value> {
    record
        .get(field_name)
        .or_else(|| record.get(&to_snake_case_lenient(field_name)))
}

fn looks_like_snake_case(value: &str) -> bool {
    if value.is_empty() {
        return false;
    }
    if value.starts_with('_') || value.ends_with('_') {
        return false;
    }
    if value.contains("__") {
        return false;
    }
    value
        .chars()
        .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_')
}

fn to_snake_case_lenient(value: &str) -> String {
    if looks_like_snake_case(value) {
        return value.to_string();
    }

    let chars: Vec<char> = value.chars().collect();
    let mut result = String::with_capacity(chars.len() + 4);

    for (i, &ch) in chars.iter().enumerate() {
        if ch == '_' || ch == '-' || ch.is_whitespace() {
            if !result.is_empty() && !result.ends_with('_') {
                result.push('_');
            }
            continue;
        }

        if ch.is_uppercase() {
            let prev_lower_or_digit =
                i > 0 && (chars[i - 1].is_lowercase() || chars[i - 1].is_ascii_digit());
            let next_lower = i + 1 < chars.len() && chars[i + 1].is_lowercase();
            if !result.is_empty() && !result.ends_with('_') && (prev_lower_or_digit || next_lower) {
                result.push('_');
            }
            for lower_ch in ch.to_lowercase() {
                result.push(lower_ch);
            }
            continue;
        }

        result.push(ch);
    }

    result.trim_matches('_').to_string()
}

fn record_value_matches(record: &Map<String, Value>, field_name: &str, expected: &str) -> bool {
    match lookup_record_value(record, field_name) {
        Some(value) => match value_to_string(value) {
            Some(s) => s == expected,
            None => false,
        },
        None => false,
    }
}

fn optional_usize(validator: &Value, key: &str) -> Result<Option<usize>, String> {
    let Some(raw) = validator.get(key) else {
        return Ok(None);
    };
    if raw.is_null() {
        return Ok(None);
    }

    let err_msg = format!("{key} must be a non-negative integer");

    if let Some(n) = raw.as_i64() {
        if n < 0 {
            return Err(err_msg);
        }
        return Ok(Some(n as usize));
    }
    if let Some(s) = raw.as_str() {
        let parsed: i64 = s
            .parse()
            .map_err(|err| format!("{key} must be a non-negative integer: {err}"))?;
        if parsed < 0 {
            return Err(err_msg);
        }
        return Ok(Some(parsed as usize));
    }
    Err(err_msg)
}

fn split_regex_pattern(pattern: &str) -> (&str, &str) {
    if !pattern.starts_with('/') {
        return (pattern, "");
    }

    // Deliberately not short-circuiting on the first unescaped `/`: the
    // closing delimiter is the *last* unescaped slash in the string, so a
    // pattern body may itself contain literal (escaped or not) slashes and
    // everything after the final slash is treated as flags.
    let mut escaped = false;
    let mut close_idx: Option<usize> = None;

    for (idx, ch) in pattern.char_indices().skip(1) {
        if escaped {
            escaped = false;
            continue;
        }
        if ch == '\\' {
            escaped = true;
            continue;
        }
        if ch == '/' {
            close_idx = Some(idx);
        }
    }

    match close_idx {
        Some(idx) if idx > 0 => (&pattern[1..idx], &pattern[idx + 1..]),
        _ => (pattern, ""),
    }
}

fn build_regex(pattern: &str, flags: &str) -> Result<Regex, String> {
    let mut builder = RegexBuilder::new(pattern);

    for flag in flags.chars() {
        match flag {
            'i' => {
                builder.case_insensitive(true);
            }
            'm' => {
                builder.multi_line(true);
            }
            's' => {
                builder.dot_matches_new_line(true);
            }
            'g' | 'u' => {}
            other => return Err(format!("unsupported regex flag '{}'", other)),
        }
    }

    builder.build().map_err(|err| err.to_string())
}

fn property_error(
    entity: &RuntimeEntityMetadata,
    prop: &RuntimePropertyMetadata,
    validator: Option<&Value>,
    default_message: &str,
) -> RuntimeError {
    let message = match validator {
        Some(validator) => validator_message(validator, default_message),
        None => default_message.to_string(),
    };
    RuntimeError::Validation(format!("{}.{}: {}", entity.pascal_1, prop.name, message))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn entity(properties: Vec<RuntimePropertyMetadata>) -> RuntimeEntityMetadata {
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
            facets: Vec::new(),
            meta: None,
            standard_methods: Vec::new(),
            custom_methods: Vec::new(),
            properties,
        }
    }

    fn property(
        name: &str,
        data_type: RuntimeDataType,
        validators: Value,
    ) -> RuntimePropertyMetadata {
        RuntimePropertyMetadata {
            id: format!("{}-id", name),
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
            meta: Some(json!({ "validators": validators })),
        }
    }

    fn required_property(name: &str, data_type: RuntimeDataType) -> RuntimePropertyMetadata {
        let mut property = property(name, data_type, json!([]));
        property.is_required = true;
        property
    }

    fn record(value: Value) -> Map<String, Value> {
        value.as_object().unwrap().clone()
    }

    fn expect_validation_error(result: Result<(), RuntimeError>, text: &str) {
        let err = result.expect_err("expected validation error");
        assert!(
            err.to_string().contains(text),
            "expected '{err}' to contain '{text}'"
        );
    }

    #[test]
    fn validate_record_rejects_missing_required_fields() {
        let entity = entity(vec![required_property("name", RuntimeDataType::String)]);
        let record = record(json!({ "name": "" }));

        expect_validation_error(
            validate_record(&entity, &record, AccessAction::Create),
            "is required",
        );
    }

    #[test]
    fn validate_record_enforces_length_validators() {
        let entity = entity(vec![
            property(
                "name",
                RuntimeDataType::String,
                json!([{ "name": "StringLength", "min": 2, "max": 4, "message": "bad length" }]),
            ),
            property(
                "tags",
                RuntimeDataType::StringArray,
                json!([{ "name": "ArrayLength", "min": 1, "max": 2 }]),
            ),
        ]);

        assert!(validate_record(
            &entity,
            &record(json!({ "name": "Acme", "tags": ["a"] })),
            AccessAction::Update,
        )
        .is_ok());
        expect_validation_error(
            validate_record(
                &entity,
                &record(json!({ "name": "A", "tags": ["a"] })),
                AccessAction::Update,
            ),
            "bad length",
        );
        expect_validation_error(
            validate_record(
                &entity,
                &record(json!({ "name": "Acme", "tags": ["a", "b", "c"] })),
                AccessAction::Update,
            ),
            "at most 2",
        );
    }

    #[test]
    fn validate_record_enforces_string_pattern() {
        let entity = entity(vec![property(
            "email",
            RuntimeDataType::String,
            json!([{ "name": "StringPattern", "expression": "/^[^@]+@[^@]+$/", "message": "email only" }]),
        )]);

        assert!(validate_record(
            &entity,
            &record(json!({ "email": "a@example.com" })),
            AccessAction::Create,
        )
        .is_ok());
        expect_validation_error(
            validate_record(
                &entity,
                &record(json!({ "email": "not-email" })),
                AccessAction::Create,
            ),
            "email only",
        );
    }

    #[test]
    fn validate_record_enforces_value_range_with_field_reference() {
        let entity = entity(vec![property(
            "close_date",
            RuntimeDataType::Date,
            json!([{ "name": "ValueRange", "min": "open_date", "min_source": "FieldReference" }]),
        )]);

        assert!(validate_record(
            &entity,
            &record(json!({ "open_date": "2026-01-01", "close_date": "2026-01-02" })),
            AccessAction::Update,
        )
        .is_ok());
        expect_validation_error(
            validate_record(
                &entity,
                &record(json!({ "open_date": "2026-01-02", "close_date": "2026-01-01" })),
                AccessAction::Update,
            ),
            "below",
        );
    }

    #[test]
    fn validate_record_enforces_supported_function_validators() {
        let entity = entity(vec![
            property(
                "closed_reason",
                RuntimeDataType::String,
                json!([{ "name": "Function", "func": "required_when:status:Closed" }]),
            ),
            property(
                "end_date",
                RuntimeDataType::Date,
                json!([{ "name": "Function", "func": "gte_field:start_date" }]),
            ),
        ]);

        expect_validation_error(
            validate_record(
                &entity,
                &record(
                    json!({ "status": "Closed", "closed_reason": "", "start_date": "2026-01-02", "end_date": "2026-01-03" }),
                ),
                AccessAction::Update,
            ),
            "closed_reason",
        );
        expect_validation_error(
            validate_record(
                &entity,
                &record(
                    json!({ "status": "Open", "start_date": "2026-01-03", "end_date": "2026-01-02" }),
                ),
                AccessAction::Update,
            ),
            "greater than or equal",
        );
    }

    #[test]
    fn property_validators_reads_array_from_metadata() {
        let meta = json!({
            "validators": [
                { "name": "StringLength", "min": 2 },
                { "name": "Uniqueness", "filter": "{}" }
            ]
        });

        let validators = property_validators("name", Some(&meta)).expect("validators");

        assert_eq!(validators.len(), 2);
        assert!(is_validator_named(validators[0], "string_length"));
        assert!(is_validator_named(validators[1], "UniquenessValidator"));
    }

    #[test]
    fn property_validators_rejects_non_array_metadata() {
        let err = property_validators("name", Some(&json!({ "validators": true })))
            .expect_err("non-array metadata should fail");

        assert_eq!(
            err.to_string(),
            "validation error: name validators metadata must be an array"
        );
    }

    #[test]
    fn validator_message_uses_default_for_blank_message() {
        assert_eq!(
            validator_message(&json!({ "message": " " }), "must be unique"),
            "must be unique"
        );
        assert_eq!(
            validator_message(&json!({ "message": "custom" }), "must be unique"),
            "custom"
        );
    }

    #[test]
    fn uniqueness_filter_rendering_preserves_referenced_value_types() {
        let filter = render_uniqueness_filter(
            r#"{ "email": { "_eq": "$email" }, "tenant_id": { "_eq": "${tenantId}" }, "active": { "_eq": true } }"#,
            &record(json!({ "email": "a@example.com", "tenant_id": 42 })),
        )
        .expect("filter should render");

        assert_eq!(filter["email"]["_eq"], json!("a@example.com"));
        assert_eq!(filter["tenant_id"]["_eq"], json!(42));
        assert_eq!(filter["active"]["_eq"], json!(true));
    }

    #[test]
    fn uniqueness_filter_rendering_supports_mustache_placeholders() {
        let filter = render_uniqueness_filter(
            r#"{ "job_key": "{{job_key}}" }"#,
            &record(json!({ "job_key": "amerassist_collections_bad_debt_job" })),
        )
        .expect("mustache uniqueness filter should render");

        assert_eq!(
            filter["job_key"],
            json!("amerassist_collections_bad_debt_job")
        );
    }

    #[test]
    fn placeholder_lookup_preserves_digit_bearing_snake_case_names() {
        let filter = render_uniqueness_filter(
            r#"{ "q1_revenue": { "_eq": "$q1_revenue" }, "tenant_id": { "_eq": "$TenantID" } }"#,
            &record(json!({ "q1_revenue": 100, "tenant_id": "tenant-1" })),
        )
        .expect("filter should render");

        assert_eq!(filter["q1_revenue"]["_eq"], json!(100));
        assert_eq!(filter["tenant_id"]["_eq"], json!("tenant-1"));
    }

    #[test]
    fn uniqueness_conflict_ignores_current_record_on_update() {
        let current = record(json!({ "id": "1", "email": "a@example.com" }));
        let same = record(json!({ "id": "1" }));
        let other = record(json!({ "id": "2" }));

        assert!(!uniqueness_conflict("id", &current, &[same]));
        assert!(uniqueness_conflict("id", &current, &[other]));
    }

    // A digit immediately before an uppercase letter opens a new word, same
    // as a lowercase letter would -- not just "the next char is lowercase".
    #[test]
    fn snake_case_lookup_splits_before_a_capital_that_follows_a_digit() {
        let filter = render_uniqueness_filter(
            r#"{ "q1_id": { "_eq": "$q1ID" } }"#,
            &record(json!({ "q1_id": "abc-123" })),
        )
        .expect("filter should render");

        assert_eq!(filter["q1_id"]["_eq"], json!("abc-123"));
    }

    // The closing `/` of a `/pattern/flags` StringPattern is the *last*
    // unescaped slash in the string, not the first -- so a pattern body may
    // itself contain literal slashes.
    #[test]
    fn string_pattern_closing_slash_is_the_last_unescaped_one() {
        let entity = entity(vec![property(
            "path",
            RuntimeDataType::String,
            json!([{ "name": "StringPattern", "pattern": "/^/api/.*$/" }]),
        )]);

        assert!(validate_record(
            &entity,
            &record(json!({ "path": "/api/widgets" })),
            AccessAction::Create,
        )
        .is_ok());
        expect_validation_error(
            validate_record(
                &entity,
                &record(json!({ "path": "/other/widgets" })),
                AccessAction::Create,
            ),
            "does not match the required pattern",
        );
    }
}
