# Wave5 upload native — FINAL SOURCE successor (S1/S2/S3/S4/S5/S6/S7 follow-up)

Bounded source-only successor to the reviewed provisioning candidate. It implements the five actionable notes the
independent review returned against the frozen commit, plus the doc fragment note, and returns a join/budget design for
the host owner. No Release, qualification, acceptance, deployment or image claim is made anywhere in this tree.

## Identity and immutability

| Role | Commit | Tree |
| --- | --- | --- |
| Predecessor, reviewed SOURCE PASS (frozen, untouched) | `4237a64f3b2de600d6ea4c374ae395d5ad1915bb` | `1b513780e3e4f3efd1dabd3c2eb58fc9139f42c9` |
| This successor | see `outputs/WAVE5-UPLOAD-NATIVE-FINAL-SOURCE-AUTHOR-HANDOFF.txt` | (same file) |

Branch `codex/wave5-upload-native-final-source-20261028`, worktree `work/wave5-upload-native-final-source-20261028`,
created from exactly `4237a64f3b2de600d6ea4c374ae395d5ad1915bb`. Predecessor commits, handoffs, reports and evidence are
immutable and were not modified. The review report is
`outputs/WAVE5-UPLOAD-NATIVE-PROVISIONING-HERMES-REVIEW.txt` (sha256
`080d4f023c49cc8bc6cac0dd83ec2b060774889ed791aa38d57d1a109cbc12f2`, 27,156 B) and was read, not rewritten.

Dependencies: read-only reuse of the A5-owned input checkout (`work/wave5-upload-input-20261028/node_modules`, 14 flat
package entries) copied into this worktree's ignored `node_modules`; no install, no registry call, no shared-cache
mutation. Scratch authoring aids live in `.provisioning-scratch/` and are excluded by the repository's own
`.git/info/exclude`; nothing there is committed.

## S4 — the pinned parser mapping can no longer thin out silently

`apps/control/uploads/native/extract.py`

- `PINNED_PARSERS` now names every pinned library **and** the exact exception it must expose:
  `lxml.etree.XMLSyntaxError`, `pypdf.errors.PdfReadError`, `openpyxl.utils.exceptions.InvalidFileException`.
- `parser_library_state()` reports each as `required-present`, `absent-library` or `broken-symbol`.
  A library that cannot be imported at all is honest unavailability (that format stays unavailable, and the
  qualification run records an explicit skip). A library that **imports but does not expose its exception** is a
  `broken-symbol` defect.
- `library_errors()` is now strict: `zipfile.BadZipFile` is always present (stdlib), every importable pinned library
  must contribute its exception, and any `broken-symbol` raises `ExtractorConfiguration` naming the exact library and
  symbol — the mapping can never quietly shrink to a smaller tuple.
- `main()` builds the mapping before extracting. On `ExtractorConfiguration` the child reports the distinct limitation
  `NATIVE_EXTRACTOR_CONFIGURATION`, prints the detail, and exits 3 — never `PARSER_ERROR` (a document refusal) and never
  `NATIVE_EXTRACTION_UNAVAILABLE` (an outage). Document-level refusals still map to `PARSER_ERROR` exactly as before.

Tests (`test_extract.py`, real installed cases plus a controlled missing-symbol case): completeness against every
importable pinned library, `AttributeError`-on-symbol ⇒ `ExtractorConfiguration` and `ImportError` ⇒ honestly absent,
and the child's own exit-code/limited-code path driven in-process.

## S5 — storage accounting is MEASURED, and unprovable accounting is UNKNOWN

`apps/runtime/uploads/native-definitions.mjs`

- `measureTree()` walks with `lstat`: a regular file contributes its own size, a **symlink contributes only its link
  size and is never followed**, a directory contributes its children. Enumeration is bounded (depth 8, 4096 visited
  entries). Any failed `lstat`/`readdir`, or an entry that is neither file/directory/symlink, marks the whole
  measurement **unproven**. Nothing is deleted, moved or repaired by the measurement.
- `pruneSnapshots` measures the actual root: every published snapshot, every unparsable hash-named directory, every junk
  file, every **orphaned staging** directory (measured and counted, never removed) and the `current` pointer. `bytes` is
  that measured total, not the sum of declared manifest sizes.
- Reported disposition adds `proven`, `state` (`MEASURED_OVER_BOUND` / `MEASURED_UNDER_BOUND` / `UNMEASURED`),
  `classes`, `measuredEntries`, `symlinkEntries`, `unmeasured` and `stagingEntries`. When the measurement is unproven,
  `overBound` is **`null`** (never a comfortable `false`) and **every removal is suppressed** — an incomplete
  enumeration cannot justify a deletion — with candidates reported as `STORAGE_UNMEASURED_RETAINED`.
- Unchanged and re-asserted: reader-pin proof is the only deletion authority (`isIdle` from live reader accounting plus a
  recorded child completion), `current` and `keep` ids are never removed, unparsable/foreign/unowned paths are never
  removed, and the retained floor still applies.

## S6 — bookkeeping reclamation after a confirmed prune

The store's `prune` deletes the reader entry for an id it **proved idle and then removed**, so the map is bounded by the
live snapshot set rather than by publication history. Nothing else is ever dropped: an unproved or unknown reader state
is exactly what keeps its snapshot.

The store's `prune` also now forwards caller-supplied `retain`/`maxSnapshots`/`maxBytes`, so a caller that must meet a
tighter bound is answered against **its** declared bound instead of silently against the module defaults. Defaults are
unchanged.

## S2/S3 — one truthful final package declaration

`apps/runtime/Dockerfile` + `infra/product-preview/runtime-packages.lock.json`

- The renderer layer still pins `libstdc++=16.2.0-r1` / `libatomic=16.2.0-r1` (byte-identical, an immutable prior pin)
  and is now explicitly annotated: the upload layer deliberately installs the pinned closure's **libstdc++ 16.2.0-r2**
  and **libgcc 16.2.0-r2**, which supersede the libstdc++ pin in the final image.
- The upload layer's `apk info -v` loop now names the actual intended final versions —
  `libgcc-16.2.0-r2`, `libstdc++-16.2.0-r2`, **`libatomic-16.2.0-r1`** (added) — and explicitly **fails** if the
  superseded `libstdc++-16.2.0-r1` survived into the final image.
- `uploadNativeProvenance.declaredFinalVersions` records the intended final triple, the exact superseded pin
  (name/version/sha256 `02f7d7be…`), its replacement (sha256 `a004dfb5…`), what asserts it, and that runtime ABI
  correctness remains native qualification. `uploadNativeProvenance.baseInstalledSet` states honestly that the base
  image's own installed set is **UNOBSERVED** (`observed:false`), names the intended upgrade set, and records that
  because every install names exact archive files a base carrying a newer revision makes `apk add` refuse it — a
  fail-closed build failure, not silent drift.
- Preserved: all existing lock members, all archive hashes, the recorded `packageIndexSha256` (`991dd62e…`, the earlier
  retrieval of the same rolling index) and the closure note's actual index revision (`ac5d94af…`). No approved top-level
  pin was changed and no arbitrary upgrade was introduced.

## S1 — join/budget design for the production host owner (design only, nothing in A5 was edited)

Read-only facts established from A5's owners:

- `apps/runtime/product-ports/index.mjs`: `PRODUCT_FAMILIES` maps `uploads` → `createUploadsFamily`, and
  `createProductPortsFactory` returns `productPortsFactory(context)` whose families are **ordinary synchronous**
  factories documented as performing no IO, no connection, no secret read and no SQL at construction.
- `apps/runtime/product-ports/uploads.mjs:37-52`: `createUploadsFamily(owners)` accepts `owners.inspection` (validated
  with `storageMethod(supplied.inspection,'inspect')`) and line 52 falls back to
  `supplied.inspection ?? createUploadInspection({now})` — i.e. today's production CONTROL gets an inspection port with
  **no native scanner/extractor**, which is fail-closed.
- `apps/runtime/product-ports/lifecycle.mjs` is the scheduled-run **admission** family (`createNativeLifecycleAdmission`)
  and is *not* a provisioning/lifecycle owner for definitions. No timer/daemon/platform owner exists for it, and this
  successor does not create one.

Minimal join, for the existing async CONTROL startup owner (whoever calls `startControl` with the port factory):

1. At startup, in that already-async owner, `await composeUploadNativeHost({configuration, deadlineMs, signal})` **once**
   (its own absolute startup budget; the host makes exactly one bounded provisioning attempt at startup and changes
   nothing on failure).
2. Inject the result through the existing seam:
   `createUploadsFamily({inspection: createUploadInspection({scanner, extractor, now})})`. The family factory stays
   synchronous and IO-free; composition happens outside it, which is the only shape the family contract allows
   (my composition is async and does IO).
3. For a long-lived CONTROL, drive the **same** serialized refresh owner from that owner's own bounded budget:
   `host.provisionDefinitions({deadlineMs, signal})` (newly exposed, the identical closure scans use — no timer, no
   daemon, no second path, concurrent callers still share one in-flight attempt, the given absolute deadline is passed
   straight through). The owner can call it on whatever bounded lifecycle beat it already has (e.g. its startup budget,
   or a scheduled entry it already owns); this delta deliberately does not add one.
4. Budget honesty: per-scan behaviour is unchanged and remains fail-closed — a stale root is answered by **at most one**
   attempt inside the scan's own deadline, and a scan is `unavailable` unless an actual fresh snapshot resolves.
   Whether a full signed CVD download+verify fits in 30s/60s (or any window) is **UNMEASURED** and unclaimed; the
   qualification run must measure real `freshclam`+`sigtool` durations before any availability claim.

## Verification (source-only, on these exact bytes)

- `node --test apps/runtime/uploads/test/{native-definitions,native-inspection,composition,native-provisioning}.test.mjs`
  → **36 tests, 36 pass, 0 fail, 0 skipped** (includes the new measured-storage, unproven-storage, bookkeeping-reclaim
  and owner-driven-provisioning tests).
- `python -m unittest discover -s apps/control/uploads/native/test -p "test_*.py"` → **Ran 27 tests, OK, 1 skip**
  (the skip is the docx/lxml real-parse path; `lxml` is not installed on this authoring host, and the inertness
  assertions in that test still run).
- `node --check` on the three changed modules, `py_compile` on both changed Python files, `json.load` on the lock
  (106 `systemPackages`, all seven approved archive hashes still present) — all clean.

### Deliberate extra change, recorded

`apps/runtime/uploads/native-inspection.mjs` now checks snapshot-directory containment against separator-terminated
prefixes of the declared root in **both** separator forms. The previous form appended `/` only, so a declared
Windows-style root (this authoring host) made the containment check reject its own snapshots. The security property is
unchanged (a prefix always ends in a separator, so `/srv/defs-evil` still does not match `/srv/defs/`).

## NOT RUN / not claimed

Image build, `apk add --no-network` install path, ARM/native execution, real `clamscan`/`freshclam`/`sigtool`,
Tesseract/Poppler, corpus, `unshare(NEWUSER|NEWNS|NEWNET)` admission on Fargate, the declared image digest
(`imageObserved:false`), deployment, and the A5 factory/control/runtime-config join above (design only, not applied).
The Data heavy-WSL gate is active. This successor is not yet independently reviewed.
