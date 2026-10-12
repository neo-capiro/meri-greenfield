# Native helper review and canonical hashing deadline repair

The exact private helper explains the original rejection: its `Same` predicate
compares `LastAccessTime`, and that is the only failed equality in 12 of the 35
before/after pairs. The operating-system cause of those changes remains unknown.
The rejection is preserved; no timestamp exception or native admission follows.

A separate, demonstrated defect in the canonical file hasher is repaired:
expired filesystem returns now cause refusal before another observation or a
successful result. The original absolute deadline, identity checks and owned
descriptor cleanup are retained. This is a cooperative source correction, not
interruption of a blocked syscall or acceptance of the private helper for use.

## Exact private source findings

All three original members independently match their supplied identities:

| Member | Bytes | SHA256 |
| --- | ---: | --- |
| `NativeMetadata.cs` | 6,163 | `f551d7287611b982a93eebf02e93719bfdce355609bd7ca4f9cd546ae9bf0a4c` |
| `candidate-hash-and-paths.json` | 60,160 | `1817c1d72c2bbfafba943d0cbff4314ac210694a481565b5036a986087659d84` |
| `collect.ps1` | 23,776 | `729298afadd57a97fe8325ff862d0e208befd9392b4befa5f91053dddfcd25e1` |

Helper lines 68–69 compare exactly 13 fields: volume and file identifiers;
creation, access, write and change times; size, allocation size and link count;
attributes, reparse tag, directory status and delete-pending status. `Path`,
`ReparsePoint`, `SymbolicLink` and `IdentityKind` are not directly compared.
The two omitted flags derive from compared attributes/tag. This distinguishes
the actual predicate from the earlier complete JSON equality calculation.

The failed pairs are ancestor indices 0–2 for executable, root, Lib and DLLs,
covering three distinct named paths. Every role's all-fields result is false.
All four executable named/opened pair comparisons pass, and the 91,648-byte
count matches the opened size. The recomputed opened stability, named/opened
agreement, executable stability, six-field path identity result and final
collector conjunction all match the record. The conjunction remains false.
Recorded successful before/after metadata observations remain inputs; the
operating system observations have not been independently recreated here.

`Named` obtains a separate metadata handle with read-attributes access and a
share mask permitting read/write/delete, then disposes it. `Hash` requests a
read-share-only overlapped handle. Both use open-existing, open-reparse-point and
backup-semantics flags. Native query buffers are freed in `finally`; failed
queries and invalid handles raise errors. Fixed native layouts/offsets are
assumed by the source and have not been qualified on a target runtime. A returned
path field is the supplied label, not a separately resolved final path.

Hashing starts a stopwatch before open, checks initial kind/size, creates a
64-KiB asynchronous stream and a later cancellation source, and synchronously
waits for `ReadAsync`. Positive counts are capped by the original size and byte
limit. Zero ends the loop. Before each read and after final named/opened metadata,
elapsed time is checked. The digest and result are then constructed before
structured disposal of cancellation source, digest, stream and handle.

These source checks do not make native calls preemptible. Cancellation begins
after setup using the full timeout rather than its remainder. A returned read
has no immediate elapsed check before hashing or EOF-following metadata. The
last elapsed check precedes result construction and disposal. Each collector
metadata pass has a separate stopwatch. The `ReadShareOnly` field is a constant
describing the requested mode, not independent proof of native enforcement.
Full invocation duration and physical exit remain unqualified. The helper also
does not independently require one link, although link count is compared;
canonical `plain()` continues to require one regular file link.

`helper-source-map.json` records method/line ownership, flags, failure paths and
limits without private bodies or personal paths. No private implementation was
copied into Meri or executed, imported or compiled.

## Canonical correction and preserved behavior

Base PR20 is `bf41cf69ebe892705cdd6f041dd2f1fb323048f5`. After independent
counterexamples, root allocation `5b770a1` permits only the two relevant functions
in `scripts/qualification/worker_runner_inventory.py` and a new maintained test.

Previously, `hash_file` checked time before each read but could accept late EOF,
final handle metadata, close or final named metadata. A late ancestor/initial
metadata/open operation could also lead to further observations. The exact
original source and raw failing results remain under this author packet.

`hash_file` now checks the caller's original deadline around filesystem
observations and before return. `ancestors` accepts an optional keyword-only
`clock`/`end` pair so each ancestor observation can obey that same deadline;
partial pairs refuse before observation, while existing calls without the pair
retain their behavior. A returned descriptor is assigned before the protected
post-open check. Its `finally` close happens exactly once even when open returned
late. Cleanup does not extend the deadline or permit another observation.

The `hash_file` signature and result schema are unchanged. Plain path, reparse,
regular-file/link, cross-API opened/named identity, per-API stability, byte bounds,
empty-file opt-in and hash semantics are preserved. The canonical timestamp
predicate still compares modification/change times and excludes access time;
this unchanged definition does not replace the private helper's predicate.
Enumeration, the supervisor lifecycle, wrapper/writer, immutable pins, existing
tests and earlier manifests remain unchanged.

## Verification and remaining gates

The unchanged author counterexample harness moved from **21 passed / 11 failed**
(exit 1) to **32/32 passed**. Its late-port event traces and exact original source
are retained. The maintained `test_worker_runner_hash_deadline.py` passes **nine
tests**, including each late port at and after expiry, no subsequent observation,
single owned cleanup, clock/port/close errors, optional ancestor API compatibility,
existing identity/growth guards, cross-API permission representation and empty-file
behavior. The helper field/data recomputation also exits 0 with empty stderr.

Checks execute only AST-selected public function definitions with explicit
in-memory filesystem/clock ports. Private sources, actual adapters, supplied
supervisor/diagnostic and target native operations remain unrun. Existing broader
capture tests include native child execution and were not run under this scope.
Independent review of the exact repaired freeze is pending.

The private source review is complete; executable/native acceptance remains
**HOLD**. Remaining prerequisites include exact original source-verification and
preserved-evidence bindings, Git executable identity/provenance, a qualified
enclosing watchdog and physical-exit evidence, complete native runtime provenance
and narrowly approved execution. No generic evidence resend or access-time waiver
is requested. PostgreSQL metadata/setup remains paused until the environment owner
enables the supported normal route; no alternative acquisition route was tried.
