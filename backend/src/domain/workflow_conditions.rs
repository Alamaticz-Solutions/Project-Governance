use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ConditionOperator {
    Equals,
    NotEquals,
    Contains,
    GreaterThan,
    LessThan,
    In,
    NotIn,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ConditionType {
    GateStatus,
    FieldValue,
    PhaseStatus,
    DocumentExists,
    ApprovalStatus,
    RiskCondition,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConditionRule {
    #[serde(rename = "type")]
    pub condition_type: ConditionType,
    pub target: String,
    pub operator: ConditionOperator,
    pub value: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum LogicalOp {
    And,
    Or,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogicalGroup {
    pub logical_operator: LogicalOp,
    pub conditions: Vec<ConditionExpression>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ConditionExpression {
    Rule(ConditionRule),
    Group(LogicalGroup),
}

/// Represents the top-level configuration for a gate's conditions
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GateConditions {
    pub rules: Vec<ConditionExpression>,
}

/// Represents prerequisites. Can be a list of required gate codes.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GatePrerequisites {
    pub required_gates: Vec<String>,
}
