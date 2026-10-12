# Alternative Linux worker compositions — 12 October 2026

**Recommend Ubuntu 26.04 LTS amd64 for the next source composition proposal.** It has an official immutable base, supports the exact retained Playwright alpha and offers released curl/libxml2 fixes with a consistent native Office/PDF stack. Ubuntu 24.04 LTS is a concrete fallback. Neither is a demonstrated fully patched worker: all 54 inherited security obligations remain open pending exact installed and bundled-copy adjudication. **Source proposal only; NOT_EXECUTABLE; security admission HOLD.**

Base: `690bac4cd44112b161d8e02818aeae7639ce237a` (preserved PR13). Branch: `task/meri-linux-alternatives-20261012`. Only this report and `docs/qualification/candidates/linux-alternatives-20261012/upstream/` changed. AGENTS.md, implementation standards, adopted R2 and COMPONENTS.md were reviewed; `base-bindings.json` records exact local hashes. No recipe, pin, lock, frontend or runtime change was made.

## Decision-ready choices

| Choice | Concrete composition | Benefit and cost |
|---|---|---|
| **A — proposed first: Ubuntu 26.04 resolute** | Official amd64 Ubuntu base; official Node **24.21.0**; retained Claude SDK **0.3.295** / native CLI **2.1.295**; MCP **0.0.83** / Playwright **1.64.0-alpha-1790635538000** / Chromium **1247, 155.0.8059.12**; distro LibreOffice Writer/Calc/Impress, Poppler and Python 3.14; all existing font families | Maintained supported platform, released security fixes, newer Office/PDF stack and Main maintenance through May 2031. Changes Python/native ABI and rendering baseline. Universe support is a separate question. |
| **B — fallback: Ubuntu 24.04 noble** | Same Node/SDK/MCP/browser identities; LibreOffice 24.2.7, Poppler 24.02, Python 3.12 and required fonts | Main maintenance through May 2029. Native Office/PDF versions are older than the current LibreOffice 25.2 baseline. Avahi CVE-2024-52616 remains vendor-vulnerable, unlike Ubuntu 26.04. |
| **C — retain Debian 13 trixie** | Keep reviewed source, tests, Python 3.13 and packaging unchanged while obtaining maintained vendor fixes/adjudications | No platform migration, but no complete Trixie patch set is established. Debian 13.7 is current stable; Forky/14 is testing with no release date. No held image launch. |

A and B are concrete compatible **source candidates**, requiring an owner platform choice, authenticated package closure, behavior qualification and unresolved security fixes. Neither is ready for an execution command. Sources: [Playwright installation](https://playwright.dev/docs/intro), [Ubuntu lifecycle](https://ubuntu.com/about/release-cycle), [Debian releases](https://www.debian.org/releases/).

No evidenced fourth option closes the full set. Alpine/musl is outside documented Playwright image support. Amazon Linux/RHEL/Fedora would require a new browser support and complete Office/PDF qualification; a single vendor's CVE disposition cannot transfer to another vendor or bundled copy. Debian testing/sid packages cannot be mixed into Trixie as a supported stable composition. No maintained security backport for the remaining rows was established, and no homegrown patch is proposed.

## Immutable identities obtained

| Artifact | Identity | Limit |
|---|---|---|
| `ubuntu:resolute-20260927` | Index `sha256:f144425ff09be612d6d9ad965196e9cdc23dae1f42110a8a11a3e9a8198759f7`; amd64 manifest `sha256:88a381d5b5eeb2b35d3ad70925a362c37ce569daf43ede89ff818ec20e4d3794` | Public registry metadata bytes retained and hash checked; zero layers downloaded. |
| `ubuntu:noble-20260917` | Index `sha256:534baea6a22c03a63003dbc8dbe78fe34bc0d7e595d9a9dc9834884ff530eb55`; amd64 `sha256:f610ab94648195aa356059f5b41d6085c9d4d903c072430cdd1af7bdb646106b` | Same boundary; no image scan. |
| Official Node `node-v24.21.0-linux-x64.tar.xz` | Published SHA256 `fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6` | SHASUMS256 metadata downloaded; archive not downloaded; release signature unverified. |
| lxml 6.1.3 Python 3.14 wheel | `cp314-cp314-manylinux_2_26_x86_64.manylinux_2_28_x86_64`; SHA256 `a7eb78ba28b187e1e9203a55c60fcf70df2d22cb205fe6d51b9383d6097419f0`, 5,245,991 bytes | PyPI identity only; bundled parser security open. |
| lxml 6.1.3 Python 3.12 wheel | Corresponding cp312 wheel; SHA256 `909f4e927bb051f7740d6367285fc60cdcfdaf0258c2dba4ff5ba7eadadc250c`, 5,244,675 bytes | Same boundary; current cp313 bytes cannot be reused on another Python ABI. |

The [official Ubuntu source record](https://github.com/docker-library/official-images/blob/master/library/ubuntu), retained as `official-ubuntu-library.txt` (Git blob `ce38f84575e08dbd70db4778db526df67856d405`), binds resolute amd64 to source commit `97b63f1d28d5d0c4a7374bfa87241a49f984ed04` and noble to `ab7012ab5b3136a47103c5453cb27d07445ac13d`. Registry metadata corroborates them. These are Git revisions, distinct from OCI digests. `oci-metadata-results.json` and `oci-platform-results.json` retain raw-body bindings. [Node checksums](https://nodejs.org/dist/v24.21.0/SHASUMS256.txt) and [PyPI metadata](https://pypi.org/pypi/lxml/6.1.3/json) also have retained transport hashes.

**Whole package-set immutable pins remain incomplete.** Ubuntu documents snapshots for 24.04 and later. Proposed timestamp: `20261012T000000Z`; only the chosen codename's base, updates and security pockets; archive signature verification retained. All six snapshot InRelease requests returned proxy403 with zero bytes. Live archive InRelease and four bounded updates Packages.xz reads succeeded; SHA256 and sizes agree, but the signing-key trust chain is **not authenticated**. These prove availability/dependency leads, not signed snapshot acceptance. See [Ubuntu snapshot documentation](https://ubuntu.com/server/docs/how-to/software/snapshot-service/), `snapshot-fetch-results.json`, `current-pocket-results.json` and `package-index-results.json`.

## Required functions and dependency necessity

`composition-proposals.json` maps **all 35 current direct OS packages** for each choice; unresolved immutable version fields are deliberate. It is not an executable build lock.

| Behavior | Concrete retained implementation | Remaining evidence |
|---|---|---|
| SDK model loop, orchestration and governed proxies | Keep all source contracts and SDK/native CLI. Exact Node24 BUILDING source documents Linux x64 glibc >=2.28 / kernel >=4.18. | Actual target ABI/kernel, executable SDK admission and commercial/auth/billing gates. No model call. |
| Chromium automation | Keep exact MCP/Playwright/Chromium. Retained alpha archive SHA256 `54ad1d38174d6ef56d1f165e52547ece8e6c24b865f2a072d9ebaacfbad1ca47` explicitly recognizes Ubuntu24/26 as officially supported. Exact gitHead `e8149b8257d32dcf8f72573ecc43e72439da7080` nativeDeps/hostPlatform sources retained; all 21 Chromium dependencies remain. | Asset/bundled-library integrity, actual non-root native sandbox, egress/watchdog/teardown. Platform recognition is not execution proof. |
| DOCX/PPTX conversion and XLSX recalc | Native LibreOffice core/writer/calc/impress-nogui plus required draw/base/common/UNO dependencies: coherent **4:26.2.6.3-0ubuntu0.26.04.2** on resolute, **4:24.2.7-0ubuntu0.24.04.7** on noble in captured updates metadata. Full GUI modules remain a fallback if headless variants fail required artifacts. | Same-snapshot solver; all import/export filters, formulas/recalc, document edge cases and rendering parity. No function may be removed to shrink the image. |
| PDF inspection/rasterization | Retain native `poppler-utils`/`pdftoppm`: **26.01.0-2ubuntu0.2** resolute / **24.02.0-1ubuntu9.10** noble. | Poppler107705, native dependencies and hostile-artifact/runtime checks. Python PDF parsing does not replace rasterization. |
| Python document libraries | Retain python-docx, XlsxWriter, openpyxl, pypdf, et_xmlfile, typing_extensions and their required behavior; select ABI-specific packaging only after the composition decision. | Compiled-extension ABI, parser provenance, isolated venv and artifact parity. |
| Fonts | Keep Liberation, DejaVu, Noto, Carlito and Caladea; required OpenSymbol/fontconfig/transitives retained. | Exact package/notices, alpha tool/font requirements and layout/glyph qualification. |

**Headless Office does not eliminate the principal vulnerable dependency families.** Ubuntu26 `libcups2t64=2.4.16-1ubuntu1.3` explicitly depends on GnuTLS, Avahi client/common libraries, krb5 GSSAPI and zlib. Exact pinned Playwright requires libcups2t64. Core-nogui still depends on libcurl, Expat, LDAP, TIFF, libxml2/libxslt, Poppler and zlib. Client libraries, daemons and vulnerable functions need actual installed-file/vendor applicability evidence; an unused daemon is not a library waiver. Util-linux/UUID/mount and C++ runtime obligations likewise require exact providers before any removal claim.

Initial web pages disagreed on resolute core26.2.4.2 versus impress26.2.6.3. Captured live package indices now establish matching26.2.6.3 module **availability**. Signed snapshot consistency and dependency solving remain unrun. `selected-package-metadata.json` retains extracted versions, dependencies, package filenames and payload hashes. No `.deb` was downloaded or installed.

## All 54 security obligations retained

`alternative-obligations.json` derives every ID, cohort and original severity from PR13's matrix, SHA256 `4235a8074c314e497071afc8858eeaf26d7adf43d6afd89ba8f3fd322a1e7ad5`. It retains **47 current + 5 older GCC/util-linux + 2 historical omitted krb5** rows. Current47 remain **5 critical / 17 high / 17 medium / 7 low / 1 undefined**. Vendor priority does not replace scanner severity; absence/n/a never closes a row.

| Vendor observation | Ubuntu26 | Ubuntu24 |
|---|---:|---:|
| Released fixed-version leads | 14 | 16 |
| Scoped vendor not-affected leads | 3 | 3 |
| Needs evaluation | 9 | 9 |
| Vulnerable | 1 | 2 |
| No resolved vendor status/usable read | 26 | 23 |
| Actual GCC runtime provider unresolved | 1 | 1 |
| **Inherited obligations closed** | **0** | **0** |

[USN-8487-1](https://ubuntu.com/security/notices/USN-8487-1) supplies released fixes for all three retained curl CVEs8927/8924/8286: **8.18.0-1ubuntu2.2** / **8.5.0-2ubuntu10.10**. Live updates offer later same-suite builds8.18.0-1ubuntu2.7 /8.5.0-2ubuntu10.15. [USN-8910-1](https://ubuntu.com/security/notices/USN-8910-1) and scoped CVE pages supply libxml2 **2.15.2+dfsg-0.1ubuntu0.3** / **2.9.14+dfsg-1.3ubuntu3.10**, both present in the indices. These are positive vendor leads, not retroactive changes to the held image or acceptance of every bundled copy.

Specific blockers remain: [zlib85091](https://ubuntu.com/security/CVE-2026-85091) is vulnerable/fix-deferred on both choices; [Expat93990](https://ubuntu.com/security/CVE-2026-93990), [Expat77214](https://ubuntu.com/security/CVE-2026-77214), [SASL107161](https://ubuntu.com/security/CVE-2026-107161), TIFF18495 and several CUPS/util-linux rows need vendor evaluation. Usable Ubuntu status for critical GnuTLS88647/95210, critical TIFF52490 and both krb5 rows was not obtained; prior upstream holds persist. Published version metadata alone is not a fix. gcc-12/13 results cannot adjudicate the actual gcc-14/15/16 runtime provider. All54 pages were attempted: `ubuntu-cve-read-results.json` retains84 receipts and original failed-read messages; `notice-supplement.json` adds the released libxml2 notice.

## Bundled copies, ABI, licenses and support

An apt update does not replace embedded Node OpenSSL/zlib/nghttp2, SDK CLI/Bun, Chromium/BoringSSL/codecs, native canvas/Skia or PyPI parser bytes. PR13's independent review found lxml6.1.3 cp313-wheel headers for libxml2 **2.14.6**, libxslt **1.1.43**, libexslt **0.8.24** and static-link evidence. That does not prove cp312/cp314 runtime versions; each new wheel needs separate inspection. Every copy requires its own provenance, applicability, notices and eventual runtime version evidence.

Two concrete lxml sub-options remain: retain6.1.3 API and evaluate an [upstream-supported source build](https://lxml.de/installation.html) linked to vendor-patched shared parsers, with pinned build inputs and no homegrown security patch; or explicitly choose distro `python3-lxml` **6.0.2-1ubuntu0.1** on resolute (**5.2.1-1ubuntu0.2** noble), which depends on distribution libxml2/libxslt, then qualify API and venv isolation changes. Neither is built, selected or accepted. Documented source-build support does not prove exact native compatibility or fix unresolved CVEs.

Ubuntu Main maintenance does not automatically cover **Universe** headless LibreOffice packages. Expanded commercial coverage, if required, needs a support/cost decision; no Pro entitlement or spend is assumed. New OS/Office/PDF/font inventories require exact attribution/redistribution review. SDK commercial terms and canvas/browser attribution gaps remain as recorded in PR13; no private agreement body was fetched or published. Top-level license labels do not close embedded-code notices.

Microsoft's [Playwright image documentation](https://playwright.dev/docs/docker) limits its intended use and warns about untrusted sites. Its retained source is platform evidence only: this proposal does not adopt root/sandbox-off defaults, NodeSource setup scripts, world-writable browser permissions, host IPC or added SYS_ADMIN. Meri still requires non-root browser **and renderer** sandbox, task auth/expiry/revocation, durable budgets/checkpoints/fences, egress/watchdog/teardown and artifact inspection.

## Next actions and exact boundary

1. Owner chooses **Ubuntu26 source preparation** or **retain Trixie pending maintained fixes**. Ubuntu24 stays a fallback with older rendering software and another observed Avahi vulnerability. AGENTS.md requires approval for departures from the deployment plan; this research does not enact one.
2. Obtain an authenticated keyring/snapshot through a supported read-only route; solve the chosen codename's complete base/updates/security closure and bind every base/runtime/package hash. Resolve all54 installed and bundled-copy obligations. Partial curl/libxml fixes do not permit launch.
3. Review the lxml/venv choice, full native attribution and all required artifact behavior. Prepare a recipe proposal only when concrete evidence permits; do not invent maintained backports for unresolved rows.
4. After separate execution authorization, shipping would build a reviewed context, capture actual installed inventory/fresh scan and qualify sandbox/artifacts/native taskA/B recovery. All are **UNRUN here**. The old47-finding image remains prohibited.

Local packet validation: `python3 -I -B -S docs/qualification/candidates/linux-alternatives-20261012/upstream/verify-packet.py`. Its retained receipt checks source bindings, all54 IDs/severities, unchanged recipe/locks, OCI/package/transport hashes, negative reads, direct-package scope and non-execution controls. It is not signature authentication or runtime evidence.

No image build/launch/push, layer/runtime-binary/package-payload download, cloud/AWS/provider/model/customer action, credential provisioning, security/network/database change or spend occurred. Anonymous public registry metadata used a transient pull-only token, neither persisted nor printed. No owned background process/session was created. Source connectivity stays disabled; adopted existing Aurora remains unchanged. Private operations-policy access, infrastructure approvals and unknown paid allowance remainder remain separate gates.
