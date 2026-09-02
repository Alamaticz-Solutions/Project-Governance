pub use sea_orm_migration::prelude::*;

mod m20260101_000001_init_schema;
mod m20260101_000002_gate_submissions;
mod m20260101_000003_teams_poc;
mod m20260101_000004_teams_poc_flow;
mod m20260101_000005_wsd_flow_columns;
mod m20260101_000006_teams_poc_attendees;
mod m20260101_000007_teams_graph;
mod m20260901_000001_drop_unused_tables;
mod m20260901_000002_project_number_seq;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260101_000001_init_schema::Migration),
            Box::new(m20260101_000002_gate_submissions::Migration),
            // 000003-000007 own the `poc_meetings` / `graph_subscriptions`
            // schema for the Teams meeting + VTT feature. All are guarded so
            // they are idempotent no-ops on a database where the objects
            // already exist (e.g. the shared production DB).
            Box::new(m20260101_000003_teams_poc::Migration),
            Box::new(m20260101_000004_teams_poc_flow::Migration),
            Box::new(m20260101_000005_wsd_flow_columns::Migration),
            Box::new(m20260101_000006_teams_poc_attendees::Migration),
            Box::new(m20260101_000007_teams_graph::Migration),
            // From origin/Dev — real migrations, already applied on the shared
            // production DB. Present here so `Migrator::up` recognizes the
            // recorded versions instead of erroring on a missing file.
            Box::new(m20260901_000001_drop_unused_tables::Migration),
            Box::new(m20260901_000002_project_number_seq::Migration),
        ]
    }
}
