# Meri repair review — round two, 15 October 2026

**Complete product, integration and release: HOLD.** This record summarizes three bounded independent repair reviews supplied by the coordinator. Fable retains all implementation and repair-package ownership. Exact-pin source acceptance below does not qualify a real sandbox, provider flow, physical cancellation, authenticated integration, image or deployment. No product code or runtime resource was changed by this documentation publication.

## Exact decisions

| Reviewed source | Bounded disposition | Complete report |
|---|---|---|
| `743ae3700751e25947702ce5672b0978c27cc23a`, `fable/p2a-r-readiness-plugin-20261015` | **ACCEPT reviewed source corrections:** P2a-R1 readiness reconciliation, P2a-R2 missing-workspace/symlink-parent boundary, and required hook string fields. **Contract freeze and real sandbox remain HOLD/pending.** | [P2a readiness/plugin successor](REPAIR-P2A-READINESS-REVIEW.md) |
| `0d88e209dc811fc417b7bdec4327174a6582f876`, `fable/a2-cancel-proxy-route-20261015` | **ACCEPT L5 unsupported/default-mode removal and SEC-REL-01 exact proxy-route source repairs.** Actual CLI/provider, Temporal/ECS termination and durable revocation remain unqualified. | [A2 cancellation and proxy route](REPAIR-A2-CANCEL-PROXY-REVIEW.md) |
| `3dceab531ed5cbc59289122f04eb1500064e8b38`, `fable/a1-pause-checkpoint-20261015` | **HOLD complete L1 source closure.** Normal race fencing/checkpoint and immediate terminal-failure corrections work; delayed terminal settlement still leaves a running row without a checkpoint after SDK closure. | [A1 pause checkpoint repair](REPAIR-A1-PAUSE-REVIEW.md) |

These are separate branch increments, not an integrated repair package: P2a is +4/−0 from `ff52b9ea0cfb5c0280ea95baea6396554a6eed7d`; A1 is +3/−0 from that same prior pin; A2 is +3/−0 from `e046be844fbc4e56a8111dbfa28c330169e4536e`. Identities and comparisons are reported in the independent reviews. This publishing lane verified the delivered report bytes, not the underlying source probes.

## What advanced and what remains

**P2a:** the successor now retains contradictory SDK frames/usage and requires clean deliberate shutdown before availability; the two prior readiness counterexamples are refused. Plugin and workspace must be existing directories before realpath disjointness checks, closing the exact missing-leaf/aliased-parent case. Missing/null/non-string required hook summaries/errors now latch failure; present empty strings remain valid. This supersedes only the covered source findings at the earlier P2a pin. Trusted immutable mounts/loading, real SDK behavior and actual sandboxing remain unmeasured.

The separate telemetry receiver remains accepted in architectural direction only. Its binding transport and 1,024-byte boundary, closed schema/maximum sizes, transactional cursor/idempotency/current-fence behavior, adapter/storage/retention ownership and authorized reads still require canonical owner work and review. UIEvent 0.1.0 is unchanged; current capability events still use the old append path and fail closed.

**A2:** the official worker startup path requires literal `native.preparedKickoff:true`; the registered broker dispatches only prepared kickoff and uses the existing original-stop owner. It does not add a cleanup authority or automatic redispatch. The independent three-second cleanup lifetime bounds waiting for a verified outcome; it is not proof that ECS or descendants terminated within three seconds. The written old-worker drain/native-retirement plan is accepted as a source plan, not as an executed inventory or rollout receipt.

The retained inference route now admits exactly ASGI HTTP / HTTPS / POST, decoded and raw path `/v1/messages`, and raw query bytes `b"beta=true"`. Empty/missing/alternate/encoded/extra query forms remain refused. This closes the observed pinned request mismatch in source; real streaming, cancellation and next-turn compatibility through the actual proxy/provider remain unrun.

A wrong kickoff-ID injected after dispatch can redirect cleanup toward the rejected ID. The selection expression is inherited. The current reviewed trusted prepared owner validates and retains the canonical original and cannot emit that wrong-ID receipt; the probe deliberately violates its transport invariant. This is a **nonblocking inherited hardening caveat for these bounded acceptances**, not a demonstrated reachable production leak or wrong-task stop. Fable should retain the original execution key as unconditional cleanup authority, store only a validated receipt, add the regression and qualify broad “every refused receipt closes original” wording.

**A1 / remaining L1 blocker:** the repair suppresses output after refusal, asks the lifecycle owner to claim/capture the held control, and adds a narrow transaction-owned `HOLD_CHECKPOINT_FAILED` escape. Immediate pause/approval and failure probes behave correctly. Keep those repairs and the durable output fence.

Both terminal attempts still inherit a 30 ms cutoff. With a finite 45 ms delay before each terminal append and the supplied abort honored before the durable transition, both attempts expire. Claimed capture failure leaves **running / UNKNOWN / zero checkpoints**; a hold committed during completed publication leaves **running / PENDING / zero checkpoints**. The SDK closes, and waiting beyond the delayed calls does not settle either row. No output crossed the hold. This is a source failure-settlement/liveness residual, not observed live latency, a new disclosure finding or a claim that A1 introduced the timeout.

## Independent tests and their limits

| Review | Independently executed evidence | Limits / owner-reported evidence |
|---|---|---|
| P2a successor | 96 selected blobs verified; retained readiness/path counterexamples now refused; readiness verdict **11/11**; policy **8/8**; source proof **5/5**; required hook fields **10 negative + 2 positive** cases. | Readiness/retained probes use disclosed hash/shape/catalog seams; policy/source-proof suites use actual materialized dependencies. Owner's 120 conversation / 82 continuation+skill / 60 packaged-skill totals and real SDK missing-dependency check were not independently rerun. No successful actual SDK sandbox or full canonicalize Unicode qualification. |
| A2 | 23 source blobs verified; actual downloaded Python modules with synthetic stores/upstream: **25 ingress + 2 focused server = 27 tests**. Extracted JavaScript bodies: **6 configuration and 15 broker cases**, including the wrong-ID caveat and bounded hung-stop UNKNOWN. | Synthetic schema/hash/Temporal/transport boundaries; no socket/TLS/provider/database/AWS. Owner's 18 runtime / 25 ingress and 205-test aggregate, full runtime/loopback/Temporal suites and deployment context were not independently reproduced. |
| A1 | **22 syntax checks**; **10 targeted source-extracted synthetic assertions in two final executions**. Eight check intended protections; **two assert the remaining held-running defects**, so this is not a product acceptance pass. | Scripted PostgreSQL protocol rows and substituted contracts/hashing/SDK/native capture; no real PostgreSQL/Temporal/SDK. Initial extractor collision was a corrected harness failure before product code. Owner's 13 scripted hold/store, 8 real-PG composition repeated five times, 14 store-PG, 147 worker and 7 runtime-process results were source-inspected but not independently rerun. Disclosed full-suite failures remain historical evidence. |

No package install, migration, provider call, remote runtime, user-computer qualification, cloud change or deployment was performed by these review lanes. Companion evidence paths in the verbatim reports identify reviewer workspaces; their probe files/logs are not included in this publication. The documentation lane did not rerun those checks.

## Remaining Fable package and evidence work

1. **Close the single L1 residual at a new immutable pin.** Make terminal failure acknowledged or durably reconcilable through the canonical owner with a justified finite publication/cleanup bound. Increasing a timeout alone does not settle lost acknowledgments. Do not add endless retries, reopen held output or replace the current repair with a broad lifecycle redesign.
2. **Add focused latency and uncertain-ACK regressions.** Cover both claimed capture failure and unclaimed completion-window hold above 30 ms; reconcile the same exact binding/writer/event idempotently, without duplicate effects or overwriting an applied checkpoint. Rerun affected composition/worker/runner checks; real PostgreSQL composition remains an explicitly authorized evidence step, not permission from this publication.
3. **Finish the existing packages under their owners.** Keep telemetry freeze/integration, current policy delivery, immutable plugin preparation and sandbox/image qualification separate. P2b's incomplete review, serving synchronization/provenance work, P2c structural/ZIP/effective-egress/strict-settings/bounded-approval work, and the comprehensive product/integration gaps remain open unless separately reviewed at newer pins. No retry or workaround of the safety-stopped P2b review is authorized.
4. **Supply portable execution evidence and qualify the integrated candidate.** The [previous successor checklist](SUCCESSOR-REVIEW-20261015.md) still requires exact SSR receipt/bound outputs/dependency/environment evidence and Playwright JSON/spec/filter/axe/traces plus unit/typecheck/architecture logs. Also retain real pinned CLI → actual proxy → provider, Temporal cancellation/native task and descendant stop, durable revocation, old-worker drain/reconciliation, real sandbox/egress and image/release gates. Desired browser capability remains ON; activation and effective destination controls remain independent gates.

## Integrity and historical preservation

All nine chunks were complete and untruncated. After decoding the XML transport envelope once, delimiter content was joined without added separators or reconstructed prose. The assembled bytes match the coordinator's supplied hashes:

| Delivered report | Bytes | SHA-256 |
|---|---:|---|
| `REPAIR-A1-PAUSE-REVIEW.md` | 12,770 | `f8107b451f96c46b1749464697894c27256294a1aa99d39ddd4b06bbeca0959b` |
| `REPAIR-A2-CANCEL-PROXY-REVIEW.md` | 15,206 | `624ec81ef8281671cda14f7ff1455c84c0ef7b89e506f2fc0faf1da210f77f5d` |
| `REPAIR-P2A-READINESS-REVIEW.md` | 13,127 | `4390c4b645c0e4d983a754c33545dc1206ed0a5e600da99b67631cfd17cb9e30` |

All eleven previously published audit/review files are preserved. The [original comprehensive audit](README.md), [first successor record](SUCCESSOR-REVIEW-20261015.md) and its complete reports retain their original pins and decisions. This round advances only the bounded source findings identified above; source acceptance is not full implementation or deployment acceptance.
