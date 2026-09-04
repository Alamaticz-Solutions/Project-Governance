# role literals lowercased at the auth boundary; see spec 001 Q7
# Read-only companion audit entity (audited facet, ADR 0004).
# Single-tenant: tenant_filter is never called.

access := res if {
	check_schema_type()
	input.action == "read"
	has_any_role(input.user, ["admin", "epmo"])
	res := {"allow": true, "filter": {}}
}
