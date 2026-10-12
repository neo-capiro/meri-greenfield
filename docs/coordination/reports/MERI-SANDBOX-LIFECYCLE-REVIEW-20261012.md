# Qualification lifecycle independent source review — 12 October 2026

Disposition: **final audit pending**. Reviewer: Codex `/root/memory_reviewer`.
Base PR15: `14be9fc614568a74133b89f2b229e50c9b030322`.
Reviewed source freeze: `bb44e802de14b5483c51ea1a58448ca23a5f11a0`, tree
`82c7559422819d3c83718da01bbb6fe0434153f6`.
Author evidence HEAD and final audit receipt will be recorded before acceptance.

The accepted scope, when the audit completes, is the existing opt-in qualification
probe call path. Root explicitly narrowed the initial criteria before author
implementation; `review/root-scope-interpretation.json` preserves that decision.
This review does not qualify product task authority, browser authentication,
Temporal task A/B recovery, ArtifactVersion publication, native sandboxing or G1.

## Source behavior reviewed

The actual runtime and Office callers use one extracted owned-child supervisor,
with a fixed Node/script allowlist, Linux detached ownership, bounded output,
cancellation and an absolute monotonic deadline. A close event plus definite
absence observation is required for confirmed cleanup. Missing close, failed or
unknown observation, and kill acknowledgement retain uncertainty. Unknown cleanup
stops the next probe with NOT-RUN/HOLD; a confirmed-clean semantic failure allows
independent checks to continue. Cancellation always prevents the next probe.
Scripted run A cleanup leaves independently owned run B untouched.

Browser main uses the browser-specific lifetime owner around fixture acquisition,
MCP connect/listTools/callTool, stderr and shutdown. Pending operations or close
failures retain UNKNOWN. Late server acquisition remains owned and gets a bounded
close; late results cannot resume the successful workflow. Server close requires
its callback. API-close receipts explicitly do not establish physical group death.
The browser's unchanged native assessment remains an unrun qualification gate.

All CLI signal listeners are installed only on direct invocation and remove only
their own handlers. Runtime installs its bridge at the actual child phase after
native prechecks; no bridge now swallows default termination during parked DNS.
Browser and Office forward cancellation to their owned lifetimes. Office rejects
pre-abort before directory or native-child acquisition, and cancellation during
export prevents later records or a successful terminal result. Already emitted
bytes cannot be revoked; the existing abort record invalidates a partial capture.

The original Office eleven-file verifier, path/identity/digest controls and export
protocol remain canonical. Qualification artifacts are retained as evidence;
no cloud upload, product publication or source activation is introduced.

## Independent results

All raw outputs and command receipts are under
`docs/qualification/candidates/sandbox-lifecycle-20261012/review/`.

| Check | Result |
| --- | --- |
| Independent adversarial controls against exact source freeze | 44/44 pass |
| Ordinary worker `npm test`, including the three added suites | 282/282 pass |
| Root contract/source checks | 244/244 pass |
| Public0.1 generated distribution and TypeScript | pass |
| Public package tests | 7/7 pass |
| Finite context source tests | 17/17 pass |
| Exact Git/source, original assertion and function audit | pending |

The 44 independent controls traverse actual Office, runtime and CLI child-owner
functions with inert process/stream ports, and the browser lifetime called by the
real browser entry. The DNS regression control executes exact Git main/CLI
statements with every environmental check replaced by inert ports. No real DNS,
OS signals, browser, renderer or native child is executed. The browser main's
MCP call-path wiring is source inspected; it is not a synthetic end-to-end
browser sandbox claim.

## Preserved failures and original controls

- Original static/Office baseline: 146/148 pass, two Office fixtures fail because
  fake child identity/absence was unavailable. Separate author commit
  `41ded012694bbe0d90e18506ae57c50168f1a3fc` gives the exact fake child a valid PID
  and observes absence only after close. Its original 55 test names and 153
  assertion expressions remain byte-exact and ordered.
- Original four supervisor counterexamples all fail: pre-abort acquires a child,
  Linux non-detached execution is admitted, stderr overflow permits success,
  and post-spawn abort is ignored. Expanded unchanged controls were 7/11 pass.
- The first integrated draft passes 23 supervisor/runtime controls and ten
  browser controls. The latter is a passing first replay, not a historical
  browser failure. A reviewer-requested between-port expiry repair preceded it.
- An isolated mutant removing both browser close-time deadline checks is rejected
  by the unchanged absolute-expiry control (0/1 pass). Its temporary file was
  removed; production source was not modified.
- CLI replay initially passes five of six controls: pre-aborted Office main still
  acquires a directory. The final unchanged case passes before any acquisition.
- Exact initial source freeze `2f182431a78f4ccb200a5e4adfd62b0ad3afa508`
  fails the new parked-network-precheck signal control (0/1 pass). The final
  source passes it. Root discovered this introduced regression; its source and
  negative evidence remain preserved.
- Author packets separately retain initial context cardinality failures,
  dependency-path failures, an incorrect first test expectation, and intermediate
  CLI sequencing failure at `87144573d12ea72e9d88e5d6f531f96623d8f045`.
  These are not relabelled independent failures or native runtime evidence.

## Remaining gates and handoff

The four newly allocated source/test members make 57 finite context members.
Root owns a separate exact reviewed-source baseline rollover and derived
assembler/context collector pins. This review does not approve stale pins, build
an image or claim that the prepared source is already runtime-admissible.
The old prohibited image remains prohibited.

Native Linux browser AND renderer sandbox, descendant containment/physical death,
OS signal delivery, egress/watchdog enforcement, native generation/rendering and
artifact inspection, current task authorization, supported patched-image
admission and executable runner review remain UNRUN/HOLD. Runtime precheck DNS
itself remains unbounded; default OS signal handling is restored during that
phase, and total-process watchdog qualification is still required. Paid model,
cloud, database, customer data and provider operations were not performed.

All review commands were bounded and reaped. Review writes are confined to this
report and its review evidence directory; author source and donor dependencies
were only read. No other owner was stopped and no test process remains owned by
this review. The final evidence receipt will bind the exact source, author packet
and all review files without importing private producer bodies.
