# Worker dependency and license evidence — 12 October 2026

Author scope: read-only inspection of existing worker source at
`90b4dc8472da13cdee9f49cdc0b4c8306ecbdc73`, isolated branch
`task/meri-image-license-evidence-20261012`. Only this report and new
`docs/qualification/candidates/image-patch-20261012/licenses/` evidence are
writable. Existing source, package locks, pins and notices stay unchanged.

## Outline and bounds recorded before collection

Compare the canonical worker npm lock, seven-wheel Python lock, component pins,
Dockerfile and component register. Retrieve exact official registry metadata,
verify selected archive integrity, inspect archives as data, and retain complete
public redistribution-permitted notice files with their hashes. Commercial
SDK artifacts receive metadata/hash evidence without assuming license approval
or copying proprietary implementation. No downloaded code is executed.

Bound collection to 260 MiB compressed package downloads in total, 120 MiB per
archive, 10,000 members per archive, 512 MiB declared uncompressed bytes and
4 MiB per notice. Inspect metadata first; skip and report anything exceeding
the bound. Do not download browser/base image layers in this initial pass.
Inspect selected browser archive notice entries by bounded HTTP range only if
supported; this does not verify the complete archive. Exact Node/CPython
upstream notices and relevant ABI documentation may be retrieved separately.
No installation scripts, images, SDK binaries, cloud/provider/customer calls,
paid models, frontend or Hermes jobs are authorized. Dependency package and
official metadata downloads are the only external actions.

Registry labels, verified package notices, assembled binary attribution and
legal/product acceptance are separate claims. A package version label never
closes embedded native-library, browser, OS/font, or SDK commercial-license
review. Local stdlib checks validate evidence framing only; no image/runtime
gate can pass from this task.

## Findings

Collection completed; this report records bounded source evidence and remaining gaps.

### Disposition and exact scope

**SOURCE EVIDENCE ONLY; HOLD for complete distribution/license, security and
runtime acceptance.** No recipe, dependency version, lock, pin, runtime source,
existing notice, architecture or approval was changed. No supported replacement
version set has been established by this evidence task. The forbidden old image remains
`sha256:8d1ec09aa78f47a11019089dacde93289fc66a39f55bd4357e59eeb25d9b52ac` and must never be launched.

The worker lock has 147 package locations; 130 are eligible for Linux/x64/glibc.
Of these, 129 public locations resolve to 126 unique registry archives, with
three repeated locations; the remaining location is the preserved local private
`@capiro/meri-contracts@0.1.0` archive. All 126 public npm archives and all seven
pinned wheels were downloaded from their registry metadata URLs and verified
against lock SRI or component SHA256: **133 archives, 156,633,085 compressed
bytes**. The local private contract archive also matches its recorded SHA256
and SRI; its implementation was not copied into this packet.

The package inspection discovered **153 actual notice files**: **151 full public
copies retained**, plus **two commercial SDK notices retained as hashes only**.
The original lxml inventory also recorded one zero-byte directory named
`licenses/`; that record and placeholder are preserved but explicitly excluded
from every actual notice-file count. Supplemental upstream/inline notices are
additional and are not mixed into the 153 count. Filename discovery is a bounded
inventory, not proof that every embedded code copyright has been identified.

Raw package archives remain in `/tmp/meri-image-license-evidence-20261012/` for
independent read-only replay. This scratch location is not a durable publication;
Git retains exact registry URLs, archive hashes/sizes, metadata and permitted
notice bytes. No private commercial agreement body is retained or published.

### Component gap matrix

| Component | Exact evidence retained | Consequence and remaining work |
| --- | --- | --- |
| Claude Agent SDK `0.3.295` and Linux/x64 platform package | Both 147-byte `LICENSE.md` files match SHA256 `8ce94b9478bb9868f9641f818e06cd722fbe55d4c22e2d2ed11971b20146173a`; metadata and commercial notice hashes only. SDK binary data hash `4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358`, 256,113,848 bytes, agrees with pins. | Integrity is established, permission is not. Applicable commercial agreement, hosted-binary distribution, proxy/auth and billing terms require owner/vendor determination. No SDK or model was run. |
| Playwright/MCP: MCP `0.0.83`, Playwright/core `1.64.0-alpha-1790635538000` | Exact Apache notices retained; metadata confirms the MCP package's declared matching Playwright versions. Core browser manifest and installer source observations retained. | Default `install chromium` includes Chromium and headless shell revision1247/version155.0.8059.12, plus FFmpeg1011. Full installed-asset hashes and third-party notices remain required. Alpha dependency compatibility is not runtime/support acceptance. |
| Chromium, headless shell, FFmpeg | Exact core manifest; installer bytes hash and selected dependency logic; bounded browser range failure retained. | Browser archive range and Chromium upstream LICENSE retrieval were blocked by HTTP proxy403. No full archive downloaded or verified here; no browser/FFmpeg binary attribution closure. Failed retrieval does not prove a missing notice. |
| `@napi-rs/canvas@1.0.10` and Linux native package | Parent MIT notice retained. Linux archive contains only package metadata, README and 34,794,048-byte `skia.linux-x64-gnu.node`, with no packaged notice. Exact parent gitHead and `.gitmodules` retained. | MIT parent label does not establish complete embedded Skia/dependency attribution. Git-tree API retrieval403 left exact Skia submodule revision unresolved. Native ELF observations are not a license audit. |
| `pdfjs-dist@6.4.299` | Eleven exact notices retained: root, cmaps, iccs, Foxit/Liberation fonts, JBIG2/OpenJPEG/PDFJS variants and QCMS variants. | Retain all relevant font/WASM/data notices in the resulting distribution. Root Apache label alone is insufficient; embedded-version security disposition remains separate. |
| `standardwebhooks@1.1.1` | Npm archive has no notice. Exact gitHead `b4d2c14fc5b4ccff3ff271e3b087dff812254c59` source archive and JavaScript package identity verified; `libraries/LICENSE` is MIT, SHA256 `5ec8c7b26b64d881a6706617bed25c049f97f2f35de034c756de8546fd6dbe27`. | Initial root Apache/MIT apparent mismatch is preserved and resolved: JavaScript package lives under the more specific MIT `libraries/LICENSE`. Supplement this MIT notice during distribution; do not relabel the JavaScript package Apache. |
| `isarray@1.0.0` | No LICENSE filename; complete MIT section extracted from the exact README and retained with original member/archive hash. | Notice-source gap resolved by the inline license; packaging still must carry it. |
| `https@1.0.0` | Archive contains only 331-byte package.json, marked ISC. Declared `index.js` is absent; no code, LICENSE, repository or gitHead present. | This is a metadata-only package with an unresolved attribution source, not evidence of an executable payload. Do not invent a copyright holder or infer an upstream notice from the ISC label. |
| Seven Python wheels | Every exact wheel hash, WHEEL/METADATA and packaged notice retained; lxml has two actual notices, not three. | Full embedded native attribution and installed runtime checks remain open. Top-level license labels are not bundled-library closure. |
| Node24.21.0 / CPython3.13.5 | Full exact-tag upstream LICENSE files retained; Node notice includes bundled third-party notices. | Source-tag notices do not prove installed base-layer bytes. Base-image, Debian, font, LibreOffice, Poppler and other installed OS/native notices require the exact resolved/assembled distribution inventory. No layers or debs were downloaded; no apt resolution performed. |

### ABI and dependency compatibility observations

The pinned lxml6.1.3 wheel is exactly
`lxml-6.1.3-cp313-cp313-manylinux_2_26_x86_64.manylinux_2_28_x86_64.whl`,
SHA256 `d85dfab42dd672f87a7f76e9de7172962aee69fa12044f0d6e1a23cbd53fb80e`.
Its WHEEL tags target ordinary CPython3.13, Linux/x86_64 and the stated manylinux
floors. It is not a cp311, free-threaded cp313t or stable-ABI wheel. The other six
wheels are platform-independent; their declared Python requirements admit3.13.
The SDK declares Node>=18; this admits the pinned Node24 at metadata level only.

Seven lxml ELF members and the canvas ELF member were inspected with the local
`readelf -d -V` parser as data, with bounded subprocesses. No native member was
loaded or executed. The lxml etree/objectify modules have DT_NEEDED entries only
for libc/libm/libpthread/librt, with no dynamic libxml/libxslt dependency; the
highest observed GLIBC symbol requirement is2.25. Bundled headers declare
libxml2 `2.14.6`, libxslt `1.1.43` and libexslt `0.8.24`. These are **header
observations**, supporting an inference of embedded parser code, not independent
proof of exact running binary versions. An OS parser-package patch cannot be
assumed to replace the parser bytes in this wheel. Installed lxml compile/runtime
version and functional checks remain necessary on an authorized new candidate.

Exact CPython v3.13.5 ABI documentation retained in this packet describes patch
release compatibility within a minor series. Keeping the ordinary CPython3.13
ABI can therefore be coherent with a later patched3.13 interpreter, subject to
actual dependency resolution/build and runtime tests. This observation does not
select a patched version or approve a CPython series change. Private APIs,
free-threaded builds, different native ABIs and image dependency changes need
separate checks. The recipe and selected versions remain unchanged.

### Minimum next source/packaging work

1. Preserve exact lock/pin identities while preparing a separate reviewed
   attribution bundle covering the retained notices, supplemental Standard
   Webhooks MIT/inline isarray notices, all PDFJS notices and installed assets.
   Do not treat this evidence directory itself as an already integrated product
   notice bundle.
2. Resolve exact SDK commercial agreement/application to this hosted integration
   and complete binary third-party inventory. The official
   [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
   points to commercial terms and separate dependency licenses. The
   [legal and compliance page](https://code.claude.com/docs/en/legal-and-compliance)
   contains hosted Claude Code binary/authentication conditions; its applicability
   to this SDK integration requires an agreement determination, not a silent
   architecture/auth change. [Commercial terms](https://www.anthropic.com/legal/commercial-terms)
   are not assumed accepted because an artifact hash matches.
3. Identify native canvas/Skia build inputs and notices; obtain and verify exact
   browser/headless-shell/FFmpeg notices/configuration; inventory exact installed
   OS/font/office/rendering packages and copyright files after authorized
   resolution/build. Retain all failure evidence until those gaps are closed.
4. Select a coherent patched image/dependency set only with the separate CVE,
   supported-version and exact artifact evidence. Preserve ordinary cp313 wheel
   compatibility where applicable, and address bundled wheel/native code
   independently of apt changes. This task proposes no unverified version bump.

These are evidence prerequisites, not infrastructure or security approvals.
No complete attribution, legal opinion, security fix, redistribution approval,
SDK support guarantee or G1 runtime pass is claimed.

### Checks, failures, preservation and cleanup

`python3 docs/qualification/candidates/image-patch-20261012/licenses/verify-evidence.py`
passed (exit0). It rechecks all133 archive digests/SRI,133 registry metadata
receipts, retained package/upstream notices, wheel metadata, direct license pins,
all seven wheel pins, the private local archive, exact Standard Webhooks scope,
and unchanged existing source. Exact command, exit and source bindings are in
`checks-and-source-binding.json`; raw stdout/stderr are retained. Collection
scripts completed exit0; eight bounded local readelf observations returned0.
Network failures are preserved separately rather than converted into passes.

The initial browser range wrapper reported `BadZipFile` with zero bytes read;
a narrower explicit range retry exposes the underlying proxy403. The canvas
Git-tree API, Chromium notice, lxml website and two commercial-page urllib
retrievals also returned403. Public web retrieval separately allowed reading the
SDK/Python/lxml official pages; those observations are summarized with URLs and
are not claimed as raw downloaded license copies. No private agreement body was
retrieved. These failures leave only their affected closure work blocked.

Original source/locks/pins and earlier evidence remain untouched. No dependency
installation, lifecycle scripts, model/provider calls, image build/push, deploy,
cloud mutation, paid execution, browser/renderer launch, customer-data access or
frontend change occurred. Runtime/security/license integration tests and actual
G1 gates are **unrun**. The evidence-only change does not justify rerunning product
tests or claiming their result. Owned collectors and all bounded readelf children
have exited; `owned-process-cleanup.json` records the narrow process check. Other
owners' processes were not stopped.

`evidence-manifest.json` binds all retained packet files and this report by
SHA256. Raw metadata, notice texts and command outputs are marked binary in the
packet-local Git attributes solely to preserve exact upstream/output bytes; this
does not change their file content or license status.
