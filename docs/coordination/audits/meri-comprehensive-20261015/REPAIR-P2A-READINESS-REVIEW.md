# P2a readiness/plugin successor re-review

Reviewed 15 October 2026. Bounded read-only successor review against `ff52b9ea0cfb5c0280ea95baea6396554a6eed7d`.

## Decision

**ACCEPT the reviewed source corrections at `743ae3700751e25947702ce5672b0978c27cc23a`.** P2a-R1 and P2a-R2 are closed in the source mechanisms and retained counterexamples reviewed here. The required-summary/error-field repair is also accepted as a local worker correction. No new source blocker was found in this bounded delta.

**Contract freeze remains HOLD. Product integration, real sandbox qualification and release remain UNQUALIFIED / HOLD.** Source acceptance does not authorize capability activation, a model call, an image build, placement changes, migration execution or deployment.

## Identity and scope

- [Exact reviewed commit](https://github.com/neo-capiro/meri-greenfield/commit/743ae3700751e25947702ce5672b0978c27cc23a).
- Branch `fable/p2a-r-readiness-plugin-20261015` independently resolves to that same SHA.
- GitHub comparison: four commits ahead of the prior reviewed pin, zero behind; prior pin is the merge base.
- Thirteen changed files: twelve under `apps/worker/conversation/**` and the lane report. No contracts, control receiver, migrations, lockfiles, Dockerfile or deployment files changed.
- Preserved the previous review snapshot and probes; created a separate local successor snapshot. Its 96 selected source/evidence files match their Git blob SHA-1 identities. Unchanged files were inherited from the verified prior snapshot and checked against the complete compare-file list; the thirteen changed files were fetched at the successor SHA and verified byte-exact.
- No implementation edits, further delegation, package installation, user/remote machine work, SDK process, provider/model request, cloud infrastructure action or image build. Local synthetic checks used Node v24.19.0.
- This report supersedes only the two source findings and associated digest ambiguity covered below. The comprehensive audit's unrelated findings remain unchanged.

## P2a-R1: readiness contradictions — source ACCEPT

The new [startup-observation.mjs lines 28–74](https://github.com/neo-capiro/meri-greenfield/blob/743ae3700751e25947702ce5672b0978c27cc23a/apps/worker/conversation/sandbox-readiness/startup-observation.mjs#L28-L74) accounts for every received frame, accumulates usage from all result frames, treats any result as inconsistent with the no-turn readiness session, and retains contrary evidence rather than letting initialization overwrite it. Malformed/unknown/model-activity frames, startup exceptions, unexpected stream termination and shutdown failures each prevent a ready verdict.

[readiness.mjs lines 65–84](https://github.com/neo-capiro/meri-greenfield/blob/743ae3700751e25947702ce5672b0978c27cc23a/apps/worker/conversation/sandbox-readiness/readiness.mjs#L65-L84) consumes the query, observes the post-initialization quiet window, initiates deliberate shutdown, awaits bounded consumer settlement, attempts both temporary-directory removals, then obtains the final verdict. A deliberate post-close AbortError or ordinary stream end is distinguished from unexpected failure. [Attestation lines 105–108](https://github.com/neo-capiro/meri-greenfield/blob/743ae3700751e25947702ce5672b0978c27cc23a/apps/worker/conversation/sandbox-readiness/readiness.mjs#L105-L108) independently requires initialized/clean shutdown, zero results, turns and cost, as well as `report.ready`.

I reran the unchanged retained reviewer probe:

| Retained counterexample | Previous pin | Successor |
| --- | --- | --- |
| Success result with one model turn and $0.01 | ready=true, reported turns=0, available=true | refused, READINESS_MODEL_TURN_OBSERVED, turns=1, cost=0.01, available=false |
| Sandbox-unavailable error arriving after initialization | ready=true, available=true | refused, SANDBOX_UNAVAILABLE, available=false |

The old probe's “clean” fixture immediately ends its iterator without waiting for deliberate close. The successor now correctly refuses that unprompted stream termination with SDK_STREAM_ENDED. It is not a failed positive readiness control. The new repository suite includes genuinely idle, held-open positive streams and verifies their deliberate clean shutdown.

I independently ran the unchanged [sandbox-readiness-verdict.test.mjs](https://github.com/neo-capiro/meri-greenfield/blob/743ae3700751e25947702ce5672b0978c27cc23a/apps/worker/conversation/test/sandbox-readiness-verdict.test.mjs): **11/11 pass**, including:
- held-open positive controls and permitted shutdown AbortError;
- both initialization/result race orderings;
- success/error usage and multiple results;
- result frames during deliberate shutdown;
- iterator failure/unprompted termination;
- malformed, unexpected and model-activity frames;
- close failure, non-abort shutdown error, cleanup timeout and directory-removal failure;
- query startup exception and contradictory attestation inputs.

This suite ran with the review-only hash-dependency seam described in the verification limits. It validates orchestration and verdict behavior, not the installed SDK or a real sandbox.

## P2a-R2: missing workspace/aliased parent — source ACCEPT

[skill-plugin.mjs lines 15–19, 29–38](https://github.com/neo-capiro/meri-greenfield/blob/743ae3700751e25947702ce5672b0978c27cc23a/apps/worker/conversation/capabilities/skill-plugin.mjs#L15-L38) removes the ENOENT lexical fallback. Both workspace and plugin must resolve to existing directories before disjointness is checked.

The retained real-filesystem probe now produces:
- canonical existing disjoint plugin/workspace: accepted;
- plugin spelled with /./: refused;
- existing workspace alias resolving into the plugin: refused;
- missing workspace leaf beneath a parent symlink into the plugin: **refused**, closing the exact prior counterexample.

The added [binding regressions](https://github.com/neo-capiro/meri-greenfield/blob/743ae3700751e25947702ce5672b0978c27cc23a/apps/worker/conversation/test/skill-plugin-binding.test.mjs#L50-L81) cover missing/dangling/file workspaces and the options boundary. Test fixtures now create a real prepared workspace rather than relying on a nonexistent placeholder. That is a legitimate precondition correction, not weakening the containment assertion.

This remains a point-in-time path validation. Immutable mount/ownership, original file bytes and prevention of workspace/plugin swaps remain runtime/image-owner obligations. This review does not claim the actual runtime preparation sequence or immutable plugin loading was exercised.

## Required hook strings and digest wording — local source ACCEPT

[hooks.mjs lines 13–15, 32, 40](https://github.com/neo-capiro/meri-greenfield/blob/743ae3700751e25947702ce5672b0978c27cc23a/apps/worker/conversation/capabilities/hooks.mjs#L13-L40) now requires `error` and `compact_summary` to be strings. Missing, null or non-string values trigger the existing terminal latch and STOP response; a present empty string remains valid. Event shapes are unchanged, and the previously accepted latch is preserved.

Independent focused hook probes exercised undefined, null, numeric, object and array values for each field:
- **10/10 malformed/missing cases refused and latched with no publication**;
- **2/2 present-empty-string controls accepted**.

The unchanged retained boundary probe also continues to show the original malformed PreToolUse latching and explicit Bash eligibility separation working.

[Proposal T1](https://github.com/neo-capiro/meri-greenfield/blob/743ae3700751e25947702ce5672b0978c27cc23a/docs/coordination/reports/FABLE-CAPABILITY-POLICY-SANDBOX-20261015.md#L308-L326) now consistently specifies SHA-256 of JCS bytes, including JSON quotes/escaping for strings, and distinguishes required string fields from unknown-typed input/output fields. The source repair resolves the previous missing-summary normalization mismatch. The new vector suite is useful, but I did not independently rerun its full serializer/Unicode coverage against the actual installed canonicalize dependency.

## T1–T4 proposal disposition

**Retain separate-receiver architectural direction acceptance. Do not freeze the contract or activate telemetry yet.**

The successor [T1–T4 proposals](https://github.com/neo-capiro/meri-greenfield/blob/743ae3700751e25947702ce5672b0978c27cc23a/docs/coordination/reports/FABLE-CAPABILITY-POLICY-SANDBOX-20261015.md#L306-L349) materially improve the prior draft:
- T1 defines exact digest semantics and test vectors.
- T2 proposes consistent identifier/type/duration/time/sequence bounds.
- T3 assigns serialization, transactional cursor/idempotency/fence handling, retry-after-terminal semantics and continuous resume cursors.
- T4 clearly states that the receiver, adapter and storage are unimplemented, with UIEvent 0.1.0 unchanged.

Before exact schema/receiver freeze, resolve these remaining proposal details:
1. **Binding and byte-limit boundary:** T2 excludes RunBinding from bounded persisted bytes, says the request binding must equal the credential binding, and caps the entire request JCS body at 1,024 bytes. Clarify exactly where that binding is transported and which bytes are counted. The older envelope still includes binding. Do not silently make valid maximum-size RunBindings unusable or leave request/persisted envelopes ambiguous.
2. **Finalize the canonical closed schema and implementation:** bounds are still prose; worker metadata is still unbounded until the follow-on adapter is implemented. Independently verify computed maximum sizes and SDK identifier formats before freezing them.
3. **Prove transactional and authorization behavior:** implement and test concurrent publishers, UNKNOWN acknowledgments, duplicate/conflict ordering, expiry/revocation, fence advance, terminalization, resumed attempts and authorized audit reads. T3 is a design proposal, not durable evidence.
4. **Allocate storage/retention and adapter ownership:** the new telemetry port, receiver, migration and retention/purge behavior remain explicit owner work. Current capability events still go to the old append path and fail closed.

No frozen contract or generator pin changed in this delta. The corrected report also fixes the stale source-proof 4/5 summary and the suggestion to drop an already-reverted Dockerfile commit.

## Verification ledger

| Check | Independent outcome |
| --- | --- |
| Full SHA, branch head, ancestry and changed paths | Verified |
| 96 selected source/evidence blobs | Exact Git blob identities verified |
| Retained contradictory SDK-result counterexamples | Both now unavailable |
| Retained missing-workspace/symlink-parent probe | Now refused |
| Readiness verdict suite, injected hash seam | 11/11 pass |
| Pure policy-resolution suite, actual materialized dependencies | 8/8 pass |
| Assembled-image source-proof suite, exact source/manifest bytes | 5/5 pass |
| Required summary/error field probes | 10 negative + 2 positive cases pass |
| Full 120 conversation tests / 82 continuation+skill / 60 packaged-skill tests | Owner report inspected, not independently rerun |
| Installed-SDK startup or canonicalize full Unicode suite | Not independently run here |
| Ready-host sandbox startup, real Bash, credential scrub, egress/metadata denial, /proc exposure, immutable plugin load | UNRUN |
| Image build/closure, native host/Fargate, deployment/release | UNRUN / unauthorized |

### Probe limits

The retained probes and readiness-verdict suite use a loader substitution for the contract hashing dependency to avoid installing Ajv/canonicalize. The seam computes a hash for the plain-JSON fixtures; where the retained boundary harness loads the composer it also substitutes shape validation and unused skill catalog lookup. It does not replace the changed readiness/observation/plugin/hook code. These are control-flow/path/required-field assertions, not contract-validator or SDK integration passes.

The policy-resolution and source-proof suites use actual materialized source dependencies and Node built-ins, without that seam.

The owner reports a real pinned SDK check on its dependency-missing container returning SANDBOX_DEPENDENCIES_MISSING, zero turns/cost and clean shutdown. I did not rerun that SDK process. A successfully initialized SDK on a host with sandbox dependencies and its actual post-close frames remain unmeasured, as the report explicitly acknowledges. No successful actual sandbox is inferred.

## Next bounded step

The two requested source repairs may advance to the coordinator's source-acceptance record at this exact pin. Keep telemetry freeze/integration and live sandbox qualification as separate gates. No further implementation correction is requested by this bounded source review.

Evidence directory: `/workspace/shared/p2a-successor-review/`, including `github-blobs.json`, retained probes/results, `readiness-verdict-result.txt`, `proof-policy-result.txt` and `required-hook-fields-result.txt`. Prior evidence is preserved in `/workspace/shared/p2a-review/`.

