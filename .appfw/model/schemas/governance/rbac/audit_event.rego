# role literals lowercased at the auth boundary; see spec 001 Q7
# Append-only (ADR 0004): no update/delete rule at all, so the row is
# immutable once written regardless of caller.
# Single-tenant: tenant_filter is never called.
#
# `audit::record` (backend/src/services/audit.rs) writes through the same
# DataAccess::create_item path — and therefore the same Rego check — as any
# generated client mutation; there is no separate "service bypass". A
# deny-by-default create rule blocks the audit service itself (confirmed
# live: every governed action that calls audit::record after its own write
# succeeds surfaces "access denied" from the audit write). The create rule
# below allows any authenticated actor to append — every caller of
# audit::record has already passed require_user (and, for role-gated
# transitions, a role check) before the audit call is reached, so this does
# not widen who can act; it only lets the append that already-authorized
# action produces actually persist.

# Admin and EPMO may read the audit trail.
access := res if {
	check_schema_type()
	input.action == "read"
	has_any_role(input.user, ["admin", "epmo"])
	res := {"allow": true, "filter": {}}
}

# Any authenticated actor may append an audit event.
access := res if {
	check_schema_type()
	input.action == "create"
	has_any_role(input.user, ["admin", "epmo", "project_manager", "bta", "finance", "vendor_screening", "analysis_team", "eac", "cab", "security", "taf", "trc", "pic", "viewer"])
	res := {"allow": true, "filter": {}}
}
