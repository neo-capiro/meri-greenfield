# Independent worker source-guard review — 12 October 2026

**ACCEPT_SOURCE** for candidate `9ee511d0db08ade12650b9c0e0679a0a2842de08`, tree
`e76151378d9ddfa6d82a93d19cfe9295acb9eeee`, against patch base
`54135942f3f59a29e0c0c10ca53fb7b49969ea57`. This accepts the narrow source-pin
repair. Image, runner and G1 runtime acceptance remain HOLD/OPEN.

Reviewer: Codex `/root/memory_reviewer`, separate from the root author. Review
criteria were frozen in `b8a47c9f5ead84ebb9a7525cad9ff1a798d252cc` before final
candidate review. The independent worktree starts at intake
`ca4118c55d090559fdfde4075dedb2e71d411503`; no candidate source was edited or
copied into that branch. All results below bind the exact author freeze, whose
working files matched Git and whose worktree was clean at preservation check.

## Preservation and binding

The only existing-file changes are two source literals in
`scripts/qualification/worker_image_collect.py`, the corresponding expected
literals in `test_worker_image_build.py`, and that test's name clarification.
Independently reversing those authorized changes reproduces both base files
byte-for-byte. Every other original assertion and negative control is retained;
all other existing repository files are unchanged. Eleven protected files were
also compared directly, including the build/binding/publication modules,
assembler, membership definition, component pins, static tests and inventory
probe. The inventory fixture matches accepted author commit
`0ea9b778c983108f664455e7fc4e195a0a33148a` exactly.

Independent reconstruction confirms the 53-member context, 996,428 source
bytes, with manifest SHA256
`0f9cc23fb20d3d292fc5f2759a570ec5b022a5b9068d17ac545251803f73e903` and unchanged
assembler SHA256
`48f065d0ad61f98ba571c89dcd62141e6f8c9b272f0d371331d74a0dabf87851`.
The manifest remains `SOURCE_ONLY` with `commitAuthority: false`.

Historical context
`18836912a03fc035d69c0cfc57d1f407e5c46af1bdd37c21a761f5d42dc84dda` and assembler
`67c1cf554e80c62eeb56b6dcb9be00106adf9b1b8b40beba85249de662b835eb` are preserved
in history and review evidence. The historical context and the immediately
pre-fixture context `94216667decf5e4feed05914b3f295148d9437ee1c00b224ca4e92625b5b876f`
are rejected by current input validation.

## Independent checks

| Check | Result |
| --- | --- |
| Intake build suite | 34 pass, one stale-context failure, one Windows-owner error; exit 1 |
| Exact candidate build suite | 35 pass, zero failures, one unchanged Windows-owner error; exit 1 |
| Publication unit controls, offline mocked ports | 9/9 pass |
| Context assembly unit controls | 17/17 pass |
| Independent source rejection checks | 15/15 pass |

The candidate build suite is **not fully passing on this Linux host**.
`test_real_owner_execution_closure_pins` still raises
`ValueError: fixed owner Python runtime`. Its fixed Windows Python 3.12.14
path/hash requirement and historical principal are unchanged. No assertion was
skipped, weakened or relabeled as runtime success. The independent intake was
before fixture integration; its failing actual context is the pre-fixture hash
above. The author's separate immediate pre-patch baseline is retained in its
integration packet.

Independent controls reject missing, extra and duplicate source members,
changed source bytes, changed assembler bytes with recomputed per-file receipts,
and source symlinks. A stronger control changes the accepted inventory test,
recomputes its receipt and input hash, then runs actual collector `main()` with
an inert local assembly port. It rejects the reconstructed context at
`accepted context manifest` before the mocked build port is called. Thus
recomputing caller-supplied file hashes does not bypass the fixed aggregate
context guard. Current exact input passes only source preflight.

Existing tests retain fresh review, caller identity, approval, source binding,
output reservation, retry, lost-acknowledgement and cost controls. Fixed account,
region, profile, principal and executable identity bytes remain unchanged.

## Evidence and remaining gates

Evidence is under
`docs/qualification/candidates/worker-source-guards-20261012/review/`:
frozen criteria, raw baseline and candidate stdout/stderr, command receipts,
`guard-controls.py`, `independent-controls.json`, `source-preservation.json`
and the final hash receipt. Failed output is retained unchanged.

This review supplies no caller authority, fresh execution review, build or spend
approval, runner admission, patched-image qualification or native G1 evidence.
The real owner execution closure still requires its supported, approved host;
actual image build/push/launch and native browser/renderer, checkpoint recovery,
task authority/budget, egress/watchdog/teardown and artifact inspection gates
remain outside this source review.

All invoked checks were bounded local Python unit/fixture checks. No image,
cloud, provider, model or native runner port was invoked. Temporary source
fixtures were removed and all synchronous review commands completed. No owned
background process was started. Only this new report and the allocated review
evidence paths are changed by the reviewer.
