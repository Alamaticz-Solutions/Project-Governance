//! Slice 7: `boundary-check` -- the `route -> handler -> _impl -> service ->
//! DataAccess` layering check spec 002 relies on. Ported from
//! `app_gen/src/bin/appfw_introspect.rs`'s `build_boundary_check` (a
//! `syn`-based static check over this repo's own Rust source, not
//! multi-provider machinery) -- confirmed in
//! `docs/architecture/phase6-app-gen-scoping.md` §1 as the one command from
//! that otherwise out-of-scope 19,127-line binary this product actually
//! depends on, and self-contained enough to reproduce independently.
//!
//! **Roots are simplified from the framework's `CommandRoots`.** The
//! original shape carries `framework_root`/`generator_root`/`templates_root`
//! because `appfw_introspect` always assumes a separate framework checkout
//! exists alongside the product. Phase 6 exists precisely because that
//! checkout is gone (deleted per HANDOFF.md §6) -- so this report only
//! tracks `app_root`/`config_root`/`report_root`, and
//! `check_retired_framework_root_surfaces` (which scanned `framework_root`
//! for retired fixture facades) is dropped entirely: there is no framework
//! tree left to scan. `check_retired_product_template_surfaces` (which
//! scans the *product* root) is kept -- it's a real, still-applicable
//! check.
//!
//! **Not byte-diffable against `docs/evidence/backend-m9/boundary_check.json`.**
//! That file is a snapshot from a framework-backed run at commit `937dfbd`,
//! before the framework was deleted -- its `roots` block still has
//! `/app-framework/...` paths that no longer describe this product's
//! layout, and its `checked_files: 62` count will drift as the model grows.
//! It's evidence of what the mechanism verified once, not a live oracle;
//! reproducing it byte-for-byte would mean matching a stale snapshot
//! instead of checking the current tree. Verified here by running the real
//! check against the current tree and asserting `ok == true` (0 violations)
//! -- the same live claim `boundary_check.json`'s `ok: true` made in 2026,
//! re-earned against today's source rather than copied from it.

use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use anyhow::{Context, Result};
use serde::Serialize;
use syn::visit::{self, Visit};
use syn::{ItemFn, ItemUse, UseTree};

#[derive(Debug, Serialize)]
pub struct BoundaryCheckReport {
    pub command: &'static str,
    pub ok: bool,
    pub app_root: String,
    pub checked_files: usize,
    pub product_provider_sources: ProductProviderSourceReport,
    pub violations: Vec<BoundaryCheckViolation>,
}

#[derive(Debug, Serialize)]
pub struct ProductProviderSourceReport {
    pub active_providers: Vec<String>,
    pub sources: Vec<ProductProviderSource>,
    pub dependencies: Vec<ProductProviderDependency>,
}

#[derive(Debug, Serialize)]
pub struct ProductProviderSource {
    pub provider: String,
    pub path: String,
    pub active: bool,
    pub rust_files: usize,
}

#[derive(Debug, Serialize)]
pub struct ProductProviderDependency {
    pub provider: String,
    pub dependency: String,
    pub active: bool,
}

#[derive(Debug, Serialize)]
pub struct BoundaryCheckViolation {
    pub path: String,
    pub rule: String,
    pub detail: String,
    pub symbol: Option<String>,
}

struct RetiredProductTemplateSurface {
    relative_path: &'static str,
    detail: &'static str,
}

/// Framework-internal files a product template must never carry -- they
/// belong in `appfw_runtime`. Ported from the framework's table, **minus
/// four entries this repo genuinely, deliberately violates**:
/// `data/audit.rs`, `data/rules/{computed,timezone,version}.rs`. The
/// framework's rule assumes `appfw_runtime` stays the owner of these
/// concerns; this product's whole phase 5 (see
/// `docs/architecture/self-owned-backend-plan.md`) was reimplementing
/// exactly these pieces as self-owned code so the product carries no
/// runtime dependency on the client's framework. Running the ported check
/// unmodified against this repo confirmed that directly: it flagged these
/// four files, and each one's own doc comment says "ported off
/// `appfw_runtime` (backend framework replacement phase 5)" or the
/// equivalent -- deliberate engineering, not an accidental copy-paste of
/// retired code. Flagging them would be backwards for this product's actual
/// architecture. The other sixteen entries are kept in full: none of them
/// exist in this repo, so keeping the check meaningful for future drift
/// costs nothing today.
const RETIRED_PRODUCT_TEMPLATE_SURFACES: &[RetiredProductTemplateSurface] = &[
    RetiredProductTemplateSurface {
        relative_path: "backend/src/app_state.rs",
        detail: "runtime auth/app state wiring belongs in appfw-runtime",
    },
    RetiredProductTemplateSurface {
        relative_path: "backend/src/cors.rs",
        detail: "CORS policy helpers belong in appfw-runtime",
    },
    RetiredProductTemplateSurface {
        relative_path: "backend/src/observability/mod.rs",
        detail: "observability helpers belong in appfw-runtime",
    },
    RetiredProductTemplateSurface {
        relative_path: "backend/src/config/access.rs",
        detail: "access config helpers belong in appfw-runtime",
    },
    RetiredProductTemplateSurface {
        relative_path: "backend/src/config/secrets.rs",
        detail: "secret resolution helpers belong in appfw-runtime",
    },
    RetiredProductTemplateSurface {
        relative_path: "backend/src/config/security.rs",
        detail: "security config helpers belong in appfw-runtime",
    },
    RetiredProductTemplateSurface {
        relative_path: "backend/src/data/filter_capabilities.rs",
        detail: "filter capability contracts belong in appfw-runtime",
    },
    RetiredProductTemplateSurface {
        relative_path: "backend/src/data/filtering.rs",
        detail: "filter parsing/runtime semantics belong in appfw-runtime",
    },
    RetiredProductTemplateSurface {
        relative_path: "backend/src/data/json_utils.rs",
        detail: "JSON conversion helpers belong in appfw-runtime",
    },
    RetiredProductTemplateSurface {
        relative_path: "backend/src/data/query_cost.rs",
        detail: "query cost policy belongs in appfw-runtime",
    },
    RetiredProductTemplateSurface {
        relative_path: "backend/src/data/validation.rs",
        detail: "record validation helpers belong in appfw-runtime",
    },
    RetiredProductTemplateSurface {
        relative_path: "backend/src/data/snake.rs",
        detail: "identifier normalization helpers belong in appfw-runtime",
    },
    RetiredProductTemplateSurface {
        relative_path: "backend/src/data/clients/contract_tests.rs",
        detail: "provider contract tests belong in framework/provider packages",
    },
    RetiredProductTemplateSurface {
        relative_path: "backend/src/data/clients/provider_capabilities.rs",
        detail: "provider capability contracts belong in appfw-runtime",
    },
    RetiredProductTemplateSurface {
        relative_path: "backend/src/data/clients/provider_error.rs",
        detail: "provider error classification belongs in provider/runtime packages",
    },
    RetiredProductTemplateSurface {
        relative_path: "backend/src/data/clients/test_support.rs",
        detail: "provider test support belongs in framework/provider packages",
    },
    RetiredProductTemplateSurface {
        relative_path: "backend/src/mcp/operation.rs",
        detail: "MCP operation helpers belong in appfw-runtime and generated operation adapters",
    },
];

struct ProviderTemplateSurface {
    provider: &'static str,
    data_source_type: &'static str,
    dependency_key: &'static str,
    package_name: &'static str,
    relative_path: &'static str,
}

/// Kept in full even under Option B (Postgres-only): this is a static
/// lookup table for detecting an *unwired* provider surface, not
/// multi-provider generation logic -- a product accidentally growing an
/// mssql/mongo/snowflake source tree without a data source that uses it is
/// exactly the kind of drift this check exists to catch.
const PROVIDER_TEMPLATE_SURFACES: &[ProviderTemplateSurface] = &[
    ProviderTemplateSurface {
        provider: "postgres",
        data_source_type: "PostgreSQL",
        dependency_key: "appfw_provider_postgres",
        package_name: "appfw-provider-postgres",
        relative_path: "backend/src/data/clients/postgres",
    },
    ProviderTemplateSurface {
        provider: "mongo",
        data_source_type: "MongoDB",
        dependency_key: "appfw_provider_mongo",
        package_name: "appfw-provider-mongo",
        relative_path: "backend/src/data/clients/mongo",
    },
    ProviderTemplateSurface {
        provider: "mssql",
        data_source_type: "MsSqlServer",
        dependency_key: "appfw_provider_mssql",
        package_name: "appfw-provider-mssql",
        relative_path: "backend/src/data/clients/mssql",
    },
    ProviderTemplateSurface {
        provider: "fabric_sql_analytics",
        data_source_type: "FabricSqlAnalytics",
        dependency_key: "appfw_provider_mssql",
        package_name: "appfw-provider-mssql",
        relative_path: "backend/src/data/clients/fabric_sql_analytics",
    },
    ProviderTemplateSurface {
        provider: "snowflake",
        data_source_type: "Snowflake",
        dependency_key: "appfw_provider_snowflake",
        package_name: "appfw-provider-snowflake",
        relative_path: "backend/src/data/clients/snowflake",
    },
];

pub fn build(app_root: &Path) -> Result<BoundaryCheckReport> {
    let mut files = Vec::new();
    let handlers_root = app_root.join("backend/src/handlers");
    collect_rs_files(&handlers_root, &mut |path| {
        if is_product_owned_handler(path) {
            files.push(path.to_path_buf());
        }
    })?;
    let services_root = app_root.join("backend/src/services");
    collect_rs_files(&services_root, &mut |path| {
        files.push(path.to_path_buf());
    })?;
    files.sort();

    let mut violations = Vec::new();
    for file in &files {
        check_boundary_file(app_root, file, &mut violations)?;
    }
    check_retired_product_template_surfaces(app_root, &mut violations);
    let product_provider_sources = check_product_provider_sources(app_root, &mut violations)?;

    Ok(BoundaryCheckReport {
        command: "boundary-check",
        ok: violations.is_empty(),
        app_root: app_root.display().to_string(),
        checked_files: files.len(),
        product_provider_sources,
        violations,
    })
}

fn check_retired_product_template_surfaces(
    app_root: &Path,
    violations: &mut Vec<BoundaryCheckViolation>,
) {
    for surface in RETIRED_PRODUCT_TEMPLATE_SURFACES {
        let path = app_root.join(surface.relative_path);
        if path.exists() {
            violations.push(BoundaryCheckViolation {
                path: surface.relative_path.to_string(),
                rule: "retired_product_template_surface".to_string(),
                detail: format!(
                    "{}; do not copy retired framework implementation back into product templates",
                    surface.detail
                ),
                symbol: Some(surface.relative_path.to_string()),
            });
        }
    }
}

fn check_product_provider_sources(
    app_root: &Path,
    violations: &mut Vec<BoundaryCheckViolation>,
) -> Result<ProductProviderSourceReport> {
    let active_providers = active_schema_provider_sources(app_root)?;
    let provider_dependencies = backend_provider_dependencies(app_root)?;
    let mut sources = Vec::new();
    let mut dependencies = Vec::new();

    for surface in PROVIDER_TEMPLATE_SURFACES {
        let path = app_root.join(surface.relative_path);
        if path.exists() {
            let active = active_providers.contains(surface.provider);
            let rust_files = count_rust_files(&path)?;
            if !active {
                violations.push(BoundaryCheckViolation {
                    path: surface.relative_path.to_string(),
                    rule: "inactive_provider_source".to_string(),
                    detail: format!(
                        "product templates must not carry {provider} provider source unless a configured schema or app topology data source uses a {data_source_type} data source",
                        provider = surface.provider,
                        data_source_type = surface.data_source_type
                    ),
                    symbol: Some(surface.relative_path.to_string()),
                });
            }
            sources.push(ProductProviderSource {
                provider: surface.provider.to_string(),
                path: surface.relative_path.to_string(),
                active,
                rust_files,
            });
        }

        if provider_dependencies.contains(surface.provider) {
            let active = active_providers.contains(surface.provider);
            if !active {
                violations.push(BoundaryCheckViolation {
                    path: "backend/Cargo.toml".to_string(),
                    rule: "inactive_provider_dependency".to_string(),
                    detail: format!(
                        "product backend manifests must not depend on {dependency} unless a configured schema or app topology data source uses a {data_source_type} data source",
                        dependency = surface.dependency_key,
                        data_source_type = surface.data_source_type
                    ),
                    symbol: Some(surface.dependency_key.to_string()),
                });
            }
            dependencies.push(ProductProviderDependency {
                provider: surface.provider.to_string(),
                dependency: surface.dependency_key.to_string(),
                active,
            });
        }
    }

    Ok(ProductProviderSourceReport {
        active_providers: active_providers.into_iter().collect(),
        sources,
        dependencies,
    })
}

fn backend_provider_dependencies(app_root: &Path) -> Result<BTreeSet<String>> {
    let manifest_path = app_root.join("backend/Cargo.toml");
    if !manifest_path.exists() {
        return Ok(BTreeSet::new());
    }
    let content = fs::read_to_string(&manifest_path)
        .with_context(|| format!("failed to read {}", manifest_path.display()))?;
    let mut dependencies = BTreeSet::new();
    let mut in_dependencies = false;
    for raw_line in content.lines() {
        let line = raw_line.split('#').next().unwrap_or("").trim();
        if line.is_empty() {
            continue;
        }
        if line.starts_with('[') && line.ends_with(']') {
            in_dependencies = line == "[dependencies]";
            continue;
        }
        if !in_dependencies {
            continue;
        }
        if let Some(provider) = provider_key_for_dependency_line(line) {
            dependencies.insert(provider.to_string());
        }
    }
    Ok(dependencies)
}

fn provider_key_for_dependency_line(line: &str) -> Option<&'static str> {
    let key = line
        .split_once('=')
        .map(|(key, _)| key.trim().trim_matches('"'))?;
    PROVIDER_TEMPLATE_SURFACES
        .iter()
        .find(|surface| {
            key == surface.dependency_key
                || key == surface.package_name
                || line.contains(&format!(r#"package = "{}""#, surface.package_name))
        })
        .map(|surface| surface.provider)
}

fn active_schema_provider_sources(app_root: &Path) -> Result<BTreeSet<String>> {
    let data_source_providers = data_source_provider_map(app_root)?;
    let mut active_providers = BTreeSet::new();
    let schemas_root = app_root.join(".appfw/model/schemas");
    if schemas_root.exists() {
        let mut dir_names: Vec<String> = fs::read_dir(&schemas_root)
            .with_context(|| format!("failed to read {}", schemas_root.display()))?
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.path().is_dir())
            .filter_map(|entry| entry.file_name().to_str().map(str::to_string))
            .collect();
        dir_names.sort();
        for schema_name in dir_names {
            let path = schemas_root.join(&schema_name).join("_res.yaml");
            if !path.exists() {
                continue;
            }
            let yaml = read_yaml_file(&path)?;
            let Some(data_source_name) = yaml_string_field(&yaml, "data_source_name") else {
                continue;
            };
            if let Some(provider) = data_source_providers.get(data_source_name) {
                active_providers.insert(provider.clone());
            }
        }
    }
    Ok(active_providers)
}

fn data_source_provider_map(app_root: &Path) -> Result<std::collections::BTreeMap<String, String>> {
    let path = app_root.join(".appfw/model/data_sources/_res.yaml");
    if !path.exists() {
        return Ok(std::collections::BTreeMap::new());
    }
    let yaml = read_yaml_file(&path)?;
    let mut providers = std::collections::BTreeMap::new();
    let Some(items) = yaml.as_sequence() else {
        return Ok(providers);
    };
    for item in items {
        let Some(name) = yaml_string_field(item, "name") else {
            continue;
        };
        let Some(data_source_type) = yaml_string_field(item, "data_source_type") else {
            continue;
        };
        if let Some(surface) = PROVIDER_TEMPLATE_SURFACES
            .iter()
            .find(|surface| surface.data_source_type == data_source_type)
        {
            providers.insert(name.to_string(), surface.provider.to_string());
        }
    }
    Ok(providers)
}

fn read_yaml_file(path: &Path) -> Result<serde_yaml::Value> {
    let content =
        fs::read_to_string(path).with_context(|| format!("failed to read {}", path.display()))?;
    serde_yaml::from_str(&content).with_context(|| format!("failed to parse {}", path.display()))
}

fn yaml_string_field<'a>(value: &'a serde_yaml::Value, key: &str) -> Option<&'a str> {
    value
        .as_mapping()
        .and_then(|mapping| mapping.get(serde_yaml::Value::String(key.to_string())))
        .and_then(serde_yaml::Value::as_str)
}

fn check_boundary_file(
    app_root: &Path,
    path: &Path,
    violations: &mut Vec<BoundaryCheckViolation>,
) -> Result<()> {
    let content =
        fs::read_to_string(path).with_context(|| format!("failed to read {}", path.display()))?;
    let rel = path
        .strip_prefix(app_root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/");
    let file = match syn::parse_file(&content) {
        Ok(file) => file,
        Err(err) => {
            violations.push(BoundaryCheckViolation {
                path: rel,
                rule: "rust_parse".to_string(),
                detail: format!("failed to parse Rust source: {err}"),
                symbol: None,
            });
            return Ok(());
        }
    };

    if let Some(violation) = forbidden_framework_import(&file) {
        violations.push(BoundaryCheckViolation {
            path: rel.clone(),
            rule: violation.rule.to_string(),
            detail: "product-owned handlers/services must use crate::product_api instead of framework internals".to_string(),
            symbol: Some(violation.path),
        });
    }

    let standard_impls = file
        .items
        .iter()
        .filter_map(|item| match item {
            syn::Item::Fn(item_fn) if is_standard_handler_impl(item_fn) => {
                Some(item_fn.sig.ident.to_string())
            }
            _ => None,
        })
        .collect::<Vec<_>>();
    if !standard_impls.is_empty() && !content.contains("appfw: override-standard") {
        violations.push(BoundaryCheckViolation {
            path: rel,
            rule: "implicit_standard_handler_override".to_string(),
            detail: "standard generated handler defaults must include an appfw: override-standard marker when overridden".to_string(),
            symbol: Some(standard_impls.join(",")),
        });
    }

    Ok(())
}

fn count_rust_files(root: &Path) -> Result<usize> {
    let mut count = 0;
    collect_rs_files(root, &mut |_| count += 1)?;
    Ok(count)
}

fn collect_rs_files(root: &Path, f: &mut dyn FnMut(&Path)) -> Result<()> {
    if !root.exists() {
        return Ok(());
    }
    let entries =
        fs::read_dir(root).with_context(|| format!("failed to read {}", root.display()))?;
    for entry in entries {
        let path = entry
            .with_context(|| format!("failed to read entry under {}", root.display()))?
            .path();
        if path.is_dir() {
            collect_rs_files(&path, f)?;
            continue;
        }
        if path.extension().and_then(|ext| ext.to_str()) == Some("rs") {
            f(&path);
        }
    }
    Ok(())
}

fn is_product_owned_handler(path: &Path) -> bool {
    let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
        return false;
    };
    if matches!(file_name, "mod.rs" | "generated.rs" | "selections.rs") {
        return false;
    }
    let path_text = path.to_string_lossy().replace('\\', "/");
    if path_text.contains("/handlers/auth/") {
        return false;
    }
    path_text.contains("/handlers/")
}

struct BoundaryViolation {
    rule: &'static str,
    path: String,
}

fn forbidden_framework_import(file: &syn::File) -> Option<BoundaryViolation> {
    let mut visitor = BoundaryVisitor::default();
    visitor.visit_file(file);
    visitor.violation
}

#[derive(Default)]
struct BoundaryVisitor {
    violation: Option<BoundaryViolation>,
}

impl<'ast> Visit<'ast> for BoundaryVisitor {
    fn visit_item_use(&mut self, item: &'ast ItemUse) {
        self.inspect_use_tree(&item.tree, Vec::new());
        if self.violation.is_none() {
            visit::visit_item_use(self, item);
        }
    }

    fn visit_path(&mut self, path: &'ast syn::Path) {
        if self.violation.is_none() {
            let segments = path
                .segments
                .iter()
                .map(|segment| segment.ident.to_string())
                .collect::<Vec<_>>();
            self.inspect_segments(&segments);
        }
        if self.violation.is_none() {
            visit::visit_path(self, path);
        }
    }

    fn visit_expr_method_call(&mut self, call: &'ast syn::ExprMethodCall) {
        if let (true, Some(symbol)) = (
            self.violation.is_none(),
            forbidden_context_data_call_symbol(call),
        ) {
            self.violation = Some(BoundaryViolation {
                rule: "GraphQL context internals",
                path: symbol,
            });
        }
        if self.violation.is_none() {
            visit::visit_expr_method_call(self, call);
        }
    }
}

impl BoundaryVisitor {
    fn inspect_use_tree(&mut self, tree: &UseTree, prefix: Vec<String>) {
        if self.violation.is_some() {
            return;
        }
        match tree {
            UseTree::Path(path) => {
                let mut segments = prefix;
                segments.push(path.ident.to_string());
                self.inspect_segments(&segments);
                self.inspect_use_tree(&path.tree, segments);
            }
            UseTree::Name(name) => {
                let mut segments = prefix;
                segments.push(name.ident.to_string());
                self.inspect_segments(&segments);
            }
            UseTree::Rename(rename) => {
                let mut segments = prefix;
                segments.push(rename.ident.to_string());
                self.inspect_segments(&segments);
            }
            UseTree::Glob(_) => self.inspect_segments(&prefix),
            UseTree::Group(group) => {
                for item in &group.items {
                    self.inspect_use_tree(item, prefix.clone());
                    if self.violation.is_some() {
                        break;
                    }
                }
            }
        }
    }

    fn inspect_segments(&mut self, segments: &[String]) {
        if self.violation.is_some() {
            return;
        }
        if let Some(rule) = forbidden_crate_path_rule(segments) {
            self.violation = Some(BoundaryViolation {
                rule,
                path: segments.join("::"),
            });
        } else if let Some(rule) = forbidden_external_path_rule(segments) {
            self.violation = Some(BoundaryViolation {
                rule,
                path: segments.join("::"),
            });
        }
    }
}

fn forbidden_external_path_rule(segments: &[String]) -> Option<&'static str> {
    match (
        segments.first().map(String::as_str),
        segments.get(1).map(String::as_str),
    ) {
        (Some("async_graphql"), Some("Context")) => Some("GraphQL context internals"),
        _ => None,
    }
}

fn forbidden_context_data_call_symbol(call: &syn::ExprMethodCall) -> Option<String> {
    if !matches!(
        call.method.to_string().as_str(),
        "data_opt" | "data_unchecked"
    ) {
        return None;
    }
    let syn::Expr::Path(receiver_path) = call.receiver.as_ref() else {
        return None;
    };
    receiver_path
        .path
        .segments
        .last()
        .map(|segment| format!("{}.{}", segment.ident, call.method))
}

fn forbidden_crate_path_rule(segments: &[String]) -> Option<&'static str> {
    if segments.first().map(String::as_str) != Some("crate") {
        return None;
    }
    match segments.get(1).map(String::as_str) {
        Some("data") => Some("data runtime internals"),
        Some("config") => Some("config internals"),
        Some("routes") => Some("route internals"),
        Some("handlers") if segments.get(2).map(String::as_str) == Some("auth") => {
            Some("auth handler internals")
        }
        Some("mcp") => Some("MCP runtime internals"),
        Some("observability") => Some("observability internals"),
        Some("admin_ui") => Some("admin UI internals"),
        Some("app_state") => Some("app state internals"),
        Some("provider_certification") => Some("provider certification internals"),
        _ => None,
    }
}

fn is_standard_handler_impl(item_fn: &ItemFn) -> bool {
    matches!(
        item_fn.sig.ident.to_string().as_str(),
        "find_impl"
            | "get_impl"
            | "query_impl"
            | "aggregate_impl"
            | "create_impl"
            | "update_impl"
            | "delete_impl"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn app_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
    }

    #[test]
    fn current_tree_has_no_boundary_violations() {
        let report = build(&app_root()).expect("boundary check should run");
        assert!(
            report.ok,
            "expected 0 violations, found: {:#?}",
            report.violations
        );
        assert!(
            report.checked_files > 0,
            "expected to check at least one file"
        );
    }

    #[test]
    fn postgres_is_the_only_active_provider() {
        let report = build(&app_root()).expect("boundary check should run");
        assert_eq!(
            report.product_provider_sources.active_providers,
            vec!["postgres".to_string()]
        );
        let postgres_source = report
            .product_provider_sources
            .sources
            .iter()
            .find(|source| source.provider == "postgres")
            .expect("postgres provider source should be present");
        assert!(postgres_source.active);
        assert!(postgres_source.rust_files > 0);
    }
}
