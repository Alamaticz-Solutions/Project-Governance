# role literals lowercased at the auth boundary; see spec 001 Q7
# gate/stage row. spec 001: R authenticated; U for the stage-owner role or admin, and the
# stage owner is a free-string on the parent project, NOT a column on this row — so Rego
# cannot express the update predicate. Admin write is allowed here; stage-owner-role routing
# for start/submit/skip/approve is enforced in the service layer (spec 002 authorization split).

# Admin: full access.
access := res if {
    check_schema_type()
    has_role(input.user, "admin")
    res := {"allow": true, "filter": {}}
}

# Any authenticated actor may read workflow stages.
access := res if {
    check_schema_type()
    input.action == "read"
    res := {"allow": true, "filter": {}}
}
