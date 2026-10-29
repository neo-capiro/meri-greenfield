# Buyer workspace native read

`get_pe_buyer_workspace@0.2.0` calls the single existing Core route
`POST /api/clio/tools/get_pe_buyer_workspace`. The native read composer owns
current execution credentials, membership, conversation scope and result release.
The operation works in General and client contexts; selectors convey no authority.
No separate client, session, credential or evidence owner is added.

The model supplies a PE code, fiscal year and knowledge timestamp. Four exact opaque
cursors continue acquisition, funding, mentions and lifecycle independently. The
normalization hash covers all supplied cursors and the normalized PE and timestamp.
Core verifies each cursor against its section and temporal scope. Responses retain
native source evidence, nullable facts, source freshness and partial coverage.
The receiver never truncates results to fit: oversized or invalid responses fail.

Enacted and proposed money remain in separate buckets. Snapshot totals, deltas,
transfers, allocations and residuals cannot be treated as one sum. The receiver
checks native totals and allocation certification without changing decimal strings.
Historical before and after evidence stays attached to its own revision.

Pinned budget history remains explicitly unsupported by Core. Federal evidence
coverage represents pagination; an empty page alone does not establish source health
or exhaustive absence. Source text is untrusted evidence, never instructions.

## Producer and receiver conformance

The synthetic wire fixture in
`packages/contracts/test/fixtures/buyer-workspace.wire.json` is copied byte for byte
from Core commit `2fb4986e31374173a2c8a485de6460cb8b6a0f9d` (PR 256),
`apps/api/src/program-element/buyer-workspace/buyer-workspace.wire.json`.
Core's test produces it by executing the actual Meri tool and all four source
readers with synthetic repository ports. The runtime tests validate those bytes,
mutated failure cases and the installed SDK MCP path through current control
authority and synthetic Core HTTP. No provider, model or deployed service is used.

Catalog 0.2.26 adds this operation; the preserved catalog and all existing
descriptors keep their original bytes. Registration does not enable a deployment:
the current native installation and capability policy still govern availability.
Actual native installation, source completeness and deployed acceptance remain
unqualified. This slice does not complete the separate advanced graph workflow.
