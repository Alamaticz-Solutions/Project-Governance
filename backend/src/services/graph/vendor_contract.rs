//! Honest per-operation capability tiers (file 04's 4-status vendor vocab).
//! This module is the source of truth a docs-check would transcribe from — no
//! value here is hand-inflated.
//!
//!   live_certified     — a retained live contract run exists. NONE here.
//!   compiler_contracted — request-plan construction proven by unit contracts;
//!                         reads are executable, but no retained live run exists.
//!   planned_gated      — registered, non-executable, with named evidence gates.
//!   write_gated        — registered write candidate, non-executable pending G1.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tier {
    LiveCertified,
    CompilerContracted,
    PlannedGated,
    WriteGated,
}

impl Tier {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::LiveCertified => "live_certified",
            Self::CompilerContracted => "compiler_contracted",
            Self::PlannedGated => "planned_gated",
            Self::WriteGated => "write_gated",
        }
    }
}

pub struct OperationContract {
    pub name: &'static str,
    pub kind: &'static str,        // "read" | "write"
    pub sensitivity: &'static str, // "pii" | "phi_possible" | "none"
    pub tier: Tier,
}

pub const CONTRACTS: &[OperationContract] = &[
    OperationContract {
        name: "get_online_meeting_by_join_url",
        kind: "read",
        sensitivity: "pii",
        tier: Tier::CompilerContracted,
    },
    OperationContract {
        name: "get_online_meeting",
        kind: "read",
        sensitivity: "phi_possible",
        tier: Tier::CompilerContracted,
    },
    OperationContract {
        name: "get_online_meeting_transcript",
        kind: "read",
        sensitivity: "phi_possible",
        tier: Tier::CompilerContracted,
    },
    OperationContract {
        name: "search_directory_users",
        kind: "read",
        sensitivity: "pii",
        tier: Tier::CompilerContracted,
    },
    OperationContract {
        name: "check_organizer_availability",
        kind: "read",
        sensitivity: "pii",
        tier: Tier::CompilerContracted,
    },
    OperationContract {
        name: "schedule_teams_meeting",
        kind: "write",
        sensitivity: "pii",
        tier: Tier::WriteGated,
    },
    OperationContract {
        name: "cancel_calendar_event",
        kind: "write",
        sensitivity: "none",
        tier: Tier::WriteGated,
    },
    OperationContract {
        name: "create_subscription",
        kind: "write",
        sensitivity: "none",
        tier: Tier::WriteGated,
    },
    OperationContract {
        name: "renew_subscription",
        kind: "write",
        sensitivity: "none",
        tier: Tier::WriteGated,
    },
    OperationContract {
        name: "delete_subscription",
        kind: "write",
        sensitivity: "none",
        tier: Tier::WriteGated,
    },
    OperationContract {
        name: "sharepoint_upload",
        kind: "write",
        sensitivity: "none",
        tier: Tier::WriteGated,
    },
];

/// Invariant the tests/docs-check assert: nothing claims `live_certified`,
/// and every `write` operation is `write_gated`.
pub fn assert_honest() -> Result<(), String> {
    for c in CONTRACTS {
        if c.tier == Tier::LiveCertified {
            return Err(format!(
                "{} claims live_certified with no retained run",
                c.name
            ));
        }
        if c.kind == "write" && c.tier != Tier::WriteGated {
            return Err(format!("{} is a write but not write_gated", c.name));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn contracts_are_honest() {
        super::assert_honest().expect("vendor contract must stay honest");
    }
}
