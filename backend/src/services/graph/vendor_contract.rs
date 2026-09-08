//! Honest per-operation capability tiers (file 04's 4-status vendor vocab).
//! This module is the source of truth a docs-check would transcribe from — no
//! value here is hand-inflated.
//!
//!   live_certified     — a retained live contract run exists. NONE here.
//!   compiler_contracted — request-plan construction proven by unit contracts;
//!                         executable, but no retained live run exists. As of
//!                         this also covers the two G1-gated writes
//!                         (`schedule_teams_meeting`, `cancel_calendar_event`):
//!                         they execute behind the full 8-item G1 stack
//!                         (`services::graph::writes`), but the live check
//!                         run so far (`services::graph::client::live`) is a
//!                         read/token-acquisition check, not a retained live
//!                         WRITE run -- see `assert_honest`'s write allow-list.
//!   planned_gated      — registered, non-executable, with named evidence gates.
//!   write_gated        — registered write candidate, non-executable: no G1
//!                         evidence stack covers it yet (subscriptions -- no
//!                         public callback in this environment; SharePoint --
//!                         spec 004 D1 undecided).

// This whole file is exercised only by `contracts_are_honest` at the bottom
// -- nothing in the production request path reads a capability tier back
// (writes.rs enforces G1 directly; this module is the docs-check source of
// truth file 04 requires, not a runtime gate). Hence "unused" outside its
// own test for every item below.
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tier {
    LiveCertified,
    CompilerContracted,
    PlannedGated,
    WriteGated,
}

#[allow(dead_code)]
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

#[allow(dead_code)]
pub struct OperationContract {
    pub name: &'static str,
    pub kind: &'static str,        // "read" | "write"
    pub sensitivity: &'static str, // "pii" | "phi_possible" | "none"
    pub tier: Tier,
}

#[allow(dead_code)]
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
        // Executes behind the full G1 stack (services::graph::writes).
        // See `assert_honest`'s G1_GATED_WRITES allow-list for the rule this
        // exception must satisfy.
        tier: Tier::CompilerContracted,
    },
    OperationContract {
        name: "cancel_online_meeting",
        kind: "write",
        sensitivity: "none",
        // The path `cancel_via_graph` actually takes for a meeting
        // scheduled through `schedule_teams_meeting` (which never sets
        // `graph_event_id` -- see WriteOperation::ScheduleTeamsMeeting's
        // doc comment).
        tier: Tier::CompilerContracted,
    },
    OperationContract {
        name: "cancel_calendar_event",
        kind: "write",
        sensitivity: "none",
        tier: Tier::CompilerContracted,
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

/// G1: the only write operations allowed to claim a tier above
/// `WriteGated`. Both are gated by every one of the 8 G1 components
/// (`services::graph::writes::execute`) -- `CompilerContracted` here means
/// "the gate is real and runs before any network call", the same meaning
/// the reads use, not "ungated". Adding a name here without the matching
/// `writes::WriteOperation` arm actually reaching `execute`'s full pipeline
/// would be the exact overclaim `assert_honest` exists to catch elsewhere,
/// so keep this list in lockstep with `writes.rs`.
#[allow(dead_code)]
const G1_GATED_WRITES: &[&str] = &[
    "schedule_teams_meeting",
    "cancel_online_meeting",
    "cancel_calendar_event",
];

/// Invariant the tests/docs-check assert: nothing claims `live_certified`,
/// and every `write` operation is `write_gated` UNLESS it's in
/// `G1_GATED_WRITES`, in which case it may be `compiler_contracted`.
#[allow(dead_code)]
pub fn assert_honest() -> Result<(), String> {
    for c in CONTRACTS {
        if c.tier == Tier::LiveCertified {
            return Err(format!(
                "{} claims live_certified with no retained run",
                c.name
            ));
        }
        if c.kind == "write" {
            let is_g1_gated = G1_GATED_WRITES.contains(&c.name);
            match c.tier {
                Tier::WriteGated => {}
                Tier::CompilerContracted if is_g1_gated => {}
                _ => {
                    return Err(format!(
                        "{} is a write but neither write_gated nor an allow-listed G1-gated write",
                        c.name
                    ))
                }
            }
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
