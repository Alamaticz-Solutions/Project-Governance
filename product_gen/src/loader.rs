//! Stage 1: merge per-entity/relationship/enum YAML files into the
//! consolidated per-schema `_res.yaml` array, resolve name-derived defaults
//! and property fragments, and apply facet expansion.
//!
//! Mirrors the framework's `schema::preprocess` -> `yaml_gen::run` pipeline:
//! read every first-level `*.yaml` file in a subdirectory (sorted by
//! filename -- deliberate, seed files elsewhere in the model use numeric
//! prefixes to encode dependency order and this sort is shared machinery),
//! excluding `_res.yaml` itself, concatenate into one array, then for
//! `entity_types` resolve each raw entity against the `entity_type::print`
//! Tera macro's exact fallback rules before applying facet expansion.
//!
//! **Raw authored YAML is not the resolved shape.** `.appfw/model/**/entity_types/*.yaml`
//! files provide a `name` field (e.g. `name: Project`) and, in most of this
//! product's entities, omit `id`/`pascal_1`/`pascal_n`/`snake_1`/`snake_n`/
//! `caption_1`/`caption_n` entirely -- these are derived from `name` via
//! inflector filters and only become explicit once written to `_res.yaml`.
//! Likewise properties reference a `fragment: <name>` (looked up in
//! `_fragments/*.yaml`) far more often than they specify `data_type`/
//! `is_key`/etc. inline (46 fragment references in this product's own
//! `project.yaml` alone) -- fragment values win over inline values for any
//! attribute the fragment defines, matching `properties/property/_mod.j2`'s
//! `{% if f and f.X %}{{f.X}}{% elif p.X %}{{p.X}}{% else %}default{% endif %}`.
//! This module resolves all of that against raw `serde_json::Value` before
//! deserializing into the strict `EntityType`/`PropertyType` structs.

use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::Path;

use anyhow::{Context, Result};
use inflector::cases::pascalcase::{is_pascal_case, to_pascal_case};
use inflector::cases::snakecase::to_snake_case;
use inflector::cases::tablecase::to_table_case;
use inflector::cases::titlecase::{is_title_case, to_title_case};
use inflector::string::pluralize::to_plural;
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::model::EntityType;

/// Read every first-level `*.yaml` file in `dir` (sorted by filename,
/// `_res.yaml` excluded) and concatenate the YAML arrays they contain.
pub fn merge_dir_as_array(dir: &Path) -> Result<Vec<Value>> {
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut paths: Vec<_> = fs::read_dir(dir)
        .with_context(|| format!("could not read {}", dir.display()))?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| {
            path.extension().and_then(|ext| ext.to_str()) == Some("yaml")
                && path.file_stem().and_then(|s| s.to_str()) != Some("_res")
        })
        .collect();
    paths.sort();

    let mut items = vec![];
    for path in paths {
        let file =
            fs::File::open(&path).with_context(|| format!("could not open {}", path.display()))?;
        let file_items: Vec<Value> = serde_yaml::from_reader(file)
            .with_context(|| format!("{} must be a YAML array", path.display()))?;
        items.extend(file_items);
    }
    Ok(items)
}

/// Load and merge a schema's `entity_types/*.yaml`, resolving name-derived
/// defaults, property fragments, and facet expansion, returning the fully
/// expanded entity list (equivalent to the framework's
/// `entity_types/_res.yaml`, before relationship resolution).
pub fn load_entity_types(
    entity_types_dir: &Path,
    schema_name: &str,
    schema_id: Option<&str>,
    facets_dir: &Path,
    fragments_dir: &Path,
) -> Result<Vec<EntityType>> {
    let merged = merge_dir_as_array(entity_types_dir)?;
    let fragments = load_fragments(fragments_dir)?;
    let audit_entity_type_template = read_facet_object(&facets_dir.join("audit_entity_type.yaml"))?;

    let mut result = vec![];
    for mut raw in merged {
        resolve_entity_json(&mut raw, schema_name, schema_id, &fragments)?;
        let name_for_error = raw
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("<unknown>")
            .to_string();
        let mut entity: EntityType = serde_json::from_value(raw).with_context(|| {
            format!("invalid entity_type `{name_for_error}` in schema `{schema_name}`")
        })?;
        entity.schema_name = schema_name.to_string();

        if let Some(facets) = &entity.facets {
            if facets.iter().any(|f| f == "audited") {
                let audit_entity = build_audit_entity(
                    &audit_entity_type_template,
                    &entity,
                    schema_name,
                    schema_id,
                )?;
                result.push(entity.clone());
                result.push(audit_entity);
                continue;
            }
        }
        result.push(entity);
    }

    for entity in &mut result {
        apply_property_facets(entity, facets_dir)?;
    }

    Ok(result)
}

/// Resolve one raw entity's name-derived defaults (`id`/`pascal_1`/`pascal_n`/
/// `snake_1`/`snake_n`/`caption_1`/`caption_n`, all falling back to a
/// derivation from `name` when absent -- `entity_type::print`'s
/// `{% if t.X %}{{t.X}}{% else %}{{ typeName | X }}{% endif %}` pattern) and
/// every property's fragment merge + derived `id`/`name`/`caption`.
fn resolve_entity_json(
    raw: &mut Value,
    schema_name: &str,
    schema_id: Option<&str>,
    fragments: &std::collections::HashMap<String, Value>,
) -> Result<()> {
    let obj = raw
        .as_object_mut()
        .context("entity_type entry must be a YAML object")?;
    let type_name = obj
        .get("name")
        .and_then(Value::as_str)
        .context("entity_type entry is missing `name`")?
        .to_string();

    obj.entry("id")
        .or_insert_with(|| Value::String(deterministic_uuid(&type_name)));
    obj.entry("pascal_1")
        .or_insert_with(|| Value::String(pascal_1(&type_name)));
    obj.entry("pascal_n")
        .or_insert_with(|| Value::String(pascal_n(&type_name)));
    obj.entry("snake_1")
        .or_insert_with(|| Value::String(snake_1(&type_name)));
    obj.entry("snake_n")
        .or_insert_with(|| Value::String(snake_n(&type_name)));
    obj.entry("caption_1")
        .or_insert_with(|| Value::String(caption_1(&type_name)));
    obj.entry("caption_n")
        .or_insert_with(|| Value::String(caption_n(&type_name)));
    // `schema_name`/`schema_id` are injected by the schema-level template
    // context in the reference generator, never authored per-entity.
    obj.entry("schema_name")
        .or_insert_with(|| Value::String(schema_name.to_string()));
    obj.entry("schema_id").or_insert_with(|| match schema_id {
        Some(id) => Value::String(id.to_string()),
        None => Value::Null,
    });
    obj.entry("is_union").or_insert(Value::Bool(false));
    obj.entry("is_table").or_insert(Value::Bool(false));
    obj.entry("base_type").or_insert(Value::Null);
    obj.entry("facets").or_insert_with(|| Value::Array(vec![]));
    // indexes/constraints default to an empty list, not null, when absent --
    // confirmed against the oracle (`indexes: []`, not `indexes: null`).
    obj.entry("indexes").or_insert_with(|| Value::Array(vec![]));
    obj.entry("constraints")
        .or_insert_with(|| Value::Array(vec![]));
    obj.entry("meta").or_insert(Value::Null);
    obj.entry("execution").or_insert(Value::Null);
    // standard_methods defaults to the full CRUD set when absent, but only
    // for is_table entities -- confirmed against the oracle: every governance
    // (is_table: true) entity gets all 6 methods, while system schema's
    // metadata-only (is_table: false) entities keep `standard_methods: null`.
    let is_table_entity = obj
        .get("is_table")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    obj.entry("standard_methods").or_insert_with(|| {
        if !is_table_entity {
            return Value::Null;
        }
        Value::Array(
            ["FindById", "GetAll", "Query", "Create", "Update", "Delete"]
                .into_iter()
                .map(|m| Value::String(m.to_string()))
                .collect(),
        )
    });
    if let Some(methods) = obj.get_mut("custom_methods").and_then(Value::as_array_mut) {
        for method in methods {
            if let Some(method_obj) = method.as_object_mut() {
                method_obj
                    .entry("mcp_enabled")
                    .or_insert(Value::Bool(false));
                method_obj.entry("provider_routine").or_insert(Value::Null);
            }
        }
    } else {
        obj.entry("custom_methods").or_insert(Value::Null);
    }

    let pascal_1_value = obj
        .get("pascal_1")
        .and_then(Value::as_str)
        .unwrap_or(&type_name)
        .to_string();

    if let Some(props) = obj.get_mut("props").and_then(Value::as_array_mut) {
        for prop in props {
            resolve_property_json(prop, &pascal_1_value, schema_name, fragments)?;
        }
    }

    Ok(())
}

/// Resolve one raw property against its `fragment` (if any) and derive
/// `id`/`name`/`caption` when absent, matching
/// `entity_types/entity_type/properties/property/_mod.j2` exactly:
/// - `id`: `hash_string(entityType.name ~ p.name)` if absent (Tera's `~` is
///   plain string concatenation, no separator).
/// - `name`: always `p.name | snake_1` (normalized even when already snake).
/// - `caption`: `p.caption` if present, else `p.name | caption`.
/// - every other overridable attribute (`is_key`/`is_required`/
///   `is_read_only`/`is_concurrency_control`/`data_type`/`computed`/
///   `default_value`/`meta`/`is_caption`): fragment value wins if the
///   fragment defines it, else the property's own inline value, else a
///   type-appropriate default.
fn resolve_property_json(
    prop: &mut Value,
    entity_pascal_1: &str,
    schema_name: &str,
    fragments: &std::collections::HashMap<String, Value>,
) -> Result<()> {
    let obj = prop
        .as_object_mut()
        .context("property entry must be a YAML object")?;
    let raw_name = obj
        .get("name")
        .and_then(Value::as_str)
        .context("property entry is missing `name`")?
        .to_string();

    let fragment = match obj.get("fragment").and_then(Value::as_str) {
        Some(name) => fragments.get(name).cloned(),
        None => None,
    };
    let fragment_obj = fragment.as_ref().and_then(Value::as_object);

    let id = obj
        .get("id")
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| hash_string(&format!("{entity_pascal_1}{raw_name}")));
    let name = snake_1(&raw_name);
    let caption = obj
        .get("caption")
        .and_then(Value::as_str)
        .map(str::to_string)
        .unwrap_or_else(|| caption_word(&raw_name));

    for field in [
        "is_key",
        "is_required",
        "is_read_only",
        "is_concurrency_control",
        "is_caption",
    ] {
        let value = fragment_obj
            .and_then(|f| f.get(field))
            .filter(|v| v.as_bool() == Some(true))
            .cloned()
            .or_else(|| {
                obj.get(field)
                    .filter(|v| v.as_bool() == Some(true))
                    .cloned()
            })
            .unwrap_or(Value::Bool(false));
        obj.insert(field.to_string(), value);
    }
    for field in ["data_type", "computed"] {
        let default = if field == "data_type" { "None" } else { "None" };
        let value = fragment_obj
            .and_then(|f| f.get(field))
            .cloned()
            .or_else(|| obj.get(field).cloned())
            .unwrap_or_else(|| Value::String(default.to_string()));
        obj.insert(field.to_string(), value);
    }
    let default_value = fragment_obj
        .and_then(|f| f.get("default_value"))
        .cloned()
        .or_else(|| obj.get("default_value").cloned());
    // Absent default_value/meta render as `{}` in the oracle, not `null` --
    // the template's `{% else %}{}{% endif %}` fallback (properties/property/_mod.j2).
    obj.insert(
        "default_value".to_string(),
        default_value.unwrap_or_else(|| Value::Object(serde_json::Map::new())),
    );
    let meta = fragment_obj
        .and_then(|f| f.get("meta"))
        .cloned()
        .or_else(|| obj.get("meta").cloned());
    obj.insert(
        "meta".to_string(),
        meta.unwrap_or_else(|| Value::Object(serde_json::Map::new())),
    );

    obj.insert("id".to_string(), Value::String(id));
    obj.insert("name".to_string(), Value::String(name));
    obj.insert("caption".to_string(), Value::String(caption));
    // Authored `foreign_key`/`nav_by_fk_property`/`nested_entity_type`
    // objects in this product's model only specify `type_name` (and, for
    // nav, `prop_name`), omitting `schema_name`. Per
    // `properties/property/{foreign_key,nav_by_fk_property,nested_entity_type}/_mod.j2`,
    // a missing `schema_name` defaults to the CURRENT schema being rendered
    // -- not empty string. (`relationships.rs`'s `ensure_fk_target` also
    // tolerates an empty schema_name as "same schema as owner" for
    // relationship-declared FKs, but the generic
    // `validate_foreign_key_targets` pass this loader also runs does a
    // literal string match, so an empty string here would wrongly fail
    // same-schema FKs that never went through a relationship.)
    if let Some(fk) = obj.get_mut("foreign_key").and_then(Value::as_object_mut) {
        fk.entry("schema_name")
            .or_insert_with(|| Value::String(schema_name.to_string()));
    }
    obj.entry("foreign_key").or_insert(Value::Null);
    if let Some(nav) = obj
        .get_mut("nav_by_fk_property")
        .and_then(Value::as_object_mut)
    {
        nav.entry("schema_name")
            .or_insert_with(|| Value::String(schema_name.to_string()));
        nav.entry("filter").or_insert(Value::Null);
        nav.entry("resolved").or_insert(Value::Null);
    }
    obj.entry("nav_by_fk_property").or_insert(Value::Null);
    obj.entry("many_to_many_property").or_insert(Value::Null);
    if let Some(nested) = obj
        .get_mut("nested_entity_type")
        .and_then(Value::as_object_mut)
    {
        nested
            .entry("schema_name")
            .or_insert_with(|| Value::String(schema_name.to_string()));
    }
    obj.entry("nested_entity_type").or_insert(Value::Null);
    obj.entry("enum_type_name").or_insert(Value::Null);

    Ok(())
}

fn load_fragments(dir: &Path) -> Result<std::collections::HashMap<String, Value>> {
    let mut fragments = std::collections::HashMap::new();
    load_fragments_into(dir, &mut fragments)?;
    Ok(fragments)
}

fn load_fragments_into(
    dir: &Path,
    out: &mut std::collections::HashMap<String, Value>,
) -> Result<()> {
    if !dir.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(dir).with_context(|| format!("could not read {}", dir.display()))? {
        let path = entry?.path();
        if path.is_dir() {
            load_fragments_into(&path, out)?;
        } else if path.extension().and_then(|e| e.to_str()) == Some("yaml") {
            let stem = path
                .file_stem()
                .and_then(|s| s.to_str())
                .with_context(|| format!("invalid fragment file name {}", path.display()))?
                .to_string();
            let file = fs::File::open(&path)
                .with_context(|| format!("could not open {}", path.display()))?;
            let value: Value = serde_yaml::from_reader(file)
                .with_context(|| format!("could not parse fragment {}", path.display()))?;
            out.insert(stem, value);
        }
    }
    Ok(())
}

fn read_facet_object(path: &Path) -> Result<Value> {
    if !path.exists() {
        return Ok(Value::Null);
    }
    let file =
        fs::File::open(path).with_context(|| format!("could not open {}", path.display()))?;
    let value: Value = serde_yaml::from_reader(file)
        .with_context(|| format!("could not parse {}", path.display()))?;
    Ok(value)
}

/// Build the `{Name}Audit` companion entity from the static
/// `_facets/audit_entity_type.yaml` template, per the framework's
/// `AuditTypeFilter`: rename to `{related_name}Audit`, set
/// `snake_1`/`snake_n`, set `meta.{generatedAuditEntity,sourceEntity}`, and
/// (only if the template's `record_id` prop already has a `foreign_key`
/// object -- this product's template does not) patch its `type_name`.
/// `pascal_1`/`pascal_n`/`caption_1`/`caption_n` are NOT set directly by
/// `AuditTypeFilter` -- they fall through to `entity_type::print`'s generic
/// name-derivation fallback, same as any other entity, just seeded from the
/// new `{Name}Audit` name.
fn build_audit_entity(
    template: &Value,
    source: &EntityType,
    schema_name: &str,
    schema_id: Option<&str>,
) -> Result<EntityType> {
    let mut item = template
        .as_object()
        .cloned()
        .context("_facets/audit_entity_type.yaml must be a YAML object")?;

    let related_name = &source.pascal_1;
    let audit_name = format!("{related_name}Audit");
    item.insert("name".to_string(), Value::String(audit_name.clone()));
    item.insert(
        "snake_n".to_string(),
        Value::String(format!("{}_audit", to_table_case(related_name))),
    );
    item.insert(
        "meta".to_string(),
        serde_json::json!({
            "generatedAuditEntity": true,
            "sourceEntity": related_name,
        }),
    );

    if let Some(props) = item.get_mut("props").and_then(Value::as_array_mut) {
        for prop in props {
            let Some(prop_obj) = prop.as_object_mut() else {
                continue;
            };
            if prop_obj.get("name").and_then(Value::as_str) != Some("record_id") {
                continue;
            }
            if let Some(foreign_key) = prop_obj
                .get_mut("foreign_key")
                .and_then(Value::as_object_mut)
            {
                foreign_key.insert(
                    "type_name".to_string(),
                    Value::String(related_name.to_string()),
                );
            }
        }
    }

    let mut raw = Value::Object(item);
    resolve_entity_json(
        &mut raw,
        schema_name,
        schema_id,
        &std::collections::HashMap::new(),
    )?;
    let mut entity: EntityType = serde_json::from_value(raw)
        .context("synthesized audit entity does not match EntityType shape")?;
    entity.schema_name = schema_name.to_string();
    Ok(entity)
}

/// Apply `"concurrency"` -> `_facets/version_property.yaml` and
/// `"soft-deleted"` -> `_facets/soft_deleted_property.yaml`: append the
/// facet file's content as an additional property. The facet file itself is
/// a raw, unresolved property object (e.g. `name: version`, no `id`) --
/// it goes through the same `resolve_property_json` fallback derivation as
/// any inline property, just with no `fragment` to merge.
fn apply_property_facets(entity: &mut EntityType, facets_dir: &Path) -> Result<()> {
    let Some(facets) = entity.facets.clone() else {
        return Ok(());
    };
    if facets.iter().any(|f| f == "concurrency") {
        entity.props.push(read_facet_property(
            &facets_dir.join("version_property.yaml"),
            &entity.pascal_1,
            &entity.schema_name,
        )?);
    }
    if facets.iter().any(|f| f == "soft-deleted") {
        entity.props.push(read_facet_property(
            &facets_dir.join("soft_deleted_property.yaml"),
            &entity.pascal_1,
            &entity.schema_name,
        )?);
    }
    Ok(())
}

fn read_facet_property(
    path: &Path,
    entity_pascal_1: &str,
    schema_name: &str,
) -> Result<crate::model::PropertyType> {
    let mut value = read_facet_object(path)?;
    resolve_property_json(
        &mut value,
        entity_pascal_1,
        schema_name,
        &std::collections::HashMap::new(),
    )?;
    serde_json::from_value(value)
        .with_context(|| format!("{} does not match PropertyType shape", path.display()))
}

/// Matches the framework's `filters::deterministic_uuid`: SHA-256(seed),
/// truncated to 16 bytes, with RFC 4122 version/variant bits stamped in.
pub fn deterministic_uuid(seed: &str) -> String {
    let digest = Sha256::digest(seed.as_bytes());
    let mut bytes = [0u8; 16];
    bytes.copy_from_slice(&digest[..16]);
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
        bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15],
    )
}

/// Matches the framework's `filters::just_hash` (`hash_string` filter):
/// `DefaultHasher` over the input string, formatted as lowercase hex.
pub fn hash_string(input: &str) -> String {
    let mut hasher = DefaultHasher::new();
    input.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Matches `pascal_1_filter`: use as-is if already PascalCase, else convert.
fn pascal_1(name: &str) -> String {
    if is_pascal_case(name) {
        name.to_string()
    } else {
        to_pascal_case(name)
    }
}

/// Matches `pascal_n_filter`: pascal_1, then pluralize.
fn pascal_n(name: &str) -> String {
    to_plural(&pascal_1(name))
}

/// Matches `snake_1_filter`'s stricter digit-tolerant check falling back to
/// `to_snake_case` -- this crate's authored names are already snake_case, so
/// the stricter check practically always short-circuits; `to_snake_case` is
/// the correct behavior for the one case it doesn't (a PascalCase seed, as
/// used by the audit-entity-name derivation).
fn snake_1(name: &str) -> String {
    if looks_like_snake_case(name) {
        name.to_string()
    } else {
        to_snake_case(name)
    }
}

/// Matches `snake_n_filter`.
fn snake_n(name: &str) -> String {
    if looks_like_snake_case(name) {
        to_plural(name)
    } else {
        to_table_case(name)
    }
}

/// Matches `caption_1_filter`.
fn caption_1(name: &str) -> String {
    caption_word(name)
}

/// Matches `caption_n_filter`: caption_1, then pluralize.
fn caption_n(name: &str) -> String {
    to_plural(&caption_1(name))
}

pub(crate) fn caption_word(name: &str) -> String {
    if is_title_case(name) {
        name.to_string()
    } else {
        to_title_case(name)
    }
}

fn looks_like_snake_case(s: &str) -> bool {
    if s.is_empty() || s.starts_with('_') || s.ends_with('_') || s.contains("__") {
        return false;
    }
    s.chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic_uuid_matches_oracle_value_from_checked_in_res_yaml() {
        // From this product's own .appfw/model/schemas/governance/entity_types/_res.yaml:
        // the ProjectAudit entity (facet-generated, no authored `id`) carries
        // `id: 5f651f50-ea22-5861-ba27-03fb8cce078b`, which the real
        // app_gen computed as `deterministic_uuid("ProjectAudit")`.
        assert_eq!(
            deterministic_uuid("ProjectAudit"),
            "5f651f50-ea22-5861-ba27-03fb8cce078b"
        );
    }

    #[test]
    fn audit_name_derivation_matches_oracle_fields_from_checked_in_res_yaml() {
        assert_eq!(pascal_1("ProjectAudit"), "ProjectAudit");
        assert_eq!(pascal_n("ProjectAudit"), "ProjectAudits");
        assert_eq!(snake_1("ProjectAudit"), "project_audit");
        assert_eq!(
            format!("{}_audit", to_table_case("Project")),
            "projects_audit"
        );
        assert_eq!(caption_1("ProjectAudit"), "Project Audit");
        assert_eq!(caption_n("ProjectAudit"), "Project Audits");
    }
}
