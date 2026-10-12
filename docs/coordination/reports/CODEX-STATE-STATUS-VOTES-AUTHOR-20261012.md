# State status and floor-vote contract author packet

Source candidate: `a25516ae8d2c44638800e492e439e212098dc750`, tree `f7942b8aa8e3011336bc56cc568ddd0e7c4d52cf`; base `a3e946c1fa264ae7b33205f5b87804ee1ef75773`. **Ready for independent source review; runtime HOLD.** No canonical registration, active handler, source grant, adapter or provider behavior is implemented here.

The new private family covers `get_state_bill_status` and `search_state_floor_votes`. It preserves unresolved, resolved-but-absent and found status branches, and refuses nonempty or state-wide vote output when a supplied bill cannot be parsed. The pure `state-bill-identity.mjs` helper only normalizes canonical key/designation syntax. It cannot choose a session, fetch a bill, reserve quota, ingest data or establish current authority.

## Interface and ownership

- Schema: `urn:meri:retrieval:state-status-votes:0.2.0`, definitions `StateBillStatus{Request,Input,Output}` and `StateFloorVotes{Request,Input,Output}`.
- Factory: `createStateStatusVotesValidators({validateShape, schema})`.
- Methods: `normalizeStateStatusVotesInput`, `assertStateStatusVotesOutput`, `validateStateStatusVotesShape`, `stateStatusVotesInputDefinition`, `stateStatusVotesOutputDefinition`.
- Context keys: none. Model or caller `resolvedBillKey`, actor, tenant, clock or authority fields refuse admission.
- Normalization returns detached frozen effective `input` and frozen `metadata.selector`; the selector is syntactic, never a resolution receipt.
- Canonical `snapshotOperationData` owns inert JSON admission. Existing `state-legislation.schema.json` owns the status-label vocabulary, reused without a second label registry. Root explicitly allocated the new state identity helper after no existing Meri equivalent was found.

Status accepts `billId` with `query` fallback after blank/null normalization. Selectors trim then clip UTF-16 to source bounds. Vote limit preserves finite numeric/string conversion, truncation and clamp to 1–25 with default10; unknown chamber values retain the source's ignored-filter behavior. A direct key overrides a conflicting state hint. Designations try the hint first, then the text prefix, including dotted types and DC-style hyphenated numbers. No current-session default or ambient clock is introduced.

## Exact pinned basis and limits

The [reference identities](../../qualification/candidates/read-continuation-20261012/state-status-votes-author/reference-identities.json) bind four immutable file pairs at `fd8765ec01d292013758606204f2c9d886cd31c1` and observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`; all four are unchanged. Relevant locators:

| Source | Inspected contract/policy locators |
|---|---|
| `apps/api/src/meri/meri-tools.service.ts` | Resolver3727–3774; status5553–5683; votes5691–5755; optional strings9948–9954; limit10044–10048; live outcome notes10490–10498. |
| `packages/shared/src/index.ts` | State key grammar934; normalization948–965; designation1009–1045; status-label behavior1523–1550. |
| `apps/api/prisma/schema.prisma` | StateBill6651–6720; action6769–6784; vote6811–6833; companion link6870–6882. |
| `apps/api/src/meri/meri-state-bill-live.ts` | Live outcome38–41; query-unit reserve29,71 onward; selected resolver dependency and normalized upsert imports. |

Only metadata, derived contract facts and independently authored Meri source are retained. No producer implementation is imported, copied or executed.

Direct-key output correlates only the returned `billId`; stored state/session/identifier are independent strings, with no invented database CHECK. Designation output must use one canonical key matching its state and bill number. This deliberately refuses malformed stored keys outside the documented source key convention; it cannot establish which matching session is latest or whether the lookup occurred. Votes from two sessions cannot masquerade as the single resolved-bill search. Bare state filtering is a prefix condition and does not create a bill selection.

Stored signed Int tallies and sponsor counts remain signed; no sum, positivity, outcome inference or uniqueness guarantee was added. Null vote dates are admitted first in descending PostgreSQL order, with ties otherwise unconstrained. Actions require SQL dates; statusAt is a timestamp and need not be midnight. Generated instants use canonical finite `Date.toISOString()` wire form within the existing Ajv date-time range; date-only storage serializes at UTC midnight. This rejects alternate equivalent offsets, leap-second spellings and broader database date representations rather than pretending to support them.

Status-label serialization preserves the pinned producer's inherited-name edge: Object.prototype names yield an omitted label; ordinary unknown strings and empty strings remain raw labels. Missing companion enrichment has three null fields, whereas a present companion with null status has `Unknown`. No URL, arbitrary stored ID or linkType lexical restriction was invented.

The contract checks count, cap, branch, note, selector and date correlations. It does not reproduce PostgreSQL locale/wildcard motion matching, prove related-record provenance, bind a fresh source authority or certify current status. Source notes remain reported compatibility data. No vote result or empty window means a bill passed or failed; capped histories are not complete history.

A designation miss in the source may call live LegiScan, reserve four provider-query units under shared quota accounting, and upsert normalized data. Those are explicit adapter effects, not evidence that this is a side-effect-free source read. None ran here; four query units are not a dollar budget or permission to spend. Current task/actor/source grants, release rechecks, durable budget, provider access and ingestion policy remain required before any execution.

## Checks and preserved failures

The [outline](../../qualification/candidates/read-continuation-20261012/state-status-votes-author/outline.json) preceded production changes. Focused tests exercise 22 positive/adversarial cases across actual factory methods and the shared helper. Initial strict Ajv compilation failed on the multi-type limit declaration; the repaired explicit `anyOf` passes **22/22** without removing an assertion. Original raw stdout/stderr and four exact source preimages are retained. The first capture saw untracked files and therefore an empty Git diff; [initial-source.json](../../qualification/candidates/read-continuation-20261012/state-status-votes-author/initial-source.json) records that limitation and binds the preserved preimages instead of claiming otherwise.

A physical dependency copy hit ENOSPC. Only this worktree's incomplete copies were removed; existing installed dependencies were borrowed read-only for checks, with no install, lifecycle script, lock edit or donor mutation. The diagnostic transcript was truncated, so [dependency-copy-failure.json](../../qualification/candidates/read-continuation-20261012/state-status-votes-author/dependency-copy-failure.json) records an observed failure rather than fabricated raw bytes. An overlong source line-range read also raised IndexError and was repeated with a bounded endpoint; its observation is recorded in the outline without publishing private stdout.

Offline source/receipt preservation passes **38/38**, with **6110 original files unchanged**. All three owned process groups are absent; the broad run reaped its esbuild descendant. Only the two borrowed dependency symlinks were removed after capture completion. Final actual check counts, owned-process cleanup and source identities are in [verification.json](../../qualification/candidates/read-continuation-20261012/state-status-votes-author/verification.json). A root check was already started before the parent centralized broad checks: **1396/1398 passed, two failed**. The public-package check reported generated `browser.mjs` drift (cause not established here); the existing data-search no-side-effects subprocess rejected the borrowed Ajv realpath outside its allowed worktree. Both raw failures are retained. The latter is an observed dependency-symlink permission boundary, not permission to weaken the fixture. No broad rerun or separate public-package check was started; root owns combined verification. Public0.1, existing sources/tests/catalog/locks and source-disabled configuration remain byte-identical to the base.

No native fixture, database, provider, model, HTTP, daemon, cloud, customer-data or frontend action ran. No background job remains owned by this lane. Independent reviewer verdict and root registration are separate from this author readiness report.

The [packet manifest](../../qualification/candidates/read-continuation-20261012/state-status-votes-author/manifest.json) binds every retained report/evidence member except itself. No source change followed the exact candidate freeze.

Full staged whitespace checking fails on eight whitespace-only lines in the preserved broad-test raw stdout. Authored non-binary paths pass; raw failure output is intentionally unchanged and the exact check receipt is retained as `whitespace.json`.
