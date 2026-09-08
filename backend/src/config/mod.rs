//! Application configuration: `loader` reads the schema/data-source config
//! from disk and resolves secrets; `app_config` is the resolved `AppConfig`
//! the rest of the crate queries for entity metadata and access rules.

pub(crate) mod loader;

pub(crate) mod app_config;
