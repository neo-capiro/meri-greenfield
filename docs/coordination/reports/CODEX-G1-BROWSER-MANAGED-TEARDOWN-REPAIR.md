# Codex browser managed containment source repair

Codex author completion, 10 October 2026 UTC. Dedicated branch
`fix/g1-browser-managed-containment`, exact base
`3f9bdb2e46ed2627b48a8cab00ee48404309fb24`. The independent BLOCKED review
`d7d182468ad60be326ad1df932379938ffdd75ac` remains unchanged. This report is
author evidence, not another independent review or runtime approval.

Outline recorded before edits: keep binding validation, finite ASL behavior and
IAM assembly separate. Correct root evidence retention in the existing workflow
module, reuse one emitted root-history operation for accumulated scans and fresh
singleton reads, and keep the existing immutable template/authority. Verify
actual emitted JSONata and the byte-identical eight independent controls. No
AWS, TestState, host, browser, Docker, provider, model, dependency or Hermes action.

The repaired source addresses the three sealed findings:

1. `MayTerminate` no longer requires a root ID. Fresh exact singleton ownership,
   permitted instance state, original deadline and attempted-before-dispatch still
   gate the existing one termination task. An owned running host with missing or
   malformed root evidence, including an owned early page followed by a later
   read error, can be contained. Root proof still gates root reads and cleanup;
   these cases remain UNKNOWN, never absence or qualified security success.
2. Reconciliation consumes every valid owned observation of each retained ID,
   rather than only the first row. Scan and direct reads share one emitted
   `retainRoots` expression. The first valid retained root never changes. The
   centrally bound `maxRootIds:20` caps each instance's distinct root history in
   observation order. `rootDrift`, `rootUnknown` and `rootOverflow` are sticky
   through later clean observations. Overflow preserves the original instance
   and root IDs plus the bounded list and overflow flag. IDs beyond the cap are
   not individually retained: raw execution history and owner reconciliation
   remain necessary. This does not promise containment of arbitrary fleets.
3. Qualification now explicitly requires valid root mapping/ID evidence in
   addition to the existing AMI/network/mapping/delete-on-termination checks.
   Valid observations retain accurate `qualified:true,rootUnknown:false`;
   malformed/missing roots fail qualification without removing ownership.

Only four existing source/document paths and this new report change. Binding's
sole change is the finite root-history constant. Workflow keeps the same
43-state/five-EC2-task topology and APIs; the template is raw-byte identical
(`7d756854bf5ca869657fcaa5fa04220e043a217ca48be574b594c4dd49e5642c`).
Original ownership tags/account/window, IAM/trust, t0/D720/C900, clipped calls and
waits, no Retry, one mutation attempt and fresh direct ownership remain.
The original author report is raw-byte identical
(`6f1e0d47fa28be6af1f24a536540129dd431901ac9b9886c71e991526a87805d`).
Assets, host/template loader and shared contracts are untouched.

Final check results are **25/25 canonical PASS and 8/8 sealed controls PASS**.
The six added canonical cases cover missing/malformed/partial roots, duplicate
same-ID observations including a malformed companion, valid-root classification,
cross-scan/direct sticky evidence, capped scan/direct history and late valid-root
retention. Existing 19 cases remain. The sealed script is copied byte-exact:
`f32b62b298d99b7dea7bbd76a4ee9a8f6e5f7547ccb93277f2fbc4b97cf31f0e`.
Its relative import now resolves the repaired compiler in this dedicated
worktree. It performs the same eight facts with actual JSONata2.0.6 evaluation,
5,008 evaluations and a 5,000-transition-per-trace cap. Fake EC2 responses and
clock explicitly start after the inert production guard.

| Retained run | Outcome | UTC start/end | Actual child time |
| --- | --- | --- | --- |
| repair-1 canonical | 25 PASS, exit0; insufficient valid-root assertions | 19:50:44.573429–19:50:47.574502 | 3.000s |
| repair-1 sealed controls | 8 PASS, exit0; output exposed author classification bug | 19:50:47.582535–19:50:48.214899 | 0.625s |
| repair-2 canonical | 25 PASS, exit0; added valid-root assertions | 19:51:15.711896–19:51:19.001368 | 3.282s |
| repair-2 sealed controls | 8 PASS, exit0; accurate retained fields inspected | 19:51:19.010876–19:51:19.638930 | 0.625s |

The first repair used nested JSONata `$` context in root-validity/qualification
filters. Although both suites passed, actual valid duplicate-root facts wrongly
reported `rootUnknown:true,qualified:false`. Author output inspection found this
defect. Explicit `$i` lambda binding fixed it, and valid single/duplicate-root
assertions were added before the justified second run. The first run is retained
without relabeling it as a failing process or a correct implementation. Its five
source files were reconstructed by reversing only the two predicate sites and
new assertions, with README from raw base Git; every reconstructed byte length
and SHA matches its retained pre/post source pins. The reconstruction method is
explicit in `repair-1-source/RECONSTRUCTION.json`. No unchanged retry occurred.

Node24.19.0 SHA
`3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237`
and JSONata2.0.6 SHA
`8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b`
were verified before dispatch and remained stable. All five source/document pins
and the sealed control were stable within each run. README completion prose was
updated after the final execution; behavior/tests did not change afterward.
Children used explicit argv, stdin EOF, shell false, removed ambient
AWS/provider/Node/CDK/JSII/proxy selectors, 60s direct-child deadlines and binary
stdout/stderr. Stream sizes were checked after completion against2MiB; this is
not a live byte-kill guarantee or descendant-tree supervision. Both final stderr
streams are empty. Final stdout hashes:
canonical `8ce35fd0b13d8b23abbed41a262cd3086b3e14dc9e35c1ef054cce8c1a41ef41`;
sealed controls `2adf5e8d51ea17cd555b9f82d21d30bfc772fca996842fa5d8b7bdc120b33add`.

Evidence is exclusive under this worktree's
`.task-inputs/CODEX-G1-browser-managed-repair-1/`, including outline, both run
envelopes/captures, exact first-run source reconstruction, readonly pins, copied
sealed review/four-failure history and finite `FINAL-MANIFEST.json`. Original
author expression failures, CP1252 capture-print failure and the independent
4 PASS/4 FAIL rejection remain intact in their original directories and linked
sealed review manifest. `git diff --check` passes; scoped raw Git readbacks and
final commit identity are retained separately.

The source remains **INERT / UNACCEPTED pending separate independent review**.
Default compilation is one Fail state; a per-run inspection graph has a literal
false guard with no caller toggle. No state assigns `absent:true`. The exact
Step Functions EC2 NotFound/error envelope still needs an independently admitted
wire experiment, so positive cleanup is deliberately unavailable. Real ISO
response casing, IAM/tag delivery, managed survival, latency/service outages,
malformed timestamps and terminal States.Runtime/data-limit failures are not
qualified by these checks. Neither physical termination/root absence nor browser
and renderer sandbox, security residual risk, G1 or deployment acceptance is
established. Current Meri remains untouched. CLOSED author writer.
