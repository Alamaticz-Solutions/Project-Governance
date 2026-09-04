# role literals lowercased at the auth boundary; see spec 001 Q7
# checklist_items is unwired today. Proposed: admin manage all; any authenticated actor may
# read; an actor may update (tick / untick) an item they completed. Parent task/stage
# ownership for who may tick an item is enforced in the service layer (spec 002 authz split).

# Admin: full access.
access := res if {
    check_schema_type()
    has_role(input.user, "admin")
    res := {"allow": true, "filter": {}}
}

# Any authenticated actor may read checklist items.
access := res if {
    check_schema_type()
    input.action == "read"
    res := {"allow": true, "filter": {}}
}

# An actor may update checklist items they completed.
# ASSUMPTION: input.user.id present (spec 001 decision A)
access := res if {
    check_schema_type()
    input.action == "update"
    res := {"allow": true, "filter": {"completed_by_id": {"_eq": input.user.id}}}
}
