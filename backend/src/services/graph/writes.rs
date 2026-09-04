//! Every Microsoft Graph WRITE is `write_gated` — default-deny, non-executable,
//! pending the full 8-item "G1" governed-write evidence stack (file 04). This
//! module registers the write *candidates* so they are visible and named, and
//! makes any attempt to call them fail closed.

pub const WRITE_GATED_REASON: &str =
    "Microsoft Graph writes are unsupported until the G1 governed-write evidence stack exists \
     (GovernedWriteEnforcement, DelegatedActorContext, TokenStoreIsolation, NamedMutationRegistry, \
     MutationRequestBinding, IdempotencyAndReplayProtection, WritePolicyAndScopeEnforcement, \
     WriteAuditAndEvidence). See .appfw/specs/003-msgraph-saas-provider.md.";

/// The 8 write-area contracts, all `Unsupported` in this build.
pub const G1_WRITE_AREAS: &[&str] = &[
    "GovernedWriteEnforcement",
    "DelegatedActorContext",
    "TokenStoreIsolation",
    "NamedMutationRegistry",
    "MutationRequestBinding",
    "IdempotencyAndReplayProtection",
    "WritePolicyAndScopeEnforcement",
    "WriteAuditAndEvidence",
];

#[derive(Debug, Clone, Copy)]
pub enum WriteOperation {
    /// `POST /users/{organizer}/events` (isOnlineMeeting: true)
    ScheduleTeamsMeeting,
    /// `DELETE /users/{organizer}/events/{eventId}`
    CancelCalendarEvent,
    /// `POST /subscriptions` — tenant-wide transcript change-notification
    CreateSubscription,
    /// `PATCH /subscriptions/{id}` — renew
    RenewSubscription,
    /// `DELETE /subscriptions/{id}`
    DeleteSubscription,
    /// `PUT /sites/{id}/drives/{id}/root:/…:/content` — SharePoint upload (spec 004 D1)
    SharePointUpload,
}

impl WriteOperation {
    pub fn name(self) -> &'static str {
        match self {
            Self::ScheduleTeamsMeeting => "schedule_teams_meeting",
            Self::CancelCalendarEvent => "cancel_calendar_event",
            Self::CreateSubscription => "create_subscription",
            Self::RenewSubscription => "renew_subscription",
            Self::DeleteSubscription => "delete_subscription",
            Self::SharePointUpload => "sharepoint_upload",
        }
    }

    /// Always fails closed. There is no code path that performs a Graph write.
    pub fn execute(self) -> anyhow::Result<std::convert::Infallible> {
        Err(anyhow::anyhow!(
            "{} is write_gated: {}",
            self.name(),
            WRITE_GATED_REASON
        ))
    }
}
