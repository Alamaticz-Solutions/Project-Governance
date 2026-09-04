# Retained gate evidence

`target/` is `.gitignore`d at every depth, so the artifacts M12 requires to be
retained are copied here and committed. See `../../HANDOFF.md` §7.

| File | Gate | Result | Produced at |
|---|---|---|---|
| `frontend-gates-f506819.txt` | `typecheck` + `vite build` + `appfw:check` + `phi:check` | all exit 0 | `f506819` |
| `frontend-scaffold-check-f506819.json` | `appfw:check` machine evidence | `ok: true` | `f506819` |
| `backend-m9/validation.json` | `product validate` | `valid: true`, 0/0 | `937dfbd` (M9) |
| `backend-m9/boundary_check.json` | `product boundary-check` | `ok: true`, 62 files | `937dfbd` (M9) |
| `backend-m9/config_contract.md` | generated config contract | — | `937dfbd` (M9) |
| `backend-m9/app_topology.json` | topology | — | `937dfbd` (M9) |
| `backend-m9/artifact_provenance.json` | generator provenance | — | `937dfbd` (M9) |

**Freshness.** The `backend-m9/*` files were produced during M9, in Docker with
the framework mounted. Every commit since M9 touches only `frontend/`, so no
backend/model input changed — but the backend gates were **not re-executed at
HEAD** because the framework CLI was removed (HANDOFF §6). Read them as “last
confirmed green at `937dfbd`”.

To refresh the backend evidence: restore `../../../app-framework/`, then re-run
the HANDOFF §5 backend gates and replace `backend-m9/` with a `backend-<sha>/`.
