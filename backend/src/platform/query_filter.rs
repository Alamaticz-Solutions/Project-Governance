//! Filter operator vocabulary: tokens, the `RuntimeFilterOp` enum, and raw
//! filter-input normalization. Ported near-verbatim off
//! `appfw_runtime::query_filter` (backend framework replacement phase 7,
//! slice 4 -- docs/architecture/self-owned-backend-plan.md).
//!
//! Scoped down from the framework's version: the filter-*capabilities*
//! reporting API (`RuntimeFilterCapabilities`, `RuntimeFilterOperatorSpec`,
//! `runtime_filter_capabilities_for_provider`, and friends) is NOT ported
//! here -- confirmed its only consumer in this product is `admin_ui.rs`'s
//! introspection endpoint, which is still framework-owned pending slice 6.
//! This module covers only the operator vocabulary the actual filter-
//! building path (`data/clients/postgres/filter*.rs`) uses.

use serde_json::{Map, Value};

use crate::platform::errors::RuntimeError;

pub mod conjunction_token {
    pub const AND: &str = "_and";
    pub const OR: &str = "_or";
}

pub mod filter_token {
    pub const EQUALS: &str = "_eq";
    pub const NOT_EQUALS: &str = "_ne";

    pub const LESS_THAN: &str = "_lt";
    pub const LESS_THAN_OR_EQUAL: &str = "_lte";
    pub const GREATER_THAN: &str = "_gt";
    pub const GREATER_THAN_OR_EQUAL: &str = "_gte";

    pub const REGEX: &str = "_regex";

    pub const STARTS_WITH: &str = "_starts";
    pub const CONTAINS: &str = "_contains";
    pub const NOT_CONTAINS: &str = "_not_contains";
    pub const ENDS_WITH: &str = "_ends";

    pub const OVERLAPS: &str = "_overlaps";
    pub const NOT_OVERLAPS: &str = "_not_overlaps";

    pub const CONTAINED_BY: &str = "_contained_by";
    pub const NOT_CONTAINED_BY: &str = "_not_contained_by";

    pub const IN: &str = "_in";
    pub const NOT_IN: &str = "_not_in";

    pub const BEFORE: &str = "_before";
    pub const DURING: &str = "_during";
    pub const AFTER: &str = "_after";

    pub const HAS: &str = "has";
}

pub type RuntimeFilterObject = Map<String, Value>;

pub fn normalize_filter_input(
    input: Option<Value>,
) -> Result<Option<RuntimeFilterObject>, RuntimeError> {
    match input {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Object(object)) if object.is_empty() => Ok(None),
        Some(Value::Object(object)) => Ok(Some(object)),
        Some(Value::String(raw)) => {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                return Ok(None);
            }
            match serde_json::from_str::<Value>(trimmed) {
                Ok(Value::Object(object)) if object.is_empty() => Ok(None),
                Ok(Value::Object(object)) => Ok(Some(object)),
                Ok(other) => Err(RuntimeError::Validation(format!(
                    "filter must be a JSON object or a JSON-encoded object string, got {}",
                    value_kind(&other)
                ))),
                Err(err) => Err(RuntimeError::Validation(format!(
                    "filter string is not valid JSON: {}",
                    err
                ))),
            }
        }
        Some(other) => Err(RuntimeError::Validation(format!(
            "filter must be a JSON object or a JSON-encoded object string, got {}",
            value_kind(&other)
        ))),
    }
}

pub fn value_kind(value: &Value) -> &'static str {
    match value {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RuntimeFilterOp {
    Eq,
    Ne,
    Lt,
    Lte,
    Gt,
    Gte,
    Regex,
    StartsWith,
    Contains,
    NotContains,
    EndsWith,
    Overlaps,
    NotOverlaps,
    ContainedBy,
    NotContainedBy,
    In,
    NotIn,
    Before,
    During,
    After,
    Has,
}

impl RuntimeFilterOp {
    pub fn from_token(token: &str) -> Result<Self, RuntimeError> {
        match token {
            filter_token::EQUALS | "eq" => Ok(Self::Eq),
            filter_token::NOT_EQUALS | "ne" => Ok(Self::Ne),
            filter_token::LESS_THAN => Ok(Self::Lt),
            filter_token::LESS_THAN_OR_EQUAL => Ok(Self::Lte),
            filter_token::GREATER_THAN => Ok(Self::Gt),
            filter_token::GREATER_THAN_OR_EQUAL => Ok(Self::Gte),
            filter_token::REGEX => Ok(Self::Regex),
            filter_token::STARTS_WITH => Ok(Self::StartsWith),
            filter_token::CONTAINS => Ok(Self::Contains),
            filter_token::NOT_CONTAINS => Ok(Self::NotContains),
            filter_token::ENDS_WITH => Ok(Self::EndsWith),
            filter_token::OVERLAPS => Ok(Self::Overlaps),
            filter_token::NOT_OVERLAPS => Ok(Self::NotOverlaps),
            filter_token::CONTAINED_BY => Ok(Self::ContainedBy),
            filter_token::NOT_CONTAINED_BY => Ok(Self::NotContainedBy),
            filter_token::IN => Ok(Self::In),
            filter_token::NOT_IN => Ok(Self::NotIn),
            filter_token::BEFORE => Ok(Self::Before),
            filter_token::DURING => Ok(Self::During),
            filter_token::AFTER => Ok(Self::After),
            filter_token::HAS => Ok(Self::Has),
            other => Err(RuntimeError::Validation(format!(
                "unknown filter operator '{}'",
                other
            ))),
        }
    }

    pub fn as_filter_token(self) -> &'static str {
        match self {
            Self::Eq => filter_token::EQUALS,
            Self::Ne => filter_token::NOT_EQUALS,
            Self::Lt => filter_token::LESS_THAN,
            Self::Lte => filter_token::LESS_THAN_OR_EQUAL,
            Self::Gt => filter_token::GREATER_THAN,
            Self::Gte => filter_token::GREATER_THAN_OR_EQUAL,
            Self::Regex => filter_token::REGEX,
            Self::StartsWith => filter_token::STARTS_WITH,
            Self::Contains => filter_token::CONTAINS,
            Self::NotContains => filter_token::NOT_CONTAINS,
            Self::EndsWith => filter_token::ENDS_WITH,
            Self::Overlaps => filter_token::OVERLAPS,
            Self::NotOverlaps => filter_token::NOT_OVERLAPS,
            Self::ContainedBy => filter_token::CONTAINED_BY,
            Self::NotContainedBy => filter_token::NOT_CONTAINED_BY,
            Self::In => filter_token::IN,
            Self::NotIn => filter_token::NOT_IN,
            Self::Before => filter_token::BEFORE,
            Self::During => filter_token::DURING,
            Self::After => filter_token::AFTER,
            Self::Has => filter_token::HAS,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filter_ops_parse_and_round_trip_tokens() {
        let op = RuntimeFilterOp::from_token(filter_token::CONTAINS).expect("contains token");
        assert_eq!(op, RuntimeFilterOp::Contains);
        assert_eq!(op.as_filter_token(), filter_token::CONTAINS);
        assert_eq!(
            RuntimeFilterOp::from_token("eq").unwrap(),
            RuntimeFilterOp::Eq
        );
        assert!(RuntimeFilterOp::from_token("_bogus").is_err());
        assert_eq!(conjunction_token::AND, "_and");
        assert_eq!(conjunction_token::OR, "_or");
    }

    #[test]
    fn normalize_filter_input_treats_empty_object_and_null_as_absent() {
        assert_eq!(normalize_filter_input(None).unwrap(), None);
        assert_eq!(normalize_filter_input(Some(Value::Null)).unwrap(), None);
        assert_eq!(
            normalize_filter_input(Some(Value::Object(Map::new()))).unwrap(),
            None
        );
    }

    #[test]
    fn normalize_filter_input_parses_a_json_encoded_string() {
        let parsed = normalize_filter_input(Some(Value::String(
            r#"{"name": {"_eq": "casey"}}"#.to_string(),
        )))
        .expect("parses")
        .expect("non-empty");
        assert_eq!(parsed.get("name").unwrap()["_eq"], "casey");
    }

    #[test]
    fn normalize_filter_input_rejects_non_object_json() {
        let err = normalize_filter_input(Some(Value::String("[1,2,3]".to_string()))).unwrap_err();
        assert!(matches!(err, RuntimeError::Validation(_)));
    }
}
