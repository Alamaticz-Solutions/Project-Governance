//! `ORDER BY` clause rendering for paginated and aggregate queries.
//!
//! Product-owned (backend framework replacement phases 3c/3d --
//! docs/architecture/self-owned-backend-plan.md). Previously
//! `appfw_provider_postgres::sort`.

use crate::data::query_ir::SortDirection;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PostgresSortField {
    pub name: String,
    pub direction: SortDirection,
}

/// `ORDER BY` for a paginated CTE query, falling back to the primary key
/// ascending when no sort fields were resolved (stable pagination needs a
/// deterministic order).
pub fn order_by(alias: &str, primary_key: &str, fields: &[PostgresSortField]) -> String {
    if fields.is_empty() {
        return format!("order by {alias}.{primary_key} asc");
    }

    let parts = fields
        .iter()
        .map(|field| format!("{}.{} {}", alias, field.name, field.direction.as_str()))
        .collect::<Vec<_>>();
    format!("order by {}", parts.join(", "))
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
    fn defaults_to_primary_key_ordering() {
        assert_eq!(order_by("t0", "id", &[]), "order by t0.id asc");
    }

    #[test]
    fn renders_resolved_fields() {
        let fields = vec![
            PostgresSortField {
                name: "name".to_string(),
                direction: SortDirection::Desc,
            },
            PostgresSortField {
                name: "age".to_string(),
                direction: SortDirection::Asc,
            },
        ];
        assert_eq!(
            order_by("t0", "id", &fields),
            "order by t0.name desc, t0.age asc"
        );
    }

    #[test]
    fn renders_aggregate_ordering() {
        let fields = vec![PostgresSortField {
            name: "total\"age".to_string(),
            direction: SortDirection::Desc,
        }];
        assert_eq!(aggregate_order_by(&[]), "");
        assert_eq!(
            aggregate_order_by(&fields),
            "ORDER BY \"total\"\"age\" DESC"
        );
    }
}
