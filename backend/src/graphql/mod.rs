pub mod query;
pub mod mutation;

use async_graphql::{EmptySubscription, Schema};
use query::QueryRoot;
use mutation::MutationRoot;

pub type AppSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

pub fn build_schema() -> AppSchema {
    Schema::build(QueryRoot, MutationRoot, EmptySubscription).finish()
}
