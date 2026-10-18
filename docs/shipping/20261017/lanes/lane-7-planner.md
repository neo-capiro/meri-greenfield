# Lane 7: Objective → Strategy → Planner, server-owned execution

| Field | Value |
|---|---|
| Owner | lane-7 session (Fable), coordinating with dot on PR #121 |
| Branch | `fable/meri-lane7-planner-20261017` |
| Base | `0bab8e34` (tip of `fable/meri-first-chat-receiving-20261017`, PR #133) |
| Head | see the draft PR; the final commit adds this record |
| Status | **source**: received and finished on the lane branch, with focused tests passing. Not integrated into PR #133, not qualified, not deployed, not live. Held until the first shipment is live. |

Status words follow BACKLOG.md: source, integrated, qualified, deployed, live-verified. A passing synthetic test only shows source.

## 1. Sources received and not received

| Source | Pin | Disposition |
|---|---|---|
| Meri PR123: frozen Objective reader v2 wire | `b2f0a5d7` | Received by merge `f921d1d8`. Byte-identical; schema test 5/5 |
| Meri PR127: default-off source custody and v2 reader factories | `d1512708` | Received; 124/124 focused tests pass. Not run: `production-composition.int-test.mjs` (see §6) |
| Meri PR129: Fable boundary supplement and PostgreSQL custody checkpoint | `047526c7` | Received as source. Adapter defects fixed and test file added in `52561fa2`. The SQL is still unexecuted |
| Core PR61 `eef7cd1b`, PR64 `806a0939`, PR66 `49f328eb` | capiro-backend | Read only (sparse clone, tree `371466cd` checked). Core is dot's repo; nothing was copied in. Decoders follow PR66 |
| Core PR54 `ee00f6d2` (Planner handoff packet) | capiro-backend | Read only. It is binding guidance: Planner continuation is Core's mounted worker (see §3) |
| `origin/dot/planner-runtime-binding-20261016` (`29c82451`): Meri Temporal Planner workflow, dispatcher, startup, admission, server | meri-greenfield | **Not received.** It adds a Meri Temporal Planner loop. The later Core PR54 handoff (10-16 19:38) says the Core Planner worker discovers durable producer rows, and that no Meri Temporal or Engagement Manager Planner loop should duplicate that owner. Its client and producer pieces (`continuation/{contract,core-http,core-client,core-producer}.mjs`) were already on the base. **Owner decision D7-1** |
| Meri PR95 (RS256 retained receiver) | `5781c115` | Not received. It is superseded by the distinct Ed25519 v2 decision in PR129. Historical RS256 is unchanged |

**Why PR129 is REVIEWED_HOLD.** Its own checkpoint said the following, and a review confirmed it:
- The PostgreSQL adapter (`postgres-custody.mjs`) and its synthetic pool fixture were saved before they were ever imported or tested.
- Its main test file did not exist.
- Two defects were known: no adapter-local sticky uncertainty after an ambiguous claim commit, and no final cancellation or deadline check after transaction cleanup (a late-abort release race).
- The SQL had never been run against PostgreSQL: syntax, triggers, roles, concurrency, uncertain COMMIT and backup/restore were all unproven.
- Retention class, suppression and purge for the stored private prompt are unallocated.
- Mounting and the shared splice are not accepted.

This lane closed the adapter-source items. The native-PostgreSQL and retention holds still apply.

## 2. Capability inventory

C = complete as source, P = partial, A = absent. File:line refers to this branch.

| # | Capability | State | Evidence (file:line) | Gap or dependency |
|---|---|---|---|---|
| 1 | Fixed Meri→Core generation transport (admit, publish, accept, reads, **complete, completion-read**) | C (source) | `apps/control/objective-generation/core-http.mjs:24-35,96-99` | Credential owner (Core workload issuer) absent: **dot** |
| 2 | Closed Core reply decoders (admission, admission-read with acceptance, publication, acceptance, completion) | C (source, new) | `core-replies.mjs` (`decodeCompletionReply` :146) | Shapes from Core PR66; Core must keep them frozen |
| 3 | Decoded Core client and the `coreCurrent.readCurrent` normalizer | C (source, new) | `core-client.mjs:69` | Production composition needs the credential owner and issued `executionSelection` |
| 4 | Protected Objective fact compiler and bindFacts decorator | C (source, PR127) | `apps/runtime/objective-source/protected-facts.mjs:55,99` | Not spliced into issuance (row 7) |
| 5 | Objective source custody owner (publish/read, active and historical) | C (source, PR127) | `objective-source/custody.mjs:31` | Needs a durable store (row 6) and native authority (row 9) |
| 6 | PostgreSQL custody adapter (claim and commit, reverse lookup by issuance) | C (source, finished here) | `objective-source/postgres-custody.mjs:46-90` (txn and release gate), `:110` (sticky uncertainty); SQL `migrations/0001_objective_custody.sql` | **SQL unexecuted**; native PG qualification, role/grants and retention class are unallocated |
| 7 | Shared splice: protected pair in prepared-run issuance and every reconstruction | **A** | Seams: `prepared-run-issuance.mjs:41` (closed keys), `:94` (prepare), `:110` (resolveFacts); `prepared-run-bindings.mjs:64` (facts.compile), `:84` (retireInitial); `prepared-run-registry.mjs:71`; `native-authority/task-router-authority.mjs:28`; `runner-poststart-authority.mjs:44` | Needs lane-1 acceptance of these first-chat files (proposal in `docs/objective-source-reader-v2-20261017/SHARED-SPLICE-PROPOSAL.md`) **and** a durable run→Objective-selection association before issuance (**migration needed, not allocated**, see §5) |
| 8 | Signed Core→Meri reader v2 gate (3 purposes) | C (source, PR127) | `objective-source/reader-gate.mjs:74`; wire `packages/contracts/objective-reader-2/*` | Unmounted. Needs Core Ed25519 public keys (§4) and a durable JTI replay store |
| 9 | Fresh native authority for source reads | C (source, PR127) | `objective-source/native-authority.mjs:26` | Native Core credential and currentness owner: **dot** |
| 10 | Prepared-facts reader (worker query preparation) | C (source) | `apps/runtime/objective-generation/prepared-facts-reader.mjs:16` | Needs `coreCurrent` (row 3) and task proof; not production-composed |
| 11 | Query-selection reader (proxy attestation) | P | `objective-generation/query-selection-reader.mjs:29` | No production proxy-attestation port |
| 12 | Worker SDK hook (typed Strategy output, fixed result file) | C (source) | `apps/worker/conversation/activity.mjs:39,60`; `objective-generation/runtime.mjs:8`; `typed-result.mjs` | **Not mounted:** `apps/runtime/conversation-runner.mjs:76` never passes `objectiveGeneration` (pinned lane-1 bytes) |
| 13 | Typed completion capture | P | `native-authority/completion-capture.mjs:28` | `remote-composition.mjs:49` omits `preparedFacts` (lane-1 transport composition) |
| 14 | Retained result reader and Core result owner (v1) | C (source) | `objective-generation/retained-result.mjs:9`, `core-result-owner.mjs:7`; v1 gate `apps/control/objective-generation/workload-reader-gate.mjs:22` | Unmounted. Superseded for new purposes by the v2 gate |
| 15 | **Server-owned Objective generation lifecycle (Temporal)** | P (source, new) | Driver `apps/control/objective-generation/lifecycle-driver.mjs:22`; workflow `apps/control/conversations/objective-generation-workflow.ts`, exported at `workflow.ts:13`; activities `apps/runtime/objective-generation/lifecycle-activities.mjs:28`; starter `apps/control/conversations/objective-generation-dispatch.mjs:13` | The accepted-run owner port (`runs.start/read`) is **not composed** (rows 7 and 12). Activities are not registered in `apps/runtime/temporal-worker.mjs:44`, so the workflow cannot run yet |
| 16 | Core terminal accounting for failed or cancelled runs | A | — | Uses Core subject `OBJECTIVE_TERMINAL_ACCOUNTANT_SUBJECT`, which is not allocated to Meri. The driver returns `run_failed` or `run_cancelled` |
| 17 | Strategy generation and save | Core-owned | Core `objective-canonical-completion.service.ts` | Meri provides only the typed result and its custody |
| 18 | Planner continuation (materialization and application) | Core-owned | Core PR50/51/53 worker; Meri clients `objective-planner/continuation/*.mjs`, `materializer.mjs:7` | No Meri loop by design (D7-1). The unused Meri `workflowId` at `objective-planner/identity.mjs:28` is historical |
| 19 | Frontend governed Objective flow | A (out of repo) | capiro-frontend PR58/62 use the legacy flow | Frontend owner not allocated: **dot** |

## 3. End-to-end design and owners

```
browser: human consent + Objective command ----------------------------> Core (dot)
Meri control: starter -> meriObjectiveGenerationWorkflow (Temporal, lane 7)
  1 source   : Core admit + publish        (decoded, retried; Core replays by job)
  2 run      : runs.start -> ONE accepted conversation run with Core's prompt
               -> preparation issues facts WITH the protected pair (row 7)
               -> custody.publish (row 5/6) -> Core accept (row 1/2)
               -> conversation workflow -> worker SDK query (row 12)
  3 running  : observe the run to a terminal state (durable waits)
  4 complete : Core generation-completions; Core reads the retained result via v2 (row 8)
Core: saves Strategy/version + producer row -> Core Planner worker -> Planner application
```

The browser only requests the work. Steps 1–4 run in a Temporal workflow and survive browser close and worker restarts. Workflow history holds only digests and states, never prompts. Planner continuation is Core's worker; nothing on the Meri side applies Planner work.

## 4. Core dependencies for dot

1. **Objective Ed25519 issuer (reader v2, Core→Meri).** Owner: **Core/dot.** `createObjectiveReaderV2Signer` (capiro-backend `apps/api/src/auth/workload-authority/objective-reader-v2-jwt.ts:153`) takes three per-purpose Ed25519 private keys (`active-source`, `historical-source`, `retained-result`) as in-process `KeyObject`s. The production credential owner (`ObjectiveReaderV2CredentialOwner.issue/revalidate`) is absent (PR64). **No keys exist.**
   - The 10-16 proposal names AWS KMS `ECC_NIST_EDWARDS25519` SIGN_VERIFY keys (`docs/coordination/tasks/CODEX-MERI-OBJECTIVE-WORKLOAD-ISSUER-20261016.md`). That conflicts with an in-process `KeyObject` signer: **owner decision D7-2** (KMS signer adapter vs. an in-process private key, and where it is held).
   - The Meri side needs only the public JWKs, pinned as `(iss, sub, aud, kid) → OKP/Ed25519` per purpose in the v2 reader-gate trust configuration, plus a durable JTI replay store. Meri creates no keys.
2. **Meri→Core generation workload authority.** Core RS256 issuer `objective-workload-jwt.ts:16` (subject generation-worker, audience `capiro:objective-strategy-api:v1`, phases admit through completion-read). Decision route `POST /api/internal/objective-workload-authority/decisions` is **hard-disabled** and admit-only. Later-phase native current authority is absent. Meri needs a credential owner for `core-http.mjs` `authorization.readCredential`; its design is open (D7-3).
3. **Strategy authority.** `apps/api-strategy/src/planner/objective-canonical-authority.ts:55-84`: every method throws `AUTHORITY_UNAVAILABLE`.
4. **Delegation fence.** `apps/api/prisma/migrations/20281016010000_client_objective_workload_delegations/migration.sql` enforces `CHECK(enabled=false)`. Changing it is a central migration and authority decision.
5. **Core result owner.** `planner.module.ts:40` constructs `ObjectiveCanonicalResultOwner()` without the retained HTTP bridge.
6. **Raw-body capture.** Core bootstrap does not capture `rawBody` for signed routes.
7. **Frozen reply shapes.** The admission, publication, acceptance (POST without `acceptedAtMs`) and completion replies decoded in `core-replies.mjs` must stay as in PR66.
8. **Terminal accounting subject** for failed or cancelled runs, if Meri is to report them.

## 5. Migration status (stopped, not allocated)

- No new migration ID was allocated or used.
- `apps/runtime/objective-source/migrations/0001_objective_custody.sql` (schema `meri_objective_source`, table `custody`) is the existing central reservation (`93838193`, ledger blob `03ad26a0`). It is a separate family from conversations 0001–0017. It was not executed.
- **Stop point:** the shared splice (row 7) needs the immutable Objective selection (Core admission, typed request, execution context, queued type) to be durably associated with the accepted run *before* issuance. Today nothing can hold it:
  - `initial_inputs` (0016) and `initial_run_bindings` (0017) are closed, digest-only shapes;
  - custody (0001) is written only after ISSUED.
- A new persistence (for example a conversations-family table, or an extension of the objective-source family) needs a **central migration allocation**, which this lane has not made. The held IDs 0012 and 0014 were not used.
- One alternative needs no migration: hold the selection in the generation workflow and read it by a deterministic workflow ID from `facts.decorateObjective`. That couples preparation to Temporal queries and changes the architecture, so it needs approval (D7-4).

## 6. Tests run on this branch

All tests ran one file at a time, on Node 24.19, with `MERI_REVIEW_SOURCE_ROOT` set to the worktree and node_modules junctioned to `C:\dev\fable\meri-source`.

| File | Result |
|---|---|
| packages/contracts/objective-reader-2/schema.test.mjs | 5/5 |
| objective-source: protected-facts 37, projection 4, custody 17, prepared-reader 6, native-authority 29, reader-gate 26, postgres-records 13 | 132/132 |
| objective-source/postgres-custody.test.mjs (**new**) | 16/16. 4 of them fail against the unfixed PR129 adapter |
| control/objective-generation: core-http 16 (2 new), core-replies 8 (new), core-client 6 (new), lifecycle-driver 8 (new), workload-reader-gate 10 | 48/48 |
| control/conversations: objective-generation-workflow 4 (new, upstream Activator), objective-generation-dispatch 4 (new, installed gRPC bridge), recovery-workflow 9 | 17/17 |
| runtime: objective-generation/lifecycle-activities 6 (new), prepared-facts-reader 6, query-selection-reader 21, test/objective-completion-capture 1, test/bundle 1 (upstream bundler, now asserts the new workflow) | 35/35 |
| worker: test/objective-activity 3, objective-generation/typed-result 2 | 5/5 |
| control/objective-planner: materializer 11, receipts 26, continuation contract 18, core-client 11, core-producer 10 | 76/76 |
| packages/contracts/strategy-operations-candidate/test/validation.test.mjs | 21/21 |
| `tsc --noEmit -p apps/control/conversations/tsconfig.json` | clean |

**Not run:**
- `apps/runtime/test/image-closure.test.mjs`: the Docker daemon is not running on this host.
- `objective-source/production-composition.int-test.mjs`: it needs a Core-emitted fixture (`CORE_OBJECTIVE_V2_MODULE_DIR`). Core's TypeScript and zod are not installed here, the local pnpm store has zero-byte `package.json` files, and installing would need network access beyond git.

No broad suite was run, because of host memory.

## 7. Remaining tasks (ordered)

1. **lane 1 / Neo:** decide D7-4 and allocate persistence for the run→Objective selection association; accept the shared splice into `prepared-run-*`, router, poststart and retireInitial (row 7).
2. **lane 1:** mount `objectiveGeneration` in `conversation-runner.mjs` and pass `preparedFacts` in `remote-composition.mjs:49` (rows 12–13).
3. **lane 7, after 1–2:** implement the `runs` port (accept run with Core's prompt, persist the selection, dispatch); compose `facts.decorateObjective`, `custody.publish` and Core accept in preparation; register the lifecycle activities in `temporal-worker.mjs`.
4. **dot:** Core items in §4, decisions D7-2 and D7-3, terminal accounting subject.
5. **Retention owner:** data class, suppression and purge for custody `record` (private prompt and facts).
6. **Qualification:** native PG16 run of `0001_objective_custody.sql` (syntax, triggers, non-owner role, races, uncertain COMMIT, backup/restore); Core-fixture composition int-test; image-closure under Docker; Linux image.
7. **Owner decision D7-1:** confirm that the dot Meri Planner workflow branch stays unreceived.

## 8. Acceptance criteria for this lane

- A source-review ACCEPT of this branch's diff against base `0bab8e34`.
- All files in §6 pass on the integrated pin (PR #133 after the first shipment).
- The rows marked "C (source)" become **integrated** only once received into PR #133. **Qualified** requires §7 item 6. **Live** requires Core items §4.1–4.6, the composed `runs` port, and an authenticated end-to-end run in which:
  - an Objective command in the browser produces a saved Strategy and Planner outputs;
  - the browser is closed while the generation is running, and the workflow still completes.
