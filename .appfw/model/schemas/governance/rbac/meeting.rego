# role literals lowercased at the auth boundary; see spec 001 Q7
# transcript_text / transcript_vtt / summary are PHI-risk free text (inventory).
# Organizer-scoped write needs an actor id we do not yet have — role-only for now.
# Single-tenant: tenant_filter is never called.

# Admin — full access.
access := res if {
	check_schema_type()
	has_role(input.user, "admin")
	res := {"allow": true, "filter": {}}
}

# Any authenticated role may read meetings.
access := res if {
	check_schema_type()
	input.action == "read"
	has_any_role(input.user, ["project_manager", "bta", "epmo", "finance", "vendor_screening", "analysis_team", "eac", "cab", "security", "taf", "trc", "pic", "viewer"])
	res := {"allow": true, "filter": {}}
}

# EPMO may create/update meetings.
access := res if {
	check_schema_type()
	input.action in ["create", "update"]
	has_role(input.user, "epmo")
	res := {"allow": true, "filter": {}}
}

# Delete is admin-only (covered by the admin allow-all rule above).
