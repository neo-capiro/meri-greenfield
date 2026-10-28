# Wave5 native upload — signed-definition snapshots correction (2026-10-28)

Successor of the toolchain session. Source-only correction of four concrete gaps A5's source intake
found in the claimed signed-definition host. No image build, no native run, no corpus, no network
refresh, no cloud/AWS/DB/browser action, no authority change. Nothing here is a qualification,
acceptance or independent-review claim.

    base   5ca1333c54c9251d538baa063ca2e94c9c058921 / tree 1f3ff7f3872368c1493efdc97bb7e18e9577c3a1
    branch codex/wave5-upload-native-snapshots-20261028  (no upstream; nothing pushed)

## 1. Definitions are now immutable, atomic and content-addressed

`apps/runtime/uploads/native-definitions.mjs` was rewritten around a different ownership model. It previously
wrote `root/database` and `root/snapshot.json` **in place**, so a scan that resolved the snapshot could still be
reading a database a concurrent refresh was mutating, and `snapshot()` trusted the JSON `signatureVerified` flag
without ever looking at the current database bytes. Both are fixed.

Layout under the definitions root (now `/run/meri/upload-definitions`; see item 4):

    root/staging/refresh-<unique>/      one uniquely owned staging directory per refresh (mkdtemp)
    root/snapshots/<sha256>/            immutable published snapshot: database/ + snapshot.json
    root/current                        pointer file: the id of the current snapshot

Refresh (`createSignedDefinitionUpdater.provision`):

1. stage in a uniquely owned directory (`mkdtemp`), with a generated `freshclam.conf` inside it;
2. run freshclam with `cwd` = that staging directory only;
3. classify every staged entry — a directory, a symlink, an unapplied `.cdiff` delta, a partial download or any
   unknown type fails closed as `UPLOAD_DEFINITIONS_FORMAT_UNSUPPORTED`; the set must cover the required logical
   databases (`main`, `daily`) or it fails as `UPLOAD_DEFINITIONS_INCOMPLETE`, so the current daily database is
   **never silently omitted**;
4. verify real publisher signatures before publishing (see formats below);
5. hash the real bytes of every file, compute the content id from the complete verified file records
   (`name`, `format`, `derivedFrom`, `sha256`), write `snapshot.json`, and publish by a single
   `rename(staging, root/snapshots/<id>)` — atomic within the filesystem, and only an already-verified directory
   can be published;
6. set the pointer with `write(tmp) → rename(tmp, root/current)`.

A failure at any step throws before publication; the `finally` removes the staging directory, so a failed refresh
or an unverifiable signature leaves the previous snapshot and pointer untouched. An identical content id already
present is reused (`rename` EEXIST/ENOTEMPTY) instead of being rewritten. Published snapshots are **never deleted
or rewritten**, so a reader that resolved an older snapshot keeps a valid, unmoved directory. Concurrent refreshes
stage in separate directories and converge on one published id.

Scan resolution (`createSignedDefinitionStore.snapshot`) is read-only and proves the bytes:

1. the pointer must be a 64-hex id — traversal (`../../etc/passwd`), empty or compound values fail closed;
2. the snapshot directory must be a real directory (not a symlink) that exists;
3. `snapshot.json` is shape-validated (`schema`, id agreement, `signatureVerified === true`, file records) and its
   recorded id must equal the id recomputed from the records;
4. the directory listing must equal exactly the recorded file set — a missing file, an added file, a directory or a
   symlink in the database all fail closed;
5. every database file is `lstat`-checked (regular file, not a symlink), read, and re-hashed against its recorded
   size and sha256; the id is then recomputed from the verified records;
6. a future-dated snapshot is refused, an expired one is `UPLOAD_DEFINITIONS_STALE`, a cancelled call is
   `UPLOAD_DEFINITIONS_CANCELLED`.

The returned identity is therefore what ClamAV will actually read, not merely what a JSON file said. Failures are
distinct closed codes: `UPLOAD_DEFINITIONS_UNAVAILABLE` (absent/unreadable), `..._CORRUPT` (tampered, forged,
symlinked, added/missing), `..._STALE`, `..._UNVERIFIED`, `..._FORMAT_UNSUPPORTED`, `..._INCOMPLETE`,
`..._REFRESH_FAILED`, `..._PUBLISH_FAILED`, `..._CANCELLED`, `..._EXPIRED`, `..._CONFIGURATION`.

### Real FreshClam formats (primary vendor source)

The vendor `freshclam.conf.sample` documents `CompressLocalDatabase`: *"By default freshclam will keep the local
databases (.cld) uncompressed to make their handling faster. With this option you can enable the compression."*
The default is therefore `.cld`, which is the **unpacked** local database and carries **no** embedded publisher
signature — the previous code assumed freshclam produces `.cvd` files and would have mis-handled the real default.

The fixed configuration now sets `CompressLocalDatabase yes`, so the local database stays in its signed container
form. A staged `.cld` is accepted only when its signed `.cvd` sibling is present in the same verified set and is
recorded as `derivedFrom: <name>.cvd`; a `.cld` without that sibling fails closed as `..._UNVERIFIED`. An unapplied
`.cdiff` is not a usable database and is refused rather than published.

Verification forms were taken from the pinned ClamAV 1.5.x vendor manual, not assumed: `sigtool --verify` is the
**detached-signature** form (it expects a detached `.sign` file we neither ship nor accept) and is never used.
Supported forms are `--info` (CVD information plus MD5 and embedded digital signature) and
`--verify-cdiff=<file>` (CDIFF against the current CVD), exported as `cvdVerificationArguments`,
`cdiffVerificationArguments` and the `verificationArguments` dispatcher.

## 2. Scanner exit 1 with no parseable detection is unavailable, never clean

`native-inspection.mjs` gained `classifyScanExit({exitCode,detections})`, now the only exit-code decision:

    exit 0 + no detections            -> clean
    exit 0 + detections               -> unavailable / SCANNER_OUTPUT_UNEXPECTED   (contradictory output)
    exit 1 + no parseable detections  -> unavailable / SCANNER_OUTPUT_UNPARSED     (unknown/truncated/unparseable)
    exit 1 + detections               -> classifyScan(): malware, else SCAN_LIMIT_REACHED
    any other exit                    -> unavailable / SCANNER_UNAVAILABLE

So unknown, truncated or unparseable exit-1 output can no longer be reported as clean, while a real exit 0 with no
detection is still clean and malware/limit alerts are unchanged.

## 3. No claimed observed image/toolchain provenance

The admission `imageDigest` arrives from configuration and is copied into qualification; there is **no local image
observation** in this path. `describe()` now exposes `expectedImageDigest`, `imageObserved: false` and
`imageObservationOwners` instead of presenting the declared value as host provenance, and `composition.mjs`
documents the input as a declared expectation. The closed A5 receipt `tool` fields (`name`, `version`,
`binarySha256`) are unchanged, and no metadata provider or network call was added.

No local existing observation seam can be called from the upload body without an allocation, so the **production
join requirement returned to A5** is: bind the declared digest to an observation from the existing runtime image
owner — `apps/runtime/native-authority/ecs-task-binding.mjs` (observed ECS task image) or
`apps/runtime/artifacts/renderer-contract.mjs` / `material-init.mjs` (AgentCore renderer image binding, which is
what `composeUploadNativeHost` already threads as the declared expectation) — and carry any new private provenance
in a separate A5-owned field. This successor deliberately claims nothing about an image it cannot observe.

## 4. Writable definition storage reconciled with the real mount

`/opt/meri/var/upload-definitions` was not a writable volume: it was merely created and chowned inside the image.
The definitions root is now `/run/meri/upload-definitions`, inside the already declared task-local VOLUME
`/run/meri` (`apps/runtime/Dockerfile` line 125 creates it 0700 as the pinned node UID; the `VOLUME` line already
listed `/run/meri`). The Dockerfile change is that single owned-path adjustment; every pinned package layer, tool
path and prior layer is untouched, and the system/package pins stay frozen.

Persistence/refresh requirement (recorded, not activated): `/run/meri` is task-local and ephemeral, so a fresh
task has no snapshot until a refresh runs in that task. The store keeps the last valid snapshot for the task's
lifetime and fails closed (`..._UNAVAILABLE`) rather than scanning without one; no persistent shared cache and no
serving/infra change is invented here. Pruning published snapshots is deliberately left to a future owner — this
module never deletes one.

## Checks actually run (this host, final bytes)

    node --version                                        v24.22.1
    node --test apps/runtime/uploads/test/*.test.mjs      tests 28, pass 28, fail 0, skipped 0, exit 0
    python -m py_compile extract.py                       not re-run: extract.py is unchanged in this successor

New and changed witnesses include: publish-then-resolve with the real byte hash; atomic pointer move; a staged
`.cld` with and without its signed `.cvd`; `.cdiff`/unknown type/directory/incomplete set refused with no pointer
and no staging left behind; failed refresh, unverified signature and expired deadline preserving the previous
snapshot; tampered bytes, added file, missing file, symlinked file, forged `signatureVerified`, forged id, forged
`derivedFrom`, future date, non-JSON manifest and a snapshot without its database all closing closed; pointer
traversal/empty/compound values refused; stale and cancelled closes; an in-flight reader keeping the exact bytes it
resolved after a later refresh published a new snapshot; concurrent refreshes converging without collision; scan
exit-1 unparsed/truncated/empty output unavailable and exit 0 clean; a store resolving outside the configured root
not admitted; and each scan bound to the directory its own resolve returned.

## Limits (unchanged and honest)

Not implemented, not activated, not qualified: no ARM image build; no real freshclam download or `sigtool`
execution; no observed ClamAV/Tesseract/Poppler behaviour; no corpus, no sandbox syscall evidence (CONTROL's
namespace capability remains UNOBSERVED); no serving/infra mount activation; no image-digest observation. The
process port in the tests is injected and synthesises fixture bytes only. A5 still owns the production join and the
public receipt changes.
