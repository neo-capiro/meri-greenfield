# Community Linux import qualification candidate

This new package-based image keeps LiteLLM1.104.2, required proxy-extras0.4.102.post1,
Prisma0.11.0 / CLI5.4.2 / engineac9d7041ed77bcc8a8dbd2ab6616b39013829574.
It uses the explicitly allocated immutable Node24.21.0 Debian13 image and signed
20261009 snapshot with Python3.13.5. It does not adopt the wider upstream image or
its enterprise tree, and does not change any earlier Wolfi ABI/security finding.

`assembly-pins.json` owns the exact source/artifact identities, selected wheel
metadata, license members and limits. `requirements.lock` is the exact-artifact
projection of standard uv0.12.1 resolution for Linux CPython3.13.5, with hashes,
plus the explicit same-version SoundFile platform-artifact supplement below.
No hand-written resolver is involved. The Windows NumPy1.26.4 selection has no
CPython3.13 wheel: the compatible upstream-lock NumPy2.4.4 branch is selected.
Windows-only pywin32 is absent; upstream uvloop0.22.1 and pyroscope-io0.8.16 are
present. All124 target wheels were actually downloaded and their METADATA,
Requires-Python, platform tags and selected dependencies inspected as DATA.
210 selected requirements pass; the one proprietary enterprise requirement is
explicitly excluded. This is **not** satisfaction of the complete upstream
`litellm[proxy]` extra. Distribution notices are retained; the packaged-notice
gaps listed in pins are unresolved legal evidence, not license approval.

## Exact build context

Create a fresh context with these seven source files and an `artifacts/`
directory containing exactly the331 records in `assembly-pins.json.artifacts`:

```
Dockerfile  assembly-pins.json  requirements.lock
prisma-build.py  import-probe.py  assembly.test.py  README.md
artifacts/wheels/<124 exact filenames>
artifacts/npm/{prisma-5.4.2.tgz,prisma-engines-5.4.2.tgz}
artifacts/engines/{query-engine,schema-engine}-debian-openssl-3.0.x
artifacts/engines/{query-engine,schema-engine}{.sha256,.gz.sha256}
artifacts/engines/{debian-openssl-1.1.x,linux-musl,linux-musl-openssl-3.0.x}/query-engine{,.sha256,.gz.sha256}
artifacts/schema.prisma
artifacts/notices/<exact pinned records>
```

The prior DATA-only copy is `.task-inputs/linux-remaining-engine-assembly-1/context-artifacts-1`
in the dedicated `g1-proxy-linux-remaining-engine-assembly` worktree. Its sibling
`artifact-context-manifest-1.json` binds330 files/271,935,624bytes. All previous321
files/219,286,960bytes are unchanged, including tqdm's LICENCE. Nine recovered
query-engine bodies/sidecars add52,648,664bytes. The old320/321 projections remain
unchanged. The first new Windows copy hit MAX_PATH; its partial directory is
preserved as `context-artifacts-1-FIRST`. A new DATA helper completed a fresh
context using Windows extended-length file paths, without overwriting the partial.
The fresh SoundFile qualification context is
`.task-inputs/linux-soundfile-assembly-1/context-artifacts-1` in the dedicated
`g1-proxy-soundfile-assembly` worktree; its sibling
`artifact-context-manifest-1.json` binds331 files/273,112,858bytes. It preserves329
old artifacts, replaces only the SoundFile wheel and adds one bundled LGPL notice.
The prior330-file context and all prior failed/successful build evidence remain
unchanged. Native extended-length paths are used for streamed Windows copy/hash.
Binaries are ignored evidence and must be independently pinned/copied by the build owner;
they are not committed source. No extra or link may enter the context. The
Dockerfile verifies the complete artifact set before offline installation.

## SoundFile and fixed offline pricing prerequisite

The first guarded E3 app import failed with OSError at SoundFile0.12.1's final
`libsndfile.so` fallback; its universal wheel contains no native library. The new
qualification candidate selects the official same-version
`soundfile-0.12.1-py2.py3-none-manylinux_2_31_x86_64.whl`, SHA256
`074247b771a181859d2bc1f98b5ebf6d5153d2c397b86ee9e29ba602a8dfe2a6`.
Both Python modules and full METADATA are unchanged; the other123 wheels,
requirements and all engines/schema remain exact. This supplies the bundled
`_soundfile_data/libsndfile_x86_64.so` (embedded version string libsndfile1.2.0).
It is a qualification artifact selection supplement, not a new resolver result
or a successful native-load/security verdict. The original uv pylock pin remains
historical resolution provenance; the current hash projection names this wheel.

Retain the unchanged BSD3-Clause package notice and the newly inventoried full
`_soundfile_data/COPYING` LGPL2.1 notice. Corresponding source, native codec notices,
relinking obligations and vulnerability disposition remain unqualified; the
artifact-closure flag does not clear those holds. The tokenizers notice gap also
remains open. No broad production/release/license acceptance follows.

The recipe sets supported `LITELLM_LOCAL_MODEL_COST_MAP=True`, which pinned
LiteLLM1.104.2 checks before its remote pricing-map HTTP/retry path. It uses the
wheel's existing local backup, retaining the network-none and audit guards.
Earlier blocked GitHub pricing metadata fetches were not model calls. This
setting does not prove every future socket/self-pipe attempt disappears; retain
and review all actual import diagnostics in a fresh separately admitted run.

The fixed CA bootstrap retains Debian signatures over HTTP, then switches to
normal HTTPS. All inherited installed packages receive a no-removal upgrade
within that same signed snapshot; there are no Office/browser dependencies.
Installation uses no-index/no-deps/require-hashes/binary-only and no source build.
The build owner must enable BuildKit: both package install and generation use
`RUN --network=none`. No npm install/lifecycle hook is used. The two exact npm
archives are safely unpacked as DATA to `/opt/prisma/binaries/node_modules`.

## Prisma generation boundary

`prisma-build.py` owns bounded input/hash checks, exact offline cache assembly and
the one build-only `node .../prisma/build/index.js generate --schema ...` command.
It never pushes a schema, migrates or connects to a database. It uses a synthetic
localhost:1 datasource only for generation. Generation has a240s child deadline,
group kill on timeout/error and retained raw streams, with a post-completion16MiB
stream bound; this is not a live byte-kill guarantee or universal descendant proof.
The separately bounded build/container remains necessary.

The74271-byte Linux wheel schema is raw-byte equal to the pinned repository
schema. Its five original binary targets remain unchanged. Exact native Debian
OpenSSL3 query/schema engines and their upstream checksum texts were recovered
and independently hashed from previously retained registry CAS. Eight checksum
endpoint requests returned403 and remain preserved; this is not release absence.
The three distinct Debian1.1/musl/musl3 query engines and each checksum sidecar
were subsequently recovered from the same retained upstream layer22 and accepted
as DATA at c45f67eff756ae545b7163265348beb7e4b02bf8. Pins retain their exact
provenance and closed target-to-artifact mapping. All four query platforms receive
their own commit/target cache directory. The native schema-engine remains native
only; no other schema engine is invented. Uncompressed checksum text must match
its pinned body; retained gzip checksum text does not verify an unacquired gzip
payload. No checksum bypass or platform override is enabled.

The retained upstream generated client has four concrete query-engine keys:
Debian1.1, Debian3, musl and musl3; `native` resolves to Debian3. The future genuine
generation must produce exactly those four keys, exact canonical Prisma package
paths, and each platform's pinned body/size. Unknown/missing/native-alias keys,
other paths or a different platform's accepted body are refused. Five schema
targets remain raw-byte unchanged. Actual offline generation/import may still
fail; no generated-client copy, generation success or ABI claim is made here.

A successful future build retains actual Node/Python versions, dpkg inventory,
Python distribution versions and generated Prisma `BINARY_PATHS`, package file
hashes and engine hashes under `/opt/meri-proxy/build-evidence/`. Generation and
inventory observation alone do not establish genuine app import or authentication.

## Guarded genuine import interface

The entrypoint is:

```
/opt/meri-proxy-venv/bin/python -I -B /opt/meri-proxy/import-probe.py
```

It requires Linux Python3.13, UID10001 and the fixed venv. `--help` is safe before
configuration or import. The owner runs it with network-none, read-only root,
cap-drop ALL, no-new-privileges, tmpfs `/tmp:rw,noexec,nosuid,nodev,size=128m`,
pids64/memory2GiB/cpus2, workdir `/tmp`, HOME `/tmp/meri-home`, TMPDIR `/tmp`, no
AWS/provider/database credentials/binds/socket, plus an external finite deadline
and explicit owned-container removal. The probe adds a45s alarm and audit denial
of socket/DNS/process/native CLI effects **before** real upstream app import;
native Python extensions are genuinely imported. Python-level upstream stdout
is retained on stderr; the final structured JSON record is on stdout. It records
actual generated-client/app/route observations and sanitized denied-event names,
not fabricated auth/Prisma objects. Any denied effect requires owner review even
if upstream catches it and import completes. Audit hooks complement the container
controls; they are not a complete sandbox for native extensions.

This stage invokes no route, lifespan, listener, database engine or paid model.
Disposable PostgreSQL, real community virtual-key issuance/revocation/auth,
budget/fencing integration, native ABI/security, Linux import and G1 remain OPEN.

## Offline checks

Run `python -I -B assembly.test.py` with an author/reviewer stdlib interpreter.
These checks inspect source/lock/pins, safe archives and guarded file handling.
They never install or import LiteLLM, run Prisma/native code, build an image or
pretend that a genuine app import passed. Full real build/import is a later owner
action against the exact context, after distinct review.
