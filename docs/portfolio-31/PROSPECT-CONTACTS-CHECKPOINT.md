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

## Status

Implementation and focused validation in progress. This document is not live acceptance.
