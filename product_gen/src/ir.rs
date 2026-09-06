//! Stage 3: flatten relationship-resolved `EntityType`/`PropertyType` into
//! the final `GeneratorIr` every downstream slice (Rego, DDL, backend
//! codegen, frontend contract) consumes. Purely mechanical -- no I/O, no
//! template engine -- ported from the framework's `normalized_config::build`
//! (read in full during slice 1 scoping).

use serde::Serialize;

use crate::model::{
    CustomMethod, CustomMethodKind, DataAccessExecution, DataType, EntityType, PropertyType,
    ProviderRoutineBinding, ProviderRoutineName, StandardMethod,
};
use crate::relationship_model::RelationshipConfig;

#[derive(Debug, Serialize)]
pub struct GeneratorIr {
    pub version: u32,
    pub generated_at: String,
    pub schemas: Vec<NormalizedSchema>,
}

/// Per-schema metadata not derivable from `EntityType` alone -- the data
/// source binding (`.appfw/model/schemas/{schema}/_res.yaml`'s
/// `data_source_name`, resolved against `.appfw/model/data_sources/_res.yaml`)
/// and the schema's own relationship declarations (distinct from the
/// nav/M2M properties `relationships::resolve` already synthesizes onto
/// entities -- these are the raw relationship configs themselves, needed by
/// the frontend UI contract's `relationships` array).
pub struct SchemaMeta {
    pub name: String,
    pub is_system_schema: bool,
    pub data_source_name: String,
    pub data_source_type: String,
    pub relationships: Vec<RelationshipConfig>,
}

#[derive(Debug, Serialize)]
pub struct NormalizedSchema {
    pub name: String,
    pub data_source_name: String,
    pub data_source_type: String,
    pub is_system_schema: bool,
    pub relationships: Vec<NormalizedRelationship>,
    pub entities: Vec<NormalizedEntity>,
}

#[derive(Debug, Serialize)]
pub struct NormalizedRelationship {
    pub name: String,
    pub kind: String,
    pub left: Option<NormalizedRelationshipEndpoint>,
    pub right: Option<NormalizedRelationshipEndpoint>,
    pub one: Option<NormalizedRelationshipEndpoint>,
    pub many: Option<NormalizedRelationshipEndpoint>,
    pub storage: Option<NormalizedRelationshipStorage>,
    pub junction: Option<NormalizedRelationshipJunction>,
}

#[derive(Debug, Serialize)]
pub struct NormalizedRelationshipEndpoint {
    pub schema_name: Option<String>,
    pub entity_name: String,
    pub field_name: String,
    pub caption: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct NormalizedRelationshipStorage {
    pub storage_type: String,
    pub owner_schema: Option<String>,
    pub owner: String,
    pub field: String,
}

#[derive(Debug, Serialize)]
pub struct NormalizedRelationshipJunction {
    pub schema_name: Option<String>,
    pub entity_name: String,
    pub left_key: String,
    pub right_key: String,
}

#[derive(Debug, Serialize)]
pub struct NormalizedEntity {
    pub schema_name: String,
    pub name: String,
    pub table_name: String,
    pub caption_singular: String,
    pub caption_plural: String,
    pub snake_singular: String,
    pub is_table: bool,
    pub is_union: bool,
    pub base_type: Option<String>,
    pub facets: Vec<String>,
    pub execution: NormalizedDataAccessExecution,
    pub has_standard_methods: bool,
    pub has_custom_methods: bool,
    pub has_generated_handler: bool,
    pub standard_methods: Vec<String>,
    pub query_standard_methods: Vec<String>,
    pub mutation_standard_methods: Vec<String>,
    pub custom_methods: Vec<NormalizedCustomMethod>,
    pub query_custom_methods: Vec<String>,
    pub mutation_custom_methods: Vec<String>,
    pub primary_key: Option<String>,
    pub audit_table: Option<String>,
    pub native_properties: Vec<NormalizedProperty>,
    pub relationship_properties: Vec<NormalizedProperty>,
}

#[derive(Debug, Serialize)]
pub struct NormalizedDataAccessExecution {
    pub prepared_statements: bool,
}

#[derive(Debug, Serialize)]
pub struct NormalizedCustomMethod {
    pub name: String,
    pub kind: String,
    pub return_type: String,
    pub mcp_enabled: bool,
    pub provider_routine: Option<NormalizedProviderRoutine>,
}

#[derive(Debug, Serialize)]
pub struct NormalizedProviderRoutine {
    pub kind: String,
    pub returns: String,
    pub data_source: Option<String>,
    pub postgres: Option<NormalizedProviderRoutineName>,
}

#[derive(Clone, Debug, Serialize)]
pub struct NormalizedProviderRoutineName {
    pub schema: Option<String>,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct NormalizedProperty {
    pub name: String,
    pub caption: String,
    pub data_type: String,
    pub is_key: bool,
    pub is_caption: bool,
    pub is_required: bool,
    pub is_read_only: bool,
    pub is_concurrency_control: bool,
    pub enum_type_name: Option<String>,
    pub relation: Option<NormalizedRelation>,
}

#[derive(Debug, Serialize)]
pub struct NormalizedRelation {
    pub kind: &'static str,
    pub schema_name: Option<String>,
    pub type_name: Option<String>,
    pub prop_name: Option<String>,
    pub resolved_schema_name: Option<String>,
    pub resolved_type_name: Option<String>,
    pub junction_schema: Option<String>,
    pub junction_table: Option<String>,
    pub local_key: Option<String>,
    pub foreign_key: Option<String>,
}

/// `entity_types` must already be relationship-resolved (output of
/// `crate::relationships::resolve`), covering every schema.
pub fn build(schema_meta: &[SchemaMeta], entity_types: &[EntityType]) -> GeneratorIr {
    let mut schemas: Vec<NormalizedSchema> = schema_meta
        .iter()
        .map(|meta| {
            let mut entities: Vec<NormalizedEntity> = entity_types
                .iter()
                .filter(|e| e.schema_name == meta.name)
                .map(normalize_entity)
                .collect();
            entities.sort_by(|a, b| a.name.cmp(&b.name));
            NormalizedSchema {
                name: meta.name.clone(),
                data_source_name: meta.data_source_name.clone(),
                data_source_type: meta.data_source_type.clone(),
                is_system_schema: meta.is_system_schema,
                relationships: meta
                    .relationships
                    .iter()
                    .map(normalize_relationship)
                    .collect(),
                entities,
            }
        })
        .collect();
    schemas.sort_by(|a, b| a.name.cmp(&b.name));

    GeneratorIr {
        version: 1,
        generated_at: chrono::Utc::now().to_rfc3339(),
        schemas,
    }
}

fn normalize_relationship(relationship: &RelationshipConfig) -> NormalizedRelationship {
    NormalizedRelationship {
        name: relationship.name.clone(),
        kind: format!("{:?}", relationship.kind),
        left: relationship
            .left
            .as_ref()
            .map(normalize_relationship_endpoint),
        right: relationship
            .right
            .as_ref()
            .map(normalize_relationship_endpoint),
        one: relationship
            .one
            .as_ref()
            .map(normalize_relationship_endpoint),
        many: relationship
            .many
            .as_ref()
            .map(normalize_relationship_endpoint),
        storage: relationship
            .storage
            .as_ref()
            .map(|storage| NormalizedRelationshipStorage {
                storage_type: format!("{:?}", storage.storage_type),
                owner_schema: storage.owner_schema.clone(),
                owner: storage.owner.clone(),
                field: storage.field.clone(),
            }),
        junction: relationship
            .junction
            .as_ref()
            .map(|junction| NormalizedRelationshipJunction {
                schema_name: junction.schema.clone(),
                entity_name: junction.entity.clone(),
                left_key: junction.left_key.clone(),
                right_key: junction.right_key.clone(),
            }),
    }
}

fn normalize_relationship_endpoint(
    endpoint: &crate::relationship_model::RelationshipEndpoint,
) -> NormalizedRelationshipEndpoint {
    NormalizedRelationshipEndpoint {
        schema_name: endpoint.schema.clone(),
        entity_name: endpoint.entity.clone(),
        field_name: endpoint.field.clone(),
        caption: endpoint.caption.clone(),
    }
}

fn normalize_entity(entity_type: &EntityType) -> NormalizedEntity {
    let facets = entity_type.facets.clone().unwrap_or_default();
    let standard_methods = entity_type.standard_methods.clone().unwrap_or_default();
    let custom_methods = entity_type.custom_methods.clone().unwrap_or_default();

    let standard_method_names: Vec<String> = standard_methods
        .iter()
        .map(standard_method_name)
        .map(str::to_string)
        .collect();
    let query_standard_methods: Vec<String> = standard_methods
        .iter()
        .filter(|m| standard_method_kind(**m) == HandlerKind::Query)
        .map(standard_method_name)
        .map(str::to_string)
        .collect();
    let mutation_standard_methods: Vec<String> = standard_methods
        .iter()
        .filter(|m| standard_method_kind(**m) == HandlerKind::Mutation)
        .map(standard_method_name)
        .map(str::to_string)
        .collect();
    let query_custom_methods: Vec<String> = custom_methods
        .iter()
        .filter(|m| custom_method_kind(m.kind) == HandlerKind::Query)
        .map(|m| m.name.clone())
        .collect();
    let mutation_custom_methods: Vec<String> = custom_methods
        .iter()
        .filter(|m| custom_method_kind(m.kind) == HandlerKind::Mutation)
        .map(|m| m.name.clone())
        .collect();
    let normalized_custom_methods: Vec<NormalizedCustomMethod> =
        custom_methods.iter().map(normalize_custom_method).collect();

    let (native_properties, relationship_properties): (Vec<_>, Vec<_>) = entity_type
        .props
        .iter()
        .map(normalize_property)
        .partition(|p| p.relation.is_none());

    NormalizedEntity {
        schema_name: entity_type.schema_name.clone(),
        name: entity_type.pascal_1.clone(),
        table_name: entity_type.snake_n.clone(),
        caption_singular: entity_type.caption_1.clone(),
        caption_plural: entity_type.caption_n.clone(),
        snake_singular: entity_type.snake_1.clone(),
        is_table: entity_type.is_table,
        is_union: entity_type.is_union,
        base_type: entity_type.base_type.clone(),
        execution: normalize_data_access_execution(entity_type.execution.as_ref()),
        has_standard_methods: !standard_methods.is_empty(),
        has_custom_methods: !custom_methods.is_empty(),
        has_generated_handler: !standard_methods.is_empty() || !custom_methods.is_empty(),
        primary_key: entity_type
            .props
            .iter()
            .find(|p| p.is_key)
            .map(|p| p.name.clone()),
        audit_table: facets
            .iter()
            .any(|f| f == "audited")
            .then(|| format!("{}_audit", entity_type.snake_n)),
        facets,
        standard_methods: standard_method_names,
        query_standard_methods,
        mutation_standard_methods,
        custom_methods: normalized_custom_methods,
        query_custom_methods,
        mutation_custom_methods,
        native_properties,
        relationship_properties,
    }
}

fn normalize_data_access_execution(
    execution: Option<&DataAccessExecution>,
) -> NormalizedDataAccessExecution {
    NormalizedDataAccessExecution {
        prepared_statements: execution
            .and_then(|e| e.prepared_statements)
            .unwrap_or(false),
    }
}

fn normalize_custom_method(method: &CustomMethod) -> NormalizedCustomMethod {
    NormalizedCustomMethod {
        name: method.name.clone(),
        kind: custom_method_kind(method.kind).label().to_string(),
        return_type: method.return_type.clone(),
        mcp_enabled: method.mcp_enabled.unwrap_or(false),
        provider_routine: method
            .provider_routine
            .as_ref()
            .map(normalize_provider_routine),
    }
}

fn normalize_provider_routine(routine: &ProviderRoutineBinding) -> NormalizedProviderRoutine {
    let default = routine
        .name
        .as_ref()
        .map(|name| NormalizedProviderRoutineName {
            schema: routine.schema.clone(),
            name: name.clone(),
        });
    let postgres = routine
        .routines
        .as_ref()
        .and_then(|r| r.postgres.as_ref())
        .map(normalize_provider_routine_name)
        .or(default);

    NormalizedProviderRoutine {
        kind: format!("{:?}", routine.kind),
        returns: format!("{:?}", routine.returns),
        data_source: routine.data_source.clone(),
        postgres,
    }
}

fn normalize_provider_routine_name(routine: &ProviderRoutineName) -> NormalizedProviderRoutineName {
    NormalizedProviderRoutineName {
        schema: routine.schema.clone(),
        name: routine.name.clone(),
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum HandlerKind {
    Query,
    Mutation,
    Command,
}

impl HandlerKind {
    fn label(self) -> &'static str {
        match self {
            HandlerKind::Query => "Query",
            HandlerKind::Mutation => "Mutation",
            HandlerKind::Command => "Command",
        }
    }
}

fn standard_method_kind(method: StandardMethod) -> HandlerKind {
    match method {
        StandardMethod::FindById | StandardMethod::GetAll | StandardMethod::Query => {
            HandlerKind::Query
        }
        StandardMethod::Create | StandardMethod::Update | StandardMethod::Delete => {
            HandlerKind::Mutation
        }
    }
}

fn custom_method_kind(kind: CustomMethodKind) -> HandlerKind {
    match kind {
        CustomMethodKind::Query => HandlerKind::Query,
        CustomMethodKind::Mutation => HandlerKind::Mutation,
        CustomMethodKind::Command => HandlerKind::Command,
    }
}

fn normalize_property(prop: &PropertyType) -> NormalizedProperty {
    NormalizedProperty {
        name: prop.name.clone(),
        caption: prop.caption.clone(),
        data_type: format!("{:?}", prop.data_type),
        is_key: prop.is_key,
        is_caption: prop.is_caption,
        is_required: prop.is_required,
        is_read_only: prop.is_read_only,
        is_concurrency_control: prop.is_concurrency_control,
        enum_type_name: prop.enum_type_name.clone(),
        relation: normalize_relation(prop),
    }
}

fn normalize_relation(prop: &PropertyType) -> Option<NormalizedRelation> {
    if let Some(fk) = &prop.foreign_key {
        return Some(NormalizedRelation {
            kind: "foreign_key",
            schema_name: Some(fk.schema_name.clone()),
            type_name: Some(fk.type_name.clone()),
            prop_name: None,
            resolved_schema_name: None,
            resolved_type_name: None,
            junction_schema: None,
            junction_table: None,
            local_key: None,
            foreign_key: None,
        });
    }
    if let Some(nav) = &prop.nav_by_fk_property {
        return Some(NormalizedRelation {
            kind: match prop.data_type {
                DataType::NavToOne => "nav_to_one",
                DataType::NavToMany => "nav_to_many",
                _ => "navigation",
            },
            schema_name: Some(nav.schema_name.clone()),
            type_name: Some(nav.type_name.clone()),
            prop_name: Some(nav.prop_name.clone()),
            resolved_schema_name: nav.resolved.as_ref().map(|r| r.schema_name.clone()),
            resolved_type_name: nav.resolved.as_ref().map(|r| r.type_name.clone()),
            junction_schema: None,
            junction_table: None,
            local_key: None,
            foreign_key: None,
        });
    }
    if let Some(m2m) = &prop.many_to_many_property {
        return Some(NormalizedRelation {
            kind: "many_to_many",
            schema_name: Some(m2m.target_schema.clone()),
            type_name: Some(m2m.target_type.clone()),
            prop_name: None,
            resolved_schema_name: Some(m2m.target_schema.clone()),
            resolved_type_name: Some(m2m.target_type.clone()),
            junction_schema: m2m.junction_schema.clone(),
            junction_table: Some(m2m.junction_table.clone()),
            local_key: Some(m2m.local_key.clone()),
            foreign_key: Some(m2m.foreign_key.clone()),
        });
    }
    if let Some(nested) = &prop.nested_entity_type {
        return Some(NormalizedRelation {
            kind: "nested_entity",
            schema_name: Some(nested.schema_name.clone()),
            type_name: Some(nested.type_name.clone()),
            prop_name: None,
            resolved_schema_name: Some(nested.schema_name.clone()),
            resolved_type_name: Some(nested.type_name.clone()),
            junction_schema: None,
            junction_table: None,
            local_key: None,
            foreign_key: None,
        });
    }
    None
}

fn standard_method_name(method: &StandardMethod) -> &'static str {
    match method {
        StandardMethod::FindById => "FindById",
        StandardMethod::GetAll => "GetAll",
        StandardMethod::Query => "Query",
        StandardMethod::Create => "Create",
        StandardMethod::Update => "Update",
        StandardMethod::Delete => "Delete",
    }
}
