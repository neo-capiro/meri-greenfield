# Native runner capture: static diagnosis, 12 October 2026

**Actual failure cause UNKNOWN. Static source analysis only; diagnostic proposal NOT_NATIVE_EXECUTION_APPROVED.** No collector rerun, source instrumentation, pin change, AWS/network/provider call, image/build, Hermes process or frontend change occurred.

The parent reports one collector invocation on NEOMART under Python3.11.15 with `-I -B -S`, exit2 in approximately0.42seconds, empty stdout,60-byte original stderr and no four-file output. The parent also reports1538 verified files; the underlying manifest and what those files cover were not available to this author. These are reported observations, not independently inspected native results.

The expected Library archive is `libfile_1b8681bc826c8191840be9607beb82c5`, `aws-readiness-20261012-r1.zip`,247272 bytes,117 members, SHA-256 `44ff0a58cd5f6b34279d3844a84952bb498d5973c116127e4a8295cc9f5a9c65`. Supported materialization reportedly failed twice. This author has no archive bytes, readable native streams or independently verified archive identity. The parent owns that blocker; this report does not attempt an alternative download or infer archive contents.

## Outline and exact source

Read the collector and directly relevant owners from immutable local Git objects at `c225c4f6247c22c8906a23758477e431e3d88c15`; enumerate source-supported refusal stages; prepare a separate, bounded local diagnostic candidate that reads only original stream evidence or runtime/stdlib metadata. Preserve the source and native failure unchanged. The report/diagnostic branch starts at `5db2714b6dcbd3109c528e0afafcb654216133ca`; it owns only this report and the new candidate directory.

[Source analysis](../../qualification/candidates/native-capture-diagnosis-20261012/static-analysis.json) records exact Git blobs, bytes, hashes, relevant line numbers, the complete literal refusal vocabulary of the inspected modules and static checks. No product module was imported or executed. The collector's selected helper names derive from `builder.HELPERS`; `capture()` does **not** call `builder.pins()`. Therefore its normal capture path does not invoke the legacy Administrator/Python3.12.14 builder guard. Changing that guard would not be a justified repair for this unknown failure.

## What the reported symptoms establish

The generic caught-error message is58 ASCII bytes,59 with LF and60 with CRLF. Thus60 stderr bytes is consistent with Windows newline emission of `Runner capture refused/failed; no build authority granted.` at collector lines201–203. It does not establish that those are the actual bytes. The original bytes or the proposed bounded comparison must establish the match before attributing even this catch branch.

That branch collapses `OSError`, `ValueError` and `subprocess.SubprocessError` into one message. It loses the stage and exception detail. `VersionPipeBoundaryError` has a separate longer refusal. Argument-parser errors occur outside the capture try block. Without original bytes, no branch is accepted as the observed one.

No four-file output does not identify an early failure. The collector writes only after two inventories and the local AWS CLI version subprocess. `write_result()` then cleans its own files/directory on failure where ownership remains valid. A late write/fsync/readback/membership error can therefore leave no output. It also follows that missing output does not prove `aws.exe --version` was never spawned. The collector source makes no AWS API request, but local child execution and AWS API requests are different claims.

The reported0.42-second duration supplies no reliable stage boundary. Under a functioning monotonic clock, a full60-second capture deadline would not elapse in0.42seconds, but exact timestamps/clock evidence are unavailable.1538 verified repository or archive files, if that is what was counted, would not establish that the collector completed its selected interpreter/helper inventory.

## Source-supported possibilities; none is the observed cause yet

| Stage | Exact source checks that can refuse | Evidence needed |
| --- | --- | --- |
| Configuration | Collector37–45: actual `win32` and `[3,11,15]`, explicit flag/output, absolute output directly below the module-derived repository's `.task-inputs`, fixed lowercase slot grammar | Original argv/cwd/script location; current runtime values alone are not historical proof |
| Output preflight | Collector142–148; inventory46–63: every ancestor must exist as plain local directory, no link/reparse/UNC, output must not already exist | Original slot and ancestor metadata; preserve an existing slot |
| Initial selected roots/enumeration | Inventory102–170: base prefix, `Lib`, `DLLs`, repository; no selected links/reparse/hardlinked/nonregular files; canonical helpers; path/member/entry bounds and stable directory identities | Bounded current metadata; no copying installation or private file bodies |
| Selected-file size/read | Inventory66–98 and184–188: every selected file must have size1 through16MiB; aggregate at most256MiB; lstat/fstat identity and read stability | Current selected-size metadata first; original runtime bytes remain unobserved |
| AWS executable metadata/version | Collector151–162: fixed executable readable/stable, `SYSTEMROOT` present, local child starts, pipe APIs/read succeed, exit0 and exact version stdout grammar,5second/64KiB stream bounds | Separate reviewed diagnostic only if earlier metadata does not resolve next work; none proposed here invokes AWS CLI |
| Second inventory/serialization | Collector163–184: two snapshots identical, ASCII version decoding, observation at most4MiB, deadline | Would require separately admitted stage observation; no synthetic PASS substitutes |
| Result publication | Inventory215 onward: exclusive directory/files, fsync, same-file readback, exact membership and final identities; owned cleanup on errors | Original cleanup/output metadata or separately reviewed reproduction; no fresh slot creation proposed |

One concrete early hypothesis deserves a narrow metadata check: `inventory()` calls `hash_file()` without `allow_empty=True`, so **any selected zero-byte stdlib `.py` file deterministically violates the size predicate**. This includes an empty `__init__.py` if one exists in that actual selected installation. No such file has been observed on NEOMART by this author. The existing success fixture populates selected files with nonempty synthetic bytes; it cannot establish absence of empty files in the real installation. The report proposes no size-rule change and does not call this the root cause.

## Concrete proposed local diagnostics

[diagnostic-proposal.json](../../qualification/candidates/native-capture-diagnosis-20261012/diagnostic-proposal.json) and [inspect-local-metadata.py](../../qualification/candidates/native-capture-diagnosis-20261012/inspect-local-metadata.py) are reviewable candidates, not execution approval. The parent must bind the exact original stdout/stderr paths, original output argument, repository location, reviewed script SHA and actual supervision method first. Those paths are not guessed here. Use the same known Python executable; do not repoint the original collector or overwrite its failed slot.

1. `evidence` reads only the two explicitly named original stream files, each at most64KiB; returns byte lengths/SHA-256 and exact-known-message comparisons. Unknown body contents are omitted, and original files remain untouched. A generic-message match still does not identify the failing stage.
2. Only if useful after reviewing that result, `metadata` reads `sys` values and lstat/scandir metadata for the original output parent/slot, Python base prefix/Lib/DLLs and selected stdlib `.py` entries. It omits site-packages and refuses links/reparse points. It reports zero/oversized/nonregular/multiply-linked selected `.py` files without opening their bodies. It never imports the collector, runs AWS CLI, performs a collector inventory/hash replay, writes a result slot or tests write permissions.

Both modes are stdout-only, one Python process, no subprocess/threads, no network/provider/database calls, no credentials/environment dumps, no file changes, no pyc writes (`-B`) and no site initialization (`-S`). The metadata mode checks a10second monotonic deadline,80,000 directory entries,20,000 selected files and1MiB output. Filesystem operations themselves can block, so a separately reviewed existing supervisor must enforce an external15second bound and record direct-process exit; the internal deadline is not a syscall-preemption guarantee. Do not launch an unbounded command or invent a new native supervisor under this report.

No diagnostic has run on NEOMART. Metadata differences seen later are current observations, not reconstruction of the failed run. Even an observed zero-byte file would establish a current refusal predicate, not prove the original first failure. If these reads do not isolate the next source question, return their unchanged bytes/receipts; a more invasive stage probe or collector repair needs a separately scoped author/reviewer task, never monkey-patching this pin.

## Author verification and next owner

Static syntax/AST checks, exact source hashing, message lengths, no-collector-call/no-subprocess/import inspection and allocated-path/staged whitespace checks are recorded in [checks.json](../../qualification/candidates/native-capture-diagnosis-20261012/checks.json). Eight local synthetic diagnostic tests passed; the earlier six-test result is preserved separately. They are static/source checks only. Parent review and native diagnostic admission remain pending; the unreadable original evidence remains the principal blocker. Runtime/G1/image/build authority remains false.
