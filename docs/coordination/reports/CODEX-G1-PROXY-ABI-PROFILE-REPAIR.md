# Offline ABI profile repair candidate

Base `595920e989d088972351db3999aada38d18bf6b9`; branch `task/proxy-abi-profile-repair`; dedicated worktree `C:/dev/main/meri-greenfield-worktrees/g1-proxy-abi-profile-repair`. Proportionate outline was recorded before code at `.task-inputs/abi-profile-repair-1/OUTLINE.md`. Exactly four tracked paths are owned: this report, `scripts/qualification/elf_inventory.py`, `proxy_oci_abi_inventory.py`, and `test_proxy_oci_abi_inventory.py`. This is a reviewable source candidate, pending independent review and owner acceptance.

## Changes and canonical boundaries

The existing ELF module remains the sole bounded ELF/virtual-link DATA reader. Its dynamic string-table ceiling is now the fixed **2,097,152 bytes**, replacing 1,048,576. The owner-reported retained Node measurement is DT_STRSZ **1,412,444**, one STRTAB/STRSZ, and 15 strings. A synthetic ELF with that exact table size and 15 distinct needed names exercises the repaired boundary; the test also accepts exactly 2 MiB and refuses 2 MiB + 1. This task did not independently parse or execute the retained Node binary. All other ELF limits remain unchanged, including 128 MiB file size, 512 program headers, 65,536-byte dynamic segment, 256 strings and the per-string bound.

`resolve_virtual` now walks observed directory prefixes before the final entry, resolving relative and absolute image symlinks through the inert final overlay map. It never queries the host filesystem, creates links or loads native code. It preserves the existing 4,096-character path/target and 32-iteration bounds, detects cycles/escape/depth, and refuses observed non-directory ancestors. Missing intermediate entries may represent implicit archive directories; the final regular entry must actually exist in the supplied map. Hardlinks used as directory parents, or hardlink targets passing through symlink parents/targets, remain ambiguous and return HOLD. The reader also refuses lexical `..` collapse through an observed non-directory/link prefix; it does not substitute lexical normalization for inode semantics. This conservative final-map analysis is not an emulation of a dynamic loader or historical tar hardlink creation.

The ABI profile advances deliberately to `meri-proxy-linux-amd64-node-prisma-abi/2`; the ELF dependency pin changes to the repaired module. The other dependency pins remain exact. Selection adds only the literal basename `libz.so.1.3.2.1-motley` within the existing four library roots, plus those four root names themselves to retain actually observed directory/alias metadata. Similar names and suffixes remain rejected; there is no new broad filename family, Python tree or enterprise selection.

Link report records now retain original `path`, `kind` and original `target`; `resolvedTarget` separately names the established regular virtual target. Previously merging the resolver result overwrote the original link path. Directory-root alias metadata is recorded without claiming executable file bytes: an unresolved/non-regular root alias is visible in its link status/chain, and regular dependency candidates still require an observed final regular row with selected bytes. Root aliases themselves are not counted as missing executable files.

Overlay/compressed IO owners and default selection remain byte-unchanged. No shared contract, old freeze, admission, reservation, output or source pack was edited. Every result remains `status=HOLD`, `runtimeAdmitted=false`, `nativeExecution=false`, `originalFirstStageHoldCleared=false`, with the existing unconditional native-loader/complete-package-notice qualification hold. Version 2 fixes verifier gaps; it does not qualify Linux compatibility or notices.

## Retained DATA and provenance limits

The actual prior inventory at `C:/dev/main/meri-greenfield-worktrees/g1-proxy-oci-abi-windows-audit-repair/.task-inputs/oci-abi-win32-audit-repair-1/abi-inventory/abi-inventory.json` was measured and copied byte-exact into this task: 135,359 bytes, SHA256 `267669a088bd7b1531f6644e593a1df725581bddda210b526fbdbe4e9661fa17`. It records Node size/hash and its old `ELF_REFUSED` string-table hold, the original `usr/lib/libz.so.1` link target, and the old overwritten links identity. It provides no selected library-root alias rows. Therefore this task does **not** infer `/lib64`'s target, manufacture loader bytes, clear its dependency hold, or claim the new profile has been measured against the 23 real layers. The literal motley target is selected for a future admitted scan; retained regular target bytes, package identity and license mapping still require that evidence and review. Historical acquisition, first-stage HOLD, prior ABI output and failures remain unchanged.

## Checks actually run

Fixed Python 3.12.14 executable path, `-I -B -S`, curated SYSTEMROOT/WINDIR/TEMP/TMP environment:

```text
C:/Users/neoma/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe
  -I -B -S scripts/qualification/test_proxy_oci_abi_inventory.py
```

The test's audit guard denies socket/process dispatch before candidate imports. A first focused run passed all 18 tests. Final source review identified the link-parent/`..` ambiguity and added one source refusal plus a meaningful permanent negative/positive control; this source change justified the final fresh run. It passed **19/19**, preserving all 12 original ABI cases and adding seven groups. No test failures, skips or weakened expectations occurred. Both run envelopes/raw binary streams and before/after identities remain under `.task-inputs/abi-profile-repair-1/`; final evidence is in `final-source-2/`.

Final run: `2026-10-11T01:38:05.171286Z`–`01:38:05.386091Z`, 0.218 seconds under the external 60-second direct-child bound, exit 0, no timeout. Unittest reports 19 tests in 0.069 seconds. Stdout is empty; stderr is 2,606 bytes, SHA256 `2b91343af29e8272aa2d183ac88e1a99badb703309c835b0c86a69332b9f74f5`. All eight recorded source/input/runtime/supervisor identities match before/after each run. This binds the five local implementation/test source files, retained DATA, Python executable and runner; it is not a complete OS/native-loader runtime freeze.

Coverage includes measured-size/exact-limit/over-limit and unchanged string-count refusal; directory symlink nesting/absolute/relative resolution; missing target, cycle, depth, escape and non-directory refusal; hardlink-parent and target ambiguity; parent traversal ambiguity; exact literal profile selection; original link identity versus resolved target; default overlay selection preservation; source drift before output; missing/existing output refusal; package metadata refusal; and composed **synthetic** 23-layer output exclusivity/HOLD. The unchanged separate 22-test first-stage suite was not replayed; this suite's existing default-selection and composed controls remain intact.

No real 23-layer scan, acquisition, native SDK/image import, engine/Node execution, installation, database/server, AWS, provider or model call occurred. Captures use a direct-child timeout and buffered streams, not a stream memory cap, descendant-process guarantee or OS network namespace. The final finite seal binds complete local source/report bytes, canonical unchanged dependencies, original Git blobs and raw test evidence. Trusted checkout/file reads do not provide hostile-filesystem or atomic snapshot guarantees.

## Next gate

The integration owner must independently review exact source and tests, then prepare separately versioned source/freeze/admission/output bindings for any offline real-layer scan. Only an admitted scan can establish observed root aliases, regular motley/loader bytes and the repaired Node ELF metadata. ELF candidates still require complete ABI/package/notice analysis and later actual isolated Linux/native qualification; no runtime or G1 gate advances here.
