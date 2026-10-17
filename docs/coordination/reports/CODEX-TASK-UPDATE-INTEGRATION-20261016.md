# Task-update runtime and desktop integration

Parent allocation after PR100 reserves `apps/runtime/product-applications.mjs` and the additive task-command public contract export.
The shipment owner retains its source pin. This post-shipment branch starts at local `de17699` (exact PR100 tree; remote `78fbd3ae`).
No lockfile, unrelated runtime options, authority, migrations or deployment changes are allocated.

## Contract and implementation outline

- New public schema `urn:meri:task-command-application:0.1.0` references canonical task-update raw input, proposal, receipt and result
  schemas. Exact API routes remain POST `/api/task-commands/prepare` (`{arguments}`) and `/api/task-commands/execute` (`{proposal}`).
  Prepare returns an immutable approval-required proposal; execution returns observed receipt/result or explicit indeterminate null.
  Add generated browser request/response receivers, types, schema and provenance metadata through a new deliberate public export.
  Existing package outputs and wire formats are byte-preserved.
- Test receiving shape, closed errors/statuses/limits, canonical command hash, original proposal/task/patch correlation, expected
  tenant/actor/conversation/run, incompatible receipt/result, hostile JSON and unchanged existing receiving exports.
- Runtime captures one optional borrowed task-command application. It routes only the exact paths, requires source enabled and the
  captured owner, and otherwise returns a closed 503 without owner calls. Existing host origin/session/command approval owners remain.
- Frontend receives a versioned immutable generated public module artifact with provenance, exposed through the existing workspace
  Meri-client adapter. It adds no installed dependency and preserves the current contracts0.1.8 tarball/lock. No DTO or validator is
  copied by hand. New desktop task-update route prepares, displays the exact immutable proposal, and checks existing separate
  approval before execution. Uncertain operations retain their identity and cannot be casually retried.
- Verify the actual mounted Fetch application/native transport and UI interactions, scope invalidation, disabled defaults,
  approval refusal, execution receipt, uncertainty and stale responses. Independent source review precedes draft publication.

Owned backend paths: the reserved runtime file and new mount test; the new native-session adapter and feature wiring; new
`packages/contracts/task-command-application/**`, generator, generated `dist/task-command-application*`, additive package exports/scripts
and focused tests; this report. All work uses sparse task-owned checkouts and borrowed dependencies.

## Verification and integration results

The runtime mount and native-session integration are implemented. Native composition reuses the canonical action-session currentness
correlator and checks fresh identity/session revision, binding, selected client and scopes before and after capability issuance,
metadata preparation/read and command execution. Native options remain guarded when the feature returns them to the API. The trusted
selected client is a host input, never browser authority. Three independent review findings about revocation during issuance,
after storage and after a native effect were fixed and retained as regression tests. Known storage/effect outcomes remain explicit.

Node 24.19 focused metadata, intent/API, native opaque-session and mounted-runtime checks passed **48/48**. The runtime test substitutes
only unrelated configuration/artifact import owners to avoid unavailable AWS modules; it invokes the actual mounted API, canonical
command pipeline and fixed Core HTTP adapter over synthetic authority/SQL/Fetch boundaries. Independent native/runtime review accepted
the source after **17** focused tests and additional cancellation/expiry checks. No real PostgreSQL, Core, Temporal or AWS is involved.

Public receiving tests passed **36/36**, including actual API-produced proposals/results and hostile JSON, SHA, task, patch, tenant,
stable binding, receipt, status and timestamp mismatches. All eight public TypeScript smoke files pass strict checking together.
The generated module imports in a browser-like VM without Node globals or external imports. Existing tracked distributions remain
byte-identical to PR100. Broader unchanged public tests retained nine environment/baseline failures: sparse fixture absence, Windows
URL-path handling, existing history/input metadata SHA drift, and unavailable esbuild. They are not hidden as new passing evidence.

Generation uses already-installed tools without installation or lockfile changes. A proposed isolated npm tooling install was denied
by automatic approval review as an uncoordinated duplicate; it never executed. The existing Rolldown, TypeScript and schema type tools
successfully generated all artifacts offline. Metadata records that backend; ordinary `--check` selects it and requires explicit
borrowed module roots as documented in the contract README. Conflicting backend flags fail before building.

The companion frontend branch exposes the exact generated public artifact through its existing Meri client workspace adapter,
preserving the installed contracts 0.1.8 tarball. Its immutable manifest will pin the published producing source commit and all file
hashes. Desktop route `/meri/task-updates` calls the actual task-command API through the same-origin server proxy and opaque session;
synthetic wires are confined to tests. UI qualification and independent frontend review are recorded in the companion report.

Release owners must supply the trusted feature composition, native session/capability/approval owners, journals, budgets and source
credentials, then qualify them together in an approved environment. Absent composition or source-disabled runtime returns 503 without
dispatch. Frontend opt-in stays off; read-only preview continues to hold writes. This source does not change shipment candidates,
runtime/image recipes, shared gateways, lockfiles, SQL, credentials, service settings or AWS. No live or deployment acceptance.
