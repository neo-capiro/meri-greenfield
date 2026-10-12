# REL-02 data-search canonical composition

11 October 2026 UTC. Base `63fc6e0d2e0a56003f6d5f647af0bf530392be2e`, branch `task/rel02-data-search-composition-20261011`, dedicated worktree `meri-g1-data-search-composition`. Implemented the [bounded outline](../tasks/REL02-DATA-SEARCH-COMPOSITION-20261011.md). **SOURCE_ONLY; independent acceptance pending; G1 OPEN.** No cloud/network, image/native/provider execution, source connection, Capiro code change, deployment or architecture/component change occurred.

## Problem and resulting ownership

The private `search_capiro_data` contract previously loaded its schema and compiled an independent AJV instance beside the canonical private retrieval validator. Its only executable caller was the private characterization suite. Data-search now composes through the same explicit `{ validateShape, schema }` factory seam used by the federal family at the frozen base.

`packages/contracts/retrieval-0.2/validate.mjs` owns one structural compiler, registration of the unchanged data-search schema and deliberate private exports. `data-search-validation.mjs` exports `createDataSearchValidators` and retains its frozen vocabulary/notes. The factory owns the existing selector normalization, inert-input guard, paired ordered instants and result-envelope checks. Its schema-derived definition set rejects names outside this family **before** delegation to the shared structural validator. This preserves `Unknown data-search contract …` behavior and prevents unrelated known canonical definitions from becoming legal family definitions. The factory imports no filesystem or compiler package and performs no I/O on import/construction.

The private canonical entry point now exports the same 13 data-search names that the test previously consumed from the standalone module. The direct private module path's three validators and schema-ID export move to canonical composition; its existing private test is migrated accordingly. No public 0.1 export, package file list, generated distribution, schema, catalog operation, availability, handler, alias, source adapter or authorization is added. This is a deliberate private ownership/import change, not a claim of runtime integration.

## Behavior and assertions preserved

The data-search schema's 26 definitions have no collisions with any of the eight already registered private schema groups. All 44 other tracked contract members match the exact base bytes, including all domain schemas, catalog, public package/generator/distribution and other domain modules/tests. No pin, build/context authority, lockfile or federal composition byte changed.

The entire existing algorithm tail—`assertInertData`, `parseInstant`, `normalizeDataSearchInput` and `assertDataSearchResult`, with comments—is byte-identical to the frozen base after only the factory's two-space indentation and removed direct `export` keywords are accounted for. This preserves raw UTF-16 query bounds before trimming, raw domain count before first-seen deduplication, nullish queryClass/pageSize defaults, selector UUID/memory conditions, requested-domain cursors, the bespoke instant grammar and ordering, non-authoritative client selection and frozen output. Common subject/window/retrieval validators were not substituted: those shapes and semantics differ.

The original first 12 characterization test bodies are byte-identical. They retain every existing positive/negative assertion for frozen vocabulary, normalization/defaults, selectors, conditional memory, opaque cursors, domain bounds, windows, inert data, closed result shapes and intentionally unproven result relations. The 13th pure-import test is narrowly migrated: its source import list now requires the domain factory's zero imports rather than the removed standalone fs/AJV imports; all existing live socket/fetch-guard, environment-stability, denied-write and normalized-output assertions remain. It additionally rejects local schema/compiler ownership and verifies the factory is present. The permission model still proves filesystem write denial only; it is not misrepresented as a network-denial mechanism.

Three new characterization cases demonstrate:

- Canonical shape ownership and family closure: the global validator accepts a valid known federal definition while the data-search wrapper refuses it, along with other foreign/unknown/inherited-looking names.
- Domain relations survive structural delegation: requested-domain cursor membership and window ordering remain normalizer responsibilities even when the normalized JSON shape is structurally valid. The deliberately unproven returned-record/count relation remains unenforced.
- Raw bounds remain before normalization: overlong trailing-space queries and 19 duplicate domains are refused, valid raw boundaries remain accepted, Unicode obeys the existing UTF-16 raw bound, callers remain unchanged and nested output arrays/cursors/window remain frozen.

No input/result relation, proxy semantics, normalization policy or result producer invariant was broadened or tightened as an incidental refactor. Structural validation still proves neither source freshness, tenant/client authorization, correct retrieval, cursor authenticity nor true coverage.

## Actual checks and retained results

Physical already-restored dependencies were copied locally from the federal worktree after matching the exact root and contracts lockfiles. No install/network was used. Root lock identity: 12,067 bytes / SHA-256 `b2293773bf4ddc6d23425b7d718b79575384679999b86fd3caad78e6eda4a42d`; contracts lock: 24,995 bytes / `dae8c670bb76b9c570f174d8749a8c59179cf865d5d6ec83b64a67bb5b2b06a6`. Both remain unchanged.

| Check actually run | Result |
| --- | --- |
| Existing standalone data-search baseline during the preceding read-only audit | 13 PASS |
| Focused data-search, federal-market and R2 suites | 57 PASS: data-search 16, federal 20, R2 21 |
| `npm run check` | 187 PASS, no skips/failures |
| `npm run check --prefix packages/contracts` | Generated bytes and typecheck PASS; 7 public tests PASS |
| `node --check` on both changed production modules and changed test | 3 PASS |
| Original-domain-algorithm/test-body and unallocated-byte comparison | PASS; 44 unchanged contract members |
| `git diff --check` | PASS |

Counts overlap between focused and root suites and must not be added as distinct tests. The root/public command harness retained finite stdout/stderr, exit codes and hashes, used 120-second timeouts, observed no timeout and independently verified its created process groups absent after completion. The focused suite completed in approximately 2.4 seconds; its permission-test child exited successfully. No owned background process was launched. Stderr only contains npm's inherited `http-proxy` configuration warnings; those warnings are retained, not hidden or fixed by changing unrelated configuration.

Raw result directory, outside tracked source:

`/workspace/scratch/853fba62b1f1/meri-g1-data-search-composition/.task-inputs/rel02-data-search-composition-20261011`

`manifest.json` is 2,577 bytes / SHA-256 `8c2c0d929f2521e2ec80c75d753686a891ead3ee2c59cf945f571ef5ba1068ab`. It records all finite raw captures, receipts, syntax results, preservation proof and tested source hashes. `preservation.json` is 8,837 bytes / `6d04de360539e91d0aa89e88285dd61382f15426c6c17a52f5837d2895c355e7`; `syntax.json` is 953 bytes / `d5233b55e5be28cf47d0d6f01bb6018270c753febce3b0afdbb31e542f5da4ec`. Root owns scrubbed tracked qualification retention and independent review.

One first comparison-helper attempt falsely reported an algorithm change: slicing at the first comment dropped that line's indentation, so generic `textwrap.dedent` did not remove the factory indentation from subsequent lines. Explicitly removing the known factory indentation repaired **only the comparison helper**. No source/test change or failed domain assertion occurred. The complete tool-result text is retained as a disclosed copy in `preservation-first-attempt.txt`, and the passing proof records the cause. It is not represented as an original standalone stderr capture. All real suite attempts passed.

Frozen tested source identities:

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `packages/contracts/retrieval-0.2/data-search-validation.mjs` | 18,029 | `5049b9177664275f763ab97f92fe722ae5d4e2064ca8400f6448d89027f5cd43` |
| `packages/contracts/retrieval-0.2/validate.mjs` | 19,407 | `0b01b7be420bfbd71506a088f717b209babee7623269ad2370f175b408657711` |
| `packages/contracts/test/retrieval-data-search.test.mjs` | 32,852 | `ed1614966269edae40952af90baa615893b838aa1f8a89930b2ad240a2346642` |

## Remaining acceptance

Root must independently review/integrate the exact commit, retain scrubbed raw captures, run final integrated gates and coordinate its existing draft PR. Source connectivity remains disabled. This closes one structural ownership gap only; it does not implement a data-search handler, perform source retrieval, establish current Meri parity or change SDK/model orchestration. Actual operation-specific adapters, source authorization, retrieval/evidence quality, real-request measurement and G1 security/runtime qualification remain open.
