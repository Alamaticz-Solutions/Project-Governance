# Project Governance — Onboarding Guide

This folder is a from-zero guide to this repository, written for someone who has
**never used Rust**, has not run this application, and does not yet know what the
files and folders do. It assumes you can use a terminal and install software, and
nothing else.

Read the chapters in order the first time. After that, use it as a reference.

## Reading order

| # | File | What it gives you |
|---|------|-------------------|
| 1 | [`01-core-concepts.md`](01-core-concepts.md) | Every technical term you need: Git and SHA, how to *read* Rust, GraphQL, PostgreSQL, "schema-driven code generation", RBAC and Rego, JWT, Docker, SPA, and the "framework vs. product" idea this whole repo is built on. |
| 2 | [`02-architecture.md`](02-architecture.md) | The big picture: the two repositories, the layer cake (browser → API → policy → database), the code-generation pipeline, and what runs where. |
| 3 | [`03-framework-dependency.md`](03-framework-dependency.md) | How this app sits *on top of* the PDS App Framework: the sibling checkout, `appfw.lock` and all its hashes, what `app_gen` generates vs. what your team owns, and how to change the framework version safely. |
| 4 | [`04-getting-started.md`](04-getting-started.md) | Hand-held setup on Windows from a clean machine: install everything, get the framework in place, start the database, run the backend and frontend, log in. Includes **measured disk and time numbers**. |
| 5 | [`05-data-model.md`](05-data-model.md) | The 24 governance entities, the enums, the relationships, the RBAC policies, database "facets", and the seed data — where the model lives and how a change to it flows into the running app. |
| 6 | [`06-workflow-engine.md`](06-workflow-engine.md) | The gate / approval workflow: the state machine, the eligibility rules, the audit trail, notifications, and which business rules live in Rust vs. in policy files. |
| 7 | [`07-request-flows.md`](07-request-flows.md) | Concrete walkthroughs: what happens, file by file, when the server starts, when someone logs in, creates a project, saves a gate form, an approver decides, the AI extracts intake fields, and a Teams meeting is scheduled. |
| 8 | [`08-backend-files.md`](08-backend-files.md) | Every file under `backend/`. |
| 9 | [`09-frontend-files.md`](09-frontend-files.md) | Every file under `frontend/src/`. |
| 10 | [`10-appfw-model-files.md`](10-appfw-model-files.md) | Every file under `.appfw/` (the application model). |
| 11 | [`11-generated-config-db-tests.md`](11-generated-config-db-tests.md) | `backend/config/`, `database/`, `api_tests/`, `rego_test/`, `scripts/`, Docker, `podman-compose.yml`, and the `target/` directories. |
| 12 | [`12-operations-and-glossary.md`](12-operations-and-glossary.md) | Build/test commands, a storage & time table, the known gaps and open decisions, troubleshooting, and a one-page glossary. |
| 13 | [`13-verification-log.md`](13-verification-log.md) | **Read this.** An actual end-to-end run of the stack (2026-09-09): what passed, three re-adoption defects it surfaced (one product-side and fixed; two PDS framework bugs written up for PDS in [`docs/architecture/framework-issues-for-pds.md`](../architecture/framework-issues-for-pds.md)), corrections to chapter 4, and a full reconciliation with the teammate's PDF setup guide. |

## How "every file" is covered

This repo has ~490 source files (not counting `node_modules/`, `target/`, and
`.git/`). A lot of them are **generated** — written by a machine from the model,
never edited by hand — and many of those are near-identical to each other (for
example there are 21 `*_audit.rego` policy files that differ only by entity name).

So the file chapters use two levels of detail:

- **Hand-written files** (the code your team owns and edits) get a real
  explanation: what it does, the key functions, and the logic inside.
- **Generated file families** get the pattern explained once, then a **complete
  table listing every file** in the family with a one-line note, so nothing is
  invisible — you can always see that a file exists and what produced it.

Each chapter says which of its files are hand-written and which are generated.

## The one-paragraph summary

**Project Governance** is a web application for running projects through
approval "gates" (a project is proposed, reviewed by several committees in
sequence, and either approved to proceed or sent back). It has a **Rust backend**
that serves a **GraphQL API** over a **PostgreSQL database**, and a **React
frontend** (a single-page web app). The unusual part: most of the backend is not
hand-written. A **model** in `.appfw/model/` describes the data and the rules,
and the **PDS App Framework** (a separate project in `../app-framework/`) contains
a generator that turns that model into the database tables, the API, and the
access-control checks. Your team hand-writes only the genuinely custom business
logic — the workflow engine, the Microsoft Graph integration, and the AI
document extraction — which lives in `backend/src/services/`.
