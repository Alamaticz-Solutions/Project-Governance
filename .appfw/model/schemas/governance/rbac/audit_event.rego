# role literals lowercased at the auth boundary; see spec 001 Q7
# Append-only (ADR 0004). No create/update/delete rule — the product `audit`
# service is the only writer and that is not a client action.
# Single-tenant: tenant_filter is never called.

# Admin and EPMO may read the audit trail.
access := res if {
	check_schema_type()
	input.action == "read"
	has_any_role(input.user, ["admin", "epmo"])
	res := {"allow": true, "filter": {}}
}
