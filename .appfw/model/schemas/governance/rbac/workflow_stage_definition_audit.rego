# role literals lowercased at the auth boundary; see spec 001 Q7
# Read-only audit companion (audited facet). Governance oversight roles only.

access := res if {
    check_schema_type()
    input.action == "read"
    has_any_role(input.user, ["admin", "epmo"])
    res := {"allow": true, "filter": {}}
}
