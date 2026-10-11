# Browser read-only clock-free preparation

READY for root DATA review, with no operational authority. Worktree `C:/dev/main/meri-greenfield-worktrees/g1-browser-readonly-clockfree-preparation`, branch `task/g1-browser-readonly-clockfree-preparation`, base `6ca1219ccbda3ea5790f7524a9b47bc48a044d66`. The only tracked change is this report. All preparation artifacts are in `.task-inputs/browser-readonly-clockfree-preparation-1` (E).

This closes the two concrete DATA gaps from owner-preparation commit `f2255d840d1fd475a0feefc25fe3c3f400c7f86a`: actual staged bootstrap/recipe/map bytes and the full canonical graph/two request hashes. No proof UUID, nonce, proof clock, owner source decision, freeze, admission, supervision, consume or operational output was created. Process observation timestamps in the receipt are not proof clocks. No AWS, TestState, native CLI, Node, browser, Docker, provider or resource action ran. Bounded Git and Python DATA helpers ran.

## Existing staged files versus future path DATA

Actual staging directory is `E/staged/bootstrap-provenance`. Fixed future OWNER remains `C:/dev/main/meri-greenfield-worktrees/g1-browser-wire-shape-repair/.task-inputs/browser-wire-owner-actions-1/post-bootstrap-readonly-1`. It was absent before and after the only planner child. No file was written there. Each copied record inside the staged recipe and canonical copy map points to **future** `OWNER/bootstrap-provenance`; those internal records are preparation DATA, not claims that the destinations exist.

| Actual staged filename, also planned future filename | Bytes | SHA256 |
| --- | ---: | --- |
| definition.json | 21935 | 9520767a9e6a5a2d31e0d77ab4fca81bba5f9acfc60dad0f2b1d4828b8920958 |
| input.json | 226 | d83ca7c63b9f2f5c4932b3c16beee8eddc3f51e52de2e1738abdb75a971fe5c4 |
| history-0-request.json | 250 | bd5a819cfc5318bc1bec6009836984ab74d1078247a95cc3e2902f29528695f1 |
| history-0-response.bin | 175047 | be31f22f8d9dde43eda94e1a2a6da33b3904d7a337902d4218611f932f1a9d03 |
| managed-recipe-REVIEWED.json | 4132 | a35cd6b2b08b4d7df7152c12f8c4131892d68d5207001d27e1db1a4149a8c450 |
| recipe-copy-map.json | 2939 | fe9a8d9dcf31949fce95ed1cb12c9ffe7f8ae790bece7951b807314b50043331 |

The first four are byte-exact copies of the original genuine bootstrap operation in `g1-browser-bootstrap-execution-source/.task-inputs/browser-bootstrap-execution-source-1/operation`. Its original recipe remains4047B/SHA49126c03ea3c6869b25208d49b4da988482c81220ad0c137beac1b3805764966. The response's original filename is `history-0/stdout.bin`; its future/staged filename is `history-0-response.bin`.

The relocated recipe preserves exact capture/expected/originalClock/volumeId keys and changes only four nested path values: definition, input, sole history request, sole history response. An inverse four-path substitution equals the complete original parsed recipe. Descriptor, pins, history record bytes, seven expected identities, volume and clock remain unchanged. The new raw recipe hash deliberately differs from the original. The filename REVIEWED is the canonical required future filename; it confers no review or authority by itself.

The canonical mapping is exactly schema/originalRecipe/copiedRecipe/files, schema `meri-browser-post-bootstrap-recipe-copy-map/1`, four ordered original/copied raw records. Original records retain their exact original path spellings. The copied recipe record and all copied file records use the future OWNER paths, with hashes/sizes measured from actual staged bytes. `COPY-MANIFEST.json` separately binds each actual staged path to its future path and records futureExists:false. It is5483B/SHA c229aee14210cdc7982556586cadec08fbe7a139dc37117a23dbb0ec02a94226. Root must independently verify/copy those exact six files; this task does not run the operational recipe validator against nonexistent destinations.

Historical identity remains run `b247b9a1-bfde-414a-a76b-9ff4fdd83110`, volume `vol-0fd44f9ef252181aa`, immutable fixture version:1/execution, managed fixture role and ownerBindingId9066691d8e72a4ab6aadd1fe364fac5f0f8b6c92359a96f3f2677df134b8d3aa. Original clock stays `{t0Ms:1791706164910,createNotAfterMs:1791706464910,C:1791707064910}`. It is expired historical DATA; no clock reset or cleanup claim is supplied. The managed fixture role stays distinct from the TestState read-only role.

## One accepted canonical planner invocation

PACK is `C:/dev/main/meri-greenfield-worktrees/g1-browser-post-bootstrap-probe-import/.task-inputs/browser-post-bootstrap-readonly-source-2`, source commit `732b88ded368b5f0e134d8988785a5a7fb5c26dc`. Root's accepted import-repair decision and prior owner-preparation report are finite pinned references. Accepted executor closure is384718B/SHA34674a744fa155189d547d14a18d1b546078c8ac11c6cfafe3620c35df0cfd19; parent closure remains1238B/SHA c53a27bb31d96f534b0226dc415234de9903e77513cdf2767598bd2c2706db9c. No closed pack was edited.

The fixed child pins the accepted executor bytes before private compilation, calls the accepted `entry.binding()` bootstrap and `binding.check_sources()` with the exact external closure hash, then uses canonical ordinary imports only from the membership-closed source10 directory. It invokes `prepare_fixtures.build_post_bootstrap_readonly(volumeId)` exactly once and `managed_probe.request_sha` on each returned complete request. No copied planner/hash algorithm, alternate loader, probe execution, bridge, owner validator, clock validator, role action, Capture instance or operational main is used. `planner-result.json` records the exact imported module paths.

The accepted preflight verifies all1031 closure records,969 runtime names, runtime/external record equality and closed source10/bridge-source/supervisor membership. The same canonical pin reader rechecks all1031 records after planning. `source-before.json` and `source-after.json` retain the complete verified records; their arrays equal each other and the accepted closure. Python executable106448B/SHA10d845f50a2af64e3500bb2fcb348b5bc98a75d8ddada63e45ba1da6a1fc79d1, version3.12.14 with isolated/no-bytecode/no-site flags, is also separately pinned before/after by the supervisor. This is current byte verification, not a new qualification of every runtime behavior.

Canonical `graph.json` is the full JSONata graph. StartAt remains SourceOnlyRefusal, both task timeouts15s, no Retry, and only describeInstances/describeVolumes resources. Both complete requests include that identical graph string, fixed read-only role `arn:aws:iam::967807252336:role/MeriGreenfield-BrowserWireReadOnly-20261010`, input`{}`, DEBUG inspection, revealSecrets:false.

| Complete request / canonical stateName | Canonical request_sha |
| --- | --- |
| DescribeInVpc | 6a0faaed437531c8bf674e3378296da5334715d05a3352aa6a07ee2f5198d223 |
| DescribeRetainedVolumeByFilter | 658d949c15880ffa787d39cdcfb93b49fdb6e8db4c43abb5627aca695b505655 |

`DescribeInVpc-request.json` uses vpc-id=vpc-06e1941747e798f0a and owner-id=967807252336,MaxResults5. `DescribeRetainedVolumeByFilter-request.json` uses exactly volume-id=vol-0fd44f9ef252181aa,MaxResults5. No VolumeIds exception path, tags/state/AZ filter, mutating action, graph override or response/absence interpretation is introduced. Full compact request file hashes equal the canonical hashes above; these are hashes of the complete requests, not only arguments.

## Actual bounded receipt

One child ran10:15:48.910524–10:15:55.982447UTC on2026-10-11,7.062s, external60s, shell:false, exit0, timedOut:false/errorType:null. Fixed argv is pinned Python `-I -B -S E/planner-child.py`. Complete replacement environment is SYSTEMROOT=C:\Windows,WINDIR=C:\Windows,TEMP/TMP=C:\Users\neoma\AppData\Local\Temp; no inherited credentials/config/path/python overrides. `invocation.json` was saved before launch. Raw stdout1299B/SHA1f2f65b5de117bee51f59401c3ede535d8076a95a6db2b5b77db16dffeaf12ef; stderr0B/SHAe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855. `process.json`3927B/SHA491f3444108c6976389000813202ac53a3463cc0ba1f10c6dca15b946f0cf23a was saved with raw stream hashes and pre/post pins **before outcome assertions**.

An audit hook is installed before candidate imports and denies socket events plus subprocess/OS spawn/exec/system. Real socket construction and Popen attempts are stopped by it; retained denial events are exactly socket.__new__ and subprocess.Popen. No actual child process or socket was created by those controls. The one parent-owned planner child is the authorized supervised process. This Python audit policy is not OS isolation. Supervisor capture uses subprocess.run buffered pipes/direct-child timeout, not streaming memory caps or a Windows Job claim. Actual output was tiny and complete; no descendants were dispatched under the child audit policy.

Helpers were fully source-read before the one run. No failed candidate invocation or rerun occurred. An initial read-only lookup of the prior report in this new base found it absent; the exact prior worktree report was then read. That tool-trace lookup is not a planner failure or operational attempt.

## Root handoff and remaining authority

Before allocating any proof clock, root can verify the finite seal, actual staged six files, copy-manifest/map inverse deltas, full graph/two requests/canonical hashes, accepted source/runtime closure and historical stage chain. Root alone copies into the fixed OWNER, issues a source-owner decision, evaluates current caller/role/cost/risk, and later issues the separate proof-freeze/admission/supervision. All UUID/nonce/time fields remain unallocated here. Reuse the exact closed schemas and eleven-call sequence from the prior report: canonical seven-call current-role chain, STS+first TestState, STS+second TestState, zero continuations/retries. The future parent requires the accepted fixed command/four hashes and >530000ms entry reserve; mandatory runtime rechecks still consume that same later proof window.

Existing consumes, failures, bootstrap receipts and old original-C profiles stay untouched. The root may accept this finite preparation DATA; hashes do not authenticate capture origin or authorize dispatch. Actual filter response shape/decoder/empty-result absence remain unqualified. Historical cleanup stays UNKNOWN, physicalAbsenceProven:false, absenceWireQualified:false, runtimeAdmitted:false. This is not host/security/runtime or G1 acceptance.
