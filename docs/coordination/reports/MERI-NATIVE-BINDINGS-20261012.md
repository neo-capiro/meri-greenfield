# Native binding and reserved evidence writer continuation

Status: **source candidate; independent review pending. Native execution HOLD.**
Base `263d0d174f9924a6030bb1c20100ff1115ffcda0`. The accepted supervisor
lifecycle and all previous checks, manifests and raw failures remain unchanged.
This continuation adds a writer for the existing reserved evidence directory
and narrowly composes it into the previous partial wrapper. No runtime,
diagnostic, native child, Windows operation, database or paid call occurred.

## Verified inputs and unresolved bindings

The private supervisor-source-review record independently matches6,659 bytes,
SHA256 `71bb9b1ae8648c51ffeccc79d78dd6134445df55aea023089ddd1f93f6aac613`;
the provenance/bindings record matches15,241 bytes, SHA256
`983c22b7aaf0578b148579ca009c6d23603f4ab760b85936013b7e8991963c06`.
These reproduce the parent's CRLF/no-final-newline original identities. Private
paths and bodies remain outside Git; only role/size/hash findings are recorded.
The current11,124-byte supervisor source remains verified, while its historical
execution source hash remains unpinned.

The verified records distinguish the1,407-byte original collector receipt from
the2,206-byte prior ancestor command receipt. Neither is the referenced42,321-byte
`source-and-input-verification.json` prior audit. That reference is not evidence
of the contents or hash of the original collector's separate
`originals/source-verification.json`. The provenance record explicitly says the
full1,538-file source hash audit was not repeated. Its Git status observation
excluded untracked files and ignored submodules; it does not replace a complete
clean-worktree check. The actual Git path is reported privately, but its byte
count/hash and helper provenance remain missing.

The13 manifest rows plus self-excluded manifest describe14 ZIP members, not a
complete original evidence manifest. The candidate-hash relay remains truncated
and the actual `collect.ps1` comparison source is not available here. Their
reported size/hash identities are recorded without claiming complete local
verification. No timestamp exception, full bracket acceptance, executable trust
or original-failure reconstruction follows. The actual original source schema
must be read before reconciling a potential1,538-row list with the current
256-row wrapper ceiling. Do not truncate the list or silently promote the
referenced audit summary into that input. Every missing source/Git/preservation
pin remains `None`, so the wrapper refuses before native work.

## Narrow source repairs

`native-bindings-20261012/author/evidence-writer.py` owns one specific responsibility:
write the fixed diagnostic artifacts into the exact already-reserved empty
directory. It validates expected names and finite byte/member limits; rejects
directory/file substitution; handles positive short writes explicitly; refuses
zero, invalid or erroneous counts; fsyncs and closes owned descriptors; uses
canonical inventory readback; and brackets final exact membership/file identities.
No source guard is replaced. Its semantics differ from canonical `write_result`,
which creates its own directory and may remove partial files: this writer retains
every partial file and never deletes, overwrites, renames, retries or selects a
fallback directory after failure.

All operations share the wrapper's original total budget. The writer checks
immediately after returned ports and before the next operation, including directory
context entry and enumeration. It records bytes already returned by writes even
when late, without permitting another write. An acquired owned descriptor may
receive one best-effort close after deadline; this does not extend the deadline
or permit another action. Native operations can still block, and neither this
source nor an injected clock establishes a hard wall-time guarantee.

The prior wrapper now composes the exact writer with its existing budget,
inventory and reserved identity. Its final publication observations return to
the enclosing owner; the written command receipt does not certify its own
post-write readback. `evidencePublicationVerified`, `nativePublicationQualified`,
`hardTotalProven` and runtime/G1 admission remain false. Inert-port observations
cannot qualify native publication. The enclosing owner still needs to preserve
the final result and observe the entire invocation's physical exit, including
startup and blocked calls outside the cooperative function clock.

The additional approved Git edit adds `--no-optional-locks`,
`core.fsmonitor=false` and `core.untrackedCache=false` to prevent optional index
refresh and configured filesystem-monitor/cache behavior. Full
`--untracked-files=all` and existing submodule semantics remain. No actual Git
binary path was invoked and no executable identity was invented.

## Checks and preserved failures

Author checks parse the native wrapper and native write adapter as AST only.
Only the new writer's exception class/function and literal caps enter an isolated
namespace; files, descriptors, inventory results and clocks are in-memory ports.
No `NativeWrites`, native wrapper or target diagnostic is imported or executed.
The first and repaired author captures pass46 controls, including short writes,
timeouts, partial preservation, identity substitution and source composition.
The final author capture adds the explicit reserved-mkdir/no-follow composition
mapping and passes47 controls.

Independent controls are ongoing. The first150 assertions passed; an added final
clock-boundary control produced150 pass/1 fail because two final clock samples
could report a matched result beside zero remaining time. The repair uses one
final observation for both fields. The next added late-fstat control produced
151 pass/1 fail because a named metadata call occurred after fstat returned late;
the repair checks immediately after fstat. An unchanged historical draft replay
with both late-fstat and late-directory-enter controls recorded154 pass/2 fail.
The corrected writer SHA256
`8715d7999e4c9d7ab1422f7360a6a9cff5053da57687dacda861ef69d5e42afc`
then passed156/156 independent assertions. The reviewer preserves exact exercised
drafts and raw failures. Final exact-freeze composition/integrity checks and
verdict remain pending, without erasing those earlier observations.

The unchanged historical source-checks replay against the newly composed wrapper
fails its `exclusive-evidence-allocation` placement assertion: it expects the
literal `.open("xb")` inside the wrapper. The exit1 traceback is preserved under
`author/historical-location-check.*`. That historical candidate check remains
valid for its original freeze and is not edited or skipped. Its intended
exclusive-allocation property is covered here by actual reserved-directory
creation, delegated `O_EXCL`/`O_NOFOLLOW` source and behavioral no-overwrite
controls. No dead code is retained to satisfy the old implementation location.

This is an independently reviewable source improvement with explicit missing
bindings, not a runnable final action packet. Exact source verification/evidence
membership, Git identity, full candidate predicate, fresh destination authority,
an actual enclosing watchdog, native publication observations and one-action
permission remain required. No collector retry, build or G1 acceptance follows.
