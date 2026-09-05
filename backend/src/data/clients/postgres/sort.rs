//! `ORDER BY` clause rendering for paginated and aggregate queries.
//!
//! Product-owned (backend framework replacement phase 3c --
//! docs/architecture/self-owned-backend-plan.md). Previously
//! `appfw_provider_postgres::sort`.
//!
//! This module's `PostgresSortField` is a distinct type from the framework's
//! (not a type alias), so it is only safe to use where sort fields are built
//! and consumed within the same file. `cte.rs`'s own sort-field handling
//! (still framework-owned pending phase 3d) never receives values of this
//! type, and this module never receives values of the framework's -- the two
//! are independent until `cte.rs` migrates.

use appfw_runtime::query_ir::RuntimeSortDirection;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PostgresSortField {
    pub name: String,
    pub direction: RuntimeSortDirection,
}

pub fn aggregate_order_by(fields: &[PostgresSortField]) -> String {
    if fields.is_empty() {
        return String::new();
    }

    let parts = fields
        .iter()
        .map(|field| {
            format!(
                "{} {}",
                quote_ident(&field.name),
                field.direction.as_str().to_uppercase()
            )
        })
        .collect::<Vec<_>>();
    format!("ORDER BY {}", parts.join(", "))
}

fn quote_ident(name: &str) -> String {
    format!("\"{}\"", name.replace('"', "\"\""))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_aggregate_ordering() {
        let fields = vec![PostgresSortField {
            name: "total\"age".to_string(),
            direction: RuntimeSortDirection::Desc,
        }];
        assert_eq!(aggregate_order_by(&[]), "");
        assert_eq!(
            aggregate_order_by(&fields),
            "ORDER BY \"total\"\"age\" DESC"
        );
    }
}
