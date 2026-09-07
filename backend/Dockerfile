# Backend container image for the self-owned governance stack.
#
# Added 2026-09-07 (manual bring-up gap #6): the old `podman-compose.yml`
# ran the backend as `image: rust:latest` + a bind mount of `./backend` and
# `../app-framework/appfw_runtime`, and `../app-framework/` no longer exists
# (backend framework replacement phase 7 final cutover). This replaces that
# with a self-contained multi-stage build of the workspace `backend` binary.
#
# Build context is the REPOSITORY ROOT (governance-appfw/), not backend/:
#   podman build -f backend/Dockerfile -t governance-backend .
# `podman-compose.yml` already sets `context: .` / `dockerfile: backend/Dockerfile`.
#
# NOTE: this file has not been built/run on the authoring machine (no spare
# disk for a full Rust image build here) -- it is written to the runtime
# contract verified by reading the code (see below) and should be smoke-
# tested before being relied on:
#   * backend reads config from `${CWD}/config/generated/**`
#     (backend/src/config/loader.rs::read_config) -> workdir must be /app
#     with config/generated copied in.
#   * SPA dist dir is `${APP_PRODUCT_UI_DIST_DIR}` or `<manifest>/product_dist`
#     (backend/src/platform/product_ui.rs) -- we set APP_PRODUCT_UI_DIST_DIR
#     in compose. Missing dist only warns, it is not fatal.
#   * worker-thread stack size is BACKEND_WORKER_STACK_MIB (default 128),
#     handled in backend/src/main.rs -- no RUST_MIN_STACK needed.

# ---- stage 1: build the SPA (optional; only used to serve the UI) --------
FROM node:22-bookworm-slim AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
# vite.config.ts writes to ../backend/product_dist
RUN npm run build

# ---- stage 2: build the backend binary ----------------------------------
FROM rust:1.98-bookworm AS builder
WORKDIR /src
COPY . .
RUN cargo build --release -p backend --bin backend

# ---- stage 3: runtime --------------------------------------------------
FROM debian:bookworm-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /src/target/release/backend /usr/local/bin/backend
COPY --from=builder /src/backend/config ./config
COPY --from=frontend /src/backend/product_dist ./product_dist
ENV APP_PRODUCT_UI_DIST_DIR=/app/product_dist
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/backend"]
