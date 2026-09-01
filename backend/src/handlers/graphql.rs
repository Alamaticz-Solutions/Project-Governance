use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::extract::State;
use crate::state::AppState;

pub async fn graphql_handler(
    State(state): State<AppState>,
    req: GraphQLRequest,
) -> GraphQLResponse {
    let request = req.into_inner().data(state.clone());
    state.schema.execute(request).await.into()
}
