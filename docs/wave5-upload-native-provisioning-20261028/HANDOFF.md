# Wave5 upload native provisioning successor — author handoff

Living handoff for the provisioning successor. Update this file in place as findings change; it is the single record
of what this checkout did, what it did not do, and what remains for Release. It is NOT a qualification or acceptance
claim.

## Identity

- Worktree: `work/wave5-upload-native-provisioning-20261028`, branch `codex/wave5-upload-native-provisioning-20261028`.
- Parent (immutable): commit `dd887b9ec286425fa9fa0b844815e8549160b7d5`, tree `0183d3b0370d24c73dc65e1807107a57d7eba585`
  (the limits successor). This successor's own commit/tree are recorded in the author report beside this file.
- Frozen predecessors: host `01d339ab…`/`8c01e054…`, toolchain `5ca1333c…`/`1f3ff7f3…`, snapshots `fc65a9da…`/`153d97ab…`,
  limits `dd887b9e…`/`0183d3b0…`.
- Independent review implemented here: `outputs/WAVE5-UPLOAD-NATIVE-HERMES-REVIEW.txt` (sha256 `9dfbe2f4…`), findings F1–F8.

## What this checkout changed (source and tests only)

| File | Change |
| --- | --- |
| `apps/runtime/Dockerfile` | 95 upload-layer `ADD --checksum=sha256:…` lines: the seven approved pins byte-identical plus the 88-archive transitive closure; `apk add --no-cache --no-network`; exact-version assertions via `apk info -v`. |
| `infra/product-preview/runtime-packages.lock.json` | 88 closure records added to `systemPackages` (106 total); `uploadNativeProvenance.closure` records the resolution method, the index revision used and the deliberate provider-revision move. Existing members preserved. |
| `apps/runtime/uploads/native-definitions.mjs` | F1/F4/F7/F8: resolve-time publisher re-verification (requires the `run` port), dead verification exports removed, reader-pin accounting (`reader.release({completed})`), bounded storage disposition `prune` that removes only *proved* unreferenced snapshots, storage bounds and `overBound`. |
| `apps/runtime/uploads/composition.mjs` | F2: the single serialized bounded refresh owner, shared by the startup probe and the per-scan resolve path; freshness-only policy; bounded disposition after a publish. |
| `apps/runtime/uploads/native-inspection.mjs` | F5 real ClamAV limit prefixes; per-scan when-stale refresh (one attempt, own deadline, freshness conditions only); reader release on known child completion, `completed:false` on cancellation/unknown cleanup; `deadlineMs` bound through the resolve. |
| `apps/control/uploads/native/extract.py` | F6: `library_errors()` mapping for zipfile/lxml/pypdf/openpyxl refusals to coded `PARSER_ERROR`; each library consulted only if importable. |
| tests | `native-provisioning.test.mjs` (new), `composition.test.mjs`, `native-definitions.test.mjs`, `native-inspection.test.mjs`, `test_extract.py`, `canonical-limits.fixture.json` (new). |

## Findings and how each is closed in source

- **F1 — real transitive closure, not seven top-level URLs.** The closure was resolved from the official rolling
  `APKINDEX.tar.gz` (bytes sha256 `ac5d94af269606cadde721f82ac02e6f10010a5220e71c4955c0355fc052b2c7`, retrieved
  2026-10-28) with apk's own provider rules (name/soname/command providers, newest provider wins) and the seven
  already-approved top-level pins taking precedence. Result: **88 additional aarch64 archives**, each downloaded from
  its immutable official URL, each length-verified against the index `S:` field, each sha256 computed. The layer
  installs them with `apk add --no-network`, so the build cannot resolve or fetch against the live index. Critical
  members include `libxml2-16`, `libarchive`, `openssl-3.6-libcrypto`, `icu-libs`, `libgcc`, `libstdc++`, `glibc-2.44`.
- **Deliberate APK revision moves (exact).** The seven approved pins are preserved byte-identical:
  `clamav-1.5-scanner-1.5.2-r0` `5bac4b03…`, `clamav-1.5-freshclam-1.5.2-r0` `c6613152…`, `tesseract-5.5.0-r2`
  `5360d1b7…`, `tesseract-eng-5.5.2-r2` `284483a7…`, `poppler-utils-26.03.0-r3` `2db390ba…`, `poppler-26.03.0-r3`
  `dacdd5b4…`, `leptonica-1.87.0-r1` `a22f29a7…`. The engine library `so:libclamav.so.12` is provided by
  **`clamav-1.5-1.5.2-r7`** (`13f74b6f…`), which the review identified as previously unpinned; that is the one
  deliberate provider-revision move. Wolfi's `clamav-1.5` hard-depends on its own family, so
  `clamav-1.5-daemon/-milter/-clamdscan/-db/-libunrar` (`1.5.2-r7`) are now pinned and installed as declared
  dependencies. **The earlier documentation claim "the image ships no clamd" was wrong** and is corrected in the
  module doc to: no daemon is configured or started and no `NotifyClamd` is set — the binaries exist as package
  dependencies, and no child runs anything but `clamscan`/`sigtool`/`freshclam` under the observed sandbox.
- **Index provenance discrepancy (accounted, not hidden).** `uploadNativeProvenance.packageIndexSha256` still records
  the earlier retrieval of the same rolling file, `991dd62e3a14e255819e7ac013a6deded970555e1f0943e6b2709c09a5edbd24`,
  while the closure was resolved from `ac5d94af…`. Both are per-retrieval audit records of a file that changes under
  the publisher; the authoritative immutable artifacts are the pinned archives, and every one of the 95 recorded
  sha256 values was computed from the bytes actually downloaded.
- **F2 — a long-lived CONTROL is no longer permanently stale.** `composition.mjs` builds ONE `refresh` closure and
  hands it to both the startup probe and `createUploadNativeInspection`. The closure is serialized by a single
  in-flight promise, so concurrent observers share one provisioning attempt; it is bounded by the caller's absolute
  deadline, never looped, never backgrounded, and it is not a daemon, timer, credential owner or new platform. Only a
  freshness condition (`UPLOAD_DEFINITIONS_UNAVAILABLE`/`STALE`) triggers it; corrupt, unsigned, cancelled, expired or
  misconfigured definitions never do, so corruption is never silently replaced by a clean-looking publication.
- **F4 — unauthenticated whole-snapshot replacement is refused, not flagged.** The store REQUIRES the injected process
  port and re-verifies every published container against the ClamAV publisher signature (`sigtool --info`) at resolve,
  so a same-UID writer that replaces bytes, manifest and pointer cannot manufacture an accepted snapshot.
- **F5 — real limit strings.** `LIMIT_SIGNATURE=/^Heuristics\.(Limits|Encrypted|Broken)\./u` only; the unproven
  `Oversized.*` alternative is gone and a regression test asserts an alert outside the proven prefixes is malware, not
  a limit.
- **F6 — library refusals are coded.** `library_errors()` maps `zipfile.BadZipFile`, `lxml.etree.XMLSyntaxError`,
  `pypdf.errors.PdfReadError` and `openpyxl.utils.exceptions.InvalidFileException` (each consulted only if importable)
  to `PARSER_ERROR` — a limitation of that document, not an extractor outage.
- **F7 — dead verification exports removed.** `--info` is the single supported CVD verification form; no delta or
  detached-signature dispatcher exists, asserted by test.
- **F8 — bounded disposition that never guesses.** `prune` removes a snapshot only when the resolve owner can prove no
  reader is active AND at least one reader reported a known child completion; the `current` snapshot, `keep` ids,
  unparsable directories and the retained floor are never removed. Staging is never removed here (a refresh owns and
  removes its own staging in `finally`); orphaned staging is reported. Elapsed time is deliberately NOT a rule: a
  cancelled child or failed cleanup leaves reader state UNKNOWN and the snapshot is retained, with
  `storage.overBound` reporting a bounded storage-unavailable state instead of an inference-based deletion.

## Tests run in this checkout (authoring host, final bytes)

- Node (Node 24.22.1 at `C:/Program Files/nodejs/node.exe`), `node --test apps/runtime/uploads/test/*.test.mjs`:
  **38 tests / 38 pass / 0 fail / 0 skipped** (`native-provisioning`, `native-definitions`, `native-inspection`,
  `composition`, `native-sandbox`).
- Python: `python -m unittest discover -s apps/control/uploads/native/test -p "test_*.py"`: **24 tests OK, 1 visible
  skip**. The skip is the docx text path of the Office hyperlink fixture: `lxml` is not installed on this authoring
  host. The always-run inertness assertions of that test did run, and the broken-container `PARSER_ERROR` test runs on
  stdlib `zipfile` alone.
- Dependencies: read-only reuse of the A5-owned input checkout packages (ajv/ajv-formats/canonicalize/jszip/saxes/pg/zod).
  No shared cache was modified and nothing was published.

## Canonical numeric agreement (F3)

The extractor's bounds are asserted equal to the contract values owned by A5 in
`work/wave5-upload-input-20261028/packages/contracts/uploads-application/protocol.mjs`
(sha256 `bf457c9049ec6b026e83fd438a2600d026d6d4ce212c43ca93250227e288e37b`). The always-run authority is the frozen
record `apps/control/uploads/native/test/canonical-limits.fixture.json`, which names that path, that sha256 and the
reviewed values. Because the owner file is a read-only dependency that is not part of this checkout, the live
comparison (values and revision hash) runs whenever the sibling checkout or `MERI_UPLOAD_CONTRACT_SOURCE` is present
and otherwise reports the exact path it could not reach — a missing owner is never a silent pass and never duplicates
the constants as authority.

## NOT RUN — no claim

- No Docker build, no image pull, no `--no-network` install, no ARM execution, no `bwrap` namespace admission, no real
  `clamscan`/`freshclam`/`sigtool`/`tesseract`/`pdftoppm` execution, no corpus scan, no native qualification. The Data
  heavy-WSL gate is active and was not inferred to have ended. Local package links only; `/run/meri` volume behaviour,
  the CONTROL-Fargate `unshare(NEWUSER|NEWNS|NEWNET)` result and the declared image digest remain unobserved.
- `describe()` still carries only the DECLARED `expectedImageDigest` with `imageObserved:false`; A5 owns the production
  join from `UPLOAD_IMAGE_OBSERVATION_OWNERS`. Composition returns null ports plus an exact `missing` list until an
  observed sandbox admission exists, so the CONTROL join is unchanged by this successor.
- No A5-owned file was modified. A5 binds `scanner`/`extractor` from `composeUploadNativeHost` into
  `createUploadInspection`; the per-scan refresh reaches A5's scans only through that composed host.

## Scratch (authoring aid, preserved, excluded from git)

`.provisioning-scratch/` holds the index bytes, the seven verified top-level archives, the 88 verified closure archives,
`closure.json`, the splice/reorder scripts and two debug scripts from this session. It is excluded through
`.git/info/exclude` and must not be committed; it is retained as evidence for the closure resolution.
