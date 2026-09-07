//! Slice 3: Postgres SQL DDL + seed generation. Postgres only, per Option B
//! -- no MSSQL/Snowflake branches (dropped; the framework's `ddl_plan.rs`
//! carries all three, this only ports the Postgres arm of each `match`).
//!
//! Ported from the framework's `ddl_plan.rs` (1,027 lines, Postgres/MSSQL/
//! Snowflake) + `database.rs`'s `SqlDialect::postgres()` dispatch +
//! `_templates/database/postgresql/{create_tables_sql,seed_sql}/_mod.j2`.
//! Verified byte-for-byte against this product's checked-in
//! `database/_pkg/schemas/**/{tables.pg.sql,seed.pg.sql}`.

use std::path::Path;

use anyhow::{Context, Result};

use crate::model::{DataType, EntityType, PropertyType};

const RECORD_LOCATOR_FIELD: &str = "record_locator";

pub struct DdlPlan {
    pub sequences: Vec<SequencePlan>,
    pub tables: Vec<TablePlan>,
    pub audit_tables: Vec<AuditTablePlan>,
    pub indexes: Vec<IndexPlan>,
    pub foreign_keys: Vec<ForeignKeyPlan>,
    pub constraints: Vec<ConstraintPlan>,
    pub junction_tables: Vec<JunctionTablePlan>,
}

pub struct SequencePlan {
    pub schema_name: String,
    pub name: String,
}

pub struct TablePlan {
    pub schema_name: String,
    pub name: String,
    pub columns: Vec<ColumnPlan>,
    /// Native columns minus primary keys (a key column is set once at
    /// CREATE time via its own DEFAULT/sequence and never needs an
    /// idempotent ADD COLUMN on an existing table) -- matches the
    /// framework's `table_plan`'s `alter_columns` filter.
    pub alter_columns: Vec<ColumnPlan>,
}

#[derive(Clone)]
pub struct ColumnPlan {
    pub name: String,
    pub create_definition: String,
    pub alter_definition: String,
}

pub struct AuditTablePlan {
    pub schema_name: String,
    pub name: String,
    pub columns: Vec<RawColumnPlan>,
    pub migration_columns: Vec<DefaultColumnPlan>,
    pub indexes: Vec<IndexPlan>,
}

pub struct RawColumnPlan {
    pub name: &'static str,
    pub create_definition: String,
}

pub struct DefaultColumnPlan {
    pub name: &'static str,
    pub default_literal: String,
}

#[derive(Clone)]
pub struct IndexPlan {
    pub name: String,
    pub schema_name: String,
    pub table_name: String,
    pub column_list: String,
    pub unique: bool,
}

pub struct ForeignKeyPlan {
    pub name: String,
    pub source_schema: String,
    pub source_table: String,
    pub source_column: String,
    pub target_schema: String,
    pub target_table: String,
}

pub struct ConstraintPlan {
    pub name: String,
    pub schema_name: String,
    pub table_name: String,
    pub definition: String,
}

pub struct JunctionTablePlan {
    pub schema_name: String,
    pub table_name: String,
    pub raw_table_name: String,
    pub source_schema: String,
    pub source_table: String,
    pub source_entity_name: String,
    pub target_schema: String,
    pub target_table: String,
    pub target_entity_name: String,
    pub local_key: String,
    pub foreign_key: String,
}

/// `entity_types` must be relationship-resolved (output of
/// `crate::relationships::resolve`), one schema's worth.
pub fn build(entity_types: &[EntityType]) -> DdlPlan {
    let table_entities: Vec<&EntityType> = entity_types
        .iter()
        .filter(|e| e.is_table)
        .filter(|e| !is_generated_audit_entity(e))
        .collect();

    DdlPlan {
        sequences: sequences(&table_entities),
        tables: table_entities.iter().map(|e| table_plan(e)).collect(),
        audit_tables: table_entities
            .iter()
            .filter(|e| has_facet(e, "audited"))
            .map(|e| audit_table_plan(e))
            .collect(),
        indexes: table_entities
            .iter()
            .flat_map(|e| table_indexes(e))
            .collect(),
        foreign_keys: table_entities
            .iter()
            .flat_map(|e| foreign_keys(e))
            .collect(),
        constraints: table_entities.iter().flat_map(|e| constraints(e)).collect(),
        junction_tables: dedupe_junction_tables(
            table_entities
                .iter()
                .flat_map(|e| junction_tables(e))
                .collect(),
        ),
    }
}

fn is_generated_audit_entity(entity_type: &EntityType) -> bool {
    entity_type
        .meta
        .as_ref()
        .and_then(|meta| meta.get("generatedAuditEntity"))
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false)
}

fn has_facet(entity_type: &EntityType, facet: &str) -> bool {
    entity_type
        .facets
        .as_ref()
        .map(|facets| facets.iter().any(|f| f == facet))
        .unwrap_or(false)
}

fn is_native_data_type(data_type: DataType) -> bool {
    !matches!(
        data_type,
        DataType::NavToOne | DataType::NavToMany | DataType::ManyToMany
    )
}

fn is_integer_type(data_type: DataType) -> bool {
    matches!(
        data_type,
        DataType::Int8 | DataType::Int16 | DataType::Int32 | DataType::Int64
    )
}

fn sequences(entity_types: &[&EntityType]) -> Vec<SequencePlan> {
    entity_types
        .iter()
        .filter(|e| {
            e.props
                .iter()
                .any(|p| p.is_key && is_integer_type(p.data_type))
        })
        .map(|e| SequencePlan {
            schema_name: e.schema_name.clone(),
            name: format!("{}_seq", e.snake_n),
        })
        .collect()
}

fn table_plan(entity_type: &EntityType) -> TablePlan {
    let mut columns: Vec<ColumnPlan> = entity_type
        .props
        .iter()
        .filter(|p| is_native_data_type(p.data_type))
        .map(|p| column_plan(entity_type, p))
        .collect();
    columns.push(record_locator_column_plan());

    let alter_columns: Vec<ColumnPlan> = columns
        .iter()
        .filter(|column| {
            if column.name == RECORD_LOCATOR_FIELD {
                return true;
            }
            entity_type
                .props
                .iter()
                .find(|p| p.name == column.name)
                .map(|p| !p.is_key)
                .unwrap_or(false)
        })
        .cloned()
        .collect();

    TablePlan {
        schema_name: entity_type.schema_name.clone(),
        name: entity_type.snake_n.clone(),
        columns,
        alter_columns,
    }
}

fn column_plan(entity_type: &EntityType, prop: &PropertyType) -> ColumnPlan {
    let sql_type = data_type(prop.data_type);
    let clause = if prop.is_key {
        primary_key_clause(entity_type, prop)
    } else if prop.is_concurrency_control {
        " NOT NULL DEFAULT 0".to_string()
    } else {
        String::new()
    };
    let column_name = quote_ident(&prop.name);
    let definition = format!("{column_name} {sql_type}{clause}");
    ColumnPlan {
        name: prop.name.clone(),
        create_definition: definition.clone(),
        alter_definition: definition,
    }
}

fn record_locator_column_plan() -> ColumnPlan {
    let column_name = quote_ident(RECORD_LOCATOR_FIELD);
    let sql_type = data_type(DataType::String);
    let definition = format!(
        "{column_name} {sql_type} NOT NULL DEFAULT ('rl_' || replace(gen_random_uuid()::text, '-', ''))"
    );
    ColumnPlan {
        name: RECORD_LOCATOR_FIELD.to_string(),
        create_definition: definition.clone(),
        alter_definition: definition,
    }
}

fn primary_key_clause(entity_type: &EntityType, prop: &PropertyType) -> String {
    if is_integer_type(prop.data_type) {
        format!(
            " NOT NULL DEFAULT nextval('{}.{}_seq') PRIMARY KEY",
            entity_type.schema_name, entity_type.snake_n
        )
    } else {
        " NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY".to_string()
    }
}

fn audit_table_plan(entity_type: &EntityType) -> AuditTablePlan {
    let audit_table_name = format!("{}_audit", entity_type.snake_n);
    let columns = audit_columns();
    let migration_columns = vec![
        DefaultColumnPlan {
            name: "schema_name",
            default_literal: string_literal(&entity_type.schema_name),
        },
        DefaultColumnPlan {
            name: "entity_name",
            default_literal: string_literal(&entity_type.pascal_1),
        },
        DefaultColumnPlan {
            name: "table_name",
            default_literal: string_literal(&entity_type.snake_n),
        },
        DefaultColumnPlan {
            name: "audit_table_name",
            default_literal: string_literal(&audit_table_name),
        },
    ];
    let indexes = vec![
        index_plan(
            &entity_type.schema_name,
            &audit_table_name,
            format!("idx_{}_audit_record", entity_type.snake_n),
            vec!["record_id".into(), "occurred_at".into()],
            false,
        ),
        index_plan(
            &entity_type.schema_name,
            &audit_table_name,
            format!("idx_{}_audit_actor", entity_type.snake_n),
            vec!["actor_user_name".into(), "occurred_at".into()],
            false,
        ),
        index_plan(
            &entity_type.schema_name,
            &audit_table_name,
            format!("idx_{}_audit_chain", entity_type.snake_n),
            vec!["chain_scope".into(), "occurred_at".into()],
            false,
        ),
        index_plan(
            &entity_type.schema_name,
            &audit_table_name,
            format!("idx_{}_audit_event_hash", entity_type.snake_n),
            vec!["event_hash".into()],
            true,
        ),
    ];

    AuditTablePlan {
        schema_name: entity_type.schema_name.clone(),
        name: audit_table_name,
        columns,
        migration_columns,
        indexes,
    }
}

fn audit_columns() -> Vec<RawColumnPlan> {
    let text = "varchar";
    let json = "jsonb";
    let timestamp = "timestamptz";
    vec![
        raw_col("audit_id", format!("{text} NOT NULL PRIMARY KEY")),
        raw_col("occurred_at", format!("{timestamp} NOT NULL")),
        // tenant_id/record_id use the framework's `audit_nullable_text_type`,
        // which for Postgres is plain "varchar" -- unlike before_json/after_json/
        // policy_json/signature below, which use the provider-agnostic
        // `nullable()` helper that always appends " NULL" regardless of
        // provider. Both exist in the reference implementation; reproduced
        // exactly rather than "fixed" for consistency.
        raw_col("tenant_id", text.to_string()),
        raw_col("actor_user_name", format!("{text} NOT NULL")),
        raw_col("actor_roles", format!("{json} NOT NULL")),
        raw_col("action", format!("{text} NOT NULL")),
        raw_col("outcome", format!("{text} NOT NULL")),
        raw_col("schema_name", format!("{text} NOT NULL")),
        raw_col("entity_name", format!("{text} NOT NULL")),
        raw_col("table_name", format!("{text} NOT NULL")),
        raw_col("audit_table_name", format!("{text} NOT NULL")),
        raw_col("record_id", text.to_string()),
        raw_col("before_json", format!("{json} NULL")),
        raw_col("after_json", format!("{json} NULL")),
        raw_col("diff_json", format!("{json} NOT NULL")),
        raw_col("policy_json", format!("{json} NULL")),
        raw_col("redactions_json", format!("{json} NOT NULL")),
        raw_col("chain_scope", format!("{text} NOT NULL")),
        raw_col("prev_hash", text.to_string()),
        raw_col("event_hash", format!("{text} NOT NULL")),
        raw_col("signature", format!("{text} NULL")),
    ]
}

fn raw_col(name: &'static str, definition: String) -> RawColumnPlan {
    RawColumnPlan {
        name,
        create_definition: definition,
    }
}

fn table_indexes(entity_type: &EntityType) -> Vec<IndexPlan> {
    let mut indexes = vec![index_plan(
        &entity_type.schema_name,
        &entity_type.snake_n,
        format!("ux_{}_{}", entity_type.snake_n, RECORD_LOCATOR_FIELD),
        vec![RECORD_LOCATOR_FIELD.to_string()],
        true,
    )];
    if let Some(columns) = &entity_type.indexes {
        if !columns.is_empty() {
            indexes.push(index_plan(
                &entity_type.schema_name,
                &entity_type.snake_n,
                format!("idx_{}_{}", entity_type.snake_n, columns.join("_")),
                columns.clone(),
                false,
            ));
        }
    }
    indexes.extend(
        entity_type
            .props
            .iter()
            .filter(|p| p.foreign_key.is_some())
            .map(|p| {
                index_plan(
                    &entity_type.schema_name,
                    &entity_type.snake_n,
                    format!("idx_{}_{}", entity_type.snake_n, p.name),
                    vec![p.name.clone()],
                    false,
                )
            }),
    );
    indexes
}

fn index_plan(
    schema_name: &str,
    table_name: &str,
    name: String,
    columns: Vec<String>,
    unique: bool,
) -> IndexPlan {
    let column_list = columns
        .iter()
        .map(|c| quote_ident(c))
        .collect::<Vec<_>>()
        .join(", ");
    IndexPlan {
        name,
        schema_name: schema_name.to_string(),
        table_name: table_name.to_string(),
        column_list,
        unique,
    }
}

fn foreign_keys(entity_type: &EntityType) -> Vec<ForeignKeyPlan> {
    entity_type
        .props
        .iter()
        .filter_map(|prop| {
            let fk = prop.foreign_key.as_ref()?;
            let target_schema = if fk.schema_name.trim().is_empty() {
                entity_type.schema_name.clone()
            } else {
                fk.schema_name.clone()
            };
            Some(ForeignKeyPlan {
                name: format!("fk_{}_{}", entity_type.snake_n, prop.name),
                source_schema: entity_type.schema_name.clone(),
                source_table: entity_type.snake_n.clone(),
                source_column: prop.name.clone(),
                target_schema,
                target_table: snake_n(&fk.type_name),
            })
        })
        .collect()
}

fn constraints(entity_type: &EntityType) -> Vec<ConstraintPlan> {
    entity_type
        .constraints
        .clone()
        .unwrap_or_default()
        .into_iter()
        .map(|definition| ConstraintPlan {
            name: definition
                .split_whitespace()
                .next()
                .unwrap_or_default()
                .to_string(),
            schema_name: entity_type.schema_name.clone(),
            table_name: entity_type.snake_n.clone(),
            definition,
        })
        .collect()
}

fn junction_tables(entity_type: &EntityType) -> Vec<JunctionTablePlan> {
    entity_type
        .props
        .iter()
        .filter_map(|prop| {
            let m2m = prop.many_to_many_property.as_ref()?;
            let junction_schema = m2m
                .junction_schema
                .clone()
                .unwrap_or_else(|| entity_type.schema_name.clone());
            Some(JunctionTablePlan {
                schema_name: junction_schema,
                table_name: snake_n(&m2m.junction_table),
                raw_table_name: m2m.junction_table.clone(),
                source_schema: entity_type.schema_name.clone(),
                source_table: entity_type.snake_n.clone(),
                source_entity_name: entity_type.pascal_1.clone(),
                target_schema: m2m.target_schema.clone(),
                target_table: snake_n(&m2m.target_type),
                target_entity_name: m2m.target_type.clone(),
                local_key: m2m.local_key.clone(),
                foreign_key: m2m.foreign_key.clone(),
            })
        })
        .collect()
}

fn dedupe_junction_tables(junction_tables: Vec<JunctionTablePlan>) -> Vec<JunctionTablePlan> {
    let mut tables = std::collections::BTreeMap::new();
    for junction in junction_tables {
        let key = format!("{}.{}", junction.schema_name, junction.table_name);
        tables.entry(key).or_insert(junction);
    }
    tables.into_values().collect()
}

fn data_type(data_type: DataType) -> &'static str {
    match data_type {
        DataType::Uuid => "uuid",
        DataType::UuidArray => "uuid[]",
        DataType::ObjectId => "varchar",
        DataType::ObjectIdArray => "varchar[]",
        DataType::Boolean => "boolean",
        DataType::String => "varchar",
        DataType::StringArray => "varchar[]",
        DataType::Date => "date",
        DataType::DateTime => "timestamptz",
        DataType::Time => "time",
        DataType::Int8 | DataType::Int16 => "smallint",
        DataType::Int8Array | DataType::Int16Array => "smallint[]",
        DataType::Int32 => "integer",
        DataType::Int32Array => "integer[]",
        DataType::Int64 => "bigint",
        DataType::Int64Array => "bigint[]",
        DataType::Float32 => "real",
        DataType::Float64 => "double precision",
        DataType::Enum => "varchar",
        DataType::EnumArray => "varchar[]",
        DataType::Object | DataType::Json => "jsonb",
        DataType::ObjectArray | DataType::JsonArray => "jsonb[]",
        DataType::NavToOne | DataType::NavToMany | DataType::ManyToMany => "",
    }
}

fn quote_ident(ident: &str) -> String {
    format!("\"{ident}\"")
}

fn string_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

/// Matches the framework's `type_relationships.rs`/`ddl_plan.rs` `snake_n`
/// helper: pluralize-to-table-case unless the value is already table_case.
fn snake_n(value: &str) -> String {
    use inflector::cases::tablecase::{is_table_case, to_table_case};
    if is_table_case(value) {
        value.to_string()
    } else {
        to_table_case(value)
    }
}

/// Render the `DO $$ ... END $$;` migration script, matching
/// `_templates/database/postgresql/create_tables_sql/_mod.j2` exactly.
/// `alter_columns`/`table.columns` in the reference template are identical
/// in the CREATE branch that always fires for a fresh database (this
/// generator always emits the CREATE path -- the ALTER branch only matters
/// for an existing, already-migrated database, which isn't reproducible
/// from the model alone and isn't exercised by the checked-in oracle file
/// this was verified against, since it was generated against an empty db).
pub fn render_create_tables_sql(plan: &DdlPlan) -> String {
    let mut out = String::new();
    out.push_str("--\n--    Generated by app_gen.\n--    by app_gen/_templates/database/postgresql/create_tables_sql/_mod.j2\n--    Defines storage tables for entity_types.\n--\n\nDO $$\nBEGIN\n\n");

    for sequence in &plan.sequences {
        out.push_str(&format!(
            "    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = '{}' AND sequencename = '{}') THEN\n        RAISE NOTICE 'Creating sequence {}.{}';\n        CREATE SEQUENCE {}.{};\n    END IF;\n",
            sequence.schema_name, sequence.name, sequence.schema_name, sequence.name, sequence.schema_name, sequence.name
        ));
    }
    // Matches the template's `{# ADD TABLES #}` comment block between the
    // sequences and tables loops: a Tera `{# ... #}` comment consumes its
    // own text but the surrounding blank lines around it remain literal,
    // contributing 4 blank lines here (verified against the checked-in
    // oracle) whether or not any sequences were emitted above.
    out.push_str("\n\n\n\n");

    for table in &plan.tables {
        out.push_str(&format!(
            "\n    IF EXISTS(SELECT TRUE FROM pg_type where typnamespace = (select oid from pg_catalog.pg_namespace where nspname = '{}') AND typname = '{}')\n    THEN\n        RAISE NOTICE 'ALTERING table {}';\n",
            table.schema_name, table.name, table.name
        ));
        for column in &table.alter_columns {
            out.push_str(&format!(
                "\n        ALTER TABLE {}.{} ADD COLUMN IF NOT EXISTS {};\n",
                table.schema_name, table.name, column.alter_definition
            ));
        }
        out.push('\n');
        out.push_str(&format!(
            "    ELSE\n        RAISE NOTICE 'CREATING, table {}';\n        CREATE TABLE {}.{}\n        (",
            table.name, table.schema_name, table.name
        ));
        for (i, column) in table.columns.iter().enumerate() {
            let comma = if i > 0 { "," } else { "" };
            out.push_str(&format!(
                "\n            {comma}{}",
                column.create_definition
            ));
        }
        out.push_str("\n        );\n    END IF;\n");
    }
    // `{# ADD PER-ENTITY AUDIT TABLES #}` comment gap, empirically matched
    // against the checked-in oracle (4 blank lines between the last table's
    // `END IF;` and the first audit table's `CREATE TABLE`).
    out.push_str("\n\n\n");

    for audit in &plan.audit_tables {
        out.push_str(&format!(
            "\n    CREATE TABLE IF NOT EXISTS {}.{}\n    (",
            audit.schema_name, audit.name
        ));
        for (i, column) in audit.columns.iter().enumerate() {
            let comma = if i > 0 { "," } else { "" };
            out.push_str(&format!(
                "\n        {comma}{} {}",
                column.name, column.create_definition
            ));
        }
        out.push_str("\n    );\n\n\n");
        for column in &audit.migration_columns {
            out.push_str(&format!(
                "    ALTER TABLE {}.{} ADD COLUMN IF NOT EXISTS {} varchar NOT NULL DEFAULT {};\n\n",
                audit.schema_name, audit.name, column.name, column.default_literal
            ));
        }
        out.push('\n');
        for index in &audit.indexes {
            out.push_str(&format!(
                "    CREATE {}INDEX IF NOT EXISTS {}\n        ON {}.{} ({});\n\n",
                if index.unique { "UNIQUE " } else { "" },
                index.name,
                index.schema_name,
                index.table_name,
                index.column_list
            ));
        }
    }
    // `{# ADD INDEXES #}` comment gap, empirically matched (4 blank lines
    // between the last audit-table index and the first top-level index's
    // `IF NOT EXISTS`).
    out.push_str("\n\n\n");

    for index in &plan.indexes {
        out.push_str(&format!(
            "\n    IF NOT EXISTS (\n        SELECT 1\n        FROM pg_indexes\n        WHERE schemaname = '{}'\n        AND tablename = '{}'\n        AND indexname = '{}'\n    ) THEN\n        RAISE NOTICE 'Creating index {}';\n        CREATE {}INDEX {}\n        ON {}.{} ({});\n    ELSE\n        RAISE NOTICE 'Index {} already exists';\n    END IF;\n",
            index.schema_name, index.table_name, index.name, index.name,
            if index.unique { "UNIQUE " } else { "" },
            index.name, index.schema_name, index.table_name, index.column_list, index.name
        ));
    }
    // `{# ADD FOREIGN KEY CONSTRAINTS #}` comment gap, same empirical
    // pattern as the other section boundaries.
    out.push_str("\n\n\n");

    for fk in &plan.foreign_keys {
        out.push_str(&format!(
            "\n    IF NOT EXISTS (\n        SELECT 1\n        FROM information_schema.table_constraints\n        WHERE constraint_schema = '{}'\n        AND table_name = '{}'\n        AND constraint_name = '{}'\n        AND constraint_type = 'FOREIGN KEY'\n    ) THEN\n        RAISE NOTICE 'Creating foreign key constraint {}';\n        ALTER TABLE {}.{}\n        ADD CONSTRAINT {}\n        FOREIGN KEY (\"{}\")\n        REFERENCES {}.{}(\"id\")\n        ON DELETE RESTRICT ON UPDATE CASCADE;\n    ELSE\n        RAISE NOTICE 'Foreign key constraint {} already exists';\n    END IF;\n",
            fk.source_schema, fk.source_table, fk.name, fk.name, fk.source_schema, fk.source_table, fk.name, fk.source_column, fk.target_schema, fk.target_table, fk.name
        ));
    }
    // `{# ADD CONSTRAINTS #}` comment gap, same empirical pattern as the
    // other section boundaries above.
    out.push_str("\n\n\n");

    for constraint in &plan.constraints {
        out.push_str(&format!(
            "\n    IF NOT EXISTS (\n        SELECT 1\n        FROM pg_constraint\n        WHERE conname = '{}'\n        AND conrelid = '{}.\"{}\"'::regclass\n    ) THEN\n        RAISE NOTICE 'Creating constraint {} on {}';\n        ALTER TABLE {}.\"{}\"\n        ADD CONSTRAINT {};\n    ELSE\n        RAISE NOTICE 'Constraint {} already exists';\n    END IF;\n",
            constraint.name, constraint.schema_name, constraint.table_name, constraint.name, constraint.table_name, constraint.schema_name, constraint.table_name, constraint.definition, constraint.name
        ));
    }
    // `{# ADD JUNCTION TABLES ... #}` comment gap, same pattern.
    out.push_str("\n\n\n");

    for junction in &plan.junction_tables {
        out.push_str(&format!(
            "\n    -- Creating junction table for ManyToMany relationship: {} <-> {}\n\n    IF NOT EXISTS(SELECT TRUE FROM pg_type where typnamespace = (select oid from pg_catalog.pg_namespace where nspname = '{}') AND typname = '{}')\n    THEN\n        RAISE NOTICE 'CREATING junction table {}';\n        CREATE TABLE {}.{}\n        (\n            \"id\" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,\n            \"{}\" uuid NOT NULL,\n            \"{}\" uuid NOT NULL,\n            \"created_at\" timestamp DEFAULT NOW(),\n            UNIQUE(\"{}\", \"{}\")\n        );\n\n        CREATE INDEX idx_{}_{} ON {}.{} (\"{}\");\n        CREATE INDEX idx_{}_{} ON {}.{} (\"{}\");\n\n        ALTER TABLE {}.{}\n        ADD CONSTRAINT fk_{}_{}\n        FOREIGN KEY (\"{}\")\n        REFERENCES {}.{}(\"id\")\n        ON DELETE CASCADE ON UPDATE CASCADE;\n\n        ALTER TABLE {}.{}\n        ADD CONSTRAINT fk_{}_{}\n        FOREIGN KEY (\"{}\")\n        REFERENCES {}.{}(\"id\")\n        ON DELETE CASCADE ON UPDATE CASCADE;\n    ELSE\n        RAISE NOTICE 'Junction table {} already exists';\n    END IF;\n",
            junction.source_entity_name, junction.target_entity_name,
            junction.schema_name, junction.table_name,
            junction.raw_table_name,
            junction.schema_name, junction.table_name,
            junction.local_key, junction.foreign_key, junction.local_key, junction.foreign_key,
            junction.table_name, junction.local_key, junction.schema_name, junction.table_name, junction.local_key,
            junction.table_name, junction.foreign_key, junction.schema_name, junction.table_name, junction.foreign_key,
            junction.schema_name, junction.table_name, junction.table_name, junction.local_key, junction.local_key, junction.source_schema, junction.source_table,
            junction.schema_name, junction.table_name, junction.table_name, junction.foreign_key, junction.foreign_key, junction.target_schema, junction.target_table,
            junction.raw_table_name
        ));
    }

    out.push_str("\n\nEND $$;\n");
    out
}

/// One `.appfw/model/schemas/*/seeds/*.yaml` array item.
#[derive(serde::Deserialize)]
pub struct SeedGroup {
    pub entity_type: String,
    pub schema: String,
    pub columns: Vec<String>,
    pub records: Vec<serde_json::Map<String, serde_json::Value>>,
}

/// Merge every `*.yaml` file in `seeds_dir` (sorted by filename -- numeric
/// prefixes encode FK-dependency order) into one seed-group list, matching
/// `context::load_dir`'s merge semantics (the same mechanism `loader::merge_dir_as_array`
/// already implements).
pub fn load_seeds(seeds_dir: &Path) -> Result<Vec<SeedGroup>> {
    crate::loader::merge_dir_as_array(seeds_dir)?
        .into_iter()
        .map(|value| serde_json::from_value(value).context("invalid seed group"))
        .collect()
}

/// Render `seed.pg.sql`, matching `_templates/database/postgresql/seed_sql/_mod.j2`
/// exactly, including its Tera-whitespace-control quirks (a blank line after
/// every column value, two blank lines before the closing paren).
///
/// `entities` is the same resolved entity list `build()` takes -- needed
/// here so a seed value can be rendered against its real target column
/// type. Found and fixed during manual DB bring-up (2026-09-07): a plain
/// `serde_json::Value::Array` was always rendered as a Postgres
/// `ARRAY[...]` literal regardless of the target column's declared type,
/// so a `jsonb` column fed a YAML list (`assigned_roles: [admin]`,
/// `checklist_template: []` on `WorkflowStageDefinition`) got
/// `ARRAY['admin']`/`ARRAY[]::varchar[]` instead of a JSON array literal --
/// `ERROR: column "assigned_roles" is of type jsonb but expression is of
/// type text[]`, aborting the whole seed script (it's one `DO $$ BEGIN
/// ... END $$` transaction, so this one type mismatch silently zeroed out
/// every seed row, not just this table's). The model author's own comment
/// in `03_workflow_stage_definitions.yaml` had flagged this as an
/// unverified risk when the seed data was authored. See
/// `pg_seed_literal_for_column`.
pub fn render_seed_sql(schema_name: &str, seeds: &[SeedGroup], entities: &[EntityType]) -> String {
    let mut out = String::new();
    out.push_str(&format!(
        "--\n--    Generated by app_gen.\n--    by app_gen/_templates/database/postgresql/seed_sql/_mod.j2\n--    Seed data for {schema_name} schema (PostgreSQL dialect)\n--\n\nDO $$\nBEGIN\n\n\n\n\n"
    ));

    let last_seed = seeds.len().saturating_sub(1);
    for (seed_i, seed) in seeds.iter().enumerate() {
        let table = snake_n(&seed.entity_type);
        let entity = entities
            .iter()
            .find(|entity| entity.pascal_1 == seed.entity_type);
        out.push_str(&format!(
            "-- ----------------------------------------------------------------------------\n-- {}\n-- ----------------------------------------------------------------------------\n\n\n",
            seed.entity_type
        ));
        let last_record = seed.records.len().saturating_sub(1);
        for (record_i, record) in seed.records.iter().enumerate() {
            out.push_str(&format!(
                "INSERT INTO {}.{} (\n  {}\n)\nVALUES (\n",
                seed.schema,
                table,
                seed.columns.join(", ")
            ));
            let last_col = seed.columns.len().saturating_sub(1);
            for (i, col) in seed.columns.iter().enumerate() {
                let is_json_column = entity
                    .and_then(|entity| entity.props.iter().find(|prop| &prop.name == col))
                    .is_some_and(|prop| matches!(prop.data_type, DataType::Json | DataType::JsonArray));
                let literal = match record.get(col) {
                    Some(value) => pg_seed_literal_for_column(value, is_json_column),
                    None => "NULL".to_string(),
                };
                out.push_str(&format!("  {literal}"));
                if i != last_col {
                    out.push(',');
                }
                out.push_str("\n\n");
            }
            out.push_str("\n)\nON CONFLICT (id) DO NOTHING;\n");
            if record_i != last_record {
                out.push('\n');
            }
        }
        if seed_i == last_seed {
            out.push_str("\n\n\n\n");
        } else {
            out.push_str("\n\n\n\n\n");
        }
    }

    out.push_str("END $$;\n");
    out
}

/// Matches the framework's `filters::pg_seed_literal`/`seed_literal`
/// (Postgres arm), already verified against the phase-6 recon of
/// `filters.rs`, for every value shape except one: a plain array being
/// seeded into a `jsonb` column. That case needs to know the target
/// column's declared type, which this crate's original port of the
/// function didn't have -- see `pg_seed_literal_for_column`, which wraps
/// this and handles it.
fn pg_seed_literal(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "NULL".to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => string_literal(s),
        serde_json::Value::Array(values) => {
            if values.is_empty() {
                "ARRAY[]::varchar[]".to_string()
            } else {
                let items = values
                    .iter()
                    .map(|v| match v {
                        serde_json::Value::Null => "NULL".to_string(),
                        serde_json::Value::Bool(b) => b.to_string(),
                        serde_json::Value::Number(n) => n.to_string(),
                        serde_json::Value::String(s) => string_literal(s),
                        other => string_literal(&serde_json::to_string(other).unwrap_or_default()),
                    })
                    .collect::<Vec<_>>()
                    .join(", ");
                format!("ARRAY[{items}]")
            }
        }
        serde_json::Value::Object(_) => {
            format!(
                "{}::jsonb",
                string_literal(&serde_json::to_string(value).unwrap_or_default())
            )
        }
    }
}

/// `pg_seed_literal`, but renders a plain array as a JSON array literal
/// (`'[...]'::jsonb`) instead of a Postgres `ARRAY[...]` literal when
/// `is_json_column` says the target column is declared `jsonb`
/// (`DataType::Json`/`DataType::JsonArray`) -- see `render_seed_sql`'s doc
/// comment for the bug this fixes. Every other value shape (including a
/// JSON object, already `::jsonb`-rendered by `pg_seed_literal`) is
/// unaffected.
fn pg_seed_literal_for_column(value: &serde_json::Value, is_json_column: bool) -> String {
    if is_json_column {
        if let serde_json::Value::Array(_) = value {
            return format!(
                "{}::jsonb",
                string_literal(&serde_json::to_string(value).unwrap_or_default())
            );
        }
    }
    pg_seed_literal(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn model_root() -> std::path::PathBuf {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../.appfw/model")
    }

    fn database_pkg_root() -> std::path::PathBuf {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../database/_pkg/schemas")
    }

    fn resolved_governance_entities() -> Vec<EntityType> {
        let resolved = crate::load_resolved_entities(&model_root()).expect("model should load");
        resolved
            .into_iter()
            .find(|(name, _, _)| name == "governance")
            .expect("governance schema")
            .2
    }

    #[test]
    fn tables_pg_sql_matches_checked_in_oracle_byte_for_byte() {
        let entities = resolved_governance_entities();
        let plan = build(&entities);
        let rendered = render_create_tables_sql(&plan);

        let oracle = std::fs::read_to_string(database_pkg_root().join("governance/tables.pg.sql"))
            .expect("read oracle tables.pg.sql");

        assert_eq!(rendered, oracle);
    }

    #[test]
    fn seed_pg_sql_matches_checked_in_oracle_byte_for_byte() {
        let seeds_dir = model_root().join("schemas/governance/seeds");
        let seeds = load_seeds(&seeds_dir).expect("seeds should load");
        let entities = resolved_governance_entities();
        let rendered = render_seed_sql("governance", &seeds, &entities);

        let oracle = std::fs::read_to_string(database_pkg_root().join("governance/seed.pg.sql"))
            .expect("read oracle seed.pg.sql");

        assert_eq!(rendered, oracle);
    }
}
