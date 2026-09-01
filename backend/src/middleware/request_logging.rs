use std::time::Instant;

use axum::{extract::Request, middleware::Next, response::Response};

/// Logs `METHOD path -> status [Xms]` for every request — a direct port of
/// the legacy `RequestLoggingMiddleware`.
pub async fn log_requests(req: Request, next: Next) -> Response {
    let method = req.method().clone();
    let path = req.uri().path().to_string();
    let started = Instant::now();

    let response = next.run(req).await;

    tracing::info!(
        method = %method,
        path = %path,
        status = response.status().as_u16(),
        elapsed_ms = started.elapsed().as_millis() as u64,
        "request"
    );
    response
}
