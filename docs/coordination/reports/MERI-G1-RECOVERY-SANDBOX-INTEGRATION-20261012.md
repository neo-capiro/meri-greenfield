# G1 recovery admission and qualification cleanup source

**ACCEPT_SOURCE** for the independently reviewed Temporal, sandbox and source-pin implementations. Runtime remains **HOLD**: G0 accepted, G1 OPEN, G2–G7 unentered. Only ordinary local source-check processes ran. No proposed Windows interpreter/diagnostic, Temporal server/Worker, browser/renderer, database, container, cloud, provider/model or customer operation ran. No main merge, frontend/capirov2 edit, infrastructure build/push/launch, credentials or security/network/database change occurred.

Base is preserved draft PR15 `14be9fc614568a74133b89f2b229e50c9b030322`, tree `fd5ac72bed31f0611e4c24a6535730ac17a14ad7`. Integrated production source is `d5a1b0aa2f77d9c215f1a092d7c329b93492cb55`, tree `750fa31f9c6ed76199fd85b2624d73a96a193b5f`. Dedicated branch/worktree: `task/meri-g1-recovery-sandbox-20261012`, `/workspace/meri-g1-recovery-sandbox-20261012`. Original author/reviewer branches, intermediate failures and source freezes are preserved and published separately. This draft stacks on PR15.

## Reviewed behavior and canonical owners

Temporal recovery previously had only the historical echo/approval compatibility workflow. The new explicit `recovery-workflow.ts` and trusted `recovery-activities.mjs` use canonical control/registry/checkpoint wire owners. Trusted composition prebinds immutable A/B context, peers, committed receipt and exact Temporal execution identity; workflow input carries only the run UUID. A separately qualified retirement provider must establish exact A retirement before canonical atomic `replaceRun`, which revokes A and admits B. Stale A is denied, current B is reauthorized and the exact committed checkpoint is loaded and verified. No pre-revocation, redundant registry or second model loop is introduced.

Activity retries are disabled; cancellation and parked operations are bounded. Unknown replacement acknowledgements retain explicit uncertainty without another replacement, guessed cleanup or success. Cleanup can call canonical `stopRun` only for a known current B. Duplicate process-local delivery is denied; this is not durable restart reconciliation. Historical A expiry does not invalidate an otherwise valid committed producer identity, and does not authorize expired A. The original workflow/activity source and all22 compatibility assertions remain unchanged. No native B dispatch or SDK restore is supplied; both checkpoint completeness flags remain false.

The actual runtime and Office entry now share `owned-probe-child.mjs`, extracted from the existing Office owner. The fixed allowlist is browser/artifacts only. Linux detached group ownership, bounded stdout/stderr, absolute execution deadline, cancellation, at most one scoped kill request, child close and definite group absence govern continuation. Unknown cleanup or cancellation blocks the next probe; a semantic failure with confirmed cleanup still permits independent checks. The browser-specific lifetime bounds server acquisition, official MCP operations and concurrent API cleanup. API cleanup cannot prove descendant absence.

CLI signal listeners are installed only by actual entries and disposed after bounded owned cleanup. Runtime installs them only around child ownership, preserving default OS termination during earlier prechecks. Office cancellation rejects pre-aborted acquisition and prevents later export records/success. Already-written bytes cannot be recalled. The eleven-file protocol, original byte/file verifier, artifact generation/reconstruction, SDK ownership and public/private contracts remain unchanged. Native process identity, signal handling, browser/renderer sandbox, egress and external watchdog evidence are unrun.

## Exact lane decisions

| Lane | Author/source | Independent decision |
| --- | --- | --- |
| Temporal admission | `9a9d52ee2686346e3549e53a707aaccc5e8fbed6` | ACCEPT_SOURCE, reviewer `5c8896eca041df5336e15daf2b5784c63749621a` |
| Sandbox lifecycle | source `bb44e802de14b5483c51ea1a58448ca23a5f11a0`; clean evidence HEAD `60516dd4a4027c2e740cd374a37e0fb4d51d4214` | ACCEPT_SOURCE, reviewer `e093bee67ab507b13599fa6121887890115c6e82`; deterministic reviewer fixture repair `0ec9599cfea4fc4d300197894377bd01fc875de4` |
| Image/native plan | `8e50b8b7efeed2a9b251ad5658b58934246f16a4`, frozen to PR15 | Root ACCEPT_SOURCE_PACKET; NOT_EXECUTABLE |
| Source-pin rollover | `d5a1b0aa2f77d9c215f1a092d7c329b93492cb55` | ACCEPT_SOURCE, reviewer `80f0ec84a1d4c93529e32d9e47430c87cec17c28` |

The rollover changes only the builder reference/comment, two derived collector hashes and two expected test literals. Reference is accepted sandbox source `bb44e802...`; assembler SHA256 is `e5ea8c06607f15c6c0c2dfde527f20d9dfa509e6c59268ffaa03cbfa6b97d765`; canonical context SHA256 is `640c5f3dd73272af3a120bf7ec71afa096e30506f6c0b99b242e22dd96c0b229`. The finite list has57 members,48 stable baseline members and60 total baseline files. Exclusions, source walls, fixed owner Python3.12.14 identity and authority remain unchanged. No prior image/scan/runtime acceptance transfers to this new source tuple.

## Integrated verification and failures

Root retained exact commands, source HEAD/diff, raw streams, hashes, exits and owned-group cleanup under [integration evidence](../../qualification/candidates/g1-recovery-sandbox-20261012/integration/). Results:

| Check | Actual result |
| --- | --- |
| Temporal strict TypeScript + original/author tests | PASS,30/30 |
| Independent Temporal actual canonical pipeline/compiled workflow controls | PASS,36/36 |
| Worker ordinary test discovery | PASS,282/282 |
| Independent sandbox controls after deterministic fixture repair | PASS,44/44 |
| Root source checks | PASS,244/244 |
| Public generated-byte/type/distribution checks | PASS,7/7 |
| Source pins, finite context and publication controls | PASS,30/30 |
| Actual Git baseline and drift counterexamples | PASS,14/14 |
| Independent pin review and collector controls | PASS,14 Git +16 collector controls; exact inverse patch verified |
| Frozen PR15 image/execution-plan offline verifier | PASS,119 checks |
| Legacy builder suite |35 PASS,1 ERROR: fixed Windows owner runtime absent; guard unchanged |

All19 author source files match the exact accepted manifests. Of3,590 base files,3,576 remain byte-identical; only14 allocated existing files changed and eight source files were added. Original Office55 test names/153 assertions and70 unrelated functions are preserved, as independently audited. The three context cardinality changes are exactly53→57; worker test discovery adds only the Office and two new lifecycle suites. All dependency locks, component pins, Dockerfile, public0.1/private0.2 contracts, catalog and original real-PostgreSQL test file remain exact.

All22 root capture groups are positively absent; no timeout or group kill occurred, and owned descendant reaping is recorded. Every captured stream size/hash was independently rechecked. Source/coordination whitespace passes. Full whitespace exits2 solely for17 retained raw-output/patch evidence paths; their original bytes remain unchanged. No owned background qualification process remains.

Negative evidence is retained: Temporal historical-expiry failure and uncertainty-erasure mutant; original Office146/148 baseline and four failing supervisor controls; Office pre-abort acquisition and runtime signal/precheck failures; source-identified export cancellation repair; context14/17 before exact cardinality updates; dependency-symlink242/244 failure; and original author fixture/checker errors. The root concurrent independent run produced43/44: a positive fake close scheduled with `setImmediate` missed20ms cleanup grace under load, correctly returning UNKNOWN. Reviewer changed only that positive scheduling to `queueMicrotask`; all assertions and dedicated late-close negative controls remain. The unchanged production source passes44/44. No production deadline was widened.

Fresh old-reference baseline checks fail `exact Git membership`, proving PR7 cannot silently accept four missing members. The first diagnostic used a short candidate ID but failed earlier at the old-reference lookup; a full40-character candidate replay independently reproduces the same failure. Both raw results remain. Actual Git controls reject missing members, worktree/committed stable drift, assembler drift and collector/manifest-owner drift. Their only test adapter selects `/usr/bin/git`; it does not relax or execute the fixed native owner.

## Image choices and bounded next action

[Execution options](MERI-G1-EXECUTION-OPTIONS-20261012.md) remain explicitly bound to PR15. New recovery/cleanup source supersedes the old source-only gaps described there; it supplies no native Worker, retirement provider, sandbox or hard host watchdog. All54 security obligations and35 image functions remain. No fully supported patched composition is established for the assessed releases. Debian retention needs released vendor fixes/exact applicability and authenticated immutable closure. Ubuntu26 needs unresolved vendor/copy closure and authenticated snapshots, plus an explicit distribution/Python3.14/LibreOffice composition choice. Supported lxml source-build or distro packaging is a separate proposed choice; OS parser updates do not repair wheel-bundled copies. Approval cannot substitute for those facts.

The first proposed native action is one fresh local PostgreSQL cluster, two empty synthetic databases with two nonsuperuser owners and a separate bootstrap identity. The plan names exact migrations/test argv, one PostgreSQL listener plus two ephemeral ingress TLS listeners, fresh PGDATA/system_identifier/PID-creation/database identity, contained-host authentication, one attempt per command, original720s work/900s cleanup ceiling and output limits. It still needs admitted binaries/drivers/host, an exact reviewed lifecycle launcher, authentication/isolation bindings and specific one-action authorization. It is not an executable runner or current request to create resources. JavaScript budget real-pool/cross-process/server-restart tests are an explicit source gap; existing Python client-crash cases do not close it.

Existing Aurora remains selected for eventual state. No new RDS or network/database change is proposed. Every historical image is unadmitted; rejected image `sha256:8d1ec09aa78f47a11019089dacde93289fc66a39f55bd4357e59eeb25d9b52ac` must never launch. Cloud action/pricing/security packets and the historical aggregate paid-model remainder are absent; provider calls and spending remain unauthorized.

## Private supervisor blocker and continuation

The new private Library packet resolved to expected backing file `file_000000004ac081fd89581ea1f9dd3e20`, but the supported helper download failed. Expected ZIP identity supplied by parent:39,189 bytes, SHA256 `6b5a503b242def09dec995110ae8e645fb3413cf4659b4df81a1a9d493499ee0`. No local body/hash verification, supervisor adaptation, interpreter or diagnostic execution occurred. The parent was notified immediately; a relay through its working reader is required. Supplied metadata says the old15s is execution time plus separate termination/drain waits, so it cannot be treated as a total hard limit. Actual source is necessary to review complete time/output/termination semantics and distinguish security identity from read-induced access-time changes without relaxing guards.

Native retirement and task-bound identity/auth/expiry/revocation, durable budgets/restart liabilities, real Temporal history/replay, complete SDK task-A/B recovery and stale rejection, patched images, browser/renderer sandbox, egress/watchdog/physical teardown and artifact inspection remain HOLD. Private operations-policy unavailability blocks affected host/Hermes operations only. Scope remains139 original capabilities:96 selected/43 deferred,14 bound but unavailable/82 unmapped,14 named skills unqualified. Source connectivity stays disabled. Source qualification does not reduce that scope or enter a runtime gate.
