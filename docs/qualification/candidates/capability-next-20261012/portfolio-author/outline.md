# Portfolio author outline

Base: `e0163fb65a639a28d9423e929058b40b48cc556d`. Exclusive source paths are
the new private research-portfolio schema, validator factory and focused test.
Root owns the canonical loader, registry, catalog and gateway composition.

Implement the selected `get_research_portfolio` and
`get_research_portfolio_changes` reads only. Independently describe the frozen
producer projections and imported DTOs; do not copy or import Capiro code.
The factory receives canonical `validateShape`, `assertSubject` and
`canonicalSha256`. Trusted options contain exactly `binding` and `subject`:
the existing run binding supplies the current conversation, and the existing
entity/research-portfolio subject supplies one portfolio. Options describe
required trusted context; supplying data is not authorization.

`normalizeResearchPortfolioInput(operation, input, options)` rejects authority
injection, substitutes only an omitted current conversation and normalizes the
changes page defaults. `assertResearchPortfolioReadResult(operation, page,
input, options)` validates new Meri `{binding, subject, data}` wrappers around
the frozen detail or changes DTO. It checks identities and producer-supported
relations, not live grants or walls. The resolver owns canonical immutable JSON
snapshots and hashing; the gateway and source owners retain current authorization,
scope receipt integrity, masking, source reads and release checks.

Schema names: ResearchPortfolioDetailInput, ResearchPortfolioChangesInput,
ResearchPortfolioDetailSelection, ResearchPortfolioChangesSelection,
ResearchPortfolioDetailResult, ResearchPortfolioChangesResult. Closed result
structures retain bounded opaque JSON event payloads/unresolved input instead
of inventing their schemas. Current record revision does not equal historical
event revisions by requirement. Captured scope receipt revision remains external
to these producer DTOs and is not silently rewritten.

Run focused local contracts with test-only Ajv while unregistered, exercising
raw defaults/refusals, canonical context/lineage, full detail and paged changes,
opaque data, source-truth limits and hostile-data admission. Use the supplied
subreaper capture helper and retain failures and physical cleanup receipts.
No source connectivity, native execution, SQL, provider calls or paid work.

`get_research_evidence` stays pending: its frozen producer reads Clio research
session attachment snapshots, conflicting with the accepted D012 portfolio
boundary. Owner/scope reconciliation is required before a mapping.
