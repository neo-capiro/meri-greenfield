# W02-14 implementation2: closed partial and explicit follow-up

Codex integration owner, 10 October 2026 UTC. **PARTIAL, UNACCEPTED; no reviewable commit.** Actual installed Hermes session `20261010_001742_5efe2a` ran04:17:40.436910–04:38:32.308437Z from clean `b734521ec05c131dea765c8f23604d7c0c9953e4`, reaching its40-turn cap within1800seconds. It exited0, but exit is not acceptance. Process-tree absence, finished readers and cleanup were confirmed with zero errors. Four allocated focused modules are dirty; no other tracked path changed. Canonical tests, README, report and commit were unfinished.

The owner read all four changed modules and the complete private harness, inspected closure and owned-only changes, and preserved all eight allocated files plus private harness/result sources, diff and closure under `.task-inputs/W02-14-owner-partial-snapshot-2/` before further writes. No source was integrated or deployed. The original rejected e6207d7, Codex partial b734521 and all earlier failures remain.

## Actual retained checks and findings

The private harness uses integrity-verified JSONata2.0.6 and actual generated expressions, with synthetic post-admission state, clock, AWS responses and scheduling. It is not an AWS emulator or IAM/cleanup proof. Its retained result contains293 syntax parses,111,906 expression evaluations and **19 PASS / 3 FAIL of22**. The author's footer incorrectly says18/22 and four failures. All five source hashes match the closed partial. Result SHA256 `779f83a322481f1d3862239fd2fad712a611a6bf2eefbe4c4ea130d8d99e0cea`.

| Case / source issue | Owner disposition |
| --- | --- |
| ASCII and multibyte `bytes-below` fixtures | Both end UNKNOWN with zero stops. Their4000-character padding plus full task/envelope fields crosses the adopted conservative `6 × serialized length ≤32768` predicate. Measure genuine adjacent boundaries; retain these failures rather than weakening ownership. |
| Six owned tasks plus foreign task | All six owned stop attempts occur; no foreign stop occurs. UNKNOWN is consistent with the existing sticky foreign/ambiguous hold. Correct the fixture expectation; owner does not relax that policy. |
| Fake ENI identity collision | Zero-padded small task IDs truncated from the left produce identical ENIs; the first-match fake lookup returns task1's IP for other tasks. Fix the new fixture identity generation before interpreting multi-task network results. |
| Persistent bounds | Task raw projection is bounded, but the Pass helper still commits merged ctx without a proposed-write guard; record outputs have no guard and LoopGate observes size afterward. Aggregate escaped/multibyte static references also lack a total ingress bound. This original repair is incomplete. |
| Present wrong-type attachments | The contradictory classifier requires an array. Malformed present non-arrays can become transient NetworkUnknown without sticky failure. Add valid→wrong-type→valid coverage and correct the classifier. |
| Harness coverage | Starts at Initialize rather than GuardInput; measures individual assignment objects instead of total retained variables; Task/Catch output assertions are incomplete. These limits remain explicit. |

Separate read-only Codex inspection corroborated those findings without executing or changing the candidate. Passing fixture traces do not prove all boundary writes, service-supported JSONata semantics, actual wire/context/IAM behavior, managed survival or physical cleanup.

## Explicit phase3 allocation

After this inspection, the owner explicitly resumed the authenticated same session with a new hash-bound brief; this is not automatic continuation. Phase3 started04:44:28.153706Z, PID46684, at most40turns/1800seconds. Original pinned base remains b734521; only the same eight allocated paths may change. New private scratch is `.task-inputs/W02-14-hermes-repair-3/`; phase2 evidence remains immutable. Query SHA256 `ab7973894b3d66ebbcd7f1101294df9a0bd05697b22ed0ade14a1bd943a74dee`.

The narrower follow-up must finish proposed Assign/record/final UTF8 bounds while preserving compact positive containment identities; measure complete ASCII/multibyte, error, token, candidate and static-reference limits; fix synthetic ENI identities; retain conservative foreign UNKNOWN; make present malformed attachments sticky; and complete meaningful tests/report/scoped commit. It must reserve its final eight turns for checks and closeout, returning an honest partial commit if still unfinished. No generic framework, dependency, resource, IAM broadening or compute-placement change is allocated.

One RunTask, one stop attempt per exact bound identity, original t0/D720s/C900s, clipped calls, finite overflow/discovery, real ENI/STS preparation and narrow current-tag StopTask conditions remain. Out-of-band tag/authority changes can prevent stop; original ledger evidence cannot bypass live IAM. Service payload/runtime failures may precede projection or catch and remain a physical-cleanup limitation. Distinct actual exact-commit review, primary verification and service validation precede deployment; no image, native run, security waiver, G1 pass or cutover is granted.
