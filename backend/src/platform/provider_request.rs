//! The `(plan, user, access)` bundle every provider-plan-based operation
//! (`create_item_plan_json`, `query_items_plan_json`, ...) receives. Ported
//! near-verbatim off `appfw_runtime::provider_request` (backend framework
//! replacement phase 7, slice 5 --
//! docs/architecture/self-owned-backend-plan.md): a plain generic wrapper
//! with no framework machinery in it.
//!
//! `user`/`access` stay references to whatever `UserAuth`/`PolicyAccess`
//! currently resolve to at the call site (still the framework's types via
//! the facade, pending slice 3's remainder) -- this module doesn't change
//! that, it only ports the wrapper struct holding them.

#[derive(Clone, Debug)]
pub struct RuntimeProviderPlanInput<'a, P> {
    pub plan: P,
    pub user: &'a crate::platform::runtime::extension::UserAuth,
    pub access: &'a crate::platform::runtime::PolicyAccess,
}

impl<'a, P> RuntimeProviderPlanInput<'a, P> {
    pub fn new(
        plan: P,
        user: &'a crate::platform::runtime::extension::UserAuth,
        access: &'a crate::platform::runtime::PolicyAccess,
    ) -> Self {
        Self { plan, user, access }
    }

    pub fn plan(&self) -> &P {
        &self.plan
    }

    pub fn user(&self) -> &'a crate::platform::runtime::extension::UserAuth {
        self.user
    }

    pub fn access(&self) -> &'a crate::platform::runtime::PolicyAccess {
        self.access
    }

    pub fn into_parts(
        self,
    ) -> (
        P,
        &'a crate::platform::runtime::extension::UserAuth,
        &'a crate::platform::runtime::PolicyAccess,
    ) {
        (self.plan, self.user, self.access)
    }

    pub fn map_plan<Q>(self, map: impl FnOnce(P) -> Q) -> RuntimeProviderPlanInput<'a, Q> {
        RuntimeProviderPlanInput {
            plan: map(self.plan),
            user: self.user,
            access: self.access,
        }
    }
}

// Bridge from the framework's still-live `RuntimeProviderPlanInput`
// (fixed parameter type on `appfw_runtime::provider_bridge::
// RuntimeProviderDataClient`, implemented by `DatabaseClientRuntimeAdapter`
// until it's replaced) into this self-owned wrapper -- `user`/`access`
// are references to the same underlying types on both sides (that
// porting work is separate, slice 3's remainder), so this is a pure
// struct reshuffle, not a data conversion.
impl<'a, P> From<appfw_runtime::RuntimeProviderPlanInput<'a, P>> for RuntimeProviderPlanInput<'a, P> {
    fn from(input: appfw_runtime::RuntimeProviderPlanInput<'a, P>) -> Self {
        Self {
            plan: input.plan,
            user: input.user,
            access: input.access,
        }
    }
}

// The reverse direction: still needed at the handful of remaining call
// sites (the admin diagnose_query path) that build this self-owned wrapper
// but must hand it to a still-framework-owned function expecting the
// framework's own type.
impl<'a, P> From<RuntimeProviderPlanInput<'a, P>> for appfw_runtime::RuntimeProviderPlanInput<'a, P> {
    fn from(input: RuntimeProviderPlanInput<'a, P>) -> Self {
        Self {
            plan: input.plan,
            user: input.user,
            access: input.access,
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::platform::runtime::extension::UserAuth;
    use crate::platform::runtime::PolicyAccess;

    fn user() -> UserAuth {
        UserAuth::human(
            "tenant-1",
            "casey",
            "UTC",
            vec!["admin".to_string()],
            vec!["appfw:data.read".to_string()],
            "token",
        )
    }

    #[test]
    fn provider_plan_input_preserves_runtime_context() {
        let user = user();
        let access = PolicyAccess::allow_with_filter(json!({ "tenant_id": { "_eq": "tenant-1" } }));
        let input = RuntimeProviderPlanInput::new("query-plan", &user, &access);

        assert_eq!(input.plan(), &"query-plan");
        assert_eq!(input.user().user_name, "casey");
        assert_eq!(
            input.access().filter,
            Some(json!({ "tenant_id": { "_eq": "tenant-1" } }))
        );

        let mapped = input.map_plan(|plan| format!("{plan}:runtime"));
        let (plan, mapped_user, mapped_access) = mapped.into_parts();
        assert_eq!(plan, "query-plan:runtime");
        assert_eq!(mapped_user.tenant_id, "tenant-1");
        assert!(mapped_access.allow);
    }
}
