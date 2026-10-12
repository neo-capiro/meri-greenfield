# Independent review of the proposed native metadata diagnostic

Decision: **ACCEPT_SOURCE_PROPOSAL; NOT_NATIVE_EXECUTION_APPROVED**. Root reviewed
author freeze `bc5fbb39cab4af3f50ba10e8cd2ce71e6668d65f`, including the complete
diagnostic entrypoint, tests and exact pinned collector/inventory source. The
diagnostic SHA-256 is
`3780982e6906e6798232d9a7d7f1c5efa07f6dd7b9a25356976a2a73ed026bd3`.

The diagnostic has no collector import/call, subprocess, AWS request, credentials
or file write. It rejects unsupported runtime, remote drives and reparse/link
paths. Its metadata mode reads bounded directory/file metadata without opening
stdlib bodies. Its stream mode hashes bounded original files and emits only
known-message labels. Filesystem races and blocking syscalls are explicitly not
qualified; parent must bind the real paths and an existing process supervisor.

Root independently replayed all eight synthetic author controls and added three
controls: exact 64KiB stream admission with unknown binary body suppression,
hardlink refusal before read, and actual isolated wrong-host CLI refusal before
access to nonexistent paths. All passed. The independently captured three-case
run exited naturally; its owned process group was absent with no kill required.
See `docs/qualification/candidates/native-capture-diagnosis-20261012/review/`
and the `native-diagnostic-review` receipt/streams under the trusted-memory
integration evidence. This was Linux source verification, not NEOMART execution.

## Subsequent original-evidence report from the parent

The parent independent reader reports the exact ZIP hash, size and 117 members
verified. The original stderr is 60 bytes and exactly the generic refusal with
CRLF; stdout is empty, exit is 2, elapsed time is 0.416425 seconds, EOF was reached,
and no timeout, overflow or reader error occurred. Capture ran once; no output
slot exists and all 1538 tracked files remain unchanged. The recorded
`descendantTeardownQualified=false` is not a failure diagnosis.

Root independently matched the parent-provided collector, inventory and test
SHA-256 values against exact Git objects at
`c225c4f6247c22c8906a23758477e431e3d88c15`, and matched the exact reported generic
stderr digest. The original ZIP itself remains unreadable here: even the newly
requested Library-ID-only route returned no workspace path and the supported
helper again failed with `library file transfer failed: download failed`.
The immutable earlier two-attempt blocker remains preserved. The new parent
report, source hash checks and explicitly requested third route attempt are in
`docs/qualification/candidates/native-evidence-intake-20261012/parent-verified-evidence-update.json`.

Those original bytes establish the generic caught-error branch, not its failing
stage. Missing outputs still cannot establish whether the local AWS CLI version
subprocess ran. Zero-byte selected `.py` files remain a source-supported
hypothesis only; none has been observed on NEOMART here.

## Narrow next command for parent binding

The stream-comparison diagnostic is now optional because the parent has verified
the original bytes. The useful next proposal is the separate metadata-only mode:

```powershell
& '<EXACT_ORIGINAL_PYTHON_EXE>' -I -B -S '<REVIEWED_DIAGNOSTIC_SCRIPT_ABSOLUTE_PATH>' metadata --repository '<EXACT_ORIGINAL_REPOSITORY_ABSOLUTE_PATH>' --original-output '<EXACT_ORIGINAL_OUTPUT_ARGUMENT>'
```

Source: `docs/qualification/candidates/native-capture-diagnosis-20261012/inspect-local-metadata.py`
at author freeze `bc5fbb39cab4af3f50ba10e8cd2ce71e6668d65f`, SHA above. These four
placeholders must be bound from the actual parent receipt/placement, not guessed
or borrowed from another environment. Preserve the original slot and collector
pin. The existing parent supervisor must impose an external 15-second bound;
the diagnostic's 10-second checks do not preempt a blocked filesystem call.

Output is at most 1MiB ASCII JSON: runtime flags, original-slot metadata, root
metadata, selected stdlib `.py` counts/sizes and at most 100 issue examples. It
does not hash runtime bodies, execute AWS CLI, replay the collector inventory,
write the output slot or grant runtime/build/G1 acceptance. Current metadata
cannot reconstruct which predicate failed first in the original capture. Any
repair or more invasive probe needs its own bounded author/reviewer scope.
