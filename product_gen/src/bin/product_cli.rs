//! Slice 7: the product-owned replacement for `scripts/appfw product ...`.
//! Unlike that 41-line wrapper (which `exec`s `cargo run --manifest-path
//! "$framework_root"` -- i.e. shells out to the now-deleted framework
//! checkout for every subcommand, per HANDOFF.md §6), this binary is
//! self-contained: it calls straight into `product_gen`.
//!
//! Implemented: `generate`, `generate --check`, `boundary-check`.
//! `policy-test` is `cargo test --manifest-path rego_test/Cargo.toml` (a
//! real cargo test suite, not a report this binary builds -- see
//! `product_gen::policy` and `rego_test/tests/policy_contract.rs`).
//! `validate` and `feature-check` are deliberately NOT implemented here --
//! see `docs/architecture/phase6-app-gen-scoping.md` §17 for why each was
//! left as an open scoping question rather than absorbed by assumption.

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

fn discover_app_root() -> PathBuf {
    // product_gen/ -> repo root, same convention every product_gen test uses.
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

fn print_usage() {
    eprintln!(
        "Usage: product_cli <generate [--check] | boundary-check> [--json]\n\
         \n\
         generate            write all generated output (schemas/handlers/routes,\n\
         \x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20 entity_types.yaml, rego, DDL/seed SQL, frontend UI contract)\n\
         generate --check    diff generated output against disk without writing;\n\
         \x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20 non-zero exit on drift\n\
         boundary-check       run the route -> handler -> _impl -> service -> DataAccess\n\
         \x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20 layering check\n\
         \n\
         policy-test is not a subcommand here -- run:\n\
         \x20\x20cargo test --manifest-path rego_test/Cargo.toml\n\
         \n\
         validate and feature-check are not implemented -- see\n\
         docs/architecture/phase6-app-gen-scoping.md."
    );
}
