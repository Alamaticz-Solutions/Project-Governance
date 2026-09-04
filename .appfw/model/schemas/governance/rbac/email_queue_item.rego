# role literals lowercased at the auth boundary; see spec 001 Q7
# Table mirrored for schema fidelity; no product writer (spec 004).
# Single-tenant: tenant_filter is never called.

# Admin — full access.
access := res if {
	check_schema_type()
	has_role(input.user, "admin")
	res := {"allow": true, "filter": {}}
}

# Any authenticated role may read.
access := res if {
	check_schema_type()
	input.action == "read"
	has_any_role(input.user, ["project_manager", "bta", "epmo", "finance", "vendor_screening", "analysis_team", "eac", "cab", "security", "taf", "trc", "pic", "viewer"])
	res := {"allow": true, "filter": {}}
}
