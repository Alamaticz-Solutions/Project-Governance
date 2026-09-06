//! Slice 7b: `validate`. Ported from `app_gen/src/validation.rs` (6,710
//! lines, read in full) -- confirmed in §9 of
//! `docs/architecture/phase6-app-gen-scoping.md` to be ~55 independently
//! portable methods, not a monolith, and mostly provider-agnostic model/
//! shape/facet/relationship/seed/test-config validation rather than
//! multi-provider branching.
//!
//! **Deliberately excluded, each for a documented reason, not silently
//! dropped:**
//! - `validate_templates` (lints `_templates/**/*.j2` for `.unwrap()`/
//!   `panic!`/etc.) -- this product has no `_templates` directory at all
//!   (confirmed: `find .appfw/model -iname _templates` is empty). There is
//!   nothing to lint.
//! - `validate_sync_descriptors` / `validate_app_manifest` (kafka ingress
//!   residue, sync worker descriptors, app topology) -- non-goals per §6;
//!   confirmed against this product's own `.appfw/manifest.yaml`: its one
//!   kafka ingress entry is `enabled: false`, so there's no live topology
//!   signal this would ever act on.
//! - Provider-specific connection/auth validation for MSSQL/Fabric/Entra
//!   (`appfw_mssql_auth::*`) and MongoDB host-shape checks
//!   (`validate_mongodb_connection_host`) -- Option B is Postgres-only, and
//!   `appfw_mssql_auth`'s equivalents were already resolved (deleted/
//!   inlined) by phases 1-2 per this doc's own non-goals list.
//! - The data-classification/PHI-regulated-cascade subsystem
//!   (`validate_data_classification_meta` and everything that reads
//!   `meta.classification`) -- confirmed unused: `grep -rl classification
//!   .appfw/model` matches only a docs file, never real model YAML. This is
//!   also a live, acknowledged product gap (HANDOFF.md's PHI/PII lint is
//!   explicitly "a first pass... not hardened"), not a settled contract to
//!   port silently.
//!
//! Everything else -- fragments, facets, data sources/environments/
//! connection security, schemas, enum types, entity types, properties
//! (fragment resolution, relation/nav/many-to-many shape), facets lists,
//! standard/custom methods, provider routines (the injection-safety
//! identifier check applies regardless of provider), indexes,
//! relationships (endpoint/storage/junction resolution, FK/nav/M2M cross-
//! entity checks), the one generic provider-feature check (Postgres
//! rejecting Mongo-style `ObjectId`), seed configs (column/type/enum
//! checking), and API test configs -- is ported.
//!
//! Report shape is simplified from the framework's `WorkspaceRoots`
//! (`app_root`/`framework_root`/`generator_root`/`config_root`/
//! `templates_root`/`report_root`) to just `app_root`/`config_root`/
//! `report_path`, same simplification as `boundary_check`'s `CommandRoots`
//! and for the same reason: there is no separate framework checkout left
//! to describe.

use std::collections::{BTreeSet, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use inflector::cases::pascalcase::{is_pascal_case, to_pascal_case};
use serde::Serialize;
use serde_json::{Map, Value};

const DATA_SOURCE_TYPES: &[&str] = &[
    "MsSqlServer",
    "FabricSqlAnalytics",
    "PostgreSQL",
    "MongoDB",
    "Snowflake",
    "Neo4j",
    "ServiceNow",
    "Workday",
    "Icims",
    "Salesforce",
    "Anaplan",
    "OracleFinancials",
];
const SECURITY_PROFILES: &[&str] = &["local_dev", "managed"];
const TLS_MODES: &[&str] = &["disabled", "prefer", "require", "verify_ca", "verify_full"];
const DATA_TYPES: &[&str] = &[
    "Uuid",
    "UuidArray",
    "ObjectId",
    "ObjectIdArray",
    "Boolean",
    "String",
    "StringArray",
    "Date",
    "DateTime",
    "Time",
    "Int8",
    "Int8Array",
    "Int16",
    "Int16Array",
    "Int32",
    "Int32Array",
    "Int64",
    "Int64Array",
    "Float32",
    "Float64",
    "Enum",
    "EnumArray",
    "Object",
    "ObjectArray",
    "Json",
    "JsonArray",
    "NavToOne",
    "NavToMany",
    "ManyToMany",
];
const COMPUTED_VALUES: &[&str] = &[
    "Concatenate",
    "Format",
    "Word",
    "Inflection",
    "DateTimeNow",
    "None",
];
const STANDARD_METHODS: &[&str] = &["FindById", "GetAll", "Query", "Create", "Update", "Delete"];
const CUSTOM_METHOD_KINDS: &[&str] = &["Query", "Mutation", "Command"];
const PROVIDER_ROUTINE_KINDS: &[&str] = &["Function", "Procedure"];
const PROVIDER_ROUTINE_RETURNS: &[&str] = &["None", "One", "Many"];
const PROVIDER_ROUTINE_PROVIDERS: &[&str] = &["postgres", "mssql", "snowflake"];
const PROVIDER_ROUTINE_ARG_TYPES: &[&str] = &[
    "String",
    "Option<String>",
    "bool",
    "Option<bool>",
    "i8",
    "Option<i8>",
    "i16",
    "Option<i16>",
    "i32",
    "Option<i32>",
    "i64",
    "Option<i64>",
    "f32",
    "Option<f32>",
    "f64",
    "Option<f64>",
    "JsonValue",
    "Option<JsonValue>",
    "serde_json::Value",
    "Option<serde_json::Value>",
];
const FACETS: &[&str] = &["audited", "concurrency", "soft-deleted"];
const RELATIONSHIP_KINDS: &[&str] = &["OneToOne", "OneToMany", "ManyToMany"];
const RELATIONSHIP_STORAGE_TYPES: &[&str] = &["ForeignKey"];

fn is_external_api_data_source_type(data_source_type: &str) -> bool {
    matches!(
        data_source_type,
        "ServiceNow" | "Workday" | "Icims" | "Salesforce" | "Anaplan" | "OracleFinancials"
    )
}

fn non_crud_data_source_reason(data_source_type: &str) -> Option<&'static str> {
    match data_source_type {
        "Neo4j" => {
            Some("Neo4j is a graph read provider and cannot host generated CRUD entity schemas.")
        }
        "ServiceNow" | "Workday" | "Icims" | "Salesforce" | "Anaplan" | "OracleFinancials" => Some(
            "External API providers use named SaaS operations and cannot host generated CRUD entity schemas.",
        ),
        _ => None,
    }
}

#[derive(Debug, Serialize)]
pub struct ValidationReport {
    pub version: u32,
    pub valid: bool,
    pub generated_at: String,
    pub app_root: String,
    pub config_root: String,
    pub report_path: String,
    pub summary: ValidationSummary,
    pub issues: Vec<ValidationIssue>,
}

#[derive(Debug, Serialize)]
pub struct ValidationSummary {
    pub errors: usize,
    pub warnings: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct ValidationIssue {
    pub severity: &'static str,
    pub code: &'static str,
    pub message: String,
    pub file: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entity_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub property_name: Option<String>,
    pub expected: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual: Option<String>,
    pub suggested_fix: String,
}

#[derive(Debug, Clone)]
struct Location {
    file: PathBuf,
    path: String,
    schema_name: Option<String>,
    entity_name: Option<String>,
    property_name: Option<String>,
}

impl Location {
    fn root(file: PathBuf) -> Self {
        Self {
            file,
            path: "$".to_string(),
            schema_name: None,
            entity_name: None,
            property_name: None,
        }
    }

    fn field(&self, field: &str) -> Self {
        let mut loc = self.clone();
        loc.path = format!("{}.{}", self.path, field);
        loc
    }

    fn index(&self, idx: usize) -> Self {
        let mut loc = self.clone();
        loc.path = format!("{}[{idx}]", self.path);
        loc
    }

    fn with_schema(&self, schema_name: String) -> Self {
        let mut loc = self.clone();
        loc.schema_name = Some(schema_name);
        loc
    }

    fn with_entity(&self, entity_name: String) -> Self {
        let mut loc = self.clone();
        loc.entity_name = Some(entity_name);
        loc
    }

    fn with_property(&self, property_name: String) -> Self {
        let mut loc = self.clone();
        loc.property_name = Some(property_name);
        loc
    }
}

#[derive(Debug, Clone)]
struct FragmentInfo {
    value: Value,
}

#[derive(Debug, Clone)]
struct DataSourceInfo {
    data_source_type: String,
}

#[derive(Debug, Clone)]
struct SchemaInfo {
    data_source_type: Option<String>,
    external_read_only: bool,
}

#[derive(Debug, Clone)]
struct EntityInfo {
    schema_name: String,
    name: String,
    is_table: bool,
    is_union: bool,
    base_type: Option<String>,
    loc: Location,
    props: HashMap<String, PropertyInfo>,
    prop_names: Vec<String>,
}

#[derive(Debug, Clone)]
struct PropertyInfo {
    name: String,
    data_type: Option<String>,
    is_key: bool,
    is_required: bool,
    is_read_only: bool,
    is_concurrency_control: bool,
    computed: Option<String>,
    loc: Location,
    foreign_key: Option<RelationRef>,
    nav_by_fk_property: Option<NavRef>,
    many_to_many_property: Option<ManyToManyRef>,
    nested_entity_type: Option<RelationRef>,
    enum_type_name: Option<String>,
}

#[derive(Debug, Clone)]
struct RelationRef {
    schema_name: String,
    type_name: String,
    loc: Location,
}

#[derive(Debug, Clone)]
struct NavRef {
    schema_name: String,
    type_name: String,
    prop_name: String,
    loc: Location,
}

#[derive(Debug, Clone)]
struct ManyToManyRef {
    junction_table: String,
    junction_schema: Option<String>,
    local_key: String,
    foreign_key: String,
    target_schema: String,
    target_type: String,
    loc: Location,
}

#[derive(Debug, Clone)]
struct RelationshipInfo {
    name: String,
    kind: String,
    loc: Location,
    left: Option<RelationshipEndpointInfo>,
    right: Option<RelationshipEndpointInfo>,
    one: Option<RelationshipEndpointInfo>,
    many: Option<RelationshipEndpointInfo>,
    storage: Option<RelationshipStorageInfo>,
    junction: Option<RelationshipJunctionInfo>,
}

#[derive(Debug, Clone)]
struct RelationshipEndpointInfo {
    schema_name: String,
    entity_name: String,
    field_name: String,
    loc: Location,
}

#[derive(Debug, Clone)]
struct RelationshipStorageInfo {
    storage_type: String,
    owner_schema: String,
    owner: String,
    field: String,
    loc: Location,
}

#[derive(Debug, Clone)]
struct RelationshipJunctionInfo {
    schema_name: String,
    entity_name: String,
    left_key: String,
    right_key: String,
}

#[derive(Debug, Clone)]
struct JunctionInfo {
    columns: BTreeSet<String>,
}

#[derive(Clone, Copy)]
enum PropertyShapeMode {
    Fragment,
    FacetProperty,
    EntityProperty,
}

impl PropertyShapeMode {
    fn requires_name(self) -> bool {
        matches!(self, Self::FacetProperty | Self::EntityProperty)
    }
}

struct Validator {
    app_root: PathBuf,
    config_root: PathBuf,
    report_path: PathBuf,
    issues: Vec<ValidationIssue>,
    fragments: HashMap<String, FragmentInfo>,
    data_sources: HashMap<String, DataSourceInfo>,
    schemas: HashMap<String, SchemaInfo>,
    schema_dirs: Vec<(String, PathBuf)>,
    enum_types: HashMap<String, Location>,
    enum_values: HashMap<String, HashSet<String>>,
    entity_types: HashMap<String, EntityInfo>,
    entity_ids: HashMap<String, Location>,
    relationships: Vec<RelationshipInfo>,
    relationship_names: HashMap<String, Location>,
    junctions: HashMap<String, JunctionInfo>,
    seed_keys: HashMap<String, Location>,
}

/// Run every included validation category against `app_root` and write
/// `.appfw/target/appfw/validation.json`. Does not fail the process on
/// validation errors -- callers (the CLI) decide the exit code from
/// `report.valid`.
pub fn run(app_root: &Path) -> Result<ValidationReport> {
    let mut validator = Validator::new(app_root);
    validator.validate();
    let report = validator.report();
    validator.write_report(&report)?;
    Ok(report)
}

impl Validator {
    fn new(app_root: &Path) -> Self {
        let config_root = app_root.join(".appfw/model");
        Self {
            app_root: app_root.to_path_buf(),
            report_path: app_root.join(".appfw/target/appfw/validation.json"),
            config_root,
            issues: vec![],
            fragments: HashMap::new(),
            data_sources: HashMap::new(),
            schemas: HashMap::new(),
            schema_dirs: vec![],
            enum_types: HashMap::new(),
            enum_values: HashMap::new(),
            entity_types: HashMap::new(),
            entity_ids: HashMap::new(),
            relationships: vec![],
            relationship_names: HashMap::new(),
            junctions: HashMap::new(),
            seed_keys: HashMap::new(),
        }
    }

    fn validate(&mut self) {
        self.validate_fragments();
        self.validate_facets();
        self.validate_data_sources();
        self.validate_schemas();
        self.validate_relationships();
        self.validate_provider_features();
        self.validate_seed_configs();
        self.validate_test_configs();
    }

    fn report(&self) -> ValidationReport {
        let errors = self.issues.iter().filter(|i| i.severity == "error").count();
        let warnings = self
            .issues
            .iter()
            .filter(|i| i.severity == "warning")
            .count();
        ValidationReport {
            version: 1,
            valid: errors == 0,
            generated_at: chrono::Utc::now().to_rfc3339(),
            app_root: self.app_root.display().to_string(),
            config_root: self.config_root.display().to_string(),
            report_path: self.report_path.display().to_string(),
            summary: ValidationSummary { errors, warnings },
            issues: self.issues.clone(),
        }
    }

    fn write_report(&self, report: &ValidationReport) -> Result<()> {
        if let Some(parent) = self.report_path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("could not create {}", parent.display()))?;
        }
        let json = serde_json::to_string_pretty(report)?;
        fs::write(&self.report_path, format!("{json}\n"))
            .with_context(|| format!("could not write {}", self.report_path.display()))?;
        Ok(())
    }

    // ---- fragments / facets ----------------------------------------

    fn validate_fragments(&mut self) {
        let fragments_dir = self.config_root.join("_fragments");
        let files = self.yaml_files(&fragments_dir, true, false);

        for file in files {
            let Some(fragment_name) = file.file_stem().and_then(|name| name.to_str()) else {
                continue;
            };
            let fragment_name = fragment_name.to_string();
            let loc = Location::root(file.clone());
            let Some(value) = self.read_yaml_value(&file, &loc) else {
                continue;
            };

            if self.fragments.contains_key(&fragment_name) {
                self.error(
                    "duplicate_fragment",
                    format!("Duplicate fragment name `{fragment_name}`."),
                    &loc,
                    "unique fragment file stems under _fragments",
                    Some(fragment_name.clone()),
                    "Rename one fragment file so every fragment reference is unambiguous.",
                );
            }

            let _ = self.validate_property_shape(&value, &loc, PropertyShapeMode::Fragment);
            self.fragments.insert(fragment_name, FragmentInfo { value });
        }
    }

    fn validate_facets(&mut self) {
        let facets_dir = self.config_root.join("_facets");
        let files = self.yaml_files(&facets_dir, false, false);

        for file in files {
            let loc = Location::root(file.clone());
            let Some(value) = self.read_yaml_value(&file, &loc) else {
                continue;
            };

            if let Some(items) = value.as_array() {
                for (idx, item) in items.iter().enumerate() {
                    self.validate_entity_patch(item, &loc.index(idx));
                }
            } else if let Some(obj) = value.as_object() {
                if obj.contains_key("props") {
                    self.validate_entity_patch(&value, &loc);
                } else {
                    let _ = self.validate_property_shape(
                        &value,
                        &loc,
                        PropertyShapeMode::FacetProperty,
                    );
                }
            } else {
                self.error(
                    "invalid_facet_shape",
                    "Facet YAML must be an object or array of objects.".to_string(),
                    &loc,
                    "object property patch, entity patch, or array of entity patches",
                    Some(value_kind(&value).to_string()),
                    "Use a mapping with property fields, or a list of mappings with `props`.",
                );
            }
        }
    }

    // ---- data sources ------------------------------------------------

    fn validate_data_sources(&mut self) {
        let file = self.config_root.join("data_sources/_res.yaml");
        let loc = Location::root(file.clone());
        let Some(value) = self.read_yaml_value(&file, &loc) else {
            return;
        };
        let Some(items) = self.expect_array(&value, &loc, "data source array") else {
            return;
        };
        let items = items.clone();

        let mut system_hosts = vec![];
        for (idx, item) in items.iter().enumerate() {
            let item_loc = loc.index(idx);
            let Some(obj) = self
                .expect_object(item, &item_loc, "data source object")
                .cloned()
            else {
                continue;
            };

            self.validate_known_fields(
                &obj,
                &[
                    "name",
                    "data_source_type",
                    "is_system_schema_host",
                    "description",
                    "meta",
                    "environments",
                ],
                &item_loc,
                "data source fields",
            );

            let name = self.string_field(&obj, "name", &item_loc, true);
            let data_source_type =
                self.enum_field(&obj, "data_source_type", &item_loc, DATA_SOURCE_TYPES, true);

            if let Some(name) = &name {
                if self.data_sources.contains_key(name) {
                    self.error(
                        "duplicate_data_source",
                        format!("Duplicate data source `{name}`."),
                        &item_loc.field("name"),
                        "unique data source names",
                        Some(name.clone()),
                        "Rename one data source or update schemas to point at the intended one.",
                    );
                }
            }

            if let Some(is_system_host) = obj.get("is_system_schema_host") {
                if !is_system_host.is_boolean() {
                    self.error(
                        "invalid_field_type",
                        "`is_system_schema_host` must be a boolean.".to_string(),
                        &item_loc.field("is_system_schema_host"),
                        "boolean",
                        Some(value_kind(is_system_host).to_string()),
                        "Use `true` on exactly one data source, or omit the field.",
                    );
                } else if is_system_host.as_bool() == Some(true) {
                    if let Some(name) = &name {
                        if let Some(provider) = data_source_type.as_deref() {
                            if provider == "FabricSqlAnalytics" {
                                self.error(
                                    "invalid_system_schema_host",
                                    "FabricSqlAnalytics data sources cannot host the generated system schema.".to_string(),
                                    &item_loc.field("is_system_schema_host"),
                                    "a writable database provider for the system schema host",
                                    Some(name.clone()),
                                    "Use PostgreSQL, MongoDB, MS SQL Server, or Snowflake for generated system metadata; keep FabricSqlAnalytics as a read-only analytics data source.",
                                );
                            }
                            if provider == "Neo4j" || is_external_api_data_source_type(provider) {
                                self.error(
                                    "invalid_system_schema_host",
                                    "Non-CRUD providers cannot host the generated system schema."
                                        .to_string(),
                                    &item_loc.field("is_system_schema_host"),
                                    "a writable database provider for the system schema host",
                                    Some(name.clone()),
                                    "Use PostgreSQL, MongoDB, MS SQL Server, or Snowflake for generated system metadata; keep graph and external API providers behind named operation surfaces.",
                                );
                            }
                        }
                        system_hosts.push(name.clone());
                    }
                }
            }

            self.validate_environments(obj.get("environments"), &item_loc);

            if let (Some(name), Some(data_source_type)) = (&name, &data_source_type) {
                self.data_sources.insert(
                    name.clone(),
                    DataSourceInfo {
                        data_source_type: data_source_type.clone(),
                    },
                );
            }
        }

        if system_hosts.len() > 1 {
            self.error(
                "duplicate_system_schema_host",
                "More than one data source is marked as the system schema host.".to_string(),
                &loc,
                "zero or one data source with `is_system_schema_host: true`",
                Some(system_hosts.join(", ")),
                "Keep `is_system_schema_host: true` on only one legacy persisted system metadata source, or omit it for code-only system metadata.",
            );
        }
    }

    fn validate_environments(&mut self, value: Option<&Value>, parent_loc: &Location) {
        let env_loc = parent_loc.field("environments");
        let Some(value) = value else {
            self.error(
                "missing_required_field",
                "Data source is missing `environments`.".to_string(),
                &env_loc,
                "non-empty array of environment objects",
                None,
                "Add at least a `local` environment with db_host, db_name, and db_port.",
            );
            return;
        };
        let Some(items) = self
            .expect_array(value, &env_loc, "environment array")
            .cloned()
        else {
            return;
        };
        if items.is_empty() {
            self.error(
                "empty_environments",
                "Data source has no environments.".to_string(),
                &env_loc,
                "non-empty array of environment objects",
                Some("[]".to_string()),
                "Add a `local` environment entry.",
            );
        }

        let mut names = HashSet::new();
        for (idx, item) in items.iter().enumerate() {
            let item_loc = env_loc.index(idx);
            let Some(obj) = self
                .expect_object(item, &item_loc, "environment object")
                .cloned()
            else {
                continue;
            };
            self.validate_known_fields(
                &obj,
                &[
                    "name",
                    "db_host",
                    "db_name",
                    "db_port",
                    "security_profile",
                    "tls_mode",
                    "auth_mode",
                    "entra_tenant_id",
                    "entra_token_scope",
                    "service_account_name",
                    "service_account_password",
                ],
                &item_loc,
                "environment fields",
            );
            let name = self.string_field(&obj, "name", &item_loc, true);
            self.string_field(&obj, "db_host", &item_loc, true);
            self.string_field(&obj, "db_name", &item_loc, true);
            self.string_or_number_field(&obj, "db_port", &item_loc, true);
            let security_profile =
                self.enum_field(&obj, "security_profile", &item_loc, SECURITY_PROFILES, true);
            let tls_mode = self.enum_field(&obj, "tls_mode", &item_loc, TLS_MODES, true);

            if let (Some(name), Some(security_profile), Some(tls_mode)) =
                (&name, &security_profile, &tls_mode)
            {
                self.validate_connection_security(name, security_profile, tls_mode, &item_loc);
            }

            if let Some(name) = name {
                if !names.insert(name.clone()) {
                    self.error(
                        "duplicate_environment",
                        format!("Duplicate data source environment `{name}`."),
                        &item_loc.field("name"),
                        "unique environment names per data source",
                        Some(name),
                        "Rename or remove the duplicate environment.",
                    );
                }
            }
        }
    }

    fn validate_connection_security(
        &mut self,
        env_name: &str,
        security_profile: &str,
        tls_mode: &str,
        loc: &Location,
    ) {
        let is_local_env = matches!(env_name, "local" | "compose");

        if security_profile == "local_dev" && !is_local_env {
            self.error(
                "invalid_connection_security",
                "`local_dev` security_profile is only allowed for `local` or `compose` environments."
                    .to_string(),
                &loc.field("security_profile"),
                "`managed` for non-local environments",
                Some(format!("name: {env_name}, security_profile: {security_profile}")),
                "Use `managed` with a TLS mode for shared, staging, and production environments.",
            );
        }

        if tls_mode == "disabled" && !(security_profile == "local_dev" && is_local_env) {
            self.error(
                "invalid_connection_security",
                "`disabled` tls_mode is only allowed for local development environments."
                    .to_string(),
                &loc.field("tls_mode"),
                "`require`, `verify_ca`, or `verify_full`",
                Some(format!("name: {env_name}, tls_mode: {tls_mode}")),
                "Use TLS for non-local database connections.",
            );
        }

        if tls_mode == "prefer" && security_profile != "local_dev" {
            self.error(
                "invalid_connection_security",
                "`prefer` tls_mode is only allowed for local development environments.".to_string(),
                &loc.field("tls_mode"),
                "`require`, `verify_ca`, or `verify_full`",
                Some(format!(
                    "security_profile: {security_profile}, tls_mode: {tls_mode}"
                )),
                "Use fail-closed TLS modes for managed data sources.",
            );
        }
    }

    // ---- schemas -------------------------------------------------------

    fn validate_schemas(&mut self) {
        let schemas_dir = self.config_root.join("schemas");
        let schema_dirs = self.schema_dirs_under(&schemas_dir);

        for schema_dir in schema_dirs {
            let dir_name = schema_dir
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("<unknown>")
                .to_string();
            let schema_file = schema_dir.join("_res.yaml");
            let loc = Location::root(schema_file.clone()).with_schema(dir_name.clone());
            let Some(value) = self.read_yaml_value(&schema_file, &loc) else {
                continue;
            };
            let Some(obj) = self.expect_object(&value, &loc, "schema object").cloned() else {
                continue;
            };
            self.validate_known_fields(
                &obj,
                &["id", "name", "description", "data_source_name", "meta"],
                &loc,
                "schema fields",
            );

            self.uuid_field(&obj, "id", &loc, true);
            let name = self
                .string_field(&obj, "name", &loc, true)
                .unwrap_or_else(|| dir_name.clone());
            self.string_field(&obj, "description", &loc, true);
            let data_source_name = self
                .string_field(&obj, "data_source_name", &loc, true)
                .unwrap_or_default();
            let external_read_only = schema_meta_external_read_only(obj.get("meta"));

            if name != dir_name {
                self.error(
                    "schema_name_mismatch",
                    format!("Schema name `{name}` does not match directory `{dir_name}`."),
                    &loc.field("name"),
                    "schema name matching its .appfw/model/schemas/<name> directory",
                    Some(name.clone()),
                    format!("Rename the directory to `{name}` or set `name: {dir_name}`."),
                );
            }

            if self.schemas.contains_key(&name) {
                self.error(
                    "duplicate_schema",
                    format!("Duplicate schema `{name}`."),
                    &loc.field("name"),
                    "unique schema names",
                    Some(name.clone()),
                    "Rename one schema directory and update references.",
                );
            }

            let data_source_info = if data_source_name.is_empty() {
                None
            } else if let Some(info) = self.data_sources.get(&data_source_name) {
                Some(info.clone())
            } else {
                self.error(
                    "missing_data_source",
                    format!("Schema `{name}` references unknown data source `{data_source_name}`."),
                    &loc.field("data_source_name"),
                    "name from .appfw/model/data_sources/_res.yaml",
                    Some(data_source_name.clone()),
                    "Add the data source or update `data_source_name` to an existing data source.",
                );
                None
            };
            if let Some(provider) = data_source_info
                .as_ref()
                .map(|i| i.data_source_type.as_str())
            {
                if let Some(reason) = non_crud_data_source_reason(provider) {
                    let code = if provider == "Neo4j" {
                        "schema_uses_graph_read_provider"
                    } else {
                        "schema_uses_external_api_provider"
                    };
                    self.error(
                        code,
                        format!(
                            "Schema `{name}` uses {provider} data source `{data_source_name}`, but {reason}"
                        ),
                        &loc.field("data_source_name"),
                        "CRUD-capable data source such as PostgreSQL, MongoDB, MS SQL Server, or Snowflake",
                        Some(data_source_name.clone()),
                        "Keep entity schemas on a primary data provider or projection schema; access graph and SaaS providers through named operations, sync workers, or product services.",
                    );
                }
            }
            let data_source_type = data_source_info
                .as_ref()
                .map(|i| i.data_source_type.clone());

            self.schemas.insert(
                name.clone(),
                SchemaInfo {
                    data_source_type,
                    external_read_only,
                },
            );
            self.schema_dirs.push((name.clone(), schema_dir.clone()));

            self.validate_enum_type_files(&schema_dir, &name);
            self.validate_entity_type_files(&schema_dir, &name);
            self.validate_relationship_files(&schema_dir, &name);
        }
    }

    // ---- enum types ------------------------------------------------

    fn validate_enum_type_files(&mut self, schema_dir: &Path, schema_name: &str) {
        let enum_dir = schema_dir.join("gql_enum_types");
        let files = self.yaml_files(&enum_dir, false, true);

        for file in files {
            let loc = Location::root(file.clone()).with_schema(schema_name.to_string());
            let Some(value) = self.read_yaml_value(&file, &loc) else {
                continue;
            };
            let Some(items) = self
                .expect_array(&value, &loc, "GraphQL enum type array")
                .cloned()
            else {
                continue;
            };

            for (idx, item) in items.iter().enumerate() {
                let item_loc = loc.index(idx);
                let Some(obj) = self
                    .expect_object(item, &item_loc, "GraphQL enum type object")
                    .cloned()
                else {
                    continue;
                };
                self.validate_known_fields(&obj, &["name", "items"], &item_loc, "enum type fields");
                let Some(name) = self.string_field(&obj, "name", &item_loc, true) else {
                    continue;
                };
                let key = enum_key(schema_name, &name);
                if self.enum_types.contains_key(&key) {
                    self.error(
                        "duplicate_enum_type",
                        format!("Duplicate enum type `{schema_name}.{name}`."),
                        &item_loc.field("name"),
                        "unique enum type names per schema",
                        Some(name.clone()),
                        "Rename one enum type or merge the duplicate definitions.",
                    );
                }
                self.enum_types.insert(key, item_loc.clone());
                let values = self.validate_enum_items(obj.get("items"), &item_loc, &name);
                self.enum_values
                    .insert(enum_key(schema_name, &name), values);
            }
        }
    }

    fn validate_enum_items(
        &mut self,
        value: Option<&Value>,
        parent_loc: &Location,
        enum_name: &str,
    ) -> HashSet<String> {
        let mut values = HashSet::new();
        let items_loc = parent_loc.field("items");
        let Some(value) = value else {
            self.error(
                "missing_required_field",
                format!("Enum `{enum_name}` is missing `items`."),
                &items_loc,
                "non-empty array of enum item objects",
                None,
                "Add `items` with at least one `{ value: ... }` entry.",
            );
            return values;
        };
        let Some(items) = self
            .expect_array(value, &items_loc, "enum items array")
            .cloned()
        else {
            return values;
        };
        if items.is_empty() {
            self.error(
                "empty_enum_items",
                format!("Enum `{enum_name}` has no items."),
                &items_loc,
                "non-empty enum items array",
                Some("[]".to_string()),
                "Add at least one enum item.",
            );
        }

        for (idx, item) in items.iter().enumerate() {
            let item_loc = items_loc.index(idx);
            let Some(obj) = self
                .expect_object(item, &item_loc, "enum item object")
                .cloned()
            else {
                continue;
            };
            self.validate_known_fields(&obj, &["value", "caption"], &item_loc, "enum item fields");
            let value = self.string_field(&obj, "value", &item_loc, true);
            self.string_field(&obj, "caption", &item_loc, false);
            if let Some(value) = value {
                if !values.insert(value.clone()) {
                    self.error(
                        "duplicate_enum_item",
                        format!("Enum `{enum_name}` has duplicate item `{value}`."),
                        &item_loc.field("value"),
                        "unique item values per enum",
                        Some(value),
                        "Remove or rename the duplicate enum item.",
                    );
                }
            }
        }
        values
    }

    // ---- entity types / relationships (files) ---------------------

    fn validate_entity_type_files(&mut self, schema_dir: &Path, schema_name: &str) {
        let entity_dir = schema_dir.join("entity_types");
        let files = self.yaml_files(&entity_dir, false, true);

        for file in files {
            let loc = Location::root(file.clone()).with_schema(schema_name.to_string());
            let Some(value) = self.read_yaml_value(&file, &loc) else {
                continue;
            };
            let Some(items) = self
                .expect_array(&value, &loc, "entity type array")
                .cloned()
            else {
                continue;
            };
            for (idx, item) in items.iter().enumerate() {
                self.validate_entity_type_item(schema_name, item, &loc.index(idx));
            }
        }
    }

    fn validate_relationship_files(&mut self, schema_dir: &Path, schema_name: &str) {
        let relationship_dir = schema_dir.join("relationships");
        let files = self.yaml_files(&relationship_dir, false, true);

        for file in files {
            let loc = Location::root(file.clone()).with_schema(schema_name.to_string());
            let Some(value) = self.read_yaml_value(&file, &loc) else {
                continue;
            };
            let Some(items) = self
                .expect_array(&value, &loc, "relationship array")
                .cloned()
            else {
                continue;
            };
            for (idx, item) in items.iter().enumerate() {
                self.validate_relationship_item(schema_name, item, &loc.index(idx));
            }
        }
    }

    fn validate_relationship_item(&mut self, schema_name: &str, item: &Value, loc: &Location) {
        let Some(obj) = self
            .expect_object(item, loc, "relationship object")
            .cloned()
        else {
            return;
        };
        self.validate_known_fields(
            &obj,
            &[
                "name", "kind", "left", "right", "one", "many", "storage", "junction",
            ],
            loc,
            "relationship fields",
        );

        let Some(name) = self.string_field(&obj, "name", loc, true) else {
            return;
        };
        let kind = self
            .enum_field(&obj, "kind", loc, RELATIONSHIP_KINDS, true)
            .unwrap_or_default();
        let key = format!("{schema_name}.{name}");
        if let Some(first_loc) = self.relationship_names.get(&key).cloned() {
            self.error(
                "duplicate_relationship",
                format!("Duplicate relationship `{key}`."),
                &loc.field("name"),
                "unique relationship names per schema",
                Some(name.clone()),
                format!(
                    "Rename this relationship or merge it with the first definition at {} {}.",
                    first_loc.file.display(),
                    first_loc.path
                ),
            );
        } else {
            self.relationship_names.insert(key, loc.clone());
        }

        let relationship = RelationshipInfo {
            name,
            kind,
            loc: loc.clone(),
            left: self.parse_relationship_endpoint(
                obj.get("left"),
                &loc.field("left"),
                schema_name,
            ),
            right: self.parse_relationship_endpoint(
                obj.get("right"),
                &loc.field("right"),
                schema_name,
            ),
            one: self.parse_relationship_endpoint(obj.get("one"), &loc.field("one"), schema_name),
            many: self.parse_relationship_endpoint(
                obj.get("many"),
                &loc.field("many"),
                schema_name,
            ),
            storage: self.parse_relationship_storage(
                obj.get("storage"),
                &loc.field("storage"),
                schema_name,
            ),
            junction: self.parse_relationship_junction(
                obj.get("junction"),
                &loc.field("junction"),
                schema_name,
            ),
        };
        self.relationships.push(relationship);
    }

    fn validate_entity_type_item(&mut self, schema_name: &str, item: &Value, loc: &Location) {
        let Some(obj) = self.expect_object(item, loc, "entity type object").cloned() else {
            return;
        };
        self.validate_known_fields(
            &obj,
            &[
                "id",
                "name",
                "caption",
                "pascal_1",
                "pascal_n",
                "snake_1",
                "snake_n",
                "caption_1",
                "caption_n",
                "is_table",
                "is_union",
                "base_type",
                "facets",
                "indexes",
                "constraints",
                "meta",
                "execution",
                "standard_methods",
                "custom_methods",
                "props",
            ],
            loc,
            "entity type fields",
        );

        let Some(raw_name) = self.string_field(&obj, "name", loc, true) else {
            return;
        };
        let name = self.effective_entity_name(&obj, &raw_name);
        let entity_loc = loc.with_entity(name.clone());
        let schema_external_read_only = self
            .schemas
            .get(schema_name)
            .map(|s| s.external_read_only)
            .unwrap_or(false);

        let id = self.uuid_field(&obj, "id", &entity_loc, true);
        if let Some(id) = id {
            if let Some(first_loc) = self.entity_ids.get(&id).cloned() {
                self.error(
                    "duplicate_entity_id",
                    format!("Entity id `{id}` is used more than once."),
                    &entity_loc.field("id"),
                    "globally unique entity UUIDs",
                    Some(id.clone()),
                    format!(
                        "Generate a new UUID for this entity. First use is at {} {}.",
                        first_loc.file.display(),
                        first_loc.path
                    ),
                );
            } else {
                self.entity_ids.insert(id, entity_loc.clone());
            }
        }

        for field in [
            "caption",
            "pascal_1",
            "pascal_n",
            "snake_1",
            "snake_n",
            "caption_1",
            "caption_n",
            "base_type",
        ] {
            self.string_field(&obj, field, &entity_loc, false);
        }

        let is_table = self
            .bool_field(&obj, "is_table", &entity_loc, false)
            .unwrap_or(false);
        let is_union = self
            .bool_field(&obj, "is_union", &entity_loc, false)
            .unwrap_or(false);
        let base_type = obj
            .get("base_type")
            .and_then(Value::as_str)
            .map(str::to_string);
        let facets = self.string_array_field(&obj, "facets", &entity_loc, false);
        let indexes = self.string_array_field(&obj, "indexes", &entity_loc, false);

        self.validate_facets_list(&facets, &entity_loc);
        self.validate_data_access_execution(obj.get("execution"), &entity_loc);
        self.validate_standard_methods(
            obj.get("standard_methods"),
            &entity_loc,
            is_table,
            schema_external_read_only,
        );
        self.validate_custom_methods(
            obj.get("custom_methods"),
            &entity_loc,
            Some(schema_name),
            schema_external_read_only,
        );

        let mut props = HashMap::new();
        let mut prop_names = vec![];
        self.validate_props(
            obj.get("props"),
            &entity_loc,
            schema_name,
            &name,
            &mut props,
            &mut prop_names,
        );

        if facets.iter().any(|facet| facet == "audited") {
            if !is_table {
                self.error(
                    "audited_facet_on_non_table",
                    format!("Audited entity `{schema_name}.{name}` is not a table entity."),
                    &entity_loc.field("facets"),
                    "`audited` only on entities with `is_table: true`",
                    Some("audited".to_string()),
                    "Set `is_table: true` or remove the `audited` facet.",
                );
            }
            if !props.values().any(|prop| prop.is_key) {
                self.error(
                    "audited_entity_missing_key",
                    format!("Audited entity `{schema_name}.{name}` has no key property."),
                    &entity_loc.field("props"),
                    "one property with `is_key: true`",
                    None,
                    "Add a stable primary key property before enabling the `audited` facet.",
                );
            }
        }

        self.validate_indexes(&indexes, &props, &entity_loc);

        let key = entity_key(schema_name, &name);
        if self.entity_types.contains_key(&key) {
            self.error(
                "duplicate_entity_type",
                format!("Duplicate entity type `{schema_name}.{name}`."),
                &entity_loc.field("name"),
                "unique entity names per schema",
                Some(name.clone()),
                "Rename one entity or merge the duplicate definitions.",
            );
        }

        self.entity_types.insert(
            key,
            EntityInfo {
                schema_name: schema_name.to_string(),
                name,
                is_table,
                is_union,
                base_type,
                loc: entity_loc,
                props,
                prop_names,
            },
        );
    }

    fn validate_entity_patch(&mut self, value: &Value, loc: &Location) {
        let Some(obj) = self
            .expect_object(value, loc, "entity patch object")
            .cloned()
        else {
            return;
        };
        self.validate_known_fields(
            &obj,
            &[
                "id",
                "name",
                "caption",
                "pascal_1",
                "pascal_n",
                "snake_1",
                "snake_n",
                "caption_1",
                "caption_n",
                "is_table",
                "is_union",
                "base_type",
                "facets",
                "indexes",
                "constraints",
                "meta",
                "standard_methods",
                "custom_methods",
                "props",
            ],
            loc,
            "entity patch fields",
        );

        self.string_field(&obj, "name", loc, false);
        self.bool_field(&obj, "is_table", loc, false);
        self.bool_field(&obj, "is_union", loc, false);
        self.string_field(&obj, "base_type", loc, false);
        self.string_array_field(&obj, "facets", loc, false);
        self.string_array_field(&obj, "indexes", loc, false);
        self.validate_standard_methods(obj.get("standard_methods"), loc, true, false);
        self.validate_custom_methods(obj.get("custom_methods"), loc, None, false);

        if let Some(props) = obj.get("props") {
            let props_loc = loc.field("props");
            if let Some(items) = self
                .expect_array(props, &props_loc, "property array")
                .cloned()
            {
                for (idx, prop) in items.iter().enumerate() {
                    let prop_loc = props_loc.index(idx);
                    let _ = self.validate_property_shape(
                        prop,
                        &prop_loc,
                        PropertyShapeMode::EntityProperty,
                    );
                }
            }
        }
    }

    // ---- properties -------------------------------------------------

    fn validate_props(
        &mut self,
        value: Option<&Value>,
        entity_loc: &Location,
        schema_name: &str,
        entity_name: &str,
        props: &mut HashMap<String, PropertyInfo>,
        prop_names: &mut Vec<String>,
    ) {
        let props_loc = entity_loc.field("props");
        let Some(value) = value else {
            self.error(
                "missing_required_field",
                format!("Entity `{schema_name}.{entity_name}` is missing `props`."),
                &props_loc,
                "array of property objects",
                None,
                "Add `props: []` if the entity intentionally has no properties.",
            );
            return;
        };
        let Some(items) = self
            .expect_array(value, &props_loc, "property array")
            .cloned()
        else {
            return;
        };
        if items.is_empty() {
            self.warn(
                "empty_props",
                format!("Entity `{schema_name}.{entity_name}` has no properties."),
                &props_loc,
                "one or more properties",
                Some("[]".to_string()),
                "Add at least a key property unless this type is intentionally empty.",
            );
        }

        for (idx, item) in items.iter().enumerate() {
            let base_loc = props_loc.index(idx);
            let Some(obj) = self
                .expect_object(item, &base_loc, "property object")
                .cloned()
            else {
                continue;
            };
            let Some(prop_name) = self.string_field(&obj, "name", &base_loc, true) else {
                let _ = self.validate_property_shape(
                    item,
                    &base_loc,
                    PropertyShapeMode::EntityProperty,
                );
                continue;
            };
            let prop_loc = base_loc.with_property(prop_name.clone());
            self.validate_property_shape(item, &prop_loc, PropertyShapeMode::EntityProperty);

            if props.contains_key(&prop_name) {
                self.error(
                    "duplicate_property",
                    format!("Entity `{schema_name}.{entity_name}` has duplicate property `{prop_name}`."),
                    &prop_loc.field("name"),
                    "unique property names per entity",
                    Some(prop_name.clone()),
                    "Rename one property or remove the duplicate.",
                );
            }

            let fragment_name = obj
                .get("fragment")
                .and_then(Value::as_str)
                .map(str::to_string);
            let fragment_value = fragment_name
                .as_ref()
                .and_then(|name| self.fragments.get(name))
                .map(|fragment| fragment.value.clone());
            let data_type = fragment_value
                .as_ref()
                .and_then(|fragment| fragment.get("data_type"))
                .and_then(Value::as_str)
                .or_else(|| obj.get("data_type").and_then(Value::as_str))
                .map(str::to_string);
            let is_key = bool_from_json(fragment_value.as_ref(), "is_key")
                || obj.get("is_key").and_then(Value::as_bool).unwrap_or(false);
            let is_required = bool_from_json(fragment_value.as_ref(), "is_required")
                || obj
                    .get("is_required")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
            let is_read_only = bool_from_json(fragment_value.as_ref(), "is_read_only")
                || obj
                    .get("is_read_only")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
            let is_concurrency_control =
                bool_from_json(fragment_value.as_ref(), "is_concurrency_control")
                    || obj
                        .get("is_concurrency_control")
                        .and_then(Value::as_bool)
                        .unwrap_or(false);
            let computed = string_from_json(fragment_value.as_ref(), "computed").or_else(|| {
                obj.get("computed")
                    .and_then(Value::as_str)
                    .map(str::to_string)
            });

            let foreign_key = self.parse_relation_ref(
                obj.get("foreign_key"),
                &prop_loc.field("foreign_key"),
                schema_name,
            );
            let nav_by_fk_property = self.parse_nav_ref(
                obj.get("nav_by_fk_property"),
                &prop_loc.field("nav_by_fk_property"),
                schema_name,
                entity_name,
            );
            let many_to_many_property = self.parse_many_to_many_ref(
                obj.get("many_to_many_property"),
                &prop_loc.field("many_to_many_property"),
            );
            let nested_entity_type = self.parse_relation_ref(
                obj.get("nested_entity_type"),
                &prop_loc.field("nested_entity_type"),
                schema_name,
            );
            let enum_type_name = obj
                .get("enum_type_name")
                .and_then(Value::as_str)
                .map(str::to_string);

            props.insert(
                prop_name.clone(),
                PropertyInfo {
                    name: prop_name.clone(),
                    data_type,
                    is_key,
                    is_required,
                    is_read_only,
                    is_concurrency_control,
                    computed,
                    loc: prop_loc,
                    foreign_key,
                    nav_by_fk_property,
                    many_to_many_property,
                    nested_entity_type,
                    enum_type_name,
                },
            );
            prop_names.push(prop_name);
        }
    }

    fn validate_property_shape(&mut self, value: &Value, loc: &Location, mode: PropertyShapeMode) {
        let Some(obj) = self.expect_object(value, loc, "property object").cloned() else {
            return;
        };
        self.validate_known_fields(
            &obj,
            &[
                "id",
                "name",
                "caption",
                "is_key",
                "is_caption",
                "is_required",
                "is_read_only",
                "is_concurrency_control",
                "data_type",
                "computed",
                "default_value",
                "foreign_key",
                "nav_by_fk_property",
                "many_to_many_property",
                "nested_entity_type",
                "enum_type_name",
                "meta",
                "fragment",
                "type_variant",
            ],
            loc,
            "property fields",
        );

        self.string_field(&obj, "name", loc, mode.requires_name());
        self.string_field(&obj, "id", loc, false);
        self.string_field(&obj, "caption", loc, false);
        for field in [
            "is_key",
            "is_caption",
            "is_required",
            "is_read_only",
            "is_concurrency_control",
            "type_variant",
        ] {
            self.bool_field(&obj, field, loc, false);
        }
        self.enum_field(&obj, "data_type", loc, DATA_TYPES, false);
        self.enum_field(&obj, "computed", loc, COMPUTED_VALUES, false);
        self.string_field(&obj, "enum_type_name", loc, false);

        if let Some(fragment) = self.string_field(&obj, "fragment", loc, false) {
            if !self.fragments.contains_key(&fragment) {
                self.error(
                    "missing_fragment",
                    format!("Property references missing fragment `{fragment}`."),
                    &loc.field("fragment"),
                    "fragment file stem from _fragments/*.yaml",
                    Some(fragment.clone()),
                    format!(
                        "Create `_fragments/{fragment}.yaml` or change `fragment` to one of: {}.",
                        self.fragment_suggestions()
                    ),
                );
            }
        }

        self.validate_relation_shape(
            obj.get("foreign_key"),
            &loc.field("foreign_key"),
            "foreign_key",
        );
        self.validate_nav_shape(
            obj.get("nav_by_fk_property"),
            &loc.field("nav_by_fk_property"),
        );
        self.validate_many_to_many_shape(
            obj.get("many_to_many_property"),
            &loc.field("many_to_many_property"),
        );
        self.validate_relation_shape(
            obj.get("nested_entity_type"),
            &loc.field("nested_entity_type"),
            "nested_entity_type",
        );
    }

    fn validate_relation_shape(&mut self, value: Option<&Value>, loc: &Location, label: &str) {
        let Some(value) = value else { return };
        if value.is_null() {
            return;
        }
        let Some(obj) = self.expect_object(value, loc, label).cloned() else {
            return;
        };
        self.validate_known_fields(&obj, &["schema_name", "type_name"], loc, label);
        self.string_field(&obj, "schema_name", loc, false);
        self.string_field(&obj, "type_name", loc, true);
    }

    fn validate_nav_shape(&mut self, value: Option<&Value>, loc: &Location) {
        let Some(value) = value else { return };
        if value.is_null() {
            return;
        }
        let Some(obj) = self
            .expect_object(value, loc, "nav_by_fk_property")
            .cloned()
        else {
            return;
        };
        self.validate_known_fields(
            &obj,
            &[
                "schema_name",
                "type_name",
                "prop_name",
                "filter",
                "resolved",
            ],
            loc,
            "nav_by_fk_property fields",
        );
        self.string_field(&obj, "schema_name", loc, false);
        self.string_field(&obj, "type_name", loc, false);
        self.string_field(&obj, "prop_name", loc, true);
    }

    fn validate_many_to_many_shape(&mut self, value: Option<&Value>, loc: &Location) {
        let Some(value) = value else { return };
        if value.is_null() {
            return;
        }
        let Some(obj) = self
            .expect_object(value, loc, "many_to_many_property")
            .cloned()
        else {
            return;
        };
        self.validate_known_fields(
            &obj,
            &[
                "junction_table",
                "junction_schema",
                "local_key",
                "foreign_key",
                "target_schema",
                "target_type",
            ],
            loc,
            "many_to_many_property fields",
        );
        for field in [
            "junction_table",
            "local_key",
            "foreign_key",
            "target_schema",
            "target_type",
        ] {
            self.string_field(&obj, field, loc, true);
        }
        self.string_field(&obj, "junction_schema", loc, false);
    }

    fn validate_facets_list(&mut self, facets: &[String], entity_loc: &Location) {
        let mut seen = HashSet::new();
        for facet in facets {
            if !FACETS.contains(&facet.as_str()) {
                self.error(
                    "invalid_facet",
                    format!("Unknown facet `{facet}`."),
                    &entity_loc.field("facets"),
                    allowed_values(FACETS),
                    Some(facet.clone()),
                    "Use one of the supported template facets.",
                );
            }
            if !seen.insert(facet.clone()) {
                self.warn(
                    "duplicate_facet",
                    format!("Facet `{facet}` is listed more than once."),
                    &entity_loc.field("facets"),
                    "unique facets per entity",
                    Some(facet.clone()),
                    "Remove the duplicate facet entry.",
                );
            }
        }
    }

    fn validate_data_access_execution(&mut self, value: Option<&Value>, entity_loc: &Location) {
        let Some(value) = value else { return };
        if value.is_null() {
            return;
        }
        let loc = entity_loc.field("execution");
        let Some(obj) = self
            .expect_object(value, &loc, "data access execution object")
            .cloned()
        else {
            return;
        };
        self.validate_known_fields(
            &obj,
            &["prepared_statements"],
            &loc,
            "data access execution fields",
        );
        self.bool_field(&obj, "prepared_statements", &loc, false);
    }

    fn validate_standard_methods(
        &mut self,
        value: Option<&Value>,
        entity_loc: &Location,
        is_table: bool,
        external_read_only: bool,
    ) {
        let Some(value) = value else { return };
        if value.is_null() {
            return;
        }
        let loc = entity_loc.field("standard_methods");
        let Some(items) = self
            .expect_array(value, &loc, "standard method array")
            .cloned()
        else {
            return;
        };
        if !is_table && !items.is_empty() {
            self.warn(
                "standard_methods_on_non_table",
                "Standard methods are ignored for non-table entity types.".to_string(),
                &loc,
                "`standard_methods` only on entities with `is_table: true`",
                Some(value_preview(value)),
                "Set `is_table: true`, remove `standard_methods`, or model this behavior as a custom method.",
            );
        }

        let mut seen = HashSet::new();
        for (idx, item) in items.iter().enumerate() {
            let item_loc = loc.index(idx);
            let Some(method) = item.as_str() else {
                self.error(
                    "invalid_standard_method_shape",
                    "Standard method entries must be strings.".to_string(),
                    &item_loc,
                    allowed_values(STANDARD_METHODS),
                    Some(value_kind(item).to_string()),
                    "Use method names such as `FindById` or `Query`.",
                );
                continue;
            };
            if !STANDARD_METHODS.contains(&method) {
                self.error(
                    "invalid_standard_method",
                    format!("Unknown standard method `{method}`."),
                    &item_loc,
                    allowed_values(STANDARD_METHODS),
                    Some(method.to_string()),
                    "Use one of the supported standard method names.",
                );
                continue;
            }
            if external_read_only && matches!(method, "Create" | "Update" | "Delete") {
                self.error(
                    "external_read_only_standard_method",
                    format!(
                        "External read-only entity `{}` cannot expose standard method `{method}`.",
                        entity_loc.entity_name.as_deref().unwrap_or("<unknown>")
                    ),
                    &item_loc,
                    "read-only standard methods such as `FindById`, `GetAll`, or `Query`",
                    Some(method.to_string()),
                    "Remove generated mutation methods from entities backed by authoritative external storage.",
                );
            }
            if !seen.insert(method.to_string()) {
                self.warn(
                    "duplicate_standard_method",
                    format!("Standard method `{method}` is listed more than once."),
                    &item_loc,
                    "unique standard methods per entity",
                    Some(method.to_string()),
                    "Remove the duplicate method entry.",
                );
            }
        }
    }

    fn validate_custom_methods(
        &mut self,
        value: Option<&Value>,
        entity_loc: &Location,
        schema_name: Option<&str>,
        external_read_only: bool,
    ) {
        let Some(value) = value else { return };
        if value.is_null() {
            return;
        }
        let loc = entity_loc.field("custom_methods");
        let Some(items) = self
            .expect_array(value, &loc, "custom method array")
            .cloned()
        else {
            return;
        };

        let mut seen = HashSet::new();
        for (idx, item) in items.iter().enumerate() {
            let item_loc = loc.index(idx);
            let Some(obj) = self
                .expect_object(item, &item_loc, "custom method object")
                .cloned()
            else {
                continue;
            };
            self.validate_known_fields(
                &obj,
                &[
                    "name",
                    "kind",
                    "args",
                    "return_type",
                    "mcp_enabled",
                    "provider_routine",
                ],
                &item_loc,
                "custom method fields",
            );
            let name = self.string_field(&obj, "name", &item_loc, true);
            let kind = self.enum_field(&obj, "kind", &item_loc, CUSTOM_METHOD_KINDS, true);
            if external_read_only && matches!(kind.as_deref(), Some("Mutation" | "Command")) {
                self.error(
                    "external_read_only_custom_method",
                    format!(
                        "External read-only entity `{}` cannot expose `{}` custom method `{}`.",
                        entity_loc.entity_name.as_deref().unwrap_or("<unknown>"),
                        kind.as_deref().unwrap_or("<unknown>"),
                        name.as_deref().unwrap_or("<unknown>")
                    ),
                    &item_loc.field("kind"),
                    "`Query` custom methods only",
                    kind.clone(),
                    "Move write behavior to the authoritative source owner's workflow, or model a separate app-owned schema for writes.",
                );
            }
            self.string_field(&obj, "return_type", &item_loc, true);
            self.bool_field(&obj, "mcp_enabled", &item_loc, false);
            if let Some(name) = name {
                if !seen.insert(name.clone()) {
                    self.error(
                        "duplicate_custom_method",
                        format!("Custom method `{name}` is listed more than once."),
                        &item_loc.field("name"),
                        "unique custom method names per entity",
                        Some(name),
                        "Rename one method or remove the duplicate.",
                    );
                }
            }
            self.validate_custom_method_args(obj.get("args"), &item_loc);
            self.validate_provider_routine(
                obj.get("provider_routine"),
                &item_loc,
                kind,
                schema_name,
            );
            if obj.get("provider_routine").is_some() {
                self.validate_provider_routine_arg_types(obj.get("args"), &item_loc);
            }
        }
    }

    fn validate_custom_method_args(&mut self, value: Option<&Value>, method_loc: &Location) {
        let loc = method_loc.field("args");
        let Some(value) = value else {
            self.error(
                "missing_required_field",
                "Custom method is missing `args`.".to_string(),
                &loc,
                "array of argument objects, or []",
                None,
                "Add `args: []` when the method takes no arguments.",
            );
            return;
        };
        let Some(items) = self
            .expect_array(value, &loc, "custom method args array")
            .cloned()
        else {
            return;
        };
        let mut seen = HashSet::new();
        for (idx, item) in items.iter().enumerate() {
            let item_loc = loc.index(idx);
            let Some(obj) = self
                .expect_object(item, &item_loc, "custom method arg object")
                .cloned()
            else {
                continue;
            };
            self.validate_known_fields(&obj, &["name", "arg_type"], &item_loc, "argument fields");
            let name = self.string_field(&obj, "name", &item_loc, true);
            self.string_field(&obj, "arg_type", &item_loc, true);
            if let Some(name) = name {
                if !seen.insert(name.clone()) {
                    self.error(
                        "duplicate_custom_method_arg",
                        format!("Custom method argument `{name}` is listed more than once."),
                        &item_loc.field("name"),
                        "unique argument names per method",
                        Some(name),
                        "Rename or remove the duplicate argument.",
                    );
                }
            }
        }
    }

    fn validate_provider_routine(
        &mut self,
        value: Option<&Value>,
        method_loc: &Location,
        method_kind: Option<String>,
        schema_name: Option<&str>,
    ) {
        let Some(value) = value else { return };
        if value.is_null() {
            return;
        }
        let loc = method_loc.field("provider_routine");
        let Some(obj) = self
            .expect_object(value, &loc, "provider routine object")
            .cloned()
        else {
            return;
        };
        self.validate_known_fields(
            &obj,
            &[
                "kind",
                "returns",
                "data_source",
                "schema",
                "name",
                "routines",
            ],
            &loc,
            "provider routine fields",
        );
        let routine_kind = self.enum_field(&obj, "kind", &loc, PROVIDER_ROUTINE_KINDS, true);
        self.enum_field(&obj, "returns", &loc, PROVIDER_ROUTINE_RETURNS, true);
        if matches!(method_kind.as_deref(), Some("Query"))
            && matches!(routine_kind.as_deref(), Some("Procedure"))
        {
            self.error(
                "invalid_provider_routine_kind",
                "Query custom methods must bind to provider functions, not procedures.".to_string(),
                &loc.field("kind"),
                "Function for Query methods",
                routine_kind.clone(),
                "Use `kind: Function` for query methods, or change the custom method kind to Mutation/Command.",
            );
        }
        if let Some(data_source) = self.string_field(&obj, "data_source", &loc, false) {
            if !self.data_sources.contains_key(&data_source) {
                self.error(
                    "unknown_data_source",
                    format!("Provider routine references unknown data source `{data_source}`."),
                    &loc.field("data_source"),
                    "data source declared in .appfw/model/data_sources/_res.yaml",
                    Some(data_source),
                    "Set `data_source` to an existing data source or omit it to use the entity schema data source.",
                );
            }
        } else if let Some(schema_name) = schema_name {
            if !self.schemas.contains_key(schema_name) {
                self.error(
                    "unknown_schema",
                    format!("Provider routine belongs to unknown schema `{schema_name}`."),
                    &loc,
                    "schema declared in .appfw/model/schemas/<schema>/_res.yaml",
                    Some(schema_name.to_string()),
                    "Declare the schema before validating routine-backed custom methods.",
                );
            }
        }

        let default_schema = self.string_field(&obj, "schema", &loc, false);
        let default_name = self.string_field(&obj, "name", &loc, false);
        if let Some(schema) = default_schema {
            self.validate_provider_routine_identifier(
                &schema,
                &loc.field("schema"),
                "routine schema",
            );
        }
        if let Some(name) = default_name.as_ref() {
            self.validate_provider_routine_identifier(name, &loc.field("name"), "routine name");
        }

        let mut declared = 0;
        let routines_loc = loc.field("routines");
        if let Some(routines) = obj.get("routines") {
            let Some(routines_obj) = self
                .expect_object(routines, &routines_loc, "provider routine names object")
                .cloned()
            else {
                return;
            };
            self.validate_known_fields(
                &routines_obj,
                PROVIDER_ROUTINE_PROVIDERS,
                &routines_loc,
                "provider routine provider names",
            );
            for provider in PROVIDER_ROUTINE_PROVIDERS {
                if let Some(routine) = routines_obj.get(*provider) {
                    if routine.is_null() {
                        continue;
                    }
                    declared += 1;
                    self.validate_provider_routine_name(routine, &routines_loc.field(provider));
                }
            }
        }
        if declared == 0 && default_name.is_none() {
            self.error(
                "missing_provider_routine",
                "Provider routine must declare a portable routine `name` or at least one provider-specific routine override."
                    .to_string(),
                &loc,
                "portable name or one of routines.postgres, routines.mssql, routines.snowflake",
                None,
                "Set `name` for the common provider routine target, or use `routines` only when provider names differ.",
            );
        }
    }

    fn validate_provider_routine_name(&mut self, value: &Value, loc: &Location) {
        let Some(obj) = self
            .expect_object(value, loc, "provider routine name object")
            .cloned()
        else {
            return;
        };
        self.validate_known_fields(
            &obj,
            &["schema", "name"],
            loc,
            "provider routine name fields",
        );
        let schema = self.string_field(&obj, "schema", loc, false);
        let name = self.string_field(&obj, "name", loc, true);
        if let Some(schema) = schema {
            self.validate_provider_routine_identifier(
                &schema,
                &loc.field("schema"),
                "routine schema",
            );
        }
        if let Some(name) = name {
            self.validate_provider_routine_identifier(&name, &loc.field("name"), "routine name");
        }
    }

    fn validate_provider_routine_arg_types(
        &mut self,
        value: Option<&Value>,
        method_loc: &Location,
    ) {
        let Some(value) = value else { return };
        let loc = method_loc.field("args");
        let Some(items) = value.as_array() else {
            return;
        };
        for (idx, item) in items.iter().enumerate() {
            let item_loc = loc.index(idx);
            let Some(obj) = item.as_object() else {
                continue;
            };
            let Some(arg_type) = obj.get("arg_type").and_then(Value::as_str) else {
                continue;
            };
            if PROVIDER_ROUTINE_ARG_TYPES.contains(&arg_type) {
                continue;
            }
            self.error(
                "unsupported_provider_routine_arg_type",
                format!("Provider routine argument type `{arg_type}` is not supported by generated binding."),
                &item_loc.field("arg_type"),
                allowed_values(PROVIDER_ROUTINE_ARG_TYPES),
                Some(arg_type.to_string()),
                "Use a supported scalar/JSON argument type or add provider binding support for this type.",
            );
        }
    }

    fn validate_provider_routine_identifier(&mut self, value: &str, loc: &Location, label: &str) {
        if provider_routine_identifier_is_safe(value) {
            return;
        }
        self.error(
            "unsafe_provider_routine_identifier",
            format!("Provider routine {label} `{value}` is not a safe identifier."),
            loc,
            "ASCII identifier beginning with a letter or underscore",
            Some(value.to_string()),
            "Use a simple routine identifier and keep SQL text out of app_gen config.",
        );
    }

    fn validate_indexes(
        &mut self,
        indexes: &[String],
        props: &HashMap<String, PropertyInfo>,
        entity_loc: &Location,
    ) {
        let mut seen = HashSet::new();
        for index in indexes {
            if !props.contains_key(index) {
                self.error(
                    "missing_index_property",
                    format!("Index references missing property `{index}`."),
                    &entity_loc.field("indexes"),
                    "property name declared in the same entity",
                    Some(index.clone()),
                    "Change the index to an existing property name or add the property.",
                );
            }
            if !seen.insert(index.clone()) {
                self.warn(
                    "duplicate_index",
                    format!("Index `{index}` is listed more than once."),
                    &entity_loc.field("indexes"),
                    "unique indexes per entity",
                    Some(index.clone()),
                    "Remove the duplicate index entry.",
                );
            }
        }
    }

    // ---- cross-entity relationship resolution ------------------------

    fn validate_relationships(&mut self) {
        let entities: Vec<EntityInfo> = self.entity_types.values().cloned().collect();

        for entity in &entities {
            if let Some(base_type) = &entity.base_type {
                let key = entity_key(&entity.schema_name, base_type);
                match self.entity_types.get(&key).cloned() {
                    Some(base) if !base.is_union => self.error(
                        "invalid_base_type",
                        format!(
                            "Entity `{}` derives from `{base_type}`, but `{base_type}` is not marked `is_union: true`.",
                            entity.name
                        ),
                        &entity.loc.field("base_type"),
                        "base_type referencing an entity with `is_union: true`",
                        Some(base_type.clone()),
                        "Set `is_union: true` on the base entity or change `base_type`.",
                    ),
                    Some(_) => {}
                    None => self.error(
                        "missing_base_type",
                        format!("Entity `{}` references missing base type `{base_type}`.", entity.name),
                        &entity.loc.field("base_type"),
                        "existing entity type in the same schema",
                        Some(base_type.clone()),
                        "Add the base entity or correct `base_type`.",
                    ),
                }
            }

            for prop_name in &entity.prop_names {
                let Some(prop) = entity.props.get(prop_name).cloned() else {
                    continue;
                };
                self.validate_property_relationships(entity, &prop);
            }
        }

        let relationships = self.relationships.clone();
        for relationship in &relationships {
            self.validate_schema_relationship(relationship);
        }
    }

    fn validate_schema_relationship(&mut self, relationship: &RelationshipInfo) {
        match relationship.kind.as_str() {
            "OneToOne" => {
                let Some(left) = self
                    .require_relationship_endpoint(relationship, "left")
                    .cloned()
                else {
                    return;
                };
                let Some(right) = self
                    .require_relationship_endpoint(relationship, "right")
                    .cloned()
                else {
                    return;
                };
                let Some(storage) = self.require_relationship_storage(relationship).cloned() else {
                    return;
                };
                if storage.storage_type != "ForeignKey" {
                    return;
                }
                if !self.endpoint_matches_owner(&left, &storage)
                    && !self.endpoint_matches_owner(&right, &storage)
                {
                    self.error(
                        "relationship_storage_owner_not_endpoint",
                        format!(
                            "OneToOne relationship `{}` storage owner must be one endpoint.",
                            relationship.name
                        ),
                        &storage.loc.field("owner"),
                        "left.entity or right.entity",
                        Some(format!("{}.{}", storage.owner_schema, storage.owner)),
                        "Set storage.owner to one endpoint entity.",
                    );
                    return;
                }
                let target = if self.endpoint_matches_owner(&left, &storage) {
                    &right
                } else {
                    &left
                };
                self.validate_relationship_fk(relationship, &storage, target);
                self.validate_generated_relationship_field(relationship, &left);
                self.validate_generated_relationship_field(relationship, &right);
            }
            "OneToMany" => {
                let Some(one) = self
                    .require_relationship_endpoint(relationship, "one")
                    .cloned()
                else {
                    return;
                };
                let Some(many) = self
                    .require_relationship_endpoint(relationship, "many")
                    .cloned()
                else {
                    return;
                };
                let Some(storage) = self.require_relationship_storage(relationship).cloned() else {
                    return;
                };
                if storage.storage_type != "ForeignKey" {
                    return;
                }
                if !self.endpoint_matches_owner(&many, &storage) {
                    self.error(
                        "relationship_storage_owner_not_many_endpoint",
                        format!("OneToMany relationship `{}` must store the foreign key on the many endpoint.", relationship.name),
                        &storage.loc.field("owner"),
                        format!("{}.{}", many.schema_name, many.entity_name),
                        Some(format!("{}.{}", storage.owner_schema, storage.owner)),
                        "Set storage.owner to the entity named by the `many` endpoint.",
                    );
                    return;
                }
                self.validate_relationship_fk(relationship, &storage, &one);
                self.validate_generated_relationship_field(relationship, &one);
                self.validate_generated_relationship_field(relationship, &many);
            }
            "ManyToMany" => {
                let Some(left) = self
                    .require_relationship_endpoint(relationship, "left")
                    .cloned()
                else {
                    return;
                };
                let Some(right) = self
                    .require_relationship_endpoint(relationship, "right")
                    .cloned()
                else {
                    return;
                };
                let Some(junction) = relationship.junction.clone() else {
                    self.error(
                        "missing_required_field",
                        format!(
                            "ManyToMany relationship `{}` is missing `junction`.",
                            relationship.name
                        ),
                        &relationship.loc.field("junction"),
                        "junction object",
                        None,
                        "Add junction.entity, junction.left_key, and junction.right_key.",
                    );
                    return;
                };
                self.validate_relationship_endpoint_entity(relationship, &left);
                self.validate_relationship_endpoint_entity(relationship, &right);
                self.validate_generated_relationship_field(relationship, &left);
                self.validate_generated_relationship_field(relationship, &right);

                let key = entity_key(&junction.schema_name, &junction.entity_name);
                let mut columns = BTreeSet::new();
                columns.insert("id".to_string());
                columns.insert(junction.left_key.clone());
                columns.insert(junction.right_key.clone());
                self.junctions
                    .entry(key)
                    .and_modify(|existing| existing.columns.extend(columns.iter().cloned()))
                    .or_insert(JunctionInfo { columns });
            }
            _ => {}
        }
    }

    fn require_relationship_endpoint<'a>(
        &mut self,
        relationship: &'a RelationshipInfo,
        name: &str,
    ) -> Option<&'a RelationshipEndpointInfo> {
        let endpoint = match name {
            "left" => relationship.left.as_ref(),
            "right" => relationship.right.as_ref(),
            "one" => relationship.one.as_ref(),
            "many" => relationship.many.as_ref(),
            _ => None,
        };
        if endpoint.is_none() {
            self.error(
                "missing_required_field",
                format!("Relationship `{}` is missing `{name}`.", relationship.name),
                &relationship.loc.field(name),
                "relationship endpoint object",
                None,
                format!("Add `{name}.entity` and `{name}.field`."),
            );
        }
        endpoint
    }

    fn require_relationship_storage<'a>(
        &mut self,
        relationship: &'a RelationshipInfo,
    ) -> Option<&'a RelationshipStorageInfo> {
        if relationship.storage.is_none() {
            self.error(
                "missing_required_field",
                format!("Relationship `{}` is missing `storage`.", relationship.name),
                &relationship.loc.field("storage"),
                "storage object",
                None,
                "Add storage.type, storage.owner, and storage.field.",
            );
        }
        relationship.storage.as_ref()
    }

    fn endpoint_matches_owner(
        &self,
        endpoint: &RelationshipEndpointInfo,
        storage: &RelationshipStorageInfo,
    ) -> bool {
        endpoint.schema_name == storage.owner_schema && endpoint.entity_name == storage.owner
    }

    fn validate_relationship_endpoint_entity(
        &mut self,
        relationship: &RelationshipInfo,
        endpoint: &RelationshipEndpointInfo,
    ) {
        let key = entity_key(&endpoint.schema_name, &endpoint.entity_name);
        if !self.entity_types.contains_key(&key) {
            self.error(
                "missing_relationship_endpoint_entity",
                format!(
                    "Relationship `{}` endpoint references missing entity `{}.{}`.",
                    relationship.name, endpoint.schema_name, endpoint.entity_name
                ),
                &endpoint.loc.field("entity"),
                "existing entity type",
                Some(format!("{}.{}", endpoint.schema_name, endpoint.entity_name)),
                "Add the entity or correct the endpoint.",
            );
        }
    }

    fn validate_generated_relationship_field(
        &mut self,
        relationship: &RelationshipInfo,
        endpoint: &RelationshipEndpointInfo,
    ) {
        let key = entity_key(&endpoint.schema_name, &endpoint.entity_name);
        let Some(entity) = self.entity_types.get(&key).cloned() else {
            return;
        };
        let Some(existing) = entity.props.get(&endpoint.field_name) else {
            return;
        };
        if !matches!(
            existing.data_type.as_deref(),
            Some("NavToOne" | "NavToMany" | "ManyToMany")
        ) {
            self.error(
                "relationship_field_conflicts_with_native_property",
                format!(
                    "Relationship `{}` would generate `{}.{}` but that field is already native.",
                    relationship.name, entity.name, endpoint.field_name
                ),
                &endpoint.loc.field("field"),
                "missing field or existing virtual relationship field",
                Some(endpoint.field_name.clone()),
                "Rename the relationship field or remove the conflicting native property.",
            );
        }
    }

    fn validate_relationship_fk(
        &mut self,
        relationship: &RelationshipInfo,
        storage: &RelationshipStorageInfo,
        target: &RelationshipEndpointInfo,
    ) {
        let owner_key = entity_key(&storage.owner_schema, &storage.owner);
        let Some(owner) = self.entity_types.get(&owner_key).cloned() else {
            self.error(
                "missing_relationship_storage_owner",
                format!(
                    "Relationship `{}` storage owner `{}.{}` does not exist.",
                    relationship.name, storage.owner_schema, storage.owner
                ),
                &storage.loc.field("owner"),
                "existing entity type",
                Some(format!("{}.{}", storage.owner_schema, storage.owner)),
                "Set storage.owner to an existing entity.",
            );
            return;
        };

        let Some(fk_prop) = owner.props.get(&storage.field).cloned() else {
            self.error(
                "missing_relationship_storage_field",
                format!(
                    "Relationship `{}` references missing FK field `{}.{}`.",
                    relationship.name, owner.name, storage.field
                ),
                &storage.loc.field("field"),
                "foreign-key property on storage.owner",
                Some(storage.field.clone()),
                "Add the scalar FK property or correct storage.field.",
            );
            return;
        };
        let Some(fk) = fk_prop.foreign_key.as_ref() else {
            self.error(
                "relationship_storage_field_not_foreign_key",
                format!(
                    "Relationship `{}` storage field `{}.{}` is not a foreign_key.",
                    relationship.name, owner.name, storage.field
                ),
                &storage.loc.field("field"),
                "property with a foreign_key block",
                Some(storage.field.clone()),
                "Move the relationship to a scalar FK property or add foreign_key metadata.",
            );
            return;
        };

        let fk_schema = if fk.schema_name.trim().is_empty() {
            owner.schema_name.clone()
        } else {
            fk.schema_name.clone()
        };
        if fk_schema != target.schema_name || fk.type_name != target.entity_name {
            self.error(
                "relationship_storage_target_mismatch",
                format!(
                    "Relationship `{}` storage field `{}.{}` targets `{}.{}`, expected `{}.{}`.",
                    relationship.name,
                    owner.name,
                    storage.field,
                    fk_schema,
                    fk.type_name,
                    target.schema_name,
                    target.entity_name
                ),
                &storage.loc.field("field"),
                "FK target matching the opposite endpoint",
                Some(format!("{}.{}", fk_schema, fk.type_name)),
                "Point storage.field at the FK that backs this relationship.",
            );
        }
    }

    fn validate_property_relationships(&mut self, entity: &EntityInfo, prop: &PropertyInfo) {
        let Some(data_type) = prop.data_type.clone() else {
            self.error(
                "missing_data_type",
                format!(
                    "Property `{}.{}` has no data type after fragment resolution.",
                    entity.name, prop.name
                ),
                &prop.loc,
                "`data_type` or `fragment` whose YAML includes `data_type`",
                None,
                "Add `data_type: String` or use a fragment such as `property-string`.",
            );
            return;
        };

        if matches!(data_type.as_str(), "Enum" | "EnumArray") {
            match &prop.enum_type_name {
                Some(enum_type_name)
                    if self.enum_exists(&entity.schema_name, enum_type_name)
                        || self.enum_exists("system", enum_type_name) => {}
                Some(enum_type_name) => self.error(
                    "missing_enum_type",
                    format!(
                        "Property `{}.{}` references missing enum `{enum_type_name}`.",
                        entity.name, prop.name
                    ),
                    &prop.loc.field("enum_type_name"),
                    "enum type from the same schema or system schema",
                    Some(enum_type_name.clone()),
                    "Add the enum YAML or correct `enum_type_name`.",
                ),
                None => self.error(
                    "missing_enum_type",
                    format!(
                        "Property `{}.{}` uses `{data_type}` without `enum_type_name`.",
                        entity.name, prop.name
                    ),
                    &prop.loc.field("enum_type_name"),
                    "enum type name",
                    None,
                    "Set `enum_type_name` to the enum backing this property.",
                ),
            }
        } else if prop.enum_type_name.is_some() {
            self.warn(
                "unused_enum_type_name",
                format!(
                    "Property `{}.{}` sets `enum_type_name` but its data type is `{data_type}`.",
                    entity.name, prop.name
                ),
                &prop.loc.field("enum_type_name"),
                "`enum_type_name` only with `Enum` or `EnumArray`",
                prop.enum_type_name.clone(),
                "Remove `enum_type_name` or change `data_type` to `Enum`/`EnumArray`.",
            );
        }

        if matches!(data_type.as_str(), "Object" | "ObjectArray") {
            match &prop.nested_entity_type {
                Some(nested) => self.validate_entity_ref(nested, "missing_nested_entity_type"),
                None => self.error(
                    "missing_nested_entity_type",
                    format!(
                        "Property `{}.{}` uses `{data_type}` without `nested_entity_type`.",
                        entity.name, prop.name
                    ),
                    &prop.loc.field("nested_entity_type"),
                    "nested entity type reference",
                    None,
                    "Set `nested_entity_type.type_name` to the object shape for this property.",
                ),
            }
        }

        if matches!(data_type.as_str(), "NavToOne" | "NavToMany" | "ManyToMany") {
            self.error(
                "relationship_property_requires_schema_relationship",
                format!("Property `{}.{}` hand-authors generated navigation data type `{data_type}`.", entity.name, prop.name),
                &prop.loc.field("data_type"),
                "schema-level relationship in .appfw/model/schemas/<schema>/relationships/*.yaml; entity files should keep scalar storage fields only",
                Some(data_type.clone()),
                "Define the relationship under .appfw/model/schemas/<schema>/relationships/*.yaml; keep only the scalar FK property on the entity and let the generator produce the navigation field. Use relationship.kind: ManyToMany for junction-backed to-many navigation.",
            );
            return;
        }

        if let Some(fk) = prop.foreign_key.clone() {
            self.validate_foreign_key(entity, prop, &fk);
        }

        match (&prop.nav_by_fk_property, data_type.as_str()) {
            (Some(nav), "NavToOne" | "NavToMany") => {
                let nav = nav.clone();
                self.validate_nav_by_fk(entity, prop, &nav)
            }
            (Some(_), _) => self.error(
                "invalid_nav_data_type",
                format!("Property `{}.{}` declares `nav_by_fk_property` but data type is `{data_type}`.", entity.name, prop.name),
                &prop.loc.field("data_type"),
                "NavToOne or NavToMany",
                Some(data_type.clone()),
                "Change `data_type` to NavToOne/NavToMany or remove `nav_by_fk_property`.",
            ),
            (None, "NavToOne" | "NavToMany") => self.error(
                "missing_nav_by_fk_property",
                format!("Property `{}.{}` uses `{data_type}` without `nav_by_fk_property`.", entity.name, prop.name),
                &prop.loc.field("nav_by_fk_property"),
                "nav_by_fk_property with prop_name",
                None,
                "Add `nav_by_fk_property.prop_name` pointing at the scalar foreign-key property.",
            ),
            _ => {}
        }

        match (&prop.many_to_many_property, data_type.as_str()) {
            (Some(many_to_many), "ManyToMany") => {
                let many_to_many = many_to_many.clone();
                self.validate_many_to_many(entity, prop, &many_to_many)
            }
            (Some(_), _) => self.error(
                "invalid_many_to_many_data_type",
                format!("Property `{}.{}` declares `many_to_many_property` but data type is `{data_type}`.", entity.name, prop.name),
                &prop.loc.field("data_type"),
                "ManyToMany",
                Some(data_type.clone()),
                "Change `data_type` to ManyToMany or remove `many_to_many_property`.",
            ),
            (None, "ManyToMany") => self.error(
                "missing_many_to_many_property",
                format!("Property `{}.{}` uses ManyToMany without `many_to_many_property`.", entity.name, prop.name),
                &prop.loc.field("many_to_many_property"),
                "many_to_many_property block",
                None,
                "Add junction_table, local_key, foreign_key, target_schema, and target_type.",
            ),
            _ => {}
        }
    }

    fn validate_foreign_key(&mut self, entity: &EntityInfo, prop: &PropertyInfo, fk: &RelationRef) {
        let key = entity_key(&fk.schema_name, &fk.type_name);
        let Some(target) = self.entity_types.get(&key).cloned() else {
            self.error(
                "missing_foreign_key_target",
                format!(
                    "Foreign key `{}.{}` targets missing entity `{}.{}`.",
                    entity.name, prop.name, fk.schema_name, fk.type_name
                ),
                &fk.loc,
                "existing entity type",
                Some(format!("{}.{}", fk.schema_name, fk.type_name)),
                "Add the target entity or correct `foreign_key.type_name` / `schema_name`.",
            );
            return;
        };

        let key_props: Vec<PropertyInfo> = target
            .props
            .values()
            .filter(|p| p.is_key)
            .cloned()
            .collect();
        if key_props.is_empty() && target.is_table {
            self.error(
                "missing_target_key",
                format!(
                    "Foreign key `{}.{}` targets table `{}` with no key property.",
                    entity.name, prop.name, target.name
                ),
                &fk.loc,
                "target entity with a property where `is_key: true`",
                None,
                "Add a primary-key property to the target entity.",
            );
        } else if key_props.len() == 1 {
            let target_key = &key_props[0];
            if let (Some(source_dt), Some(target_dt)) = (&prop.data_type, &target_key.data_type) {
                if source_dt != target_dt {
                    self.error(
                        "foreign_key_type_mismatch",
                        format!(
                            "Foreign key `{}.{}` uses `{source_dt}` but target key `{}.{}` uses `{target_dt}`.",
                            entity.name, prop.name, target.name, target_key.name
                        ),
                        &prop.loc.field("data_type"),
                        format!("same data type as target key (`{target_dt}`)"),
                        Some(source_dt.clone()),
                        format!("Change `{}` to `data_type: {target_dt}` or target the correct entity.", prop.name),
                    );
                }
            }
        }
    }

    fn validate_nav_by_fk(&mut self, entity: &EntityInfo, prop: &PropertyInfo, nav: &NavRef) {
        let key = entity_key(&nav.schema_name, &nav.type_name);
        let Some(target) = self.entity_types.get(&key).cloned() else {
            self.error(
                "missing_navigation_target",
                format!(
                    "Navigation `{}.{}` targets missing entity `{}.{}`.",
                    entity.name, prop.name, nav.schema_name, nav.type_name
                ),
                &nav.loc,
                "existing entity type",
                Some(format!("{}.{}", nav.schema_name, nav.type_name)),
                "Add the target entity or correct `nav_by_fk_property.type_name` / `schema_name`.",
            );
            return;
        };

        let Some(fk_prop) = target.props.get(&nav.prop_name).cloned() else {
            self.error(
                "missing_navigation_property",
                format!(
                    "Navigation `{}.{}` points at missing property `{}.{}`.",
                    entity.name, prop.name, target.name, nav.prop_name
                ),
                &nav.loc.field("prop_name"),
                "property on the referenced entity",
                Some(nav.prop_name.clone()),
                "Set `prop_name` to the scalar foreign-key property name.",
            );
            return;
        };

        if fk_prop.foreign_key.is_none() {
            self.error(
                "navigation_property_not_foreign_key",
                format!(
                    "Navigation `{}.{}` points at `{}.{}`, but that property has no `foreign_key`.",
                    entity.name, prop.name, target.name, fk_prop.name
                ),
                &nav.loc.field("prop_name"),
                "property with a `foreign_key` block",
                Some(nav.prop_name.clone()),
                "Point at the scalar FK property, or add `foreign_key` to that property.",
            );
        }
    }

    fn validate_many_to_many(
        &mut self,
        entity: &EntityInfo,
        prop: &PropertyInfo,
        many_to_many: &ManyToManyRef,
    ) {
        let target_key = entity_key(&many_to_many.target_schema, &many_to_many.target_type);
        if !self.entity_types.contains_key(&target_key) {
            self.error(
                "missing_many_to_many_target",
                format!(
                    "Many-to-many `{}.{}` targets missing entity `{}.{}`.",
                    entity.name, prop.name, many_to_many.target_schema, many_to_many.target_type
                ),
                &many_to_many.loc.field("target_type"),
                "existing target entity type",
                Some(format!(
                    "{}.{}",
                    many_to_many.target_schema, many_to_many.target_type
                )),
                "Add the target entity or correct `target_schema` / `target_type`.",
            );
        }

        let junction_schema = many_to_many
            .junction_schema
            .clone()
            .unwrap_or_else(|| entity.schema_name.clone());
        let junction_key = entity_key(&junction_schema, &many_to_many.junction_table);
        if let Some(junction_entity) = self.entity_types.get(&junction_key).cloned() {
            for key_name in [&many_to_many.local_key, &many_to_many.foreign_key] {
                if !junction_entity.props.contains_key(key_name) {
                    self.error(
                        "missing_junction_property",
                        format!(
                            "Many-to-many junction `{}` is missing key property `{key_name}`.",
                            many_to_many.junction_table
                        ),
                        &many_to_many.loc,
                        "junction entity with local_key and foreign_key properties",
                        Some(key_name.clone()),
                        "Add the property to the junction entity or correct the key name.",
                    );
                }
            }
        }

        let key = entity_key(&junction_schema, &many_to_many.junction_table);
        let mut columns = BTreeSet::new();
        columns.insert("id".to_string());
        columns.insert(many_to_many.local_key.clone());
        columns.insert(many_to_many.foreign_key.clone());
        self.junctions
            .entry(key)
            .and_modify(|junction| junction.columns.extend(columns.iter().cloned()))
            .or_insert(JunctionInfo { columns });
    }

    fn validate_entity_ref(&mut self, relation: &RelationRef, code: &'static str) {
        let key = entity_key(&relation.schema_name, &relation.type_name);
        if !self.entity_types.contains_key(&key) {
            self.error(
                code,
                format!(
                    "Reference points at missing entity `{}.{}`.",
                    relation.schema_name, relation.type_name
                ),
                &relation.loc,
                "existing entity type",
                Some(format!("{}.{}", relation.schema_name, relation.type_name)),
                "Add the referenced entity or correct the type name.",
            );
        }
    }

    // ---- provider features (Postgres only) --------------------------

    fn validate_provider_features(&mut self) {
        let entities: Vec<EntityInfo> = self.entity_types.values().cloned().collect();
        for entity in &entities {
            let Some(schema) = self.schemas.get(&entity.schema_name).cloned() else {
                continue;
            };
            let Some(provider) = &schema.data_source_type else {
                continue;
            };

            for prop in entity.props.values() {
                let Some(data_type) = &prop.data_type else {
                    continue;
                };
                if provider == "PostgreSQL"
                    && matches!(data_type.as_str(), "ObjectId" | "ObjectIdArray")
                {
                    self.error(
                        "unsupported_provider_feature",
                        format!(
                            "PostgreSQL schema `{}` uses Mongo-style `{data_type}` on `{}.{}`.",
                            entity.schema_name, entity.name, prop.name
                        ),
                        &prop.loc.field("data_type"),
                        "data type supported by PostgreSQL generation",
                        Some(data_type.clone()),
                        "Use `Uuid`/`String`, or move the schema to a MongoDB data source.",
                    );
                }
            }
        }
    }

    // ---- seeds -----------------------------------------------------

    fn validate_seed_configs(&mut self) {
        let schema_dirs = self.schema_dirs.clone();
        for (schema_name, schema_dir) in schema_dirs {
            let seeds_dir = schema_dir.join("seeds");
            let files = self.yaml_files(&seeds_dir, false, true);
            if self
                .schemas
                .get(&schema_name)
                .map(|s| s.external_read_only)
                .unwrap_or(false)
            {
                for file in files {
                    let loc = Location::root(file.clone()).with_schema(schema_name.clone());
                    self.error(
                        "external_read_only_seed",
                        format!("Schema `{schema_name}` is configured as external read-only storage but declares seed data."),
                        &loc,
                        "no seed files for external read-only schemas",
                        Some(file.display().to_string()),
                        "Remove seed files from this schema; external authoritative data must be loaded and governed by its owning platform.",
                    );
                }
                continue;
            }

            for file in files {
                let loc = Location::root(file.clone()).with_schema(schema_name.clone());
                let Some(value) = self.read_yaml_value(&file, &loc) else {
                    continue;
                };
                let Some(items) = self.expect_array(&value, &loc, "seed group array").cloned()
                else {
                    continue;
                };
                for (idx, item) in items.iter().enumerate() {
                    self.validate_seed_group(item, &loc.index(idx), &schema_name);
                }
            }
        }
    }

    fn validate_seed_group(&mut self, item: &Value, loc: &Location, default_schema: &str) {
        let Some(obj) = self.expect_object(item, loc, "seed group object").cloned() else {
            return;
        };
        self.validate_known_fields(
            &obj,
            &["entity_type", "schema", "columns", "records"],
            loc,
            "seed group fields",
        );
        let entity_type = self.string_field(&obj, "entity_type", loc, true);
        let schema_name = self
            .string_field(&obj, "schema", loc, false)
            .unwrap_or_else(|| default_schema.to_string());
        let columns = self.string_array_field(&obj, "columns", loc, true);
        let records_loc = loc.field("records");
        let records = obj.get("records").and_then(|v| {
            self.expect_array(v, &records_loc, "seed records array")
                .cloned()
        });

        let Some(entity_type) = entity_type else {
            return;
        };

        let entity_key_str = entity_key(&schema_name, &entity_type);
        let entity = self.entity_types.get(&entity_key_str).cloned();
        let allowed_columns = self.seed_allowed_columns(&schema_name, &entity_type);
        if allowed_columns.is_none() {
            self.error(
                "missing_seed_entity",
                format!("Seed group references missing entity or junction `{schema_name}.{entity_type}`."),
                &loc.field("entity_type"),
                "entity type name or generated many-to-many junction table",
                Some(entity_type.clone()),
                "Add the entity type, add the many-to-many relationship that creates this junction, or correct `entity_type`.",
            );
            return;
        }
        let allowed_columns = allowed_columns.unwrap_or_default();

        let mut seen_columns = HashSet::new();
        for column in &columns {
            if !allowed_columns.contains(column) {
                self.error(
                    "invalid_seed_column",
                    format!(
                        "Seed column `{column}` is not valid for `{schema_name}.{entity_type}`."
                    ),
                    &loc.field("columns"),
                    "stored property or junction column name",
                    Some(column.clone()),
                    "Remove the column or add the matching stored property.",
                );
            }
            if !seen_columns.insert(column.clone()) {
                self.warn(
                    "duplicate_seed_column",
                    format!("Seed column `{column}` is listed more than once for `{schema_name}.{entity_type}`."),
                    &loc.field("columns"),
                    "unique seed columns",
                    Some(column.clone()),
                    "Remove the duplicate column from `columns`.",
                );
            }
        }

        let column_set: HashSet<String> = columns.iter().cloned().collect();
        if let Some(entity) = &entity {
            for prop in entity.props.values() {
                if !prop.is_required
                    || prop.is_read_only
                    || !is_seed_native_property(prop)
                    || is_generated_seed_value(prop)
                {
                    continue;
                }
                if !column_set.contains(&prop.name) {
                    self.error(
                        "missing_required_seed_column",
                        format!("Seed group `{schema_name}.{entity_type}` does not list required property `{}`.", prop.name),
                        &loc.field("columns"),
                        "all non-generated required native properties",
                        Some(prop.name.clone()),
                        format!("Add `{}` to `columns` and every record, or make it optional.", prop.name),
                    );
                }
            }
        }

        if let Some(records) = records {
            for (idx, record) in records.iter().enumerate() {
                let record_loc = records_loc.index(idx);
                let Some(record_obj) = self
                    .expect_object(record, &record_loc, "seed record object")
                    .cloned()
                else {
                    continue;
                };
                for key in record_obj.keys() {
                    if !column_set.contains(key) {
                        self.warn(
                            "seed_record_key_not_in_columns",
                            format!(
                                "Seed record key `{key}` is not listed in the group `columns`."
                            ),
                            &record_loc.field(key),
                            "record keys listed in `columns`",
                            Some(key.clone()),
                            "Add the key to `columns` or remove it from the record.",
                        );
                    }
                }
                if let Some(id_value) = record_obj.get("id").and_then(Value::as_str) {
                    let seed_key = format!("{schema_name}.{entity_type}.{id_value}");
                    if let Some(first_loc) = self.seed_keys.get(&seed_key).cloned() {
                        self.error(
                            "duplicate_seed_key",
                            format!("Seed id `{id_value}` is used more than once for `{schema_name}.{entity_type}`."),
                            &record_loc.field("id"),
                            "unique seed id per entity",
                            Some(id_value.to_string()),
                            format!("Change this id or remove the duplicate. First use is at {} {}.", first_loc.file.display(), first_loc.path),
                        );
                    } else {
                        self.seed_keys.insert(seed_key, record_loc.field("id"));
                    }
                }
                if let Some(entity) = &entity {
                    for column in &column_set {
                        let Some(prop) = entity.props.get(column).cloned() else {
                            continue;
                        };
                        let value = record_obj.get(column);
                        if value.is_none()
                            && prop.is_required
                            && !prop.is_read_only
                            && is_seed_native_property(&prop)
                            && !is_generated_seed_value(&prop)
                        {
                            self.error(
                                "missing_required_seed_value",
                                format!("Seed record for `{schema_name}.{entity_type}` is missing required property `{column}`."),
                                &record_loc.field(column),
                                "value for required property",
                                None,
                                format!("Add `{column}: <value>` to this seed record."),
                            );
                            continue;
                        }
                        if let Some(value) = value {
                            self.validate_seed_value(
                                &schema_name,
                                &entity_type,
                                &prop,
                                value,
                                &record_loc.field(column),
                            );
                        }
                    }
                }
            }
        }
    }

    fn validate_seed_value(
        &mut self,
        schema_name: &str,
        entity_type: &str,
        prop: &PropertyInfo,
        value: &Value,
        loc: &Location,
    ) {
        if value.is_null() {
            if prop.is_required && !is_generated_seed_value(prop) {
                self.error(
                    "null_required_seed_value",
                    format!("Seed value `{schema_name}.{entity_type}.{}` is null but the property is required.", prop.name),
                    loc,
                    "non-null value",
                    Some("null".to_string()),
                    "Provide a value or make the property optional.",
                );
            }
            return;
        }

        let Some(data_type) = prop.data_type.as_deref() else {
            return;
        };

        match data_type {
            "Uuid" => {
                let Some(raw) = self.expect_seed_string(value, loc, "UUID string") else {
                    return;
                };
                if uuid::Uuid::parse_str(raw).is_err() {
                    self.error(
                        "invalid_seed_value_type",
                        format!(
                            "Seed value `{schema_name}.{entity_type}.{}` must be a UUID.",
                            prop.name
                        ),
                        loc,
                        "UUID string",
                        Some(raw.to_string()),
                        "Use a canonical UUID such as `00000000-0000-4000-8000-000000000000`.",
                    );
                }
            }
            "String" => {
                self.expect_seed_string(value, loc, "string");
            }
            "Date" => {
                let Some(raw) = self.expect_seed_string(value, loc, "date string") else {
                    return;
                };
                if chrono::NaiveDate::parse_from_str(raw, "%Y-%m-%d").is_err() {
                    self.error(
                        "invalid_seed_value_type",
                        format!(
                            "Seed value `{schema_name}.{entity_type}.{}` must be an ISO date.",
                            prop.name
                        ),
                        loc,
                        "YYYY-MM-DD date string",
                        Some(raw.to_string()),
                        "Use a date like `2026-01-31`.",
                    );
                }
            }
            "DateTime" => {
                let Some(raw) = self.expect_seed_string(value, loc, "date-time string") else {
                    return;
                };
                if chrono::DateTime::parse_from_rfc3339(raw).is_err() {
                    self.error(
                        "invalid_seed_value_type",
                        format!("Seed value `{schema_name}.{entity_type}.{}` must be an RFC3339 date-time.", prop.name),
                        loc,
                        "RFC3339 date-time string",
                        Some(raw.to_string()),
                        "Use a timestamp like `2026-01-31T15:04:05Z`.",
                    );
                }
            }
            "Time" => {
                let Some(raw) = self.expect_seed_string(value, loc, "time string") else {
                    return;
                };
                if chrono::NaiveTime::parse_from_str(raw, "%H:%M:%S%.f").is_err() {
                    self.error(
                        "invalid_seed_value_type",
                        format!(
                            "Seed value `{schema_name}.{entity_type}.{}` must be a time.",
                            prop.name
                        ),
                        loc,
                        "HH:MM:SS time string",
                        Some(raw.to_string()),
                        "Use a time like `13:45:00`.",
                    );
                }
            }
            "Boolean" => {
                if !value.is_boolean() {
                    self.invalid_seed_type(schema_name, entity_type, prop, loc, "boolean", value);
                }
            }
            "Int8" | "Int16" | "Int32" | "Int64" => {
                let Some(number) = value.as_i64() else {
                    self.invalid_seed_type(schema_name, entity_type, prop, loc, "integer", value);
                    return;
                };
                let valid_range = match data_type {
                    "Int8" => i8::MIN as i64..=i8::MAX as i64,
                    "Int16" => i16::MIN as i64..=i16::MAX as i64,
                    "Int32" => i32::MIN as i64..=i32::MAX as i64,
                    _ => i64::MIN..=i64::MAX,
                };
                if !valid_range.contains(&number) {
                    self.error(
                        "invalid_seed_value_type",
                        format!("Seed value `{schema_name}.{entity_type}.{}` is outside the `{data_type}` range.", prop.name),
                        loc,
                        format!("{data_type} numeric range"),
                        Some(number.to_string()),
                        format!("Use a value that fits `{data_type}` or change the property data type."),
                    );
                }
            }
            "Float32" | "Float64" => {
                if !value.is_number() {
                    self.invalid_seed_type(schema_name, entity_type, prop, loc, "number", value);
                }
            }
            "Enum" => {
                let Some(raw) = self
                    .expect_seed_string(value, loc, "enum string")
                    .map(str::to_string)
                else {
                    return;
                };
                self.validate_seed_enum_value(schema_name, prop, &raw, loc);
            }
            "Json" => {}
            "Object" => {
                if !value.is_object() {
                    self.invalid_seed_type(schema_name, entity_type, prop, loc, "object", value);
                }
            }
            "UuidArray" | "StringArray" | "Int8Array" | "Int16Array" | "Int32Array"
            | "Int64Array" | "Float32Array" | "EnumArray" | "JsonArray" | "ObjectArray" => {
                let Some(items) = value.as_array().cloned() else {
                    self.invalid_seed_type(schema_name, entity_type, prop, loc, "array", value);
                    return;
                };
                for (idx, item) in items.iter().enumerate() {
                    self.validate_seed_array_item(
                        schema_name,
                        entity_type,
                        prop,
                        data_type,
                        item,
                        &loc.index(idx),
                    );
                }
            }
            _ => {}
        }
    }

    fn validate_seed_array_item(
        &mut self,
        schema_name: &str,
        entity_type: &str,
        prop: &PropertyInfo,
        data_type: &str,
        value: &Value,
        loc: &Location,
    ) {
        if value.is_null() {
            return;
        }
        match data_type {
            "UuidArray" => {
                let Some(raw) = self.expect_seed_string(value, loc, "UUID string") else {
                    return;
                };
                if uuid::Uuid::parse_str(raw).is_err() {
                    self.invalid_seed_type(
                        schema_name,
                        entity_type,
                        prop,
                        loc,
                        "UUID string",
                        value,
                    );
                }
            }
            "StringArray" => {
                self.expect_seed_string(value, loc, "string");
            }
            "Int8Array" | "Int16Array" | "Int32Array" | "Int64Array" => {
                if !value.is_i64() {
                    self.invalid_seed_type(schema_name, entity_type, prop, loc, "integer", value);
                }
            }
            "Float32Array" => {
                if !value.is_number() {
                    self.invalid_seed_type(schema_name, entity_type, prop, loc, "number", value);
                }
            }
            "EnumArray" => {
                let Some(raw) = self
                    .expect_seed_string(value, loc, "enum string")
                    .map(str::to_string)
                else {
                    return;
                };
                self.validate_seed_enum_value(schema_name, prop, &raw, loc);
            }
            "ObjectArray" => {
                if !value.is_object() {
                    self.invalid_seed_type(schema_name, entity_type, prop, loc, "object", value);
                }
            }
            "JsonArray" => {}
            _ => {}
        }
    }

    fn validate_seed_enum_value(
        &mut self,
        schema_name: &str,
        prop: &PropertyInfo,
        value: &str,
        loc: &Location,
    ) {
        let Some(enum_type_name) = prop.enum_type_name.as_deref() else {
            return;
        };
        let key = if self
            .enum_values
            .contains_key(&enum_key(schema_name, enum_type_name))
        {
            enum_key(schema_name, enum_type_name)
        } else {
            enum_key("system", enum_type_name)
        };
        let Some(values) = self.enum_values.get(&key) else {
            return;
        };
        if !values.contains(value) {
            let mut allowed = values.iter().cloned().collect::<Vec<_>>();
            allowed.sort();
            self.error(
                "invalid_seed_enum_value",
                format!(
                    "Seed value for `{}` is not a valid `{enum_type_name}` enum item.",
                    prop.name
                ),
                loc,
                format!("one of: {}", allowed.join(", ")),
                Some(value.to_string()),
                "Use an enum item declared in the matching gql_enum_types YAML.",
            );
        }
    }

    fn expect_seed_string<'a>(
        &mut self,
        value: &'a Value,
        loc: &Location,
        expected: &str,
    ) -> Option<&'a str> {
        match value.as_str() {
            Some(value) => Some(value),
            None => {
                self.error(
                    "invalid_seed_value_type",
                    format!("Seed value must be {expected}."),
                    loc,
                    expected,
                    Some(value_kind(value).to_string()),
                    "Use a YAML scalar whose shape matches the property data_type.",
                );
                None
            }
        }
    }

    fn invalid_seed_type(
        &mut self,
        schema_name: &str,
        entity_type: &str,
        prop: &PropertyInfo,
        loc: &Location,
        expected: impl Into<String>,
        value: &Value,
    ) {
        self.error(
            "invalid_seed_value_type",
            format!(
                "Seed value `{schema_name}.{entity_type}.{}` does not match `{}`.",
                prop.name,
                prop.data_type.as_deref().unwrap_or("<unknown>")
            ),
            loc,
            expected,
            Some(value_kind(value).to_string()),
            "Use a YAML value whose shape matches the property data_type.",
        );
    }

    fn seed_allowed_columns(
        &self,
        schema_name: &str,
        entity_type: &str,
    ) -> Option<HashSet<String>> {
        let key = entity_key(schema_name, entity_type);
        if let Some(entity) = self.entity_types.get(&key) {
            return Some(
                entity
                    .props
                    .values()
                    .filter(|prop| {
                        !matches!(
                            prop.data_type.as_deref(),
                            Some("NavToOne" | "NavToMany" | "ManyToMany")
                        )
                    })
                    .map(|prop| prop.name.clone())
                    .collect(),
            );
        }
        if let Some(junction) = self.junctions.get(&key) {
            return Some(junction.columns.iter().cloned().collect());
        }
        None
    }

    // ---- API test configs -------------------------------------------

    fn validate_test_configs(&mut self) {
        let schema_dirs = self.schema_dirs.clone();
        for (schema_name, schema_dir) in schema_dirs {
            let tests_dir = schema_dir.join("tests");
            let files = self.yaml_files(&tests_dir, false, true);
            for file in files {
                let loc = Location::root(file.clone()).with_schema(schema_name.clone());
                let Some(value) = self.read_yaml_value(&file, &loc) else {
                    continue;
                };
                let Some(items) = self.expect_array(&value, &loc, "API test array").cloned() else {
                    continue;
                };
                for (idx, item) in items.iter().enumerate() {
                    self.validate_test_case(item, &loc.index(idx), &schema_name);
                }
            }
        }
    }

    fn validate_test_case(&mut self, item: &Value, loc: &Location, default_schema: &str) {
        let Some(obj) = self.expect_object(item, loc, "API test object").cloned() else {
            return;
        };
        self.string_field(&obj, "name", loc, true);
        self.string_field(&obj, "description", loc, false);
        self.string_field(&obj, "auth_token", loc, false);
        self.string_field(&obj, "result_object_name", loc, false);
        if let Some(graphql) = obj.get("graphql").cloned() {
            self.validate_test_graphql(&graphql, &loc.field("graphql"), default_schema);
        }
        if let Some(expect) = obj.get("expect") {
            if !expect.is_object() {
                self.error(
                    "invalid_test_expect_shape",
                    "`expect` must be an object.".to_string(),
                    &loc.field("expect"),
                    "object with data or error expectations",
                    Some(value_kind(expect).to_string()),
                    "Use `expect.data` or `expect.error`.",
                );
            }
        }
    }

    fn validate_test_graphql(&mut self, value: &Value, loc: &Location, default_schema: &str) {
        let Some(obj) = self
            .expect_object(value, loc, "graphql test object")
            .cloned()
        else {
            return;
        };
        let schema_name = self
            .string_field(&obj, "schema", loc, false)
            .unwrap_or_else(|| default_schema.to_string());
        if !self.schemas.contains_key(&schema_name) {
            self.error(
                "missing_test_schema",
                format!("API test references missing schema `{schema_name}`."),
                &loc.field("schema"),
                "schema declared under .appfw/model/schemas",
                Some(schema_name),
                "Correct `graphql.schema` or add the schema config.",
            );
        }

        if let Some(operation_type) = self.string_field(&obj, "type", loc, true) {
            if !matches!(operation_type.as_str(), "query" | "mutation") {
                self.error(
                    "invalid_graphql_operation_type",
                    format!("Unsupported GraphQL operation type `{operation_type}`."),
                    &loc.field("type"),
                    "`query` or `mutation`",
                    Some(operation_type),
                    "Use `type: query` or `type: mutation`.",
                );
            }
        }
        self.string_field(&obj, "name", loc, true);
        self.string_field(&obj, "select", loc, false);
        if let Some(variables) = obj.get("variables").cloned() {
            let var_loc = loc.field("variables");
            if let Some(items) = self
                .expect_array(&variables, &var_loc, "GraphQL variables array")
                .cloned()
            {
                for (idx, variable) in items.iter().enumerate() {
                    let item_loc = var_loc.index(idx);
                    if let Some(var_obj) = self
                        .expect_object(variable, &item_loc, "GraphQL variable object")
                        .cloned()
                    {
                        self.string_field(&var_obj, "name", &item_loc, true);
                        self.string_field(&var_obj, "type", &item_loc, false);
                    }
                }
            }
        }
    }

    // ---- relation-ref parsing -----------------------------------------

    fn parse_relation_ref(
        &self,
        value: Option<&Value>,
        loc: &Location,
        default_schema: &str,
    ) -> Option<RelationRef> {
        let value = value?;
        if value.is_null() {
            return None;
        }
        let obj = value.as_object()?;
        let type_name = obj.get("type_name")?.as_str()?.to_string();
        let schema_name = obj
            .get("schema_name")
            .and_then(Value::as_str)
            .unwrap_or(default_schema)
            .to_string();
        Some(RelationRef {
            schema_name,
            type_name,
            loc: loc.clone(),
        })
    }

    fn parse_nav_ref(
        &self,
        value: Option<&Value>,
        loc: &Location,
        default_schema: &str,
        default_type: &str,
    ) -> Option<NavRef> {
        let value = value?;
        if value.is_null() {
            return None;
        }
        let obj = value.as_object()?;
        let prop_name = obj.get("prop_name")?.as_str()?.to_string();
        let schema_name = obj
            .get("schema_name")
            .and_then(Value::as_str)
            .unwrap_or(default_schema)
            .to_string();
        let type_name = obj
            .get("type_name")
            .and_then(Value::as_str)
            .unwrap_or(default_type)
            .to_string();
        Some(NavRef {
            schema_name,
            type_name,
            prop_name,
            loc: loc.clone(),
        })
    }

    fn parse_many_to_many_ref(
        &self,
        value: Option<&Value>,
        loc: &Location,
    ) -> Option<ManyToManyRef> {
        let value = value?;
        if value.is_null() {
            return None;
        }
        let obj = value.as_object()?;
        Some(ManyToManyRef {
            junction_table: obj.get("junction_table")?.as_str()?.to_string(),
            junction_schema: obj
                .get("junction_schema")
                .and_then(Value::as_str)
                .map(str::to_string),
            local_key: obj.get("local_key")?.as_str()?.to_string(),
            foreign_key: obj.get("foreign_key")?.as_str()?.to_string(),
            target_schema: obj.get("target_schema")?.as_str()?.to_string(),
            target_type: obj.get("target_type")?.as_str()?.to_string(),
            loc: loc.clone(),
        })
    }

    fn parse_relationship_endpoint(
        &mut self,
        value: Option<&Value>,
        loc: &Location,
        default_schema: &str,
    ) -> Option<RelationshipEndpointInfo> {
        let value = value?;
        if value.is_null() {
            return None;
        }
        let obj = self
            .expect_object(value, loc, "relationship endpoint")?
            .clone();
        self.validate_known_fields(
            &obj,
            &["schema", "entity", "field", "caption"],
            loc,
            "relationship endpoint fields",
        );
        let entity_name = self.string_field(&obj, "entity", loc, true)?;
        let field_name = self.string_field(&obj, "field", loc, true)?;
        let schema_name = self
            .string_field(&obj, "schema", loc, false)
            .unwrap_or_else(|| default_schema.to_string());
        self.string_field(&obj, "caption", loc, false);
        Some(RelationshipEndpointInfo {
            schema_name,
            entity_name,
            field_name,
            loc: loc.clone(),
        })
    }

    fn parse_relationship_storage(
        &mut self,
        value: Option<&Value>,
        loc: &Location,
        default_schema: &str,
    ) -> Option<RelationshipStorageInfo> {
        let value = value?;
        if value.is_null() {
            return None;
        }
        let obj = self
            .expect_object(value, loc, "relationship storage")?
            .clone();
        self.validate_known_fields(
            &obj,
            &["type", "owner_schema", "owner", "field"],
            loc,
            "relationship storage fields",
        );
        let storage_type = self.enum_field(&obj, "type", loc, RELATIONSHIP_STORAGE_TYPES, true)?;
        let owner = self.string_field(&obj, "owner", loc, true)?;
        let field = self.string_field(&obj, "field", loc, true)?;
        let owner_schema = self
            .string_field(&obj, "owner_schema", loc, false)
            .unwrap_or_else(|| default_schema.to_string());
        Some(RelationshipStorageInfo {
            storage_type,
            owner_schema,
            owner,
            field,
            loc: loc.clone(),
        })
    }

    fn parse_relationship_junction(
        &mut self,
        value: Option<&Value>,
        loc: &Location,
        default_schema: &str,
    ) -> Option<RelationshipJunctionInfo> {
        let value = value?;
        if value.is_null() {
            return None;
        }
        let obj = self
            .expect_object(value, loc, "relationship junction")?
            .clone();
        self.validate_known_fields(
            &obj,
            &["schema", "entity", "left_key", "right_key"],
            loc,
            "relationship junction fields",
        );
        let entity_name = self.string_field(&obj, "entity", loc, true)?;
        let left_key = self.string_field(&obj, "left_key", loc, true)?;
        let right_key = self.string_field(&obj, "right_key", loc, true)?;
        let schema_name = self
            .string_field(&obj, "schema", loc, false)
            .unwrap_or_else(|| default_schema.to_string());
        Some(RelationshipJunctionInfo {
            schema_name,
            entity_name,
            left_key,
            right_key,
        })
    }

    // ---- generic YAML/field helpers -----------------------------------

    fn read_yaml_value(&mut self, file: &Path, loc: &Location) -> Option<Value> {
        let file_handle = match fs::File::open(file) {
            Ok(file) => file,
            Err(err) => {
                self.error(
                    "missing_yaml_file",
                    format!("Could not open YAML file: {err}."),
                    loc,
                    "readable YAML file",
                    Some(err.to_string()),
                    "Create the file or fix its permissions.",
                );
                return None;
            }
        };
        match serde_yaml::from_reader(file_handle) {
            Ok(value) => Some(value),
            Err(err) => {
                self.error(
                    "invalid_yaml",
                    format!("YAML parse error: {err}."),
                    loc,
                    "valid YAML",
                    Some(err.to_string()),
                    "Fix the YAML syntax at the reported line and column.",
                );
                None
            }
        }
    }

    fn yaml_files(&mut self, dir: &Path, recursive: bool, skip_res: bool) -> Vec<PathBuf> {
        if !dir.exists() {
            return vec![];
        }
        let mut files = vec![];
        if let Err(err) = collect_yaml_files(dir, recursive, skip_res, &mut files) {
            let loc = Location::root(dir.to_path_buf());
            self.error(
                "read_dir_failed",
                format!("Could not read config directory: {err}."),
                &loc,
                "readable directory",
                Some(err.to_string()),
                "Fix directory permissions or restore the expected config directory.",
            );
        }
        files.sort();
        files
    }

    fn schema_dirs_under(&mut self, schemas_dir: &Path) -> Vec<PathBuf> {
        if !schemas_dir.exists() {
            let loc = Location::root(schemas_dir.to_path_buf());
            self.error(
                "missing_schemas_dir",
                "Schemas directory is missing.".to_string(),
                &loc,
                ".appfw/model/schemas directory",
                None,
                "Restore `.appfw/model/schemas` with at least the system schema.",
            );
            return vec![];
        }
        let mut dirs = vec![];
        match fs::read_dir(schemas_dir) {
            Ok(entries) => {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if !path.is_dir() {
                        continue;
                    }
                    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                        continue;
                    };
                    if !name.starts_with('.') {
                        dirs.push(path);
                    }
                }
            }
            Err(err) => {
                let loc = Location::root(schemas_dir.to_path_buf());
                self.error(
                    "read_dir_failed",
                    format!("Could not read schemas directory: {err}."),
                    &loc,
                    "readable .appfw/model/schemas directory",
                    Some(err.to_string()),
                    "Fix directory permissions or restore the schemas directory.",
                );
            }
        }
        dirs.sort();
        dirs
    }

    fn expect_array<'a>(
        &mut self,
        value: &'a Value,
        loc: &Location,
        expected: &str,
    ) -> Option<&'a Vec<Value>> {
        match value.as_array() {
            Some(items) => Some(items),
            None => {
                self.error(
                    "invalid_shape",
                    format!("Expected {expected}."),
                    loc,
                    expected,
                    Some(value_kind(value).to_string()),
                    "Change this YAML node to the expected shape.",
                );
                None
            }
        }
    }

    fn expect_object<'a>(
        &mut self,
        value: &'a Value,
        loc: &Location,
        expected: &str,
    ) -> Option<&'a Map<String, Value>> {
        match value.as_object() {
            Some(obj) => Some(obj),
            None => {
                self.error(
                    "invalid_shape",
                    format!("Expected {expected}."),
                    loc,
                    expected,
                    Some(value_kind(value).to_string()),
                    "Change this YAML node to the expected shape.",
                );
                None
            }
        }
    }

    fn validate_known_fields(
        &mut self,
        obj: &Map<String, Value>,
        allowed: &[&str],
        loc: &Location,
        expected_shape: &str,
    ) {
        for key in obj.keys() {
            if !allowed.contains(&key.as_str()) {
                self.error(
                    "unknown_field",
                    format!("Unknown field `{key}`."),
                    &loc.field(key),
                    expected_shape,
                    Some(key.clone()),
                    format!(
                        "Remove `{key}` or rename it to one of: {}.",
                        allowed.join(", ")
                    ),
                );
            }
        }
    }

    fn string_field(
        &mut self,
        obj: &Map<String, Value>,
        field: &str,
        loc: &Location,
        required: bool,
    ) -> Option<String> {
        match obj.get(field) {
            Some(value) if value.is_null() && !required => None,
            Some(value) => match value.as_str() {
                Some(value) => Some(value.to_string()),
                None => {
                    self.error(
                        "invalid_field_type",
                        format!("Field `{field}` must be a string."),
                        &loc.field(field),
                        "string",
                        Some(value_kind(value).to_string()),
                        format!("Set `{field}` to a quoted or unquoted string value."),
                    );
                    None
                }
            },
            None if required => {
                self.error(
                    "missing_required_field",
                    format!("Missing required field `{field}`."),
                    &loc.field(field),
                    "string",
                    None,
                    format!("Add `{field}: <value>`."),
                );
                None
            }
            None => None,
        }
    }

    fn uuid_field(
        &mut self,
        obj: &Map<String, Value>,
        field: &str,
        loc: &Location,
        required: bool,
    ) -> Option<String> {
        let value = self.string_field(obj, field, loc, required)?;
        if uuid::Uuid::parse_str(&value).is_err() {
            self.error(
                "invalid_uuid",
                format!("Field `{field}` must be a UUID."),
                &loc.field(field),
                "UUID string",
                Some(value.clone()),
                format!("Replace `{field}` with a valid UUID."),
            );
        }
        Some(value)
    }

    fn bool_field(
        &mut self,
        obj: &Map<String, Value>,
        field: &str,
        loc: &Location,
        required: bool,
    ) -> Option<bool> {
        match obj.get(field) {
            Some(value) if value.is_null() && !required => None,
            Some(value) => match value.as_bool() {
                Some(value) => Some(value),
                None => {
                    self.error(
                        "invalid_field_type",
                        format!("Field `{field}` must be a boolean."),
                        &loc.field(field),
                        "boolean",
                        Some(value_kind(value).to_string()),
                        format!("Set `{field}` to `true` or `false`."),
                    );
                    None
                }
            },
            None if required => {
                self.error(
                    "missing_required_field",
                    format!("Missing required field `{field}`."),
                    &loc.field(field),
                    "boolean",
                    None,
                    format!("Add `{field}: true` or `{field}: false`."),
                );
                None
            }
            None => None,
        }
    }

    fn string_or_number_field(
        &mut self,
        obj: &Map<String, Value>,
        field: &str,
        loc: &Location,
        required: bool,
    ) -> Option<String> {
        match obj.get(field) {
            Some(value) if value.is_null() && !required => None,
            Some(value) if value.is_string() => value.as_str().map(str::to_string),
            Some(value) if value.is_number() => Some(value.to_string()),
            Some(value) => {
                self.error(
                    "invalid_field_type",
                    format!("Field `{field}` must be a string or number."),
                    &loc.field(field),
                    "string or number",
                    Some(value_kind(value).to_string()),
                    format!("Set `{field}` to a port number or string."),
                );
                None
            }
            None if required => {
                self.error(
                    "missing_required_field",
                    format!("Missing required field `{field}`."),
                    &loc.field(field),
                    "string or number",
                    None,
                    format!("Add `{field}: <port>`."),
                );
                None
            }
            None => None,
        }
    }

    fn enum_field(
        &mut self,
        obj: &Map<String, Value>,
        field: &str,
        loc: &Location,
        allowed: &'static [&'static str],
        required: bool,
    ) -> Option<String> {
        let value = self.string_field(obj, field, loc, required)?;
        if !allowed.contains(&value.as_str()) {
            self.error(
                "invalid_enum_value",
                format!("Field `{field}` has unsupported value `{value}`."),
                &loc.field(field),
                allowed_values(allowed),
                Some(value.clone()),
                format!("Set `{field}` to one of: {}.", allowed.join(", ")),
            );
        }
        Some(value)
    }

    fn string_array_field(
        &mut self,
        obj: &Map<String, Value>,
        field: &str,
        loc: &Location,
        required: bool,
    ) -> Vec<String> {
        let Some(value) = obj.get(field) else {
            if required {
                self.error(
                    "missing_required_field",
                    format!("Missing required field `{field}`."),
                    &loc.field(field),
                    "array of strings",
                    None,
                    format!("Add `{field}: []` or a list of strings."),
                );
            }
            return vec![];
        };
        if value.is_null() && !required {
            return vec![];
        }
        let field_loc = loc.field(field);
        let Some(items) = self
            .expect_array(value, &field_loc, "array of strings")
            .cloned()
        else {
            return vec![];
        };
        let mut result = vec![];
        for (idx, item) in items.iter().enumerate() {
            match item.as_str() {
                Some(item) => result.push(item.to_string()),
                None => self.error(
                    "invalid_field_type",
                    format!("Entry in `{field}` must be a string."),
                    &field_loc.index(idx),
                    "string",
                    Some(value_kind(item).to_string()),
                    "Use plain string entries in the list.",
                ),
            }
        }
        result
    }

    fn effective_entity_name(&self, obj: &Map<String, Value>, raw_name: &str) -> String {
        obj.get("pascal_1")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| {
                if is_pascal_case(raw_name) {
                    raw_name.to_string()
                } else {
                    to_pascal_case(raw_name)
                }
            })
    }

    fn enum_exists(&self, schema_name: &str, enum_type_name: &str) -> bool {
        self.enum_types
            .contains_key(&enum_key(schema_name, enum_type_name))
    }

    fn fragment_suggestions(&self) -> String {
        let mut names: Vec<&str> = self.fragments.keys().map(String::as_str).collect();
        names.sort();
        names.into_iter().take(8).collect::<Vec<_>>().join(", ")
    }

    fn error(
        &mut self,
        code: &'static str,
        message: String,
        loc: &Location,
        expected: impl Into<String>,
        actual: Option<String>,
        suggested_fix: impl Into<String>,
    ) {
        self.issue("error", code, message, loc, expected, actual, suggested_fix);
    }

    fn warn(
        &mut self,
        code: &'static str,
        message: String,
        loc: &Location,
        expected: impl Into<String>,
        actual: Option<String>,
        suggested_fix: impl Into<String>,
    ) {
        self.issue(
            "warning",
            code,
            message,
            loc,
            expected,
            actual,
            suggested_fix,
        );
    }

    fn issue(
        &mut self,
        severity: &'static str,
        code: &'static str,
        message: String,
        loc: &Location,
        expected: impl Into<String>,
        actual: Option<String>,
        suggested_fix: impl Into<String>,
    ) {
        self.issues.push(ValidationIssue {
            severity,
            code,
            message,
            file: loc.file.display().to_string(),
            path: loc.path.clone(),
            schema_name: loc.schema_name.clone(),
            entity_name: loc.entity_name.clone(),
            property_name: loc.property_name.clone(),
            expected: expected.into(),
            actual,
            suggested_fix: suggested_fix.into(),
        });
    }
}

fn collect_yaml_files(
    dir: &Path,
    recursive: bool,
    skip_res: bool,
    files: &mut Vec<PathBuf>,
) -> std::io::Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() && recursive {
            collect_yaml_files(&path, recursive, skip_res, files)?;
        } else if is_yaml_file(&path, skip_res) {
            files.push(path);
        }
    }
    Ok(())
}

fn is_yaml_file(path: &Path, skip_res: bool) -> bool {
    if !path.is_file() {
        return false;
    }
    let is_yaml = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("yaml"))
        .unwrap_or(false);
    let is_res = path
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s == "_res")
        .unwrap_or(false);
    is_yaml && !(skip_res && is_res)
}

fn value_kind(value: &Value) -> &'static str {
    match value {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}

fn value_preview(value: &Value) -> String {
    match value {
        Value::String(value) => value.clone(),
        Value::Number(_) | Value::Bool(_) | Value::Null => value.to_string(),
        Value::Array(_) => "array".to_string(),
        Value::Object(_) => "object".to_string(),
    }
}

fn allowed_values(values: &[&str]) -> String {
    format!("one of: {}", values.join(", "))
}

fn provider_routine_identifier_is_safe(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    (first.is_ascii_alphabetic() || first == '_')
        && chars.all(|ch| ch.is_ascii_alphanumeric() || ch == '_')
}

fn entity_key(schema_name: &str, entity_name: &str) -> String {
    format!("{schema_name}.{entity_name}")
}

fn enum_key(schema_name: &str, enum_name: &str) -> String {
    format!("{schema_name}.{enum_name}")
}

fn bool_from_json(value: Option<&Value>, field: &str) -> bool {
    value
        .and_then(|v| v.get(field))
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn string_from_json(value: Option<&Value>, field: &str) -> Option<String> {
    value
        .and_then(|v| v.get(field))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn is_seed_native_property(prop: &PropertyInfo) -> bool {
    !matches!(
        prop.data_type.as_deref(),
        Some("NavToOne" | "NavToMany" | "ManyToMany" | "Object" | "ObjectArray")
    ) && prop.nav_by_fk_property.is_none()
        && prop.many_to_many_property.is_none()
        && prop.nested_entity_type.is_none()
}

fn is_generated_seed_value(prop: &PropertyInfo) -> bool {
    prop.is_concurrency_control
        || prop
            .computed
            .as_deref()
            .map(|c| c != "None")
            .unwrap_or(false)
}

/// This product has no schemas with `meta.storage: external_read_only`
/// today, but the check is cheap and generic (no classification/mssql
/// dependency), so it's kept for when/if one is added.
fn schema_meta_external_read_only(value: Option<&Value>) -> bool {
    let Some(meta) = value.and_then(Value::as_object) else {
        return false;
    };
    match meta.get("storage") {
        Some(Value::String(mode)) => mode == "external_read_only",
        Some(Value::Object(storage)) => {
            storage
                .get("external_read_only")
                .and_then(Value::as_bool)
                .unwrap_or(false)
                || storage
                    .get("mode")
                    .and_then(Value::as_str)
                    .is_some_and(|m| m == "external_read_only")
        }
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn app_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
    }

    /// The strongest available test: run every included validation
    /// category against this product's real, currently checked-in model.
    /// This is exactly the model the real app_gen's `Validator` last ran
    /// clean against (`docs/evidence/backend-m9/validation.json`'s
    /// `valid: true, errors: 0, warnings: 0`) -- if this port disagrees
    /// with that on a model that hasn't changed its shape, the port has a
    /// bug.
    #[test]
    fn real_model_validates_clean() {
        let report = run(&app_root()).expect("validate should run");
        assert!(
            report.valid,
            "expected 0 errors against the real model, found: {:#?}",
            report
                .issues
                .iter()
                .filter(|i| i.severity == "error")
                .collect::<Vec<_>>()
        );
    }

    fn loc() -> Location {
        Location::root(PathBuf::from("test.yaml"))
    }

    fn validator() -> Validator {
        Validator::new(&PathBuf::from("/nonexistent"))
    }

    #[test]
    fn missing_fragment_reference_is_an_error() {
        let mut v = validator();
        let prop = serde_json::json!({"name": "foo", "fragment": "does-not-exist"});
        v.validate_property_shape(&prop, &loc(), PropertyShapeMode::EntityProperty);
        assert!(v.issues.iter().any(|i| i.code == "missing_fragment"));
    }

    #[test]
    fn unsafe_provider_routine_identifier_is_rejected() {
        let mut v = validator();
        v.validate_provider_routine_identifier("valid_name", &loc(), "routine name");
        assert!(v.issues.is_empty());
        v.validate_provider_routine_identifier(
            "robert'); drop table students;--",
            &loc(),
            "routine name",
        );
        assert!(v
            .issues
            .iter()
            .any(|i| i.code == "unsafe_provider_routine_identifier"));
    }

    #[test]
    fn missing_foreign_key_target_is_an_error() {
        let mut v = validator();
        let entity = EntityInfo {
            schema_name: "governance".to_string(),
            name: "Comment".to_string(),
            is_table: true,
            is_union: false,
            base_type: None,
            loc: loc(),
            props: HashMap::new(),
            prop_names: vec![],
        };
        let prop = PropertyInfo {
            name: "project_id".to_string(),
            data_type: Some("Uuid".to_string()),
            is_key: false,
            is_required: true,
            is_read_only: false,
            is_concurrency_control: false,
            computed: None,
            loc: loc(),
            foreign_key: Some(RelationRef {
                schema_name: "governance".to_string(),
                type_name: "NoSuchEntity".to_string(),
                loc: loc(),
            }),
            nav_by_fk_property: None,
            many_to_many_property: None,
            nested_entity_type: None,
            enum_type_name: None,
        };
        let fk = prop.foreign_key.clone().unwrap();
        v.validate_foreign_key(&entity, &prop, &fk);
        assert!(v
            .issues
            .iter()
            .any(|i| i.code == "missing_foreign_key_target"));
    }

    #[test]
    fn seed_value_type_mismatch_is_an_error() {
        let mut v = validator();
        let prop = PropertyInfo {
            name: "is_active".to_string(),
            data_type: Some("Boolean".to_string()),
            is_key: false,
            is_required: true,
            is_read_only: false,
            is_concurrency_control: false,
            computed: None,
            loc: loc(),
            foreign_key: None,
            nav_by_fk_property: None,
            many_to_many_property: None,
            nested_entity_type: None,
            enum_type_name: None,
        };
        v.validate_seed_value(
            "governance",
            "Comment",
            &prop,
            &Value::String("yes".to_string()),
            &loc(),
        );
        assert!(v.issues.iter().any(|i| i.code == "invalid_seed_value_type"));
    }

    #[test]
    fn unknown_facet_is_an_error() {
        let mut v = validator();
        v.validate_facets_list(&["not_a_real_facet".to_string()], &loc());
        assert!(v.issues.iter().any(|i| i.code == "invalid_facet"));
    }
}
