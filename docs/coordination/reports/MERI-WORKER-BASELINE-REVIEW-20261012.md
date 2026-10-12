# Independent worker stable-source baseline review — 12 October 2026

**ACCEPT_SOURCE** for exact candidate
`a511cc15adb737386e0a9fe51127d4d10805b1e2`. The review accepts only the stable
source reference correction. Runtime, image and G1 acceptance remain HOLD/OPEN.

Reviewer: Codex `/root/memory_reviewer`, separate from the root author. Dedicated
review worktree starts at `d7e8b620a5d44a74341610a44afdfd01987552d4`; frozen
criteria commit `9f683d3dcc8e2d74922080c6d76fb5c4f2ed8ca4` precedes the author
freeze. Original failure/provenance evidence is preserved separately in
`51ec0e3d23979e521d77448a82140781f8c913c6`.

The historical `f118ff55dfb96ba4b44099953e6c9724064b723d` baseline lacks nine
stable members and differs on eight more. Independent Git reads confirm all
44 current stable members are byte-identical to expressly accepted PR7
`5ee46446b5f60034916f00b2a665b3e2bef9cf60`. The original production baseline
fails `ValueError: exact Git membership` after reading the actual historical
Git tree. Hash/size metadata for every stable file and the raw traceback are
retained; no private Capiro policy bodies were imported.

Only `worker_image_build.py`'s `REFERENCE` and explanatory comment change.
Reversing those two replacements reproduces the file at both review intake and
immediate patch base `efd059cc2d1c6380507ffd85543fdb1711ae5e6a` byte-for-byte.
No other existing file changes. `PACKAGING_CHANGES`, all 54 original source
members, comparison logic, fixed principal/Windows Git/Python identity,
authority and budget controls remain intact. The original 36-test file and
seven related source modules are also independently byte-compared.

The independent unchanged probe passes **14/14** controls against the exact
candidate. It invokes actual `baseline`, `git_files` and `source.git_read`,
substituting only `/usr/bin/git` for the Windows Git path within the test.
The current 56 source/collector/manifest members pass; all 44 stable files match
accepted PR7. Context SHA256 remains
`0f9cc23fb20d3d292fc5f2759a570ec5b022a5b9068d17ac545251803f73e903`.

Adversarial controls create a temporary local Git repository and real synthetic
commits. Changed stable committed bytes, a missing stable Git member and changed
committed assembler bytes are all refused by the relevant unchanged production
guard. Uncommitted source, collector and manifest-owner drift are also refused.
The historical incomplete reference remains rejected. The temporary repository
is removed after the checks; no source or shared Git reference is changed.

The original build suite reports **35 pass, zero failures, one unchanged error;
exit 1**. `test_real_owner_execution_closure_pins` still raises
`ValueError: fixed owner Python runtime` on this Linux host. The suite is not
fully passing. No original assertion was edited, skipped or weakened. Actual
fixed Windows Git/Python owner execution remains **UNRUN**; the Linux adapter
checks source comparison behavior only.

The builder helper's bytes change, so any later runner binding must freshly
measure and review that helper. Prior closure evidence cannot be reused. The
source context remains source-only with no commit authority; this acceptance
does not supply caller authorization, fresh execution review, security/build or
spend approval, native runtime evidence or image admission. No cloud, image,
provider, paid model or native runner action occurred.

Evidence resides in
`docs/qualification/candidates/worker-baseline-repair-20261012/review/`:
frozen criteria, original baseline metadata/traceback, executable independent
probe, command receipts, exact candidate test stdout/stderr, source-preservation
comparison and final hash receipt. All local commands completed within bounded
timeouts, task-owned temporary data was removed, and no background process was
started. Reviewer changes are limited to this new report and that allocated
evidence directory.
