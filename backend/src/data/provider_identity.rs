//! Product-owned provider identity and operation-contract types.
//!
//! This module ports the load-bearing pieces of provider identity that
//! `DatabaseClient` and `data_access.rs` depend on today, without pulling in
//! the App Framework's provider client/orchestration internals. See the
//! phase 5 sub-slice 2 port spec for the rationale behind what is and isn't
//! included here.

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProviderOperationRequirement {
    Required,
    Optional,
    LegacyCompatibility,
}

impl ProviderOperationRequirement {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Required => "required",
            Self::Optional => "optional",
            Self::LegacyCompatibility => "legacy_compatibility",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProviderOperationSurface {
    RuntimeNative,
    ProductPlanAdapter,
    ProductLegacyAdapter,
}

impl ProviderOperationSurface {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::RuntimeNative => "runtime_native",
            Self::ProductPlanAdapter => "product_plan_adapter",
            Self::ProductLegacyAdapter => "product_legacy_adapter",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProviderOperationContract {
    pub operation: appfw_runtime::RuntimeProviderOperation,
    pub requirement: ProviderOperationRequirement,
    pub surface: ProviderOperationSurface,
}

impl ProviderOperationContract {
    pub const fn required(
        operation: appfw_runtime::RuntimeProviderOperation,
        surface: ProviderOperationSurface,
    ) -> Self {
        Self {
            operation,
            requirement: ProviderOperationRequirement::Required,
            surface,
        }
    }

    pub const fn optional(
        operation: appfw_runtime::RuntimeProviderOperation,
        surface: ProviderOperationSurface,
    ) -> Self {
        Self {
            operation,
            requirement: ProviderOperationRequirement::Optional,
            surface,
        }
    }

    pub const fn legacy(
        operation: appfw_runtime::RuntimeProviderOperation,
        surface: ProviderOperationSurface,
    ) -> Self {
        Self {
            operation,
            requirement: ProviderOperationRequirement::LegacyCompatibility,
            surface,
        }
    }

    pub fn requirement_key(self) -> &'static str {
        self.requirement.as_str()
    }

    pub fn surface_key(self) -> &'static str {
        self.surface.as_str()
    }
}

impl ProviderOperationContract {
    pub const DATABASE_CLIENT: &'static [ProviderOperationContract] = &[
        Self::required(
            appfw_runtime::RuntimeProviderOperation::HealthCheck,
            ProviderOperationSurface::RuntimeNative,
        ),
        Self::optional(
            appfw_runtime::RuntimeProviderOperation::ExplainQueryPlan,
            ProviderOperationSurface::ProductPlanAdapter,
        ),
        Self::required(
            appfw_runtime::RuntimeProviderOperation::CreateItem,
            ProviderOperationSurface::ProductPlanAdapter,
        ),
        Self::required(
            appfw_runtime::RuntimeProviderOperation::UpdateItem,
            ProviderOperationSurface::ProductPlanAdapter,
        ),
        Self::required(
            appfw_runtime::RuntimeProviderOperation::DeleteItem,
            ProviderOperationSurface::ProductPlanAdapter,
        ),
        Self::required(
            appfw_runtime::RuntimeProviderOperation::FindItem,
            ProviderOperationSurface::ProductLegacyAdapter,
        ),
        Self::required(
            appfw_runtime::RuntimeProviderOperation::GetItems,
            ProviderOperationSurface::ProductPlanAdapter,
        ),
        Self::required(
            appfw_runtime::RuntimeProviderOperation::QueryItems,
            ProviderOperationSurface::ProductPlanAdapter,
        ),
        Self::optional(
            appfw_runtime::RuntimeProviderOperation::BatchFindItemsByIds,
            ProviderOperationSurface::ProductPlanAdapter,
        ),
        Self::optional(
            appfw_runtime::RuntimeProviderOperation::AggregateItems,
            ProviderOperationSurface::ProductPlanAdapter,
        ),
        Self::optional(
            appfw_runtime::RuntimeProviderOperation::AppendAuditEvent,
            ProviderOperationSurface::RuntimeNative,
        ),
        Self::optional(
            appfw_runtime::RuntimeProviderOperation::QueryAuditEvents,
            ProviderOperationSurface::RuntimeNative,
        ),
    ];
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProviderDescriptor {
    pub provider: appfw_runtime::provider_keys::FrameworkProvider,
    pub data_source_name: String,
}

impl ProviderDescriptor {
    pub fn new(
        provider: appfw_runtime::provider_keys::FrameworkProvider,
        data_source_name: impl Into<String>,
    ) -> Self {
        Self {
            provider,
            data_source_name: data_source_name.into(),
        }
    }

    pub fn provider_key(&self) -> &'static str {
        self.provider.key()
    }

    pub fn data_source_name(&self) -> &str {
        &self.data_source_name
    }

    pub fn opaque_pool_stats(&self) -> appfw_runtime::ProviderPoolStats {
        appfw_runtime::ProviderPoolStats::opaque(self.provider_key(), self.data_source_name())
    }

    pub fn unsupported_explain_diagnostic(&self) -> serde_json::Value {
        serde_json::json!({
            "status": "unsupported",
            "message": "safe provider EXPLAIN diagnostics are not implemented for this provider",
            "provider": self.provider_key(),
            "data_source": self.data_source_name(),
        })
    }
}

pub trait ProviderIdentity {
    fn data_source_name(&self) -> &str;

    fn framework_provider(&self) -> appfw_runtime::provider_keys::FrameworkProvider;

    fn provider_operation_contracts(&self) -> &'static [ProviderOperationContract] {
        ProviderOperationContract::DATABASE_CLIENT
    }

    fn provider_declares_operation(
        &self,
        operation: appfw_runtime::RuntimeProviderOperation,
    ) -> bool {
        self.provider_operation_contracts()
            .iter()
            .any(|contract| contract.operation == operation)
    }

    fn provider_descriptor(&self) -> ProviderDescriptor {
        ProviderDescriptor::new(self.framework_provider(), self.data_source_name())
    }

    fn pool_stats(&self) -> appfw_runtime::ProviderPoolStats {
        self.provider_descriptor().opaque_pool_stats()
    }
}

pub trait ProviderClient: Send + Sync + ProviderIdentity {}

impl<T> ProviderClient for T where T: Send + Sync + ProviderIdentity {}

#[cfg(test)]
mod tests {
    use super::*;
    use appfw_runtime::provider_keys::FrameworkProvider;
    use appfw_runtime::RuntimeProviderOperation;
    use serde_json::json;

    #[test]
    fn provider_descriptor_uses_canonical_provider_keys() {
        let descriptor = ProviderDescriptor::new(FrameworkProvider::Mssql, "crm_primary");

        assert_eq!(descriptor.provider_key(), "mssql");
        assert_eq!(descriptor.data_source_name(), "crm_primary");
        assert_eq!(
            descriptor.unsupported_explain_diagnostic(),
            json!({
                "status": "unsupported",
                "message": "safe provider EXPLAIN diagnostics are not implemented for this provider",
                "provider": "mssql",
                "data_source": "crm_primary",
            })
        );
        assert_eq!(descriptor.opaque_pool_stats().provider, "mssql");
    }

    #[test]
    fn provider_client_exposes_runtime_operation_contracts() {
        struct TestProvider;

        impl ProviderIdentity for TestProvider {
            fn data_source_name(&self) -> &str {
                "crm_primary"
            }

            fn framework_provider(&self) -> FrameworkProvider {
                FrameworkProvider::Postgres
            }
        }

        let provider = TestProvider;
        let descriptor = provider.provider_descriptor();
        let pool_stats = provider.pool_stats();
        let contracts = provider.provider_operation_contracts();

        assert_eq!(descriptor.provider, FrameworkProvider::Postgres);
        assert_eq!(descriptor.data_source_name(), "crm_primary");
        assert_eq!(pool_stats.provider, "postgres");
        assert_eq!(pool_stats.data_source, "crm_primary");
        assert!(!pool_stats.instrumented);
        assert_eq!(contracts.len(), 12);
        assert_eq!(
            contracts[0],
            ProviderOperationContract::required(
                RuntimeProviderOperation::HealthCheck,
                ProviderOperationSurface::RuntimeNative,
            )
        );
        assert_eq!(
            contracts
                .iter()
                .find(|contract| contract.operation == RuntimeProviderOperation::AppendAuditEvent)
                .expect("append audit contract")
                .surface_key(),
            "runtime_native"
        );
        assert_eq!(
            contracts
                .iter()
                .find(|contract| contract.operation == RuntimeProviderOperation::QueryItems)
                .expect("query items contract")
                .surface,
            ProviderOperationSurface::ProductPlanAdapter
        );
        assert!(provider.provider_declares_operation(RuntimeProviderOperation::BatchFindItemsByIds));
    }

    #[test]
    fn provider_identity_can_override_operation_contracts() {
        struct LimitedProvider;

        const LIMITED_CONTRACTS: &[ProviderOperationContract] = &[
            ProviderOperationContract::required(
                RuntimeProviderOperation::HealthCheck,
                ProviderOperationSurface::RuntimeNative,
            ),
            ProviderOperationContract::optional(
                RuntimeProviderOperation::ExplainQueryPlan,
                ProviderOperationSurface::ProductPlanAdapter,
            ),
        ];

        impl ProviderIdentity for LimitedProvider {
            fn data_source_name(&self) -> &str {
                "crm_primary"
            }

            fn framework_provider(&self) -> FrameworkProvider {
                FrameworkProvider::Mssql
            }

            fn provider_operation_contracts(&self) -> &'static [ProviderOperationContract] {
                LIMITED_CONTRACTS
            }
        }

        let provider = LimitedProvider;

        assert!(provider.provider_declares_operation(RuntimeProviderOperation::HealthCheck));
        assert!(provider.provider_declares_operation(RuntimeProviderOperation::ExplainQueryPlan));
        assert!(!provider.provider_declares_operation(RuntimeProviderOperation::QueryItems));
    }
}
