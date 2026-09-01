pub use sea_orm_migration::prelude::*;

mod m20260101_000001_init_schema;
mod m20260101_000002_gate_submissions;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260101_000001_init_schema::Migration),
            Box::new(m20260101_000002_gate_submissions::Migration),
        ]
    }
}
