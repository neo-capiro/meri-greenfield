# Wave5 MM12 native upload toolchain/image/provisioning — author handoff (living)

Owner: Hermes implementation worker (default profile). Commit identity `Codex <codex@openai.com>`.
Status: **source-only candidate.** No build, image, host, tool or corpus qualification is claimed here.

## Checkout

- Owned checkout: `S/work/wave5-upload-native-toolchain-hermes-20261028` (successor of the frozen `…-host-hermes-20261028`).
- Branch: `codex/wave5-upload-native-toolchain-20261028`; no upstream; nothing pushed, no PR, no merge.
- Exact initial HEAD `01d339ab45d25e3ad5435178d3ca7c00ef69f90f` / tree `8c01e054109751b3419b92815b99e36499de9984`.
- The original `01d` checkout, its report and its source are frozen and were not overwritten.

## What this session actually changed

| Path | Change |
| --- | --- |
| `apps/runtime/Dockerfile` | New pinned native layer: ClamAV scanner + freshclam, Tesseract + `eng` traineddata, Poppler + utils, Leptonica, each `ADD --checksum=sha256:…` from the official Wolfi aarch64 index, followed by build-time existence/version assertions. Fixed owned paths created: `/run/meri/upload-scratch` and `/opt/meri/var/upload-definitions` (node:node, 0700). All prior layers preserved. |
| `infra/product-preview/runtime-packages.lock.json` | Seven real system/native records appended (sha256 + bytes + URL + role) and a new `uploadNativeProvenance` block. Every existing record preserved. No npm/public lock touched. |
| `apps/runtime/uploads/native-sandbox.mjs` | Fixed image paths exported (`UPLOAD_NATIVE_SCRATCH`, `UPLOAD_DEFINITIONS_ROOT`, `UPLOAD_EXTRACTOR_PATH`, `UPLOAD_SCAN_MILLISECONDS`, plus `tesseract`/`pdftoppm` in `UPLOAD_IMAGE_PATHS`). Scan plan now also carries `--official-db-only=yes`, `--max-scantime=30000`, the encrypted/broken alert set, and `--tempdir=<cwd>`. |
| `apps/runtime/uploads/native-definitions.mjs` | **Corrected publisher-signature verification** (see below). |
| `apps/runtime/uploads/composition.mjs` | Undeclared roots now fall back to the fixed image paths instead of failing closed on `uploads.native.paths`. |
| `apps/runtime/uploads/test/*.test.mjs` | Aligned to the above; added the sigtool-form test and host/parser path-agreement assertions. |
| `apps/control/uploads/native/extract.py` | The copied parser is now this session's source claim; two real defects fixed (below). |
| `apps/control/uploads/native/test/test_extract.py` | New focused parser tests (stdlib only, no native tools required). |

## Defect 1 — the publisher-signature command was wrong

The inherited `sigtool --verify <file>` is **detached-signature only**. The vendor `sigtool.1` for the pinned ClamAV
1.5.x documents: `-i, --info` "Print a CVD information and verify MD5 and a digital signature"; `--verify-cdiff=FILE, -r FILE`
"Verify DIFF against CVD/INCDIR"; and `--verify` only under "COMMANDS FOR CREATING AND VERIFYING DETACHED DIGITAL
SIGNATURES" (it needs a detached `.sign` file, which is never shipped or accepted here). The fixed plans are now
`cvdVerificationArguments = f => ['--info', f]` and `cdiffVerificationArguments = f => ['--verify-cdiff=' + f]`,
selected by extension by `verificationArguments`. A CVD that fails verification is `UPLOAD_DEFINITIONS_UNVERIFIED`;
no snapshot is published, and a failed refresh retains the previous immutable signed snapshot while a stale one stays
unavailable. Honest limitation: the *exact* stdout marker of `--info` on the real image was not observed, so the gate
is the child's exit status only. Release should confirm the stdout marker on the built image rather than assume it.

`clamscan` options were verified against the same vendor man page: `--stdout`, `--no-summary`, `--database`,
`--max-filesize`, `--max-scansize`, `--max-scantime`, `--alert-encrypted`, `--alert-encrypted-archive`,
`--alert-encrypted-doc`, `--alert-exceeds-max`, `--alert-broken`, `--official-db-only`, `--tempdir` all exist.
`freshclam` config keys (`DatabaseDirectory`, `DatabaseMirror`, `ScriptedUpdates`, `TestDatabases`,
`CompressLocalDatabase`, `UpdateLogFile`, `Foreground`, `Checks`, `DatabaseOwner`) were confirmed against the vendor
`etc/freshclam.conf.sample`; `NotifyClamd` is deliberately absent (no daemon, no socket, no global cache).

## Defect 2 — parser allocation and unknown geometry

- **TSV was allocated before its limit check.** `subprocess.run(..., stdout=PIPE)` buffered the entire Tesseract TSV
  and only then compared it to 16 MiB. It is replaced by `bounded_output()`, which streams the child's stdout in
  64 KiB reads under a hard cap, kills the child the moment the cap is exceeded, and always waits on/reaps its own
  child (including on timeout and overflow). The cap is a product constant and cannot be raised by an upload.
- **`sheet.max_column` may be `None`.** Read-only workbooks can omit the stored dimension; `None > 1024` raised a
  `TypeError`. `declared_columns()` now returns the honest classification: unknown geometry is reported as
  `COLUMN_DIMENSION_UNKNOWN` and the scan proceeds bounded by the fixed 1024-column cap; a declared dimension above
  the cap is `COLUMN_LIMIT`. `next(formula_rows)` is also guarded (StopIteration) and formula/value pairing uses `zip`
  instead of positional indexing.

Host and parser agreement is now asserted rather than assumed: the format allowlist, the extractor path
`/opt/meri/apps/control/uploads/native/extract.py`, and `/usr/bin/tesseract` + `/usr/bin/pdftoppm` are checked from
both sides by `test_extract.py`.

## Official pin evidence (retrieved 2026-10-28, read-only public archives)

Retrieved into scratch and hashed locally; every download length matched the index `S:` field exactly.

| Package (Wolfi aarch64) | Version | sha256 | bytes |
| --- | --- | --- | --- |
| clamav-1.5-scanner | 1.5.2-r0 | `5bac4b03…67e7ce` | 10343387 |
| clamav-1.5-freshclam | 1.5.2-r0 | `c6613152…12483e` | 52758 |
| tesseract | 5.5.0-r2 | `5360d1b7…b65cd2` | 3648497 |
| tesseract-eng | 5.5.2-r2 | `284483a7…abe5050` | 11367038 |
| poppler | 26.03.0-r3 | `dacdd5b4…163cdd` | 1681899 |
| poppler-utils | 26.03.0-r3 | `2db390ba…eae02e` | 407277 |
| leptonica | 1.87.0-r1 | `a22f29a7…557c81` | 7646 |

Full hashes are in `runtime-packages.lock.json`. The `APKINDEX.tar.gz` is a **rolling live file**, so the frozen
index hash recorded in the lock is only a per-retrieval audit record — the pinned `.apk` archives are the authoritative
immutable artifacts. Python wheels needed nothing new: `pypdf 6.21.2`, `openpyxl 3.1.5`, `lxml 6.1.3` and
`pillow 13.0.0` are already pinned in `runtime-wheels.lock.json` and installed by the existing pip layer.

## Commands and results (this session)

- `"C:/Program Files/nodejs/node.exe" --test apps/runtime/uploads/test/{native-sandbox,native-definitions,native-inspection,composition}.test.mjs`
  → **tests 23 | pass 23 | fail 0 | skipped 0 | exit 0** (run against the final bytes of those four modules and their tests).
- `python -m py_compile apps/control/uploads/native/extract.py` → exit 0.
- `python apps/control/uploads/native/test/test_extract.py -v` → **Ran 15 tests | OK | exit 0.**

The earlier failing intermediates are preserved as evidence, not hidden: the cross-check test first skipped/failed on a
wrong relative path (`parents[2]`, then `parents[4]`; correct is `parents[3]`), and one patch briefly deleted the
`Limited` class and was restored in the next patch. Neither survived into the final bytes.

## A5 receipt seam — raised, not widened

A5's scan/extraction receipt `tool` object is closed `{name, version, binarySha256}`. Binding image/toolchain
provenance needs an **additive** field, and a declared expected image digest is not an observation. This session does
**not** widen A5's receipt and does not claim image provenance from an unpersisted description. The concrete
coordination item for A5 (and the runtime image-provenance owner) is:

```
scannerTool = {name, version, binarySha256, imageDigest, toolchain: {clamav, tesseract, poppler, definitionsSha256}}
```

where `imageDigest`/`toolchain` come from an observation by the existing image-provenance owner, never from the
declaration. Until A5 adds those fields canonically, the host-side `describe()` is the only place this information is
carried.

## Real host dependency (unchanged, unresolved)

CONTROL is non-root UID1000 Fargate on the shared `apps/runtime` image; whether it can satisfy `bwrap`'s
`--unshare-all` with `NoNewPrivs=1` is **still unobserved** — ECS Exec is disabled with no execution agent and no
authorized diagnostic channel, so no syscall result exists and none is guessed. Two consequences are explicit:

1. The Dockerfile gives the image the tools and the fixed writable scratch/definitions paths; it does **not** establish
   that CONTROL can run them under the eight mandatory restrictions.
2. If supported platform evidence shows CONTROL cannot, the precise supported fallback is the **already-adopted
   AgentCore purpose transport** (`renderer-client.mjs` `createAgentCoreRenderer` with a string qualifier and exact
   expected/observed image digest), not a new runner and not a raw 10 MiB byte-body bridge. That choice belongs to
   A5/root, not to this worker.

No flag here manufactures qualification: nothing enables ECS Exec, IAM, privileges or a cloud probe.

## Release packet prerequisites (precise)

1. Build the ARM image from this source; the Dockerfile's own assertions must pass (`clamscan --version` = 1.5.2,
   `sigtool --version` = `ClamAV 1.5.2`, `tesseract --list-langs` contains `eng`, `clamscan`/`sigtool`/`freshclam`/
   `tesseract`/`pdftoppm` all executable).
2. Run the real `freshclam` against the official mirror once and capture the CVD/CDIFF set, then `sigtool --info` each
   CVD and `sigtool --verify-cdiff=` each CDIFF; record the stdout marker so the exit-status-only gate can be tightened.
3. Observe the CONTROL (or AgentCore) namespace capability for the fixed child and record the eight restrictions from
   the real probe, not from this source.
4. Execute the representative corpus — scanned PDF and image OCR, docx/pptx text, xlsx including an unknown-dimension
   sheet, an encrypted PDF (must be `blocked`), a macro-bearing/active-external Office file (must be rejected), and a
   >10 MiB original — and confirm no missing/unavailable tool is ever reported clean or extracted.

## Not claimed / not run

No Docker build, no package installation in a shared environment, no cloud/task/IAM/ECS Exec action, no live ClamAV
download, no real corpus or host qualification, no independent review. `native-inspection.mjs` and its test are
unchanged this session (hashes `c98ab3b8…` / `7e1b6946…`).
