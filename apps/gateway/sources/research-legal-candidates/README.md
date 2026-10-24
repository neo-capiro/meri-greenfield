# Research source candidate read

Current ordinary read composition:

- The existing `research-legal-candidates` retrieval contract owns input/output normalization. Core owns the six source queries, meeting/mail ownership, client visibility and directory-note access.
- This family owns only fixed-route composition, raw-request admission and correlation of the selected client with the trusted run subject. It reuses the retained native handler/transport and the existing research client-reference capture rather than adding a query engine or authorization system.
- `request-context.mjs` produces the exact `{clientResolution}` context. The control-side native owner must resolve names against the current roster and explicit selected-client context; model arguments cannot establish that resolution.
- `handler.mjs` sends only the raw tool request (with a trusted resolved UUID substituted for a name) to the existing `POST /api/clio/tools/search_research_sources` producer. It requires per-call credentials and validates the unchanged result using the canonical contract. No state, provider, credential store or persistence is introduced.
- Focused verification covers the real HTTP boundary with explicitly synthetic Core/credential stand-ins: request/subject mismatches, revoked/expired credentials, bounded candidate windows, malformed/failed source responses, selected-client enforcement and truthful empty results. These are source tests, not live Core qualification.

The control adapter uses the existing ordinary user bearer and internal service secret; Core owns fresh tenant, actor, client and resource authorization. The retired signed delegation and installation wrappers are not accepted. Source-only synthetic checks do not qualify actual Core HTTP, database roles or deployment; those remain separate integration gates.

Core returns at most six independently capped candidate branches, sorted and globally capped at `limit * 3`. It provides no cursor, corpus total, freshness or completeness proof. Empty candidates must not be described as evidence that no matching source exists. Tenant directory notes intentionally remain outside the optional client filter, as stated by the canonical contract metadata; they acquire no selected-client provenance here.
