//! Product-owned model loader + normalizer -- phase 6 slice 1 of
//! `docs/architecture/self-owned-backend-plan.md`. Replaces the App
//! Framework's `app_gen` model-loading pipeline (`schema::preprocess` ->
//! `type_relationships::run` -> `normalized_config::build`) with an
//! independent implementation over the same `.appfw/model/**` input.
//!
//! No emission yet (that's slices 2-6); this crate only builds the in-memory
//! `GeneratorIr`.

pub mod boundary_check;
pub mod ddl;
pub mod entity_types_yaml;
pub mod feature_check;
pub mod frontend_contract;
pub mod generate;
pub mod gql_enum_types;
pub mod handlers_generated_rs;
pub mod handlers_impl_rs;
pub mod handlers_mod_rs;
pub mod ir;
pub mod loader;
pub mod model;
pub mod policy;
pub mod rego;
pub mod relationship_model;
pub mod relationships;
pub mod routes_rs;
pub mod schemas_rs;
pub mod top_level_mod_rs;
pub mod validate;

use std::collections::HashMap;
use std::fs;
use std::path::Path;

use anyhow::{Context, Result};

use model::EntityType;
use relationship_model::RelationshipConfig;

/// Per-schema data gathered directly from the filesystem (not yet merged
/// with resolved entities) -- `_res.yaml`'s `data_source_name` (its `id` is
/// consumed immediately by `loader::load_entity_types`, not needed after)
/// and the schema's own `relationships/*.yaml`.
struct SchemaFsMeta {
    data_source_name: Option<String>,
    relationships: Vec<RelationshipConfig>,
}

/// Stages 1+2 only: merge/resolve every schema's entity types (name-derived
/// defaults, fragment resolution, facet expansion, relationship-driven
/// nav/M2M synthesis) without flattening into the final IR. `model_root` is
/// `.appfw/model`. Returns `(schema_name, is_system_schema, entities)` per
/// schema, in schema-name order. This is the shape slice 3's DDL generator
/// needs -- it operates on `EntityType`/`PropertyType` directly, the same as
/// the framework's own `ddl_plan.rs`, not on the flattened `NormalizedEntity`.
pub fn load_resolved_entities(model_root: &Path) -> Result<Vec<(String, bool, Vec<EntityType>)>> {
    Ok(load_resolved_entities_with_meta(model_root)?
        .into_iter()
        .map(|(name, is_system, entities, _meta)| (name, is_system, entities))
        .collect())
}

fn load_resolved_entities_with_meta(
    model_root: &Path,
) -> Result<Vec<(String, bool, Vec<EntityType>, SchemaFsMeta)>> {
    let schemas_dir = model_root.join("schemas");
    let facets_dir = model_root.join("_facets");
    let fragments_dir = model_root.join("_fragments");

    let mut schema_names: Vec<(String, bool)> = vec![];
    let mut all_entities: Vec<EntityType> = vec![];
    let mut schema_relationships: Vec<(String, Vec<RelationshipConfig>)> = vec![];
    let mut fs_meta: HashMap<String, SchemaFsMeta> = HashMap::new();

    let mut dir_names: Vec<String> = fs::read_dir(&schemas_dir)
        .with_context(|| format!("could not read {}", schemas_dir.display()))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| entry.file_name().to_str().map(str::to_string))
        .collect();
    dir_names.sort();

    for schema_name in dir_names {
        let schema_dir = schemas_dir.join(&schema_name);
        let entity_types_dir = schema_dir.join("entity_types");
        let relationships_dir = schema_dir.join("relationships");
        let schema_res_file = schema_dir.join("_res.yaml");
        let schema_id = read_schema_field(&schema_res_file, "id")?;
        let data_source_name = read_schema_field(&schema_res_file, "data_source_name")?;

        let entities = loader::load_entity_types(
            &entity_types_dir,
            &schema_name,
            schema_id.as_deref(),
            &facets_dir,
            &fragments_dir,
        )?;
        all_entities.extend(entities);

        let relationships = load_relationships(&relationships_dir)?;
        schema_relationships.push((schema_name.clone(), relationships.clone()));
        fs_meta.insert(
            schema_name.clone(),
            SchemaFsMeta {
                data_source_name,
                relationships,
            },
        );

        schema_names.push((schema_name.clone(), schema_name == "system"));
    }

    let resolved = relationships::resolve(all_entities, &schema_relationships)?;
    Ok(schema_names
        .into_iter()
        .map(|(name, is_system)| {
            let entities = resolved
                .iter()
                .filter(|e| e.schema_name == name)
                .cloned()
                .collect();
            let meta = fs_meta.remove(&name).expect("schema meta collected above");
            (name, is_system, entities, meta)
        })
        .collect())
}

/// Load every schema under `model_root/schemas/*` and build the full
/// `GeneratorIr`. `model_root` is `.appfw/model`.
pub fn load_model(model_root: &Path) -> Result<ir::GeneratorIr> {
    let resolved = load_resolved_entities_with_meta(model_root)?;
    let data_source_types = read_data_source_types(&model_root.join("data_sources/_res.yaml"))?;

    let schema_meta: Vec<ir::SchemaMeta> = resolved
        .iter()
        .map(|(name, is_system, _, meta)| {
            let data_source_name = meta.data_source_name.clone().unwrap_or_default();
            let data_source_type = data_source_types
                .get(&data_source_name)
                .cloned()
                .unwrap_or_default();
            ir::SchemaMeta {
                name: name.clone(),
                is_system_schema: *is_system,
                data_source_name,
                data_source_type,
                relationships: meta.relationships.clone(),
            }
        })
        .collect();
    let all_entities: Vec<EntityType> = resolved
        .into_iter()
        .flat_map(|(_, _, entities, _)| entities)
        .collect();
    Ok(ir::build(&schema_meta, &all_entities))
}

/// Read a single top-level string field from the schema's own `_res.yaml`.
/// Unlike `entity_types/relationships/_res.yaml` (generated by merging
/// per-item files), the schema-level `_res.yaml` -- `files::get_schema_file`
/// in the reference implementation -- is read directly as the schema's
/// config source itself; there is no separate hand-authored file to merge
/// it from in this product's model.
fn read_schema_field(schema_res_file: &Path, field: &str) -> Result<Option<String>> {
    if !schema_res_file.exists() {
        return Ok(None);
    }
    let file = fs::File::open(schema_res_file)
        .with_context(|| format!("could not open {}", schema_res_file.display()))?;
    let value: serde_json::Value = serde_yaml::from_reader(file)
        .with_context(|| format!("could not parse {}", schema_res_file.display()))?;
    Ok(value
        .get(field)
        .and_then(|v| v.as_str())
        .map(str::to_string))
}

/// Read `.appfw/model/data_sources/_res.yaml` -- a single hand-authored file
/// (not a merge target, same status as the schema-level `_res.yaml`) listing
/// every data source by name with its `data_source_type`. Returns a
/// name -> type map.
fn read_data_source_types(data_sources_res_file: &Path) -> Result<HashMap<String, String>> {
    if !data_sources_res_file.exists() {
        return Ok(HashMap::new());
    }
    let file = fs::File::open(data_sources_res_file)
        .with_context(|| format!("could not open {}", data_sources_res_file.display()))?;
    let value: serde_json::Value = serde_yaml::from_reader(file)
        .with_context(|| format!("could not parse {}", data_sources_res_file.display()))?;
    let entries = value.as_array().cloned().unwrap_or_default();
    Ok(entries
        .into_iter()
        .filter_map(|entry| {
            let name = entry.get("name")?.as_str()?.to_string();
            let data_source_type = entry.get("data_source_type")?.as_str()?.to_string();
            Some((name, data_source_type))
        })
        .collect())
}

fn load_relationships(relationships_dir: &Path) -> Result<Vec<RelationshipConfig>> {
    loader::merge_dir_as_array(relationships_dir)?
        .into_iter()
        .map(|value| serde_json::from_value(value).context("invalid relationship config"))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn product_model_root() -> std::path::PathBuf {
        // product_gen/ -> repo root -> .appfw/model
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../.appfw/model")
    }

    #[test]
    fn loads_governance_and_system_schemas_matching_known_entity_inventory() {
        let ir = load_model(&product_model_root()).expect("model should load");

        let schema_names: Vec<&str> = ir.schemas.iter().map(|s| s.name.as_str()).collect();
        assert_eq!(schema_names, vec!["governance", "system"]);

        let governance = ir.schemas.iter().find(|s| s.name == "governance").unwrap();
        assert!(!governance.is_system_schema);
        // 24 base governance entity types (phase-6 entity inventory finding)
        // + 1 for `GraphWriteAttempt` (M10 / G1.6 idempotency+evidence ledger)
        // = 25, plus one `*Audit` companion per "audited"-faceted entity.
        let audited_count = governance
            .entities
            .iter()
            .filter(|e| e.facets.iter().any(|f| f == "audited"))
            .count();
        assert_eq!(governance.entities.len(), 25 + audited_count);

        let system = ir.schemas.iter().find(|s| s.name == "system").unwrap();
        assert!(system.is_system_schema);
    }

    #[test]
    fn entity_names_match_checked_in_oracle_res_yaml() {
        let ir = load_model(&product_model_root()).expect("model should load");
        let governance = ir.schemas.iter().find(|s| s.name == "governance").unwrap();
        let mut names: Vec<&str> = governance
            .entities
            .iter()
            .map(|e| e.name.as_str())
            .collect();
        names.sort();

        // Extracted from .appfw/model/schemas/governance/entity_types/_res.yaml
        // (`grep 'pascal_1:'`) -- the real app_gen's last successful output,
        // checked into this repo. This is the oracle: if this loader ever
        // diverges from the reference generator's entity set, this is where
        // it will show up.
        let mut expected = vec![
            "Attachment",
            "AttachmentAudit",
            "AuditEvent",
            "ChecklistItem",
            "ChecklistItemAudit",
            "Comment",
            "CommentAudit",
            "EmailQueueItem",
            "GateReview",
            "GateReviewAudit",
            "GateSubmission",
            "GateSubmissionAudit",
            "GraphSubscription",
            "GraphWriteAttempt",
            "KnowledgeChunk",
            "KnowledgeDocument",
            "Meeting",
            "MeetingAudit",
            "Notification",
            "Project",
            "ProjectAudit",
            "ProjectApproval",
            "ProjectApprovalAudit",
            "ProjectField",
            "ProjectFieldAudit",
            "ProjectStakeholder",
            "ProjectStakeholderAudit",
            "RiskItem",
            "RiskItemAudit",
            "TaskAssignment",
            "TaskAssignmentAudit",
            "User",
            "UserAudit",
            "WorkflowDefinition",
            "WorkflowInstance",
            "WorkflowInstanceAudit",
            "WorkflowStage",
            "WorkflowStageAudit",
            "WorkflowStageDefinition",
            "WorkflowStageDefinitionAudit",
            "WorkflowTask",
            "WorkflowTaskAudit",
        ];
        expected.sort();
        assert_eq!(names, expected);
    }

    #[test]
    fn attachment_project_id_property_matches_oracle_res_yaml() {
        let ir = load_model(&product_model_root()).expect("model should load");
        let governance = ir.schemas.iter().find(|s| s.name == "governance").unwrap();
        let attachment = governance
            .entities
            .iter()
            .find(|e| e.name == "Attachment")
            .expect("Attachment entity");
        // A property carrying a `foreign_key` is classified as a
        // relationship_property, not a native_property -- `normalize_relation`
        // returns Some for it, matching the framework's own partition rule.
        let project_id = attachment
            .relationship_properties
            .iter()
            .find(|p| p.name == "project_id")
            .expect("project_id property");

        // From .appfw/model/schemas/governance/entity_types/_res.yaml: fragment
        // resolution (data_type/is_required from inline values, since this
        // property has no `fragment:`) plus derived caption.
        assert_eq!(project_id.data_type, "Uuid");
        assert!(project_id.is_required);
        assert!(!project_id.is_read_only);
        assert_eq!(project_id.caption, "Project Id");

        let relation = project_id
            .relation
            .as_ref()
            .expect("project_id should carry a foreign_key relation");
        assert_eq!(relation.kind, "foreign_key");
        assert_eq!(relation.type_name.as_deref(), Some("Project"));
        // schema_name defaults to the owning entity's own schema when the
        // authored `foreign_key: {type_name: Project}` omits it.
        assert_eq!(relation.schema_name.as_deref(), Some("governance"));
    }

    #[test]
    fn project_entity_has_relationship_properties_resolved() {
        let ir = load_model(&product_model_root()).expect("model should load");
        let governance = ir.schemas.iter().find(|s| s.name == "governance").unwrap();
        let project = governance
            .entities
            .iter()
            .find(|e| e.name == "Project")
            .expect("Project entity");
        // Project carries relationships/01-identity-project.yaml-derived nav
        // properties (manager, stakeholders, etc.) -- confirm at least one
        // resolved relationship property exists, proving stage 2 ran.
        assert!(
            !project.relationship_properties.is_empty(),
            "Project should have at least one relationship-derived property"
        );
    }
}
