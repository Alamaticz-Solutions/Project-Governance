# role literals lowercased at the auth boundary; see spec 001 Q7
# project_approvals: admin/epmo see all; every other reviewer role sees and decides only the
# approvals addressed to their role. Worked example from project_service::get_pending_approvals
# (spec 001 — cleanest real row filter in the legacy codebase).

# Admin and EPMO: full visibility and decision rights.
access := res if {
    check_schema_type()
    has_any_role(input.user, ["admin", "epmo"])
    res := {"allow": true, "filter": {}}
}

# An assigned reviewer role sees and decides only approvals routed to it.
access := res if {
    check_schema_type()
    input.action in ["read", "update"]
    has_any_role(input.user, ["bta", "finance", "vendor_screening", "analysis_team", "eac", "cab", "security", "taf", "trc", "pic", "project_manager"])
    res := {"allow": true, "filter": {"assigned_role": {"_eq": input.user.roles[0]}}}
}
