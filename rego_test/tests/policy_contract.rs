//! Rego access-policy coverage against this product's checked-in generated
//! policies, exercised through the framework's `appfw-test` policy verifier
//! against `backend/config/generated/schemas/governance/comment.rego`.
//!
//! Deliberately not covered: the author-ownership update/delete branch,
//! which reads `input.user.id` -- a field `AccessUser` does not carry.
//! That's docs/architecture/open-decisions.md decision A ("whether the actor id belongs in the
//! Rego input for single-row ownership filters"), still open. Testing that
//! branch would mean silently resolving an unresolved product decision
//! rather than reporting it, so it's left alone here.

use std::path::PathBuf;

use appfw_test::policy::{
    AccessAction, AccessInput, AccessResult, AccessUser, evaluate_access, evaluate_access_rule,
};
use serde_json::json;

fn comment_policy_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../backend/config/generated/schemas/governance/comment.rego")
}

fn user(roles: &[&str]) -> AccessUser {
    AccessUser::with_roles("180000", "test-user", roles)
}

#[test]
fn admin_role_has_full_access_on_any_action() {
    let path = comment_policy_path();
    for action in AccessAction::ALL {
        let input = AccessInput::for_action("governance", "comment", action, user(&["admin"]));
        assert_eq!(
            evaluate_access(&path, &input).unwrap_or_else(|err| panic!("{action}: {err:#}")),
            AccessResult::allowed(json!({})),
            "admin should be allowed to {action} comments"
        );
    }
}

#[test]
fn any_authenticated_role_may_read_and_create_comments() {
    let path = comment_policy_path();
    for role in ["project_manager", "viewer", "vendor_screening"] {
        for action in [AccessAction::Read, AccessAction::Create] {
            let input = AccessInput::for_action("governance", "comment", action, user(&[role]));
            assert_eq!(
                evaluate_access(&path, &input)
                    .unwrap_or_else(|err| panic!("{role}/{action}: {err:#}")),
                AccessResult::allowed(json!({})),
                "{role} should be allowed to {action} comments"
            );
        }
    }
}

#[test]
fn unrecognized_role_is_denied_by_default() {
    let path = comment_policy_path();
    let input = AccessInput::for_action(
        "governance",
        "comment",
        AccessAction::Read,
        user(&["not_a_real_role"]),
    );
    assert_eq!(
        evaluate_access(&path, &input).expect("policy should evaluate"),
        AccessResult::denied()
    );
}

#[test]
fn wrong_schema_or_entity_is_denied() {
    // Each entity gets its own rego file/package, so in production this
    // rule path is only ever evaluated for `comment` input -- this asserts
    // check_schema_type()'s defense-in-depth guard still denies a
    // mismatched entity_type, rather than deriving a rule path (via
    // evaluate_access) for an entity_type this file doesn't define at all.
    let path = comment_policy_path();
    let input = AccessInput::for_action(
        "governance",
        "gate_review",
        AccessAction::Read,
        user(&["admin"]),
    );
    assert_eq!(
        evaluate_access_rule(&path, "data.governance.comment.access", &input)
            .expect("policy should evaluate"),
        AccessResult::denied(),
        "comment.rego's check_schema_type() must reject a mismatched entity_type"
    );
}
