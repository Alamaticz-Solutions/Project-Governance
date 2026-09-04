//! Provider descriptor / key (mirrors `SalesforceProviderDescriptor`).

pub const PROVIDER_KEY: &str = "microsoft_graph";
pub const PROVIDER_DISPLAY: &str = "Microsoft Graph (Teams meetings + transcripts + directory)";
/// Pinned Graph API version — the only version the registered operations target.
pub const GRAPH_API_VERSION: &str = "v1.0";
pub const GRAPH_BASE: &str = "https://graph.microsoft.com/v1.0";

#[derive(Debug, Clone)]
pub struct GraphProviderDescriptor {
    pub key: &'static str,
    pub display: &'static str,
    pub api_version: &'static str,
    pub base_url: &'static str,
}

impl Default for GraphProviderDescriptor {
    fn default() -> Self {
        Self {
            key: PROVIDER_KEY,
            display: PROVIDER_DISPLAY,
            api_version: GRAPH_API_VERSION,
            base_url: GRAPH_BASE,
        }
    }
}
