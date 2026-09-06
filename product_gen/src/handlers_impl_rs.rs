//! Slice 5: `backend/src/handlers/{schema}/{entity}.rs` -- the create-once
//! product extension stub. Ported from
//! `_templates/backend/handlers/schema/impl/_mod.j2`.
//!
//! **Create-once, not idempotent regeneration**: the reference `gen_schema_handler_impl_rs`
//! only writes this file if it doesn't already exist (`artifacts::emit_human_text`);
//! once created it's hand-owned and never overwritten. Confirmed against
//! this product: every one of its 41 impl files already exists, and every
//! entity with custom methods (`workflow_stage.rs`, `gate_review.rs`, ...)
//! has been hand-edited far beyond the stub into real business logic --
//! there is no pristine stub left to verify the custom-methods branch
//! against. Only the no-custom-methods path (e.g. `comment.rs`, which is
//! still exactly the pristine stub) is byte-verified here; the
//! custom-methods branch is implemented from the template text for
//! fidelity, not verified against oracle data.
//!
//! This function is dormant for this product today (nothing calls it,
//! since every file already exists) -- it exists for when a new entity is
//! added to the model.

use crate::model::EntityType;

/// Returns `None` when `target_path` already exists (matching the
/// create-once semantics -- the caller should skip writing in that case).
pub fn render_if_missing(
    schema_name: &str,
    entity: &EntityType,
    target_path: &std::path::Path,
) -> Option<String> {
    if target_path.exists() {
        return None;
    }
    Some(render(schema_name, entity))
}

pub fn render(schema_name: &str, entity: &EntityType) -> String {
    let schema_rust_name = snake_1(schema_name);
    let pascal_1 = &entity.pascal_1;
    let mut out = String::new();
    out.push_str(&format!(
        "//\n// Backend {schema_rust_name} {pascal_1} Implementation\n//    Product-owned handler extension file.\n//    Generated once by app_gen, then preserved.\n//\n#[allow(unused_imports)]\npub(crate) use super::generated::{}::*;\n",
        entity.snake_1
    ));

    let Some(methods) = entity.custom_methods.as_ref().filter(|m| !m.is_empty()) else {
        return out;
    };

    out.push_str("#[allow(unused)]\nuse std::sync::Arc;\n\n");
    let query_result = if entity.is_table {
        format!("{pascal_1}QueryResult, ")
    } else {
        String::new()
    };
    out.push_str(&format!(
        "#[allow(unused_imports)]\nuse crate::{{\n    product_api::{{DataAccess, EntityType, HandlerResult, JsonValue, UserAuth}},\n    schemas::common::AggregateResult,\n    schemas::{schema_rust_name}::{{Input{pascal_1}, {pascal_1}Projection, {query_result}}},\n}};\n\n"
    ));
    for method in methods {
        let params: String = method
            .args
            .iter()
            .map(|a| format!("    {}: {},\n", a.name, a.arg_type))
            .collect();
        out.push_str(&format!(
            "pub(crate) async fn {}_impl(\n    user: Option<UserAuth>,\n    data_access: &Arc<DataAccess>,\n    entity_type: &Arc<EntityType>,\n    selections: JsonValue,\n{params}) -> HandlerResult<{}> {{\n    Err(anyhow::anyhow!(\"custom method `{}` is not implemented yet\"))\n}}\n\n",
            method.name, method.return_type, method.name
        ));
    }

    out
}

fn snake_1(name: &str) -> String {
    use inflector::cases::snakecase::to_snake_case;
    to_snake_case(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn model_root() -> std::path::PathBuf {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../.appfw/model")
    }

    fn backend_src_root() -> std::path::PathBuf {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../backend/src")
    }

    fn rustfmt(source: &str) -> String {
        use std::io::Write;
        let mut child = std::process::Command::new("rustfmt")
            .arg("--edition")
            .arg("2021")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .expect("rustfmt must be on PATH");
        child
            .stdin
            .take()
            .unwrap()
            .write_all(source.as_bytes())
            .unwrap();
        let output = child.wait_with_output().unwrap();
        assert!(output.status.success(), "rustfmt failed");
        String::from_utf8(output.stdout).unwrap()
    }

    /// `comment.rs` (no custom methods) is still exactly the pristine
    /// create-once stub -- confirmed by inspection -- so it's a valid
    /// byte-for-byte oracle target, unlike every custom-method entity.
    #[test]
    fn comment_impl_stub_matches_checked_in_oracle_after_rustfmt() {
        let resolved = crate::load_resolved_entities(&model_root()).expect("model should load");
        let entities = resolved
            .iter()
            .find(|(name, _, _)| name == "governance")
            .unwrap()
            .2
            .clone();
        let comment = entities.iter().find(|e| e.pascal_1 == "Comment").unwrap();

        let rendered = rustfmt(&render("governance", comment));
        let oracle =
            std::fs::read_to_string(backend_src_root().join("handlers/governance/comment.rs"))
                .expect("read oracle handlers/governance/comment.rs");

        assert_eq!(rendered, oracle);
    }

    #[test]
    fn render_if_missing_returns_none_for_existing_file() {
        let resolved = crate::load_resolved_entities(&model_root()).expect("model should load");
        let entities = resolved
            .iter()
            .find(|(name, _, _)| name == "governance")
            .unwrap()
            .2
            .clone();
        let comment = entities.iter().find(|e| e.pascal_1 == "Comment").unwrap();

        let existing = backend_src_root().join("handlers/governance/comment.rs");
        assert!(render_if_missing("governance", comment, &existing).is_none());
    }
}
