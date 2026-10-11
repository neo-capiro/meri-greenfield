# Fixed offline ABI profile-v2 execution preparation

Status: SOURCE/DATA PACK PREPARED; SCAN UNRUN; OWNER ADMISSION ABSENT. This report prepares a distinct future offline inventory and grants no native, image, proxy or G1 acceptance.

Dedicated worktree: `C:/dev/main/meri-greenfield-worktrees/g1-proxy-abi-v2-execution-preparation`, branch `task/proxy-abi-v2-execution-preparation`, pinned source commit `697d31101b44b91b40be864c4d9ef4bdda376410`. That repair source was undergoing the integration owner's independent review during this preparation. The only tracked change here is this report. AGENTS and the implementation standards were read; the proportionate outline preceded preparation.

The fixed pack is `.task-inputs/oci-abi-profile-v2-execution-1` within that worktree. It reuses the corrected, previously observed Windows-audit pack at `C:/dev/main/meri-greenfield-worktrees/g1-proxy-oci-abi-windows-audit-repair/.task-inputs/oci-abi-win32-audit-repair-1`. Its original freeze is 374228 bytes, SHA256 `38251a0798163850431e69de016724427bb560c980d42dd121337a05ee97163c`.

## Exact source and bootstrap bindings

Five regular source copies equal the raw Git blobs at the pinned commit and their current checkout bytes:

| Source | SHA256 |
| --- | --- |
| proxy_oci_inventory.py | ce6031a05b608b27eef56f4894bd797be362de3742988af9e71328421388264c |
| oci_layer_overlay.py | 835082c6e70bb983f53c9d20227f804c6c930ef8eeb88b6ce8ea99d131abb86c |
| elf_inventory.py | 959d60f5e363763d7d48b586cbebb2f37cdfdb9f342b7a749ae4cbd9668be73d |
| proxy_oci_abi_inventory.py | efc25d3d48a4dd874aa32be9c41e5375576211c1fd152f601e40ab08e956f4f9 |
| windows_job.py | 7f9310f345fa92cb8b4640adb749f53d9b3ae0dde6121773f985937bcb0aa36a |

The canonical reader/overlay/ELF/profile boundaries remain unchanged. No reader implementation is authored or edited in this task. The profile-v2 parser/resolution changes belong to the separate repair commit.

The ignored binding changes exactly four single literals: fixed PACK path, source commit, ELF pin and ABI-profile pin. `child.py` and `supervise.py` each change only their one binding hash. Reversing those substitutions reproduces each reviewed original helper byte-for-byte, including its line endings. No supervisor algorithm, audit event check, environment policy or cleanup branch changes.

| New artifact | Bytes | SHA256 |
| --- | ---: | --- |
| binding.py | 6385 | aa31c8a8114b883c1a51cfe51fb2ab9c1fb0c47e8d3579b3f4335ca148d5cea5 |
| child.py | 2963 | 6b0d76eceb0a03232864c8bd37600b28adca77ab925bf04b9f10d3aabcb4bf40 |
| supervise.py | 8919 | 692c4095f67aec87b5be83bfeda1e7fdc3a64c27720bf1258d7c5bd876f66d9e |
| freeze-v2.json | 374254 | 9e61c9d64aaeb539e77d8bf81c90ed817f7f2344dc47d6e5259aabf50834e12a |
| preparation-result.json | 194836 | d3b39d5f7b6173641be154e4e97849d3466b314dd2a2dbc19fe4dc541b5d73a2 |

The fresh freeze retains the existing schema and exact 981-record closure: five sources, four metadata inputs, three helpers and 969 runtime records. All 969 runtime records are unchanged. The binary is fixed CPython 3.12.14, 106448 bytes, SHA256 `10d845f50a2af64e3500bb2fcb348b5bc98a75d8ddada63e45ba1da6a1fc79d1`; the future child retains `-I -B -S`.

The manifest remains `ff11074add7b1cee63759b90eb2a9e4072763e520297761ea05a911b4a5b251d`; config `db4055eec62df7f5f23828795de317b1856275178688ce1735ca16e1b343044c`; extraction plan `aa17a87926383a5e4ea03f5df3b8b00946941bfe24bc3ccb7e24cfb5517f1adf`. All 23 canonical compressed blobs were measured as DATA against those descriptors: 401268538 bytes total, every size and SHA256 exact. Blobs are read-only references to the original acquisition directory, without large copies or layer parsing.

## Preparation actually performed

After full source reading, the pinned Python ran only `run-preparation.py`, which captured one DATA-only `prepare.py` child. It copied exact regular sources and metadata, captured nine bounded read-only Git commands, constructed the fresh freeze and checked all frozen records before/after. It imported no pack binding, Job module, reader, downloader, SDK or native engine.

The child ran 2026-10-11 01:45:16.825828–01:45:20.403349 UTC, 3.578 seconds, exit 0, no timeout, source/runtime binary and preparation helper pins stable. The external preparation bound was 120 seconds. Binary stdout is 69 bytes, SHA256 `e82483f4fd2773ec27eae5cc4208125b9053692b42cb7913a9130d5ba330a02a`; stderr is empty. The preparation capture uses in-memory PIPE capture with post-completion receipts; it is not a streaming memory cap or process-tree qualification. Each Git subprocess has its own 45-second bound and stripped Git override environment. No additional Windows Job or runtime control was replayed because those algorithms are byte-equivalent.

The preparation remeasured 269 protected old files before/after, including original failed-operation evidence, both consumed inner attempts, old outer supervisors/receipts and all files in the successful profile-v1 HOLD output. Their bytes were unchanged; only reference records are stored. The earlier predispatch audit refusal and later successful-HOLD inventory remain separate historical outcomes. Existing acquisition, inventory, admission and consumed namespaces are not reset.

`admission-PROPOSED-REFUSING.json` has `ownerApproved:false`, null timestamps and the new freeze/output pins. Actual `admission.json`, `consumed.json`, `operation-abi-inventory` and `abi-inventory` are absent in this pack. This proposal cannot authorize execution. No runtime helper main, scan, reservation or admission was invoked or created. Execution was limited to the explicitly described bounded Git and Python DATA helpers. No network, AWS, provider, Docker, generator, Node, SDK CLI or image-native engine ran.

## Owner requirements and remaining limits

The integration owner must independently accept the exact reader source and this pack, read and bind a NEW outer3 supervisor to this freeze, verify current protected inputs and fresh namespace/disk conditions, then separately create the sole real admission. Only the fixed ABI-INVENTORY action is available; output is this pack's `abi-inventory`, operation this pack's `operation-abi-inventory`. No arbitrary argv, output, environment or action selector is introduced.

Inherited limits remain: 600-second inner whole operation, 25-second cleanup reserve, 575-second preflight/work window, 570-second child gate, original cooperative reader deadline, 2 GiB free-disk floor, one suspended child assigned to the Windows Job before resume, streaming 2 MiB per output stream, finite empty-Job/readers cleanup observation and source rechecks. Windows `subprocess.Popen` audit comparison still uses its actual command-line string and explicit pinned executable. SYSTEMROOT/WINDIR preservation and all other environment exclusions remain exact. Offline socket/process auditing precedes reader imports and is Python audit enforcement, not OS isolation. Trusted-filesystem hash checks do not establish hostile-root resistance or recreate past kernel state.

The owner subsequently supplied the unrun outer3 at `C:/dev/main/meri-greenfield-worktrees/g1-parallel-integration/.task-inputs/abi-outer-launch-owner-3.py`, 8902 bytes, SHA256 `f1a95ae62ae8275f95ed9c8df34123ba98bc5b4929fe9912ffda2452f07da3d7`. Its full source was read. `outer3-source-rebinding.json` records exactly five single-occurrence substitutions from the original outer2, SHA256 `85c863c43c0114cd470d7a4b3d9c34f66eb68a4b0944e27ef20abcbb04df40b1`: PACK, freeze hash, supervisor hash, new outer operation slot and usage filename. Forward and inverse raw-byte equality both passed during the DATA seal. The canonical Job source and Python pin are unchanged. This establishes a path/hash-only source mapping, not dispatch approval. Outer3's source/admission prechecks precede its 600-second work/cleanup clock; an external caller remains responsible for its own whole invocation bound. It was not imported, helped or executed here, and its new output slot remains absent at handoff.

The first final-seal DATA helper refused before allocation because it compared the full `stat_result` tuple, including fields beyond the intended seven identity fields. Its original source and transcript-derived error record are retained; no binary failure capture or field-level stat delta was recorded. The specific access-time cause is therefore inferred. A version using the intended full seven fields and raw hashes passed. This corrected seal instrumentation only; no operational helper, frozen record or reader changed. The original report commit and first successful seal remain historical, with that report's exact bytes retained in its raw Git capture. The final clarification and new seal preserve that history.

No profile-v2 result exists yet. The prior parser/link findings, all retained HOLD results and package/license/notice/real Linux ABI compatibility gates remain visible. The future DATA reader always emits HOLD with runtime/native admission false. A successful future scan will supply inventory evidence only; real community image assembly, native generation, PostgreSQL/auth, TLS/current-ECS peer binding, provider accounting and G1 remain OPEN. Current Capiro/Meri and sealed repair worktrees remain untouched. After the preparation measurement, the owner reported independent acceptance/integration of the reader repair as `07e9ea4`; this report's reader bindings remain the exact original `697d31101b44b91b40be864c4d9ef4bdda376410` bytes.
