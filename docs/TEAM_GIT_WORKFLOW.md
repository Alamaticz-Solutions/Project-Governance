# Project Governance — How the Team Works on Git

**Who this is for:** every developer on this project (currently 3) and the client.
**What it covers:** how we branch, push, pull, review, and get to production —
without breaking each other's work or the generated code.

**Read [`LOCAL_DEV_SETUP.md`](LOCAL_DEV_SETUP.md) first** — that's the one-time
setup (WSL, the two repos, database, running the app). This document is only about
**working together day to day.**

---

## 1. The branches — and why they exist

```
main                         old Python app. Ignore it for now.

framework-readopt            The exact code we tested and got running.
   │                         FROZEN. Never commit here. It is our safety net.
   │
   └── develop               The team's shared branch. "Everything finished
         │                   and reviewed, combined." Never commit here directly
         │                   — changes only arrive by Pull Request.
         │
         ├── feat/frontend-pages          Frontend developer works here
         ├── feat/backend-services        Backend (workflow) developer works here
         └── feat/backend-integrations    Backend (integrations) developer works here
```

| Branch | Purpose | Do you commit here? |
|---|---|---|
| `framework-readopt` | Frozen known-good baseline. If everything breaks, we branch a fresh `develop` from here. | ❌ Never |
| `develop` | Integration branch. The complete app is assembled and tested here. | ❌ Only via Pull Request |
| `feat/frontend-pages` | The frontend developer's working branch | ✅ Yes (this is your branch) |
| `feat/backend-services` | The workflow-backend developer's working branch | ✅ Yes |
| `feat/backend-integrations` | The integrations-backend developer's working branch | ✅ Yes |
| `main` | Production releases only | ❌ Only via Pull Request from `develop` |

**Why one branch per developer?** So your half-finished work never blocks anyone
else. You only share work when it's ready — through a Pull Request.

**Why `develop` in the middle?** It's the single place where all three people's
work comes together. It is always kept working, because nothing lands there
without a review.

---

## 2. Who owns which folders

Each developer edits **only their area**. This is what keeps merge conflicts rare.

| Developer | Branch | Folders you edit |
|---|---|---|
| **Frontend** | `feat/frontend-pages` | `frontend/src/**` (all screens, pages, components, forms) |
| **Backend – workflow** | `feat/backend-services` | `backend/src/services/{transition,approval_state_machine,gate_*,workspace,gate_eligibility}.rs` and the matching `*_impl` functions in `backend/src/handlers/governance/<entity>.rs` |
| **Backend – integrations** | `feat/backend-integrations` | `backend/src/services/{graph,meeting_scheduling,meeting_transcript,ai_extraction,notification,directory}.rs` and their `*_impl` functions |

### Folders NOBODY edits by hand

| Folder / file | Why |
|---|---|
| `../app-framework/**` (the whole other repo) | It's the framework. We only pin a version of it. Bugs there are a separate, rare process (§7). |
| `backend/src/routes/**`, `backend/src/schemas/**` | Auto-generated from the model. Hand edits get wiped and fail the build. |
| `backend/src/handlers/**/generated.rs`, `backend/src/operations/generated.rs` | Auto-generated. |
| `backend/config/generated/**` (except `.rego` bodies) | Auto-generated. |
| `database/_pkg/**` (all the `.sql` files) | Auto-generated. |
| `frontend/src/generated/**` | Auto-generated. |
| `.appfw/model/**` | The source the generator reads. Changing it is a **coordinated** task — see §6. |

> **Simple rule:** if the path has `generated` in it, or it's in `app-framework`,
> or it's under `.appfw/model`, **stop and check this document** before editing.

---

## 3. Your daily routine (the only thing you must memorise)

> **"Work on my branch. Sync from `develop` every morning. When a feature is done,
> open a Pull Request to `develop`."**

### Every morning — get your teammates' latest work

```bash
cd ~/projects/project-governance
git checkout feat/backend-services          # your branch
git fetch origin
git rebase origin/develop                   # pull in whatever was merged into develop

# if the rebase touched appfw.lock, re-pin the framework:
git -C ../app-framework fetch --all
git -C ../app-framework checkout $(grep framework_git_sha appfw.lock | cut -d'"' -f2)
```

### During the day — save your work (as often as you like)

```bash
git add -A
git commit -m "feat: add gate-eligibility rule for EAC stage"
git push                                     # goes ONLY to origin/feat/backend-services
```

Pushing to your own branch is just "save to the cloud." It does **not** affect
anyone else yet.

### Before you open a Pull Request — check it builds

```bash
cd backend  && cargo check --workspace --all-targets && cargo test -p backend && cd ..
cd frontend && npm run typecheck && npm run build && cd ..
bash scripts/appfw product generate --check --json     # confirms you didn't touch generated code
```

### When a feature is finished — open the Pull Request

On GitHub:
- **base branch:** `develop`
- **compare branch:** `feat/backend-services`
- Fill in the PR template, request a review from one teammate.

A teammate reviews it → clicks **"Squash and merge"** → your work is now in `develop`.

### After ANY Pull Request merges (yours or a teammate's)

Everyone runs the "every morning" step again to pick it up.

---

## 4. Worked example — how your change reaches the other developers

You are the **backend developer**. You added a new gate-eligibility check.

```
Step 1  You:  edit backend/src/services/gate_eligibility.rs
              git commit  →  git push
              ─────────────────────────────────────────────
              Now on: origin/feat/backend-services ONLY.
              The frontend dev and integrations dev CANNOT see it yet.

Step 2  You:  open Pull Request   feat/backend-services  →  develop

Step 3  Frontend dev:  reviews your PR on GitHub, approves it

Step 4  Anyone:  clicks "Squash and merge"
              ─────────────────────────────────────────────
              Now IN: develop

Step 5  Frontend dev & Integrations dev, on their own branches:
              git fetch origin
              git rebase origin/develop
              ─────────────────────────────────────────────
              NOW they have your gate-eligibility change.
```

**Nobody ever runs `git pull` on someone else's `feat/*` branch.**
`develop` is the meeting point. Your work travels: **your branch → PR → `develop` → teammates rebase.**

---

## 5. Getting to production — everything ends up in one branch

The app only works as a whole when all three people's work is combined. That
happens in `develop`, then `main`:

```
feat/frontend-pages ───────┐
feat/backend-services ──────┼──(Pull Requests)──►  develop  ──(when tested & stable)──►  main  ──►  PRODUCTION
feat/backend-integrations ──┘                        │                                    │
                                                     │                                    └─ the deployed server runs THIS
                                                     └─ run the full app from here to test everything together
```

| If you run the app from… | You get… |
|---|---|
| `feat/backend-services` | Your backend work + whatever was in `develop` at your last rebase. **Not** the frontend dev's or integrations dev's unmerged work. Fine for testing *your* part. |
| **`develop`** | **Everyone's merged work together.** This is the branch to run when you want to test the whole application. |
| **`main`** | A tested, released snapshot. **Production deploys from here.** |

### Release procedure (done by the lead / repo admin)

1. `develop` is stable — CI green, the team has tested the full app running from `develop`.
2. Open a Pull Request: **base `main`, compare `develop`.**
3. Review, merge.
4. Tag the release: `git tag -a v1.0.0 -m "First production release" && git push --tags`
5. Deploy `main` (or the tag).

Between releases, `main` never moves. All the churn is on `develop`.

---

## 6. Changing the data model (`.appfw/model/**`) — coordinated

Most work never touches this. But when a feature needs a **new field, entity,
relationship, enum, or RBAC rule**, that lives in `.appfw/model/**`, and changing
it **regenerates dozens of files**. Two people doing this at once = a merge
disaster.

**Rules:**

1. **Announce in the team chat:** "I'm taking the model to add `project.priority`."
   Only **one** model change in flight at a time.
2. Branch from `develop`: `git checkout develop && git pull && git checkout -b model/add-project-priority`
3. Edit only what you need under `.appfw/model/**`.
4. Regenerate:
   ```bash
   bash scripts/appfw product validate --json
   bash scripts/appfw product generate
   bash scripts/appfw product generate --check --json
   cargo check --workspace --all-targets && cargo test --workspace
   cargo test --manifest-path rego_test/Cargo.toml
   ```
5. Commit **the model change + every regenerated file + `appfw.lock`** together in
   **one commit**:
   ```bash
   git add .appfw/model backend/src backend/config database/_pkg frontend/src/generated api_tests appfw.lock
   git commit -m "model: add project.priority field (+ regen)"
   git push -u origin model/add-project-priority
   ```
6. Open the PR, get it reviewed, **merge quickly** (a model branch goes stale fast).
7. Everyone else: rebase on `develop`. If `appfw.lock` changed, re-checkout the
   framework commit (§3, morning step). **Do not run the generator yourself** unless
   you are the one changing the model.

---

## 7. Framework bugs (`app-framework`) — rare, separate

You do **not** develop features in `app-framework`. The only reason to touch it is
a confirmed bug *inside the framework itself*. Two are known:

| Bug | Status |
|---|---|
| "Finding N" — null `jsonb[]` parameter binding | ✅ Fixed in the pinned commit `6ee6985` (`app-framework` `PATCHES.md`, Patch 1) |
| "Finding J" — seed generator emits `ARRAY[...]` for `jsonb` columns | ❌ Not fixed. Needs the local `seed.pg.sql` patch at migrate time (see `LOCAL_DEV_SETUP.md` §6). Should be added to `PATCHES.md` as Patch 2. |

If a new framework bug is found:
1. Fix it in `~/projects/app-framework` (branch, commit, push, PR **in that repo**), record it in `PATCHES.md`.
2. In `project-governance`: `git -C ../app-framework checkout <new-sha>`, run
   `bash scripts/appfw product lock --write`, regenerate if needed, commit
   `appfw.lock` (+ regen) together, PR into `develop`.
3. Everyone re-checkouts the framework commit after pulling.

---

## 8. When you hit a merge conflict

| Conflict is in… | What to do |
|---|---|
| Your own product code (services, frontend) | Resolve it normally — you know both sides. |
| A **generated** file (`routes/`, `schemas/`, `database/_pkg/`, `frontend/src/generated/`) | **Don't hand-merge.** You shouldn't have edited it. Take `develop`'s version (`git checkout --theirs <file>`), finish the rebase, done. If *you* were the model-change author, re-run `bash scripts/appfw product generate` and commit the result. |
| `appfw.lock` | Take the newer framework SHA, re-checkout the framework, done. Never keep both sides. |
| `Cargo.lock` | `git checkout --theirs Cargo.lock`, then `cargo check` (cargo re-resolves it), commit. |
| `frontend/package-lock.json` | `git checkout --theirs package-lock.json`, then `npm install`, commit. |
| A `mod.rs` file | Usually both people added a line — keep both lines. |

**Conflicts get smaller the more often you rebase.** Rebase every morning.

---

## 9. One-time GitHub setup (repo admin)

### Branch protection — on `main` **and** `develop`

- Require a Pull Request before merging.
- Require **1 approval**.
- Require the branch to be up to date before merging.
- Require status checks (CI) to pass once CI exists.
- Block direct pushes.

### `.github/CODEOWNERS`

```
# model + generated + lock: whole team reviews
/.appfw/model/          @frontend-dev @backend-dev @integrations-dev
/appfw.lock             @frontend-dev @backend-dev @integrations-dev
/backend/src/routes/    @frontend-dev @backend-dev @integrations-dev
/backend/src/schemas/   @frontend-dev @backend-dev @integrations-dev
/database/_pkg/         @frontend-dev @backend-dev @integrations-dev

# areas
/frontend/                       @frontend-dev
/backend/src/services/graph/     @integrations-dev
/backend/src/services/           @backend-dev
```

### `.github/pull_request_template.md`

```markdown
## What changed


## Areas touched
- [ ] Product code only (my assigned folders)
- [ ] Model (`.appfw/model`) — regenerated files + `appfw.lock` in this PR
- [ ] Framework pin (`appfw.lock`) bumped

## I ran locally
- [ ] `cargo check --workspace --all-targets`
- [ ] `cargo test -p backend`
- [ ] `bash scripts/appfw product generate --check --json`
- [ ] `cd frontend && npm run typecheck && npm run build`
```

### CI — `.github/workflows/ci.yml` (none exists yet)

```yaml
name: CI
on:
  pull_request:
    branches: [develop, main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { path: project-governance }
      - name: Read framework SHA
        id: fw
        run: echo "sha=$(grep framework_git_sha project-governance/appfw.lock | cut -d'\"' -f2)" >> "$GITHUB_OUTPUT"
      - uses: actions/checkout@v4
        with:
          repository: Alamaticz-Solutions/app-framework
          path: app-framework
          ref: ${{ steps.fw.outputs.sha }}
          token: ${{ secrets.FRAMEWORK_REPO_TOKEN }}
      - uses: dtolnay/rust-toolchain@stable
      - run: cd project-governance/backend && cargo check --workspace --all-targets && cargo test -p backend
      - run: cd project-governance && bash scripts/appfw product generate --check --json
      - run: cd project-governance && cargo test --manifest-path rego_test/Cargo.toml
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd project-governance/frontend && npm ci && npm run typecheck && npm run build
```

`FRAMEWORK_REPO_TOKEN` = a GitHub token with **read** access to the private
`app-framework` repo.

### Never commit

`backend/.env` · live secrets · the `seed.pg.sql` `ARRAY[]` patch · local
`data_sources.yaml` port edits. (All are `.gitignore`d except the SQL patch — just
never `git add` it.)

---

## 10. Cheat sheet — print this

```bash
#### START OF DAY — on your own feat/* branch ####
git checkout feat/backend-services
git fetch origin
git rebase origin/develop
git -C ../app-framework checkout $(grep framework_git_sha appfw.lock | cut -d'"' -f2)

#### SAVE YOUR WORK (any time) ####
git add -A
git commit -m "feat: <what you did>"
git push

#### BEFORE OPENING A PR ####
cd backend  && cargo check --workspace --all-targets && cargo test -p backend && cd ..
cd frontend && npm run typecheck && npm run build && cd ..
bash scripts/appfw product generate --check --json

#### OPEN THE PR ####
# GitHub → New Pull Request → base: develop ← compare: feat/backend-services
# request 1 review → teammate approves → "Squash and merge"

#### AFTER ANY PR MERGES (yours or a teammate's) ####
# repeat START OF DAY

#### GOLDEN RULES ####
# 1. Only edit YOUR folders (see §2).
# 2. Never edit anything with "generated" in the path, or under app-framework, or .appfw/model.
# 3. Never commit directly to develop or main — always a PR.
# 4. Rebase on develop every morning. Small PRs, often.
# 5. Model change? Announce first. One person at a time. (§6)
```
