# role literals lowercased at the auth boundary; see spec 001 Q7
# bodies-only: the generator supplies package governance.project, import rego.v1,
# default access = {"allow": false}, check_schema_type(), has_role / has_any_role.
# Legacy "delete" is a soft cancel (status -> CANCELLED); the framework `delete` action
# is restricted to {admin, epmo} here and the real transition lives in a custom method (spec 002).

# Admin manages all projects.
access := res if {
    check_schema_type()
    has_role(input.user, "admin")
    res := {"allow": true, "filter": {}}
}

# Any authenticated user can create a project (self becomes manager_id) and read all projects.
access := res if {
    check_schema_type()
    input.action in ["create", "read"]
    res := {"allow": true, "filter": {}}
}

# EPMO can update or delete (cancel) any project.
access := res if {
    check_schema_type()
    input.action in ["update", "delete"]
    has_role(input.user, "epmo")
    res := {"allow": true, "filter": {}}
}

# The managing user can update their own project (any role; matches project_service.rs is_owner).
access := res if {
    check_schema_type()
    input.action == "update"
    not has_any_role(input.user, ["admin", "epmo"])
    res := {"allow": true, "filter": {"manager_id": {"_eq": input.user.id}}}  # ASSUMPTION: input.user.id present (spec 001 decision A); degrades to role-only if not
}
