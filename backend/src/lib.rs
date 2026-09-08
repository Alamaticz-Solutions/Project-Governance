//! Shared compile-time constants identifying this product (name, schema, and
//! backing database provider). The runnable backend lives in the `backend`
//! binary (`main.rs`); this library exists only to expose these constants.

pub const APP_NAME: &str = "governance";
pub const PRODUCT_SCHEMA: &str = "governance";
pub const BACKEND_PROVIDER: &str = "PostgreSQL";
