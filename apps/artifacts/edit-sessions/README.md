# Collabora CODE editing

The 29 October user decision selects free self-hosted Collabora CODE for
development/testing. A paid quote is not a prerequisite. Live editor activation
remains held until the actual host, draft/retention bridge, immutable publisher,
frontend and Office fidelity checks are complete.

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
`/api/meri/office/wopi/files/:fileId` path is the allocated host route. Its Fetch
adapter is described below; deployment registration remains pending. The launch
module performs no fetch or editor process launch.

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
relationship and XML part, and refuses macros, embedded/active objects and
non-hyperlink external relationships. Passive HTTP(S) hyperlinks are retained.
It neither executes Office nor rewrites the package. This structural pass is
not native rendering, fidelity, recalculation or a complete active-content
qualification.

Nine runtime source tests cover launch parsing and form/token boundaries plus
existing Save/publish decisions. They do not establish WOPI conformance, actual
CODE execution, multiple-frame exclusion, image security or Office fidelity. No
image/application build, deployment or provider call was performed.

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
and empty, no-store refusals. The adapter starts no listener and is not yet
registered in the deployment. Rename/delete are unsupported; relative-file
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

Protocol references: [CheckFileInfo properties](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/rest/files/checkfileinfo/checkfileinfo-response),
[GetFile](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/rest/files/getfile),
[PutFile](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/rest/files/putfile),
[atomic relock](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/rest/files/unlockandrelock).

Primary references: [CODE edition](https://www.collaboraonline.com/code/),
[Collabora integration](https://sdk.collaboraonline.com/docs/How_to_integrate.html),
[WOPI discovery placeholders](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/online/discovery),
[upstream license](https://github.com/CollaboraOnline/online/blob/main/COPYING).
