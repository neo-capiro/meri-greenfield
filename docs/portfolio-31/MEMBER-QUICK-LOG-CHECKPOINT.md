# Member Quick log — CORE-093 / CORE-094

## Pinned outline and ownership

- Frontend: `codex/portfolio-member-notes-20261011`, starting `7dbf8e1ee7e2ded8c6f7b0e3d3b9bc557cdca1a3`, isolated `C:/dev/meri-member-notes-261011`.
- Policy `b32b4803933760dc0a93fffdcd8fba30a89c3aac`; freshly fetched origin `b2b0ce8c2bf03817b81e671d968b7892985b8d06`, local policy ahead. Machine map revision unchanged, discovery date 2026-10-11.
- Canonical backend origin main `fd8765ec01d292013758606204f2c9d886cd31c1`.
- Own only seven new `relationships/member-notes` modules, focused unit/browser spec and this checkpoint. Root owns shell/global dialog composition, Congress drawer and shared browser harness.

Search uses existing `useTargetDirectory` within Relationships. The form uses the existing HTTP client, Query cache, identity/current-client-writer authority and textarea primitive. Rendering, API boundary, state coordination and public exports remain separate. No second Directory application or note transport.

## Current design and supported behavior

Mandatory Figma skill applied; current high-fidelity context and screenshot inspected for 411:43580, with discovery evidence for 411:43192/43383/43580 and surrounding 411:42818/42992/42657. Match member card, 28px dynamic initials, compact labels, 18px spacing, note pills and 110px textarea using existing tokens. Unsupported controls are explained, not made to appear persisted. Root dialog owns Client/Member mode and outer 640px geometry.

Only Note persists. Directory notes are tenant-shared, not personal/private: current list filters tenant + contact, not author. The server sets created time. POST accepts body (trimmed, 1–4000) and directoryContactName (1–240); opaque Directory IDs are not ClientPerson UUIDs. Member detail must match selected ID before POST. Receipt requires matching contact, name, body and author. No invented tenant receipt field, idempotency, automatic POST retry or Undo.

Public `MemberQuickLog({open,onSaved?})` is a section inside the owner's Dialog. `MemberNoteForm({member:{id,name},onSaved?})` also supports an internal optional `onChangeMember`; root may reuse the form for Congress targets only. Mount only while the relevant dialog/drawer is open. `onSaved` is called only for a verified receipt under the initiating current actor/lifetime. `memberNotesKey(tenantId,userId,memberId)` is the deliberate cache namespace for future note readers.

## Dependencies and limits

- CORE-101: staff selections and client association require an approved structured Directory note association contract; no body prefixes or uncorrelated client activity claimed as association.
- CORE-095/100: objective linking and Meri decision rules remain undefined.
- CORE-096: task writes exist separately; counterparty/direction/strategy lineage and ambiguous multi-write recovery are not defined for this form.
- CORE-102: Meeting requires startsAt and endsAt; single event timestamp is insufficient.
- Current server does not validate Directory contact existence on note POST; frontend matching-detail preflight is not server authorization and remains vulnerable to a read/write race.
- Receipt does not include tenant ID; same-origin authenticated tenant scope and live actor guards provide the available frontend boundary, not proof of server tenant receipt binding.
- No idempotency/recovery contract: unknown POST outcome freezes this mounted form; closing/reopening is not a proof that retry is safe. Inspect Directory notes first. Role/identity invalidation after dispatch is an uncertain outcome even if it throws a local 403.

## Verification

Source pass: 25/25 meaningful unit cases PASS; full app source/tests TypeScript PASS; focused lint and formatting PASS; architecture 373 modules PASS. Initial lint rejected render-time ref access; preserved initial log, replaced with state-bound session scope and keyed draft lifetime, reran without weakening rules. Borrowed read-only dependencies produce only the existing React package detection warning. Actual composed browser and desktop/mobile-dark review pending root composition.

No live API/provider writes, build, installation, deployment or shared changes authorized. Task-local configs/logs under `work/` are qualification-only and untracked.
