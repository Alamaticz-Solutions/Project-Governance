# role literals lowercased at the auth boundary; see spec 001 Q7
# gate_submissions is unguarded server-side today. Proposed (spec 001): R for admin, epmo and
# the project owner; C/U for the stage-owner role. The project-owner and stage-owner-role
# predicates depend on the parent Project row, which Rego cannot join to here — that scoping
# and create/update routing is enforced in the service layer (spec 002 authorization split).

# Admin: full access.
access := res if {
    check_schema_type()
    has_role(input.user, "admin")
    res := {"allow": true, "filter": {}}
}

# EPMO: read all gate submissions (oversight).
access := res if {
    check_schema_type()
    input.action == "read"
    has_role(input.user, "epmo")
    res := {"allow": true, "filter": {}}
}

# Any authenticated actor may read gate submissions (parity with today's unguarded read;
# tighten to project scope once parent-row scoping is available).
access := res if {
    check_schema_type()
    input.action == "read"
    res := {"allow": true, "filter": {}}
}
