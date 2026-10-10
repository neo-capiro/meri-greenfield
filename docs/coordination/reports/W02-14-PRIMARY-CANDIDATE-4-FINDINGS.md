# W02-14 candidate 4: primary verification findings

Codex independently inspected closed candidate `c0623278707b033beec8e4e4640324d0fb3df9a1`. **UNACCEPTED.** The previous two nested-detail failures are repaired, and actual SDK:1/Office:1 records compile inertly, but further validation and classification failures remain. No source integration, deployment, native run, security waiver or gate promotion follows.

Actual author session `20261010_001742_5efe2a`, phase 4, ran 05:15:41.591362–05:25:21.704963Z at most 40 turns/1800 seconds. It closed exit 0, empty process tree, finished readers, confirmed cleanup, no capture/cleanup errors and clean tracked worktree. Six of nine allocated paths changed. The new pure task-definition validator is a focused module, independent of binding internals; the entry remains small. Source organization does not establish behavior.

All nine allocated raw files matched exact Git bytes before and after primary checks. Owner preserved source, closure and every private phase-4 evidence file in `.task-inputs/W02-14-owner-candidate-snapshot-4/`, manifest SHA256 `0233676faeabb3c33d217ca9d5ca921d72217e6dbe3653e4e52cfd742206c567`. Validator SHA256 is `8348de2677c32423461319d51e303faaf688c5deb0441248953695b59d1447cf`; expressions `bdb6cd531774b2b27283e71cc79734f52dbf07de742f18194cef6a83ebccc91b`; binding `a14cea09763f44cd727857b2031700b4cadc9f9b53ba049e3b0ba237207db007`. All other pins are in the manifest.

## Primary checks

The owner ran three independent local processes once at 05:31:38.870533–05:31:45.661641Z, bounded to 60/60/120 seconds. Evidence is retained in `C:/dev/main/meri-greenfield-worktrees/w02-native-enforcement/.task-inputs/W02-14-primary-checks-4/`. No AWS calls or native execution occurred.

| Check | Result | Captured stdout SHA256 |
| --- | --- | --- |
| Canonical Node suite | 34 PASS, exit 0 | `c82ffe6cacb178b9d69c9460138e5cfbf6c9aba0a231a8e9ee508f2e8aecdbaa` |
| Owner actual-definition mutations | 103 PASS / 5 FAIL of 108, exit 1 | `e163af01d214f6d0780331f97606da70e8920204e83384a77f5a74b71f020ce1` |
| Extended actual JSONata replay/probes | 46 PASS / 4 FAIL of 50, exit 1; 293 expressions parsed, 163,555 evaluations | `97f716cda3c450c7d21d90282fdde8bc356ad02be1a9218b28129cd905b95e7a` |

The mutation script uses exact cached SDK/Office task-definition bodies, other synthetic authority and `executeAdmitted:true`; successful structural compilation still yields `runtimeEnabled:false`. It checks input immutability and exact raw definition retention. Both actual records and uniquely reordered volumes/environment/mounts pass; unknown top-level/container/Linux/logging fields, nonempty/null/wrong-type neutral defaults, duplicate keys and critical role/image/revision/security/resource/command drift reject. Five cases wrongly pass:

- `ephemeralStorage:{sizeInGiB:50,unexpected:{enabled:true}}`.
- An unknown key in a `requiresAttributes` entry.
- Wrong types for optional attribute `value`, `targetId` and `targetType`.

The validator checks the storage size and attribute name without checking these nested schemas. Full-record retention/hashing does not reject them later. A separate read-only source reviewer independently identified the same two subtree gaps. These violate the declared fail-closed validation policy; they do not demonstrate a privilege escalation or inconsistency in the registered AWS definitions. AWS documents the storage object's sole field and the attribute's required name plus optional string fields. [EphemeralStorage](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_EphemeralStorage.html), [Attribute](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Attribute.html).

The composed replay preserves the author's 30 traces/five probes and adds owner cases. The two earlier malformed-details/ATTACHED-empty regressions now pass. Three independent negative controls correctly reject oversized Task Output, Catch Output and accumulated persistent variables before application. Seven selected real guard-predicate cases pass, including matching context, wrong execution/machine, stale/future time, extra key and binding mismatch. These evaluate a private expression with only the inert `false and` conjunct removed; the production graph remains unchanged and refusing. This is local predicate evidence, not runtime admission.

Two missing-optional-details cases are incorrectly sticky FAILED despite later compatible observations: well-typed ENI `ATTACHING` without a `details` property, and `DELETED` without that property. ECS declares details optional. Present malformed details must remain contradictory; legitimate pending/teardown absence must remain inconclusive. The DELETED synthetic sequence establishes classifier behavior, not a claim that AWS emits that exact running-task sequence. [Attachment](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_Attachment.html).

## Stronger network-change witness and fixture qualification

The initial two pending-change cases use `['ok','pendingWrongId','ok']` and its IP counterpart. Their first good response is RunTask, which retains launch identity without validating its ENI; their first candidate observation is pending. The fixture's private expected ENI/IP is not authority. Preserve these two failures, but do not count them as decisive proof of a contradiction after validated network binding. A separate read-only reviewer confirmed this sequencing limitation.

The owner therefore ran a separate new two-case witness, without repeating unchanged cases, at 05:33:12.133481–05:33:12.789235Z. `['ok','ok','pendingWrongId','ok']` and the IP counterpart both establish `DescribeENI → RetainENI` first (path index 54), then introduce present changed values under ATTACHING (first NetworkUnknown index 96). Both finish STOPPED_CONFIRMED with one scoped stop, but qualification incorrectly remains `RUNTIME_CHECKS_ONLY_NOT_NATIVE_ACCEPTED`. This replay is **0 PASS / 2 FAIL**, exit 1, 16,838 actual JSONata evaluations. Script SHA256 `7b540b4399d1f316189c61d5703e87948790dd0e437e98e5b880a18d7ee454a1`; stdout `531f606613898d1d022b86cab0a80dc4573fcd6e12e6ca74b61b3bdd8e5ba407`. Retained files: `network-after-good.mjs`, `owner-network-result-1.json`, `network-invocation.json`, `network.stdout.txt`.

Source retains only `qualifiedSeen` per owned task, while the current ENI facts are overwritten by NetworkUnknown. A sound integration requirement is to retain the first positively validated per-task ENI/IP facts and treat subsequent present conflicting values as sticky failure, even under a pending/teardown status. Legitimate absence stays inconclusive, and qualification never erases positive task stop ownership. This is a synthetic regression requirement, not live service evidence or a new authority source.

## Evidence qualifications and next gate

Owner definition/result hashes are `302f1228da9acf5586c40d1f1bb423f11baac9c398e2f95fa920007bf1ddba2a` and `8b759c3bf8de560656e6625ba40118ce58851986dec61eaedb82662b5a4740d8`; primary trace harness `62dd00bdf771ac871f5bc250cc57aa01201740fdfab7c279b586e0f637f61542`. The retained JSONata 2.0.6 runtime is integrity-verified; no eval/parse/hash/partition extensions are added. Synthetic clock/AWS fixtures and post-admission state injection remain explicit.

Phase 4 improved before-application measurements, but its fallback probe uses empty positive ledgers and an oversized, out-of-contract 40,000-character token. It does not prove the maximal legal fallback/combined output bound. The author report's statement that broad npm check was not replayed conflicts with retained phase-4 `npm-check.out`, which contains repeated missing-ajv failures. No install occurred; owner did not repeat the unchanged broad check. Preserve this report qualification and all prior failures.

A new distinct actual Hermes review 2 is RUNNING on exact `c062327` in `w02-native-enforcement-review-2`, start 05:28:42.345467Z/PID 43564, max 40 turns/1800 seconds, only new review report allocated. Query SHA256 `1ea38ca54f4921ee66a4fc49a24dbc0c94f89d014a2de60d4a8730bcf1dff964`. It cannot override primary failures. Any repair requires another exact-commit review and relevant independent owner verification.

After inspecting the closed process, clean exact candidate and all nine byte pins, the owner allocated a NEW actual bounded implementation session for phase 5. It started 05:37:06.405992Z/PID 42084 from `c062327`, owns the same nine paths and is limited to 30 turns/1200 seconds with the final eight turns reserved for relevant checks/report/scoped commit. Query SHA256 `e7224b127f07381e5e3aedf2dc37ec601986950cde1e50c3582b0a87837e2282`; input manifest `4da8726f6224542fee8b40a15f9c5e8e9d8ea4b431062cb950b7417fb7ad4b4e`. This session addresses nested schemas, legitimate absence and retained per-task network facts; it remains RUNNING/UNACCEPTED. Review 2 remains separately pinned to `c062327`; any new repair needs its own distinct actual review.

Actual ASL validation/TestState, wire casing/Context/error/deadline behavior, IAM/tag conditions, survival under controller kill, physical cleanup, security disposition and native SDK/Office/browser gates remain open. Registered definitions alone grant no runtime admission. G1 OPEN; current Meri untouched; paid Bedrock inference $0/$10; no cutover.
