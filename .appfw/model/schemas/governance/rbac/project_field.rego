# role literals lowercased at the auth boundary; see spec 001 Q7
# bodies-only: the generator supplies package governance.project_field, import rego.v1,
# default access = {"allow": false}, check_schema_type(), has_role / has_any_role.

# Admin manages all project fields.
access := res if {
    check_schema_type()
    has_role(input.user, "admin")
    res := {"allow": true, "filter": {}}
}

# EPMO can read and update project fields across all projects.
access := res if {
    check_schema_type()
    input.action in ["read", "update"]
    has_role(input.user, "epmo")
    res := {"allow": true, "filter": {}}
}

# NOTE: project-manager and per-stage-owner-role scoping needs a parent-row
# (project_id IN owned/assigned) sub-filter Rego cannot express here; enforced in the
# service layer per spec 002. project_fields is PHI-adjacent and must NOT ship with
# filter: {} for non-privileged roles (spec 001 Risks) — so no broad allow rule is given.
