# Fable slice 1: first-chat reconciliation and local baseline at PR86

Base `c6053e24b465be677cc5980533009b4aab03beab` (PR86, tree `ca60051cc73c12d777c825abdd7b5c5e56c7f0de`), branch `fable/meri-first-chat`, worktree created exactly as the handoff prescribes. Engineering: Fable (Claude Fable 5.1). This is a bounded documentation, qualification-tooling and source-reconciliation slice. Beyond tooling and documentation it makes exactly two one-line source changes found by the baseline: the selected-skill admission owner now accepts the canonical admitted-run owner's documented `currentTaskRun` method, and the independent owner-surface control lists that method (§4 items 2–3). It changes no dependency, lock, migration, recipe, public contract or native helper; all 45 proof rows and the source-proof suite are unchanged. It claims no image admission, G1 progress, live chat or release acceptance.

Scope of this report: (1) reconcile the first usable authenticated chat path in [HANDOFF §5–6](../../handover/20261014-fable/HANDOFF.md) against the actual PR86 source, stage by stage, separating implemented source, local evidence and unbound owner inputs; (2) record the exact owner binding packet the existing closed configuration already demands; (3) record a reproducible local baseline of the existing checks on an ordinary Linux host, with every failure retained and classified; (4) record source observations found while reading; (5) propose the next bounded slices in dependency order, including the one that needs an architecture approval before code.

## 1. First-chat path: what PR86 source already composes

The fixed first-run pilot is composed end to end in source by the control `nativeCandidate` option (`apps/runtime/prepared-candidate.mjs`, `prepared-candidate-config.mjs`), the Temporal poller's `native.preparedKickoff` broker activity (`apps/runtime/temporal-worker.mjs`), and the task's `bootstrap.remote` runner (`apps/runtime/conversation-runner.mjs`, `remote-conversation-runner.mjs`). Each stage below names the canonical owner at PR86 and the strongest evidence class that exists for it. Evidence classes follow HANDOFF §11: ACCEPT_SOURCE (reviewed source and local tests over synthetic ports), local-artifact (actual local resource exercised: PostgreSQL 16, real processes, real pinned SDK/CLI), image-qualified (built image/native checks by shipping), live (deployed, authenticated, real provider).

| Stage (HANDOFF §5 item) | Canonical owner at PR86 | Strongest evidence at PR86 | Reproduced in this slice | Unbound owner input |
| --- | --- | --- | --- | --- |
| 1. Admitted exact source/image | `apps/runtime/Dockerfile`, `build/materialize-swc.mjs`, `scripts/qualification/assembled-image/*` | image-qualified but scan-blocked (2 Critical / 48 High, shipping relay) | source-proof 3/3 PASS at `c6053e2`; Docker daemon absent, image-closure control not runnable here | repaired/admitted image digest, measured runner, `NODE_IMAGE` digest |
| 2. Backend identity/context bound to Clerk session | `apps/control/action-host/application-adapters/{authority-http,context-adapter}.mjs`, `native-authority/identity-context.mjs`, prepared candidate `createPreparedCandidateIdentity` | ACCEPT_SOURCE (synthetic authority ports; backend carrier pinned in `cross-repo/pins.json`) | adapter/session suites pass locally | live `/api/clio/application-authority/{identity,context}` origin, identity credential file, exact `commandContext` |
| 3. Product PostgreSQL pool and allocation/grant/fence state | `apps/gateway/budget/{admitted-run-owner,native-allocation-admission,postgres-tool-budget}.mjs`, migrations 0001–0008 + product-budget 0001 | local-artifact (actual PostgreSQL 16 in prepared-kickoff FINAL-QUALIFICATION) | all canonical migrations applied to fresh local PostgreSQL 16; conversations, native-authority and admitted-run suites pass over it | dedicated product database, connection file (`sslmode=verify-full`), current budget row, approved allocation JSON and grant intents; migration execution by its trusted owner |
| 4. Temporal endpoint/namespace/queue/TLS | `apps/runtime/{control,temporal-worker}.mjs`, `apps/control/conversations/{temporal-dispatch.mjs,workflow.ts,lifecycle/workflow.ts}` | ACCEPT_SOURCE (upstream bundling and Activator checks; no Temporal server anywhere in the history) | same; no Temporal server obtainable on this host (release downloads are refused by the egress policy) | private Temporal address/namespace/task queue/TLS files; namespace authorization |
| 5. Task capability verification, supervisor, independent registration reader, broker, physical isolation | `native-authority/{task-verifier,admitted-supervisor,independent-task,supervisor-process,session-launcher,session-registration,execution-broker,prepared-kickoff,remote-composition}.mjs` | local-artifact (real separate supervisor process and genuine Node stream; real pinned SDK/CLI zero-turn `/status` probe in first-session-local) | native-authority suite 305/305 as non-root with concurrency 1 (see §3) | real ECS task ARN/cluster/task definition, measured image/runner hashes, approved launch template, control/task capability files |
| 6. Model/proxy/provider route and budgets | `native-authority/runtime-provider.mjs`, `apps/worker/conversation/options.mjs`, `remote-conversation-runner.mjs` | ACCEPT_SOURCE (synthetic proxy; `model` is a configuration string) | worker-conversation suite passes with scripted SDK messages | approved proxy origin, model pin, proxy credential file, per-run budgets; D004 synthetic Bedrock candidate is historical, not this binding |
| 7. Opaque issuance/proxy surfaces, one end-to-end conversation | `apps/control/action-host/session/*`, `apps/control/conversations/{http,service,events}.mjs`, frontend PR48 (dot) | ACCEPT_SOURCE for the Meri side; preview is live for Portfolio only (parent relay) | conversations and control suites pass; process test exercises the real listener and CLI | public Meri HTTPS origin, frontend `MERI_API_BASE_URL`/workflow flag, `CAPIRO_PREVIEW_READ_ONLY` decision by the release owner |

Conclusion of the reconciliation: for the fixed first-run pilot there is no missing Meri source stage. Every remaining item in §5 is an owner binding or a live/native gate. The handoff's statement that "wider continuation admission/retirement and approval read/decision owners still need composition beyond the fixed first-run pilot" is confirmed in source: `prepared-candidate.mjs` routes `checkpoint/read` to the inspection owner but has no handler for `continuation/admit`, `continuation/retire`, `approval/read` or `approval/decision`, so lifecycle `resume`/`fork`/`approval.wait` refuse in that composition (`PREPARED_CANDIDATE_REFUSED`). A plain first chat does not need them.

### A structural limit that matters for "usable" chat

The opaque session binds exactly one run: `createActionSessionOwner` pins `principal.runId`, `createConversationService.submit` reuses the session's `context.binding` as the run binding, and the prepared candidate identity accepts only the single configured `commandContext.binding` ("genuine missing canonical row permits only the already-approved fixed first-run input"). A second prompt in the same conversation therefore has no source path today: the same run row exists, so `store.accept` refuses it as `REQUEST_REPLAY_REFUSED`, and the session cannot select another run. The lifecycle facade creates new runs only through `resume` (from a paused/approval-wait checkpoint) or `fork`. This is consistent with the handoff's milestone definition (one plain conversation), but a follow-up turn is the next product capability on the first-chat path and needs a design decision (§5, slice 2).

## 2. Owner binding packet already demanded by the closed configuration

No value, hostname or credential is invented here. These are the exact fields `validateConfiguration` and `compilePreparedCandidateConfiguration` refuse without. Secret files must be absolute, regular, non-symlink, owned by the running UID, mode without group/other bits, at most 32 KiB.

| Owner | Role file | Fields |
| --- | --- | --- |
| Shipping/control owner | `control.json` | `version:1`, `profile:'isolated-preview'`, `sourceEnabled:false`, `limits:{startupMs,shutdownMs,requestMs,requestBytes}`, `native:{origin,capabilityFile,loopback:false,maxResponseBytes}`, `http:{hostname,port,frontendOrigin}`, `database:{connectionFile}` (PostgreSQL URL with exactly one `sslmode=verify-full`), `temporal:{address,namespace,taskQueue,tls:{caFile,certFile,keyFile}}`, `sessions:{mode:'process-local',replicas:1,maxSessions,maxTtlMs}`, `versions` (`RuntimeVersions`: imageDigest, sdk 0.3.295, cli 2.1.295, contracts, skillsDigest, checkpointFormat), `nativeCandidate` (below). `native.capabilityFile` must equal `nativeCandidate.controlCapabilityFile`. |
| Backend/authority owner | `nativeCandidate.identity` | `origin` (HTTPS, no `/api`), `credentialFile` (native bearer), `commandContext:{binding:{tenantId,actorId,conversationId,runId,attemptId,workerId,writerFence},clientResolution:{reference,clientId}}` with `reference === clientId`; actor is the canonical backend user ID. |
| Runtime/model owner | `nativeCandidate.runtime`, `proxyCredentialFile` | `binding` (equal to `commandContext.binding`), `versions` (equal to control `versions`), `proxyUrl` (HTTPS), `model`, `deadlineMs`, `maxTurns ≤ 100`, `maxCostMicroUSD`, `maxOutputBytes ≤ 1 MiB`, each within the allocation budgets and schedule expiry. |
| Native admission/persistence owner | `allocationJson`, `qualification`, `grantIntents`, `grantId`, `operations`, `taskCapabilityFile`, `controlCapabilityFile` | canonical allocation `{run,manifest,manifestSha256,catalogSha256,budgets,schedule}`; `qualification:{attempt,policyRevision}`; 1–16 grant intents `{grantId,capabilitySha256,expiresAtMs}` with the selected `grantId` matching the task capability digest and never the control digest; `operations` covering every run-owner operation plus `runner/session/*`; `preparationIntent.authoritySha256` equal to the hash of the fixed scope/client/policy. |
| Shipping (ECS/S3) | `taskRequest`, `containerName`, `taskOrigin`, `taskHttp`, `objects`, `preparationIntent`, `plan` | `taskRequest:{cluster,taskDefinition,networkConfiguration,overrides}`; `taskOrigin` (private HTTPS origin of the admitted task, equal to `taskHttp.frontendOrigin`); `objects:{bucket,prefix,expectedBucketOwner:'967807252336',kmsKeyId}`; `preparationIntent` with workspace, config parent, secure-storage directory, launch template (command/args/env), `executableSha256`, `imageSha256` (equal to `versions.imageDigest`), `runnerSha256`, `sdkOptionsSha256`. |
| Temporal poller owner | `temporal-worker.json` | common fields, `http`, `temporal`, `native.preparedKickoff:true`. |
| Task (conversation) | `runner.json` | common fields, `binding`, `versions`, `workspace` ending in `/<conversationId>`, `proxyOrigin`, `captureOwnsClose:true`, `bootstrap:{expiresAtMs,remote:true}`; no database or Temporal fields are accepted. |

Three validated synthetic examples exist under the prepared-kickoff candidate author directory (`SYNTHETIC-*-configuration.json`); their IDs and hashes are fixtures.

## 3. Local baseline on an ordinary Linux host

Purpose: establish, at the exact PR86 head, which existing checks pass on a host that is neither the Codex workstation nor the qualification image, and make that rerunnable for dot's independent repetition. Tooling added under `scripts/qualification/local-baseline/` (README there); receipts under `docs/qualification/candidates/fable-local-baseline-20261014/`.

Host: Ubuntu 24.04.5, kernel 6.18.44, Node 24.21.0 (nvm), npm 11.19.0, PostgreSQL 16.15 (local Unix-socket clusters, canonical migrations 0001–0008, product-budget 0001, artifacts 0001), LibreOffice 24.2.7, Python 3.13 with python-docx/openpyxl/xlsxwriter, Docker client without a daemon, no Temporal server, no AWS/provider/backend access. Dependencies installed from every package lock with scripts disabled. Suites run as a non-root user under a child subreaper, with ambient `AWS_*`/`ANTHROPIC_*`/`NODE_EXTRA_CA_CERTS` scrubbed.

Three attempts are retained in the candidate directory (initial run at the clean base; final complete run at `bc8ac02`; office rerun of four suites after pinning PyMuPDF to 1.24.14). Final complete run:

Totals: 28/37 suites exit 0; 8640/8756 Node tests pass, 116 fail (npm-script suites report exit code only). Head `bc8ac02e3b5597ff097ee7e35f740b9b7ffc7c3d`, tree `66e94ac6b8bffdba03dc0b9e88383669c082dbcf`, uncommitted paths 1; uid 30033, Node v24.21.0, subreaper True.

| Suite | Result | Pass/Tests | Fail | Retained failure cause on this host |
| --- | --- | --- | --- | --- |
| `source-proof` | PASS | 3/3 | 0 |  |
| `contracts-package-check` | PASS | — | — |  |
| `root-check` | PASS | 4241/4241 | 0 |  |
| `sdk-evidence` | PASS | — | — |  |
| `runtime-typecheck` | PASS | — | — |  |
| `runtime-tests` | FAIL | 111/112 | 1 | 1: image-closure build control needs a Docker daemon (client present, no daemon) |
| `conversations-typecheck` | PASS | — | — |  |
| `conversations-tests` | PASS | 133/133 | 0 |  |
| `conversations-skills` | FAIL | 28/33 | 5 | 4: PyMuPDF 1.28 `import fitz` wrote a deprecation warning to stdout ahead of the bridge JSON; 1: LibreOffice process-group cleanup on this host. With PyMuPDF pinned to 1.24.14 the suite passes 33/33 (final-office-rerun). |
| `worker-conversation` | PASS | 135/135 | 0 |  |
| `native-authority` | PASS | 305/305 | 0 |  |
| `runtime-selected` | PASS | 18/18 | 0 |  |
| `runtime-artifacts` | FAIL | 5/6 | 1 | 1: one-shot evidence receipt already tracked (EEXIST); the control is not rerunnable without discarding committed evidence |
| `gateway` | FAIL | 801/802 | 1 | 1: PyMuPDF stdout warning; passes 802/802 with PyMuPDF 1.24.14 (final-office-rerun). |
| `gateway-budget` | PASS | 27/27 | 0 |  |
| `gateway-sources` | PASS | 315/315 | 0 |  |
| `gateway-local-action` | PASS | 44/44 | 0 |  |
| `gateway-selected-skills` | PASS | 36/36 | 0 |  |
| `artifacts` | FAIL | 295/301 | 6 | 3: PyMuPDF stdout warning (gone after the pin); 2 file-level: `/opt/codex/.../node/node_modules/pptxgenjs` hard-coded host module path absent; 4 (after the pin): LibreOffice leaves a process-group member alive on this host (`groupAbsent:false`), ARTIFACT_CLEANUP_FAILED. Final-office-rerun: 295/301. |
| `control-core` | PASS | 260/260 | 0 |  |
| `control-action-host` | FAIL | 209/267 | 58 | 57: private backend source mirror `/tmp/capiro-endpoint-integration-source-20261013.git` at pin 60cf2e51 is not available here (private repository; no access was created); 1: `local/recovery-independent.test.mjs` stalled inside the 18-file batch on a ~2^31 ms referenced timer and was terminated by the operator after 6 minutes (diagnostic report retained); the same file passes 7/7 alone with the same environment |
| `control-action-application` | PASS | 124/124 | 0 |  |
| `control-action-followthrough` | PASS | 55/55 | 0 |  |
| `control-admitted-runs` | PASS | 85/85 | 0 |  |
| `control-commands` | PASS | 76/76 | 0 |  |
| `control-document-application` | FAIL | 252/259 | 7 | 6: PyMuPDF stdout warning (gone after the pin); 1: local loopback Word draft control returns 502 ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN, reproduced alone on this host with no process receipt; root cause not isolated here (UNVERIFIED). Final-office-rerun: 258/259. |
| `control-schedules` | PASS | 134/134 | 0 |  |
| `control-task-lookup` | PASS | 158/158 | 0 |  |
| `control-qualified-application` | FAIL | 362/393 | 31 | 31: host-prepared dependency directory `/tmp/meri-qualified-lifecycle-deps` (jsonata.cjs) absent |
| `control-staging-e2e` | PASS | 13/13 | 0 |  |
| `control-qualification-sdk-fixture` | FAIL | 65/71 | 6 | 6 file-level: the protected isolated qualification TCP database (`MERI_FIXTURE_TEST_PORT/DATABASE/USER`) is intentionally not imitated here |
| `control-qualification-temporal` | PASS | — | — |  |
| `proxy-qualification` | PASS | 29/29 | 0 |  |
| `window-resolution` | PASS | 35/35 | 0 |  |
| `skills` | PASS | 61/61 | 0 |  |
| `evals` | PASS | 204/204 | 0 |  |
| `scripts-local` | PASS | 21/21 | 0 |  |

Office rerun deltas with PyMuPDF 1.24.14: `gateway` 802/802, `conversations-skills` 33/33, `artifacts` 295/301, `control-document-application` 258/259. One operator intervention occurred in the final run: a single test file stalled inside the `control-action-host` batch on a ~2^31 ms referenced timer and was terminated after six minutes with its Node diagnostic report retained; it passed 7/7 alone afterwards. See the candidate README for the full classification and what the run does and does not establish.

Suites that matter most for the first-chat path pass completely on this host: `source-proof`, `contracts-package-check`, `root-check` (4241), `conversations-tests` (133, actual PostgreSQL), `native-authority` (305, actual PostgreSQL and real supervisor processes), `worker-conversation` (135), `runtime-tests` 111/112 (only the Docker image-closure control fails), `control-admitted-runs` (85), `gateway-budget` (27), `sdk-evidence`.

Host facts discovered while reproducing (each is now encoded in the runner or its README):

- `assertRunnerWorkspace` refuses UID 0, so the runtime process controls only pass as a non-root user; `NODE_EXTRA_CA_CERTS` pointing at an unreadable bundle adds a warning line that breaks the exact-stderr CLI control.
- `apps/runtime/test/{first-run-mount,prepared-candidate-control-lifetime}.test.mjs` and several native-authority files need `--experimental-test-module-mocks`; the standalone browser-module control in `packages/contracts/test` needs `--experimental-vm-modules`. Neither flag is in a package script.
- PostgreSQL-backed files in `apps/runtime/native-authority/test` share one database and fail with `NATIVE_TASK_REFUSED`/`STORE_CORRUPT` when Node's default parallel file execution interleaves them; with `--test-concurrency=1` the same files pass.
- `apps/runtime/prepared-candidate.mjs` imports `@aws-sdk/client-s3`, which is not in `apps/runtime/package.json`; resolution relies on the image recipe's root link to `apps/artifacts/storage/node_modules`. The conversations and artifacts tests likewise resolve `pg` and `jszip` from the repository root. The link script reproduces exactly the recipe's three links plus those two test-only links.
- 24 test files hard-code the Codex host Python interpreter path and 11 hard-code its `soffice` path; only 6 honor `MERI_DOCUMENT_PYTHON` (and `MERI_SOFFICE` where present), so on any other host those checks pass only after that path is provided.
- `apps/runtime/artifacts/test` writes one-shot evidence receipts into the tracked evidence directory and refuses reruns (`EEXIST`).
- `apps/control/schedules/test/temporal-inspection-independent.test.mjs` "authority expiresAtMs substitution refuses" failed once under full-host load and passed in three isolated reruns; the control compares `Date.now()-1` receipts against the harness clock and is timing-sensitive.
- LibreOffice headless conversions leave a member of the spawned process group alive on this host after the leader exits, so `groupAbsent` cleanup proofs fail here even under a subreaper; this is a host difference, not evidence about the renderer owner.
- PyMuPDF 1.28's `fitz` alias prints a deprecation warning to stdout, which the Python bridge callers parse as JSON; 14 controls across four suites fail with that version and pass with 1.24.14. The repository pins no PyMuPDF version; the Codex host evidently carries an older one.
- 57 `control-action-host` controls read the private backend source mirror `/tmp/capiro-endpoint-integration-source-20261013.git` at pin `60cf2e51`; it is private and no access was created here. 31 `control-qualified-application` controls read a host-prepared `/tmp/meri-qualified-lifecycle-deps` directory. Six `control-qualification-sdk-fixture` files require the protected isolated qualification TCP database, which this slice deliberately does not imitate.
- A credential-shaped host variable reached test processes in the final run (`GH_TOKEN`, `GITHUB_TOKEN`, `CLOUDSDK_AUTH_ACCESS_TOKEN`, `GIT_CONFIG_*`): the scrub list recorded in that run's `RESULTS.json` did not cover them. No test uses them and no receipt contains them (the one diagnostic report was redacted before publication); the runner now also removes any `*TOKEN`/`*SECRET`/`*PASSWORD`/`*CREDENTIALS`/`*API_KEY`/`*ACCESS_KEY` key and the `CLAUDE*`, `CCR_`, `GH_`, `GITHUB_`, `CLOUDSDK_`, `GIT_CONFIG_` prefixes.

## 4. Source observations and the two reconciliations made

1. First-run composition is complete in source for one plain conversation; the only non-binding code gap on that path is the absence of continuation/approval provider routes in `prepared-candidate.mjs` (not needed for the pilot). Owner: `apps/runtime`.
2. Drift at PR86, fixed here: `createPostgresAdmittedRunOwner` (`apps/gateway/budget/admitted-run-owner.mjs`) gained the read-only `currentTaskRun` method for the admitted supervisor (documented in `apps/runtime/native-authority/ADMITTED-SUPERVISOR.md`), but `createOriginalSkillAdmissionOwner` (`apps/control/conversations/skills/admission.mjs`) still enumerated the owner's surface with a closed `own()` list that omitted it, so every caller handing it the canonical owner refused with `INVALID_COMMAND`: 13 controls in `apps/gateway/selected-skills/mount.test.mjs` and 4 in `apps/control/conversations/skills/test/pipeline.test.mjs`. There is no production caller yet (selected skills remain fail-closed until their owners are composed), so this is test-visible drift on the R2 skills path (R-07/R-08, REL-04), not a live defect. Change: the optional key list now includes `currentTaskRun`; the owner still uses only `currentAllocation`. After the change: selected-skills 36/36; the pipeline controls proceed to the LibreOffice cleanup difference of this host.
3. Same drift, independent control: `apps/control/admitted-runs/independent/owner-independent.test.mjs` asserted the owner's exact surface without `currentTaskRun`. The expected surface now lists the documented method. This is an update to an independent reviewer's control and is called out for dot's explicit review rather than treated as routine.
4. Resolution coupling: `apps/runtime` depends on a sibling package's installed dependency through a root link rather than its own lock. Any Dockerfile change must keep that link; a future `apps/runtime` lock addition would change a non-proof file but still needs root/dot allocation of the lock owner.
5. Test host coupling: hard-coded Codex paths for Python/soffice, and PostgreSQL socket paths that encode a date. Not product defects; they shape who can independently rerun which checks.
6. The product `check` scripts do not express the flags/concurrency their tests require, so a reviewer running `npm run check --prefix apps/runtime` or the native-authority files directly gets failures that are not source regressions. `suites.json` records the required invocation per suite until the owners decide whether to encode it in package scripts.

## 5. Next slices, in dependency order

- Slice 2 (design proposal to dot, approval required before code; W05/W06, REL-05/RG-12): follow-up turns in one conversation. Proposed shape, reusing existing owners only: the opaque session owner issues a fresh session for a new run binding in the same conversation (new `runId/attemptId/workerId`, higher `writerFence`) through the existing `context/resolve` join rather than a fixed `commandContext`; the conversation service accepts the new run against the existing conversation row (already supported by `store.accept`, which reuses a matching conversation projection); native admission allocates per run exactly as the prepared-candidate path does today; SDK continuity uses the existing checkpoint/continuation envelope (`mode:'resume'`) captured at run completion instead of only at pause. No new migration appears necessary (runs and continuation columns already exist); the public conversation-application 0.1.3 shape is unchanged for submit/history/events; the private identity/context DTO is unchanged; the fixed-identity prepared candidate would gain an owner that can admit more than one run. This changes execution placement for nothing and component choices for nothing, but it widens the pilot's "one fixed run" admission, so it is recorded here for approval first.
- Slice 3 (qualification, no approval needed; W05/W09): a local rehearsal of the composed `nativeCandidate` control plus prepared-kickoff poller plus remote runner over local PostgreSQL with the real pinned SDK/CLI in zero-turn `/status` mode and synthetic ECS/backend/S3 ports, extending `apps/runtime/test/prepared-candidate-*.test.mjs`. It cannot include a Temporal server on this host; the broker activity would be invoked directly as the existing tests do.
- Slice 4 (W00–W01, REL-02): machine-checked reconciliation of the 139 capability IDs, 14 skill intents and 12 requirements against `packages/contracts/retrieval-0.2/catalog.json`, `packages/skills` manifests and current handlers at PR86, replacing reliance on the dated PR59 audit.
- Slice 5 (W02/G1 input): after shipping supplies the private finding table, a dependency-traced base/package candidate for the scan, preserving all 45 proof bytes where a base-argument change suffices.

### Delivered after slice 1 on the same branch

- Slice 2 proposal (approval gate, no code): [FABLE-FOLLOWUP-TURNS-PROPOSAL-20261014.md](FABLE-FOLLOWUP-TURNS-PROPOSAL-20261014.md).
- Slice 3 outcome: the composed real-CLI rehearsal was blocked at its first gate and the blocker is recorded with receipts in [FABLE-REMOTE-LAUNCH-DESCRIPTOR-FINDING-20261014.md](FABLE-REMOTE-LAUNCH-DESCRIPTOR-FINDING-20261014.md): the real SDK launch descriptor for the product option set fails the remote launch gates at PR86 (undefined env entries, no per-task config directories, proxy credential inside the env). The first cause is reconciled here (`apps/worker/conversation/options.mjs`); for the second the worker side is reconciled here (the option builder accepts the per-task directory pair) and the runner side is written, tested and retained as an unapplied patch because `apps/runtime/conversation-runner.mjs` is a pinned proof row, so it needs dot's proof-row decision; the third needs dot's decision on the launch-template matcher. With the patch applied to the working tree only, the composed path (real PostgreSQL, controller, remote task, supervisor, real CLI 2.1.295, durable SDK session, product runner) completed one zero-turn conversation locally with physical stop proven; the same script with the PR86 runner fails at the SDK options pin and is retained as the control (`composed/` under the rehearsal candidate).
- Slice 4 delivered: `scripts/qualification/r2-reconciliation/` and [the reconciliation candidate](../../qualification/candidates/fable-r2-reconciliation-20261014/README.md). At this head the ledgers and source agree with zero drift; all 96 selected capabilities map to catalog operations; no operation has a bound handler and all 97 are pending; 18 operations have an adapter family in source without a catalog binding.

## 6. Requirement-to-evidence matrix for this slice

| Item | ACCEPT_SOURCE | local-artifact | image-qualified | live |
| --- | --- | --- | --- | --- |
| HANDOFF §5 items 1–7 (first chat) | unchanged from PR86 | this slice adds: local PostgreSQL 16 baseline receipts for conversations, native-authority, admitted-runs, gateway budget at `c6053e2` | unchanged (scan-blocked PR86 image) | UNRUN |
| W00–W01 reconciliation | first-chat path reconciled (§1); ledger reconciliation delivered with zero drift at this head (slice 4 candidate) | — | — | — |
| W05 durability | unchanged | unchanged | — | UNRUN |
| W09 independent verification tooling | `scripts/qualification/local-baseline/*` (new, Fable-owned) | receipts in the candidate directory | — | — |
| R-07/R-08, REL-04 selected-skill admission (drift fix) | candidate: selected-skills 36/36 and admitted-runs 85/85 locally after the change | — | — | — |
| G1 | OPEN, unchanged | | | |

## 7. Checks, commands, environment, cleanup

Exact commands are in the candidate `RESULTS.json` (`suites[].command`, `cwd`), with stdout/stderr hashes and the retained per-suite outputs beside it. Before writing any file the following were run at the clean base and are recorded in §3: source-proof, contracts package check, root check, runtime typecheck and tests, conversations check, worker tests, native-authority, and the remaining directories.

Unrun native/live gates: image build/scan/admission, Fargate task launch and isolation, Temporal server/namespace/durability, backend authority, provider/model turn, S3/KMS object publication, browser/renderer sandbox, frontend binding, all 337 native UI rows, every RG gate and REL ticket.

Resource ownership and cleanup: the local PostgreSQL clusters are owned by the provisioning script under `/tmp/meri-local-baseline-pg` and are stopped with `provision-postgres.sh stop`; root `node_modules` links are ignored by Git; no container, cloud resource, credential or product database was created or touched. No process remained from the final run beyond the host's pre-existing zombie, which this owner cannot reap.

Rollback/compatibility: reverting this commit removes the new scripts, receipts and this report and restores the two one-line reconciliations; no caller, contract, lock, migration or image recipe depends on any of them. The admission owner change widens an accepted key list only; behavior for every previously accepted input is unchanged.

## 8. Owned paths

- `scripts/qualification/local-baseline/{README.md,provision-postgres.sh,link-dependencies.sh,subreaper.py,run-suites.mjs,suites.json}`
- `docs/qualification/candidates/fable-local-baseline-20261014/**`
- `docs/coordination/reports/FABLE-FIRST-CHAT-RECONCILIATION-20261014.md`
- `apps/control/conversations/skills/admission.mjs` (one line) and `apps/control/admitted-runs/independent/owner-independent.test.mjs` (one line)
- `apps/worker/conversation/options.mjs` (env entries; optional per-task directory pair) and `apps/worker/conversation/test/activity.test.mjs` (one control); `scripts/qualification/first-chat-rehearsal/**`; `docs/qualification/candidates/fable-first-chat-rehearsal-20261014/**`; `docs/coordination/reports/FABLE-REMOTE-LAUNCH-DESCRIPTOR-FINDING-20261014.md`

Dot reviews and records ACCEPT or HOLD; nothing here is integrated, deployed or promoted by this report.
