# B1: conversation intents list/decide contract (proposal for freeze review)

Base: meri-greenfield PR190 `29379ab1f7be9a7bb98613b4b7e27e17dad9ccf5`. Branch `fable/intents-contract-b1-20261019`. Assignment: dot, PR #121 comment 6260766389.

This branch adds one additive browser contract, `@capiro/meri-contracts/intents-application` (`urn:meri:intents-application:0.1.0`), for the two routes `POST /api/conversations/intents/list` and `/decide`, plus focused receiver tests. It changes no handler, no existing contract or distribution byte, no shipping candidate, no Core or frontend file. It grants no approval or execution authority and is not deployment, membership or runtime-mount evidence.

## Files

| File | Change |
| --- | --- |
| `apps/control/intents/application-protocol.mjs` | new: re-exports the real route paths, intent + product error tables, journal failure codes, `APPROVABLE_ACTIONS`; adds only the contract's own request ceiling |
| `packages/contracts/intents-application/{README.md,schema.mjs,protocol.mjs,boundary.mjs,semantics.mjs,receive.mjs}` | new contract sources |
| `packages/contracts/generate-intents.mjs` | new generator (canonical esbuild + json-schema-to-typescript; `--check` for drift) |
| `packages/contracts/dist/intents-application.{mjs,d.ts,schema.json,metadata.json}` | new generated outputs |
| `packages/contracts/test/intents-application-public{.test.mjs,-types.ts}` | new tests |
| `packages/contracts/package.json` | additive: two `exports`, `build`/`check:generated` chain entries, `build:intents`/`check:intents`, test and typecheck entries |

Output SHA-256 (at branch head `5ee2fd6e979dff1c2b111bd964c91aadab8357a5`, the accepted source freeze): `.mjs` `21dce7c2b3d73b8d5d27ad66fefce04aa64db58ebcb75530c95f7fd00d420db3`, `.d.ts` `cc6900efdecf4cdb475e771ca422de60b28e21396e551efe8e701a2bfb335f31`, `.schema.json` `c33a0fe0fe29419f14cb3c2fc766437e4859ec2551cb3c4074b8fab5b624576a`, `.metadata.json` `9bacfe225ddba05efd02c0b5f2f534a5a8dd1ad1e5594477458dee2979864dc8`. Hashes recorded at earlier commits in this PR are superseded.

## Derived from the handlers, not copied

| Contract element | Source |
| --- | --- |
| routes | `INTENT_PATHS` (`intents/http.mjs`) |
| error code → status table | `PRODUCT_ERROR_STATUSES` (`product-access/http.mjs`) ∪ `INTENT_APPROVAL_ERRORS` (`approval.mjs`), 35 codes; `field` absent on 502 as `createProductApplication.failure()` does |
| error outcomes | `NOT_DISPATCHED`, `UNKNOWN`, `RESULT_NOT_RELEASED`: the only outcomes `approval.mjs` and the effect route attach |
| approvable actions | `APPROVABLE_ACTIONS` = `['task.create']` (published in metadata) |
| failed-item codes | `INTENT_FAILURE_CODES` (`faults.mjs`) |
| id/hash/limit patterns | `decideRequest`/`listRequest` in `approval.mjs` (lowercase UUID, `sdk:` + 64 hex, limit 1..50, closed objects) |
| item/phase/decision/execution shapes | `item()` and `list()` in `approval.mjs`; `ApprovalProposal`, `ApprovalDecision`, `CommandReceipt` from `meri.schema.json`, `TaskCreateResult` from `commands-0.2/task-create.schema.json`, copied as local definitions |

The generator records the SHA-256 of every source it read; changing a handler table without regenerating fails `node generate-intents.mjs --check`.

## What the receiver refuses

Beyond the closed JSON schema, `receiveIntentsResponse(route, status, text, expectation)` requires the response to answer exactly the captured context: `{request}` for list, `{request, proposal}` for decide, where `proposal` is the one admitted from an earlier list answer. List: same conversation; no more items than `limit`; unique delivery ids; a cursor only on a full page and equal to its last entry; every proposal's `commandSha256` equal to the canonical hash of its command, its command bound to the requested conversation and tenant, `expiresAt` after `createdAt`, and a task.create command carrying canonical arguments and no attachments; decisions for that proposal; `phase` consistent with the decision and execution evidence; a completed execution that is the executor's own outcome (below). Decide: the request's conversation equals the retained proposal's command binding; the retained proposal is the request's proposal and hash and an approvable action; same delivery, proposal, hash and decision; the decision is by the proposal's required approver and not before the proposal; `rejected` only for a rejection; an `executed` outcome as below. Rejected and indeterminate replies contain no conversation, command or binding of their own, so only the retained proposal binds them; nothing is claimed that they do not carry.

**Executor outcome** (mirrors `commands-0.2/execution-intent.mjs` `outcome` and `task-create-validation.mjs`, interpreted only for `task.create`): receipt command id, command hash, idempotency key, scopes and stable tenant/actor/conversation/run binding equal the command's (attempt, worker and fence may differ); the receipt is `succeeded` with no source transaction and an exactly spelled `completedAt`; the task result's title, client and due date equal the immutable arguments. Hash checking uses WebCrypto inside the bundle.

**Timestamps** follow their producers: proposal and decision times are any schema-valid date-time ending in `Z` that `Date.parse` accepts (`…:00Z` is admitted, as `approval.mjs` admits it; impossible dates and offsets are refused); receipt and task-result times use the canonical exact spelling.

## Preserved behavior (each exercised against the real owner)

- **task.create-only execution.** Real `memory.propose` and `artifact.file` proposals (from their actual preparers) list as prepared with `decision:'unavailable'`, and `decide` answers `409 INTENT_NOT_APPROVABLE` / `NOT_DISPATCHED`. No execution shape exists beyond `{receipt, TaskCreateResult}`.
- **Withheld data.** `withheld:true` items carry no proposal content, and an item with both is refused.
- **Expiry.** `INTENT_EXPIRED` 409; the caller still compares `proposal.expiresAt` with a fresh clock.
- **Unknown outcomes.** `APPROVAL_DECISION_UNKNOWN` and `COMMAND_OUTCOME_UNKNOWN` (502, `UNKNOWN`) are admitted; `indeterminate` is admitted without an outcome and never as execution.
- **Identical-request reconciliation.** After a lost decision acknowledgement, and after a lost executor outcome, the identical decide request returns `executed` with the durable outcome and no second effect.

## Review corrections (dot, PR #191 independent review of `110917c0`)

| Finding | Change | Tests |
| --- | --- | --- |
| 1. decide ignored the request conversation | decide needs the retained proposal; request conversation must equal its command binding; executed receipt binding checked; replies without conversation are bound by the retained proposal only | `decide answers are bound to the request conversation and the retained proposal`; `rejected and indeterminate replies are bound by the retained proposal…` |
| 2. exact `toISOString` spelling too strict | proposal/decision times parsed as the producers parse them; receipts and task results keep the canonical exact spelling | `owner-valid timestamps without milliseconds are admitted; impossible or offset dates are refused` |
| 3. completed outcome only checked hash and command id | executor outcome rules (binding, idempotency, scopes, succeeded receipt, result equals arguments), task.create only, task.create argument checks | 15 outcome mutations × (list, decide), attempt/worker/fence variation, `a task result is never interpreted for a memory.propose / artifact.file proposal`, `a task.create proposal must carry canonical, normalized arguments…` |
| 4. bundle embedded checkout paths | `preserveSymlinks` build, generator refuses layout paths, clean-layout reproduction | `generated bundle is independent of the checkout layout` |
| 5. (re-review of `c81d834a`) journal `createdAt` rolled impossible days | exact `toISOString` spelling again for journal `createdAt` only; lenient reads stay for schema-validated proposal/decision times | `journal createdAt is read exactly: an impossible calendar day cannot roll into the next month` |

## Evidence

All on Windows (Git Bash), Node v24.19.0, synthetic decision owner, journal and fixtures; no PostgreSQL, Core, runtime mount or deployment.

- `node --test test/intents-application-public.test.mjs`: **82 tests, 82 pass**.
- **Clean-layout reproducibility:** a fresh worktree of the correction commit at a different path, with a real copied `packages/contracts/node_modules` directory (no junction, no root install), regenerates all four outputs byte-identically (`node generate-intents.mjs --check` passes there).
- `npm run typecheck` (all public type files including the new one, strict): pass. `node generate-intents.mjs --check`: pass.
- The other public suites (eleven files, 273 tests, including the document receiver tests) fail the same six tests on a pristine PR190 checkout and with this branch; with this branch the same run is 316 tests, 310 pass. Five of the six are Windows path handling (`C:\C:\…` ENOENT in their child-process and URL helpers). The sixth, `public-package` "generated distribution check", reports `Generated drift: browser.mjs` from the existing `generate.mjs --check`, which fails identically on the pristine base on this host. No test that passed at the base fails.
- Toolchain used for generation: esbuild 0.28.2, json-schema-to-typescript 16.0.0, ajv 8.20.0, ajv-formats 3.0.1, canonicalize 5.1.0, typescript 5.9.3 (exactly the package.json pins). `--check` passes on this host; reproduction on another host is not verified (the existing base `generate.mjs --check` does not pass here, cause not investigated).
- **Not run:** the full `check:generated` chain (the task-command and user-preferences checks need borrowed Rolldown/TypeScript roots this host lacks) and any broad `apps/control` suite.

## For freeze review (decisions, not defects)

1. **Distribution path.** The export is additive, but a new package export normally means a package version. Raising `0.1.10` also moves `previewMeriContractsPackageVersion` in the frontend allowlist and the runtime's `CAPIRO_PREVIEW_MERI_CONTRACT_PACKAGE_VERSION` binding. Vendoring this contract under `packages/meri-client/vendor/intents-application/0.1.0/` (as the task-command and user-preferences contracts already are) avoids touching that binding. Recommendation only; not done here.
2. `execution.outcome` is typed for `task.create`. Widening it for memory or filing needs a new contract version after Core defines those payloads; none is invented here.
3. API consequence of the review: a decide answer is admitted only with the proposal the caller admitted from an earlier list answer (`{request, proposal}`); a caller cannot decide without listing, because `deliveryId` comes only from list.
4. The request ceiling (4096 bytes) is this contract's own choice. Response and deadline ceilings are the product-access maxima; a composition may be lower.
5. Real-preparer coverage: `task.create`, `memory.propose` and `artifact.file` proposals. `draft` and `schedule_proposal` items are exercised from journal rows shaped like the handler's retained results, not from the document, analysis or schedule preparers.
6. Independent-approver review is not representable: the handler refuses any approver other than the conversation owner (`APPROVER_REFUSED`).
7. Two tests load fixtures that need `MERI_REVIEW_SOURCE_ROOT`; the test defaults it to the repository root when unset.

## A9 (document receiver, existing tests only)

The existing public document receiver tests were run at this base (34 of 35 pass; the one failure is the Windows path issue above). They assert that create requests for `pdf`, `pptx` and `sandbox` and a receipt whose `mimeType` is `application/pdf` are refused. To answer the inspect side directly, an inspect receipt for a `pptx`, `zip` and `pdf` version, built exactly as that test builds its fixtures, was fed to `receiveDocumentResponse('inspect', …)`: a `txt` control was accepted and `pptx`, `zip` and `pdf` were each refused with `INVALID_RESPONSE`. The 0.1.10 `document-application` schema declares inspection variants for `txt`, `docx` and `xlsx` only (`pptx`, `pdf` and `zip` appear in Meri's artifact vocabulary but not in this wire contract). Because the frontend's `ArtifactAccess.download()` inspects before it issues a link, PPTX/ZIP versions cannot currently be previewed or downloaded through that path. No artifact contract was modified; the repro script lives outside the repository.
