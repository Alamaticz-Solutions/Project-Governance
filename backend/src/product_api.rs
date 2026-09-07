use std::sync::Arc;

#[allow(unused_imports)]
pub use crate::platform::policy::{AccessAction, PolicyAccess};
#[allow(unused_imports)]
pub use crate::platform::user_auth::{RuntimePrincipalType, UserAuth};
use crate::{
    config::app_config::AppConfig,
    schemas::system::{
        CustomMethod, DataSource, DataSourceEnvironment as ProductDataSourceEnvironment,
        DataSourceType, DataType, ForeignKey, ManyToManyProperty, NavByFkProperty,
        NestedEntityType, PropertyType, Schema,
    },
};
#[allow(unused_imports)]
pub use crate::{
    data::data_access::DataAccess, routes::app_error::AppError, schemas::system::EntityType,
};
#[cfg(feature = "http")]
#[allow(unused_imports)]
pub use crate::platform::runtime::RuntimeJwtExtractor;
#[allow(unused_imports)]
pub use crate::platform::runtime::{
    model_metadata::{
        RuntimeCustomMethodMetadata, RuntimeDataSourceEnvironment, RuntimeDataSourceMetadata,
        RuntimeDataType, RuntimeEntityMetadata, RuntimeEntityRef, RuntimeManyToMany,
        RuntimeMethodArgMetadata, RuntimeModelMetadata, RuntimeNavByForeignKey,
        RuntimePropertyMetadata, RuntimeSchemaMetadata,
    },
    provider_keys::FrameworkProvider,
    record_locator::RECORD_LOCATOR_FIELD,
    HandlerResult, JsonValue, RuntimeAuditEvent, RuntimeAuditQuery, RuntimeFilterOp,
    RuntimeProviderDescriptor, RuntimeProviderOperation, RuntimeProviderOperationCounts,
};

#[cfg(feature = "http")]
pub(crate) fn user_from_context(ctx: &async_graphql::Context<'_>) -> Option<UserAuth> {
    // `user_from_graphql_context` is self-owned as of phase 7's slice 3
    // remainder and already returns this crate's own `UserAuth` directly
    // -- no bridge conversion needed here any more.
    crate::platform::runtime::user_from_graphql_context(ctx)
}

#[cfg(feature = "http")]
pub(crate) fn data_access_from_context(ctx: &async_graphql::Context<'_>) -> Arc<DataAccess> {
    crate::platform::runtime::data_from_graphql_context(ctx)
}

pub(crate) fn entity_type_for_handler(
    data_access: &Arc<DataAccess>,
    schema_name: &'static str,
    type_name: &'static str,
) -> Result<Arc<EntityType>, AppError> {
    data_access
        .app_config
        .get_entity_type(&schema_name.to_string(), &type_name.to_string())
}

pub(crate) fn runtime_model_metadata(app_config: &AppConfig) -> RuntimeModelMetadata {
    RuntimeModelMetadata::new(
        app_config
            .get_data_sources()
            .iter()
            .map(runtime_data_source_metadata)
            .collect(),
        app_config
            .get_schemas()
            .iter()
            .map(runtime_schema_metadata)
            .collect(),
        app_config
            .get_all_entity_types()
            .iter()
            .map(runtime_entity_metadata)
            .collect(),
    )
}

pub(crate) fn runtime_data_source_metadata(data_source: &DataSource) -> RuntimeDataSourceMetadata {
    RuntimeDataSourceMetadata {
        name: data_source.name.clone(),
        description: data_source.description.clone(),
        // `RuntimeDataSourceMetadata` is still framework-owned
        // (model_metadata), so bridge into the framework's own type.
        provider: runtime_provider(data_source.data_source_type).into(),
        is_system_schema_host: data_source.is_system_schema_host.unwrap_or(false),
        environments: data_source
            .environments
            .iter()
            .map(runtime_data_source_environment)
            .collect(),
    }
}

pub(crate) fn runtime_schema_metadata(schema: &Schema) -> RuntimeSchemaMetadata {
    RuntimeSchemaMetadata {
        id: schema.id.clone(),
        name: schema.name.clone(),
        description: schema.description.clone(),
        data_source_name: schema.data_source_name.clone(),
    }
}

pub(crate) fn runtime_entity_metadata(entity_type: &EntityType) -> RuntimeEntityMetadata {
    let mut properties = entity_type
        .props
        .iter()
        .map(runtime_property_metadata)
        .collect::<Vec<_>>();
    if entity_type.is_table
        && !properties
            .iter()
            .any(|property| property.name == RECORD_LOCATOR_FIELD)
    {
        properties.push(runtime_record_locator_metadata(entity_type));
    }

    RuntimeEntityMetadata {
        id: entity_type.id.clone(),
        schema_name: entity_type.schema_name.clone(),
        schema_id: entity_type.schema_id.clone(),
        pascal_1: entity_type.pascal_1.clone(),
        pascal_n: entity_type.pascal_n.clone(),
        snake_1: entity_type.snake_1.clone(),
        snake_n: entity_type.snake_n.clone(),
        caption_1: entity_type.caption_1.clone(),
        caption_n: entity_type.caption_n.clone(),
        is_union: entity_type.is_union,
        base_type: entity_type.base_type.clone(),
        is_table: entity_type.is_table,
        facets: entity_type.facets.clone().unwrap_or_default(),
        meta: entity_type.meta.clone(),
        standard_methods: entity_type
            .standard_methods
            .as_ref()
            .map(|methods| methods.iter().map(|method| format!("{method:?}")).collect())
            .unwrap_or_default(),
        custom_methods: entity_type
            .custom_methods
            .as_ref()
            .map(|methods| methods.iter().map(runtime_custom_method_metadata).collect())
            .unwrap_or_default(),
        properties,
    }
}

fn runtime_record_locator_metadata(entity_type: &EntityType) -> RuntimePropertyMetadata {
    RuntimePropertyMetadata {
        id: format!("{}:{}", entity_type.id, RECORD_LOCATOR_FIELD),
        name: RECORD_LOCATOR_FIELD.to_string(),
        caption: "Record Locator".to_string(),
        data_type: RuntimeDataType::String,
        is_key: false,
        is_caption: false,
        is_required: false,
        is_read_only: true,
        is_concurrency_control: false,
        default_value: None,
        foreign_key: None,
        nav_by_fk: None,
        many_to_many: None,
        nested_entity_type: None,
        enum_type_name: None,
        meta: Some(serde_json::json!({
            "native": true,
            "system": true,
            "route_identity": true
        })),
    }
}

fn runtime_data_source_environment(
    environment: &ProductDataSourceEnvironment,
) -> RuntimeDataSourceEnvironment {
    RuntimeDataSourceEnvironment {
        name: environment.name.clone(),
        db_host: environment.db_host.clone(),
        db_name: environment.db_name.clone(),
        db_port: environment.db_port.clone(),
        security_profile: environment.security_profile.clone(),
        tls_mode: environment.tls_mode.clone(),
        service_account_name: environment.service_account_name.clone(),
    }
}

fn runtime_custom_method_metadata(method: &CustomMethod) -> RuntimeCustomMethodMetadata {
    RuntimeCustomMethodMetadata {
        name: method.name.clone(),
        kind: format!("{:?}", method.kind),
        args: method
            .args
            .iter()
            .map(|arg| RuntimeMethodArgMetadata {
                name: arg.name.clone(),
                arg_type: arg.arg_type.clone(),
            })
            .collect(),
        return_type: method.return_type.clone(),
    }
}

pub(crate) fn runtime_property_metadata(property: &PropertyType) -> RuntimePropertyMetadata {
    RuntimePropertyMetadata {
        id: property.id.clone(),
        name: property.name.clone(),
        caption: property.caption.clone(),
        data_type: runtime_data_type(property.data_type),
        is_key: property.is_key,
        is_caption: property.is_caption,
        is_required: property.is_required,
        is_read_only: property.is_read_only,
        is_concurrency_control: property.is_concurrency_control,
        default_value: property.default_value.clone(),
        foreign_key: property
            .foreign_key
            .as_ref()
            .map(runtime_entity_ref_from_foreign_key),
        nav_by_fk: property
            .nav_by_fk_property
            .as_ref()
            .map(runtime_nav_by_foreign_key),
        many_to_many: property
            .many_to_many_property
            .as_ref()
            .map(runtime_many_to_many),
        nested_entity_type: property
            .nested_entity_type
            .as_ref()
            .map(runtime_entity_ref_from_nested_entity),
        enum_type_name: property.enum_type_name.clone(),
        meta: property.meta.clone(),
    }
}

fn runtime_nav_by_foreign_key(nav: &NavByFkProperty) -> RuntimeNavByForeignKey {
    RuntimeNavByForeignKey {
        schema_name: nav.schema_name.clone(),
        type_name: nav.type_name.clone(),
        prop_name: nav.prop_name.clone(),
        filter: nav.filter.clone(),
        resolved: runtime_entity_ref_from_foreign_key(&nav.resolved),
    }
}

fn runtime_many_to_many(property: &ManyToManyProperty) -> RuntimeManyToMany {
    RuntimeManyToMany {
        junction_table: property.junction_table.clone(),
        junction_schema: property.junction_schema.clone(),
        local_key: property.local_key.clone(),
        foreign_key: property.foreign_key.clone(),
        target_schema: property.target_schema.clone(),
        target_type: property.target_type.clone(),
    }
}

fn runtime_entity_ref_from_foreign_key(foreign_key: &ForeignKey) -> RuntimeEntityRef {
    RuntimeEntityRef {
        schema_name: foreign_key.schema_name.clone(),
        type_name: foreign_key.type_name.clone(),
    }
}

fn runtime_entity_ref_from_nested_entity(nested: &NestedEntityType) -> RuntimeEntityRef {
    RuntimeEntityRef {
        schema_name: nested.schema_name.clone(),
        type_name: nested.type_name.clone(),
    }
}

pub(crate) fn runtime_provider(data_source_type: DataSourceType) -> FrameworkProvider {
    match data_source_type {
        DataSourceType::PostgreSQL => FrameworkProvider::Postgres,
        DataSourceType::MongoDB => FrameworkProvider::Mongo,
        DataSourceType::MsSqlServer => FrameworkProvider::Mssql,
        DataSourceType::FabricSqlAnalytics => FrameworkProvider::FabricSqlAnalytics,
        DataSourceType::Snowflake => FrameworkProvider::Snowflake,
        DataSourceType::Neo4j => FrameworkProvider::Neo4j,
        DataSourceType::ServiceNow => FrameworkProvider::ServiceNow,
        DataSourceType::Workday => FrameworkProvider::Workday,
        DataSourceType::Icims => FrameworkProvider::Icims,
        DataSourceType::Salesforce => FrameworkProvider::Salesforce,
        DataSourceType::Anaplan => FrameworkProvider::Anaplan,
        DataSourceType::OracleFinancials => FrameworkProvider::OracleFinancials,
    }
}

pub(crate) fn runtime_data_type(data_type: DataType) -> RuntimeDataType {
    match data_type {
        DataType::Uuid => RuntimeDataType::Uuid,
        DataType::UuidArray => RuntimeDataType::UuidArray,
        DataType::ObjectId => RuntimeDataType::ObjectId,
        DataType::ObjectIdArray => RuntimeDataType::ObjectIdArray,
        DataType::Boolean => RuntimeDataType::Boolean,
        DataType::String => RuntimeDataType::String,
        DataType::StringArray => RuntimeDataType::StringArray,
        DataType::Date => RuntimeDataType::Date,
        DataType::DateTime => RuntimeDataType::DateTime,
        DataType::Time => RuntimeDataType::Time,
        DataType::Int8 => RuntimeDataType::Int8,
        DataType::Int8Array => RuntimeDataType::Int8Array,
        DataType::Int16 => RuntimeDataType::Int16,
        DataType::Int16Array => RuntimeDataType::Int16Array,
        DataType::Int32 => RuntimeDataType::Int32,
        DataType::Int32Array => RuntimeDataType::Int32Array,
        DataType::Int64 => RuntimeDataType::Int64,
        DataType::Int64Array => RuntimeDataType::Int64Array,
        DataType::Float32 => RuntimeDataType::Float32,
        DataType::Float64 => RuntimeDataType::Float64,
        DataType::Enum => RuntimeDataType::Enum,
        DataType::EnumArray => RuntimeDataType::EnumArray,
        DataType::Object => RuntimeDataType::Object,
        DataType::ObjectArray => RuntimeDataType::ObjectArray,
        DataType::Json => RuntimeDataType::Json,
        DataType::JsonArray => RuntimeDataType::JsonArray,
        DataType::NavToOne => RuntimeDataType::NavToOne,
        DataType::NavToMany => RuntimeDataType::NavToMany,
        DataType::ManyToMany => RuntimeDataType::ManyToMany,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // These four cases assert that the product-owned `UserAuth`
    // (`platform::user_auth`) serializes byte-for-byte identically to the
    // framework's own `crate::platform::runtime::extension::UserAuth`, across every
    // present/absent state of its optional fields. This matters because
    // `config/app_config.rs::evaluate_user_access` feeds
    // `serde_json::to_value(user)` straight into Rego as `input.user` for
    // all 42 access policies -- a dropped `skip_serializing_if` or a
    // renamed field would silently change what every one of those policies
    // sees, with no compiler error. The framework's own test suite never
    // asserts the *absent*-key case (only that a present `on_behalf_of` /
    // `ingress` serializes correctly), so this is deliberately broader than
    // what was ported. This test (and its use of `appfw_runtime` directly)
    // is only meaningful while phase 5 still depends on that crate; it can
    // be deleted once the dependency is removed in a later phase.
    #[test]
    fn user_auth_serializes_identically_to_the_framework_type_for_human() {
        let product = UserAuth::human(
            "tenant-1",
            "casey",
            "America/New_York",
            vec!["admin".to_string(), "analyst".to_string()],
            vec!["appfw:mcp.read".to_string()],
            "secret-jwt",
        );
        let framework = appfw_runtime::extension::UserAuth::human(
            "tenant-1",
            "casey",
            "America/New_York",
            vec!["admin".to_string(), "analyst".to_string()],
            vec!["appfw:mcp.read".to_string()],
            "secret-jwt",
        );
        assert_eq!(
            serde_json::to_value(&product).unwrap(),
            serde_json::to_value(&framework).unwrap()
        );
    }

    #[test]
    fn user_auth_serializes_identically_to_the_framework_type_for_service() {
        let product = UserAuth::service(
            "tenant-1",
            "crm-event-consumer",
            vec!["integration_writer".to_string()],
            vec!["crm.account.write".to_string()],
        );
        let framework = appfw_runtime::extension::UserAuth::service(
            "tenant-1",
            "crm-event-consumer",
            vec!["integration_writer".to_string()],
            vec!["crm.account.write".to_string()],
        );
        assert_eq!(
            serde_json::to_value(&product).unwrap(),
            serde_json::to_value(&framework).unwrap()
        );
    }

    #[test]
    fn user_auth_serializes_identically_to_the_framework_type_for_agent() {
        let product = UserAuth::agent(
            "tenant-1",
            "reconciliation-agent",
            vec!["agent".to_string()],
            vec!["crm.account.read".to_string()],
        );
        let framework = appfw_runtime::extension::UserAuth::agent(
            "tenant-1",
            "reconciliation-agent",
            vec!["agent".to_string()],
            vec!["crm.account.read".to_string()],
        );
        assert_eq!(
            serde_json::to_value(&product).unwrap(),
            serde_json::to_value(&framework).unwrap()
        );
    }

    #[test]
    fn user_auth_serializes_identically_to_the_framework_type_with_ingress_and_on_behalf_of() {
        let product = UserAuth::service(
            "tenant-1",
            "crm-event-consumer",
            vec!["integration_writer".to_string()],
            vec!["crm.account.write".to_string()],
        )
        .with_ingress("kafka")
        .with_on_behalf_of("casey");
        let framework = appfw_runtime::extension::UserAuth::service(
            "tenant-1",
            "crm-event-consumer",
            vec!["integration_writer".to_string()],
            vec!["crm.account.write".to_string()],
        )
        .with_ingress("kafka")
        .with_on_behalf_of("casey");
        assert_eq!(
            serde_json::to_value(&product).unwrap(),
            serde_json::to_value(&framework).unwrap()
        );
    }

    // The `RuntimeJwtExtractor` boundary this test originally guarded
    // (product -> framework in `platform::graphql_gateway`, framework ->
    // product in `user_from_context`) is gone as of phase 7's slice 3
    // remainder: `RuntimeJwtExtractor` holds the self-owned `UserAuth`
    // directly now, so nothing in production converts it to the
    // framework's type and back any more. The forward-only bridge
    // (`platform::user_auth`'s `impl From<&UserAuth> for
    // appfw_runtime::extension::UserAuth`) still exists for admin_ui.rs's
    // framework-fixed admin traits and audit_event.rs's oracle test, so
    // this test now verifies that bridge alone stays lossless, including
    // `token` -- the one field neither type ever serializes, so a dropped
    // `token` would not show up in the JSON-equality tests above.
    #[test]
    fn user_auth_bridges_to_the_framework_type_without_losing_any_field() {
        let original = UserAuth::human(
            "tenant-1",
            "casey",
            "America/New_York",
            vec!["admin".to_string()],
            vec!["appfw:mcp.read".to_string()],
            "secret-jwt",
        )
        .with_on_behalf_of("delegate");

        let via_framework: appfw_runtime::extension::UserAuth = (&original).into();

        assert_eq!(via_framework.tenant_id, original.tenant_id);
        assert_eq!(via_framework.user_name, original.user_name);
        assert_eq!(via_framework.timezone, original.timezone);
        assert_eq!(via_framework.on_behalf_of, original.on_behalf_of);
        assert_eq!(via_framework.ingress, original.ingress);
        assert_eq!(via_framework.roles, original.roles);
        assert_eq!(via_framework.scopes, original.scopes);
        assert_eq!(via_framework.token, "secret-jwt");
    }

    fn test_entity(is_table: bool, props: Vec<PropertyType>) -> EntityType {
        EntityType {
            id: "governance.Record".to_string(),
            schema_name: "governance".to_string(),
            schema_id: None,
            pascal_1: "Record".to_string(),
            pascal_n: "Records".to_string(),
            snake_1: "record".to_string(),
            snake_n: "records".to_string(),
            caption_1: "Record".to_string(),
            caption_n: "Records".to_string(),
            is_union: false,
            base_type: None,
            is_table,
            facets: None,
            meta: None,
            execution: None,
            standard_methods: None,
            custom_methods: None,
            props,
        }
    }

    #[test]
    fn runtime_entity_metadata_includes_native_record_locator_for_tables() {
        let metadata = runtime_entity_metadata(&test_entity(true, vec![]));
        let prop = metadata
            .property(RECORD_LOCATOR_FIELD)
            .expect("record locator runtime metadata");

        assert_eq!(prop.data_type, RuntimeDataType::String);
        assert!(prop.is_read_only);
        assert!(!prop.is_key);
    }

    #[test]
    fn runtime_entity_metadata_does_not_add_record_locator_for_non_tables() {
        let metadata = runtime_entity_metadata(&test_entity(false, vec![]));

        assert!(metadata.property(RECORD_LOCATOR_FIELD).is_none());
    }
}

pub(crate) fn product_data_type(data_type: RuntimeDataType) -> DataType {
    match data_type {
        RuntimeDataType::Uuid => DataType::Uuid,
        RuntimeDataType::UuidArray => DataType::UuidArray,
        RuntimeDataType::ObjectId => DataType::ObjectId,
        RuntimeDataType::ObjectIdArray => DataType::ObjectIdArray,
        RuntimeDataType::Boolean => DataType::Boolean,
        RuntimeDataType::String => DataType::String,
        RuntimeDataType::StringArray => DataType::StringArray,
        RuntimeDataType::Date => DataType::Date,
        RuntimeDataType::DateTime => DataType::DateTime,
        RuntimeDataType::Time => DataType::Time,
        RuntimeDataType::Int8 => DataType::Int8,
        RuntimeDataType::Int8Array => DataType::Int8Array,
        RuntimeDataType::Int16 => DataType::Int16,
        RuntimeDataType::Int16Array => DataType::Int16Array,
        RuntimeDataType::Int32 => DataType::Int32,
        RuntimeDataType::Int32Array => DataType::Int32Array,
        RuntimeDataType::Int64 => DataType::Int64,
        RuntimeDataType::Int64Array => DataType::Int64Array,
        RuntimeDataType::Float32 => DataType::Float32,
        RuntimeDataType::Float64 => DataType::Float64,
        RuntimeDataType::Enum => DataType::Enum,
        RuntimeDataType::EnumArray => DataType::EnumArray,
        RuntimeDataType::Object => DataType::Object,
        RuntimeDataType::ObjectArray => DataType::ObjectArray,
        RuntimeDataType::Json => DataType::Json,
        RuntimeDataType::JsonArray => DataType::JsonArray,
        RuntimeDataType::NavToOne => DataType::NavToOne,
        RuntimeDataType::NavToMany => DataType::NavToMany,
        RuntimeDataType::ManyToMany => DataType::ManyToMany,
    }
}

pub(crate) type HandlerContext = crate::platform::runtime::RuntimeHandlerContext<DataAccess, EntityType>;
