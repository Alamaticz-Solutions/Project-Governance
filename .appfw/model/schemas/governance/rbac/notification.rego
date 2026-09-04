# role literals lowercased at the auth boundary; see spec 001 Q7
# Single-tenant: tenant_filter is never called.
#
# `notification::notify_user`/`notify_role` (backend/src/services/notification.rs)
# write through the same DataAccess::create_item path — and therefore the
# same Rego check — as a generated client mutation; there is no separate
# "service bypass" (same issue as audit_event.rego's create rule, found
# live). The recipient of a system-generated notification is someone other
# than the acting caller, so a caller-scoped filter can't gate create the way
# it gates read/update; allow any authenticated actor to create instead —
# every caller of notify_user/notify_role has already passed require_user
# (and, for role-gated transitions, a role check) before the notify call is
# reached.

# Admin — full access to all notifications.
access := res if {
	check_schema_type()
	has_role(input.user, "admin")
	res := {"allow": true, "filter": {}}
}

# Recipients may read and mark-read (update) only their own notifications.
# ASSUMPTION: input.user.id present (spec 001 decision A)
access := res if {
	check_schema_type()
	input.action in ["read", "update"]
	res := {"allow": true, "filter": {"recipient_id": {"_eq": input.user.id}}}
}

# Any authenticated actor may create a notification (the service decides the
# recipient; the client-facing create mutation carries no elevated read/write
# beyond this).
access := res if {
	check_schema_type()
	input.action == "create"
	has_any_role(input.user, ["admin", "epmo", "project_manager", "bta", "finance", "vendor_screening", "analysis_team", "eac", "cab", "security", "taf", "trc", "pic", "viewer"])
	res := {"allow": true, "filter": {}}
}
