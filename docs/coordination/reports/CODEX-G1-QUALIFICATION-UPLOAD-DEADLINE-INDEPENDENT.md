# Independent qualification upload deadline review

**PASS, SOURCE/DATA only.** No concrete source blocker was found in the narrow
deadline change or the separately prepared E3 dispatcher delta. This is not an
upload, StartBuild, runtime, security or G1 admission. The integration owner must
bind the current source/runtime closure, fresh authority and one new attempt.

Codex independently reviewed author commit
`4be698449b79db2cf4bf59536df1c48447e52a84`, clean parent
`f0c9f3b7232666a85c3f7ff844ade98b1da02c63`, in
`C:/dev/main/meri-greenfield-worktrees/g1-qualification-upload-deadline`.
The reviewer branch is `review/g1-qualification-upload-deadline`, in its separate
`g1-qualification-upload-deadline-review` worktree from that integration base.
AGENTS/implementation standards were read and an outline recorded first. This
reviewer did not author the timeout repair or the E3 dispatcher.

## Retained failure

The original E2 archive is **217387189 bytes**, SHA256
`93ea4b10aa2e604436eca04fe7c1542742cdaa64ff6dec9fcb22c2d235c93507`.
Its upload began `2026-10-11T03:40:46.656234Z`, ended
`03:41:46.695107Z`, and reached the 60s direct-child timeout. Exit code is null,
both raw streams are empty, and the receipt records zero automatic retries.
The consumed reservation, mutation-attempt record and failed/uncertain outcome
remain unchanged. The dispatcher has no StartBuild input or attempt marker and
its source stops when capture raises; this is evidence about that dispatcher,
not a statement about every possible AWS actor.

The later exact-key HEAD, `03:42:04.137838–03:42:06.084406Z`, returned exit254 and
the retained 404/Not Found error. That is an observation at that time, not proof
that no remote effect ever occurred and not renewed authority for the consumed
attempt. Thirteen exact DATA copies and the archive hash were verified in
`failed-e2-data-1/manifest.json`, 5513 bytes,
`b95f8df41479942318e067725121ac884c795073c2823e4ab007595475b292f6`.

## Closed source and evidence

All three changed files, the unchanged duplicate-key parser dependency, old/new
capture code, canonical host-assets caller, E2/E3 dispatcher and relevant retained
receipts were read. No candidate, test, helper or AWS CLI was imported/executed.
Reviewer-owned stdlib DATA/raw-Git readers verified hashes, source ASTs and
receipts; they did not replay fake capture controls or perform network/native work.

| Candidate path | Bytes | SHA256 |
| --- | ---: | --- |
| scripts/qualification/aws_evidence.py | 11549 | `bfc660089a0be0331a56f70017247cb637ef8fbc249a0b0905e551ff7e840b9f` |
| scripts/qualification/aws_evidence_timeout_test.py | 7909 | `799301367ec953982f490fd1bdc5f32b2cac70407eec5b45254f3ecb4e958530` |
| docs/coordination/reports/CODEX-G1-QUALIFICATION-UPLOAD-DEADLINE.md | 5738 | `81d63b22a5b91d67a932b1c421bcf18dee52a5c2c477f99bf1d9f8834b83ac37` |

The author seal is 3222 bytes,
`f13053cec60746c21000818f4bb8a90fd1f2ce1224352a7da7a0e43d41557e28`.
All seven payload and three source records match. Independent raw Git binds the
three current files to the candidate and the exact three-path scope/clean status;
the original capture bytes equal both parent Git and the reviewer baseline.
`teststate_request.py` and `readonly_shapes.py` remain exact.

The existing `capture` AST changes only by replacing its timeout conditional with
`validate_timeout(arguments, timeout)`. CLI entry, executable/profile/region,
allowlists, environment replacement, AWS_MAX_ATTEMPTS=1, standard retry mode,
connect10/read30 timeouts, shell=false and binary receipt/error handling remain
unchanged. `strict_object` is reused from the existing canonical parser.

## Boundary assessment

Ordinary operations retain integer deadlines **1–60s** and default45s. The repair
intentionally tightens legacy timeout types: booleans and floats that could pass
the old numeric comparison now refuse. Integer61–180s is accepted only for an
exact `s3api put-object` with nine unique option/value pairs, before evidence
allocation or process dispatch. Other operations cannot receive that extension.

The long profile binds the fixed qualification bucket and KMS key, the lowercase
commit/UUID-shaped ZIP input key, `If-None-Match:*`, SSE-KMS, SHA256, exactly two
duplicate-free metadata fields, and both hex/base64 hashes of the actual body.
Repeated, missing, extra, abbreviated, equals-form or global options refuse.
Arguments are passed as an array with shell=false. Key syntax is not proof of a
fresh UUID or an unconsumed action; the external owner admission still owns that.

The body must be absolute, nonempty, regular, single-link and at most512MiB.
Link/reparse ancestors and body refuse. Reads stream in1MiB chunks, compare
path/open-file identity and complete same-API metadata before/after, and bind the
actual digest to metadata/checksum. No ZIP-format parser or general authorization
layer was added. The existing capture remains the process/receipt owner and the
focused validator owns only this deadline exception; no framework or unrelated
service responsibility was introduced.

The author ran **10 offline test methods once**, exit0, 3.466s unittest time /
4.063s child elapsed, under a 60s external direct-child bound. Four source and
dependency records are equal pre/post. Receipt SHA256 is
`8b14fcfd04d82afc513ef5eb304110ee1e876013a718ddd950c921d7a8da683d`;
stderr is 1264 bytes,
`40a97956193a9f744d6423a834a3e9e8e79546de2e592b72f6f13ff2020b1050`.
Raw stderr lists ten successes and the complete OK footer; stdout is empty.
These controls meaningfully check timeout forwarding, other-operation refusal,
type/range, argument ambiguity, target/encryption, metadata/hash, body bounds /
hardlinks and one retained fake timeout without retry. No failing test/replay is
recorded in that allocation. Audit denial is installed after the stdlib-only,
source-inspected canonical imports; process calls are faked during the controls.
They do not prove live AWS or pre-import sandbox behavior. Symlink/reparse and
in-read mutation branches were inspected as source, not independently exercised
by this DATA-only review. The root's separate later replay is not counted here.

## E3 preparation and remaining authority

The separately prepared E3 dispatcher is **9235 bytes**, SHA256
`7de84712e213ed129298eef7692ffaa7f9265103cee476a1cba2c1fcefb4030a`.
Raw comparison finds exactly one substitution from E2:
`timeout=60` becomes `timeout=180 if label == 'upload' else 60`.
Only the UUID, source key and result key change in its decision. Its new token is
`5dc90ae1-5a9b-42e9-a52f-12ddfbf74a60`; the four archive/manifest/runner/recipe
records borrow their unchanged E2 paths and exact bytes. Source-check and authority
capture source copies also remain exact. No consumed E2 file was rewritten.
The proposed upload matches the new profile by source/data inspection; the
reviewer did not invoke the validator on that operational request.

E3 preparation DATA manifest: 3429 bytes,
`c613bee6340fceb2a39089b47d21091c128cf22d29688ec7a15d5117e0898eba`.
Independent candidate DATA/AST/raw-Git result: 9730 bytes,
`84ba56dc603fc91d7642b2066df430e510bcc8dd7d2803a1a6223dfb5b14961d`.
Both are under the reviewer worktree's `.task-inputs/upload-deadline-review-1/`.

This boundary trusts immutable owner-selected input files. It is not an atomic
lock across the later AWS CLI reopen; the owner must protect those bytes through
dispatch. Hashing has a byte bound, not a separately preemptible wall-clock bound.
The direct subprocess timeout does not prove descendant-tree termination, bounded
PIPE memory or wire cancellation. Conditional create and one SDK attempt do not
make an uncertain outcome reusable. A fresh complete source/runtime pin set,
authority/readback comparison and explicit one-attempt owner admission remain
required; this report does not adopt unseen later authority. G1, genuine import,
security/license findings and all existing consumed failures remain unchanged.
