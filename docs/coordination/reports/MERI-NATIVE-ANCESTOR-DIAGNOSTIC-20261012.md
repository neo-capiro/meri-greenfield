# Ancestor-only diagnostic source candidate

Base `90b4dc8472da13cdee9f49cdc0b4c8306ecbdc73`; author gateway_author;
separate reviewer gateway_reviewer; native execution belongs to the parent.
This is a source proposal, not native execution approval or runtime acceptance.

The parent reports that the original metadata-only diagnostic, SHA-256
`3780982e6906e6798232d9a7d7f1c5efa07f6dd7b9a25356976a2a73ed026bd3`,
ran once on NEOMART, exited 2 in 0.203 seconds, and returned the generic
`plain_local_directory_ancestors_required` reason in 114 stdout bytes, with no
stderr, timeout or overflow. That observation did not name an ancestor or provide
stdlib counts. It neither diagnoses the collector nor establishes zero-byte files
or a deterministic Windows compatibility defect. A junction/reparse rejection
may be correct behavior. The original script is preserved byte-for-byte.

## Proposed narrow observation

New standalone source:
`docs/qualification/candidates/native-ancestor-diagnosis-20261012/inspect-ancestor-metadata.py`.
It imports neither the old diagnostic nor the collector, and includes no stream
reading, stdlib scan, directory listing, file-body read/hash, filesystem write,
subprocess, network, AWS or provider operation. Safe import defines functions only.

It retains actual win32/Python 3.11.15 runtime admission, absolute local drive
syntax and DRIVE_FIXED checks. All role syntax is checked before any native API
or filesystem metadata operation. It inspects repository, output-parent,
basePrefix, Lib and DLLs in the original order, walking each root to leaf using
`lstat`. The first failed ancestor stops inspection: no later descendants or roles
are inspected. Symlink, Windows reparse attribute and not-directory predicates
remain refusals, individually reported even when several are true.

A rejection reports role, one-based root-to-leaf ancestor ordinal/count, stage,
the three predicate booleans, numeric stat mode, Windows file attributes and
reparse tag. Missing Windows metadata is explicitly null. OS/native API failures
carry only bounded numeric errno/winerror and stage, never exception text. For a
syntax or drive failure, no ancestor was statted; the ordinal is null. Successful
earlier roles report counts only. No private path strings are emitted; the parent
maps role and ordinal back to its exact input receipt.

Limits are 1024 path characters, 64 ancestors per role, five roles, ten-second
cooperative checks and 32KiB ASCII JSON stdout. A blocked metadata/native call
cannot be preempted by those checks. The parent's existing external 15-second
supervisor is still required; no replacement supervisor is implemented here.

## Exact invocation template and source binding

```
& '<EXACT_ORIGINAL_PYTHON_EXE>' -I -B -S '<REVIEWED_ANCESTOR_DIAGNOSTIC_ABSOLUTE_PATH>' --repository '<EXACT_ORIGINAL_REPOSITORY_ABSOLUTE_PATH>' --original-output '<EXACT_ORIGINAL_OUTPUT_ARGUMENT>'
```

The parent must bind every placeholder from the actual preserved receipt and
reviewed script placement, verify the frozen SHA-256, and apply the external
supervisor. No NEOMART path was guessed. Exit 0 means all selected current
ancestors had plain directory metadata; exit 2 is a refusal. Neither exit proves
the original collector's failing stage, full runtime identity, body integrity,
stdlib inventory, filesystem race safety, runner qualification or build authority.

## Local verification

Eleven synthetic source controls passed: root-first ordering; individual and
simultaneous rejection predicates; stop-at-first-failure; numeric OS error
reporting without filenames; UNC/device/drive-relative/traversal/NUL/length/count
refusal before IO; fixed-drive/API refusal; deadline checks; wrong-runtime refusal;
role ordering; absent attribute reporting; invalid-argument path suppression and
stdout bounds. The actual isolated Linux command exited 2 with the required
runtime-refusal record before filesystem metadata; help exited 0 and a deliberately
invalid argument exited 2 without echoing its value. Raw outputs remain retained.

AST inspection confirms only the expected standard-library imports and no file
opening, directory enumeration, subprocess or collector import. The source hash,
size, call list, original-script preservation and exact local receipts are under
the candidate's `author/` directory. All owned local check processes completed.
No native Windows execution, file repair or safety relaxation was performed.
