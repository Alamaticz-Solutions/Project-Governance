//! Product-owned model loader + normalizer -- phase 6 slice 1 of
//! `docs/architecture/self-owned-backend-plan.md`. Replaces the App
//! Framework's `app_gen` model-loading pipeline (`schema::preprocess` ->
//! `type_relationships::run` -> `normalized_config::build`) with an
//! independent implementation over the same `.appfw/model/**` input.
//!
//! No emission yet (that's slices 2-6); this crate only builds the in-memory
//! `GeneratorIr`.

pub mod ddl;
pub mod ir;
pub mod loader;
pub mod model;
pub mod rego;
pub mod relationship_model;
pub mod relationships;

use std::fs;
use std::path::Path;

use anyhow::{Context, Result};

use model::EntityType;
use relationship_model::RelationshipConfig;

/// Stages 1+2 only: merge/resolve every schema's entity types (name-derived
/// defaults, fragment resolution, facet expansion, relationship-driven
/// nav/M2M synthesis) without flattening into the final IR. `model_root` is
/// `.appfw/model`. Returns `(schema_name, is_system_schema, entities)` per
/// schema, in schema-name order. This is the shape slice 3's DDL generator
/// needs -- it operates on `EntityType`/`PropertyType` directly, the same as
/// the framework's own `ddl_plan.rs`, not on the flattened `NormalizedEntity`.
pub fn load_resolved_entities(model_root: &Path) -> Result<Vec<(String, bool, Vec<EntityType>)>> {
    let schemas_dir = model_root.join("schemas");
    let facets_dir = model_root.join("_facets");
    let fragments_dir = model_root.join("_fragments");

    let mut schema_names: Vec<(String, bool)> = vec![];
    let mut all_entities: Vec<EntityType> = vec![];
    let mut schema_relationships: Vec<(String, Vec<RelationshipConfig>)> = vec![];

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

        let entities = loader::load_entity_types(
            &entity_types_dir,
            &schema_name,
            &facets_dir,
            &fragments_dir,
        )?;
        all_entities.extend(entities);

        let relationships = load_relationships(&relationships_dir)?;
        schema_relationships.push((schema_name.clone(), relationships));

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
            (name, is_system, entities)
        })
        .collect())
}

/// Load every schema under `model_root/schemas/*` and build the full
/// `GeneratorIr`. `model_root` is `.appfw/model`.
pub fn load_model(model_root: &Path) -> Result<ir::GeneratorIr> {
    let resolved = load_resolved_entities(model_root)?;
    let schema_names: Vec<(String, bool)> = resolved
        .iter()
        .map(|(name, is_system, _)| (name.clone(), *is_system))
        .collect();
    let all_entities: Vec<EntityType> = resolved
        .into_iter()
        .flat_map(|(_, _, entities)| entities)
        .collect();
    Ok(ir::build(&schema_names, &all_entities))
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
        // plus one `*Audit` companion per "audited"-faceted entity.
        let audited_count = governance
            .entities
            .iter()
            .filter(|e| e.facets.iter().any(|f| f == "audited"))
            .count();
        assert_eq!(governance.entities.len(), 24 + audited_count);

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
