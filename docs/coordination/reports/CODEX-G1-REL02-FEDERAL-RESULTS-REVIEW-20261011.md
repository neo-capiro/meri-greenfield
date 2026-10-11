# G1 REL-02 federal result shapes — Codex independent review

Date: 2026-10-11 UTC. Decision: **ACCEPT DECLARED-TYPE SOURCE ONLY AFTER CODEX REPAIR**. The federal input and result definitions remain private candidates. REL-02 and G1 remain **OPEN**; this review grants no source connection, handler, catalog availability, authorization, coverage, freshness, parity or deployment claim.

## Provenance and physical closure

H4C began from integration base `3d496f6845bf2503cf623c353ea3b5b9fc307a00`, allocation `14b7f5d894dadd889a9a910ce8827de09a537a71`, and returned one candidate commit `b0f155e4e82513803ff21227bff574b9f6dd3f57` in the three federal contract files and its report. Local cherry-pick: `fc5c5a0`. The one-shot session exited 0 with completed usage; the original Hermes PID 21612 (created 13:38:49Z) and parent PID 20496 were absent after exit. Registry `work/H4C-supervisor.json` is CLOSED. Its worktree and committed handoff are preserved.

Codex independently read Git objects at frozen Capiro commit `fd8765ec01d292013758606204f2c9d886cd31c1` without touching that dirty working tree. Observed blob IDs matched the pinned files: `federal-market.types.ts` `33a7e55c09cc5c524bea85fc85eb749883279c18`, `federal-market-geography.service.ts` `88cc4e7ac4264d7d0d40f2878c7c01a1a8ec6a5c`, and `federal-market-meri-tools.service.ts` `7c5b09c86ca519996d63cecb8c95d7b54bad5c6b`. The five output field sets, declared nullability, four paged dispatch envelopes, geography optional rails and separate state-only subaward basis agree with those frozen objects. Existing five input definitions and their rules were left untouched. The contract-award row intentionally permits extra properties because the enforce-mode serializer was outside this frozen inspection; that row therefore remains a declared-type candidate, not an exact emitted-row attestation.

## Codex repair

The returned paging validator only checked one direction of `paginationLimitReached`. It would accept `hasMore: true` at page 4 with the limit flag set, or `hasMore: true` at page 10000 with the flag clear. Both disagree with frozen `pageResult`, where the flag is exactly `hasMore && page >= MAX_TOOL_PAGE` and `MAX_TOOL_PAGE` is 10000. Codex committed `811cffbd13005826496f4ce68374e156803879a0` to enforce the exact relation and add negative tests. `hasMore` remains un-derived from `total`: the contract does not assert total accuracy. This decision applies to the repaired integration bytes, with the worker report retained as its pre-repair record.

## Independent checks and limits

On Node 24.19.0, the repaired focused federal suite passed **18/18**. The integrated contracts, fixture channel, fixture transport and Hermes-session suite passed **172/172**, exit 0. The public distribution remained unchanged: generated-record check, strict TypeScript typecheck and public package tests **7/7** all passed. `git diff --check` was clean. These are local source checks, not runtime source or network checks.

No federal result is registered in the shared retrieval validator/catalog, no five-tool handler is installed, and no emitted result was compared against a running Capiro producer. Length caps and stricter input behavior from the earlier input candidate also await the 75 real requests for compatibility review. A live source, authenticated client scope, separate future-signal rail, coverage/freshness basis and the wider 96/43 mapping remain G1 work. The historical private capabilities extraction is unavailable on this host, so REL-02 scope-wide parity is not independently reproducible here.
