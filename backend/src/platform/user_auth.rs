//! Authenticated-principal type fed directly to the Rego (Open Policy Agent)
//! policy engine as `input.user`. Ported off `appfw_runtime` as an
//! independent reimplementation (backend framework replacement phases 4-5 --
//! docs/architecture/self-owned-backend-plan.md).
//!
//! The serialized shape of [`UserAuth`] is load-bearing: 42 separately
//! authored access policies read this struct's JSON representation. Field
//! names, and whether an absent `Option` serializes as a missing key versus
//! `null`, must match exactly -- there is no compiler error for getting this
//! wrong, only a silently different policy decision.

use std::fmt;

use serde::{Deserialize, Serialize};

/// The kind of principal a request is authenticated as.
#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RuntimePrincipalType {
    #[default]
    User,
    Service,
    Agent,
}

/// An authenticated principal, evaluated against access policies as
/// `input.user`.
///
/// `token` is intentionally excluded from `Debug` output and from
/// serialization entirely (see field docs below) so it can never leak into
/// policy input, GraphQL responses, or logs.
#[derive(Clone, Serialize, Deserialize, Eq, PartialEq)]
pub struct UserAuth {
    pub tenant_id: String,
    pub user_name: String,
    pub timezone: String,
    #[serde(default)]
    pub principal_type: RuntimePrincipalType,
    /// Absent from serialized JSON entirely when `None` (not `null`) --
    /// policies that test key presence depend on this.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub on_behalf_of: Option<String>,
    /// Absent from serialized JSON entirely when `None` (not `null`) --
    /// policies that test key presence depend on this.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ingress: Option<String>,
    pub roles: Vec<String>,
    pub scopes: Vec<String>,
    /// The raw bearer JWT. Never serialized under any circumstance (the key
    /// does not appear in output at all, not even as `null`); accepted on
    /// deserialize via `default` (`""` when absent) for type-level
    /// correctness, though nothing in this codebase currently deserializes a
    /// `UserAuth` from external JSON.
    #[serde(skip_serializing, default)]
    pub token: String,
}

impl fmt::Debug for UserAuth {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("UserAuth")
            .field("tenant_id", &self.tenant_id)
            .field("user_name", &self.user_name)
            .field("timezone", &self.timezone)
            .field("principal_type", &self.principal_type)
            .field("on_behalf_of", &self.on_behalf_of)
            .field("ingress", &self.ingress)
            .field("roles", &self.roles)
            .field("scopes", &self.scopes)
            .field("token", &"<redacted>")
            .finish()
    }
}

impl UserAuth {
    /// Build a principal for a human user authenticated via a user-facing
    /// bearer JWT over HTTP.
    pub fn human(
        tenant_id: impl Into<String>,
        user_name: impl Into<String>,
        timezone: impl Into<String>,
        roles: Vec<String>,
        scopes: Vec<String>,
        token: impl Into<String>,
    ) -> Self {
        Self {
            tenant_id: tenant_id.into(),
            user_name: user_name.into(),
            timezone: timezone.into(),
            principal_type: RuntimePrincipalType::User,
            on_behalf_of: None,
            ingress: Some("http".to_string()),
            roles,
            scopes,
            token: token.into(),
        }
    }

    /// Build a principal for a service-to-service caller. Services are never
    /// authenticated via a user-facing bearer JWT in this codebase's model.
    pub fn service(
        tenant_id: impl Into<String>,
        subject: impl Into<String>,
        roles: Vec<String>,
        scopes: Vec<String>,
    ) -> Self {
        Self {
            tenant_id: tenant_id.into(),
            user_name: subject.into(),
            timezone: "UTC".to_string(),
            principal_type: RuntimePrincipalType::Service,
            on_behalf_of: None,
            ingress: None,
            roles,
            scopes,
            token: String::new(),
        }
    }

    /// Build a principal for an autonomous agent caller. Agents are never
    /// authenticated via a user-facing bearer JWT in this codebase's model.
    pub fn agent(
        tenant_id: impl Into<String>,
        subject: impl Into<String>,
        roles: Vec<String>,
        scopes: Vec<String>,
    ) -> Self {
        Self {
            tenant_id: tenant_id.into(),
            user_name: subject.into(),
            timezone: "UTC".to_string(),
            principal_type: RuntimePrincipalType::Agent,
            on_behalf_of: None,
            ingress: None,
            roles,
            scopes,
            token: String::new(),
        }
    }

    pub fn with_ingress(mut self, ingress: impl Into<String>) -> Self {
        self.ingress = Some(ingress.into());
        self
    }

    pub fn with_on_behalf_of(mut self, subject: impl Into<String>) -> Self {
        self.on_behalf_of = Some(subject.into());
        self
    }

    /// The subject a policy decision should actually be evaluated against:
    /// `on_behalf_of` when set, otherwise `user_name`.
    pub fn effective_subject(&self) -> &str {
        self.on_behalf_of.as_deref().unwrap_or(&self.user_name)
    }

    pub fn has_role(&self, role: &str) -> bool {
        self.roles.iter().any(|candidate| candidate == role)
    }

    pub fn has_scope(&self, scope: &str) -> bool {
        self.scopes.iter().any(|candidate| candidate == scope)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_auth_matches_roles_and_scopes_exactly() {
        let user = UserAuth::human(
            "tenant-1",
            "casey",
            "UTC",
            vec!["admin".to_string(), "analyst".to_string()],
            vec!["appfw:mcp.read".to_string()],
            "token",
        );

        assert!(user.has_role("admin"));
        assert!(!user.has_role("adm"));
        assert!(user.has_scope("appfw:mcp.read"));
        assert!(!user.has_scope("appfw:mcp"));
    }

    #[test]
    fn user_auth_never_leaks_raw_token() {
        const SECRET_JWT: &str = "header.payload.signature-super-secret-jwt";

        let user = UserAuth::human(
            "tenant-1",
            "casey",
            "UTC",
            vec!["admin".to_string()],
            vec!["appfw:mcp.read".to_string()],
            SECRET_JWT,
        );

        let serialized = serde_json::to_string(&user).expect("user serializes");
        assert!(
            !serialized.contains(SECRET_JWT),
            "serialized UserAuth leaked the raw JWT: {serialized}"
        );
        assert!(
            !serialized.contains("token"),
            "serialized UserAuth still emits a token field: {serialized}"
        );
        assert!(serialized.contains("tenant-1"));
        assert!(serialized.contains("casey"));
        assert!(serialized.contains("admin"));

        let debug = format!("{user:?}");
        assert!(
            !debug.contains(SECRET_JWT),
            "Debug output leaked the raw JWT: {debug}"
        );
        assert!(
            debug.contains("<redacted>"),
            "Debug should redact token: {debug}"
        );
        assert!(
            debug.contains("casey"),
            "Debug should keep readable fields: {debug}"
        );
    }

    #[test]
    fn user_auth_serializes_principal_envelope_for_policy_input() {
        let service = UserAuth::service(
            "tenant-1",
            "crm-event-consumer",
            vec!["integration_writer".to_string()],
            vec!["crm.account.write".to_string()],
        )
        .with_ingress("kafka")
        .with_on_behalf_of("casey");

        let serialized = serde_json::to_value(&service).expect("service user serializes");
        assert_eq!(serialized["principal_type"], "service");
        assert_eq!(serialized["ingress"], "kafka");
        assert_eq!(serialized["on_behalf_of"], "casey");
        assert_eq!(service.effective_subject(), "casey");
    }

    #[test]
    fn user_auth_omits_absent_optional_fields_entirely_rather_than_nulling_them() {
        let user = UserAuth::service(
            "tenant-1",
            "crm-event-consumer",
            vec!["integration_writer".to_string()],
            vec!["crm.account.write".to_string()],
        );

        let serialized = serde_json::to_value(&user).expect("user serializes");
        let obj = serialized.as_object().expect("serializes to an object");
        assert!(
            !obj.contains_key("on_behalf_of"),
            "on_behalf_of must be entirely absent when None, not null: {serialized}"
        );
        assert!(
            !obj.contains_key("ingress"),
            "ingress must be entirely absent when None, not null: {serialized}"
        );
        assert!(
            !obj.contains_key("token"),
            "token must never be serialized at all: {serialized}"
        );
    }
}
