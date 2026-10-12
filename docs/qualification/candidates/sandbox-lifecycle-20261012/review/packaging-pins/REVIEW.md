# Independent packaging-pin review — 12 October 2026

**ACCEPT_SOURCE** for patch `d5a1b0aa2f77d9c215f1a092d7c329b93492cb55`,
tree `750fa31f9c6ed76199fd85b2624d73a96a193b5f`, against parent
`296f80639342bf23ef0261edbb5bc787fd76196f`. Reviewer: Codex
`/root/memory_reviewer`. This accepts source identity guards only; image build,
owner execution and runtime admission remain **HOLD**.

Exactly three existing files change six lines: builder REFERENCE/comment,
collector ASSEMBLER_SHA/CONTEXT_SHA, and the two corresponding expected test
literals. Independent inverse substitution restores every byte of the three
parent files. No membership exemption, execution identity, authority check,
review/expiry gate, runtime flag or other assertion is changed.

REFERENCE points to the independently accepted qualification source freeze
`bb44e802de14b5483c51ea1a58448ca23a5f11a0`, not its later documentation HEAD.
All 48 stable source members match that accepted commit byte for byte. The finite
context still has exactly 57 members; the full baseline returns 60 source files.
Context bytes total 1,026,634, with SOURCE_ONLY status and commitAuthority false.
The reviewer independently derives:

- ASSEMBLER_SHA `e5ea8c06607f15c6c0c2dfde527f20d9dfa509e6c59268ffaa03cbfa6b97d765`.
- CONTEXT_SHA `640c5f3dd73272af3a120bf7ec71afa096e30506f6c0b99b242e22dd96c0b229`.

The exact Git baseline replay passes 14/14 controls. Prior PR7 reference,
missing/changed stable source, current worktree drift, assembler drift, collector
drift and manifest-owner drift all refuse. Only the test's Git executable path
is adapted to Linux; the actual baseline/Git-reading functions remain unchanged.
The historical control file remains byte-exact. Its root adaptation changes only
reference/count/hash expectations and labels; separate exact-pin checks restore
the explicit current hash assertion. The adaptation diff is retained.

The independent collector replay passes 16/16 controls. It retains all historical
negative cases and adds refusal of the immediately previous reviewed context.
Missing, extra, duplicate and symlink source members, altered bytes, rehashed
altered context and rehashed assembler changes refuse. The actual collector
preflight rejects before the native build port; that port is asserted uncalled.
Temporary local fixtures were removed.

The original 36-test builder suite is unchanged except the two approved expected
hash literals: **35 pass, one ERROR** at
`test_real_owner_execution_closure_pins`, reason `fixed owner Python runtime`.
This Linux host does not match the fixed Windows Python3.12.14 owner. Its full
error is retained and never skipped, mocked into success or relabelled qualified.
The principal ARN, Python hash and all approval/admission bodies are unchanged.

Root's freshly retained pre-pin failure at the exact parent is copied with its
original command and raw streams. Stream sizes/hashes and expected exit1 verify;
the prior reference fails exact Git membership. Historical controls and original
references remain preserved. No production source, guard, original test or shared pin was edited by
this reviewer.

A separate review-fixture repair `0ec9599cfea4fc4d300197894377bd01fc875de4`
preserves root's 43/44 failure and changes only one positive fake-close scheduler
from setImmediate to queueMicrotask. The original assertions and dedicated
late-close negative controls are unchanged. The exact 44 independent lifecycle
controls then pass against this packaging candidate. This is a deterministic
fixture repair, not a production timeout or physical-absence relaxation.

All review commands were bounded and reaped. No image build, native browser,
renderer, real owner execution, network/database/security mutation, cloud,
provider or paid-model operation ran. Source acceptance authorizes neither
runtime admission nor use of the prohibited historical image.
