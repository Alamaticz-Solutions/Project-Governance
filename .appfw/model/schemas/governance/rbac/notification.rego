# role literals lowercased at the auth boundary; see spec 001 Q7
# Single-tenant: tenant_filter is never called.

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
