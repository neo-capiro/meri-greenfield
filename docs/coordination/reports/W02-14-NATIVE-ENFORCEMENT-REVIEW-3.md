# W02-14 native enforcement — distinct actual review 3

**Verdict: SOURCE-ONLY REVIEW, UNACCEPTED — review findings and own-case coverage recorded; no gate promoted.**

This is a distinct actual Hermes session `20261010_020520_cc63ab` (not implementation author `20261010_013708_8bdb8f`, not prior reviewers `186e99`/`ba1b1c`). Worktree `C:\dev\main\meri-greenfield-worktrees\w02-native-enforcement-review-3`, branch `review/w02-native-enforcement-3`. Exact base `280a2a222d4443a03e96c7cd3c17571fa4329163`; `git rev-parse HEAD` == base and the tracked tree was clean on inspection. This session was resumed report-only after the prior 25-turn cap consumed the report reserve; the substantive review had already been performed and is recorded below. No source/test/README/prior-report/contract/dependency was edited. The full finite-bound proof (merged variables / every Output / native service gates) is NOT established here; this text repeatedly reflects real limits, not source-edit adjustments.

## Subject pins (independently recomputed)

- `sha256(file)` == `sha256(git show 280a2a2:<file>)` for all nine allocated paths — the working-tree raw bytes are byte-identical to the exact base commit.
- Candidate manifest `.task-inputs/W02-14-review-3-inputs/candidate-manifest.json` SHA256 = `236da74acbaa0f7cc947337bb166e959b72d8f25992f12cc7ab5273c474c382b` (matches brief).
- Retained runtime `C:/dev/main/meri-greenfield-kickoff-20261009/.task-inputs/jsonata-2.0.6-runtime/jsonata.js` SHA256 = `8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b` (hash asserted inside the harness before use).
- Actual cached SDK:1 / Office:1 raw bytes were available to the author under `W02-14-repair-4-inputs` (SDK `40f6b4a70ebf9558dbcb724ab969a332104b85bf97cf181490308f524597f0a0`, Office `355b1beb670a1364ea5d1f53c53042113f09a39bfe274b6406a5d3a9315f598b`); other authority used in scratch is clearly synthetic and the binding remained `runtimeEnabled:false`.

| path | SHA256 (recomputed) | bytes |
|---|---|---|
| infra/native-enforcement/app.mjs | 813a912999253b147d3d88ac50d24fbe7dd063aa98c3453a9e5e825d3fe7f70c | 422 |
| infra/native-enforcement/lib/binding.mjs | a14cea09763f44cd727857b2031700b4cadc9f9b53ba049e3b0ba237207db007 | 7772 |
| infra/native-enforcement/lib/expressions.mjs | e5a1931f3058e02e20bff10faf837b65eac11c226077e9a66d0501d323b4b648 | 12917 |
| infra/native-enforcement/lib/workflow.mjs | 884b11077ae34db9171d2d0aa2609ed3bef5017af47c39a03b0e51787b09ce01 | 22681 |
| infra/native-enforcement/lib/infrastructure.mjs | 6e57537dfbb675a8bc7673e26185cd4df0f769637ac3b783c4cca02681b95ae0 | 3625 |
| infra/native-enforcement/lib/task-definition.mjs | fbe770912afaa119c50a9e1681a691a605b94c8a6f9ebd686e3555ab9e9a36ad | 7965 |
| infra/native-enforcement/README.md | 21e94ca658ace0678821130004e39fd005ff0d032b77bbefcddaef4ec795d998 | 14482 |
| scripts/test-native-enforcement.mjs | 72f18e61e76c2ab5e8f0663a36edfbafdd74bfda346f830ccdefff446fa50630 | 19056 |
| docs/coordination/reports/W02-14-NATIVE-ENFORCEMENT.md | e8b7630a7ac57dfd1693c06074c6691894af3d5bfa8f7510d65de72821a97065 | 8505 |

The c062..280 diff touches exactly: `lib/expressions.mjs` (immutable ENI/IP pins, partition), `lib/task-definition.mjs` (ephemeralStorage exact object + Attribute schema), `lib/workflow.mjs` (netId/netIp ledger init + RetainENI pinning), `scripts/test-native-enforcement.mjs`, `README.md`, prior report. `binding.mjs`, `app.mjs`, `infrastructure.mjs` are unchanged from c062.

## Commands actually run this session (local only; exact exits/counts)

- `node --check` on the seven source/script files: all OK, exit 0.
- `node --test scripts/test-native-enforcement.mjs`: **47 pass / 0 fail**, exit 0 (~0.36 s). (The prior report text says "34"; the changed file now carries 47 cases.)
- Independent reviewer harness `.task-inputs/W02-14-review-3/review3-harness.mjs` (retained JSONata 2.0.6, synthetic clock/AWS/post-admission state injection, inert binding asserted): **75 PASS / 0 FAIL**, exit 0. The intermediate runs before two harness fixes were 68/1 and 73/2 — see "Debugging failures (mine)". This is **75 assertions**, not 75 composed end-to-end traces; coverage is private predicate + field + fallback, not a full graph trace.
- `npm run check` / broad AJV / any install: **NOT run** (preserved pre-existing missing-`ajv` blocker; no install).

For context, the primary/root verification separately reported (not re-run here): 47 canonical / 108 definition-mutation matrix / 47 metadata / 32 classifier passing, plus additional network instrumentation whose *initial* form measured **4 pass / 45** due to a JSONata object-sequence projection detail. Per the brief that instrumentation gap is **NOT a source failure**; it is a **pending repair** and must **not** be claimed PASS.

## Independent evaluation — attachment classification (boundary FIX1)

Predicate-level matrix via the actual `buildPredicates` sources evaluated with JSONata 2.0.6 (exactly one of compatible/pending/contradictory required to hold; absent is a separate partition). All PASS:

- Compatible: valid ENI `ATTACHED`; valid ENI plus an extra `macAddress` detail (must not fail).
- Pending/inconclusive: `ATTACHING` with well-typed details; `ATTACHING` with `details` **omitted** (ECS declares it optional — the prior regression); teardown `DELETED` with `details` omitted.
- Contradictory: `ATTACHED` with empty details; present `details` that are null / a string / a non-array object; a nested entry that is not an object; a non-string nested `value`; duplicate detail names; `ATTACHED` missing the required subnet+IP facts; two ENI attachments; an unsupported extra non-ENI (ServiceConnect) attachment; a pending status that presents a wrong subnet (pending must not hide it).

## Independent evaluation — network immutability and strict identity (boundary FIX1b)

- First validated ENI id / private IPv4 per owned ARN is retained; a later frame presenting a **different** well-typed id or IP is contradictory **even under a pending/teardown status** (never cleared). Absent details stay inconclusive; there is no authority to compare before a positive is retained. Verified against the real `RetainENI` and `commitCtx` expressions.
- Pins never cross-bind: `mapLedger` updates only the entry whose `arn==currentArn`; a second task's first pin preserves the first; an overflow-ledger pin is never overwritten. Structurally, only `RetainENI` writes a pin-preserving `netId`/`netIp` (`$o.netId?$o.netId:…`); `BindOwned`/`BindOverflow` only initialise `netId:null`.
- Strict identity enforced **before every route to RetainENI** (both the compatible gate `attachmentsCompatible` and the EC2-shape gate `eniGood`): ENI id `eni-` + exactly 8 or 17 lowercase hex (<=21 ASCII); dotted IPv4, four octets 0..255 (<=15 ASCII). 8/17-hex accepted; 9/16/22-hex, uppercase and missing-prefix rejected. 0.0.0.0..255.255.255.255 accepted; 256-octet, 3-octet and 5-octet rejected. Malformed identity therefore cannot pin.
- Initial RunTask-good-only is **not** validated network authority: no `netId`/`netIp` write occurs outside `RetainENI`.

## Independent evaluation — task-definition validation (boundary FIX2)

`validateTaskDefinition` exercised directly against an independently constructed definition:

- Accepts the valid record; retains documented Attribute punctuation (slash/backslash names; `@`, `:`, interior-space values) and 1..128 lengths; `targetType` optional and exactly `container-instance`.
- Rejects: unknown Attribute field; numeric/array/object Attribute field types; `@` or `:` in a name; leading/trailing-edge-space, empty, 129-length and newline values; `ephemeralStorage` unknown key; wrong `sizeInGiB`. Caller input stays unmutated and the raw record is retained in the binding.

## Independent evaluation — bounds, fallback and stop scope

- `commitCtx` whole-context guard on an injected oversized context falls back to a compact object that **preserves owned and overflow ledger identities** (arn/netId/netIp/stopAttempted) while setting `hold` + `qualificationFailed` + `overflowed`; `queue` re-seeded from `ctx.direct`.
- `byteBound`/`boundedExpr`: in-bound value kept; oversized value yields the compact `{truncated:true}` fallback.
- The six-times-serialized-length predicate is **distinct from actual UTF8**; a multibyte/astral sample confirmed it is conservative (>= real bytes), i.e. it is a bound, not a UTF8 measurement.
- Stop scope: a single `ecs:stopTask` resource in the graph; once `stopAttempted` is set on an ARN it is removed from the pending stop set (at most one scoped attempt per owned ARN); foreign/ambiguous candidates hold rather than stop.
- Per-ledger pin byte growth measured from a reconstructed ledger record: ~<=30 bytes for a null pair, ~<=60 bytes for a maximum pinned pair, <=600 bytes across ten ledgers (matches the conservative arithmetic reported by the owner).

## Debugging failures (mine) — recorded, not masked

- First harness run crashed (undefined `.overflow[0]`): JSONata **unwraps singleton sequences at the host boundary**, so `$map` over a one-element array returns the bare element, not a one-element array. This is a host-boundary artifact, not a source defect (inside the workflow the value is still an array); I normalised the harness read.
- Two then-failing assertions ("null pin pair serialises 26 bytes", "max pin pair serialises 58 bytes") were my own over-strict exact-byte arithmetic; replaced with a robust per-ledger growth check. One structural assertion was too broad (counted `netId:null` initialisers as writers) and was narrowed. After these fixes: 75/0.

## Limitations (unqualified; source-level only)

- NOT independently proven here: exhaustive finite whole-variable/every-Output maximum bound, merged-variable and every Pass/Task/Catch final Output instrumentation, and real service behaviour. My evidence is predicate-level plus the field/fallback controls and the per-ledger byte growth above. A maximal-legal combined refs/tokens/ledger/escaped-multibyte proof and the out-of-contract 40k-token fallback probe remain NOT a legal-maximum proof.
- The production `GuardInput` positive branch is unreachable in source (`runtimeEnabled` is the literal `false`, so the guard is `false and …`); the positive path is unprovable without a source edit. The selected context predicates can be exercised privately without changing production source. This is local predicate evidence, not runtime admission.
- Actual Step Functions ASL validation/TestState, wire casing/Context/state-entry fields, deadlines/error behaviour, IAM condition/key support, real tag propagation (incl. the current-tag StopTask condition), managed-service survival under controller kill, log/artifact reconstruction, physical cleanup, payload/history limits, and native SDK/Office/browser probes remain unqualified live gates. The prior read-only `ValidateStateMachineDefinition` OK applies **only** to the old c062 graph; the changed final graph needs fresh validation. Linux platformVersion 1.4.0's managed patch revision is not pinnable.
- All harnesses (author, owner, reviewer) are synthetic post-admission state / synthetic AWS fixtures; none is an AWS emulator and none establishes IAM or service acceptance.

## Module boundary assessment (focused modules / no godfiles, no framework or quota)

Cohesive and single-responsibility: `app.mjs` (5-line pure re-export); `binding.mjs` (static pins, admission/evidence ingress bounds, delegates record validation); `task-definition.mjs` (self-contained fail-closed record validator, imported by `binding.mjs`, no cycle); `expressions.mjs` (JSONata helpers, predicates, three-way classifier, compact projections, bounded write); `workflow.mjs` (finite Standard ASL graph); `infrastructure.mjs` (IAM role + Standard machine template, unchanged). Contracts are explicit (`isCompiledBinding` guard, frozen binding, exported builders). The two new/expanded responsibilities (metadata schema; immutable network classification) are separated from expression/workflow/infra without a new framework or imposed quota. No `finally`, Retry, Map or Parallel.

## Status

- Preserved open items: 49 scan findings / 22 severe remain OPEN; Office DEFERRED; G1 OPEN; paid Bedrock inference $0/$10; current Meri untouched; no cutover. Preserve the prior report/apparent broad-check contradiction and the old missing-`ajv` history.
- All source is **UNACCEPTED** pending independent primary verification and the bounds/service gates. This review writes only this one new report; no source/test/README/prior-report edit, no AWS/network/native-SDK/Office/browser/Docker/provider/model/install/build/deploy/push/amend. Codex owner independently verifies and owns acceptance.