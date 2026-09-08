# Project Governance — Policy Tests

Rego access-policy coverage for the product's generated `governance` policies,
exercised through the framework's `appfw-test` policy verifier
(`appfw_test::policy::{evaluate_access, evaluate_access_rule}`).

`tests/policy_contract.rs` runs the checked-in policy fixtures against
`backend/config/generated/schemas/governance/comment.rego`; the other entity
policies are not covered yet (see Coverage goals).

```bash
# needs the sibling ../app-framework checkout (appfw-test is a path dependency)
cargo test -p rego_test
```

## Coverage goals

- Deny-by-default is explicit: an entity with no matching allow rule is
  inaccessible, not open.
- Positive and negative fixtures per entity, built from the product users,
  roles, workflows, and data classifications in the legacy application
  analysis — including out-of-scope-role denials and IDOR-style attempts.
- Row-scope fixtures for every single-row owner filter before release. The
  author-ownership branch that reads `input.user.id` is blocked on
  `docs/architecture/open-decisions.md` decision A and is intentionally not
  covered yet.
