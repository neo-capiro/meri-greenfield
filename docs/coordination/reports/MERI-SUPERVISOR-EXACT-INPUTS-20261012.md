# Exact supervisor inputs still needed

The immediate relay request is **two already identified members**, not another
generic packet. The selected Meri staging directory currently has 11 files,
including verified provenance/source-review and only a derived candidate-delta
record. The complete candidate member and comparison source are not staged here;
this does not dispute that the parent's separate reader materialized them.

| Relay now from that reader | Exact original identity | Why |
| --- | --- | --- |
| `candidate-hash-and-paths.json` |60,160 bytes; SHA256 `1817c1d72c2bbfafba943d0cbff4314ac210694a481565b5036a986087659d84` | The executable before/after comparison and complete opened-handle/hash record were truncated in this lane. The derivative does not retain original JSON pointers, so naming guessed subfields would be misleading. |
| `collect.ps1` |23,776 bytes; SHA256 `729298afadd57a97fe8325ff862d0e208befd9392b4befa5f91053dddfcd25e1` | Read the actual equality checks and construction of the reported stability/acceptance booleans. Do not execute or compile it. |

Bounded lossless chunks of these exact members are sufficient. Do not resend
`existing-run_supervised.py`, `supervisor-source-review.json`,
`provenance-and-bindings.json` or the unchanged diagnostic: their required
current bytes already match. The two verified JSON records are 6,659 bytes /
`71bb9b1ae8648c51ffeccc79d78dd6134445df55aea023089ddd1f93f6aac613` and 15,241 bytes /
`983c22b7aaf0578b148579ca009c6d23603f4ab760b85936013b7e8991963c06` respectively.
Request `NativeMetadata.cs` only if the actual comparison source reveals a
specific unresolved native-identity dependency; it is not part of this immediate
request.

The local `visible-candidate-differences.derived.json` explicitly records
`$.fullMemberPreservedOrVerified:false` and
`$.actualComparisonSourceAvailable:false`. Its visible changes cover
`LastAccessTime` for root/Lib/DLLs ancestor ordinals 1–3. It cannot recompute the
truncated executable comparison or prove those are the only changes across the
full member. The canonical inventory identity compares modification and change
timestamps (`st_mtime_ns`, `st_ctime_ns`) and excludes access time (`st_atime_ns`).
That unchanged predicate is separate from the unresolved private comparison
script. The reported four booleans are preserved under its
`$.reportedBooleans`; those are derivative field paths, not invented original
member paths. No invariant is changed by this mapping.

The following are **separate wrapper-binding inputs**, not missing portions of
those two members. The 13-member ZIP list does not contain their complete bodies.

| Exact input | Fields consumed or smallest follow-up | What is already known |
| --- | --- | --- |
| Original `originals/collector-command/receipt.json` | `$.retryAllowed`, `$.exitCode`, `$.sourceCommit`, `$.sourceTree`, `$.cwd`, `$.argv`; repository and the value after the unique `--output` must match the action. | 1,407 bytes / SHA256 `9b0b0633ce4f1bec0c59fa4acc8e1637f7236a1e1b87a4a5e2aae3fcbc302842`. Its reference is received; it is not the nested 2,206-byte ancestor receipt. No need to ask again for its known pin. |
| Original `originals/source-verification.json` | First return its **byte count, SHA256, `$.files` length and row-key/path shape**. The wrapper consumes `$.files[*].{path,bytes,sha256}` with repository-relative paths. No source-file bodies are requested. | Its own identity/schema is absent. The referenced `source-and-input-verification.json` is a different record. If the actual list has 1,538 rows, the current 256-row ceiling requires a reviewed source repair; dropping rows is invalid. |
| Existing prior audit `source-and-input-verification.json` | From the exact referenced record, return `$.priorEvidenceFileCount` and `$.priorEvidenceFilesUnchanged[*].{path,bytes,sha256}`, with its coverage boundary. | 42,321 bytes / SHA256 `fbce57f071e94db5e7ceff03141fdc7bd9467e5b205965d45f93ae1fcd740400`. The verified current supervisor source writes these fields, but this referenced body is not here and historical wrapper identity was not pinned. Inspect before treating it as an inventory. |
| Git executable already named in provenance | If already recorded, return the **byte count, SHA256 and installation/distributor provenance for that same executable**. | Private path is present at `$.currentGitPins.executable` and `$.currentTrackedStatus.executable`; those objects contain command observations but no executable size/hash. No new hash measurement or target execution is authorized here. |

The adapted wrapper requires `priorManifest.$.files[*].{path,bytes,sha256}` with
absolute original-evidence paths. The new ZIP manifest instead contains
`$.files[*].name` for 13 packet members. Neither that list nor an unreviewed
projection of the earlier audit can silently fill `PRIOR_MANIFEST_SHA256`.
The audit may identify an existing inventory, but its coverage can end before
later evidence was created. The mapping names the exact record/field to inspect
rather than requesting an unspecified new inventory.

The nine private action fields are fully mapped in
`author/exact-inputs.json`. `selectedExecutable`, `script`, `cwd`, `repository`
and `originalOutput` have existing proposal values; the original receipt reference
is also present. `sourceVerification` has a fixed location relative to that
receipt, with missing identity/schema. `priorManifest` has no established
complete bound record, and `destination` needs a caller-designated and authorized unused path. Its directory
must not pre-exist: the wrapper reserves it with `mkdir(exist_ok=False)` before
calling the writer. The occupied historical slot cannot be reused. The selected Python's 91,648-byte
hash is already known; it does not authenticate its distributor or full runtime.

No further relay can by itself supply a qualified enclosing watchdog, native
physical-exit proof or one-action execution permission. Those remain distinct
from missing JSON fields. Source/Git/preservation pins stay unchanged, and no
wrapper, inventory predicate, native target or admission was altered or run.

This report is based on PR18
`6cfb1f9a4d8acd66c5bd8d38d892d656fa3cd89e`, exact local data hashing and AST-only
source inspection. The supporting machine map and staging inventory contain
only roles, names, sizes and hashes; all personal paths and private bodies remain
outside Git. Data/AST consistency checks passed 23/23; inspected sources were never imported, compiled or executed. Independent review is pending.
