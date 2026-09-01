use lettre::{
    message::header::ContentType, transport::smtp::authentication::Credentials, AsyncSmtpTransport,
    AsyncTransport, Message, Tokio1Executor,
};
use serde_json::Value;

use crate::{config::AppConfig, error::{AppError, AppResult}};

/// Sends a copy of the intake wizard responses to the given email.
/// Mirrors `core/email.py::send_intake_copy_email`: if SMTP credentials
/// aren't configured, this logs a "mock send" instead of failing, so local
/// dev / demo environments work without a real mailbox.
pub async fn send_intake_copy_email(
    config: &AppConfig,
    to_email: &str,
    project_id: &str,
    data: &Value,
) -> AppResult<String> {
    if config.smtp_user.is_empty() {
        tracing::info!(to = to_email, project_id, "SMTP not configured — mock-sending intake email");
        return Ok("Mock email logged (SMTP not configured)".to_string());
    }

    let html_body = render_intake_email_html(project_id, data);

    let email = Message::builder()
        .from(format!("{} <{}>", config.email_from_name, config.email_from).parse()
            .map_err(|e| AppError::Internal(anyhow::anyhow!("invalid from address: {e}")))?)
        .to(to_email.parse()
            .map_err(|e| AppError::Internal(anyhow::anyhow!("invalid recipient address: {e}")))?)
        .subject(format!("Your Project Intake Submission — {project_id}"))
        .header(ContentType::TEXT_HTML)
        .body(html_body)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("failed to build email: {e}")))?;

    let creds = Credentials::new(config.smtp_user.clone(), config.smtp_password.clone());
    let mailer: AsyncSmtpTransport<Tokio1Executor> =
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&config.smtp_host)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("smtp relay setup failed: {e}")))?
            .port(config.smtp_port)
            .credentials(creds)
            .build();

    mailer
        .send(email)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("failed to send email: {e}")))?;

    Ok("Email sent".to_string())
}

fn render_intake_email_html(project_id: &str, data: &Value) -> String {
    let pretty = serde_json::to_string_pretty(data).unwrap_or_default();
    format!(
        "<h2>Project Intake Copy</h2><p>Project reference: {project_id}</p><pre>{pretty}</pre>"
    )
}
