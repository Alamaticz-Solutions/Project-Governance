//! PostgreSQL implementation of `DatabaseClient`: `postgres_client` is the
//! client itself, `cte` builds the common-table-expression SQL for
//! nested/navigation/many-to-many selections, and `filter` lowers the query
//! IR filter AST into parameterized SQL predicates.

pub(crate) mod postgres_client;

pub(crate) mod cte;

pub(crate) mod filter;
