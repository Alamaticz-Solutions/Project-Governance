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

    // --- Microsoft Graph (Teams meetings + transcripts) ---
    /// Entra tenant (directory) id.
    pub graph_tenant_id: String,
    /// Entra application (client) id of the registered portal app.
    pub graph_client_id: String,
    /// Client secret for the app registration. Secret store / `.env` only.
    pub graph_client_secret: String,
    /// Entra object id of the mailbox that hosts every portal-scheduled
    /// meeting (the meeting organizer).
    pub graph_organizer_user_id: String,
    /// Public HTTPS base URL this backend is reachable at, for Graph change
    /// notifications (dev: the ngrok URL; deployed: the Render URL).
    pub graph_notification_base_url: String,
    /// Shared secret echoed back in every Graph notification; mismatches are
    /// dropped.
    pub graph_notification_client_state: String,
    /// Requested lifetime, in minutes, for the transcript subscription
    /// (`communications/onlineMeetings/getAllTranscripts` allows ≤ ~4230).
    pub graph_subscription_minutes: i64,
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
            server_port: env::var("PORT")
                .or_else(|_| env::var("API_PORT"))
                .unwrap_or_else(|_| "8000".to_string())
                .parse()
                .unwrap_or(8000),

            graph_tenant_id: env_or("GRAPH_TENANT_ID", ""),
            graph_client_id: env_or("GRAPH_CLIENT_ID", ""),
            graph_client_secret: env_or("GRAPH_CLIENT_SECRET", ""),
            graph_organizer_user_id: env_or("GRAPH_ORGANIZER_USER_ID", ""),
            graph_notification_base_url: env_or("GRAPH_NOTIFICATION_BASE_URL", "")
                .trim_end_matches('/')
                .to_string(),
            graph_notification_client_state: env_or("GRAPH_NOTIFICATION_CLIENT_STATE", ""),
            graph_subscription_minutes: env_or("GRAPH_SUBSCRIPTION_MINUTES", "4230")
                .parse()
                .unwrap_or(4230),
        }
    }
}

impl AppConfig {
    /// True when enough Microsoft Graph config is present to schedule meetings
    /// and read transcripts via Graph. When false the portal falls back to
    /// issuing local-stub join links so the pipeline stays demoable offline.
    pub fn graph_enabled(&self) -> bool {
        !self.graph_tenant_id.is_empty()
            && !self.graph_client_id.is_empty()
            && !self.graph_client_secret.is_empty()
            && !self.graph_organizer_user_id.is_empty()
    }

    /// True when Graph change-notification subscriptions can be set up — needs
    /// a publicly reachable callback URL and a client-state secret on top of
    /// [`graph_enabled`](Self::graph_enabled).
    pub fn graph_notifications_enabled(&self) -> bool {
        self.graph_enabled()
            && !self.graph_notification_base_url.is_empty()
            && !self.graph_notification_client_state.is_empty()
    }
}
