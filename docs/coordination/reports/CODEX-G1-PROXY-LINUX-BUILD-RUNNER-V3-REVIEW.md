# Independent v3 Linux experiment recipe source review

Verdict: the v3 failure-bundle patch closes the v2 partial-copy aggregate-accounting defect. No remaining blocking source defect was established in this narrow review. This is a source disposition for the fixed recipe, not permission to dispatch CodeBuild or evidence of a successful Linux import. The exact final seven-file context, immutable input/archive version and actual experiment still require owner review.

The reviewer did not author the runner or recipes. This review used a dedicated worktree at `cf0b91618582ce5beb3b04f24a6faa396cb0c13f`, read AGENTS and IMPLEMENTATION-STANDARDS, and recorded an outline before reviewing. Only this report is tracked. Source snapshots and finite DATA reconciliation are under `.task-inputs/linux-build-runner-v3-review-1/`. No runner, packer, preparation helper, test, Docker command, native engine, SDK, AWS CLI or provider was executed by this reviewer. PowerShell filesystem/JSON/hash processing and bounded Git provenance commands are the only review operations.

## Exact subject and history

The root-owned subject is `g1-parallel-integration/.task-inputs/proxy-linux-owner-build-1/`:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `buildspec-3.json` | 5,488 | `cb2a87d3194fb19bc6927ac2e3138f67536d3e112699c1ec9a78ce0420d9f374` |
| `linux-run.py` | 14,110 | `8dd5bae1743ed76d5770ae0b92129686e05039a884910db23893c94ecbf661e5` |

The complete recipe, preparer, retained three-case checker and machine results were read. The runner was fully read in the prior v2 review and is byte-identical here. DATA comparisons independently confirm unchanged build commands, shell preamble and result-upload tail; the recipe change is confined to the embedded failure-bundle Python body. That decoded body's SHA-256 is `67b5f38c6a88a7fa3d4d8b47280a5a888be92ea3045bca8f75c4c2bd559e9ce9`.

The original v1 report/hold remains at commit `d4f93c6f9020a426900e704523ec2910b35c2ba0`: fast-exit output could bypass polling caps, and an oversized result could abort finally before any upload. V2 changed the runner to selector-driven bounded pipe drainage and the recipe to incomplete prefix bundles. The v2 report/hold remains at `aeccd7aeb53fce75feddd3c0c3cedbf52dbdfb04`: a post-copy OSError left a retained target outside `total`, allowing subsequent copies to reuse its budget. Neither historical report, source nor seal was changed.

## Why the changed accounting closes that defect

For each regular, singly linked source, v3 computes `selected` from the original size, the 32 MiB per-file limit and remaining 512 MiB payload budget. It adds `selected` to `total` before opening or writing the target. Subsequent copy/read/stat failures cannot subtract or recycle this reservation. Each write is drawn from at most that selected prefix. Therefore retained bytes from that attempt remain charged even when the successful-write counter or post-copy source inspection fails. Conservative unused reservations can reduce later capture; they cannot expand the payload allowance.

The OSError branch always marks the overall bundle incomplete and the row `complete:false`. It separately inspects and re-reads the owned retained target, reporting its actual length/hash and `sourceStable:false`. An absent target is reported explicitly; a failed partial inspection is also explicit. The code does not treat the error as a successful whole-source capture. A later ordinary file is still captured within the remaining reserved budget. Manifest fields now disclose `reservedPayloadBytes` and `payloadByteLimit`.

These arguments rely on the recipe's trusted, exclusively owned local results/bundle directories. They are not a hostile-filesystem proof: lstat/open are separate operations, and the retained-target read assumes no concurrent hostile growth or replacement. The 512 MiB limit is a payload reservation limit; the manifest and tar/gzip metadata add overhead. If writing the manifest, tar creation, checksum calculation or upload itself fails, this recipe cannot guarantee a successful evidence upload. A failure to inspect a partial target must remain incomplete and cannot qualify the experiment.

## Retained synthetic evidence, without replay

Root's `check-bundle-3.py` extracts the recipe's literal embedded body, writes a fixture-local packer, and invokes bundled Python 3.12.14 with `-I -B -S`, shell-free, with a 30-second direct-child timeout. The three retained processes exited zero with empty stdout/stderr. The injected driver raises OSError at the second lstat of the synthetic `results/fault.bin`, after its copy. It does not simulate a Linux application, Docker or AWS.

Independent DATA readback rehashed all 38 retained fixture files before/after, copied the small evidence files exclusively, verified each retained bundle row against its actual target bytes/hash, checked each whole archive's checksum, and measured the following results:

| Retained case | Captured/reserved payload | Evidence complete | Actual observation |
| --- | ---: | --- | --- |
| Small | 71 / 71 B | true | 55 B synthetic result plus 16 B stream |
| Oversized | 33,554,487 / 33,554,487 B | false | 34,603,009 B source limited to 33,554,432 B prefix |
| Post-copy lstat error | 2,097,207 / 2,097,207 B | false | 1 MiB fault target retained/hashed/charged, then 1 MiB later target retained |

The actual fault-target hash is `9bc1b2a288b26af7257a36277ae3816a7d4f16e89c1e7e77d0a5c48bad62b360`; its row has `errorType:OSError`, `retainedPartial:true`, `complete:false`, `sourceStable:false`. Every fixture's result explicitly says `nativeImportPassed:false` and `syntheticFixture:true`.

The fixture packer files are Windows CRLF representations of the exact decoded embedded text; equality was independently checked after CRLF-to-LF normalization, not asserted as raw-byte identity. Original raw representations are retained and hashed. The root checker also reads archive members and asserts flat regular membership, payload hashes and aggregate bounds; this reviewer read that code and its outputs but did not independently decompress/replay those assertions. Independent review checked archive bytes/checksums and unarchived bundle targets. The three fixtures do not exercise the full 512 MiB boundary or every possible I/O failure. The source reservation argument covers the specific prior counterexample; these cases supply finite supporting observations.

The retained process JSON gives argv/exit and synthetic/no-AWS labels. It is not a full supervisor envelope: start/end timestamps, source pre/post arrays and timeout/descendant observations are absent. The checker source specifies its timeout; its records do not recreate past kernel state. No additional check was run to fill those historical omissions.

## Unchanged boundaries and acceptance still required

V2's unchanged runner drains both pipes through EOF, writes bounded prefixes, records observed/written counts and completeness, and fails cap/deadline breaches before parsing output. It rejects inherited image volumes and known credential-bearing environment names. The fixed container remains Linux/amd64, nonroot, network-none, read-only, cap-drop-all, no-new-privileges, bounded memory/CPU/PIDs and only its `/tmp` tmpfs. Container cleanup requires positive ownership and exact removal readback. Killing a Docker CLI process group does not prove the daemon's build work stopped; a build timeout remains a failed/unknown experiment requiring separate owner reconciliation.

The result-upload tail is unchanged: exact qualification bucket/key pattern, KMS key, checksum, if-none-match, one-attempt AWS settings and bounded upload. It was source-reviewed only. The builder role's broader ECR capability was not removed by this recipe; absence of ECR push in these commands is not an IAM denial. No database, provider, Fargate or product-auth qualification follows from this review.

Before any actual acceptance, the owner must bind the complete fixed context/archive/manifest and immutable S3/CodeBuild inputs, review fresh builder authority, and retain actual terminal build and artifact receipts. Acceptance requires actual `result.json` native-import success, complete required raw process streams, positive owned-container cleanup, source stability and exact input/version continuity. An empty/incomplete bundle or CodeBuild terminal success alone cannot pass. Upstream Linux/native import, generation, native auth, TLS/Fargate integration, actual CountTokens/budget proof and G1 remain open.

The finite DATA reconciliation is `data-reconciliation.json`, 46,043 bytes, SHA-256 `6c71d135080737f0b0d7d2c0a4397a5e66ed021764de567c267c51b6e560411e`. The final sibling manifest binds the raw source snapshots, retained observations/protected large files, report Git readback and unchanged historical seals; it does not attest future execution.
