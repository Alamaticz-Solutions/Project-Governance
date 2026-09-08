//! Cross-cutting infrastructure for this crate: secret loading and tenant
//! scoping owned here, plus narrow re-export modules that give the rest of
//! the crate a stable path to the platform contracts it uses from
//! `appfw_runtime` (identifiers, policy access, record locators, user auth,
//! and the runtime facade).

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
