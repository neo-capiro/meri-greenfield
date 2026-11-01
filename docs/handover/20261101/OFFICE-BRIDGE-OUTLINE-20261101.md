# Same-document manual + Meri Office editing bridge — implementation outline (1 November 2026)

Branch `fable/office-bridge-20261101` from `main` 7888a2c5. Frontend twin: `fable/office-bridge-fe-20261101`.

## Admission path (the one owner path a model proposal takes to a new immutable version)

1. **Read** (`propose_office_edit` with `action:'read'`): the run's selected document (`documentRevision` on the submit request) is read through the existing office access owner (`createRuntimeOfficeAccess`, intent `download`, current Core artifact authority, retention, exact bytes). `apps/artifacts/office-units/*` parses the retained OOXML with the existing strict ZIP/OPC/XML readers and returns an addressable outline: `docx` paragraphs (`p:<n>`), `xlsx` cells (`<sheet>!<A1>`), `pptx` slide text shapes (`slide:<n>/shape:<id>`). A management-style read: no journal row, no proposal.
2. **Propose** (`action:'propose'`): the control preparer (`apps/control/intents/office-edit-preparer.mjs`) re-reads the exact selected version, applies the bounded operations to the retained bytes in memory (only the touched units change; every other package part and every byte outside the touched XML element spans is copied unchanged), requires each operation's `before` to equal the current unit text, inspects the result with `inspectOfficeEdit`, and settles a PREPARED proposal `{kind:'office_edit', proposalId, commandSha256, document:{artifactId,versionId,objectSha256,format,title,filename}, summary, operations, result:{sha256,bytes}}` into the existing intent journal (`meri_intents.preparations`). Nothing is written.
3. **Apply** (`POST /api/conversations/intents/decide`, `decision:'approved'`): `approval.mjs` dispatches `office_edit` proposals to the office owner (`apps/artifacts/edit-sessions/apply-proposal.mjs`): current authority again, exact parent bytes again, `history` head check (`OFFICE_EDIT_STALE_HEAD` before any write), deterministic re-application (`OFFICE_EDIT_PROPOSAL_MISMATCH` if the bytes differ), then `createPostgresArtifactService(...).executeOfficeEdit` with a `meri.office-proposal/1` source (`officeProposalSource`): the same verified-bytes publish, commit CAS on the exact parent head (`ARTIFACT_STALE_PARENT`) and artifact intent journal replay (delivery `office-proposal:<proposalId>`, so a repeated Apply returns the same version and never writes twice). `decision:'rejected'` records nothing durable and answers `rejected`; the proposal simply expires with the session.
4. **Reopen**: the FE receives `{status:'office_edit_decided', result:{proposalStatus:'applied', version}}`, reloads library history and opens the returned version.

Refusal codes the UI explains: `OFFICE_EDIT_STALE_HEAD` (document changed since Meri read it), `OFFICE_EDIT_DRAFT_ACTIVE` (a private draft/editor lease is open on this version; enforced by the FE which owns the draft identity, Core has no draft-by-artifact lookup), `OFFICE_EDIT_PROPOSAL_MISMATCH`, `INTENT_EXPIRED`, `OFFICE_EDIT_UNIT_UNKNOWN` / `OFFICE_EDIT_UNIT_CHANGED` / `OFFICE_EDIT_UNIT_UNSUPPORTED` at propose time.

`EDITOR_TYPED_REVISION_UNAVAILABLE` stays only for ordinary typed replacement of an office-original/office-edit/office-proposal parent (a regenerated typed body cannot preserve manual OOXML); its message now names `propose_office_edit`.

## Gates removed (lower layer proven)

- `publish-draft.mjs` re-inspected draft bytes and re-checked sha/length and pptx workbook count: the Core draft wire receiver already refuses a byte/sha/length mismatch (`core-draft-wire.mjs savedBytes`), WOPI save is the only writer of draft bytes and refuses a workbook drop before `save` (`wopi-files.mjs`), and `service.generate` inspects the bytes again before any object write.
- `attended.mjs admit()` inspected base and draft bytes on every open/launch/renew for the same workbook rule: same lower layers.

## Tests

`apps/artifacts/office-units/test/*.test.mjs` (outline per format; apply preserves every untouched part byte-for-byte and the untouched spans of the touched part; refusals), `apps/control/intents/test/office-edit.test.mjs` (preparer read/propose, approval decide applied/replay/stale head, item listing), `apps/runtime/artifacts/test/office-proposal.test.mjs` (runtime composition: outline + apply through the real office access owner and artifact service, stale head after a manual publish, replay), contracts tests for the new catalog row and public intents item.
