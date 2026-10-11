# Community Linux assembly source prepared; native gates remain open

Codex prepared eight new, scoped paths on branch `task/g1-proxy-linux-community-assembly`
in `C:/dev/main/meri-greenfield-worktrees/g1-proxy-linux-community-assembly`, based on
`8586f6279eac5a43132d4df3a7dbb6962c808009`. AGENTS, implementation standards and
the current deployment plan were read; the ignored outline preceded code.
No Hermes, child agent, package installation, Prisma/native execution, image
build, application import, listener, database, AWS or model operation ran.

This is an independently reviewable **source and artifact DATA candidate** for
one later owner-controlled Linux build/import. It does not pass G1, authenticate
a virtual key, qualify native ABI, waive licensing/security or replace any
previously measured failure. The earlier Wolfi/full-image/Windows preparations
remain immutable and retain their own holds.

## Scope and canonical responsibilities

All tracked changes are NEW under `apps/proxy/qualification/linux/`:
`Dockerfile`, `assembly-pins.json`, `requirements.lock`, `prisma-build.py`,
`import-probe.py`, `assembly.test.py`, `README.md`, plus this report.

`assembly-pins.json` owns finite artifact identities and observed metadata;
the lock is a projection of standard uv resolution. The Dockerfile owns the
explicitly allocated signed Debian/Node/Python image assembly and build
inventories. `prisma-build.py` owns only verified offline cache assembly,
generation and generated-client evidence; its small CLI performs no import-time
action. `import-probe.py` separately owns guarded genuine upstream app import
and route observation. There is no new dependency resolver, HTTP framework,
product orchestration, DB migration, broker or parallel authentication system.
The two scripts are approximately16KiB/5KiB, with one-direction dependencies on
stdlib/upstream packages; no cross-script import or circular dependency.

## Actual Linux dependency/artifact evidence

The owner allocated Node24.21.0-trixie-slim index
`173f125896c3b47ddf056734c7ea789d04595a6a08769a8f78e0df642781fb66`,
amd64 manifest `c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63`,
signed Debian13 snapshot20261009T000000Z, CA20250419 and
Python3.13.5-1 + venv. The worker's signed HTTP CA bootstrap followed by normal
HTTPS is reused without Office/browser packages. No-removal dist-upgrade refreshes
inherited packages within the same snapshot. No TLS/signature bypass exists.

Standard uv0.12.1 resolved CPython3.13.5 x86_64-manylinux_2_40 binary artifacts
using the canonical upstream lock and compatible accepted selections. No Python
download, source build, ambient proxy/config or custom resolver was used.
Actual uv SHA256: `f537cc65c1791d9d1a022132302b21ecd48cdf0a605a7b345809fbe8af4e807d`.
The pinned upstream lock is1904682bytes,
SHA256`1ac0d01bfc5e7b8674edf1f97ebe4fdc9e401d204b010ef0adf797e1ea08af18`.

Actual wheel evidence contains124 files/175,405,911compressed bytes. All selected
METADATA identities, Requires-Python and actual WHEEL tags satisfy the inspected
Linux CPython3.13 target. A standard packaging marker/extras check found211
selected requirements:210 satisfied and one explicit proprietary
`litellm-enterprise` exclusion. This is **not** complete upstream `[proxy]`
satisfaction. Windows-only pywin32 is omitted; upstream uvloop0.22.1 and
pyroscope-io0.8.16 are included. Accepted NumPy1.26.4 cannot supply a CPython3.13
binary; the compatible upstream-lock2.4.4 branch is selected and recorded.

Every actual wheel RECORD was independently streamed as DATA:124 wheels,
14,249 members,559,431,074uncompressed bytes, zero errors. Per-member512MiB and
aggregate5GiB caps apply, and no wheel code was imported. Polars remains present:
its member above the old128MiB limit was hashed in bounded chunks rather than
omitted or loaded wholesale. Archive paths, duplicates, links, sizes and RECORD
digests were checked. This is archive integrity, not a native security scan.

The exact Linux LiteLLM wheel is36850695bytes,
SHA256`416c3538ea78b08d637ec45564a919232aa2093e73adb9dd7752f7cff2ec585e`.
Extras0.4.102.post1 is187378bytes,
SHA256`b1208c9991546e7b01b5d22ffa7ae3eb6c53c92bf388f8e54433868d234a2b05`;
Prisma0.11.0 is109302bytes,
SHA256`22bb869e59a2968b99f3483bb417717273ffbc569fd1e9ceed95e5614cbaf53a`.
The community wheel excludes the enterprise subtree; separate enterprise code
is not installed.184 originally selected wheel notice members are retained;
tqdm's1985-byte British-spelled LICENCE was additionally recovered from its
already pinned wheel. Tokenizers' packaged-license-material gap remains open.
Metadata classifiers are not a substitute for missing full terms/legal review.

## Exact Prisma cache; honest generation boundary

The Linux wheel schema and pinned repository schema are raw-byte equal:
74271bytes, SHA256`dbb02f20858ed397ea83b0dfabe2d3cfe59ef658976fdcde373c5baad33df387`.
All five original targets remain: native, Debian OpenSSL1.1/3, musl and musl3.
Two exact npm archives match their published SHA512 integrity and retained OCI
package/code/license bytes: Prisma5.4.2 has86 safe members and engines5.4.2 has10.
They are manually copied as DATA; no npm install or package lifecycle hook runs.

The distinct engine DATA session recovered and rehashed the exact native pair
from retained OCI CAS for engine commit
`ac9d7041ed77bcc8a8dbd2ab6616b39013829574`:

| Engine | Bytes | SHA256 |
| --- | ---: | --- |
| Debian OpenSSL3 query |17,568,600|`ceb43f7d85a862ce26c707534076094118040c834f2331025253c18079410626`|
| Debian OpenSSL3 schema |20,263,736|`75b9d65536770c48da858d2f563b5b0bf8274faa07366c78dc5c5a8bbf260f02`|

Their retained uncompressed checksum texts exactly match; retained compressed
checksum sidecars are included without pretending compressed engine bodies were
acquired. The supported upstream cache layout is populated under
`/opt/prisma/.cache/prisma/master/<commit>/debian-openssl-3.0.x`. Explicit
single-engine override variables are deliberately absent: one native binary
must never be relabeled as the other schema target families.

Eight fixed checksum endpoints returned403; seven raw17-byte bodies are retained,
and the first failure has only its original traceback. None was retried. The
body says `error code: 1010`; it does not establish a removed release or origin.
The exact native pair was acquired from existing CAS instead. The other target
families remain unacquired. If real generation requires them, the mandatory
network-none generation must fail and identify the missing target. There is no
schema reduction, checksum waiver, silent network repair or generation claim.

BuildKit installation/generation use `RUN --network=none`; pip is no-index,
no-deps, binary-only, require-hashes and no-compile. No mutable external Dockerfile
frontend is requested. The build owner must supply a BuildKit frontend supporting
the network flag and retain its actual tool version. The generator gets a240s
child deadline and retained raw binary streams;16MiB is a post-completion bound,
not a live disk/byte-kill guarantee. The build requires an independent outer bound.
Successful output records actual BINARY_PATHS, generated package hashes and pinned
native query-engine hashes. Node/Python versions, dpkg packages and installed
Python distribution versions are emitted before generation and retained under
`/opt/meri-proxy/build-evidence/`; missing commands fail rather than produce
placeholder inventories.

## Genuine import interface and checks actually run

Owner interface: `/opt/meri-proxy-venv/bin/python -I -B /opt/meri-proxy/import-probe.py`.
It requires Linux/Python3.13/UID10001/fixed venv and no sensitive ambient
AWS/provider/database environment. Before genuine app import it installs audit
denial for socket/DNS/process/native CLI effects and a45s alarm. Native extension
imports are real. Upstream Python stdout is preserved on stderr; the final
structured stdout contains actual generated-client/app/route observations,
sanitized trace/module names and bounded denied-event names. Upstream-caught
denials require review even if import completes. Audit hooks complement required
container isolation and do not sandbox arbitrary native extensions.

The root-planned container is network-none/read-only/dropALL/NNP/UID10001 with
128MiB noexec/nosuid/nodev `/tmp`, pids64, memory2GiB, cpus2, no sockets/binds or
credentials, an independent deadline and explicit owned-container removal.
This stage invokes no handler, lifespan, Prisma engine, DB or paid model.

Offline author checks, run with isolated pinned CPython3.11 as stdlib-only checks:

- First16 canonical checks PASS; safe help for both scripts PASS.
- After native-only generation guards, archive-sidecar requirements and clearer
  inventories,17 PASS; safe help PASS. After bounded audit-handler/message
  sanitization, final18 PASS; safe help PASS. Rerun reasons and all captures remain.
- Actual final artifact verify321files/219,286,960bytes PASS in4.203s; both npm
  archives pass the real safe-member validator (86/10). Socket/process effects
  are denied before importing the safe source checker; no action/generator runs.
- Full124-wheel RECORD streaming audit above PASS. Source and interpreter hashes
  stayed stable during each captured check. These are not Linux execution tests.

Two resolution failures remain: redundant incompatible uv flags in attempt1;
NumPy1.26.4 CPython3.13 binary refusal in attempt2. Attempt2's CP1252 console
printing also failed after raw UTF8 receipts were saved. Attempt3 resolved
successfully. uv warned that local3.13 was unavailable for build-dependency
inspection; source builds were disabled and actual target tags/metadata were
checked separately. No Linux interpreter success is inferred from that warning.
The original wrong deployment-plan filename read failure also remains in the
tool transcript; the actual current plan was read before implementation.

## Closed handoff / remaining gates

Use only ignored `linux-community-assembly-1/context-artifacts-2` and
`artifact-context-manifest-2.json`:321 exact files/219,286,960bytes. Original
320-file projection and original pins remain preserved as history. The final
source7 files plus this report are the entire eight-path commit. The finite
FINAL-MANIFEST binds current source, raw Git, helpers, checks, public metadata,
wheel/archive/CAS copies and failures; uv caches are explicitly excluded from
build inputs and evidence payload selection. No such cache is copied into Docker.

Next: distinct source/artifact review, exact-context owner CodeBuild with offline
generation, real network-denied UID10001 app import, then separately allocated
disposable PostgreSQL/community virtual-key issuance/revocation/auth. No auth,
paid provider, task fencing, budget reconciliation, Linux ABI, Fargate deployment
or G1 acceptance transfers from this source candidate. Worker49 scan findings
and five older vendor-open findings remain open; this new proxy image also needs
its own security evidence. No waiver, production admission or cutover.

Primary source references retained/read as DATA: [upstream pinned lock](https://github.com/BerriAI/litellm/blob/fc3920bf403124ad075bc04990f999f7e0612e12/uv.lock),
[package/license boundary](https://github.com/BerriAI/litellm/blob/fc3920bf403124ad075bc04990f999f7e0612e12/pyproject.toml),
[unchanged schema](https://github.com/BerriAI/litellm/blob/fc3920bf403124ad075bc04990f999f7e0612e12/schema.prisma),
[Prisma5.4.2 verified-cache logic](https://github.com/prisma/prisma/blob/5.4.2/packages/fetch-engine/src/download.ts),
[cache/mirror routing](https://github.com/prisma/prisma/blob/5.4.2/packages/fetch-engine/src/utils.ts).
