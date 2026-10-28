# Wave5 upload native limits — author handoff

Author-side source correction and limit proof for the fixed native upload scan/extraction host.
Source only. No build, no image, no native run, no cloud/DB/network refresh, no qualification or acceptance claim.

Checkout: `work/wave5-upload-native-limits-20261028`, branch `codex/wave5-upload-native-limits-20261028`, no upstream
(never pushed, no PR, no merge). Base preserved: `fc65a9da1a76f8ae3c17903ca841a772fbc0c6c6`
(tree `153d97abc37b96a15710d19150ecd944d1222fdb`). Commit identity `Codex <codex@openai.com>` (per-command).

## 1. Corrected: signed-definition provenance (the real blocker)

The previous successor (`fc65a9da`) claimed in `apps/runtime/uploads/native-definitions.mjs` that
`CompressLocalDatabase yes` keeps the local ClamAV database in its signed `.cvd` container form, and accepted a staged
`.cld` whenever a same-stem `.cvd` existed. Both are wrong, and the second was unsafe. Pinned ClamAV `clamav-1.5.2`
sources read for this correction:

- `etc/freshclam.conf.sample` — `CompressLocalDatabase` is documented as local `.cld` compression only: "By default
  freshclam will keep the local databases (.cld) uncompressed to make their handling faster. With this option you can
  enable the compression". It never retains a signed container.
- `libfreshclam/libfreshclam_internal.c` — a scripted update builds an unsigned local `.cld`
  (`buildcld(..., CompressLocalDatabase)`), installs it as `<database>.cld` and then deletes the container it replaced,
  with the comment "CLD's can't be signed, so we don't need to worry about the signature file". A downloaded `.cvd` is
  installed only after `cli_cvdverify` (embedded signature, plus an optional detached `.sign` sidecar); a downloaded
  `.cld` is installed with **no** signature verification at all. For the official mirror the code path is explicit:
  "Official update servers will only have the CVD." A remote CLD is preferred only for a private mirror.
- `libclamav/cvd.c` — when loading a `.cvd`, ClamAV looks for a same-stem `.cld`; if that `.cld` has a **higher**
  version, the `.cvd` is refused and *not* loaded ("The %s database is older and will not be loaded"). An
  unauthenticated `.cld` sitting beside a verified `.cvd` can therefore be the database the engine actually reads.
- `docs/man/sigtool.1.in` — `--unpack=FILE` "Unpack FILE (CVD) to a current directory"; `-i/--info` "Print a CVD
  information and verify MD5 and a digital signature"; `--verify-cdiff=FILE` "Verify DIFF against CVD/INCDIR";
  FIPS-like mode "will require '.sign' files to verify CVD authenticity".

Correction implemented (no new framework, no new transport):

- Only the signature-verified `.cvd` container is publishable. `UPLOAD_DEFINITIONS_FORMATS = ['cvd']` and the accepted
  database name is `*.cvd` only, so an unpacked `.cld` can never be a published definition file.
- `freshclamConfiguration` now sets `ScriptedUpdates no` and no longer sets `CompressLocalDatabase`: a refresh is a
  full signed `.cvd` download (vendor-verified with the embedded signature), not a locally built unsigned `.cld`.
- A staged `.cld` **or** `.cdiff` fails closed (`UPLOAD_DEFINITIONS_UNVERIFIED`) and is never published, however
  plausible it looks and even beside a fully verified signed `.cvd`. This removes the vendor's "prefer the newer `.cld`"
  hazard structurally instead of trying to prove a byte-derivation relation.
- FreshClam's own files are recognised so normal output is not refused — `freshclam.dat`, `mirrors.dat`, `*.sign` —
  and are removed from the staged database directory before publication, so a published snapshot directory contains
  **only** verified database bytes. Sidecars are never hashed, never listed, never handed to the verifier, never
  published. The detached `.sign` is deliberately not used as database authentication, and no FIPS-like detached
  signature support is claimed; a container that `sigtool --info` cannot verify fails closed.
- Snapshot schema `meri-upload-definitions/3`: the identity hashes `[name, format, sha256]` (the `derivedFrom` field is
  gone with the CLD path). Publication now prepares a directory containing only the verified containers and moves it in
  one rename, then moves `current` atomically.
- Fixed a real pointer-publication race found while running the suite: the temporary pointer name was derived from the
  publication time, so two concurrent refreshes into one root shared it and lost publications (`ENOENT`, and `EPERM`
  from renaming onto an existing `current` on a Windows host). The pointer is now staged inside the refresh's uniquely
  owned directory and the atomic move is retried a bounded number of times on a transient destination lock. No partial
  pointer is ever published.

Not claimed: that a real `freshclam`/`sigtool` run, image or corpus behaves this way. `sigtool --info` on a real signed
CVD, and a real full-CVD refresh, are Release qualifications (see §4).

## 2. Proved: parser pre-decode limits

`apps/control/uploads/native/extract.py` (the fixed extraction child) now refuses over-limit geometry **before** any
decode and **before** the OCR tool is consulted, and maps Pillow's own decompression-bomb guard onto the same
limitation instead of letting it escape as an unhandled decoder error.

Evidence produced in this environment (Windows authoring host, Python 3.14.7, Pillow 13.0.0, real fixture files):

- Real JPEG fixtures written by Pillow's encoder and read by the real decoder:
  - 9000x4600 = 41,400,000 pixels (485,487 bytes): fixed child → `{"status":"unavailable","segments":[],
    "limitations":["IMAGE_PIXEL_LIMIT"]}`; base child → `["OCR_UNAVAILABLE"]` (see below).
  - 14000x6000 = 84,000,000 pixels (984,706 bytes): fixed child → `IMAGE_PIXEL_LIMIT`; base child → `OCR_UNAVAILABLE`.
  - 8000x5000 = 40,000,000 pixels (469,081 bytes): not refused (the cap is inclusive).
- Reproduced the base defect mechanism with the base code's exact call sequence (`Image.MAX_IMAGE_PIXELS = 40_000_000`
  then `Image.open`): at 41.4 Mpixels Pillow emits `DecompressionBombWarning` (a warning, so the base code's own header
  check did fire when the OCR tool was present); at 84 Mpixels `Image.open` **raises `DecompressionBombError`**, which
  is neither an `OSError` nor a `ValueError` and was therefore not caught by the base child, which would abort with a
  traceback and be reported as `EXTRACTOR_UNAVAILABLE` rather than an honest bounded refusal.
- Recording-shim boundary proof (`sitecustomize.py` on `PYTHONPATH`): for both over-limit images the child recorded
  **no** `pixel_decode` and **no** `child_spawn` — the guard fires on the header, no pixels are decoded and no OCR
  child is started. The at-cap image is not refused.
- PDF page cap: the cap is applied by `reader.pages[:MAX_PAGES]` after `len(reader.pages) > MAX_PAGES` is reported, so
  page 201 is never opened, extracted or rasterized. Proved with a recording `pypdf` double (pypdf is not installed in
  this authoring environment): exactly pages 1..200 were constructed and extracted, page 201's marker never appears,
  `PAGE_LIMIT` is reported and the status is `partial` with the 200 in-cap pages. **This is a boundary proof, not a
  pypdf decoder qualification** — a real 201-page document through real pypdf is owed to Release.

## 3. Verification run here (exact commands, exits)

    # focused definition suite (+ strengthened 8-way concurrency case), 5 consecutive runs on the final bytes
    node --test apps/runtime/uploads/test/native-definitions.test.mjs apps/runtime/uploads/test/native-sandbox.test.mjs
      -> tests 15, pass 15, fail 0, exit 0   (each run)
    node --test apps/runtime/uploads/test/native-definitions.test.mjs
      -> tests 9, pass 9, fail 0, exit 0

    # parser suite incl. the four new boundary tests, on the final bytes
    python apps/control/uploads/native/test/test_extract.py -v
      -> Ran 19 tests ... OK, exit 0
    python -m py_compile apps/control/uploads/native/extract.py apps/control/uploads/native/test/test_extract.py
      -> exit 0

    # A/B concurrency probe (author-side scratch, 48 concurrent refreshes into one root, same injection port)
      BASE  fc65 module: 41/48 publications rejected  {"ENOENT":4,"EPERM":37}
      FIXED module:       0/48 publications rejected  {}
    # both converge on one content-addressed snapshot and one pointer

Environment limitation, not a product defect: `native-inspection.test.mjs` and `composition.test.mjs` cannot load in
this checkout — they import `packages/contracts/schedules-0.2/lifecycle-validation.mjs`, which needs `ajv` from
`node_modules`, and `node_modules` is empty in this worktree. The same failure occurs in the frozen `fc65a9da` checkout,
so it is independent of this change and was **NOT RUN** here.

## 4. Actual native end-to-end qualification still owed (Release)

1. Build the pinned image and run the child probe: real `sigtool --info` over the two published `.cvd` files, and a
   real `freshclam` refresh with the generated configuration (confirming `ScriptedUpdates no` yields full signed CVDs
   and that the staged directory contains only `.cvd` plus recognised sidecars).
2. Real `clamscan --database <published snapshot database>` admission over a real corpus, including a corpus file that
   is actually detected, and confirmation that only verified containers are read.
3. Real OCR/rasterizer path: `tesseract`/`pdftoppm` present, real 201-page document through real `pypdf`, real
   over-limit JPEG at the ARM image's Pillow, confirming the same honest limitations.
4. CONTROL Fargate in-container `bwrap` namespace capability remains UNOBSERVED (no ECS Exec channel): the sandbox
   admission is still unproven and must not be reported as working.
5. A5 owns the production join (`createUploadInspection({scanner, extractor, now})`) and image-digest observation.

## 5. Not done / not touched

No image build, no `freshclam` download, no cloud/AWS/browser/DB work, no model call, no privilege/IAM/Exec change, no
new runner or agent. No dependency, lock, pin, package, catalog, version or registry edit — the freshclam configuration
lives in the module, so the Dockerfile needed no change and all existing pins (including
`infra/product-preview/runtime-packages.lock.json`) are untouched. A5's custody/extraction/policy/application paths,
M5/M7 paths and `temporal-launch-*` are untouched. Write scope was exactly four files:
`apps/runtime/uploads/native-definitions.mjs`, `apps/runtime/uploads/test/native-definitions.test.mjs`,
`apps/control/uploads/native/extract.py`, `apps/control/uploads/native/test/test_extract.py`.
