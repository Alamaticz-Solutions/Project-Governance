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
   check, self-contained per §1), `feature-check`, `policy-test` (runs
   `rego_test` fixtures through OPA or an embedded Rego evaluator — needs its
   own investigation into what "the framework verifier harness" actually is
   at runtime, not assumed to be trivial). `product test`/`api-test`/`migrate`/
   `serve` already exist independent of `app_gen` internals in some form in
   this repo and mostly need re-pointing at the new generator's output rather
   than being built from scratch — confirm this per-command when this slice
   starts rather than assuming it.

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

## 7. What's still open after this pass

- The exact runtime mechanism behind `policy-test` ("framework verifier
  harness" — OPA binary invocation? embedded Rego evaluator crate?) hasn't
  been traced yet; needed before slice 7 can be scoped for real.
- Whether `validation.rs`'s 6,710 lines split cleanly into
  "provider-agnostic" vs. "provider-specific" lint rules, or are more
  entangled than that — needs a real read-through, not inferred from module
  boundaries.
- Slice 5's design (how the new generator emits product-typed operations code)
  needs its own scoping/advisor pass when reached.
