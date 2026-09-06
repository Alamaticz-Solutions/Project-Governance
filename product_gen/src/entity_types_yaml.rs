//! Slice 4: `entity_types.yaml` emission.
//!
//! Traced (not assumed): the framework's `config_contract.rs` (1,843 lines)
//! is unrelated to this file -- it's a static, hand-coded documentation
//! generator that writes `config_contract.{json,md}` and
//! `.appfw/model/_specs/CONFIG_CONTRACT.md` (a fixed schema reference, not
//! derived from any particular model). The actual
//! `backend/config/generated/schemas/*/entity_types.yaml` -- confirmed
//! runtime-consumed by `backend/src/config/loader.rs` -- comes from
//! `schema::publish_entity_types`, which is a **plain file copy** of the
//! already-resolved `entity_types/_res.yaml`. There is no separate
//! serialization logic to port: this is just `serde_yaml::to_string` of the
//! relationship-resolved `Vec<EntityType>`, since `model::EntityType`'s
//! field order already matches the checked-in oracle's key order exactly
//! (verified below).

use crate::model::EntityType;

/// Serialize one schema's relationship-resolved entities to the exact YAML
/// shape `backend/config/generated/schemas/<schema>/entity_types.yaml`
/// checks in.
pub fn render(entities: &[EntityType]) -> Result<String, serde_yaml::Error> {
    serde_yaml::to_string(entities)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn model_root() -> std::path::PathBuf {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../.appfw/model")
    }

    fn backend_config_root() -> std::path::PathBuf {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../backend/config/generated/schemas")
    }

    fn resolved_entities(schema: &str) -> Vec<EntityType> {
        crate::load_resolved_entities(&model_root())
            .expect("model should load")
            .into_iter()
            .find(|(name, _, _)| name == schema)
            .unwrap_or_else(|| panic!("schema {schema} not found"))
            .2
    }

    #[test]
    fn governance_entity_types_yaml_matches_checked_in_oracle() {
        let entities = resolved_entities("governance");
        let rendered = render(&entities).expect("should render");
        let oracle =
            std::fs::read_to_string(backend_config_root().join("governance/entity_types.yaml"))
                .expect("read oracle entity_types.yaml");
        assert_eq!(rendered, oracle);
    }

    #[test]
    fn system_entity_types_yaml_matches_checked_in_oracle() {
        let entities = resolved_entities("system");
        let rendered = render(&entities).expect("should render");
        let oracle =
            std::fs::read_to_string(backend_config_root().join("system/entity_types.yaml"))
                .expect("read oracle entity_types.yaml");
        assert_eq!(rendered, oracle);
    }
}
