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
`/api/meri/office/wopi/files/:fileId` path is the allocated host route; its HTTP
adapter is still pending. This module performs no fetch or editor process launch.

Core `apps/api/src/meri/office-drafts` now owns durable private draft bytes and
exclusive locks, with the reserved `20281029020000_office_draft_owner` migration.
The unused in-memory lock table and its one pure fixture have been removed.
Eight ordinary-role PostgreSQL tests in Core replace that fixture and cover
lock/sequence atomicity, connection recovery, owner isolation, revocation,
publication barriers, discard and expiry. Save remains private; the Core row
records publication state but cannot create or certify an immutable version.

The runtime must still connect the Core receiver through existing trusted
credentials, current artifact authority and retention on every call. Actual
native-byte publication must extend the existing artifact revision contract and
intent journal; do not create a second publication ledger or treat a draft save
as an artifact version. Suppression/access-loss cleanup and the canonical
retention inventory must be composed before activating the `editorDrafts` class.

Nine runtime source tests cover launch parsing and form/token boundaries plus
existing Save/publish decisions. They do not establish WOPI conformance, actual
CODE execution, multiple-frame exclusion, image security or Office fidelity. No
image/application build, deployment or provider call was performed.

Primary references: [CODE edition](https://www.collaboraonline.com/code/),
[Collabora integration](https://sdk.collaboraonline.com/docs/How_to_integrate.html),
[WOPI discovery placeholders](https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/online/discovery),
[upstream license](https://github.com/CollaboraOnline/online/blob/main/COPYING).
