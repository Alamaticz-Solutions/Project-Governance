//! Connection-pool statistics a provider can report for observability
//! (`opaque` when a provider doesn't expose real numbers, `instrumented`
//! when it does). Ported near-verbatim off
//! `appfw_runtime::provider_pool_stats` (backend framework replacement
//! phase 7, slice 5 -- docs/architecture/self-owned-backend-plan.md):
//! plain data plus two constructors, no framework machinery.

#[derive(Clone, Debug, serde::Serialize)]
pub struct ProviderPoolStats {
    pub provider: String,
    pub data_source: String,
    pub instrumented: bool,
    pub max_size: Option<u64>,
    pub size: Option<u64>,
    pub available: Option<u64>,
    pub in_use: Option<u64>,
    pub waiting: Option<u64>,
    pub pressure: Option<f64>,
}

impl ProviderPoolStats {
    pub fn instrumented(
        provider: impl Into<String>,
        data_source: impl Into<String>,
        max_size: u64,
        size: u64,
        available: u64,
        waiting: u64,
    ) -> Self {
        let in_use = size.saturating_sub(available);
        let pressure = if max_size == 0 {
            0.0
        } else {
            (in_use + waiting) as f64 / max_size as f64
        };
        Self {
            provider: provider.into(),
            data_source: data_source.into(),
            instrumented: true,
            max_size: Some(max_size),
            size: Some(size),
            available: Some(available),
            in_use: Some(in_use),
            waiting: Some(waiting),
            pressure: Some(pressure),
        }
    }

    pub fn opaque(provider: impl Into<String>, data_source: impl Into<String>) -> Self {
        Self {
            provider: provider.into(),
            data_source: data_source.into(),
            instrumented: false,
            max_size: None,
            size: None,
            available: None,
            in_use: None,
            waiting: None,
            pressure: None,
        }
    }
}

// Bidirectional bridges to the framework's still-live `ProviderPoolStats`:
// `PostgresClient`'s `impl RuntimeProviderIdentity` (fixed trait, see that
// file's own comment) still returns the framework's type, and
// `observability::metrics::record_provider_pool_stats` (still
// framework-owned, deferred to a later slice) still takes it as a
// parameter -- so `data_access.rs::pool_stats()` needs to convert inbound,
// and its callers need to convert outbound, at this one boundary each way.
impl From<appfw_runtime::ProviderPoolStats> for ProviderPoolStats {
    fn from(stats: appfw_runtime::ProviderPoolStats) -> Self {
        Self {
            provider: stats.provider,
            data_source: stats.data_source,
            instrumented: stats.instrumented,
            max_size: stats.max_size,
            size: stats.size,
            available: stats.available,
            in_use: stats.in_use,
            waiting: stats.waiting,
            pressure: stats.pressure,
        }
    }
}

impl From<ProviderPoolStats> for appfw_runtime::ProviderPoolStats {
    fn from(stats: ProviderPoolStats) -> Self {
        Self {
            provider: stats.provider,
            data_source: stats.data_source,
            instrumented: stats.instrumented,
            max_size: stats.max_size,
            size: stats.size,
            available: stats.available,
            in_use: stats.in_use,
            waiting: stats.waiting,
            pressure: stats.pressure,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opaque_stats_report_no_numbers() {
        let stats = ProviderPoolStats::opaque("postgres", "crm_primary");
        assert_eq!(stats.provider, "postgres");
        assert_eq!(stats.data_source, "crm_primary");
        assert!(!stats.instrumented);
        assert!(stats.max_size.is_none());
        assert!(stats.pressure.is_none());
    }

    #[test]
    fn instrumented_stats_compute_in_use_and_pressure() {
        let stats = ProviderPoolStats::instrumented("postgres", "crm_primary", 10, 8, 3, 1);
        assert!(stats.instrumented);
        assert_eq!(stats.in_use, Some(5));
        assert_eq!(stats.pressure, Some(0.6));
    }

    #[test]
    fn instrumented_stats_avoid_division_by_zero_at_max_size_zero() {
        let stats = ProviderPoolStats::instrumented("postgres", "crm_primary", 0, 0, 0, 0);
        assert_eq!(stats.pressure, Some(0.0));
    }
}
