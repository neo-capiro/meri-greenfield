# G1 REL-02 operational-read contract candidate — bounded H4E worker handoff

Worker: one bounded Hermes session (no delegation, no recursive dispatch). Task brief:
`docs/coordination/tasks/CODEX-G1-REL02-OPERATIONAL-READS-REMOTE.md` (read-only, allocated at
`e666d67264f505a53c6ee33759b5987f6256ae8e`). Exact task base: `d46d7dd43e6177245c75f85cfd5669291dfbbc5d`.
Shared policy read at `neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`
(BOOTSTRAP.md, AGENTS.md, hermes/OPERATING.md, `machine-paths.local.yaml` revision on this host).
Repository rules read: `AGENTS.md`, `docs/IMPLEMENTATION-STANDARDS.md`,
`docs/handover/20261011/CONTINUATION-INSTRUCTIONS.md`.

This is a **source-only candidate** for exactly two selected read intents: `query_tasks` and
`query_action_items`. It does not connect, authorize, register or enable either operation. Both
operations remain unregistered, unavailable and unusable by any skill. REL-02/G1 remain OPEN; all
96 selected intents and 43 deferrals remain required.

## 1. Implementation outline (recorded before coding)

**Responsibilities and canonical owners**

| Item | Owner |
| --- | --- |
| Canonical schema owner of the two operational-read external DTOs | `packages/contracts/retrieval-0.2/operational-reads.schema.json` (`$id urn:meri:retrieval:operational-reads:0.2.0`) |
| Structural invariants for those DTOs | `packages/contracts/retrieval-0.2/operational-reads-validation.mjs`, exported as `createOperationalReadValidators({validateShape, assertSubject, assertWindow, assertSourceInventory, unique})` — the same collaborator contract `mail-validation.mjs` / `meeting-source-validation.mjs` use |
| Shared envelope/subject/window/source/coverage semantics | Existing `meri.schema.json` / `common.schema.json` / `retrieval.schema.json` `$defs`, referenced not copied |
| Catalog registration, descriptor byte pins, `validate.mjs` group wiring, availability state | Integration owner (Codex). **Not touched here.** |
| Runtime authorization (client wall, RLS, memory wall), current-wall decisions, cursor authenticity, live freshness, `openOnly` semantics, owner-query order | Future gateway/control owner. **Not established, not claimed here.** |
| Unscoped legacy action-item list (`ActionRecommendationReadService.list`) authorization and coverage | **PENDING** — see §4. Not modelled as a closed validated contract. |

Dependency direction: operational-read DTOs → shared contract defs (`urn:meri:contracts:0.1.0`,
`urn:meri:retrieval:common:0.2.0`, `urn:meri:retrieval:retrieval:0.2.0`). No product code is
imported; the candidate is inert metadata + pure validators.

**Operation-specific input/result responsibility**

| Operation | Modes | Input | Observed defaults / bounds (frozen source) | Result responsibility |
| --- | --- | --- | --- | --- |
| `query_tasks` | one canonical **exact client-scoped / authorized-tasks read** (scope kind `client` when `clientId` is supplied, `authorized_tasks` otherwise). `taskId` is an exact-identity **filter inside** that read, not a separate forced-single-row mode. There is **no** unscoped legacy list for tasks. | all optional: `clientId`, `taskId`, `assignedToMe`, `status`, `dueBefore`, `limit`, `cursor` | `clientId` ≤80; `taskId` ≤80; `assignedToMe` must be boolean (`ownerUserId = actor` when true); `status` lowercased ≤30 over `open\|overdue\|todo\|in_progress\|done\|blocked\|canceled`, where `open`/`overdue` set `openOnly` and `overdue` also defaults `dueBefore` to now; `dueBefore` ≤80 ISO instant; `limit` integer 1–50 default 25; `cursor` opaque ≤4096 | Exact page with `total`/`returned`/`tasks`, frozen `scope` and coverage relations. `totalIsExactForScope: true`; `absenceSupported` only when the page is complete and empty |
| `query_action_items` | **A. client-scoped exact / paginated read** (`clientId` supplied) | `clientId` (≤80), `actionItemId` (≤80), `status` (≤40), `sort`, `limit`, `cursor` | `actionItemId` requires `clientId`; `status` enum of the 10 `ActionStatus` values; `sort` enum `deadline\|priority` default `deadline`; `limit` integer 1–50 default 20; `cursor` opaque ≤4096 and its decoded page must be ≥2 | Exact client-scoped page with frozen `scope`/coverage derivations |
| `query_action_items` | **B. unscoped legacy list** (`clientId` absent and no `cursor`/`actionItemId`) | `status`, `sort`, `limit` | `limit` 1–50 default 20; frozen handler `clampInt`; legacy `ActionRecommendationReadService.list` clamps 1–100 default 50; payload `{tool, generatedAt, total, actions}` | **PENDING** — shape observed, but tenant-only authorization (RLS, no client/memory wall) and the absence of any coverage disclosure cannot be closed from the pinned producer. Left explicitly pending (§4). |

`query_tasks` and `query_action_items` are **distinct contracts**: task exact identity is `taskId`
(legal with or without `clientId`); action-item exact identity is `actionItemId` (**requires**
`clientId`). The client-scoped action-item read is a distinct mode from the unscoped legacy list and
neither mode's selection can satisfy the other.

**Frozen behavioral reference (read only via Git objects, never the working tree)**

`neo-capiro/capirov2@fd8765ec01d292013758606204f2c9d886cd31c1` — the `C:\dev\capirov2` working
tree was never inspected or modified.

| Frozen path | Raw bytes | SHA256 | Git blob |
| --- | ---: | --- | --- |
| `apps/api/src/meri/meri-tools.service.ts` | 415704 | `53d9d5b7ed8ba55a1086062812b3aaaf3cc225db485e4542c4ffc5836ea8e194` | `753b425b3e6b8cf55a7d0863aa961a3c9a696dea` |
| `apps/api/src/meri/meri-task-read.helpers.ts` | 10560 | `3f2ec7cd10ba3dcb3d5ae8126a36241d3b995070dc6cd33f517f9d694aa6c9e9` | `05254964f77173df35f6c4b68ec11b8550ebefed` |
| `apps/api/src/meri/meri-action-item-read.helpers.ts` | 8211 | `6b15f7c230330e23a887b440a0ee539759c96c718af1150b62fa443bf38dac29` | `9d1d56c9f2beea428ba94c4f206def1ce7bd2e38` |
| `apps/api/src/meri/meri-task-read.proof.ts` | 5795 | `4b6de679a1ed491b55367221de9afbcb9e9517718d5d115f7f07b0b71fc4284d` | `c8c1a5a51b4505fb796aa1014858c49e1900e8c5` |
| `apps/api/src/meri/meri-action-item-read.proof.ts` | 6374 | `5a4c3c3ffb1de3e370fe656dffb2e0bcadee7e6abce79ce1479f920e48efb4fd` | `02c910e5b01868a57923644fb23f93c58ef1638b` |
| `apps/api/src/intelligence/actions/action-recommendation-read.service.ts` | 17927 | `a45690a2b4ec64cffe6a827eb96f5aa41a5f19fc401bcc9237827b28f8a617fc` | `ee3a6844a184f87eede5eaf88dee687bb407472b` |
| `apps/api/src/intelligence/actions/action-recommendation.types.ts` | 3409 | `ee2d9b33cc31cbbaed7ed30fdd8b5e7234b2a3d222f318934a2fc890ae0adf00` | `a451aa69bf0f3ce4dd12823f976259848328992e` |

`meri-task-read.helpers.ts` and `meri-action-item-read.helpers.ts` were reached by following the exact
import graph of `meri-tools.service.ts` (lines 212 and 213–216); the two owner files were reached by
following the helpers' own imports (`../intelligence/actions/action-recommendation-read.service.js`,
`../intelligence/actions/action-recommendation.types.js`). All seven blobs were hashed before lexical
review. Spans read: advertised schemas 1751–1769; `queryTasks` 8421–8441; `queryActionItems`
8443–8478; helpers `objectInput` 9936, `requiredString` 9942, `optionalString` 9948, `optionalBoolean`
9956, `clampInt` 10044; schema helpers `obj`/`str`/`int` 517–525; `ensureClientVisible` 9789+.

**Boundaries preserved**

- Client-scoped exact/paginated reads (tasks; action items) are distinct from the unscoped legacy
  action-item list; task exact identity and action-item exact identity stay distinct.
- Nothing here claims an active connection, live freshness, complete history, cursor authenticity,
  source authority, authorization outcome, `openOnly`/owner-query semantics or negative absence
  beyond what the frozen producer writes.
- Result DTOs are modelled only to the extent the retained frozen producers establish them.

## 2. Methods, candidate decisions and preserved modes

The worker wrote the outline above before implementation. It then wrote exactly the schema,
validator and focused test named in the allocation. The resulting private DTOs reference the
existing public binding and private subject, window, source and coverage definitions. The validator
checks normalized selection and argument digests, trusted actor equality, client/exact identity,
owner source-content hashes, page counts, cursor *disclosure* and coverage relations. Source
inventory and subject/window checks remain delegated to the existing collaborators.

Codex repaired the incomplete candidate after the worker exited. The repairs normalize the frozen
task status before schema validation while retaining the raw-length guard; require an explicit
trusted actor for action-item page validation; bind both page `complete` flags to the derived
coverage result; and fix no-op or wrong-stage negative fixtures. An overdue resume without an
explicit original `dueBefore` is conservatively refused because this pending transport cannot
authenticate/decode the old cursor clock. The source owner can recover that clock from its cursor;
this stricter compatibility choice is **not** a claim that all native cursors are supported.

`query_tasks` keeps `taskId` exact identity inside the client or authorized-tasks page.
`query_action_items` keeps client-scoped exact/paginated reads separate from the unscoped legacy
list. The latter remains recorded as `OPERATIONAL_READ_PENDING_MODES` with no validated page
contract. Neither selected intent is registered in the catalog, exposed by a skill or exported to
the public 0.1 package. No source adapter, gateway, handler, lockfile or migration changed.

## 3. Verification (exact commands and exits)

All final checks used pinned Node `24.19.0` at
`C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`.
For npm scripts, Codex invoked that executable on
`C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js` with the Node 24 directory first
on `PATH` (the host's `npm.cmd` otherwise starts Node 22).

| Check and executor | Outcome |
| --- | --- |
| Worker `node --test test/retrieval-operational-reads.test.mjs` | **FAIL**, 6/12; six observed fixture/validator failures retained, not treated as a pass. Worker ran no full/public suite and returned no commit. |
| Codex same focused command after repair | **PASS**, exit 0, 12/12; includes missing/foreign actor, overdue cursor clock, wrong identity, forged coverage, mixed source/evidence and unscoped-mode refusal. |
| Codex root `npm run check` | **PASS**, exit 0, 150/150, after the final cursor-clock repair. |
| Codex `packages/contracts` `npm run check` | **PASS**, exit 0: generated-distribution byte check, TypeScript typecheck and 7/7 public tests. The distribution check occurred before the final private validator/cursor repair; those final changes are excluded from public files and the root full check reran afterward. |
| Codex independent frozen-source byte verification via `git show` | **PASS**, exit 0; all seven byte counts and SHA256 digests in §1 match exactly. |

No deterministic Promptfoo/DeepEval model assertion was run: this candidate changes inert,
unregistered private contracts only. No model, orchestration, retrieval handler, route, source
connection or live conversation was changed or exercised.

## 4. Result-DTO closure and remaining source gaps

The frozen task owner provides a canonical row with `nativeCompletion` and `sourceProof`, exact
`total` and per-page coverage. The frozen action-item client-scoped owner provides a different row,
`acceptedAsTask: false`, action recommendation provenance and its own page coverage. Both result
shapes are modelled only for the observed producer fields. The unscoped action-item list returns
`{tool, generatedAt, total, actions}` without a client-scoped wall or coverage/absence proof and
remains pending. The task owner query order is not established as a stable transport guarantee;
the candidate discloses `owner-order-unconfirmed`. The action-item order is disclosed as observed
but no immutable snapshot is claimed. Native cursor authenticity, authorization, current
entitlements, source freshness, full history, current wall and actual negative absence require a
future gateway/source owner. The private result may disclose the source owner's `absenceSupported`
bit, but this pending transport always keeps `evidenceReady: false` and
`negativeAssertion.kind: none`.

## 5. Authority and limits honoured

Only frozen Capiro Git objects at `fd8765ec01d292013758606204f2c9d886cd31c1` were read;
the dirty Capiro checkout remained untouched. The task is source-only and local. There was no
cloud/native/browser run, real request, customer data, source connection, credential access,
external write, push, PR, merge or deployment. REL-02 and G1 remain OPEN; all 96 selected intents,
43 deferrals and the original skill maps remain required. Cleanup1 shared paths and release remain
held under the separate coordination record.

## 6. Handoff and Codex decision

H4E started at 14:26:06 UTC, ended at approximately 14:31:49 UTC with process exit 1, and its
owned PID 20428/launcher 21144/parent 23080 were verified absent at 14:33 UTC. The registry is
`C:\Users\Administrator\Documents\Codex\2026-10-11\new-chat\work\H4E-supervisor.json`
with status CLOSED. Its uncommitted 6/12 candidate was **HOLD**. Codex repaired it within the
same four allocated paths, reviewed the frozen producers and tests, and independently obtained
the checks above. **ACCEPT SOURCE ONLY** for these two inert private candidate contracts;
**HOLD** catalog registration, live validation, REL-02 and G1. This is a Codex-reviewed local
commit candidate, not a worker-authored accepted commit. No new publication authorization was
given for this branch.

## 7. Artifact identities (pre-commit measurement)

| Candidate path | Raw bytes | SHA256 |
| --- | ---: | --- |
| `packages/contracts/retrieval-0.2/operational-reads.schema.json` | 31,381 | `a8556220e2285239e9d46aba97954594f245daad20ab126c1733f2360d3f109c` |
| `packages/contracts/retrieval-0.2/operational-reads-validation.mjs` | 21,346 | `81be7fe48c5d34f9352e145d9c47dc2e143ffc0b985a5f1ac26e0be07c344a42` |
| `packages/contracts/test/retrieval-operational-reads.test.mjs` | 31,902 | `475dc1507403a419e8b85880632f5f0ae9fc0f9f1410399d951d0cf4e049386d` |
