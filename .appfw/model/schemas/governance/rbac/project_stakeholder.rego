# role literals lowercased at the auth boundary; see spec 001 Q7
# bodies-only: the generator supplies package governance.project_stakeholder, import rego.v1,
# default access = {"allow": false}, check_schema_type(), has_role / has_any_role.

# Admin manages all stakeholder entries.
access := res if {
    check_schema_type()
    has_role(input.user, "admin")
    res := {"allow": true, "filter": {}}
}

# EPMO manages stakeholder entries across all projects.
access := res if {
    check_schema_type()
    has_role(input.user, "epmo")
    res := {"allow": true, "filter": {}}
}

# Any authenticated user can read stakeholder entries.
access := res if {
    check_schema_type()
    input.action == "read"
    res := {"allow": true, "filter": {}}
}

# NOTE: create/update/delete by the owning project's manager is a parent-row ownership
# check (project.manager_id == actor) that Rego cannot express as a single-row predicate
# on this table; enforced in the service layer per spec 002 (authorization split).
