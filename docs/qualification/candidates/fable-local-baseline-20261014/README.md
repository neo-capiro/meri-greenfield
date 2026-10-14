# Fable local baseline at PR86: receipts

Candidate for the first Fable slice (see [the reconciliation report](../../../coordination/reports/FABLE-FIRST-CHAT-RECONCILIATION-20261014.md)). Source under test is the PR86 runtime base `c6053e24b465be677cc5980533009b4aab03beab` plus this slice's two one-line reconciliations; the final run below executed at `bc8ac02e3b5597ff097ee7e35f740b9b7ffc7c3d` (the first commit of the slice). Everything here is local-artifact evidence on an ordinary Linux host: source behavior over actual PostgreSQL 16, real listeners, real supervisor processes, the real pinned Claude Agent SDK 0.3.295 package and CLI 2.1.295 binary in zero-turn controls, and local LibreOffice/Python. It establishes no image admission, Temporal server, Fargate, backend authority, provider turn, browser or release fact.

Runner: `scripts/qualification/local-baseline/run-suites.mjs` (README there). Host: Ubuntu 24.04.5, kernel 6.18.44, Node 24.21.0, npm 11.19.0, PostgreSQL 16.15 on the canonical fixture Unix sockets with migrations 0001–0008, product-budget 0001 and artifacts 0001 applied by `provision-postgres.sh`, LibreOffice 24.2.7, Python 3.13 with python-docx/openpyxl/xlsxwriter and PyMuPDF, Docker client without daemon, no Temporal server, no AWS/provider/backend/private-repository access. All suites ran as a non-root user (uid 30033) under the child subreaper with ambient credentials scrubbed; `RESULTS.json` records the exact scrub list, supplied selectors, commands, exit codes, counts, failing test names with first error line and output hashes.

## Attempts, in order, all retained

| Receipt | What it is | Outcome |
| --- | --- | --- |
| `author/attempt-1-initial/` | First complete run at the clean PR86 base, before the two reconciliations, without writable checkout, scratch artifact roots, PyMuPDF or the git read fix (head could not be read: checkout owned by another user). | 25/37 suites, 8626/8757 tests. Surfaced the admitted-run surface drift (17 + 1 controls), the scratch-root and writable-checkout requirements, and the host facts below. |
| `author/final/` | Complete run at `bc8ac02` with the reconciliations, writable checkout, scratch roots, PyMuPDF 1.28 installed. | 28/37 suites, 8640/8756 tests; table below. One operator intervention (next section). |
| `author/final-office-rerun/` | Rerun of the four office-dependent suites after pinning PyMuPDF to 1.24.14, because 1.28's `fitz` alias writes a deprecation warning to stdout ahead of the Python bridge JSON. | gateway 802/802, conversations-skills 33/33, artifacts 295/301, control-document-application 258/259. |

Operator intervention in the final run: `apps/control/action-host/local/recovery-independent.test.mjs` stalled inside the 18-file `control-action-host` batch with an empty JavaScript stack and one referenced timer of about 2^31 ms (`author/final/stall-report-recovery-independent-pid15954.json`, a Node diagnostic report redacted to its header, stack, libuv handles and resource usage). After six minutes the operator terminated that one test process so the run could continue; Node recorded the file as failed. The same file passed 7/7 alone with the same environment immediately afterwards (one control legitimately waits 30 s). The stall is retained as an unexplained batch-only host observation, not as evidence about the recovery owner.

## Final run

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


Reading the table: `PASS` means the suite process exited 0. npm-script suites (`contracts-package-check`, `sdk-evidence`, typechecks, `control-qualification-temporal`) report only their exit code. Fail counts are Node summary counts; file-level load failures count as one each.

## What this run does and does not establish

- Establishes, on this host and at this head: the 45-row source proof; public contracts generation/types/tests; the full conversation, lifecycle, native-preparation and admitted-run journals over actual PostgreSQL 16; the native-authority supervisor/broker/session/kickoff owners including real supervisor processes; the worker SDK activity over scripted SDK messages; the runtime listener/CLI/process controls as non-root; gateway sources and budget; the selected-skill admission path after the drift fix.
- Does not establish: anything behind the retained failures (Docker image closure, private backend mirror controls, the protected qualification TCP database, the Codex-host Node module and dependency directories, LibreOffice process-group cleanup on this host, the one unexplained local Word draft control, the one batch-only stall), nor any image, Temporal, Fargate, provider, backend, browser or release gate.
- Not rerun or promoted: earlier Codex receipts for the same suites; this run is independent local repetition, not acceptance.

Cleanup: the provisioned clusters are disposable (`provision-postgres.sh stop`); files written by tests into the checkout (`selected-output/test/artifacts-runs`, `qualification-temporal/.runtime`) were removed before commit and no tracked file was modified by any test; no container, cloud resource, credential or product database was created or touched.
