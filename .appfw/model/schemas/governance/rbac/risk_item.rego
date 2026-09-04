# role literals lowercased at the auth boundary; see spec 001 Q7
# Bodies only — the generator supplies package / imports / check_schema_type / helpers.
# Single-tenant: tenant_filter is never called.

# Admin — full access to all risk items.
access := res if {
	check_schema_type()
	has_role(input.user, "admin")
	res := {"allow": true, "filter": {}}
}

# Any authenticated role may read risk items.
# TODO project-scope once relationship sub-filters / project_ids claim available
access := res if {
	check_schema_type()
	input.action == "read"
	has_any_role(input.user, ["project_manager", "bta", "epmo", "finance", "vendor_screening", "analysis_team", "eac", "cab", "security", "taf", "trc", "pic", "viewer"])
	res := {"allow": true, "filter": {}}
}

# Security and project managers may create/update risk items.
# Project-owner scoping is not yet expressible as a single-row predicate.
# TODO project-scope once relationship sub-filters / project_ids claim available
access := res if {
	check_schema_type()
	input.action in ["create", "update"]
	has_any_role(input.user, ["project_manager", "security"])
	res := {"allow": true, "filter": {}}
}

# Delete is admin-only (covered by the admin allow-all rule above).
