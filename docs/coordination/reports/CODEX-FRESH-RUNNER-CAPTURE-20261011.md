# Fresh runner capture source return — 11 October 2026

**SOURCE_ONLY_RETURN_FOR_PRIMARY_REVIEW. Actual Windows collection, runner acceptance and executable build wiring remain UNRUN.**

Base `19d64a1b5446337ad10a0068229164133756a073`, tree `63af3468f319fc07ecb16cd71fc01f546654f759`. Implementation outline: [task](../tasks/CODEX-FRESH-RUNNER-CAPTURE-20261011.md). No legacy helper, tuple, pin, authority, dependency or execution path was modified.

## Implemented ownership and behavior

`worker_runner_inventory.py` owns filesystem enumeration, streaming SHA-256, before/open/after identities, selected-member rescans and exclusively owned result files. Selection covers actual executable, base-prefix `Lib/**/*.py` excluding site-packages, root DLLs, `DLLs/*.dll/*.pyd`, and canonical helpers. Helpers derive from the existing builder `HELPERS` plus binding and the two capture modules, forming an explicitly new 12-helper measured profile. Historical `HELPERS` is untouched.

Bounds are 20,000 selected files, 80,000 directory entries, 16 MiB per file, 256 MiB selected aggregate, and a 60-second capture deadline. Reads stream in 64 KiB chunks. Missing/extra/casefold members, links/reparse points/hardlinks, file or directory identity changes, malformed helper paths, bounds and deadlines refuse. The complete selected snapshot is measured before and after the local CLI version step. Output is a new fixed-name slot; files receive exclusive creation, fsync and exact readback. Failure cleanup removes only files created by the call with matching identities; foreign files or substituted directories are preserved and incomplete cleanup is a refusal. Borrowed runtimes, parents and source files are never deleted or written.

`worker_runner_capture.py` composes actual `sys.platform`, executable, base prefix and version, refusing anything except actual win32/Python 3.11.15 before host inspection, native invocation or output allocation. Configuration requires an absolute fresh `.task-inputs/worker-runner-capture-<name>` slot and `--read-only-host-capture`. The sole native command is canonical `C:\Program Files\Amazon\AWSCLIV2\aws.exe --version`, with a five-second process bound, 64 KiB per stream and owned subprocess/reader teardown. The subprocess receives only SYSTEMROOT and fixed no-metadata/no-retry/pager controls; no credentials, proxy values or environment dump are copied into observations. CLI help exits 0; configuration/host/capture refusals exit 2.

Observations retain runtime/files, helperFiles and AWS CLI executable/version/hash metadata, not file bodies. Expected account/profile/caller are explicitly expectations: `callerObserved:false`, with separate canonical STS evidence required. Every runner/build/scan/runtime/G1 admission flag remains false, and AWS request count is zero. This collector does not authenticate, inspect credential stores, submit a build, consume approval, modify a fence or call a provider.

## Coverage and verification limits

This is a **selected runtime inventory, not a complete executable closure**. Existing `.pyc`, installation/stdlib ZIPs, non-Python stdlib data, venv/registry startup configuration, native dependencies outside selected sets and OS/ACL state are explicitly excluded. `-B` prevents bytecode writes, not necessarily reads. `completeExecutableClosure`, loaded-native/OS/ACL qualification and whole-Hermes flags remain false. Only the AWS CLI executable is hashed; its whole installation is not qualified. Primary must close those missing boundaries before any runner/build admission.

Twenty-one source tests PASS. They cover synthetic exact observations, wrong host/version/configuration, no output before refusal, borrowed and dangling output preservation, symlink/reparse/hardlink/casefold/missing/extra paths, file mutation and rescan changes, byte/member/time limits, version failure/output limits, executable/runtime changes, output readback corruption, substituted-directory preservation and owned-only failure cleanup. Real local Python-child fixtures verify stream overflow, timeout, physical exit, closed pipes and minimal subprocess environment; these fixtures do not run AWS CLI or establish Windows behavior.

Six bounded command receipts have expected results: source tests 0, help 0, missing configuration 2, Linux host refusal 2, guarded import 0 and whitespace 0. Import inspection blocks process/socket/data-open/directory-allocation calls. Source file hashes before/after verification match. No AWS, network, Docker, provider, SQL, production edit or remote publication occurred. The initial attempt to allocate the already-created branch/worktree was refused; the existing clean exact-base allocation was used without changing it.

Earlier 20-test receipts are preserved under `earlier-source20/`; final receipts bind the 21-test source. Raw local stdout/stderr, command bounds and tested source-file SHA256 are in [evidence](../../qualification/candidates/fresh-runner-capture-20261011/checks.json). The new unittest module follows existing `test_worker_*.py` discovery naming. Actual native Windows capture and filesystem/ACL/loaded-native acceptance remain unrun.

## Exact shipper read-only command

After primary source review/publication, use a fresh clean checkout of the accepted capture source. The checkout's `.task-inputs` parent must already exist as a plain caller-owned directory. Choose a never-used output name; do not reuse a partial slot. From that checkout in PowerShell:

```powershell
& 'C:\Users\neoma\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe' -I -B -S scripts/qualification/worker_runner_capture.py --read-only-host-capture --output (Join-Path (Get-Location).Path '.task-inputs\worker-runner-capture-20261011-r1')
```

The executable above is the previously observed shipper path, not a newly verified executable identity. The script measures the actual interpreter it runs under and refuses a different host/version. Return the four result files plus this command's bounded owner stdout/stderr/exit receipt. A success is measured source-only evidence, not a build approval. Existing canonical STS acquisition, current source/context/authority assembly, complete execution closure, independent root binding review and exact-action/cost/cleanup authorization remain separate primary-owned prerequisites.


## Independent-review repair — 12 October 2026

The initial source commit `4b8bbe7c110db70079f011a2407d7d616e8ebfbd` is superseded for source review. Independent adversarial tests found that final output membership was not checked, later writes could corrupt an earlier readback, and a descendant holding inherited pipes could block buffered stream cleanup. Those findings were real; the original 21-test receipts remain unchanged as historical evidence.

`worker_runner_inventory.py` now brackets a final exact membership/file-identity snapshot around a complete fresh readback of every artifact. Every artifact must match its expected bytes/hash, every file must still have its originally owned identity, and the final directory/member metadata must remain stable. Foreign members refuse success and remain preserved by owned-only cleanup. A mutation during the final closure readback also refuses.

`worker_runner_capture.py` now uses unbuffered pipe handles with no reader threads: POSIX nonblocking reads or Windows `PeekNamedPipe` readiness inspection followed by available-byte reads. Both streams must reach EOF and the direct child must be reaped before returning. Execution polling is bounded by the requested maximum five seconds; direct-child cleanup has a separate maximum three-second wait. Parent handle close does not acquire a buffered reader lock. If the direct child exits while an inherited pipe remains open, capture refuses at the deadline with `VERSION_PIPE_EOF_INCOMPLETE; DESCENDANT_TEARDOWN_UNQUALIFIED`. Descendant processes are not owned, killed or declared physically cleaned up by this collector. Actual Windows readiness/close semantics and process-tree/OS/ACL qualification remain UNRUN; no runner/build admission is granted.

All original 21 test method bodies and assertions are retained. Twenty-five source tests PASS, adding foreign-member insertion, mutation by later fsync, mutation during final reread, and actual POSIX inherited-pipe fixtures for stdout, stderr and both. The fixture independently owns and cleans its process group; that is not a production process-tree guarantee. The independent reviewer's two output attack controls also PASS against the repaired source. Missing-configuration/wrong-host/help/import checks retain their expected results. Fresh raw receipts, source hashes and original-assertion preservation are recorded in [repair evidence](../../qualification/candidates/fresh-runner-capture-20261011/repair-20261012/checks.json).

This repair is **SOURCE_ONLY_RETURN_FOR_INDEPENDENT_REPLAY**. Actual Windows capture, complete execution closure and root-owned acceptance remain open. There were zero AWS requests, provider requests, remote Git writes or cloud mutations.


## Clock initialization cleanup repair — 12 October 2026

Independent review of `6f0a8c57e47f1f352198c3bdd4ae092b8bc45946` found that deadline initialization occurred after `Popen` but before its cleanup `try/finally`. A failing injected clock could therefore leak the newly allocated direct child and pipes. Deadline, buffers, EOF state and the cleanup helper are now initialized before process allocation; every subsequent operation is inside the owned cleanup region.

All original 25 test methods/assertions and prior raw/index evidence are retained unchanged. Twenty-seven source tests PASS. One new test proves a failing initial clock causes zero process allocation; another launches an actual local Python child and proves a later clock failure reaps that direct child and closes both parent pipes. Fresh command receipts/source hashes/preservation records are in [clock repair evidence](../../qualification/candidates/fresh-runner-capture-20261011/clock-initialization-20261012/checks.json). This remains source-only for exact independent replay: Windows behavior, descendant ownership and runner/build admission remain unqualified, with zero AWS or cloud activity.
