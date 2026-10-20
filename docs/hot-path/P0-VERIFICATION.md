# P0 verification record

Base: `69fd19945c6f9255577d58d9fee01385f0cc6526`.
Candidate: the P0 working tree on `feat/meri-p0-telemetry`; CI records the exact committed PR head separately. Local checks below ran on Linux with Node 24.19.0 and Python 3.12.14. They are not Docker image qualification.

## Local evidence

| Check | Observed result | Evidence and limits |
| --- | --- | --- |
| Shared P0 Node schemas, context and I/O wrappers | **28/28 passed** in the final focused run | Includes the acquired-pool-client identity correction. The earlier saved `telemetry-shared.log` records 24/24 before the additional cases. |
| Control startup and terminal integration | **31/31 passed** | `/tmp/meri-p0-final-integration.txt`; covers completion, cancellation, reconciler, lost acknowledgements, admission attribution, runner counts and configuration. Earlier terminal-only run was 20/20. |
| Observability template and alarm contracts | **9/9 passed** | `evidence/observability.log`; rendered-template parity, alarm dimensions and thresholds. No CloudWatch resources applied. |
| Owner Node suites | **226/226 passed**, then **46/46 passed** in the latest channel-focused rerun | `/tmp/owner-final-tests.log` and `/tmp/owner-channel-final.log`. These are separate runs, not 272 distinct cases. |
| Python local selected suites | **87 run: 86 passed, 1 skipped** | `/tmp/p0-proxy-local-tests.log`; selected available-environment suites, not the complete locked proxy-image gate. |
| Final Python telemetry/refusal focus | **24/24 passed** | `python3 -m unittest apps.proxy.product.test.test_telemetry_lines apps.proxy.product.test.test_telemetry_context apps.proxy.product.test.test_refusal_diagnostics`; terminal tool output. |
| Required runner diagnostic selection, base and candidate | **99 run: 95 passed, the same 4 failed on each** | `evidence/base-diagnostics.log` and `evidence/head-diagnostics.log`; failures remain below. |
| Broader telemetry/OTel selection | Earlier candidate run: **45 run, 39 passed, 6 failed** | The 6 existing OTel failures were independently reproduced on the base: **9 run, 3 passed, 6 failed**, in `p0-otel-baseline.log`. This earlier total is not the final focused P0 count. OTel implementation/tests remain unchanged. |
| Live-median first-turn rehearsal, base and candidate | **1/1 passed on each; 164 Core calls on each** | `evidence/base-first-turn.log` and `evidence/head-first-turn.log`; both report no host clock steps. Candidate telemetry independently counts the same 164 calls and emits first-text/result/terminal records. |
| CI helper decoding and failure comparison | **5/5 passed** | Python helper tests, compilation, Bash syntax/help and workflow YAML checks passed. Actual hosted jobs remain pending. |

Evidence filenames refer to the retained local execution logs. This source document does not embed private deployment material. Focused reruns supersede the corresponding earlier development failures only for the checks actually rerun; they do not establish that every repository test passed.

## Same-base failures retained

| Suite / case | Base result | Candidate result |
| --- | --- | --- |
| SDK initialization milestones through the deferred remote process facade | Missing `startAcknowledged` milestone | Same failure |
| CLI ended by SIGKILL after initialize | `REMOTE_TASK_REFUSED` instead of the expected SDK signal classification | Same failure |
| CLI ended by SIGTERM after initialize | `REMOTE_TASK_REFUSED` instead of the expected SDK exit classification | Same failure |
| Foreign-owner CA file at mode 0600 | Host `chown` fails with `EINVAL` | Same failure |
| OTel run lifecycle: one span per run | Expected span absent | Same existing failure |
| OTel failed-run/replay accounting | Expected spans absent | Same existing failure |
| OTel bounded run tracking | Expected span attributes unavailable | Same existing failure |
| OTel publish observer | Expected span absent | Same existing failure |
| OTel HTTP spans/durations | Expected captured records absent | Same existing failure |
| OTel SDK export/flush | Expected trace export absent; metrics endpoint observed | Same existing failure |

Earlier development runs also exposed admission-writer, terminal-reconciler and pool-client identity regressions. Those outcomes were retained in the intermediate logs; the corrected cases pass in the final shared and 31-case integration runs. No assertions were removed to conceal those failures.

## Rehearsal measurement reconciliation

The plan quotes 224 Core calls for the median two-delta turn. The exact supplied base measures **164** on this host: **32** for load, **22 per publish across four publishes**, and **44** across eleven control polls. Candidate counts are unchanged. This is a measurement discrepancy against the plan, not a reduction claimed for P0.

The original fixture returned only scopes from append and stubbed the completion receipt outside the durable terminal observer. The candidate fixture returns the journal's complete publication shape and exercises the existing durable completion publication. It preserves injected Core latency, timeout/authentication behavior and the independent Core-call counter; its terminal observation adds no Core calls. The new assertions require telemetry count equality and known first-text/result timings. They do not hard-code 224 or claim live provider latency.

## Remaining qualification

- **Docker image gate: not run locally.** This environment has no usable Docker runtime. The exact 24-case B6/R6/W12 gate, required nonroot image suites, full first-turn/D3 rehearsals and locked Python test image still require completed GitHub Actions evidence on the final PR head and base.
- The workflow records immutable source/image pins and each failed, skipped or blocked check. A missing pinned registry image must remain blocked; a different image cannot be substituted.
- Supplemental renderer checks run on a host with full Git history and synthetic PKI, independently of the image gate.
- **AWS and live acceptance: not performed.** The shipper owns stack review/application, SNS confirmation, app deployment, the live two-turn chat and dashboard/Logs Insights verification.

This record does not declare the PR fully qualified or ready to deploy. The deliverable remains one unmerged PR with all failed and unverified gates visible.
