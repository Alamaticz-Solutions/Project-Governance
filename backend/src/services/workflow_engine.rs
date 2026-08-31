use crate::domain::workflow_conditions::{ConditionExpression, ConditionOperator, ConditionRule, ConditionType, GateConditions, GatePrerequisites, LogicalOp};
use serde_json::Value;

pub struct EligibilityEngine;

impl EligibilityEngine {
    pub fn evaluate_conditions(conditions: &GateConditions, context: &Value) -> bool {
        if conditions.rules.is_empty() {
            return true;
        }
        
        // Treat top-level rules as AND
        for rule in &conditions.rules {
            if !Self::evaluate_expression(rule, context) {
                return false;
            }
        }
        true
    }

    fn evaluate_expression(expr: &ConditionExpression, context: &Value) -> bool {
        match expr {
            ConditionExpression::Rule(rule) => Self::evaluate_rule(rule, context),
            ConditionExpression::Group(group) => {
                match group.logical_operator {
                    LogicalOp::And => {
                        for sub_expr in &group.conditions {
                            if !Self::evaluate_expression(sub_expr, context) {
                                return false;
                            }
                        }
                        true
                    }
                    LogicalOp::Or => {
                        for sub_expr in &group.conditions {
                            if Self::evaluate_expression(sub_expr, context) {
                                return true;
                            }
                        }
                        false
                    }
                }
            }
        }
    }

    fn evaluate_rule(rule: &ConditionRule, context: &Value) -> bool {
        let actual_value = match rule.condition_type {
            ConditionType::FieldValue => {
                context.get("fields").and_then(|f| f.get(&rule.target))
            }
            ConditionType::GateStatus => {
                context.get("gates").and_then(|g| g.get(&rule.target).and_then(|s| s.get("status")))
            }
            ConditionType::PhaseStatus => {
                context.get("phases").and_then(|p| p.get(&rule.target).and_then(|s| s.get("status")))
            }
            // Add other condition types as needed
            _ => None,
        };

        let actual = match actual_value {
            Some(v) => v,
            None => return false, // If the field is missing, evaluation fails (unless operator is NotEquals maybe, but simple for now)
        };

        match rule.operator {
            ConditionOperator::Equals => actual == &rule.value,
            ConditionOperator::NotEquals => actual != &rule.value,
            ConditionOperator::GreaterThan => {
                if let (Some(a), Some(b)) = (actual.as_f64(), rule.value.as_f64()) {
                    a > b
                } else {
                    false
                }
            }
            ConditionOperator::LessThan => {
                if let (Some(a), Some(b)) = (actual.as_f64(), rule.value.as_f64()) {
                    a < b
                } else {
                    false
                }
            }
            ConditionOperator::Contains => {
                if let (Some(s), Some(substr)) = (actual.as_str(), rule.value.as_str()) {
                    s.contains(substr)
                } else {
                    false
                }
            }
            ConditionOperator::In => {
                if let Some(arr) = rule.value.as_array() {
                    arr.contains(actual)
                } else {
                    false
                }
            }
            ConditionOperator::NotIn => {
                if let Some(arr) = rule.value.as_array() {
                    !arr.contains(actual)
                } else {
                    true
                }
            }
        }
    }
}
