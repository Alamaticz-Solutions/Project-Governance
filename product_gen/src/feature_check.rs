//! Slice 7b: `feature-check`. Confirmed via `HANDOFF.md` (not assumed from
//! the name) that "product feature-check" means this product's own Cargo
//! feature-flag compile matrix for `backend/Cargo.toml` -- distinct from the
//! framework's own `feature-check` for its own crates, which §6 lists as an
//! explicit non-goal.
//!
//! **Update (backend framework replacement phase 7, complete 2026-09-07):**
//! the note below about every combination failing describes a state that no
//! longer exists. `appfw_runtime` is no longer a dependency of `backend` at
//! all (`backend/Cargo.toml`'s path dependency and `.cargo/config.toml`'s
//! private-registry stanza were both removed in phase 7's final cutover),
//! and `mcp`/`kafka`/`sync` were deleted outright in the same phase -- the
//! `[features]` table this module enumerates today only has `http` and
//! `provider-postgres` (`default` aliases both). Feature combinations
//! should now actually compile; if a run reports failures, investigate
//! them as real -- don't assume they're the old framework-manifest
//! failure this comment used to explain away.
//!
//! Feature combinations are enumerated from `backend/Cargo.toml`'s
//! `[features]` table (simple line-based parsing, same technique
//! `boundary_check::backend_provider_dependencies` already uses for
//! `[dependencies]` -- avoids adding a TOML-parsing dependency for one
//! small table), `default` excluded since it's an alias, not a real
//! toggle. All 2^n combinations are checked, not a curated subset: the
//! historical "14/14" figure from `HANDOFF.md`'s framework-backed audit
//! isn't reconstructable (that framework build's exact feature surface at
//! the time isn't recorded anywhere in this repo), so this checks
//! everything declared today rather than guess which 14 of some larger set
//! that was.

use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::Instant;

use anyhow::{Context, Result};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct FeatureCheckReport {
    pub total: usize,
    pub passed: usize,
    pub failed: usize,
    pub results: Vec<FeatureCombinationResult>,
}

#[derive(Debug, Serialize)]
pub struct FeatureCombinationResult {
    pub features: Vec<String>,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_summary: Option<String>,
    pub duration_ms: u128,
}

/// Parse `backend/Cargo.toml`'s declared feature names, excluding `default`.
pub fn declared_features(cargo_toml_path: &Path) -> Result<Vec<String>> {
    let content = fs::read_to_string(cargo_toml_path)
        .with_context(|| format!("could not read {}", cargo_toml_path.display()))?;
    let mut features = vec![];
    let mut in_features = false;
    for raw_line in content.lines() {
        let line = raw_line.split('#').next().unwrap_or("").trim();
        if line.is_empty() {
            continue;
        }
        if line.starts_with('[') && line.ends_with(']') {
            in_features = line == "[features]";
            continue;
        }
        if !in_features {
            continue;
        }
        let Some((key, _)) = line.split_once('=') else {
            continue;
        };
        let key = key.trim();
        if key != "default" {
            features.push(key.to_string());
        }
    }
    Ok(features)
}

/// Every combination of the declared features, including the empty set
/// (`--no-default-features` with nothing enabled). `2^n` combinations, not
/// a curated subset -- see this module's doc comment for why.
pub fn enumerate_combinations(features: &[String]) -> Vec<Vec<String>> {
    let mut combinations = vec![vec![]];
    for feature in features {
        let existing = combinations.clone();
        for mut combo in existing {
            combo.push(feature.clone());
            combinations.push(combo);
        }
    }
    combinations.sort();
    combinations.dedup();
    combinations
}

/// Runs `cargo check -p backend --no-default-features --features <combo>`
/// for every combination. Each invocation is a real subprocess -- this is
/// the one slice-7 command that necessarily shells out, since "does this
/// feature combination compile" has no cheaper proxy. See this module's
/// doc comment for why every result is expected to fail today.
pub fn run(app_root: &Path) -> Result<FeatureCheckReport> {
    let cargo_toml = app_root.join("backend/Cargo.toml");
    let features = declared_features(&cargo_toml)?;
    let combinations = enumerate_combinations(&features);

    let mut results = vec![];
    for combo in combinations {
        let started = Instant::now();
        let feature_list = combo.join(",");
        let mut command = Command::new("cargo");
        command
            .current_dir(app_root)
            .arg("check")
            .arg("-p")
            .arg("backend")
            .arg("--no-default-features");
        if !feature_list.is_empty() {
            command.arg("--features").arg(&feature_list);
        }
        let output = command
            .output()
            .with_context(|| format!("failed to run cargo check for features [{feature_list}]"))?;
        let duration_ms = started.elapsed().as_millis();
        let ok = output.status.success();
        let error_summary = if ok {
            None
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Some(
                stderr
                    .lines()
                    .rev()
                    .take(5)
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rev()
                    .collect::<Vec<_>>()
                    .join("\n"),
            )
        };
        results.push(FeatureCombinationResult {
            features: combo,
            ok,
            error_summary,
            duration_ms,
        });
    }

    let passed = results.iter().filter(|r| r.ok).count();
    let failed = results.len() - passed;
    Ok(FeatureCheckReport {
        total: results.len(),
        passed,
        failed,
        results,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn app_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
    }

    /// Fast, pure test -- no subprocess. `run()`'s real `cargo check`
    /// invocations are exercised manually via the CLI, not in the test
    /// suite (4 real cargo invocations would make `cargo test` slow
    /// without proving anything `cargo test` itself needs).
    #[test]
    fn declared_features_matches_backends_real_feature_table() {
        // `kafka`/`mcp`/`sync` were deleted outright (backend framework
        // replacement phase 7, 2026-09-07) -- this assertion was never
        // updated when that happened. Only `http`/`provider-postgres`
        // remain declared.
        let features =
            declared_features(&app_root().join("backend/Cargo.toml")).expect("parse features");
        let mut sorted = features.clone();
        sorted.sort();
        assert_eq!(sorted, vec!["http", "provider-postgres"]);
    }

    #[test]
    fn enumerate_combinations_covers_every_subset_without_duplicates() {
        let features = vec!["a".to_string(), "b".to_string()];
        let combos = enumerate_combinations(&features);
        assert_eq!(combos.len(), 4);
        assert!(combos.contains(&vec![]));
        assert!(combos.contains(&vec!["a".to_string()]));
        assert!(combos.contains(&vec!["b".to_string()]));
        assert!(combos.contains(&vec!["a".to_string(), "b".to_string()]));
    }

    #[test]
    fn two_declared_features_enumerate_to_four_combinations() {
        let features =
            declared_features(&app_root().join("backend/Cargo.toml")).expect("parse features");
        let combos = enumerate_combinations(&features);
        assert_eq!(combos.len(), 4);
    }
}
