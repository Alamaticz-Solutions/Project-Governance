# role literals lowercased at the auth boundary; see spec 001 Q7
# WorkflowDefinition is config-as-data: readable by every authenticated actor,
# writable only by governance administration (spec 001 checklist item 8).

# Admin: manage all workflow definitions.
access := res if {
    check_schema_type()
    has_role(input.user, "admin")
    res := {"allow": true, "filter": {}}
}

# EPMO: author and maintain workflow definitions.
access := res if {
    check_schema_type()
    input.action in ["create", "read", "update", "delete"]
    has_role(input.user, "epmo")
    res := {"allow": true, "filter": {}}
}

# Any authenticated actor may read workflow definitions.
access := res if {
    check_schema_type()
    input.action == "read"
    res := {"allow": true, "filter": {}}
}
