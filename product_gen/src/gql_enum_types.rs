//! GraphQL enum type loading, shared by slice 5 (backend codegen) and
//! slice 6 (frontend UI contract). Traced against
//! `_templates/types/gql_enum_types/gql_enum_type/_mod.j2`: merge (same
//! `merge_dir_as_array` mechanism as everything else), then default each
//! item's `caption` to `item.value | caption` (title-case) when absent --
//! confirmed against this product's own `approval_decision.yaml` (authors
//! only `value`) vs. the checked-in `_res.yaml` (adds `caption: Approved`
//! etc).

use std::path::Path;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GqlEnumType {
    pub name: String,
    pub items: Vec<GqlEnumItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GqlEnumItem {
    pub value: String,
    pub caption: String,
}

pub fn load(dir: &Path) -> Result<Vec<GqlEnumType>> {
    crate::loader::merge_dir_as_array(dir)?
        .into_iter()
        .map(|mut raw| {
            resolve(&mut raw)?;
            serde_json::from_value(raw).context("invalid gql_enum_type")
        })
        .collect()
}

fn resolve(raw: &mut serde_json::Value) -> Result<()> {
    let obj = raw
        .as_object_mut()
        .context("gql_enum_type entry must be a YAML object")?;
    if let Some(items) = obj.get_mut("items").and_then(|v| v.as_array_mut()) {
        for item in items {
            let Some(item_obj) = item.as_object_mut() else {
                continue;
            };
            let value = item_obj
                .get("value")
                .and_then(|v| v.as_str())
                .context("gql_enum_type item is missing `value`")?
                .to_string();
            item_obj
                .entry("caption")
                .or_insert_with(|| serde_json::Value::String(crate::loader::caption_word(&value)));
        }
    }
    Ok(())
}
