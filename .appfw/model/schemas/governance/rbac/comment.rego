# role literals lowercased at the auth boundary; see spec 001 Q7
# Single-tenant: tenant_filter is never called.

# Admin — full access.
access := res if {
	check_schema_type()
	has_role(input.user, "admin")
	res := {"allow": true, "filter": {}}
}

# Any authenticated role may read and create comments.
access := res if {
	check_schema_type()
	input.action in ["read", "create"]
	has_any_role(input.user, ["project_manager", "bta", "epmo", "finance", "vendor_screening", "analysis_team", "eac", "cab", "security", "taf", "trc", "pic", "viewer"])
	res := {"allow": true, "filter": {}}
}

# Authors may update/delete only their own comments.
# ASSUMPTION: input.user.id present (spec 001 decision A)
access := res if {
	check_schema_type()
	input.action in ["update", "delete"]
	res := {"allow": true, "filter": {"author_id": {"_eq": input.user.id}}}
}
