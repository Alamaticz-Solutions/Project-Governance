# role literals lowercased at the auth boundary; see spec 001 Q7
# WorkflowStageDefinition is config-as-data: read for all authenticated, write admin/epmo only
# (spec 001 checklist item 7).

# Admin: manage all stage definitions.
access := res if {
    check_schema_type()
    has_role(input.user, "admin")
    res := {"allow": true, "filter": {}}
}

# EPMO: author and maintain stage definitions.
access := res if {
    check_schema_type()
    input.action in ["create", "read", "update", "delete"]
    has_role(input.user, "epmo")
    res := {"allow": true, "filter": {}}
}

# Any authenticated actor may read stage definitions.
access := res if {
    check_schema_type()
    input.action == "read"
    res := {"allow": true, "filter": {}}
}
