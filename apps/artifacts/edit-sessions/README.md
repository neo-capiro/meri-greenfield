# Collabora CODE editing

The 29 October user decision selects free self-hosted Collabora CODE for
development/testing. A paid quote is not a prerequisite. Live editor activation
is the deployment's `office.enabled` configuration (`apps/runtime/artifacts/
office-composition.mjs`); the former source-level `EDITOR_ACTIVATION` record was
never consulted by composition and has been removed. Release enables the
workflow only after these are complete:

- fidelity: held-out corpus of at least 30 DOCX/XLSX/PPTX, including
  embedded-workbook PPTX, through real Save/reopen/export (design 4.6 item 1);
- edition: the exact deployed CODE version and image digest recorded, with the
  component and licence in `docs/COMPONENTS.md` (Q-X4);
- placement: disposable single-session editor containers on approved hosting
  (Q-O3, Q-X2) with zero HIGH/CRITICAL image findings, macros and external
  links disabled and container egress only to the WOPI host;
- WOPI conformance: the validator suite including lock semantics against the
  registered WOPI host (design 4.6 item 2);
- retention: `editorDrafts` purge composed through its owner (Q-O9) and the S4
  suppression generations measured at 30 s propagation (Q-X7);
- frontend: the editor frame and every save, draft, publish, conflict,
  recovery, lock and expiry state on capiro-frontend main.

## Embedded chart workbook application admission (31 October)

PPTX chart workbooks use the same bounded structural admission at attended
open/renew, WOPI read/save and explicit Publish. The former unconditional
`ppt/embeddings/*.xlsx` refusal has been removed. Each workbook must be a valid
nested XLSX under the shared inflated-byte/entry budget, have the spreadsheet
content type, and be referenced by the chart's actual namespaced `externalData`
ID through exactly one internal package relationship. Orphan or mismatched
links, duplicate data references, OLE, macros, controls and external-data parts
are refused; active relationships/content types cannot bypass checks by moving
to an innocuous filename. No package is rewritten by admission.

A conservative transition guard also rejects any Save or Publish with fewer
embedded workbooks than its validated source/current saved draft. This catches
the known engine workbook-drop regression even if the remaining PPTX is valid.
Renamed parts are allowed. Intentional workbook removal is currently refused
too: no removal-intent protocol is claimed by this bounded correction. Counts
do not prove chart-slot identity or values; the engine corpus remains necessary.

Save still stores only private exact bytes. Current Core sequence/hash reads
confirm Save; editor release invalidates the old epoch/token, and reopening
reads those saved bytes. Separate Publish retains the same bytes and immutable
parent through the existing journal and stale-head CAS. The exclusive-editor,
lock, access and retention owners are unchanged. Synthetic fixtures cover this
path for DOCX/XLSX/PPTX, including two distinct chart workbooks, plus hostile
packages and stale/denied writes.

These are application checks, not an engine capability declaration. The Office46
pin is unchanged. Release must qualify its actual ARM64 image with the retained
corpus and the positive/pre-fix chart sensitivity harness before enabling the
Office workflow. In particular, workbook retention does not prove intentional
chart-data editing, formula recalculation, fonts or visual/layout fidelity.
Real Save/Release/Publish/reopen and WOPI/current-access/retention acceptance
against the serving frontend, Core and Meri tuple remain required.

## 29 October isolated native qualification

The user authorized isolated local qualification. CODE 26.04.5.2 ran in the
existing Ubuntu WSL Linux Docker environment, using image digest
`sha256:c7415b963e32eb0986a562583f154d36d3d7a461e1ddfb660a95e87094328acb`.
The editor and WOPI host were separate HTTPS loopback origins with temporary
development TLS. Chromium 149.0.7827.55 opened actual files made by the existing
python-docx 1.2.0, XlsxWriter 3.2.9 and PptxGenJS 4.0.1 builders.

All three seed files completed real CheckFileInfo/GetFile/lock/edit/Save/unlock
flows through `createWopiFileApplication`. Word retained the edit, original
table and multilingual text. Excel retained the formula, changed quantity 4
and recalculated result 30. PowerPoint retained the edited title, chart, table
and speaker notes. Screenshots and saved OOXML parts were inspected. Saved
sizes were 21,017, 11,228 and 20,710 bytes respectively. The existing publisher then
preserved each exact saved file and parent and recovered its same immutable
version on replay, with no re-render or second publication.

This exercise used scripted Core HTTP/SQL/object ports beneath the actual
artifact/native-session/WOPI owners. It is not ordinary-role PostgreSQL, the
deployed frontend, ARM64 image qualification or the planned 30-file fidelity
corpus. At source, the runtime suite now covers an editor that dies without
Release: while its Core lease is live a plain acquire conflicts; once the lease
lapses a plain acquire (not a takeover) succeeds, the lapsed lock is cleared,
the crashed editor's token can neither read nor save, and the reopened editor
reads the last private Save with nothing published. The WOPI suite covers every
lock-bearing write (LOCK, REFRESH_LOCK, UNLOCK, UnlockAndRelock, PutFile) with a
missing or mismatched lock answering 409 with the current lock. Real CODE
renewal/revocation/crash behaviour and that larger corpus remain live-only.
Local services are stopped after the run; source, input/output files,
screenshots, failure logs and dependency caches remain in the task work folder.
The focused source suite has 102 passing checks (including ten chart-workbook
cases and the native query-shape case), zero skips; runtime types and diff pass.

`collabora-code.mjs` parses a bounded discovery XML response with the existing
`saxes` dependency. Trusted composition supplies separate exact HTTPS editor and
WOPI origins and obtains `/hosting/discovery` from the configured editor. Only
actual external-HTTPS DOCX/XLSX/PPTX edit/view actions are accepted. Malformed XML,
DTDs, duplicate actions, cross-origin actions, credentials, and injected token or
WOPISrc query parameters refuse the launch.

`createCollaboraCodeLaunch` returns the POST form descriptor for an iframe. The
action URL contains only the credential-free WOPISrc in addition to approved
discovery parameters. The existing short-lived WOPI token and its absolute expiry
are form fields; the application must not persist/log them and must return the
descriptor with no-store caching. View mode cannot fall back to edit. The fixed
`/api/meri/office/wopi/files/:fileId` path is the host route, registered by
`apps/runtime/control-route-boundary.mjs` to the composed `handleWopi` adapter
described below. The launch module performs no fetch or editor process launch.

Core `apps/api/src/meri/office-drafts` now owns durable private draft bytes and
exclusive locks, with the reserved `20281029020000_office_draft_owner` migration.
The unused in-memory lock table and its one pure fixture have been removed.
Eight ordinary-role PostgreSQL tests in Core replace that fixture and cover
lock/sequence atomicity, connection recovery, owner isolation, revocation,
publication barriers, discard and expiry. Save remains private; the Core row
records publication state but cannot create or certify an immutable version.

`core-drafts.mjs` is the fixed-route Core client for open/read/lock/save/discard
and publication state. It borrows the existing action-session owner's live
native credential for the exact run and client before and after each call,
with the control service secret. It creates no credential or session store,
never gives the runner a secret, and never retries. `core-draft-wire.mjs`
correlates the private Core wire response, including exact bytes/hash, source,
sequence and publication intent. Core remains the state/lock authority.

Save and read use the dedicated 28,000,000-byte JSON boundary for at most 20 MiB
of file bytes; other responses stay at 32 KiB. Uncertain effects remain unknown,
and failed reads release nothing. Late responses are retired after cancellation.
The WOPI adapter composes this client with current artifact authority and
retention on every call; a Core draft receipt alone cannot authorize an artifact.
Suppression/access-loss cleanup and the canonical retention inventory must be
composed before activating the `editorDrafts` class.

The private `executeOfficeEdit` method on the existing PostgreSQL artifact
service now publishes exact edited bytes through the existing intent journal,
immutable objects and head CAS. Trusted composition must opt into
`officeEditWrites` and construct its source from the retained Core draft and
current-authorized base, never from browser/model claims. The delivery identity
is `office:<sessionId>:<draftSequence>` within tenant/actor/conversation; the
existing journal claims it once across run changes. Replays use its original
request hash and exact immutable source, with fresh access/retention checks.
PENDING/UNKNOWN and an object alone cannot cause another write. A canonical
stale-parent refusal stays a conflict. Save does not call this method.

`packages/contracts/office-edit.mjs` owns the private stored source discriminator
`meri.office-edit/1`: format, title, editor actor, draft sequence/hash and exact
parent version/object hash. Existing typed source envelopes and hashes remain
unchanged. An edited parent may be edited again; the typed recipe renderer
refuses it rather than erasing native edits. The private inspection reader
preserves actual spreadsheet caches and reports them as editor-provided and
unverified. It does not claim caches were removed, recalculated or zeroed.

The frozen typed tool schemas/catalog pins and browser contract exports are
unchanged. Before composing writes, the versioned Office browser receiver must
admit this inspection label and the document inspect route must use that
receiver; the old XLSX receiver deliberately refuses the new label. This is a
specific remaining integration dependency, not a live activation. The current
artifact context/receiver size limit also remains in force even when a larger
private draft can be saved. The A7 implementation owner continues this work in
the 29 October source sequence.

`inspect-office.mjs` reuses the bounded ZIP/OPC/XML parsers, checks every
relationship and XML part, and refuses macros, arbitrary embedded/active objects and
non-hyperlink external relationships. Passive HTTP(S) hyperlinks are retained.
Native PowerPoint chart workbooks are admitted only as validated XLSX packages
under `ppt/embeddings`, referenced by a chart's package relationship. Nested
embeddings and other object types refuse. The outer presentation and workbooks
share the existing total inflated-byte and entry budgets; exact bytes are retained.
It neither executes Office nor rewrites the package. This structural pass is
not native rendering, fidelity, recalculation or a complete active-content
qualification.

The locally authorized CODE 26.04.5.2 exercise found that CODE forwards
`access_token_ttl` alongside `access_token` on WOPI requests. The optional expiry
must be a single bounded integer equal to the signed claim, or the WOPI zero
sentinel for unknown client expiry. CODE used the zero sentinel in native
requests; server-side signed expiry is always enforced. The hint cannot extend
token life or replace current session, editor epoch or retention checks.
See [WOPI token concepts](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/rest/concepts).

The initial launch checkpoint had nine source tests. The later canonical Core,
WOPI and publication checks below replace its unused pure Save/publish decisions.
No source test establishes actual CODE execution, image security or Office
fidelity. No image/application build, deployment or provider call was performed.

The native revision checkpoint adds 39 tests for DOCX/XLSX/PPTX byte preservation,
source binding, concurrent/restarted delivery, lost acknowledgements, stale
parents, corrupt source/objects and current revocation/suppression. Together with
affected native delivery, structure, publication, recovery, retention and editor
checks, 110 tests pass. The old direct publication fixture failed identically
against the untouched service at the base because it still supplied a removed
budget API; it now tests the existing native invocation and original authority.
Focused noEmit import/type checks pass. These source fixtures use the actual
owners over scripted SQL/CAS/object ports, not a native database or CODE host.

The draft client adds 42 passing checks using the actual native-session owner
and synthetic HTTP responses, including full-size save/read, revocation,
credential replacement, closed response correlation, noncanonical bytes,
ambiguous effects and cancelled/late fetch. Focused noEmit import/type checks
also pass. The WOPI HTTP route, cross-instance exclusive editor admission,
versioned browser receiver and final integration with the Core receiver remain
open; no live editor connection is claimed by these client tests.

The editor-admission successor uses Core migration
`20281029070000_office_editor_admission`: the same private draft row now holds one
editor ID, monotonic epoch and ten-minute expiry. The runtime client supports
inspect/acquire/refresh/release/explicit takeover and `editor/read`. Every file
lock and Save now requires that exact editor proof; the control-only `read`
remains the recovery path after editor loss. Core serializes these checks with
the actual draft mutation. Takeover clears the prior file lock without clearing
saved bytes, and a queued stale Save is refused after takeover commits.

WOPI token domain v1 binds chat and editor ID/epoch in addition to the exact
draft/file/version and actor. Old domain tokens refuse. The eventual WOPI host
must use `editor/read` and current Core proof on every crossing, bound token
expiry by both the current editor admission and native session, and re-open
through authenticated UI after process-local credential loss. There is no
persisted bearer or new runtime session store. The matched Core/runtime source
must ship together; no unfenced lock/save compatibility fallback exists.
61 runtime editor/client/token tests and focused noEmit checks pass; Core has
57 focused checks including 17 ordinary-role PostgreSQL cases, source types,
schema validation and 27 closure/pin checks. These do not establish a running
WOPI server, browser frontend or native Office qualification.

## WOPI file adapter source checkpoint

`wopi-files.mjs` exposes a private Fetch `handle(Request) -> Response` adapter for
CheckFileInfo, GetFile, Lock, RefreshLock, Unlock, atomic UnlockAndRelock, GetLock
and PutFile. `wopi-http.mjs` owns native request admission, bounded binary input
and empty, no-store refusals. The adapter starts no listener; the control
route boundary registers it under the fixed WOPI path. Rename/delete are unsupported; relative-file
creation is denied and advertised as unavailable to the user. Save calls only
Core's private draft owner. No WOPI operation invokes immutable publication.

Trusted composition supplies the existing Core draft client, ArtifactService,
token codec, canonical retention generation reader and an attended context
resolver. The resolver must use the existing live session owner and return
`{context, selectedClientId, expiresAtMs}` for the signed chat/actor. This adapter
has no credential cache or session map. A restart that loses the attended native
session refuses access until the authenticated UI reopens the durable draft.
The future launch issuer must cap the token at the native session and Core
editor expiry. The host refuses a token exceeding the resolved native expiry.

ArtifactService's private `editorSource` reuses its current authority, immutable
byte verification and mandatory retention gate. Write tokens require current
`artifact.revise`; view tokens require `artifact.download`. Core `editor/read`
checks the current editor epoch. The adapter matches immutable source metadata,
checks the signed suppression generation, reads bounded input, and repeats
authority immediately before effects. Afterward it repeats artifact authority,
Core editor proof and, as the final awaited read, the canonical retention
generation. Responses release no bytes, lock or receipt after a failed check.
Private Save/lock effects may already have committed when a response is withheld;
an unknown acknowledgement is never changed into success or retried by the host.

PutFile preserves exact structural-valid Office bytes up to the private 20 MiB
ceiling. It does not recalculate or render them. GetFile serves the immutable
base until a private Save exists, then the retained draft. The opaque version
includes draft ID, sequence and hash; lock conflicts include Core's exact current
lock. Printable ASCII spaces and extended 1024-character locks are supported in
the matched Core/runtime boundaries. GetFile enforces MaxExpectedSize. WOPI query
tokens must be redacted from access logs before deployment registration; the
adapter itself logs neither requests nor errors and returns no direct file URL.

135 affected runtime checks pass (29 new adapter cases, including an actual
loopback HTTP GET/LOCK/PUT/GET). They use the actual artifact, native-session,
token and Core-client owners with scripted Core HTTP responses and SQL/object
ports. Core separately passes 34 boundary/persistence checks, including 18
ordinary-role PostgreSQL cases and the extended opaque lock roundtrip. Focused
source type/import checks pass. No schema, migration, package pin or frozen
public contract changed. No build, deployment, provider or live CODE call ran.

Remaining integration is explicit: deployment/session routing, bounded launch
renewal, private recovery and Save/Publish UI, versioned Office browser receiver,
retention inventory/purge/access-loss composition and representative native
Office fidelity/conformance. The private Save ceiling does not increase the
existing artifact publication limit. These are source checks, not live editor
acceptance.

## Explicit Publish bridge source checkpoint

`publish-draft.mjs` connects the authenticated control action to both existing
owners. Its only selected input is `{draftId, sequence, sha256}` plus trusted
current context and client selection. Core supplies the retained private bytes;
ArtifactService supplies and currently authorizes the exact immutable parent.
Title, format, actor and provenance are derived from those owners. The bridge
rejects a changed selected draft, malformed package or bytes beyond the existing
artifact publication ceiling before Core begins Publish. Larger private drafts
remain saved; the private 20 MiB ceiling is not an immutable publication limit.

The native revision keeps the parent's immutable citations through the existing
`admitRetainedEvidence` port, bound to the exact prepared publication context.
The trusted `publisherFor(context, {admitRetainedEvidence})` factory supplies the
existing PostgreSQL artifact service with `officeEditWrites` enabled and this
retained-evidence admission, preserving any existing admission restrictions.
Current artifact authority and retention remain the canonical gates; the pin
does not grant current access. The source uses no new durable journal or session.

Only Core's first `beginPublish` receipt with `dispatch:true` may call
`executeOfficeEdit`. Repeated pending, unknown or published receipts call the
new recovery-only `recoverOfficeEdit` facet on the same artifact owner. It reads
the existing intent journal and immutable publication; an absent entry remains
`EDITOR_PUBLISH_UNRESOLVED` and cannot claim or dispatch. A lost begin
acknowledgement is not retried by the bridge. This prevents a recovering caller
from racing a still-running first publisher, even across native run changes.

Only a canonical stale-parent refusal settles conflict. Other post-begin
failures retain unknown; an authority-shaped error is not proof of no write.
Canonical publication identity must match the selected draft before Core settles
published. Current artifact authority/bytes and the original retention generation
are checked after settlement before returning the result. A late refusal may
withhold an already-published result; a later current-authorized call recovers
the same immutable revision without another write.

The unused `edit-session.mjs` simulation and its three pure decision tests were
deleted. Save/admission now have the Core PostgreSQL and WOPI integration cases;
publication is checked through the actual Core client, native artifact journal
and immutable publication owners. In particular, the old simulation's
absent-means-republish behavior and code-only authority refusal classification
are removed. CODE format discovery now uses the canonical Office operation map.

179 affected runtime tests pass, including 23 Publish bridge cases, current
native document delivery, WOPI/transport/token and retention cases. Focused
noEmit import/type checks pass. Two historical budget-era PostgreSQL adapter
suites remain incompatible with the current constructor: 69 of 70 cases fail
identically against the untouched service at base `fcb62859231e2806a79f4772775d200ec0d86b6f`.
They were not weakened or used as passing evidence. Their current replacements
are the native-delivery cases in the passing run. Fixture SQL and Core HTTP are
scripted here; real Core persistence has its separately recorded ordinary-role
suite. No public route/contract/package export or live editor is activated.

Protocol references: [CheckFileInfo properties](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/rest/files/checkfileinfo/checkfileinfo-response),
[GetFile](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/rest/files/getfile),
[PutFile](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/rest/files/putfile),
[atomic relock](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/rest/files/unlockandrelock).

Primary references: [CODE edition](https://www.collaboraonline.com/code/),
[Collabora integration](https://sdk.collaboraonline.com/docs/How_to_integrate.html),
[WOPI discovery placeholders](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/online/discovery),
[upstream license](https://github.com/CollaboraOnline/online/blob/main/COPYING).

## Attended runtime composition checkpoint

`apps/runtime/artifacts/office-application.mjs` now composes authenticated open,
known-ID recovery, launch, renewal, explicit takeover, release, discard and
Publish with the actual existing document options and native-session owners.
`office-access.mjs` resolves the canonical Core artifact intent for each required
action; revise, inspect and download permissions are not interchangeable. Each
source/publication authorization refreshes Core, including the final check after
awaited bytes. Request lifetimes close on every outcome. This factory starts no
listener and creates no credential store, ledger or provider process.

The selected browser input names only the immutable version, private draft and
explicit operation proof. Core supplies draft metadata and bytes. Recovery
returns metadata without private bytes or a token. Missing CODE discovery
actions refuse before editor acquisition. Release clears the editor and lock
through Core while preserving Save; discard still respects Core's unresolved
Publish barrier. A lost acquire acknowledgement can recover the same editor
identity and epoch without an automatic takeover or compensating release.

WOPI token domain v2 binds the complete native run/attempt/worker/fence, selected
client, scope hash and native session principal/revision hash in addition to
the draft, source version and editor epoch. Old token domains refuse. The
existing native-session owner lends an existing receipt on each WOPI request;
the canonical current checks must still match every signed pin. A new session
cannot revive a token issued to a revoked session. Explicit renewal can issue a
token for the replacement session while retaining the admitted editor epoch.
Expiry is capped by both the native session and Core editor lease. Generation
is the last awaited read before token/result release. No launch/token is logged.

196 affected source checks pass, including 13 new attended cases and the prior
native publication, WOPI, transport and retention tests. Scripted options/Core
HTTP/SQL ports are explicit; these tests use the actual native-session, artifact,
publication and transport owners. The Core ordinary-role evidence is unchanged.
No application/image build, deployment or live CODE call ran. The old budget-era
suite incompatibility recorded above remains; no failing assertions were removed.

Public HTTP registration and configuration activation, the versioned Office
browser receiver and Save/Publish interface, CODE PostMessage renewal, retention
inventory/purge and representative native fidelity remain open. In particular,
returning a renewal form is not evidence that a running CODE frame accepted a
new token. Its documented `Reset_Access_Token` message must carry both token and
TTL; the browser must check exact editor origin and frame source. See the
[upstream PostMessage handler](https://github.com/CollaboraOnline/online.mirror/blob/main/browser/src/map/handler/Map.WOPI.js).

## Versioned browser/control source checkpoint

The additive `office-application` browser receiver now covers closed requests,
draft/editor metadata, launch/renewal POST forms, explicit Publish and current
Office inspection/download. It reuses the all-format document-access receiver
and keeps the native XLSX cache label truthful. Its generated ESM runs in a
browser realm without Node globals or external imports. The strict declaration
check uses the existing public document-access type export. Frozen schemas,
catalog, existing receivers, shared package exports/registry and frontend pins
are unchanged. The parent integration owns registering and pinning this export.

The thin Fetch adapter at `apps/control/office-application.mjs` receives bounded
POST JSON with an existing action-session receipt, returns no-store/no-referrer
metadata, retires refused/cancelled streams and retains uncertainty after a
write workflow starts. Save has no control route. Publish returns only the
published version and a fresh current-byte inspection; its internal execution
receipt remains private. Runtime composition requires a configured HTTPS browser
origin, which CheckFileInfo supplies as PostMessageOrigin for CODE frame messages.

Producer/receiver cases exercise all three formats, explicit private Save versus
Publish, current inspection/download, selector and epoch mismatch, token/private
byte leakage, false formula-cache/fidelity claims, body bounds and cancellation.
No application/image build or live CODE call ran. Public listener/configuration
registration, the frontend frame interface and consumer pin, actual CODE token
refresh/Save acknowledgement, retention inventory/purge and native fidelity are
still pending.
