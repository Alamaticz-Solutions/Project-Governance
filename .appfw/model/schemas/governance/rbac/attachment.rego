# role literals lowercased at the auth boundary; see spec 001 Q7
# Attachments are PHI-adjacent (uploaded clinical/vendor intake docs) — must be
# project-scoped, MUST NOT ship as filter: {} long-term.
# TODO project-scope once relationship sub-filters / project_ids claim available
# Single-tenant: tenant_filter is never called.

# Admin — full access.
access := res if {
	check_schema_type()
	has_role(input.user, "admin")
	res := {"allow": true, "filter": {}}
}

# EPMO — full access (governance oversight).
access := res if {
	check_schema_type()
	has_role(input.user, "epmo")
	res := {"allow": true, "filter": {}}
}

# Project-delivery roles may read and create attachments (interim role-only scoping).
access := res if {
	check_schema_type()
	input.action in ["read", "create"]
	has_any_role(input.user, ["project_manager", "bta", "finance", "eac", "pic", "trc", "security", "analysis_team"])
	res := {"allow": true, "filter": {}}
}

# Delete is admin-only (covered by the admin allow-all rule above).
