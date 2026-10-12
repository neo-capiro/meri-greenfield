# Native helper source independent review — 12 October 2026

**ACCEPT_SOURCE** for the canonical cooperative hashing repair and the complete,
content-free private helper analysis at author commit
`c67558c211ede5a41e903f09e73666b43867301b`, tree
`c6f4a99cae98151d51a725f57635302222c0a3d7`. **Native execution remains HOLD.**
This decision does not accept the private diagnostic, target interpreter,
physical cancellation, publication or a hard invocation deadline.

Reviewer `/root/memory_reviewer` froze nine criteria in `d7fe2834` before author
findings. The isolated review starts from PR20
`bf41cf69ebe892705cdd6f041dd2f1fb323048f5`. Findings and actual original source
failures were committed in `036fef50` before final acceptance. Reviewer changes
are confined to this report and `native-helper-20261012/review/**`.

## What the private source now establishes

Exact helper, collector and full candidate identities were independently verified:

| Member | Bytes | SHA256 |
| --- | ---: | --- |
| `NativeMetadata.cs` | 6,163 | `f551d7287611b982a93eebf02e93719bfdce355609bd7ca4f9cd546ae9bf0a4c` |
| `collect.ps1` | 23,776 | `729298afadd57a97fe8325ff862d0e208befd9392b4befa5f91053dddfcd25e1` |
| `candidate-hash-and-paths.json` | 60,160 | `1817c1d72c2bbfafba943d0cbff4314ac210694a481565b5036a986087659d84` |

`Same` is a conjunction of 13 exact field equalities: `VolumeSerialHex`,
`FileId128Hex`, `CreationTime`, `LastAccessTime`, `LastWriteTime`, `ChangeTime`,
`Size`, `AllocationSize`, `LinkCount`, `Attributes`, `ReparseTag`, `Directory`
and `DeletePending`. It omits the supplied `Path`, diagnostic `IdentityKind`,
and two flags derived from compared fields (`ReparsePoint`, `SymbolicLink`).

All 35 before/after pairs were evaluated against that actual field set. Twelve
fail: indices 0–2 in each of the executable, root, Lib and DLLs roles. The only
unequal compared field is `LastAccessTime`. All four named/opened executable
relationships and six-field path identity comparisons remain equal; the recorded
91,648 bytes match the opened size. Recomputing the collector conjunction
preserves its **false** acceptance result. The cause of the access-time changes
is not established. No waiver, timestamp restoration or alternate predicate is
selected. This completes the helper internals review that the prior packet
correctly left pending.

`Named` opens an existing metadata handle with read-attributes access and
read/write/delete sharing, gathers four sequential information classes and
uses scoped disposal. The composite is not an atomic snapshot or a retained
ancestor bracket. Basic and attribute/tag attributes must agree. Query buffers
are freed in `finally`; invalid handles retain their error before disposal.
The content handle instead requests generic read, read-only sharing and
asynchronous I/O. Both modes request open-reparse-point and backup-semantics.
Those are source requests, not independent observations of native enforcement.

`Hash` starts its stopwatch before open, but starts a full-duration cancellation
timer only after initial metadata and stream/digest construction. It checks the
original stopwatch before reads and synchronously waits on asynchronous reads.
Positive bytes are bounded by the cap and initial size. After EOF it performs
named and opened metadata queries before the final stopwatch check. Result
construction and cancellation/digest/stream/handle disposal follow that check;
the recorded elapsed sample excludes final disposal. Open, metadata, reads and
disposal can therefore outlast a cooperative limit. Scoped cleanup is source
behavior, not proof of actual completed native close or process death. The
helper does not require one link; canonical `plain()` still does.

The detailed method/line map and comparison records are in
`review/helper-source-data-analysis.json`. No private source was compiled,
imported or executed; no private body or personal path is published.

## Independently justified canonical repair

The private comparison is distinct from canonical Python identity, which already
compares modification/change times and excludes access time. That predicate,
plain-file checks and cross-API identity rules are unchanged. No equivalence
between Python timestamps and all native helper timestamp fields is asserted.

The original public `hash_file` let late EOF, final handle metadata, close or
final named metadata yield success; late ancestor/initial metadata/open could
also start later observations. Independent inert replay preserved **2 passed /
7 failed** and the exact original 13,224-byte source (SHA256
`7615e26a5d038ff2fa054cde3cdb04077def5636874f848c97e050dae9df03e9`).
Author evidence separately preserves **21 passed / 11 failed**. These are actual
baseline failures, not invented native observations or discarded test results.

The allocated repair checks the same absolute deadline after returned ports and
before success. Optional keyword-only `ancestors(clock, end)` arguments must be
supplied together; legacy calls without the pair retain their walk. The returned
file descriptor is owned before the post-open check and closes once through
`finally`, including late-open and clock-error cases. Cleanup may finish late;
it neither resets the deadline nor permits another observation. This refuses
late results cooperatively and does not interrupt a blocked syscall.

The exact final inventory is 14,190 bytes, SHA256
`093786b7a527ee56d598a5c6d7b273c69e7578b5656241cf4784e8f8327abb34`.
Only `hash_file` and `ancestors` change in the sole modified existing file,
`scripts/qualification/worker_runner_inventory.py`; the maintained inert test is
new. Static normalization confirms the original hash/identity/byte/result logic
and ordering after removing only the allocated timing checks and temporary
bindings. The original public signature, result shape, empty-file opt-in,
hardlink/symlink/reparse checks and named/opened stability remain intact.
All other baseline tracked files, including original tests, supervisor/writer,
source pins, manifests, contracts and locks, are unchanged. No private helper
implementation is copied into the canonical repair.

## Exact-freeze checks and limits

| Independent check | Result |
| --- | ---: |
| Unchanged deadline counterexamples | 9/9 PASS |
| Identity, byte, API and cleanup controls | 25/25 PASS |
| Git/AST scope and original-source preservation | 18/18 PASS |
| Pinned private data and derived comparison controls | 31/31 PASS |
| Author manifest member byte/hash integrity | 22/22 PASS |
| Maintained AST/fake-FS regression replay | 9 tests PASS |
| Unchanged author counterexample replay | 32/32 PASS |
| Author private field/data recomputation | exit 0; no stderr |

The 83 independent behavioral/data/static assertions and 22 manifest checks all
pass against the exact freeze. Draft replay receipts are retained alongside final
receipts. Maintained unittest output is ordinary successful stderr, not an error.
The author worktree was clean at verification. The final reviewer manifest binds
this report and all reviewer evidence, excluding only itself.

All execution was bounded host-side text/data work or AST-isolated **public**
functions with explicit in-memory filesystem/clock ports. Existing broader
capture/native-child suites were not run under this allocation. No target
interpreter, private helper/collector/supervisor, native adapter, database,
provider or cloud operation ran; no owned process remained after the synchronous
checks. G1 native/runtime acceptance, frozen L1, unavailable capabilities and the
139 original / 96 selected / 43 deferred, 14 bound-unavailable / 82 unmapped scope
remain unchanged.

Remaining actionable inputs are the exact original source-verification and
preserved-evidence bindings consumed by the accepted wrapper, admitted Git
executable identity/provenance, and a concrete qualified enclosing watchdog,
complete runtime provenance/physical-exit evidence and narrowly approved action.
The existing exact-input mapping remains authoritative; no complete packet resend
or helper resend is needed. Native acceptance remains HOLD independently of this
source acceptance. PostgreSQL metadata/setup stays paused until the environment
owner enables the supported normal route; no host, mirror, relay or local-PC
workaround was attempted.
