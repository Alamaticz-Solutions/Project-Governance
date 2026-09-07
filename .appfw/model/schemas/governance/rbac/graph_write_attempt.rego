# role literals lowercased at the auth boundary; see spec 001 Q7
# M10 / G1 governed-write evidence ledger (append-only). Rows record who
# attempted which Microsoft Graph write and its outcome -- see
# services::graph::writes. Write is service-only in practice (the `writes`
# module is the sole creator); read is limited to the roles that can also
# perform the writes plus oversight roles. Single-tenant: tenant_filter is
# never called.

# Admin -- full access.
access := res if {
	check_schema_type()
	has_role(input.user, "admin")
	res := {"allow": true, "filter": {}}
}

# The write-capable roles (Admin/ProjectManager/EPMO -- provisional, tracks
# the P5 gate matrix) plus Security/CAB oversight may read the ledger.
access := res if {
	check_schema_type()
	input.action == "read"
	has_any_role(input.user, ["project_manager", "epmo", "security", "cab"])
	res := {"allow": true, "filter": {}}
}

# Create is written by the `services::graph::writes` path on behalf of a
# write-capable actor; the operation-level gate (G1.7) is enforced in code
# before this row is created, so mirror it here.
access := res if {
	check_schema_type()
	input.action == "create"
	has_any_role(input.user, ["project_manager", "epmo"])
	res := {"allow": true, "filter": {}}
}
