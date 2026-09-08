# Open decisions

Product decisions that are not yet finalised. Each can still change generated
output or service behaviour, so the feature specs in `.appfw/specs/` are marked
`accepted-pending-decisions` until these are resolved and signed off.

| # | Decision | Area | Impact if changed |
|---|---|---|---|
| P5 | The authoritative Excel gate matrix is not in the repository. The stage-definition seed DAG is reconstructed from design notes, not the source of record. | Gate-workflow engine (spec 002) | Full state-machine fidelity is blocked until the authoritative matrix is provided. |
| Q7 | Enum casing: the model uses `SCREAMING_SNAKE` enum members with lowercase Rego role literals. Confirm this is the intended contract. | Model / RBAC (spec 001) | Generated GraphQL enum types and every Rego policy literal. |
| A | Whether the actor id (not only the role) belongs in the Rego input for single-row ownership filters. | RBAC row filtering (spec 001) | Rego policy inputs and the row-filter layer. |
| Q5 | Audit scope: which entities carry the `audited` facet vs. rely on the append-only `AuditEvent` entity. | Audit (specs 001, 002) | Which `*_audit` tables are generated and which writes produce audit rows. |
| Q3 | Keep the pgvector / RAG knowledge base as a net-new service, or drop it. | AI storage (spec 004) | Whether the knowledge-base schema, storage service, and retrieval path are built. |

Resolve each with the client, record the decision here, then update the
affected spec's status block.
