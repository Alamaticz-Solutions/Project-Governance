//! Product-owned cross-cutting infrastructure: secret loading and tenant scoping,
//! with re-export shims to appfw_runtime for platform contracts.

pub(crate) mod identifier {
    pub use appfw_runtime::identifier::*;
}

pub(crate) mod policy {
    pub use appfw_runtime::{AccessAction, PolicyAccess};
}

pub(crate) mod record_locator {
    pub use appfw_runtime::record_locator::*;
}

pub(crate) mod runtime;

pub(crate) mod secrets;

pub(crate) mod tenant_isolation;

pub(crate) mod user_auth {
    pub use appfw_runtime::extension::{RuntimePrincipalType, UserAuth};
}
