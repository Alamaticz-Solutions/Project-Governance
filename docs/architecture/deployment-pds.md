# PDS deployment contract

Spec for a later workstream. It records how PDS (Pacific Dental Services) expects
a microservice repository to deploy, and what this repository is missing to meet
that. It is not a how-to.

Sources:

- The client skeleton repo `pacificdental-pds-technology-strategy-nexus-svc`
  (`app/Dockerfile`, `app/microservice_name`, `bitbucket-pipelines.yml`, its
  `README.md`).
- The framework release docs `../app-framework/docs/release/`:
  `deployment-reference.md`, `proget-distribution.md`, `release-gate-ci-cd.md`
  (release-gate doc read in part).

Where a detail comes only from the skeleton README's prose (not the pipeline
YAML), it is marked *(skeleton README)*.

## How PDS deploys

- **CI/CD platform: Bitbucket Pipelines**, not GitHub Actions. Pushing to `main`
  runs the pipeline automatically.
- Each step clones the shared library
  `bitbucket.org/pacificdental/pds-pe-pipelines` (pinned tag, `1.0.5` in the
  skeleton), sources `pipeline_prep.sh`, and calls
  `./pds-pe-pipelines/build_deploy_control.sh build|deploy|rollback`. The repo
  itself carries almost no CI logic.
- Steps run `oidc: true` on self-hosted Linux runners
  (`runs-on: [self.hosted, linux]`).
- **Build**: `build_deploy_control.sh build` builds and pushes the container
  image to **ECR** *(skeleton README: dev account)*; retains
  `docker_build.log`, `docker_push_details.log`, and **`wiz_results.log`** — the
  in-pipeline **Wiz** security scan.
- **Deploy**: `build_deploy_control.sh deploy` deploys via **ArgoCD + Helm**
  *(skeleton README)* to **EKS** *(skeleton README)*; retains
  `argocd_sync.log`. ArgoCD updates the image tag in the Helm values after each
  successful deploy *(skeleton README)*.
- **Environments** (Bitbucket deployment names, from the pipeline YAML):
  `build → development → test → staging → production`. Only the first Dev deploy
  is automatic; `test`, `staging`, and `production` are `trigger: manual`
  promotion gates.
- **Rollback**: a custom `rollback` pipeline takes `APP_NAME` /
  `DOCKER_IMAGE_TAG` and requires `Confirm=YES`; runs
  `build_deploy_control.sh rollback`.
- **Build agent image**: `proget.pdsconnect.com:443/devops/pds-build-agent`
  (`1.0.15` in the skeleton) — the pipeline's `image:`.

### Repo shape PDS expects

```
app/
  Dockerfile            # container image definition
  microservice_name     # single line, the service identifier used by the pipeline
  requirements.txt      # Python deps if applicable (skeleton is nginx/Python)
bitbucket-pipelines.yml # at repo root
```

Plus three paired repos, named off the application *(skeleton README)*:

| Purpose | Repo name pattern |
|---|---|
| Helm chart / manifests | `<name>-manifests` |
| ArgoCD Application bootstrap | `<name>-argocd-bootstrap` |
| ArgoCD configs | `<name>-argocd-configs` |

### Pipeline deployment variables *(skeleton README)*

Set per environment in Bitbucket, not in the repo: `AWS_ROLE_ARN` (OIDC role for
ECR push + EKS access), `DOCKER_REPO` (target-env ECR URL), `ARGOCD_SERVER`,
`AUTH_KEY` (ArgoCD pipeline token).

## Framework dependency inside PDS CI (Mode A)

Today this repo builds against a sibling `../app-framework` checkout with Cargo
**path** dependencies (`backend/Cargo.toml` → `appfw-runtime`,
`appfw-provider-postgres`; `rego_test/Cargo.toml` → `appfw-test`). The
`scripts/appfw` CLI wrapper also needs the checkout. That cannot work in a PDS
container build with no sibling checkout.

Inside PDS CI the `proget.pdsconnect.com` Cargo registry **is** reachable, so the
framework can be consumed as a normal published Cargo dependency (Mode A):

- Registry: `pds-app-framework-crates`
  (`sparse+https://proget.pdsconnect.com/cargo/pds-app-framework-crates/`) —
  already declared in this repo's `.cargo/config.toml`, not yet used by any
  manifest.
- The framework crates needed here (`appfw-runtime`, `appfw-provider-postgres`,
  `appfw-test`) are all in the framework's ProGet publish plan
  (`proget-distribution.md`). `appfw-test` is only needed for the `rego_test`
  crate, which the container build does not need to compile.
- CI authenticates Cargo with `cargo login --registry pds-app-framework-crates`
  or `CARGO_REGISTRIES_PDS_APP_FRAMEWORK_CRATES_TOKEN`.
- `proget-distribution.md`: committed product `Cargo.toml` files should point at
  the registry (`registry = "pds-app-framework-crates"`), not a path; path
  overrides are an uncommitted troubleshooting aid only.

The container build (`app/Dockerfile`) should resolve the framework from ProGet,
not from a bind-mounted checkout.

## What this repo is missing to be PDS-deployable

1. **Bitbucket pipeline.** No `bitbucket-pipelines.yml`, no
   `pds-pe-pipelines` wiring. The framework's own `bitbucket-release-gate.sh`
   flow (`release-gate-ci-cd.md`) is a *framework-release* gate and is not the
   same as the product `build_deploy_control.sh` flow PDS runs for a service.
2. **`app/` layout.** PDS expects `app/Dockerfile` and `app/microservice_name`.
   This repo has `backend/Dockerfile` (path mismatch, not a missing file) and no
   `microservice_name` file — a service identifier (e.g.
   `project-governance`) has to be chosen and committed.
3. **Helm / ArgoCD repos.** The three paired repos
   (`project-governance-manifests`, `project-governance-argocd-bootstrap`,
   `project-governance-argocd-configs`) do not exist. Deployment topology is the
   framework's single backend image serving the API, the product SPA
   (`backend/product_dist`), and `/health/ready` + `/metrics`
   (`deployment-reference.md`) — the Helm chart has to express that plus a
   pre-rollout migration job.
4. **Framework published to ProGet.** Mode A requires `appfw-runtime` /
   `appfw-provider-postgres` / `appfw-test` at the pinned version
   (`appfw.lock` `framework_version = 0.1.1`) to be published to the
   `pds-app-framework-crates` feed. Publishing runs on the framework's `v*` tag
   lane behind `scripts/ci/proget-publish.sh` with `trigger: manual`
   (`proget-distribution.md`); there is no evidence this has happened. Decision
   + owner needed. Until then, path deps are the only option and the container
   build cannot be hermetic.
5. **Secrets → Bitbucket deployment variables.** `backend/.env` currently holds
   real values (Graph client id/secret, `GRAPH_NOTIFICATION_CLIENT_STATE`, DB
   credentials, `OPENAI_*`). `deployment-reference.md` and the framework secrets
   rules forbid baking secrets into images, YAML, or PR-visible Bitbucket
   variables. Every secret has to move to per-environment Bitbucket deployment
   variables or a Kubernetes/external secret store, and `.env` must not ship in
   the image. `GRAPH_NOTIFICATION_CLIENT_STATE` should be rotated (it has been
   committed in docs and `.env`).
6. **PDS security-baseline evidence.** `deployment-reference.md` (citing
   `pds-security-baseline-traceability.md`) requires live or release-authority
   evidence for IdP/MFA, user lifecycle, secrets management, SIEM,
   gateway/WAF/TLS, backup/restore, lower-environment data handling,
   vulnerability SLA, and SAST/DAST. The in-pipeline Wiz scan
   covers part of the vulnerability category only. A baseline decision artifact
   with named release-authority owner + approver is required before any PDS
   production-readiness claim. The legacy HS256 JWT (spec 001, decision D) vs
   the PDS Okta/OIDC expectation (`deployment-reference.md` oauth2-proxy
   topology) is an open identity-provider decision that this evidence depends
   on.

## Not decided here

- Service identifier / repo name (`governance-appfw` → `project-governance`
  is assumed elsewhere in this repo's docs but not finalized).
- Whether the SPA ships in the backend image (current topology) or as a
  separate static deployment.
- Identity provider for managed environments (legacy JWT vs Okta/oauth2-proxy).
