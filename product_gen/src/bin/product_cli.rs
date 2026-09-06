//! Slice 7: the product-owned replacement for `scripts/appfw product ...`.
//! Unlike that 41-line wrapper (which `exec`s `cargo run --manifest-path
//! "$framework_root"` -- i.e. shells out to the now-deleted framework
//! checkout for every subcommand, per HANDOFF.md §6), this binary is
//! self-contained: it calls straight into `product_gen`.
//!
//! Implemented: `generate`, `generate --check`, `boundary-check`,
//! `validate`, `feature-check`. `policy-test` is
//! `cargo test --manifest-path rego_test/Cargo.toml` (a real cargo test
//! suite, not a report this binary builds -- see `product_gen::policy` and
//! `rego_test/tests/policy_contract.rs`).
//!
//! `feature-check` will report every combination as failing right now --
//! see `product_gen::feature_check`'s doc comment. That's `backend`'s own
//! still-live `appfw_runtime` path dependency on the deleted framework
//! checkout (HANDOFF.md §6), not a bug in this command.

use std::env;
use std::path::PathBuf;
use std::process::ExitCode;

fn main() -> ExitCode {
    let app_root = discover_app_root();
    let mut args = env::args().skip(1);
    let Some(command) = args.next() else {
        print_usage();
        return ExitCode::FAILURE;
    };
    let rest: Vec<String> = args.collect();
    let json = rest.iter().any(|arg| arg == "--json");

    match command.as_str() {
        "generate" => {
            let check_only = rest.iter().any(|arg| arg == "--check");
            if check_only {
                run_generate_check(&app_root, json)
            } else {
                run_generate(&app_root, json)
            }
        }
        "boundary-check" => run_boundary_check(&app_root, json),
        "validate" => run_validate(&app_root, json),
        "feature-check" => run_feature_check(&app_root, json),
        _ => {
            print_usage();
            ExitCode::FAILURE
        }
    }
}

fn run_generate(app_root: &std::path::Path, json: bool) -> ExitCode {
    match product_gen::generate::write_all(app_root) {
        Ok(report) => {
            if json {
                println!("{}", serde_json::to_string_pretty(&report).unwrap());
            } else {
                println!(
                    "generate: wrote {} file(s), preserved {} hand-owned file(s)",
                    report.written.len(),
                    report.preserved.len()
                );
            }
            ExitCode::SUCCESS
        }
        Err(err) => {
            eprintln!("generate failed: {err:#}");
            ExitCode::FAILURE
        }
    }
}

fn run_generate_check(app_root: &std::path::Path, json: bool) -> ExitCode {
    match product_gen::generate::check(app_root) {
        Ok(report) => {
            if json {
                println!("{}", serde_json::to_string_pretty(&report).unwrap());
            } else if report.ok {
                println!("generate --check: ok, no drift");
            } else {
                println!("generate --check: drift detected");
                for path in &report.drifted {
                    println!("  drifted: {path}");
                }
                for path in &report.missing_hand_owned {
                    println!("  missing hand-owned file: {path}");
                }
            }
            if report.ok {
                ExitCode::SUCCESS
            } else {
                ExitCode::FAILURE
            }
        }
        Err(err) => {
            eprintln!("generate --check failed: {err:#}");
            ExitCode::FAILURE
        }
    }
}

fn run_boundary_check(app_root: &std::path::Path, json: bool) -> ExitCode {
    match product_gen::boundary_check::build(app_root) {
        Ok(report) => {
            if json {
                println!("{}", serde_json::to_string_pretty(&report).unwrap());
            } else if report.ok {
                println!(
                    "boundary-check: ok, {} file(s) checked",
                    report.checked_files
                );
            } else {
                println!("boundary-check: {} violation(s)", report.violations.len());
                for violation in &report.violations {
                    println!(
                        "  {}: {} ({})",
                        violation.path, violation.rule, violation.detail
                    );
                }
            }
            if report.ok {
                ExitCode::SUCCESS
            } else {
                ExitCode::FAILURE
            }
        }
        Err(err) => {
            eprintln!("boundary-check failed: {err:#}");
            ExitCode::FAILURE
        }
    }
}

fn run_validate(app_root: &std::path::Path, json: bool) -> ExitCode {
    match product_gen::validate::run(app_root) {
        Ok(report) => {
            if json {
                println!("{}", serde_json::to_string_pretty(&report).unwrap());
            } else if report.valid {
                println!("validate: ok, {} warning(s)", report.summary.warnings);
            } else {
                println!(
                    "validate: {} error(s), {} warning(s)",
                    report.summary.errors, report.summary.warnings
                );
                for issue in &report.issues {
                    println!(
                        "  [{}] {} ({}{}) {}",
                        issue.severity, issue.code, issue.file, issue.path, issue.message
                    );
                }
            }
            if report.valid {
                ExitCode::SUCCESS
            } else {
                ExitCode::FAILURE
            }
        }
        Err(err) => {
            eprintln!("validate failed: {err:#}");
            ExitCode::FAILURE
        }
    }
}

fn run_feature_check(app_root: &std::path::Path, json: bool) -> ExitCode {
    match product_gen::feature_check::run(app_root) {
        Ok(report) => {
            if json {
                println!("{}", serde_json::to_string_pretty(&report).unwrap());
            } else {
                println!(
                    "feature-check: {}/{} combination(s) compiled",
                    report.passed, report.total
                );
                for result in &report.results {
                    if !result.ok {
                        println!(
                            "  FAIL [{}]: {}",
                            result.features.join(","),
                            result
                                .error_summary
                                .as_deref()
                                .unwrap_or("(no stderr captured)")
                        );
                    }
                }
            }
            if report.failed == 0 {
                ExitCode::SUCCESS
            } else {
                ExitCode::FAILURE
            }
        }
        Err(err) => {
            eprintln!("feature-check failed: {err:#}");
            ExitCode::FAILURE
        }
    }
}

fn discover_app_root() -> PathBuf {
    // product_gen/ -> repo root, same convention every product_gen test uses.
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

fn print_usage() {
    eprintln!(
        "Usage: product_cli <generate [--check] | boundary-check | validate> [--json]\n\
         \n\
         generate            write all generated output (schemas/handlers/routes,\n\
         \x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20 entity_types.yaml, rego, DDL/seed SQL, frontend UI contract)\n\
         generate --check    diff generated output against disk without writing;\n\
         \x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20 non-zero exit on drift\n\
         boundary-check       run the route -> handler -> _impl -> service -> DataAccess\n\
         \x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20 layering check\n\
         validate             lint .appfw/model/** (fragments, facets, data sources,\n\
         \x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20 schemas, entities, relationships, seeds, API tests)\n\
         feature-check        cargo check every backend Cargo feature combination\n\
         \x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20 (all fail today -- see product_gen::feature_check's doc comment)\n\
         \n\
         policy-test is not a subcommand here -- run:\n\
         \x20\x20cargo test --manifest-path rego_test/Cargo.toml"
    );
}
