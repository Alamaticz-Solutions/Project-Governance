# role literals lowercased at the auth boundary; see spec 001 Q7
# gate_submissions is unguarded server-side today. Proposed (spec 001): R for admin, epmo and
# the project owner; C/U for the stage-owner role. The project-owner and stage-owner-role
# predicates depend on the parent Project row, which Rego cannot join to here — that scoping
# and create/update routing is enforced in the service layer (spec 002 authorization split).

# Admin: full access.
access := res if {
    check_schema_type()
    has_role(input.user, "admin")
    res := {"allow": true, "filter": {}}
}

# EPMO: read all gate submissions (oversight).
access := res if {
    check_schema_type()
    input.action == "read"
    has_role(input.user, "epmo")
    res := {"allow": true, "filter": {}}
}

# Any authenticated actor may read gate submissions (parity with today's unguarded read;
# tighten to project scope once parent-row scoping is available).
access := res if {
    check_schema_type()
    input.action == "read"
    res := {"allow": true, "filter": {}}
}

# `GateSubmission.save_stage` (backend/src/services/transition.rs) creates or
# updates through the same DataAccess path — and therefore the same Rego
# check — as a generated client mutation. Before this rule, create/update had
# no allow path for a non-admin actor (only the blanket admin rule above
# covered them), so save_stage would deny every non-admin caller outright —
# the same class of gap as audit_event.rego / notification.rego (those two
# were confirmed live via "access denied" on the audit write after `cancel`;
# this one is the same missing-create/update-rule pattern, fixed proactively
# — save_stage itself has not yet been exercised by a non-admin actor in this
# session). save_stage does not itself restrict which authenticated role may
# call it (no stage-owner check has been built yet, per the note above), so
# allow any authenticated actor for now, matching its actual current
# authorization scope; tighten to the stage-owner role alongside the
# service-layer check this file's header already flags as pending.
access := res if {
    check_schema_type()
    input.action in ["create", "update"]
    res := {"allow": true, "filter": {}}
}
