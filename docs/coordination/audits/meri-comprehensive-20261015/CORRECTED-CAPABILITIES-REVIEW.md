# P2a capability-policy re-review

Reviewed 15 October 2026. Read-only independent review of `neo-capiro/meri-greenfield`.

## Decision

**Overall source: HOLD. Contract freeze: HOLD. Live sandbox, integration and release: UNQUALIFIED / HOLD.**

The original hook-latch and implicit-Bash defects have narrow source acceptance. The plugin fix closes the reported `/./`, existing-directory aliases and foreign-fragment injection, but still has an ENOENT/symlink-parent boundary hole. The new readiness check can issue an available attestation despite observed contradictory SDK evidence. Those two bounded source repairs remain with Fable.

The separately versioned telemetry receiver is the preferred architectural direction; that is **proposal-direction acceptance only**, not schema/receiver freeze or activation approval. Preserve UIEvent 0.1.0 unchanged.

## Exact identities and scope

- Reviewed branch: `fable/p2a-capability-policy-sandbox-20261015`.
- Head resolved through the GitHub connector, including a branch-ref fetch: [`ff52b9ea0cfb5c0280ea95baea6396554a6eed7d`](https://github.com/neo-capiro/meri-greenfield/commit/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d).
- Original HOLD pin: [`6d9bb391005f73c8be6ec636c346a05381b5bd98`](https://github.com/neo-capiro/meri-greenfield/commit/6d9bb391005f73c8be6ec636c346a05381b5bd98).
- GitHub compare reports head ahead by seven commits, behind by zero, with the original pin as merge base. The net delta has 25 files, all under `apps/worker/conversation/**` except its lane report. No net Dockerfile, contract, lockfile, migration or deployment change.
- [Original P1a HOLD](https://github.com/neo-capiro/meri-greenfield/blob/7606375dd30bafcde2a6a002efffbcf1c311bc66/docs/coordination/reports/DOT-REVIEW-FABLE-P1A-6d9bb391-20261015.md) and [comprehensive audit](https://github.com/neo-capiro/meri-greenfield/blob/82a015083f1965851ffddbc05d4f181bb90ecac2/docs/coordination/audits/meri-comprehensive-20261015/README.md) remain the baseline for issues beyond this delta.
- Applied the repository AGENTS and implementation standards. No implementation edits, source publication, user/remote machine use, package install, image build, model/provider request, AWS or deployment action.
- Materialized 93 source/evidence files through GitHub and verified their local bytes against Git blob SHA-1 values. This is a selected source snapshot, not a complete checkout.
- Probes ran on the reviewer's local cloud filesystem with Node v24.19.0. Fable's reported suite runs used Node v24.21.0.

## Source findings requiring repair

### P2a-R1 — HOLD: readiness can attest available after contrary SDK results

**Severity:** source acceptance blocker for the new Bash-readiness admission path. This is a deterministic injected-port counterexample, not evidence that the installed SDK actually produced these results or that a real sandbox was bypassed.

[readiness.mjs lines 43–64](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/worker/conversation/sandbox-readiness/readiness.mjs#L43-L64) retains only result frames where `is_error !== false`. It then checks model turns and cost from that retained error result only. A successful result reporting usage is ignored. Separately, once `initializationResult()` wins the race, `outcome.status` remains `ready`; a later error result or iterator failure observed during consumption is not reconciled into that verdict.

The unchanged orchestration was exercised with scripted ports:

1. Initialization resolves, then a success result reports `num_turns:1`, `total_cost_usd:0.01`, `is_error:false`.
   - Actual result: `ready:true`, `sdkStartup.modelTurns:0`, one observed message.
   - `toBashSandboxAttestation` produces `available:true`.
2. Initialization resolves first, then the consumer observes an `error_during_execution` result with “Sandbox required but unavailable”, zero turns and zero cost.
   - Actual result: `ready:true`, one observed message, `available:true`.
3. A clean initialized stream with no result is the positive scripted control.

The erroneous `ready` value is promoted directly at [lines 75–86](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/worker/conversation/sandbox-readiness/readiness.mjs#L75-L86); available attestations admit Bash at [bash-sandbox.mjs lines 27–36](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/worker/conversation/capabilities/bash-sandbox.mjs#L27-L36).

**Required correction:** accumulate and validate every observed result/usage frame, reject any observed model turn/cost, and reconcile startup errors/consumer failures before issuing the final readiness result. Define deliberate shutdown/cancellation separately from unexpected startup failure. Add regressions for both race orderings, success usage, multiple results and cleanup failures. No live model call is needed to test these cases.

### P2a-R2 — HOLD: missing workspace beneath a symlinked parent bypasses plugin disjointness

**Severity:** remaining source boundary hole; exploitability depends on runtime preparation accepting a nonexistent workspace under an aliased parent. No deployed exploitation was attempted.

The new plugin validator correctly requires the plugin itself to equal its realpath and rejects symlinks within its tree. However, [skill-plugin.mjs lines 15–17](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/worker/conversation/capabilities/skill-plugin.mjs#L15-L17) returns the original workspace string on ENOENT, based on the incorrect premise that a missing workspace cannot contain an alias. Its existing parent can be a symlink.

Filesystem probe:

- Create canonical directory `root/plugin`.
- Create `root/workspace-alias` as a symlink to `root/plugin`.
- Leave `root/workspace-alias/missing-conversation` nonexistent.
- Call `assertSkillPluginDirectory(root/plugin, root/workspace-alias/missing-conversation)`.
- **Actual: accepted.** The prospective real workspace is a descendant of the plugin, contrary to the validator's stated disjointness requirement.
- Controls: canonical disjoint directories accepted; plugin `/./` spelling rejected; an existing workspace alias resolving into the plugin rejected.

The disjointness check at [lines 28–33](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/worker/conversation/capabilities/skill-plugin.mjs#L28-L33) compares the fallback lexical workspace string. `assertWorkspaceRoot` is textual/canonical-by-`resolve`, not a filesystem realpath/existence proof.

**Required correction:** fail closed when the prepared workspace does not exist, or resolve the nearest existing ancestor and safely reconstruct/validate the missing suffix. Test missing leaves beneath aliased parents in both ancestor/descendant directions. Preserve the canonical trusted runtime-path equality in options.

## Narrow repairs accepted and their limits

### Hook failure latching — source ACCEPT for the reported defect

[hooks.mjs lines 17–18](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/worker/conversation/capabilities/hooks.mjs#L17-L18) now routes projection and publication exceptions through a mandatory latch. [index.mjs lines 26–32](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/worker/conversation/capabilities/index.mjs#L26-L32) shares the failure with `check()` and prevents later event publication. Subagent admission/release validation also receives the latch.

[activity.mjs lines 47–57](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/worker/conversation/activity.mjs#L47-L57) checks before consuming subsequent frames, emitting text and entering completion. The added activity tests cover malformed projections, post-tool, compaction, lifecycle and Agent paths.

The independent narrow probe of malformed PreToolUse input now denies the tool, publishes no event and makes `check()` throw `CAPABILITY_HOOK_FAILED`. This closes the original reproduced missing-latch mechanism. It does not independently qualify real hook ordering, checkpoint interleavings or the full activity suite.

### Trusted plugin path — partial source ACCEPT

The original literal `/./` bypass, symlink aliases to existing workspaces, symlinked plugin parents and injected foreign-fragment location are corrected by [skill-plugin.mjs lines 28–34](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/worker/conversation/capabilities/skill-plugin.mjs#L28-L34) and [options.mjs lines 35–37](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/worker/conversation/options.mjs#L35-L37). Tests bind a fragment to the exact trusted prepared path and reject missing/mismatched facts.

P2a-R2 prevents complete acceptance of the path repair. In addition, the checker does not prove an immutable mount, ownership, original file hashes or resistance to concurrent mutation. The trusted runtime preparation/image owner still must establish those properties; a canonical path alone is not immutable-image evidence.

### Explicit Bash policy — source ACCEPT for eligibility separation

[policy.mjs lines 9–15](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/worker/conversation/capabilities/policy.mjs#L9-L15) removes Bash from the workspace file-tool catalog and gives it its own default-false flag. [index.mjs lines 23–25](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/worker/conversation/capabilities/index.mjs#L23-L25) removes Bash from the applied policy when admission fails. The independent `workspaceTools:true` probe with an available attestation still yielded only Read/Write/Edit/Glob/Grep and `bashAdmitted:false`.

Sandbox settings, restrictive parent-tier locks and subprocess scrub are enforced by the fragment validators. Subagents never receive Bash. These are source configuration checks, not an attestation of runtime sandbox behavior. P2a-R1 blocks acceptance of the new readiness producer.

### Pure policy resolver — source ACCEPT, integration unqualified

Independently ran the unchanged [policy-resolution tests](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/worker/conversation/test/policy-resolution.test.mjs): **8/8 pass**. They cover defaults, tenant and role ceilings, widening rejection, empty intersections, wildcard domain intersections, determinism and idempotence.

Accept the pure resolver's reviewed behavior. Core's versioned storage, trusted role lookup, authorization at save/run creation/resume, and delivery beside the closed Run contract are still proposals/integration work. These tests do not establish trusted live policy delivery.

## Contract proposal disposition

**Accept the separate-receiver direction; HOLD exact contract freeze and receiver activation.**

The [amended proposal lines 159–189](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/docs/coordination/reports/FABLE-CAPABILITY-POLICY-SANDBOX-20261015.md#L159-L189) correctly identifies UIEvent 0.1.0 as closed and proposes an independent capability telemetry cursor. That avoids silently broadening the UI event union or breaking UI replay.

Freeze blockers to resolve with the contract/control owner:

1. **Unambiguous digest bytes and missing-field semantics.** The proposal says RFC 8785 canonical JSON, then says error/summary digests are over the UTF-8 string value, and says absent fields hash null. Current hooks use `canonicalSha256(string)`, which hashes the JSON string representation including quotes/escaping. Missing `compact_summary` is normalized to `''`, not null ([hooks lines 29–37](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/worker/conversation/capabilities/hooks.mjs#L29-L37)). Independent projection probes confirm both. Pick one precise rule and freeze test vectors for empty, absent, null, escaping and Unicode. Do not silently treat a malformed required SDK field as a valid empty summary.
2. **Full closed bounds.** Specify the same bounded `agentId`/`agentType` semantics across audit, compaction and lifecycle variants, maximum safe-integer sequence and exact timestamp form. Current worker metadata validation is not yet the proposed receiver schema. Define how the 1 KiB total-event bound interacts with maximum RunBinding/name lengths and reject oversize content before persistence without retaining raw diagnostics.
3. **Cursor/idempotency/fencing transaction.** Define the sequence allocator/serialization owner, atomic uniqueness and gap checks under concurrent hooks, idempotent duplicate handling after terminalization, and resume behavior across new attempt/worker/fence bindings. A blanket “events after terminal refused” must be reconciled with “identical telemetryId accepted idempotently”. Specify revocation/current-fence checks and trusted audit-read authorization/retention.
4. **Receiver and worker adapter are unimplemented.** The current composer still calls `runOwner.append` using `eventId` and without the proposed telemetry contractVersion/telemetryId/sequence ([index lines 30–32](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/worker/conversation/capabilities/index.mjs#L30-L32)). [control service line 57](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/control/conversations/service.mjs#L57) still permits only run.status and message.delta. This is intentionally fail-closed today, not a completed telemetry integration.

Telemetry remains worker-attested correlation data, not authority, billing, source evidence or checkpoint proof. No raw tool arguments, output, error, summary or transcript paths should enter this receiver. No UIEvent schema expansion is accepted by this review.

## Exclusion guard, Dockerfile and proof records

- The [43-name exclusion guard](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/worker/conversation/test/legacy-tools-excluded.test.mjs#L1-L48) is present and checks catalog dispositions/replacements, operation names/aliases, original manifests, operation resolution and assembled SDK surfaces. Accept this as useful source regression coverage. This reviewer inspected but did not run that full dependency-heavy test file. It is not proof against every future implementation or a product browser surface absent from this branch.
- Dockerfile head/base content and blob SHA match exactly: `70b24ee8e1794ab86ae843171710cc4701ee5714`. UIEvent schema head/base blob also matches: `d7b3c22491ae81c5e875243754413aa7d35097e3`.
- Independently ran [assembled-image source-proof.test.mjs](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/scripts/qualification/assembled-image/source-proof.test.mjs): **5/5 pass** after exact-byte materialization, including the CRLF historical source manifest.
- Initial reviewer materialization added a terminal newline and normalized that historical manifest's CRLF; resulting proof failures were local reconstruction artifacts. Those were diagnosed against Git blob SHA-1, corrected without changing repository source, and the full five-test proof passed. No source failure is attributed to those preliminary runs.
- Fable's report [line 200](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/docs/coordination/reports/FABLE-CAPABILITY-POLICY-SANDBOX-20261015.md#L200) correctly records the revert and 5/5. Its later checks item still says 4/5, and an integration item still suggests dropping the already-reverted recipe commit. Update those stale summaries in the next report.
- Bubblewrap/socat remain a proposal for the image/candidate owner. Source proof is not image construction, package closure, provenance, host namespace or actual sandbox evidence.

## Verification ledger and retained limits

| Check | Independent result |
| --- | --- |
| Full branch SHA and ancestry | Verified exact head; ahead 7, behind 0 |
| 93 materialized source/evidence files | Verified against Git blob SHA-1 |
| Pure policy-resolution suite | 8/8 pass |
| Assembled-image source-proof suite | 5/5 pass |
| Readiness clean/control and two contradictory-result cases | Both counterexamples reproduced |
| Canonical plugin and existing alias controls | Behaved as intended |
| Missing workspace/symlink-parent plugin case | Boundary hole reproduced |
| Hook projection latch and explicit Bash separation | Original narrow failures corrected |
| Digest projection comparison | Proposal/source mismatch reproduced |
| Fable 103 conversation / 60 skill / 82 continuation+skill counts | Report inspected; not independently rerun here |
| SDK types/bundled CLI implementation | Not independently installed/exercised by this review |
| Real no-model startup, real sandboxed command, namespace host, environment scrub, metadata/egress denial, symlink permission matching, /proc exposure | UNRUN by this reviewer |
| Docker image/closure, Fargate or dedicated-host qualification, deployment | UNRUN / unauthorized |

The isolated readiness/boundary probes load unchanged source and injected ports. To avoid installing dependencies, their loader substitutes the contract hashing/validation module with a plain-JSON hash oracle (and a no-op shape validator where needed), and substitutes unused skill-catalog lookup for path-only tests. Their conclusions are control-flow/path/digest-shape counterexamples, not contract-validator or SDK integration passes. The two independent repository test suites above use their actual materialized dependencies and Node built-ins.

Evidence saved beside this report:
- `/workspace/shared/p2a-review/github-blobs.json`
- `policy-resolution-result.txt`, `source-proof-result.txt`
- `reviewer-readiness-probe.mjs`, `readiness-probe-result.json`
- `reviewer-boundary-probe.mjs`, `boundary-probe-result.json`

## Next bounded acceptance step

Fable should return a new pin fixing P2a-R1 and P2a-R2 with focused regressions and corrected proposal/report semantics. Re-run these negatives and affected source suites against that exact pin. Keep the receiver, Core policy storage and trusted runtime preparation changes under their owners' review.

Do not infer sandbox success from this source, initialization-only readiness, an available boolean or source-proof pass. The weaker nested mode explicitly leaves host /proc exposed and depends on an independently accepted disposable outer boundary; the boolean alone is not qualification. Any execution-placement change, real synthetic model budget, image build or live activation needs its existing authorization and exact-candidate evidence. The comprehensive audit's other product/release HOLD findings remain unchanged.

