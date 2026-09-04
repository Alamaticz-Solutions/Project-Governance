# role literals lowercased at the auth boundary; see spec 001 Q7
# task_assignments is unwired today. Proposed: admin manage all; an assignee sees and updates
# (accept / complete) only their own assignments.

# Admin: full access.
access := res if {
    check_schema_type()
    has_role(input.user, "admin")
    res := {"allow": true, "filter": {}}
}

# EPMO: read all assignments (oversight).
access := res if {
    check_schema_type()
    input.action == "read"
    has_role(input.user, "epmo")
    res := {"allow": true, "filter": {}}
}

# An assignee may read and update their own assignment rows.
# ASSUMPTION: input.user.id present (spec 001 decision A)
access := res if {
    check_schema_type()
    input.action in ["read", "update"]
    res := {"allow": true, "filter": {"assignee_id": {"_eq": input.user.id}}}
}
