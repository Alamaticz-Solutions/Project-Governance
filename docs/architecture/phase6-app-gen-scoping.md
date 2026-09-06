# Phase 6 scoping: the self-owned `app_gen` replacement

Status: draft architecture scoping, 2026-09-06. This is the "treat it as its own
project" pass the plan doc calls for before any generator code gets written.
Nothing here has been implemented; this is the map, not the port.

## 1. What this product actually invokes today

The framework's CLI surface is much larger than what this product uses. Grepping
this repo (specs, README, HANDOFF.md, package READMEs, `.appfw/agent-profile.yaml`)
for real invocations — not what the framework *could* do — gives the actual
target surface:

- `scripts/appfw product validate --json`
- `scripts/appfw product generate` / `generate --check --json`
- `scripts/appfw product boundary-check --json`
- `scripts/appfw product feature-check --json`
- `scripts/appfw product policy-test --json`
- `scripts/appfw product test` / `test --fast --json`
- `scripts/appfw product api-test`
- `scripts/appfw product migrate doctor` / `migrate plan --json` / `migrate lint --phase all --json` / `migrate rollback-guide --json`
- `scripts/appfw product serve`
- `scripts/appfw product handoff --json`, `product review-brief --auto-depth --json`, `product harness-check --json`

Everything else the framework's `scripts/appfw` (16,941 lines of bash+embedded
Python) or `appfw_introspect` binary (19,127 lines, 408 fns — `explain`,
`lock`, `upgrade`, `new`, `analyze`, `propose-model`, `intake-proof`,
`golden-downstream`) can do is **framework-side dev/release/certification/
product-intake tooling this product never calls**. It is not in scope. Only
`boundary-check` from that introspect binary's command list is both (a) real
tooling this product depends on (spec 002 cites it as the mechanism enforcing
`route → handler → _impl → service → DataAccess` layering) and (b)
self-contained — it's a `syn`-based static check over this repo's own Rust
source, not multi-provider machinery, so it's cheap to reproduce independent of
everything else in that binary.

**Finding, not assumption:** `HANDOFF.md` already states "anything that shells
through `scripts/appfw` cannot run until the framework [is restored]" — the
product's `validate`/`generate --check`/`policy-test`/`boundary-check` gates
are non-functional *right now*, not just something phase 6 would eventually
improve. That raises this phase's priority; it isn't purely defensive scope
reduction anymore.

## 2. What `app_gen` actually does (traced from `execute_codegen`)

`app_gen`'s pipeline (`app_gen/src/lib.rs::execute_codegen`) runs, in order:

1. `dev_infra::preflight` — dependency/output-path safety checks (generate mode only)
2. `validation::run` — the model linter (6,710 lines — by far the largest single module)
3. `sync_descriptor::emit_sync_descriptor_report`
4. `schemas::run` — parses `.appfw/model/**` into an in-memory IR (`generator_ir`)
5. `frontend::run(ir)` — emits `frontend/src/generated/appfw-ui-contract.ts`
6. `backend::run` — emits Rust: `operations/generated.rs`, `handlers/*/generated.rs`, schema/Rego/DDL outputs
7. `sync_worker::run`
8. `dev_infra::run` — remaining dev-infra artifacts

Module sizes (`app_gen/src/*.rs`, lines):

| Module | Lines | Role | Option B disposition |
|---|---|---|---|
| `main.rs` | 5 | entry point | trivial |
| `schema_route.rs` | 23 | route path segment helper | trivial, reproduce as-is |
| `schemas.rs` | 86 | per-schema orchestrator | reproduce |
| `relationship_config.rs` | 90 | relationship model parsing | reproduce |
| `lib.rs` | 118 | pipeline wiring | reproduce |
| `schema.rs` | 290 | single-schema IR builder | reproduce |
| `api.rs` | 311 | `generate`/`validate` public entry + `Codegen*` types | reproduce |
| `app_workspace.rs` | 318 | CLI arg/root resolution | reproduce, simplified (no multi-repo framework/generator/templates root juggling — this is a single-repo product) |
| `sync_worker.rs` | 383 | background sync worker codegen | **cut** — no SaaS sync providers in this product (phase 1/2 already deleted `appfw_mssql_auth`/inlined `appfw_saas_core`); confirm nothing here is load-bearing before cutting |
| `normalized_config.rs` | 552 | model normalization pass | reproduce |
| `backend.rs` | 839 | Rust codegen: routes/handlers/operations | reproduce — **highest-value module**, but see §3 below on the `appfw_runtime` type dependency in its *output* |
| `app_manifest.rs` | 1,015 | app manifest handling | reproduce, likely shrinks — much of this is multi-provider/multi-environment manifest shape |
| `sync_descriptor.rs` | 1,179 | sync descriptor emission | **cut**, same reasoning as `sync_worker.rs` |
| `config_contract.rs` | 1,843 | config contract schema/validation | reproduce, audit for provider-specific branches first |
| `frontend.rs` | 2,138 | TS UI contract emission | reproduce — target is `appfw-ui-contract.ts` (see §4, this file is 37,512 lines in this product) |
| `dev_infra.rs` | 2,384 | dev tooling, dependency preflight | reproduce a reduced subset; large fraction of this is framework-packaging concerns (installed binaries, generator root discovery) that don't apply once the generator is in-tree |
| `validation.rs` | 6,710 | the model linter | reproduce, but **audit line-by-line for provider-specific lint rules** (MSSQL/Mongo/Snowflake naming constraints, sync/SaaS-specific lints) before committing to porting all 6,710 lines — this is the single biggest place Option B can cut real weight |

No module is pure dead weight, but `sync_worker.rs` + `sync_descriptor.rs`
(1,562 lines combined) look cuttable outright pending confirmation, and
`validation.rs`/`config_contract.rs`/`app_manifest.rs`/`dev_infra.rs`
(~11,800 lines combined) are where a real per-branch provider audit — not
a guess — will materially shrink the port. That audit is real Phase 6 work,
not a resolved item here.

## 3. A finding that changes the shape of Phase 6: generated code is still framework-typed

`backend/src/operations/generated.rs` (6,857 lines) imports:

```rust
use appfw_runtime::{
    extension::UserAuth,
    operation::{self, RuntimeOperation, RuntimeOperationArg, RuntimeOperationCatalog,
                RuntimeOperationDispatcher, RuntimeOperationRequest},
};
```

Phases 1–5 removed `appfw_runtime` from the **runtime request-handling path**
(`DataAccess`, policy checks, provider clients). They did not — and were never
scoped to — touch what the *generator emits*. The generated Rust surface
(`operations/generated.rs`, `handlers/*/generated.rs`, 13,822 lines together in
this product) is written directly against framework types (`UserAuth`,
`RuntimeOperation*`), not product ones.

This means Phase 6 is not just "write a generator that emits the same files."
It is that, plus a second migration bundled inside it: **the *shape* of what
gets emitted must change** from framework-typed (`appfw_runtime::extension::UserAuth`,
`appfw_runtime::operation::RuntimeOperation`) to product-typed. This is the
same `UserAuth` mismatch already flagged as a known, deliberately-deferred
loose end from the Phase 5 `mcp`-feature build failure (171 errors, confirmed
pre-existing, documented in the sub4b commit) — Phase 6 is where that loose end
actually gets resolved, because the generator is what produces the code that
has the mismatch. Do not scope Phase 6 as "port the templates 1:1" — the
templates' *type references* need to change too.

## 4. Output surface to reproduce (Option B: Postgres only, single schema `governance`)

| Artifact | Path (this product) | Size | Notes |
|---|---|---|---|
| GraphQL operation catalog + dispatcher | `backend/src/operations/generated.rs` | 6,857 lines | needs product types per §3 |
| Handler default impls | `backend/src/handlers/governance/generated.rs` | 6,965 lines | needs product types per §3 |
| Handler default impls (system schema) | `backend/src/handlers/system/generated.rs` | 199 lines | small, same treatment |
| Rego policy files | `backend/config/generated/schemas/**/*.rego` | ~40 files, 50–70 lines each | **templating only** — wraps a hand-authored per-entity rule body (`.appfw/model/schemas/governance/rbac/*.rego`) with generated boilerplate (package decl, `default access = {"allow": false}`, `has_role`/`has_any_role`/`tenant_filter` helpers). Confirmed by diff: the actual authz logic is never generated, only the wrapper. Lowest-risk artifact to reproduce first. |
| Config-contract entity metadata | `backend/config/generated/schemas/**/entity_types.yaml` | 15,042 + smaller system file | structured data dump of the normalized model, not logic — a serialization exercise once `normalized_config.rs`'s IR is reproduced |
| SQL DDL | `database/_pkg/schemas/governance/tables.{pg,mssql,snowflake}.sql` | pg: 3,726 lines | **Option B drops mssql/snowflake entirely** — only `tables.pg.sql` needs reproducing |
| SQL seed data | `database/_pkg/schemas/governance/seed.{pg,mssql,snowflake}.sql` | pg: 923 lines | same cut |
| Frontend UI contract | `frontend/src/generated/appfw-ui-contract.ts` | 37,512 lines | the single largest generated artifact by line count; per the plan doc's own resolution this is "just one more emission target" under Option B, but its sheer size means it deserves its own sub-slice and its own oracle-style byte-comparison test once ported, not a bolt-on at the end |

Templating mechanism: `app_gen` uses `tera` (`extern crate tera` in `lib.rs`) —
a Jinja2-style Rust templating engine — over `_templates/**` (organized by
output family: `app_gen/bootstrap_types`, `backend/{handlers,operations,
routes,schemas}`, `database/{mongo,mssql,postgresql,snowflake}`,
`product_intake/backend`, `tests/{graphql,mod}`, `types/{entity_types,facets,
gql_enum_types,rbac,relationships}`). Reproducing this doesn't require adopting
`tera` specifically — plain Rust `format!`/string-building (as the framework's
own `lib.rs` clippy-allows suggest it partly already does: `print_literal`,
`ptr_arg` allows read like codegen-string-building fingerprints) is a valid
product-owned choice, and worth deciding explicitly rather than defaulting to
whatever the framework used.

## 5. Proposed sub-slice breakdown (mirrors Phase 5's incremental-verification approach)

Each slice should be independently buildable and independently verifiable
against the *existing* generated output (byte-diff or oracle-test against the
current checked-in files) before the next slice starts — same discipline as
Phase 5's sub-slices.

1. **Model loader + normalizer.** Parse `.appfw/model/**` (entity_types,
   relationships, facets, fragments, rbac, gql_enum_types) into an IR
   equivalent to `schemas::run`'s output. No output emission yet. Verify by
   asserting the IR matches known facts about the 30-entity/39-relationship
   model established in the phase-6 open-questions inventory.
2. **Rego generator.** Lowest risk, pure templating, output is diffable
   against all ~40 checked-in `.rego` files today. Good first real emission
   target — proves the harness end-to-end on a small, well-understood surface.
3. **SQL DDL/seed generator (Postgres only).** Diffable against
   `tables.pg.sql`/`seed.pg.sql`. No mssql/snowflake/mongo branches to port.
4. **Config-contract / entity_types.yaml emission.** Serialization of the IR
   from slice 1 — should be close to mechanical once the IR is right.
5. **Backend Rust codegen — operations + handlers.** The biggest and riskiest
   slice: reproduce `backend.rs`'s output *and* resolve the `appfw_runtime`
   type dependency from §3 in the same pass (emit against product `UserAuth`/
   operation types, not framework ones). This is where most of the real
   design work is — worth its own dedicated scoping pass when this slice
   starts, not decided here.
6. **Frontend UI contract emission.** Given its size (37,512 lines), treat as
   its own slice with its own verification (byte-diff against the current
   checked-in file for the current model, not just "looks plausible").
7. **CLI surface.** Reproduce `validate`, `generate --check` (drift/idempotency
   check — run generate twice, diff), `boundary-check` (syn-based layering
   check, self-contained per §1), `feature-check`, `policy-test` (mechanism now
   traced, see §8 — trivial). `product test`/`api-test`/`migrate`/`serve`
   already exist independent of `app_gen` internals in some form in this repo
   and mostly need re-pointing at the new generator's output rather than being
   built from scratch — confirm this per-command when this slice starts rather
   than assuming it.

Slices 1–4 are low-risk and well-understood from this recon pass. Slice 5 is
the one the plan doc's "likely comparable in size to everything else combined"
warning is really about — it should get a dedicated advisor/scoping pass of
its own before any code is written, not be scoped further from this document.

## 6. Explicit non-goals (confirmed by this recon, not assumed)

- Framework's own dev/release/docs-check/certification tooling (`framework
  docs-check`, `framework feature-check` for the *framework's* own crates,
  `provider_certification_export`) — never invoked by this product.
- `appfw_introspect`'s product-intake/agentic-workflow commands (`explain`,
  `lock`, `upgrade`, `new`, `analyze`, `propose-model`, `intake-proof`,
  `golden-downstream`) — onboarding tooling for a product that has already
  been bootstrapped; not part of the ongoing gate loop.
- MSSQL, Snowflake, Mongo output in every generator (DDL, seed, and any
  provider-specific validation-lint branches) — per Option B.
- Kafka/sync worker generation (`sync_worker.rs`, `sync_descriptor.rs`) —
  pending final confirmation there's nothing load-bearing, but no evidence
  found that this product uses either.
- `appfw_saas_core`/`appfw_mssql_auth` equivalents — already resolved by
  Phases 1–2 (deleted/inlined).

## 8. `policy-test` mechanism, traced (resolves the open item above)

`appfw_test/src/policy.rs` (355 lines total, including its own unit tests) is
the entire mechanism: `AccessAction`/`AccessUser`/`AccessInput` types that
serialize to the JSON shape a generated Rego wrapper's `access` rule expects
(`{schema_name, entity_type, action, user: {tenant_id, username,
principal_type, roles, ...}}`), an `AccessResult { allow, filter }` contract
type, and two functions — `load_policy` (wraps `regorus::Engine::new()` +
`add_policy_from_file`) and `evaluate_access`/`evaluate_access_rule` (sets
`engine.set_input`, calls `engine.eval_rule("data.<schema>.<entity>.access")`,
deserializes the result, **fails closed** if the policy doesn't return a valid
`{allow, filter?}` shape — confirmed by a dedicated test,
`invalid_access_result_fails_closed`).

This is not framework machinery to reimplement carefully — it's a thin
wrapper over `regorus`, which (per the main plan doc's own audit) is **already
a direct, non-framework `backend/Cargo.toml` dependency**. Reproducing this is
near-zero effort: port the four types and two functions essentially as-is
(this is exactly the "unit tests port verbatim, production logic is small
enough to just write directly" case — there's no meaningful algorithm here to
protect against copying).

**More important finding: this product doesn't currently exercise it.**
`rego_test/tests/policy_contract.rs` is 4 lines —
`assert_eq!("governance", "governance")` — a naming-convention tautology, not
a real policy test. `api_tests` (194 lines total) never references
`AccessInput`/`evaluate_access`/`AccessUser` anywhere. Both crates depend on
`appfw_test` but neither actually calls into `policy.rs`. So "reproduce
policy-test" isn't preserving real existing coverage — **there is none
today** — it's an opportunity to add real Rego access-policy test coverage
for the first time, using a mechanism now fully understood and cheap to
write. Low risk, arguably net-positive scope, not a preservation burden.

## 9. `validation.rs`, audited method-by-method (resolves the other open item)

Correcting an assumption in §2: this file is not a 6,710-line monolith. `run()`
itself is 26 lines; the actual linter is a `Validator` struct with ~55+ named
methods (`validate_fragments`, `validate_facets`, `validate_data_sources`,
`validate_schemas`, `validate_entity_type_item`, `validate_props`,
`validate_relationships` and 6 relationship/FK sub-checks, `validate_seed_*`
(4 methods), `validate_test_*` (3 methods), plus many small typed-field
helpers like `string_field`/`bool_field`/`validate_known_fields`), each
independently portable and independently testable — this is good news for
slice ordering, not bad.

Auditing for provider-specific content by method name and a keyword scan
(mssql/mongo/snowflake/kafka/sync) rather than guessing from module shape:

- **Genuinely cuttable under Option B:** `validate_mongodb_connection_host`
  (~76 lines, Mongo-only) and `validate_sync_descriptors` (~184 lines,
  sync/kafka descriptor validation — cut per the same reasoning as
  `sync_worker.rs`/`sync_descriptor.rs` in §2). ~260 lines.
- **Partially provider-conditional, needs simplification not deletion:**
  `validate_data_sources`/`validate_environments`/`validate_connection_security`
  (lines 600–943, ~343 lines) branch on data-source type (postgres vs.
  mssql/mongo/snowflake) for connection-config shape checks; a keyword-density
  scan found most of the file's provider-keyword hits concentrated here.
  Realistic cut after simplifying to Postgres-only: maybe half of this block,
  ~150–200 lines.
- **Looks provider-specific by name but isn't — keep:**
  `validate_provider_routine*` (4 methods, ~193 lines) validates
  identifier/arg-type safety for custom stored-routine bindings in
  `custom_method` config — this is an injection-safety check that applies
  regardless of which provider executes the routine, not multi-provider
  branching. Needs porting in full.
- **Everything else (the large majority — roughly 5,900 of 6,710 lines):**
  provider-agnostic model/shape/facet/enum/relationship/seed/test-config
  validation that has nothing to do with which database backs it. Must be
  ported in full regardless of Option B.

Net correction to §2's framing: validation.rs is large because the *model* is
rich (30 entities, 39 relationships, facets, fragments, seeds, inline test
fixtures), not because of multi-provider complexity — Option B only trims
roughly 400–600 of its 6,710 lines (~6–9%), not "the single biggest place to
cut weight" as originally guessed. Its size is real scope, not padding.

## 10. What's still open after this pass

- Slice 5's design (how the new generator emits product-typed operations code)
  needs its own scoping/advisor pass when reached — unchanged from before.
- The `Validator::error()` diagnostic-emission signature (line ~4927 in the
  framework source) and the exact `validation.json` report shape it writes
  haven't been traced yet — needed to keep `product validate --json`'s output
  contract stable for anything that parses it (CI, `boundary-check`, etc.).
