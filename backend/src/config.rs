use std::env;

/// Immutable, process-wide configuration loaded once at boot from environment
/// variables (`.env` in local dev). Mirrors `app/core/config.py` from the
/// legacy FastAPI backend.
#[derive(Clone, Debug)]
pub struct AppConfig {
    pub app_name: String,
    pub app_version: String,
    pub debug: bool,
    pub environment: String,

    pub database_url: String,

    pub jwt_secret: String,
    pub access_token_expire_minutes: i64,
    pub refresh_token_expire_days: i64,

    pub allowed_origins: Vec<String>,

    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_user: String,
    pub smtp_password: String,
    pub email_from: String,
    pub email_from_name: String,

    pub openai_api_key: String,
    pub openai_model: String,

    pub server_host: String,
    pub server_port: u16,

    // --- Microsoft Graph / Teams (Teams meeting + VTT POC) ---
    pub graph_tenant_id: String,
    pub graph_client_id: String,
    pub graph_client_secret: String,
    /// AAD object id of the user Teams meetings are created "as" and whose
    /// transcripts are read (must be covered by a Teams application access policy).
    pub graph_default_organizer_id: String,
    pub graph_default_organizer_email: String,
    /// Shared secret echoed back in every Graph change-notification (`clientState`).
    pub graph_webhook_client_state: String,
    /// Public HTTPS URL Graph should POST transcript notifications to.
    pub graph_notification_url: String,
}

fn env_or(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

impl AppConfig {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let allowed_origins = env_or("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Self {
            app_name: env_or("APP_NAME", "ABC Health Project Governance Portal"),
            app_version: env_or("APP_VERSION", "2.0.0"),
            debug: env_or("DEBUG", "false").parse().unwrap_or(false),
            environment: env_or("ENVIRONMENT", "development"),

            database_url: env_or(
                "DATABASE_URL",
                "postgres://postgres:password@localhost:5432/governance_db",
            ),

            jwt_secret: env_or(
                "SECRET_KEY",
                "super-secret-key-change-in-production-must-be-32-chars-min",
            ),
            access_token_expire_minutes: env_or("ACCESS_TOKEN_EXPIRE_MINUTES", "480")
                .parse()
                .unwrap_or(480),
            refresh_token_expire_days: env_or("REFRESH_TOKEN_EXPIRE_DAYS", "7")
                .parse()
                .unwrap_or(7),

            allowed_origins,

            smtp_host: env_or("SMTP_HOST", "smtp.office365.com"),
            smtp_port: env_or("SMTP_PORT", "587").parse().unwrap_or(587),
            smtp_user: env_or("SMTP_USER", ""),
            smtp_password: env_or("SMTP_PASSWORD", ""),
            email_from: env_or("EMAIL_FROM", "noreply@abchealth.com"),
            email_from_name: env_or("EMAIL_FROM_NAME", "ABC Governance Portal"),

            openai_api_key: env_or("OPENAI_API_KEY", ""),
            openai_model: env_or("OPENAI_MODEL", "gpt-4o-mini"),

            server_host: env_or("SERVER_HOST", "0.0.0.0"),
            server_port: env_or("API_PORT", "8000").parse().unwrap_or(8000),

            graph_tenant_id: env_or("GRAPH_TENANT_ID", ""),
            graph_client_id: env_or("GRAPH_CLIENT_ID", ""),
            graph_client_secret: env_or("GRAPH_CLIENT_SECRET", ""),
            graph_default_organizer_id: env_or("GRAPH_DEFAULT_ORGANIZER_ID", ""),
            graph_default_organizer_email: env_or("GRAPH_DEFAULT_ORGANIZER_EMAIL", ""),
            graph_webhook_client_state: env_or("GRAPH_WEBHOOK_CLIENT_STATE", "poc-teams-vtt-secret"),
            graph_notification_url: env_or("GRAPH_NOTIFICATION_URL", ""),
        }
    }
}

impl AppConfig {
    /// True only when all three app-registration credentials are present.
    /// When false, the POC falls back to local-stub meetings + manual VTT
    /// ingest so the end-to-end flow is still demoable without an Azure tenant.
    pub fn graph_configured(&self) -> bool {
        !self.graph_tenant_id.is_empty()
            && !self.graph_client_id.is_empty()
            && !self.graph_client_secret.is_empty()
    }
}
