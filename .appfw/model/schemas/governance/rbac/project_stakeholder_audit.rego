# role literals lowercased at the auth boundary; see spec 001 Q7
# Companion audit entity from `facets: [audited]` on ProjectStakeholder — append-only, read-only.

# Admin and EPMO may read audit records; no client create/update/delete.
access := res if {
    check_schema_type()
    input.action == "read"
    has_any_role(input.user, ["admin", "epmo"])
    res := {"allow": true, "filter": {}}
}
