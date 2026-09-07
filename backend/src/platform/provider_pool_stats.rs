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

// The bidirectional bridges to the framework's `ProviderPoolStats` that
// used to live here (backend framework replacement phase 7) are deleted
// as of slice 8: confirmed dead by grep before removal -- `PostgresClient`
// no longer implements the framework's fixed `RuntimeProviderIdentity`
// trait at all (it implements only the self-owned `ProviderIdentity`/
// `DatabaseClient`, see `postgres_client.rs`), and
// `platform::metrics::record_provider_pool_stats` takes this crate's own
// `ProviderPoolStats` directly, not the framework's. Nothing anywhere in
// `backend/src` constructed the framework-typed side any more.

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
