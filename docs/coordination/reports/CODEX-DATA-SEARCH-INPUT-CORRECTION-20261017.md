# Data-search input correction allocation

Status: **DOC-ONLY PROPOSAL; SHARED CONTRACT EDIT NOT PERFORMED.** Prepared in the task-owned `meri-governed-next` checkout, HEAD `48e091970b9f65f1e686dc917dfc80d72f9c84b9`, while the coordinator independently prepares the other twelve reads. No contract, catalog, normalized validator, SDK policy, lockfile, infrastructure or live resource was changed by this task.

Add one raw `DataSearchRequest` definition and point the catalog/binding input at it. Keep the existing normalized `DataSearchInput`, its conditional `allOf`, the normalizer and result contract unchanged. The exact proposed definition is [data-search-request-candidate.json](governed-next-20261017/data-search-request-candidate.json). Its file SHA256 is `f4d7cc72c75b12e917b5c1661100e253dc551f16c5d6181652ebd750afa246d9`.

## Current mismatch and exact pins

`packages/contracts/retrieval-0.2/data-search.schema.json` is 25,959 bytes with actual SHA256 `96e5d1ebc461dc53db86e2fd14e2863d93d5c651e134382a2da5daefd3836fec`. The `search_capiro_data@0.2.0` descriptor in `catalog.json` currently carries:

| Field | Current value | Proposed change |
| --- | --- | --- |
| inputSchema.id | `urn:meri:retrieval:data-search:0.2.0#/$defs/DataSearchInput` | `urn:meri:retrieval:data-search:0.2.0#/$defs/DataSearchRequest` |
| inputSchema.sha256 | `96e5d1ebc461dc53db86e2fd14e2863d93d5c651e134382a2da5daefd3836fec` | SHA256 of the actual edited whole schema file |
| outputSchema.id | `urn:meri:retrieval:data-search:0.2.0#/$defs/SearchCapiroDataResult` | Unchanged |
| outputSchema.sha256 | `96e5d1ebc461dc53db86e2fd14e2863d93d5c651e134382a2da5daefd3836fec` | Same new whole-file SHA256 as input |
| binding input | `DataSearchInput` in `catalog-validation.mjs:363` | `DataSearchRequest` |

Both descriptor hashes cover the entire schema document. Adding a definition therefore changes both hashes even though the result definition stays unchanged. The probe's proposed full-schema SHA256, **only if** the in-memory clone is serialized with two-space indentation and one LF, is `b390270625b4662df487f04b13df745f422d10a2a8aa90e79e90a7ce75219d60`. This is a formatting-contingent probe value, **not a final source pin**. Recompute from the actual edited bytes during implementation.

The advertised `DataSearchInput` currently requires eight normalized fields: `query`, `domains`, `queryClass`, `pageSize`, `clientId`, `memoryItemId`, `cursors`, `window`. `normalizeDataSearchInput` accepts nine raw keys: `query`, `domains`, `queryClass`, `pageSize`, `clientId`, `memoryItemId`, `cursors`, `windowStart`, `windowEnd`. It rejects raw `window` and explicit null client/memory selectors. Advertising the normalized shape makes the model supply values that the raw entry point refuses; minimal legitimate raw requests also fail the advertised required-field shape.

The normalizer already checks raw fields and validates its resulting `DataSearchInput`. `operation-contracts.mjs` invokes that owner and hashes the normalized output; it does not require changing normalization to match the new advertised definition. No change to `data-search-validation.mjs`, the normalized input, result, SDK converter or public package exports is needed for this correction.

## Additive raw grammar

- Require only `query` and `domains`; close the outer object to the nine raw keys.
- Bound raw query text to 4,000 and raw domains to 1–18 supported entries. Allow duplicate domains because the normalizer deduplicates in first-seen order. Its raw UTF-16 bound remains authoritative.
- Allow omitted or null `queryClass`/`pageSize`, preserving the existing `??` defaults (`lookup`, `50`). Admit only the seven selectable classes or integers 1–100 when non-null. No annotation defaults are needed, so the SDK supplies no omitted fields.
- Keep optional `clientId` and `memoryItemId` UUID strings only. Omission normalizes to null; explicit null remains refused.
- Define raw `cursors` with exactly the eighteen supported optional properties, each a nonempty string of at most 8,192, and `additionalProperties:false`. Do not use `propertyNames` in this raw definition. Preserve the old normalized cursor definition unchanged.
- Use the existing `DataSearchInstant` references for optional `windowStart`/`windowEnd`. Keep the memory-domain/class relation, requested-domain cursor membership, both-or-neither window, finite date and window ordering checks in the existing normalizer. Keep its normalized conditional `allOf` intact.

Example accepted raw request:

```json
{"query":"","domains":["mail","mail"]}
```

Existing normalized result, unchanged by this proposal:

```json
{"query":"","domains":["mail"],"queryClass":"lookup","pageSize":50,"clientId":null,"memoryItemId":null,"cursors":{},"window":null}
```

## Exact SDK probe

[Reusable read-only probe](governed-next-20261017/data-search-input-probe.mjs) reads the doc candidate, clones the real schema in memory, adds only `DataSearchRequest`, inlines local references, and calls the actual `convertCanonicalArguments` owner. It imports the current normalizer to check accepted requests and owner-only cross-field refusals. [Captured result](governed-next-20261017/data-search-input-probe-result.json) records Node **v24.19.0**, installed Zod **4.6.7**, and **19/19 passing checks**: six valid raw cases, nine SDK shape refusals, and four requests admitted structurally but correctly refused by the normalizer's semantic relations. Both the normalized definition and its `allOf` remained structurally identical in the clone.

Existing normalized-schema conversion returns `READ_SCHEMA_CONFIGURATION`; the proposed raw definition returns mode `canonical` through the real conservative conversion guard. Individual keyword probes refine the diagnosis:

| Keyword | Exact observed behavior |
| --- | --- |
| `uniqueItems` | Zod 4.6.7 preserves it and the application guard accepts it. Omitted from the raw request because duplicates are valid raw input, not because Zod lacks support. |
| `if`/`then` | Zod throws `Conditional schemas (if/then/else) are not supported`; application conversion refuses. |
| `propertyNames` | Zod converts and preserves it, but the current `isNarrowerOrEqual` proof does not recognize that keyword; application conversion refuses. Explicit finite cursor properties avoid changing the proof implementation. |

Run from the checkout with the pinned Node executable:

```text
node --preserve-symlinks --max-old-space-size=256 docs/coordination/reports/governed-next-20261017/data-search-input-probe.mjs
```

This is schema/normalization evidence only. It performs no native/provider/database call, source authorization, audit write or live qualification.

## Smallest correction allocation

Allocate these production contract changes to one owner:

1. `packages/contracts/retrieval-0.2/data-search.schema.json`: add the candidate as `$defs.DataSearchRequest` only.
2. `packages/contracts/retrieval-0.2/catalog.json`: change this operation's input pointer and both whole-schema hashes only.
3. `packages/contracts/retrieval-0.2/catalog-validation.mjs`: change this operation's binding `input` only.

Required test ownership:

4. `packages/contracts/test/retrieval-data-search.test.mjs`: update the exact input-pointer assertion currently at line 443; add raw-request shape/default/duplicate/selector/cursor/window cases while retaining normalized input, normalized conditional and original result assertions.
5. A focused worker schema test such as new `apps/worker/conversation/reads/test/data-search-schema.test.mjs`: exercise actual catalog-hash loading, reference inlining and exact installed-Zod conversion; preserve raw selectors and prove authority/normalized-only key refusals plus normalizer-owned semantic refusal.

The coordinator separately owns exposure after correction review. Its current `apps/worker/conversation/reads/test/governed-next.test.mjs` explicitly characterizes the hold, and `reads/families.mjs` omits `data-search`. Those must be changed together with real MCP/gateway receipt checks only when admitting the corrected family. They are not required edits for the narrow three-file contract fix and must not silently be included in that allocation.

`docs/coordination/proposals/general-reads/inventory.json` contains the old input pointer at line 6351 and is generated current inventory. If the coordinator's consistency check requires an update, regenerate it with the existing `scripts/general-reads/cli.mjs --write` and review the diff in the coordinator's owned integration; do not edit its pointer manually or use this correction to overwrite unrelated inventory work.

## Other exact old-hash references and preserved history

The tracked exact old-SHA search found four occurrences: the two live catalog fields above and these historical snapshots:

- `docs/handover/20261012/snapshots/backend-accepted.json:10614`
- `docs/handover/20261012/snapshots/backend-candidate-freeze.json:11223`

Both historical entries bind the then-accepted schema blob `f9513267ab11ec3237f05ecadbdac32c32b6fc04` and its 25,959 bytes. Preserve them unchanged. Do not globally replace old hashes or regenerate dated acceptance/freeze evidence. The candidate/result/report added by this task explicitly retain the observed old hash as evidence, not as active catalog configuration.

## Focused verification after an allocated edit

Run the contract data-search suite, catalog/operation-contract integrity suites and the focused worker schema test serially with Node 24, `--preserve-symlinks`, 256 MiB and exact task-local Zod 4.6.7. Confirm actual input/output whole-file hash equality, the new input pointer/binding and unchanged normalized definition/allOf/result. Keep the existing Windows dynamic-import exclusion-guard platform result separate; do not weaken it.

For later coordinator exposure, replace the hold characterization with actual one-tool MCP discovery, raw-call normalization, current grants/source checks, result receipt settlement, cancellation and refusal tests. Run the current inventory check and regenerate only its current artifact if needed. Perform an independent source review before publication. No live activation, new credentials, deployment, migrations or provider calls are part of this proposal.
