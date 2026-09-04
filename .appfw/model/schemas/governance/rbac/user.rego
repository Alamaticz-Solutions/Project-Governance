# role literals lowercased at the auth boundary; see spec 001 Q7
# bodies-only: the generator supplies package governance.user, import rego.v1,
# default access = {"allow": false}, check_schema_type(), has_role / has_any_role.

# Admin manages all users (create/read/update/delete).
access := res if {
    check_schema_type()
    has_role(input.user, "admin")
    res := {"allow": true, "filter": {}}
}

# EPMO can list and read every user.
access := res if {
    check_schema_type()
    input.action == "read"
    has_role(input.user, "epmo")
    res := {"allow": true, "filter": {}}
}

# Any other authenticated user can read only their own record.
access := res if {
    check_schema_type()
    input.action == "read"
    not has_any_role(input.user, ["admin", "epmo"])
    res := {"allow": true, "filter": {"id": {"_eq": input.user.id}}}  # ASSUMPTION: input.user.id present (spec 001 decision A); degrades to role-only if not
}
