# role literals lowercased at the auth boundary; see spec 001 Q7
# workflow_instances is unwired today (no inline check). Proposed: admin/epmo manage the
# per-project run; any authenticated actor may read. Per-project row scoping is not
# expressible here (no actor id on the instance row) and is enforced in the service layer
# (spec 002 authorization split).

# Admin: full access.
access := res if {
    check_schema_type()
    has_role(input.user, "admin")
    res := {"allow": true, "filter": {}}
}

# EPMO: manage workflow instances.
access := res if {
    check_schema_type()
    input.action in ["create", "read", "update", "delete"]
    has_role(input.user, "epmo")
    res := {"allow": true, "filter": {}}
}

# Any authenticated actor may read workflow instances.
access := res if {
    check_schema_type()
    input.action == "read"
    res := {"allow": true, "filter": {}}
}
