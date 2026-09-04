# role literals lowercased at the auth boundary; see spec 001 Q7
# gate_reviews: R authenticated (no scope today); U (decision) by admin OR the review's
# assigned_role. Derived from gate_review_service::submit_gate_decision (assigned_role or Admin).

# Admin: full access.
access := res if {
    check_schema_type()
    has_role(input.user, "admin")
    res := {"allow": true, "filter": {}}
}

# Any authenticated actor may read gate reviews.
access := res if {
    check_schema_type()
    input.action == "read"
    res := {"allow": true, "filter": {}}
}

# The assigned reviewer role may read and record the decision on gate reviews routed to it.
access := res if {
    check_schema_type()
    input.action in ["read", "update"]
    has_any_role(input.user, ["bta", "epmo", "finance", "vendor_screening", "analysis_team", "eac", "cab", "security", "taf", "trc", "pic", "project_manager"])
    res := {"allow": true, "filter": {"assigned_role": {"_eq": input.user.roles[0]}}}
}
