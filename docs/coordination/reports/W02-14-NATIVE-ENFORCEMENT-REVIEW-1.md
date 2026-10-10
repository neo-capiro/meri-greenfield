# W02-14 native enforcement — distinct actual review 1

**Verdict: SOURCE_PREPARATION_REPAIR_VERIFIED_AT_SOURCE_LEVEL. No source defect found in the reviewed scope. This is NOT native/security/service acceptance and promotes no gate.**

Reviewer: distinct actual Hermes session `20261010_010457_186e99` (not author `20261010_001742_5efe2a`).
Worktree `C:/dev/main/meri-greenfield-worktrees/w02-native-enforcement-review-1`, branch `review/w02-native-enforcement-1`.
Exact base `234a08ed38f57ebeb783fedf0bf8368b968e931f` (032c92b source + report addendum). Working tree clean; `git rev-parse HEAD` == base.

## Subject pins (independently recomputed)

- `git hash-object <file>` == `git rev-parse HEAD:<file>` for all five modules, README, canonical test and author report — raw working-tree bytes are byte-identical to the exact base commit.
- Source SHA256 (match author report §46–54 and snapshot manifest):

| path | SHA256 | bytes | gitBlob |
|---|---|---|---|
| infra/native-enforcement/app.mjs | 813a912999253b147d3d88ac50d24fbe7dd063aa98c3453a9e5e825d3fe7f70c | 422 | 09fc6209010693ca0bb315e0c80d79058bb23dcf |
| infra/native-enforcement/lib/binding.mjs | 206841da679b15d1c04e823fd8f3ad3e29410bc6b9abf0f36d448f5609d55c3c | 10161 | cae1effd9c421b0748c1d3a17952f09a43d29eab |
| infra/native-enforcement/lib/expressions.mjs | 57fe37656906542110f7cd32dcb5e74fdfb6cdd506ba90e670f45f758aec193c | 9728 | c83c2d71880be0994ef88716cfb687ecb9e6c1e7 |
| infra/native-enforcement/lib/workflow.mjs | 3f90a7a4bdfcb0795eb63af3b0a85cceb8589e08b34fbe0ba164340a9bdd6b47 | 22577 | 2ce3c8222112039225dcae2d99b64ca0d4f08cd8 |
| infra/native-enforcement/lib/infrastructure.mjs | 6e57537dfbb675a8bc7673e26185cd4df0f769637ac3b783c4cca02681b95ae0 | 3625 | 40a9e812f818fbbfc25b0e267c8c2fafe6ff4fda |
| infra/native-enforcement/README.md | 91736d18286baf89bd4b0ccc123ba3c094356c61b190e80fb9a875e3945d878f | 12554 | f99b7bb2c3d1abd3da88ae4494343727ce435cbf |
| scripts/test-native-enforcement.mjs | a30d8d17d99eeb11c87231aa74cdc5eeae11d594b5ff89717f509695c2429307 | 12959 | 0ed77ef343001019210a55a62cdf406eea386e83 |
| docs/coordination/reports/W02-14-NATIVE-ENFORCEMENT.md | a8bd7f17e1bf8aff498f2bc01c516be2b0f90c4e3688c3cedd42c69cd5cc880a | 9868 | 8710e5cd03cd99a5678d49584a3d507c7c1f2cd8 |

- Retained JSONata runtime `C:/dev/main/meri-greenfield-kickoff-20261009/.task-inputs/jsonata-2.0.6-runtime/jsonata.js` SHA256 `8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b` — hash read and asserted in-harness before use.
- Closed snapshot manifest `.task-inputs/W02-14-owner-candidate-snapshot-3/manifest.json` SHA256 `6dbf101542f2ed434fd72469c0dc4305404bd6e45bd745dfef5550e6da913df4` (evidence, not deployment). Its listed source/private hashes recompute exactly; author private files (`traces.mjs` 1b199f53…, `hermes-repair-3-result-1.json` cde7e236…, `traces.out` 19f86de6…, `canonical.out` 24bbbc6f…, `canonical-2.out` 7aa171a8…, `check.mjs` d7f6adfb…, `npm-check.out` 2d27a142…) all match.
- Preserved history intact under `git log --all`: rejected `e6207d7`, partial checkpoint `b734521`, phase-3 `032c92b`, base `234a08e`. Nothing was rewritten.
- `b734521..234a08e` full diff reviewed: binding adds `refChars`/`refBytes` + aggregate reference/version ingress bounds; expressions gains bounded-write helpers, compact projections and the three-way classifier; workflow restructured (all Pass commits via `commitCtx`, overflow ledger, stop-dispatch/confirmation split, round-robin `probeSeq`); infrastructure is comment-only (no IAM broadening); tests +6. Diff is coherent and matches the report claims.

## Checks actually run (commands, exit, pass counts)

- `node --check` on the five modules + `scripts/test-native-enforcement.mjs` → all OK (exit 0).
- `node --test scripts/test-native-enforcement.mjs` → **31 pass / 0 fail, exit 0** (~0.36 s), matching author `canonical.out`.
- Independent reviewer verifier (own mini Step-Functions interpreter over the ACTUAL generated ASL, JSONata 2.0.6 only, synthetic post-admission state injected and explicitly labelled): **19/19 composed cases PASS + 9/9 static checks PASS = 139 checks, 0 fail, exit 0**; 293 generated expressions parsed (0 failures); 134 284 expression evaluations. Harness/result/stdout SHA256 `bff68b2ea0def495749625bf851d238225176b013392032903be56121f48c910` / `184e87f0053722391cc6b9aa2feb9f48035a6c5e088ec0e21e9619b37bad0657` / `ad013687061379252f6b6c8c72b04696c5750cab58d1399a0cc50df6f5f9583e`, retained in `.task-inputs/W02-14-review-1/` (private, not committed).
- Structural confirms: no `$(eval|parse|hash|partition)` in generated sources; importing the canonical test exposes only `{fixturePins, expressionEntries}` with no test side effects (guard at test-native-enforcement.mjs:15).
- Repo-declared `npm run check`: NOT re-run (author ran it twice; the native suite is not in its scope; `ajv` missing is a preserved environment blocker). No install performed.

## Reviewer adversarial extensions (own, beyond author's 25)

All PASS (my interpreter): R-ten-owned-max (10 positives ⇒ 4 owned + 6 overflow, all 10 stop-attempted once, `STOPPED_CONFIRMED` qual FAILED); R-eleven-overflow-exhausted (11th ⇒ `OverflowExhausted` hold, `CLEANUP_UNKNOWN`, stops 10); R-foreign-never-stopped (foreign tasks never stopped); R-stop-starvation-lost-response (first positive loses its StopTask response, never terminal — the **second positive still receives its one scoped stop attempt**: both `stopAttempts`=1); R-bad-overrides-contained and R-eni-mismatch-contained (qualification FAILED, positive identity still contained and stopped); R-creation-window-outside (created outside attempt window ⇒ foreign/ambiguous ⇒ not stopped ⇒ UNKNOWN); R-terminal-container-drift (container ARN drift across describes ⇒ terminal not confirmed ⇒ UNKNOWN); R-token-cycle-failclosed / R-token-oversize-failclosed (DiscoveryError fail-closed ⇒ UNKNOWN, known direct positive still contained); R-attachment-extra-type-tolerated (see F1); R-bytes-below/above × ascii/multibyte/escaped. Cross-checks A-single-stop, A-six-owned-plus-foreign, A-overflow-first-unconfirmable reproduce the author-claimed outcomes with my own interpreter.

Confirmed from the brief: >4 positives retain bounded overflow up to 10 and every retained positive is stop-attempted; >10 stays honest UNKNOWN and blocks the next admission; foreign identities are never stopped; wrong digest/public IP/overrides/network fail qualification while the positive identity is still contained; stop dispatch precedes terminal polling; one stop attempt per exact ARN, each positive call timeout clipped ≤30 s, D=720 000/C=900 000 never reset (interpreter asserts integer 1..30 clip and Wait target < C on every call); guard refusal evaluates to `false` (not an error) with the default/inert binding; StopTask IAM stays conditioned on the **current** `aws:ResourceTag/QualificationRun` + `MeriComponent` only (no `RequestTag`, resource not `*`).

### Byte-bound evidence (measured, not assumed)

Near the adopted predicate `($s:=$string($x); $length($s)*6<=cap)`:
- below: ascii chars 5461 → bound 32766 ≤ 32768, actual 5461 B; multibyte `漢` bound 32766, actual 12861 B; escape-heavy `"` bound 32766, actual 5461 B → all accepted → `STOPPED_CONFIRMED`.
- above: ascii/multibyte chars 5462 → bound 32772 > 32768, actual 5462/12864 B → oversized Task result dropped to `null`, shape check fails closed → `CLEANUP_UNKNOWN`, no truncation, no crash.
- The `6 × $length` predicate is conservative for every fixture (`6×len ≥ actual UTF-8 bytes`; ratio ≈ 2.5× for multibyte).
- Max actual persisted bytes observed across all cases: Assign 11 417 B, `$ctx` 11 409 B, combined persistent variables 13 196 B, state Output 14 834 B — all far below the adopted caps (`ctxBytes` 196 608, `outputBytes` 131 072) and the 256 KB Step Functions Standard per-state payload ceiling. `commitCtx` (expressions.mjs:20) guards the whole proposed context with a compact fallback; the compact fallback sets `'current':null` by design. Owned-ledger records (workflow.mjs:32 `ownedRecord`) embed no `initial`/`terminalTask` objects — the "no duplicate raw/initial/current/terminal objects" claim holds.

## Findings by priority

No blocking source defect. Two owner-decision observations:

1. **LOW — unknown additional attachment type is tolerated, not contradictory.** `attachmentsCompatible` (expressions.mjs:54) requires exactly one `ElasticNetworkInterface` attachment with matching id/subnet/private-address detail, but does not reject *additional* non-ENI attachments; `attachmentsContradictory` (expressions.mjs:59) fires only when the ENI structure is not compatible/pending/absent. Result: `[ENI-ok, {type:'SomethingElse'}]` classifies as compatible and does not fail qualification (reproduced: R-attachment-extra-type-tolerated → `STOPPED_CONFIRMED`, qual RUNTIME_CHECKS_ONLY). Impact is low because ownership still requires this run's exact tags, `startedBy`, definition and creation window, but owner should decide whether an unexpected extra attachment must be contradictory.

2. **INFO — any foreign candidate forces `CLEANUP_UNKNOWN`.** `ForeignOrAmbiguous` sets `hold` (workflow.mjs:81) and `FinalGate` requires `$not($ctx.hold)` (workflow.mjs:126). The RUNNING/STOPPED `ListTasks` inventories (workflow.mjs:64, modes 1–2) sweep the whole cluster, so any unrelated task in the cluster yields `hold` and the verdict is `CLEANUP_UNKNOWN` even when every positively-owned task is confidently STOPPED (reproduced: R-foreign-never-stopped; matches author's six-owned-plus-foreign). This is conservative and honest (it blocks the next admission) rather than a defect, but it means `STOPPED_CONFIRMED` is reachable only when the cluster contains no other swept tasks — worth confirming as intended.

## Limitations (unqualified; source-level only)

- Local before-write bounds and Catch paths cannot guarantee `finally`/physical cleanup: a service result/payload/runtime failure, `StopExecution`, payload/history limit or outage can occur **before** any user expression or Catch projects it.
- `6 × $length($string(...))` is a conservative source-level predicate; actual persisted bytes are far lower. Adopted caps sit below the documented 256 KB Standard per-state payload ceiling, but actual workflow-variable persistence limits and exact wire JSONata `$string` semantics are unqualified.
- AWS Task transport retries are not proven absent merely because the ASL has no Retry.
- Actual Step Functions ASL validation/TestState, SDK wire casing/Context, expression/error/timeout behaviour, IAM condition/key support, real tag propagation (incl. current-tag StopTask condition), managed-service survival under controller kill, log/artifact reconstruction, physical cleanup and native SDK/Office probes remain later live gates. Linux platformVersion 1.4.0's managed patch revision is not pinnable.

## Module boundary assessment (focused modules / no godfiles)

Cohesive and single-responsibility: `app.mjs` (5 lines, pure re-export), `binding.mjs` (static pins + admission/evidence ingress bounds), `expressions.mjs` (JSONata helpers, predicates, three-way classifier, compact projections, bounded write), `workflow.mjs` (finite Standard ASL graph), `infrastructure.mjs` (IAM role + Standard state-machine template). Contracts are explicit (exported builders; `isCompiledBinding` guard; frozen binding). No generic framework or quota imposed. No `finally`, Retry, Map or Parallel; explicit `CLEANUP_UNKNOWN` on `FinalUnknown`.

## Status

- Source-level PASS within the reviewed scope; the four owner findings from the repair brief are implemented and independently reproduced. No AWS/network/native-SDK/Office/browser/Docker/provider/install/deploy/push/amend and no source/test/README/author-report edit occurred; only the new review report was added under `docs/coordination/reports/`.
- Service/live gates: NOT RUN. `SOURCE_PREPARATION` only — not native, security, G1 or release acceptance. Codex owner independently verifies and owns acceptance.
