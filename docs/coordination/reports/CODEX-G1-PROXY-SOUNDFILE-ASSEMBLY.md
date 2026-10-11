# SoundFile Linux assembly — source candidate CLOSED

Pinned base: `1b31317095ab5a62a625e8e8b0f04c1db734d9a1`. Dedicated worktree:
`C:/dev/main/meri-greenfield-worktrees/g1-proxy-soundfile-assembly`, branch
`task/g1-proxy-soundfile-assembly`. Codex authored this bounded source preparation;
independent review and a fresh owner admission remain required. This is only a
candidate for bounded genuine Linux app-import qualification, not production,
security, license, native authentication or G1 acceptance.

## Recorded outline and exact ownership

Before edits, the outline allocated only five existing files under
`apps/proxy/qualification/linux/` (`assembly-pins.json`, `requirements.lock`,
`Dockerfile`, `assembly.test.py`, `README.md`) plus this report. Ignored evidence
is `.task-inputs/linux-soundfile-assembly-1/`. The implementation reuses the
canonical wheel/artifact/notice inventories and unchanged `prisma-build.py`
safe hashing/context checks. There is no new production interface or framework.
The planned checks were exact old/new selection/context relation, complete wheel
DATA validation and the existing24 offline tests plus focused new contracts.

## Narrow change

The selected SoundFile version remains0.12.1. The original universal wheel
`soundfile-0.12.1-py2.py3-none-any.whl` (24030B,
SHA256 `828a79c2e75abab5359f780c81dccd4953c45a2c4cd4f05ba3e233ddf984b882`)
is replaced only in this new candidate by the already retained official
`soundfile-0.12.1-py2.py3-none-manylinux_2_31_x86_64.whl` (1174746B,
SHA256 `074247b771a181859d2bc1f98b5ebf6d5153d2c397b86ee9e29ba602a8dfe2a6`).
No network download, resolver, package installation or wheel import ran here.
The original DATA discovery and its official URL/license evidence remain in
[CODEX-G1-PROXY-SOUNDFILE-PREREQUISITE.md](CODEX-G1-PROXY-SOUNDFILE-PREREQUISITE.md).

Both Python modules and full METADATA are byte-identical to the old wheel.
The other123 complete wheel records and requirement lines remain exact; the
requirements file has only the SoundFile SHA256 replacement. Its original uv
pylock pin is retained as historical resolution evidence, with an explicit
same-version artifact-selection supplement in pins/README rather than a claim
that uv generated this later selection.

Canonical wheel/artifact metadata now identifies the two manylinux2_31 x86_64
tags, ten archive members and largest member
`_soundfile_data/libsndfile_x86_64.so` (3607784B,
SHA256 `1c265077c2fff814919884222825d0d40cbea783d414796dea028e05ad811ed3`,
embedded string libsndfile1.2.0). The old BSD3-Clause notice is unchanged. The full
bundled `_soundfile_data/COPYING` LGPL2.1 text is added through the ordinary notice
inventory as `notices/soundfile--4b65dbd72ad2192b--copying` (26518B,
SHA256 `ad01ea5cd2755f6048383c8d54c88459cd6fcb17757c5c8892f8c5ea060f6140`).
Wheel notice count185→186; legalApproval remainsfalse and tokenizers remains
without a packaged notice. Corresponding-source/relinking obligations, bundled
native codec notice mapping and vulnerability disposition remain unqualified.
The explicit qualification hold/false field records that boundary; artifact
closure does not represent notice/security clearance.

The only Dockerfile change appends literal
`LITELLM_LOCAL_MODEL_COST_MAP=True` to its existing ENV before execution. Pinned
LiteLLM1.104.2 supports this setting and returns its existing bundled cost map
before the import-time pricing HTTP/retry path. The three network-none build
steps, signed Debian snapshot/base, original import audit/network/socket/process
denials, UID10001, entrypoint and resource/deadline expectations remain exact.
No downloaded live pricing table or alternate pricing implementation is added.

`prisma-build.py` and `import-probe.py` are raw-byte unchanged. All engine bodies,
sidecars, four concrete generated query-platform expectations, native-only schema
engine and original five-target schema are unchanged. No operational helper,
freeze, reservation or consumed E3 attempt was altered.

## Fresh artifact context and verification

Fresh context: this worktree's
`.task-inputs/linux-soundfile-assembly-1/context-artifacts-1/`.
Manifest: sibling `artifact-context-manifest-1.json`,69241B,
SHA256 `7dace8b26f08ed228b49dfea022aff90418891b85ea89cc52970ed74285fd2e8`.
It binds331 artifacts/273112858B. Exactly329 old artifacts are unchanged, one
old wheel is absent and the new wheel plus LGPL notice are added. Net change:
+1 artifact/+1177234B. The old330-artifact/271935624B context and manifest
`91dd2b9b171d3db7e1a170ab60b9599c244fb6e03b0ccfc7306573a37644824a`
remain untouched at the previously accepted remaining-engine worktree.

Copies used exclusive creation and1MiB streams; canonical safe-file hashing
checked each borrowed source before/after copy and each target. Canonical
`verify_artifacts` confirmed exact membership/hash/count. Windows native extended
paths were used throughout file I/O; longest relative artifact path is122
characters and longest ordinary absolute target path248. No partial/failed
context was overwritten and no link/extra member was accepted.

The retained canonical `check-wheel-records.py` was reused as an ignored DATA
checker with only two explicit path rebindings: selected-wheels JSON and the
new wheel directory/Windows extended path. `wheel-check-source-map.json` binds
the original and derived bytes; all validation algorithms/bounds are otherwise
byte-exact. One supervised child completed exit0 at04:13:46.679411–04:13:49.002086Z,
timeout120s/shellfalse, stdout81B/
`7118a27b05cde2df11660683d37b863bfa9e7a5cfeee6d665bf41a7476d9da35`,
stderr0. All124 wheels/14251 RECORD members/563065723 uncompressed bytes passed;
errors[] and nativeExecutedfalse. Pins now bind the fresh2929694B validation
record SHA256 `ab93aa40578c5010d340f00eff79ab333fe757d3d296925e9a9f8cdf2803c354`.
The previous full wheel-validation record remains immutable historical evidence.

The relevant offline suite ran once under Python3.12.14 `-I -B -S`, external
120s child bound, shellfalse and binary captures. All26 tests passed (24 original
plus2 new); child elapsed1.5469999999913853s, unittest1.166s, stdout0,
stderr3524B/SHA256 `905b68230445d5d33a341f5899b4c7f6aa15f14d39919fa9d7da33cf07d4826b`.
All original24 test methods remain AST-exact, including archive/link/hash/drift,
engine/cache/target and audit-denial assertions. Added tests independently fix
the candidate metadata/both notices and single supported pre-import ENV setting.
Seven source files were byte-stable across the suite; protected production two,
single lock-hash delta and single recipe ENV delta were explicitly checked.
No suite failure or behavior rerun occurred. A discovery `rg` wildcard path was
invalid on Windows before a corrected read; it did not execute candidate code.

## Failure history and remaining admission boundary

The original E3 image/build-generation success and genuine app-import failure
remain separate immutable evidence. The failing SoundFile line192 final loader
attempt and denied pricing-map/DNS/process/self-pipe diagnostics are not erased
or reclassified. This source change does not establish exact native causality,
that every future denial disappears, any CVE fix or a successful import.

This session performed only local stdlib DATA/source checks and inert tests.
No AWS, Docker/native engine, LiteLLM/SoundFile import, SDK/model/provider,
database, listener or real-data operation ran. The fresh image is unbuilt and its
native load/import/auth/lifespan remain unqualified. Root must independently
review exact source/context, decide the bounded residual-risk scope and issue
a separately frozen fresh build/import admission. Full G1 and planned product
responsibilities remain open. Final source/context/raw-reference pins and check
captures are sealed in `.task-inputs/linux-soundfile-assembly-1/FINAL-MANIFEST.json`;
the report-only DATA discovery remains historical, unchanged evidence.
