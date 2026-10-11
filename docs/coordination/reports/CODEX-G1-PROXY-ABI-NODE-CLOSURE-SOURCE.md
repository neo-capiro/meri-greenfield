# Profile3 source: measured Node library selection

Status: SOURCE CANDIDATE; NO NEW IMAGE SCAN OR NATIVE ADMISSION. Dedicated worktree `C:/dev/main/meri-greenfield-worktrees/g1-proxy-abi-node-closure-source`, branch `task/proxy-abi-node-closure-source`, base `a0554eb18ef7be1e2ab4b3fef8dacc57714aa26a`. The only owned paths are the ABI profile, its existing synthetic test module and this new report. AGENTS/implementation standards and affected canonical source were read; a proportionate outline was recorded before edits. No prior sealed worktree, pack, freeze, output or consumed marker was changed.

The retained actual profile-v2 JSON is 196697 bytes, SHA256 `8adf37f71af5df2c77525404416225faf96352e5913ddf73aea18122e22c8c66`, from `C:/dev/main/meri-greenfield-worktrees/g1-proxy-abi-v2-execution-preparation/.task-inputs/oci-abi-profile-v2-execution-1/abi-inventory/abi-inventory.json`. A byte-identical copy is retained as ignored DATA. No actual image CAS object or ELF binary was opened or reparsed here.

That JSON reports 15 Node DT_NEEDED strings. Five have no regular selected candidates: `libbrotlienc.so.1`, `libcrypto.so.4`, `libssl.so.4`, `libicui18n.so.78`, `libicuuc.so.78`. Its seven holds comprise those five missing-byte edges, missing package/license mapping, and unqualified native-loader/complete-notice verification. This is evidence of absent selected bytes, not proof the libraries are absent from the image or compatible when loaded.

## Source change and preserved boundaries

`scripts/qualification/proxy_oci_abi_inventory.py` deliberately advances `PROFILE` from `meri-proxy-linux-amd64-node-prisma-abi/2` to `/3` and appends exactly those five names to the existing finite library-family tuple. Existing numeric target suffix rules and the four fixed library roots remain unchanged. Optional `libicudata.so.78` is left unselected because this observed Node record does not establish it as a dependency; a future measured transitive edge can justify it separately.

No ELF parser, overlay, I/O reader, resource cap, deadline, source pin, root alias handling, exclusion or notice-package list changes. This adds no package identity/license inference for the new library names. It grants no filesystem, native or cloud authority. Existing OpenSSL3 library selection and all other old families remain available.

The profile still always returns `status:HOLD`, `runtimeAdmitted:false`, `nativeExecution:false`, `originalFirstStageHoldCleared:false` and `libraryCandidatesAreLoaderProof:false`. Its canonical analyzer still records dependency candidates and missing-byte holds; there is no second resolver or loader. Actual bytes, transitive dependencies, dynamic search semantics and complete package/license notices remain future evidence requirements.

## Checks actually performed

One focused canonical invocation used the fixed CPython 3.12.14 binary with `-I -B -S`:

`python.exe -I -B -S scripts/qualification/test_proxy_oci_abi_inventory.py`

The ignored `run-focused.py` supplied the fixed worktree and only SYSTEMROOT/WINDIR/TEMP/TMP, with a 60-second direct-child bound and binary captures. It measured five module/test files, copied actual JSON, Python executable and the runner before/after: all eight records were stable. The test module installs socket/process audit denial before candidate imports. This is Python audit enforcement and buffered direct-child supervision; it does not establish OS isolation, a streaming memory cap or a process-descendant guarantee.

Actual child 2026-10-11 01:54:29.712540–01:54:30.003070 UTC: exit 0, no timeout, 0.282 measured seconds. Unittest reported **22 PASS**, 0 failures, in 0.090 seconds: all 19 prior cases retained plus three new finite groups. The only changed old expectation is the intentional profile version label. Binary stdout is empty; stderr is 3074 bytes, SHA256 `76eca844586699d1802aa52280097ce53bcd2d351756c72cbd4ef53b179b8c84`.

New coverage checks the five literal families across four roots, inherited numeric target selection, unchanged default overlay selection, nearby unsupported versions, unrelated nested roots, nonnumeric suffixes, suffix length and ICU notice/data nonselection. A composed synthetic ELF Node with the five literal dependency strings first produces the exact missing edges; after synthetic regular candidates are supplied, its evidence contains their requested names, targets and ELF magic while all admission flags and package/notice HOLDs remain intact. These are generated DATA fixtures, not real Node or library execution. The existing composed synthetic23-layer output/exclusive-path fixture remains included; no actual 23-layer image scan ran.

There were no runtime test failures or retries. An initial multi-file apply_patch failed a context match before applying edits; the corrected patch preceded the sole test invocation. That tooling failure is disclosed separately from test results. No unrelated overlay suite, provider call, installation, Node/Prisma/SDK/native binary, AWS action, Docker build or operational admission ran.

## Pins, evidence and next gate

| Source | Bytes | SHA256 |
| --- | ---: | --- |
| proxy_oci_abi_inventory.py | 12466 | 3ff37f11d42fd545948eea17b555b2ca791363572c3652d0cc3a743f2efbd5c0 |
| test_proxy_oci_abi_inventory.py | 19342 | 9f477e07970ddb35ac82bfcdf64ef777bf92fdd650925ca844aaaadcc032d7bd |

The finite seal is `.task-inputs/abi-node-closure-source-1/FINAL-MANIFEST.json`. It retains complete changed/unchanged reader closure, original/final raw Git source copies, exact three-path scope, test streams/envelope and source/runtime/data pins. Raw inverse reconstruction proves the production delta is limited to its version and five added names, and all original test bodies survive apart from that version expectation. Source closure uses unchanged ELF `959d60f5e363763d7d48b586cbebb2f37cdfdb9f342b7a749ae4cbd9668be73d`, overlay `835082c6e70bb983f53c9d20227f804c6c930ef8eeb88b6ce8ea99d131abb86c` and I/O `ce6031a05b608b27eef56f4894bd797be362de3742988af9e71328421388264c`.

Independent owner review and a separately rebound/admitted offline scan are required to obtain these selected bytes. This source expansion does not resolve NOTICE_PACKAGES evidence gaps, claim real Linux compatibility, clear any first-stage HOLD or approve enterprise adoption. Real community assembly/generation, PostgreSQL/auth, TLS/current-ECS peer provenance, provider accounting and G1 remain OPEN; current Capiro/Meri is untouched.
