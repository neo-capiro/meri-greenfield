# G1 REL-02 meeting-source contract candidate — bounded H4D worker handoff

Worker: one bounded Hermes session (no delegation, no recursive dispatch). Task brief:
`docs/coordination/tasks/CODEX-G1-REL02-MEETING-SOURCE-REMOTE.md` (read-only, allocated at
`65b293fd5919cf18bc33fbf3c3cda5051118461b`). Exact task base: `1e5b9eb391e1b716c7f11608d7ebbe833f85fdd1`.
Shared policy read at `neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`
(BOOTSTRAP.md, AGENTS.md, hermes/OPERATING.md, machine map revision `machine-paths.local.yaml`
on this host). Repository rules read: `AGENTS.md`, `docs/IMPLEMENTATION-STANDARDS.md`,
`docs/handover/20261011/CONTINUATION-INSTRUCTIONS.md`.

This is a **source-only candidate**. It does not connect, authorize, implement, register or accept
anything. The three operations remain unregistered, unavailable and unusable by any skill.
REL-02/G1 remain OPEN; all 96 selected intents and 43 deferrals remain required.

## 1. Implementation outline (recorded before coding)

**Responsibilities and canonical owners**

| Item | Owner |
| --- | --- |
| Canonical schema owner of the three meeting-family external DTOs | `packages/contracts/retrieval-0.2/meeting-source.schema.json` (`$id urn:meri:retrieval:meeting:0.2.0`) |
| Structural invariants for those DTOs | `packages/contracts/retrieval-0.2/meeting-source-validation.mjs`, exported as `createMeetingValidators({validateShape, assertSubject, assertWindow, assertSourceInventory, unique})` — the same collaborator contract `mail-validation.mjs` uses |
| Shared envelope/subject/window/source/continuation semantics | Existing `common.schema.json` / `retrieval.schema.json` / `meri.schema.json` `$defs`, referenced not copied |
| Catalog registration, descriptor byte pins, `validate.mjs` group wiring, availability state | Integration owner (Codex). **Not touched here.** |
| Runtime authorization, current-wall decisions, source connectivity, cursor authenticity, live freshness | Future gateway/control owner. **Not established, not claimed here.** |

Dependency direction: meeting DTOs → shared contract defs (`urn:meri:contracts:0.1.0`,
`urn:meri:retrieval:common:0.2.0`, `urn:meri:retrieval:retrieval:0.2.0`). No product code is
imported; the candidate is inert metadata + pure validators.

**Operation-specific input/result responsibility**

| Operation | Mode(s) | Input required | Observed defaults / bounds (frozen source) | Result responsibility |
| --- | --- | --- | --- | --- |
| `meeting.list_upcoming_meetings` (alias `list_upcoming_meetings`) | synced-calendar **inventory** only; no cursor, no exact-source read | none (all optional) | `clientId` ≤36 chars; `limit` 1–25 default 10; `withinDays` 1–365 default 30 | Bounded upcoming-meeting rows (`count` = returned bounded rows, **not** full history), `window.from/to` derived from trusted now |
| `meeting.query_debriefs` (alias `query_debriefs`) | **list** (no `debriefId`) and **exact body** (`debriefId`) | `clientId` | `debriefId` ≤80; `limit` 1–25 default 25 (exact mode forced 1); `characterLimit` 1–6000 default 1500 list / 5000 body; `characterOffset` ≥0 requires `debriefId`, mutually exclusive with `cursor`; `cursor` opaque ≤4096; `from`/`to` inclusive on `meeting.startsAt` | Approved-only eligible debrief page (`total` is the returned page only) plus exact body windows with hash provenance |
| `meeting.read_client_meetings` (alias `read_client_meetings`) | **meeting inventory** (no `sourceId`; list or exact `meetingId`) and **exact source body** (`meetingId`+`sourceKind`+`sourceId`) | `clientId` | `meetingId`/`sourceId` ≤80; `sourceKind` enum `note`\|`transcript`; `sourceId` ⇔ `sourceKind`, both require `meetingId`; `from`/`to` refuse with `meetingId`; `limit` 1–25 default 25; `characterLimit` 1–6000 default 5000; `characterOffset` ≥0 requires `sourceId`, mutually exclusive with `cursor`; `cursor` opaque ≤8192 | Authorized meeting/source **inventory** page (source bodies are never read by an inventory page) or one exact canonical source-body window with hash + byte provenance |

**Frozen behavioral reference (read only via Git objects, never the working tree)**

`neo-capiro/capirov2@fd8765ec01d292013758606204f2c9d886cd31c1` — the `C:\dev\capirov2` working
tree was never inspected or modified.

| Frozen path | Raw bytes | SHA256 | Git blob |
| --- | ---: | --- | --- |
| `apps/api/src/meri/meri-tools.service.ts` | 415704 | `53d9d5b7ed8ba55a1086062812b3aaaf3cc225db485e4542c4ffc5836ea8e194` | `753b425b3e6b8cf55a7d0863aa961a3c9a696dea` |
| `apps/api/src/meri/meri-debrief-read.helpers.ts` | 12928 | `038fcad2095f44c45a7a623036ccbf03bc9b1a062c738917b70ecd2582d0bea4` | `bc78725ec3fb991aadc60317fb22bd6d26675c39` |
| `apps/api/src/meri/meri-meeting-read.helpers.ts` | 14635 | `e497f85d0e82d14936656cdfd379d20db2391cb1874b11855dcddc25931aca40` | `42824d1a299c23e06d762f1d962a6d160eb1fe69` |

The two helper files were reached by following the exact import graph of `meri-tools.service.ts`
(lines 203 and 205–211) for the two exact readers; both were hashed before lexical review. Spans
read: advertised schemas at 1536, 1790, 1815; `listUpcomingMeetings` 7463–7524; `queryDebriefs`
8607–8630; `assertMeetingReadAllowed` 8632–8642; `meetingReadRow` 8644–8731; `readClientMeetings`
8734–8862; helpers `clampInt` 10044, `optionalString` 9948, `requiredString` 9941-9946,
`ownMeetingWhere` 10153.

**Boundaries preserved**

- Calendar **inventory** (bounded rows), debrief **list**, debrief **exact body**, meeting
  **inventory** and meeting **exact source body** stay five distinct modes with distinct selections,
  results and continuation rules; no mode aliases another.
- Nothing here claims an active calendar/source connection, live freshness, complete client history,
  cursor authenticity, source authority, authorization outcome or full source-body coverage.
- Result DTOs are modelled only to the extent the retained frozen producers establish them.

## 2. Candidate design decisions and preserved modes

**Modes stay five distinct contracts with distinct selections and results**

1. calendar **inventory** (`meeting.list_upcoming_meetings`): bounded rows, no cursor, no
   exact-source read, `count` is the returned bounded page.
2. debrief **list** (`meeting.query_debriefs`, no `debriefId`): approved-only eligible page whose
   `total` is the returned page only; bodies are the first `characterLimit` characters
   (default 1500).
3. debrief **exact body** (`meeting.query_debriefs` + `debriefId`): one row, `characterOffset`
   applied, default `characterLimit` 5000.
4. meeting **inventory** (`meeting.read_client_meetings`, no `sourceId`): list or exact `meetingId`;
   source bodies are never read by an inventory page.
5. meeting **exact source body** (`meetingId` + `sourceKind` + `sourceId`): one canonical window of
   one `note` or persisted `transcript` source with hash and byte provenance.

A mode cannot be satisfied by another mode's selection: each page's `selection` is a closed,
mode-specific def and `argumentsSha256` must equal `canonicalSha256` of both the mode selection and
the normalized request (`MeetingUpcomingSelection`, `DebriefListSelection`/`DebriefExactSelection`,
`ClientMeetingInventorySelection`/`ClientMeetingExactMeetingSelection`/`ClientMeetingBodySelection`).

**Explicit candidate compatibility decisions**

- **Envelope fields are candidate additions, not frozen producer fields.** The frozen producers emit
  only their own payload (`meetings`/`count`/`window`; `total`/`scope`/`coverage`/`debriefs`;
  `scope`/`coverage`/`returned`/`meetings`/`meeting`/`source`). `requestId`, `traceId`, `binding`,
  `subject`, `window`, `argumentsSha256`, `appliedFilters`, `sources`, `coverage`, `continuation`,
  `evidenceReady`, `negativeAssertion` are required by this pending transport contract on the
  accepted mail precedent (`CODEX-G1-REL02-MAIL-*`) so the same honesty rules apply. Operation
  payload fields are exactly the frozen projections.
- **`calendarWindow` (not `window`).** The frozen calendar result's `window {from,to,withinDays}`
  would collide with the shared `NormalizedWindow` envelope field, so the calendar bounds are named
  `calendarWindow`. No field is invented; only the name is disambiguated.
- **Strict external DTO, not frozen coercion.** Extra properties are refused (the frozen `obj` helper
  omits `additionalProperties`); `clampInt`/`?? fallback` coercion and `Number(string)` parsing are
  *not* reproduced. Integer fields (`limit`, `withinDays`, `characterOffset`, `characterLimit`)
  refuse strings, `null`, `NaN` and non-integers. String identity/time fields accept explicit `null`
  only where the frozen parser has a genuine `null`-as-absent branch (`optionalText`,
  `optionalInstant`); a required field refuses `null`.
- **`characterOffset` must be absent, not `null`, outside its modes**, mirroring the frozen
  `input.characterOffset !== undefined` guards: list-mode debrief reads and inventory meeting reads
  reject the key outright, and `cursor` + `characterOffset` together is refused.
- **`from`/`to`** are normalized to `Date.prototype.toISOString()` (as the frozen `scopeFor` does),
  so `+00:00` becomes `Z`; inclusive bounds are preserved and no wall clock is invented for these
  two readers (the frozen readers apply none).
- **Trusted clock only where the frozen code uses one.** `meeting.list_upcoming_meetings` requires an
  explicit `nowMs` context: `calendarWindow.from` must be within `[nowMs - 1h, nowMs + 1s]` and
  `to - from` must equal exactly `withinDays * 86400000` ms.
- **Coverage is split.** The shared, canonical `coverage` object carries source accounting and
  `returnedCount`/`truncated`/`historySupport`/`limitations`; the operation-specific frozen page
  coverage (`sourceStatus`, `pageComplete`, pagination/inventory/body flags, `omittedMeetings`,
  `nextCursor`, `note`) lives in a separate closed `pageCoverage` object so each catalog and schema
  keeps one owner.
- **Cursor opacity.** The retained frozen cursors are unsigned base64url JSON with fixed prefixes and
  binding scopes, but this contract does **not** decode, reproduce or authenticate them: a cursor is a
  bounded opaque string. Only `cursorApplied` disclosure, the resumed window
  (`scope.characterOffset === bodyCoverage.characterStart`) and the operation-level `nextCursor` are
  pinned; the shared `continuation.cursor` stays `null` because snapshot-safe resumption is not
  claimed. A forged cursor string is therefore accepted and disclosed, not verified — recorded as an
  open limit with the future gateway cursor authority as owner.
- **Honest pins independent of the source.** Every page requires `evidenceReady: false`,
  `negativeAssertion.kind: 'none'`, `snapshotVersionId: null`, `continuation.cursor: null`,
  `continuation.remainingSources: []`, `coverage.enumeration !== 'complete'`,
  `coverage.enumerableTotal: null`, `coverage.historySupport !== 'supported'` and at least one
  `coverage.limitations` entry; every source entry must have `snapshotVersionId: null`, `status`
  `partial`/`unavailable` (never `checked`), `freshness` `stale`/`unknown` (never `fresh`) and null
  `asOf`/`synchronizedAt`. No active connection, live freshness, complete history or source authority
  is claimed anywhere.
- **Frozen derivations are enforced as written**: `pageCoverage.pageComplete ===
  sourceInventoryComplete`, `complete === (!cursorApplied && paginationComplete && rows === 0 &&
  sourceInventoryComplete)` (a page with rows is never `complete`), `sourceBodyCoverageComplete ===
  (rows === 0 && omittedMeetings === 0)`, `truncated === (!paginationComplete || rows > 0 ||
  omitted > 0 || !sourceInventoryComplete)`, `notes`/`transcript`/`transcriptReason` availability
  derivations, source ordering by `(sourceKind, sourceId)` `localeCompare`, debrief
  `complete === (start === 0 && end === total)`, `truncated === (end < total)`, page-level
  `truncated === (nextCursor !== null || !bodyCoverageComplete || sourceStatus !== 'healthy')`,
  `complete === (healthy && !cursorApplied && paginationComplete && bodyCoverageComplete)`,
  `totalIsReturnedPageOnly: true`, `appliesTo: 'approved_only_eligible_debriefs'`, and the exact
  source-body hash/byte relations (`contentHash === provenance.bodySha256`,
  `sha256(body) === returnedBodySha256`, `complete ⇒ bodySha256 === returnedBodySha256` and
  `sourceByteLength === returnedByteLength`).
- **`order` constants are labelled as inferred.** `startsAt-asc_nulls-and-ties-unspecified` is the
  frozen `listUpcomingMeetings` order; the two cursor-key orders are
  `...-cursor-key-owner-unconfirmed` because the retained set contains the cursor key
  (`startsAt`/`id`, `createdAt`/`id`) but not the owner SQL. Only in-page monotonicity is asserted.

## 3. Verification (exact commands and exits)

Pinned runtime: `C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`
(Node v24.19.0), run from `packages/contracts` / repository root of
`C:\dev\meri-greenfield-meeting-source-20261011`. Root had already prepared `npm ci`.

| Check | Command | Result |
| --- | --- | --- |
| Focused candidate suite | `node --test test/retrieval-meeting-source.test.mjs` | **PASS** — exit 0, 16 tests, 16 pass, 0 fail |
| Full private contract suite | `node --test packages/contracts/test/*.test.mjs` | **PASS** — exit 0, 133 tests, 133 pass, 0 fail |
| Generated distribution unchanged | `node generate.mjs --check` | **PASS** — exit 0, `"check":true`, 6 unchanged artifact records |
| Public typecheck | `node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext test/public-types.ts` | **PASS** — exit 0 |
| Public distribution suite | `node --test test/public-package.test.mjs` | **PASS** — exit 0, 7 tests, 7 pass, 0 fail |

Coverage of the focused suite (16 cases): literal defaults and non-mutation; coercion/`null`/extra-key
refusal with a 36/80/8192/4096 length boundary; missing `nowMs` and unknown context field; bounded
count/history discipline; empty-page enumeration; duplicate identity; mode separation and mode
substitution; missing/foreign client scope; range/bounds refusals; source-restricted and omitted-row
disclosure; pagination disclosure; source availability derivations and ordering; body window, hash and
byte provenance; truncated-body decisive reads; cursor disclosure without authentication; accessor,
cycle and non-finite refusal without executing getters (getter call count asserted as 0);
collaborator delegation with teeth; closed schema objects; unchanged public exports; catalog and skill
exclusion of the pending operations.

**Failures preserved (not hidden).** The first focused runs failed and were fixed before this commit:

1. `SyntaxError: Unexpected token 'export'` — seven operation validators were declared `export` inside
   the `createMeetingValidators` factory (only the factory is exported, as in `mail-validation.mjs`).
   Fixed by removing the inner `export` keywords; rerun passed.
2. Second run, 8/16 failing: `withinDays must be an integer between 365 and undefined` (wrong
   `boundedInteger` argument order); `Unknown R2 contract ResolvedSubject` (the local test harness
   compiled only the meeting defs, not the unchanged canonical schemas); and
   `data/coverage must NOT have additional properties` because operation-specific coverage flags had
   been placed inside the closed shared `Coverage` object.
3. Third run, 6/16 failing, all fixture fidelity errors rather than product defects: returning the
   full body instead of the returned slice; a default `characterLimit` that contradicted an
   intentional short window; a personal-subject scope kind outside the canonical `Scope` enum; three
   negative-edit cases that were self-consistent (so correctly did not throw); and `scope` offset
   handling under an applied cursor.
4. One full-suite invocation was executed by an unpinned `node` (v26.7.0) resolved from `PATH`
   because the `PATH` prepend did not take effect. That run is **not** evidence; the pinned
   Node 24.19.0 rerun above is the reported result.

No product, adapter, handler, catalog, validator-wiring, package or lockfile defect was found, and no
check was skipped or weakened to pass.

## 4. Result-DTO closure and remaining source gaps

Closed from the retained frozen sources (with the two additional helper files pinned in section 1):
the five mode definitions, all selection/cursor scopes, `MeetingSourceInventory`,
`MeetingSourceAvailability`, `MeetingReadRow`, `ExactMeetingSource`, the debrief owner page/row
shapes, all three producers' payload projections, the body hashes/byte lengths and the frozen
derivations listed in section 2.

Explicitly **open / pending** (no invented fields):

- **Per-field types and nullability of the calendar row.** The frozen `listUpcomingMeetings` selects
  `subject, endsAt, location, isVirtual, joinLink, status, isInternal, organizerName, organizerEmail,
  client{id,name}, attendees{name,email,role,responseStatus}` but the Prisma `Meeting`/attendee model
  and any DTO are not in the retained set. Those fields are modelled as typed-or-null unions and the
  owner is the missing Prisma/DTO metadata. `startsAt` is required non-null because the frozen
  `where` clause (`gte now`, `lt until`) only matches valued rows; `status` is required to be a
  non-`cancelled` string, and whether a SQL `NULL` status could satisfy Prisma `not: 'cancelled'` is
  **unresolved**.
- **Source registry identity.** `sourceId` is constrained by the canonical `SourceState` pattern but
  deliberately not pinned (the fixture uses the synthetic `"meeting"`); the catalog/source-registry
  owner allocates the real id when the operation is registered. `adapterVersion` is likewise
  unpinned beyond the shared pattern.
- **Owner-status ⇄ source-inventory mapping.** The debrief owner's `sourceStatus: healthy|degraded`
  and `sourceReason` are carried verbatim; this contract does not map them onto source-inventory
  statuses (that mapping is unproven).
- **Cursor authority and format.** Cursor bytes, signing, TTL and cross-page binding are not
  reproducible or verifiable from this repository; owned by the future gateway/control cursor
  authority.
- **Owner ordering and totals.** The two reader orderings and the debrief owner's `nextAfter`
  position semantics are inferred from the retained cursor keys and only checked in-page; the owner
  query is not in the retained set. The upcoming producer has no cursor, so its page cannot be
  continued or proven exhausted beyond the `take` bound.
- **Exact transcript extraction internals.** The frozen transcript read path
  (`extractAttachmentText`, `truncated` refusal, `contentHash` re-verification) is described by the
  frozen handler but its owner service is not retained; only the resulting contract invariants are
  pinned.
- **Integration prerequisites (not performed here).** Registering the `meeting` schema group in
  `packages/contracts/retrieval-0.2/validate.mjs`, catalog descriptors/byte pins/availability, and
  supplying the canonical `validateShape`/`assertSubject`/`assertWindow`/`assertSourceInventory`/
  `unique` collaborators to `createMeetingValidators` are integration-owner work. The focused suite
  compiles the candidate defs over the unchanged canonical schemas and stands in for those four
  unexported helpers; it asserts that delegation happens rather than re-implementing their rules.

## 5. Authority and limits honoured

Four paths created (exclusive writable scope); no other file was modified or deleted; the task brief
was read-only. No dependency, lockfile, `validate.mjs`, `catalog.json`, common/public schema, package
export, adapter, handler or migration was touched; no operation was registered and no availability
state changed, so the candidate stays inert and unusable by any skill.

The frozen behavioral reference was read only through Git objects
(`git show <commit>:<path>`, `git rev-parse <commit>:<path>`); the `C:\dev\capirov2` working tree was
never inspected or modified. No network access, dependency install, cloud/AWS/native/Docker run,
browser run, paid model/provider call, source connection, customer data read, external write, push,
PR, merge or deployment occurred. No historical private `.task-inputs` directory was read and no
ambient AWS credential was used. Machine-local policy, not memory or profile text, was used: this
candidate supplies no authorization, no live freshness and no source connectivity claim, and does not
alter REL-02, G1, security or runtime-parity status.

## 6. Handoff

- Candidate commit: four owned paths committed in one commit on
  `task/remote-rel02-meeting-source-20261011`, parent `65b293fd5919cf18bc33fbf3c3cda5051118461b`
  (task base `1e5b9eb391e1b716c7f11608d7ebbe833f85fdd1`). The exact commit SHA, and this report
  file's own bytes/SHA256/Git blob, are recorded in the worker handoff message because a file cannot
  contain its own content hash without changing it.
- Changed paths, bytes and SHA256 are recorded in section 7.
- Working tree clean after commit (including untracked files); no debug or scratch file is left in the
  worktree.
- Codex independently verifies this commit, may HOLD or repair it, and closes the worker process.
  Nothing in this report is acceptance; REL-02/G1 remain **OPEN**, and all 96 selected intents and 43
  deferrals remain required.

## 7. Artifact identities (pre-commit measurement)

| Path | Bytes | SHA256 | Git blob |
| --- | ---: | --- | --- |
| `packages/contracts/retrieval-0.2/meeting-source.schema.json` | 37907 | `b7ec6ecbdaab3fcccac3b83b9530828c90bda96685385b6f49f929fbd2776664` | `8142217c2e85930ad386bbaf7b421c18aef62cc0` |
| `packages/contracts/retrieval-0.2/meeting-source-validation.mjs` | 23313 | `5fc7e262efc9be933c760ee089e02f58e4a8d74a958c8e412c216846bbba8ac2` | `dd019496ccc5f6715676c6a6d5cedeeb6a679e5d` |
| `packages/contracts/test/retrieval-meeting-source.test.mjs` | 35167 | `45dcd0288013c43138d69058b12eaa67d7997b18ff3ecca6b645a90ff026f7a4` | `3f3b9effdca885ffd03ea8f0398f6fd242dcd9c0` |
| `docs/coordination/reports/CODEX-G1-REL02-MEETING-SOURCE-REMOTE.md` | self-hashing | self-hashing | self-hashing (recorded in the handoff message) |

All three code artifacts were re-run and re-measured at these bytes; the report file is updated in the
same commit as the final handoff text.
