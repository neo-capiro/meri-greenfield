# Prospect Contacts — PROS-017

## Outline and boundaries

Frontend owner: `features/prospects/contacts`, public `ProspectContacts({prospectId})`.
Composition owner: root, `ProspectDetail`. Shared HTTP, Query, identity, Dialog, TextareaField,
QueryState and portfolio `initials` are reused. Relationships' client-specific hierarchy/mail
form is not reusable for BD IDs. No client endpoint is called with a prospect ID.

Backend candidate owner: separate `C:\dev\cap-pros-contacts-261011`, base
`fd8765ec01d292013758606204f2c9d886cd31c1`. New controller/DTO/service/store/module only.
SQL is proposed outside the migration ledger, **UNALLOCATED / UNAPPLIED**. Root reviews
registration of `ProspectContactsModule` in `BusinessDevelopmentModule`; no routes are live.

Persistence: tenant/prospect composite FK, request-id create replay with payload hash,
explicit version-checked edits and soft removal. Lifecycle locks the prospect row; dismissed,
linked or converted prospects are read-only. Standard-user role floor and existing BD flag
guard apply to every route. Conversion carry-over is not implemented by this slice.

Checks required: real ephemeral PostgreSQL persistence, isolation/roles/validation, create
replay, conflict retention/removal; frontend receipts and pagination; integrated browser
fixture + visual review; parent final-build and live acceptance remain separate.

## Sources

Policy `b32b4803933760dc0a93fffdcd8fba30a89c3aac`, fetched current remote without discarding
local ahead commits. Machine map dated `2026-09-30T00:21:48.2698715Z`.
Mandatory design-to-code skill loaded; Figma high-fidelity + screenshots inspected:
Contacts card `411:65025`, contact drawer `411:51458` (core details, fixed footer).
The BD card has no mail/history/hierarchy contract: those client-specific controls are
not exposed as working prospect operations.

## Delivered bounded slice

Audit PROS-017: frontend candidate implemented and composed by root in ProspectDetail;
coherent new backend contract implemented/tested but not registered or deployed. This
does **not** mark live integration complete. Prior historical audit evidence remains unchanged.

Frontend source commit `d70db8f`; root composition `983ae6a` cherry-picked locally as
`a75b1c9`. Follow-up adds final browser cases, email trim-before-validation parity,
field error association/focus and visual row spacing. Backend candidate commit
`6c6f88e9e5ba077452716f3a0db0dd3bbea2963f`.

## Verified behavior

- Real adapters use BD-scoped core routes. Response schemas bind prospect identity,
  contact identity, create requestId and incremented version; removal requires true
  removed status. Every page is fetched; repeated cursor fails explicitly.
- Add/edit drawer uses current name/title/email/phone/notes, field limits, explicit
  validation, stable create identity across retries and server-authoritative errors.
- A409 retains the draft and blocks a stale resave. Latest values are shown for review;
  replacing the draft is an explicit action. Removal requires confirmation and a valid
  receipt. Modal dismissal is blocked during a pending operation; focus returns to
  the selected contact or card when the contact was removed.
- Identity role floor and server readOnly state independently disable mutation.404
  is explicit unavailable state;403 preserves the draft;401 uses shared session recovery.
- Card matches inspected Figma layout, including14px gaps between rows. Drawer uses
  shared Radix modal/focus primitives, scrollable fields and fixed footer; mobile
  collapses email/phone and uses existing dark tokens. No static images exist in
  this card/form subset; initials and fields remain dynamic.

## Checks and evidence

- PASS:6 meaningful domain/API tests,6 browser cases against actual ProspectDetail
  composition and synthetic intercepts; TypeScript, focused ESLint, Prettier and
  architecture guard (181 modules). Browser cases cover lost create reply (one creation,
  two explicit attempts using the same requestId), draft/error retention, conflict
  review, wrong-prospect save receipt, false removal receipt, scope/role/lifecycle,
  expiry, field focus and phone viewport.
- PASS:11 backend tests execute production tagged SQL on ephemeral PGlite PostgreSQL;
  actual persistence, owner-connection tenant isolation, request replay, CAS, soft
  removal, lifecycle/read-only state, pagination, RLS, parameter binding, actual Nest
  DTO validation and canonical RolesGuard. Focused backend TypeScript PASS.
- Actual visual inspection: writable two-contact desktop card, create drawer,
 390px dark read-only drawer. Reference context is411:65025 and411:51458.
- Initial backend test setup failed: full-program ts-jest exhausted4GB heap; focused
  transpile-only runtime preserved all assertions. PGlite requires experimental VM
  modules. Focused typecheck identified and fixed nullable cursor/INSERT handling
  and test adapter types. Prettier has no installed SQL parser; LF is asserted and
  proposal SQL executes in ephemeral PostgreSQL. No fixture/baseline was weakened.
- NOT RUN: final Next production build/browser (root owns shared full gate, disk reserve),
  real designated-service mutations, shared migrations/deployment, provider operations.
  No shared database writes, sends, charges, installs or shared writable caches.

Evidence copied to parent task `outputs/evidence/prospect-contacts-20261011/`:
browser results, backend results, check summary, desktop card/create drawer and dark
phone drawer screenshots, this checkpoint and backend contract. Interim harnesses
remain untracked in this worker; no second committed application or server was added.

## Remaining concrete dependencies

1. Root/backend owner: review and register ProspectContactsModule; centrally allocate
   and apply the proposed additive table, run registered/full AppModule HTTP and
   native PostgreSQL contention checks; coordinate deployment. Current frontend
   remains visibly unavailable on an older backend. Affects PROS-017.
2. Root/test account owner: designated service read/write checks after approved
   deployment, including actual tenant permissions and lifecycle. Affects PROS-017.
3. Root + ClientPeople/conversion owner: same-transaction carry-over helper and durable
   source mapping, explicit policy for existing-client email collisions and historical
   conversions. Detailed exact proposed hook is in backend CONTRACT.md. Source
   contacts remain on their original prospect; no carry-over is claimed. Affects
   conversion coverage beyond this bounded PROS-017 pass.
