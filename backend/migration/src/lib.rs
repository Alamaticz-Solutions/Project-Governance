pub use sea_orm_migration::prelude::*;

mod m20260101_000001_init_schema;
mod m20260101_000002_gate_submissions;
mod m20260101_000003_teams_poc;
mod m20260101_000004_teams_poc_flow;
mod m20260101_000005_wsd_flow_columns;
mod m20260101_000006_teams_poc_attendees;
mod m20260901_000001_drop_unused_tables;
mod m20260901_000002_project_number_seq;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260101_000001_init_schema::Migration),
            Box::new(m20260101_000002_gate_submissions::Migration),
            // No-op placeholders for migrations applied to the shared prod DB
            // by a separate "Teams meeting" feature/codebase. Do not remove
            // or repurpose — see comments in each file.
            Box::new(m20260101_000003_teams_poc::Migration),
            Box::new(m20260101_000004_teams_poc_flow::Migration),
            Box::new(m20260101_000005_wsd_flow_columns::Migration),
            Box::new(m20260101_000006_teams_poc_attendees::Migration),
            Box::new(m20260901_000001_drop_unused_tables::Migration),
            Box::new(m20260901_000002_project_number_seq::Migration),
        ]
    }
}
