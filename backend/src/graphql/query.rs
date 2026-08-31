use async_graphql::Object;

pub struct QueryRoot;

#[Object]
impl QueryRoot {
    async fn health_check(&self) -> &str {
        "GraphQL is up and running"
    }
}
