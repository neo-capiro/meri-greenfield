# SDK security admission discovery

Codex preparation, 10 October 2026 UTC. This report proposes a bounded owner decision; it grants no runtime admission, waiver or G1 acceptance.

## Review outline

1. Bind the retained 49-finding scan, worker recipe and roleless SDK definition to exact sources.
2. Inventory every finding and five older vendor-open findings; refresh primary vendor status for relevant severe/common-runtime packages.
3. Separate the SDK numeric-loopback fixture's intentional native/JSON/compression surface from dormant Office/browser utilities without asserting binary absence.
4. Propose the smallest explicit one-run admission or separately built minimal-image path, with SDK and Office activation conditions kept distinct.

The dedicated branch starts at `b8c3405bbe2e7d92a0e4ac27fd4adcc42a3e75e1`. Only this report and ignored local evidence are owned. No cloud mutation, application/model call, container start, dependency installation or candidate execution is authorized.

## Concrete recommendation

**Prepare an explicit owner disposition for ONE existing-image, roleless SDK:2 numeric-loopback capture. A new minimal SDK image is not established as necessary for that tightly controlled experiment. Do not grant Office, browser, real provider, source, upload or general application admission.** This is a conditional proposal, not self-approval. The owner may instead decline the remaining common native risk; in that case prepare a separately versioned SDK-only recipe rather than silently relaxing the present scope.

The original credential-interface source blocker is corrected: the native definition source omits TaskRoleArn and overrides the image's default runtime entrypoint with `['node']` and only `/opt/meri-worker/probes/sdk-capture.mjs`. Thus it does not intentionally invoke the default Office/browser probe collection. Current STATUS reports roleless SDK:2/Office:2 readbacks; this discovery did not independently refresh those cloud readbacks. The accepted canary3 measured controller-exit containment is relevant prerequisite evidence, but its sleep-only role-bearing exception grants no SDK permission and its workload qualification remains FAILED.

All49 current scan findings and five older vendor-open findings stay OPEN. No numerical zero-CVE gate is invented. No currently verified coherent Trixie package update closes them. Same-snapshot rebuilding, changing package names, source scan omission, removing SUID bits, closed egress and read-only root are not remediation or proof of exploit impossibility.

## Exact image and fresh vendor evidence

Retained image `sha256:bf55fdab91136344688e2c804598546e521b24d6cdbf4fde9e6a7131e6c2ec9c`, config `sha256:6f313883ad219ebd5cc3d0dbd1df5cdf80f0f035eab5ab02c3cead4db568f471`, build source `0be04d0799c9c527e300b47c19176cddb0eaa231`. Retained basic ECR scan62123B/SHA256 `4eb6bd90a8bf2fdfd312b2d850ef40348da94f9f0339bed710a007263e84bc42` completed03:57:34Z on10October2026:4CRITICAL/18HIGH/18MEDIUM/7LOW/2UNDEFINED. This report makes no fresh ECR/AWS call. The source-only Dockerfile's older unbuilt metadata is historical; the separate accepted build reconciliation binds this actual image.

Recipe: official Node24.21.0 Trixie-slim index `sha256:173f125896c3b47ddf056734c7ea789d04595a6a08769a8f78e0df642781fb66`, amd64 manifest `sha256:c83040f7e24bacea68e58a0b96a484ba430bf24abb2973eab7ba4701144b7b63`, signed Debian main/security snapshot20261009T000000Z; direct exact pins and inherited no-removal upgrade. SDK0.3.295/CLI2.1.295 Linux binary SHA256 `4503bfe11a6c7fcc1e0b39b5e0d347c04248f750b03b0977b3ad6b531fe6f358`. Browser/Office/package bytes remain in this shared image even when unused by the SDK command.

Fresh read-only primary Debian captures succeeded54/54 with no fetch retry or unavailable page. Each response has its own UTC, raw HTML hash and complete parsed table in ignored inventory.json. They are non-atomic public responses, not an immutable tracker revision or authenticated package index. All selected Trixie provider versions remain vulnerable in those tables. The table's other-suite first-fixed values below are research leads, not available Trixie pins or permission to mix suites. This discovery does not verify signed replacement package/dependency availability.

Fresh curl upstream advisories identify cookie-domain, proxy-Digest state and STARTTLS reuse prerequisites, with8.21.0 and specified maintenance branches fixed. Their upstream severity differs from ECR; do not silently relabel the scanner. [8924](https://curl.se/docs/CVE-2026-8924.html), [8927](https://curl.se/docs/CVE-2026-8927.html), [8286](https://curl.se/docs/CVE-2026-8286.html). Debian still lists the selected8.14.1-2+deb13u5 vulnerable. [Debian curl](https://security-tracker.debian.org/tracker/source-package/curl).

## Source-specific exposure and residuals

“Dormant” below means the fixed SDK fixture does not intentionally invoke that operation, never all-copy absence or a waiver. Source-package scanner attributes are not a complete mapping of system, Node, Bun/SDK, npm, Python or Chromium embedded libraries.

| Package group | SDK-only fixture exposure / residual | Separate Office boundary |
|---|---|---|
| curl / GnuTLS / Kerberos / SASL | Numeric plaintext127.0.0.1 only; no proxy, cookie exchange between origins, TLS peer/certificate, STARTTLS, GSSAPI ticket or DIGEST-MD5 challenge is admitted. These reported prerequisites are absent from the intended fixture. Internal consumers/initialization are not proven absent. GnuTLS describes3.8.13 while flagging3.8.9 and requests upstream validity assessment: retain the conflict. | No network/auth inputs permitted there either; actual unexpected retrieval/auth fails qualification. |
| zlib + GCC14/libstdc++ | **Common native residual.** Capture actually uses Node gunzip/inflate for request decoding; native SDK/Bun may use compression/C++ allocation. zlib85091 describes nonblocking gzwrite/gzprintf, not the reviewed inflate calls; Debian still flags1.3.1 and earlier-range uncertainty remains. GCC95619 concerns large aligned allocations; tiny fixed input/resource caps narrow exposure, not prove safety or all-copy absence. [zlib](https://security-tracker.debian.org/tracker/CVE-2026-85091), [GCC](https://security-tracker.debian.org/tracker/CVE-2026-95619). | ZIP/XML/render/native allocation intentionally exercised. Separate admission required; never transfer an SDK decision. |
| libxml2 / Expat / TIFF / Poppler | No XML/DTD/XPointer/XInclude, supplied TIFF, PDF, password or document accepted; no Python/LibreOffice/Poppler/tiffcrop command in this SDK entry. Native configuration/embedded library use remains incompletely mapped. TIFF52490 names tiffcrop option processing; finding does not establish a libtiff6 decoder defect, nor prove executable absence. [TIFF](https://security-tracker.debian.org/tracker/CVE-2026-52490). | **Actually exercises XML/OOXML, ZIP, fonts and PDF rendering.** Poppler107705 needs encrypted R6/AESV3 PDF/password input absent from the fixed generated fixture, but native memory safety remains unqualified. libxml86139 version-introduction conflict and Expat's two distinct fixes remain unresolved. [Poppler](https://security-tracker.debian.org/tracker/CVE-2026-107705), [libxml2](https://security-tracker.debian.org/tracker/source-package/libxml2), [Expat](https://security-tracker.debian.org/tracker/source-package/expat). |
| CUPS / Avahi / nghttp2 | The SDK command does not start CUPS/Avahi/nghttpx daemons, print/discover services or use HTTP Upgrade proxying. Literal numeric loopback avoids intentional DNS/mDNS. Installed clients/libraries and unexpected initialization are not an absence proof; complete49 rows include these lower severities. [CUPS](https://security-tracker.debian.org/tracker/source-package/cups), [Avahi](https://security-tracker.debian.org/tracker/source-package/avahi), [nghttp2](https://security-tracker.debian.org/tracker/CVE-2026-58055). | Library dependency/initialization possible; daemon operation remains excluded. |
| GnuPG / util-linux | No TPM, key material, gpg-agent socket, mount/fstab/nsenter or privileged operator is admitted. Utility CVEs require specific local privilege/mount preconditions. Source removes other SUID/SGID bits but retains two root4755 Chromium helpers; dropALL is not proof that setuid or all escalation is impossible. No NNP claim is made for Fargate. [GnuPG](https://security-tracker.debian.org/tracker/CVE-2026-24882), [util-linux](https://security-tracker.debian.org/tracker/source-package/util-linux). | Same strict no privileged utility/device authority; Office parser compromise still matters. |

Every minor/undefined row is retained, not waived by severity. ECR basic OS scanning does not comprehensively assess bundled SDK/Bun/Node/Chrome/npm/Python, kernel or configuration. This task did not perform exploit tests, loader tracing or new actual binary inspection.

## Required owner conditions before SDK launch

1. A new consumed-once SDK run disposition binds exact image/config, source closure/probe/options/decoder, roleless revision-qualified SDK:2 definition, exact command and fresh trusted parsed-JSON definition/IAM/network/DNS/cloud authority. No caller overrides, secrets, source volumes, credentials URI, provider endpoint, upload or additional tool. Execution role is image-pull/logging infrastructure authority, not worker credentials. Actual parent preflight must still pass unchanged.
2. Only the existing reviewed fixture: one native spawn, numeric loopback Messages paths, exactly two bounded requests, fixed synthetic prompt/tool/result/SSE, strict provenance-gated echo,256 output tokens/three turns, replacement environment and no memory/hooks/skills/discovery/persist/resume. Native/JSON/compression remain admitted residual surfaces. Request4MiB/decoded8MiB and60s local capture bounds do not fix native overflows or replace managed720s whole-task/180s cleanup enforcement.
3. Explicitly accept or decline the common zlib/GCC/bundled-copy/retained-helper residual for this exact trusted-input run. The 49+five inventory is carried forward unchanged. No blanket risk acceptance, general public-network or document permission follows. Fresh admitted enforcement must bind SDK:2 and its current network/task before launch; prior sleep graph cannot authorize SDK merely by substituting a command.
4. Independently reconstruct actual complete raw requests, tool_use→tool_result→end_turn, callback/handler counts, spawn/stream/exit and bounded evidence. Unexpected extra request/command/input, preflight failure, incomplete evidence, timeout or uncertain launch fails. Confirm actual task/worker STOPPED and cleanup; acknowledgement or SDK success alone is insufficient. Any UNKNOWN blocks the next run. No automatic retry/redrive.

These are concrete activation conditions, not evidence produced here. The current source and accepted canary do not independently prove fresh cloud authority or the SDK's actual native behavior. Role omission does not establish network denial: ECR/image bootstrap, logging endpoints, DNS rules and actual worker application egress must be assessed separately. Required trusted AWS bootstrap transport is not permission for the native SDK to contact external services.

## Minimal image alternative and Office hold

If the owner declines those bounded residuals, allocate a focused **new SDK-only recipe**: same immutable Node base and SDK/CLI bytes plus only the capture/options, their required decoder/protocol imports, npm SDK/zod closure and static integrity evidence. Omit Office/Poppler/Python/Chromium/fonts from the recipe from the start; do not remove shared-image capabilities or splice Sid packages into the existing image. Determine actual runtime ELF dependency closure during that separately admitted build; do not assume Node/Bun self-containment. It needs its own archive/source review, successful bounded build/auth cleanup, complete final filesystem/package inventory, fresh scan, retained proprietary notice, roleless exact definition/compiler binding and actual SDK qualification. It will likely reduce dormant parser packages but no zero-CVE/common-library fix is claimed. No verified coherent package pin can currently be proposed here.

**Office remains DEFERRED** pending its own explicit generated-only parser-risk decision or supported fixes/all-copy applicability evidence. The minimal SDK image cannot qualify Office. The existing pinned Office fixture intentionally generates/reopens DOCX/XLSX/PPTX, recalculates SUM=6, renders four PDF pages/PNGs and exports11 files. File/output caps often apply after native parsing; these are not memory-safety defenses. No uploaded/encrypted/macro/external-link document is admitted. Browser remains separate mandatory-sandbox host qualification. Product/source/release/cutover and all real-provider inference remain outside both proposals.

## Complete49+five inventory

All rows below have selected Trixie versions flagged **vulnerable** in the fresh primary response. `none` means Debian's unstable first-fixed record is `(unfixed)`, not proof no upstream patch exists. `other-suite` versions are not selected/available Trixie repairs. The ignored JSON retains complete raw scanner descriptions, attributes, vendor tables, URLs, timestamps and hashes.

| CVE | Severity | Scanned source / version | Debian unstable first-fixed lead (not adopted) |
|---|---|---|---|
| [CVE-2024-52616](https://security-tracker.debian.org/tracker/CVE-2024-52616) | MEDIUM | `avahi 0.8-16` | 0.8-18 |
| [CVE-2025-68276](https://security-tracker.debian.org/tracker/CVE-2025-68276) | MEDIUM | `avahi 0.8-16` | 0.8-18 |
| [CVE-2025-68468](https://security-tracker.debian.org/tracker/CVE-2025-68468) | MEDIUM | `avahi 0.8-16` | 0.8-18 |
| [CVE-2025-68471](https://security-tracker.debian.org/tracker/CVE-2025-68471) | MEDIUM | `avahi 0.8-16` | 0.8-18 |
| [CVE-2026-24401](https://security-tracker.debian.org/tracker/CVE-2026-24401) | MEDIUM | `avahi 0.8-16` | 0.8-18 |
| [CVE-2026-105326](https://security-tracker.debian.org/tracker/CVE-2026-105326) | LOW | `cups 2.4.10-3+deb13u2` | none |
| [CVE-2026-107655](https://security-tracker.debian.org/tracker/CVE-2026-107655) | MEDIUM | `cups 2.4.10-3+deb13u2` | none |
| [CVE-2026-107885](https://security-tracker.debian.org/tracker/CVE-2026-107885) | LOW | `cups 2.4.10-3+deb13u2` | none |
| [CVE-2026-107886](https://security-tracker.debian.org/tracker/CVE-2026-107886) | LOW | `cups 2.4.10-3+deb13u2` | none |
| [CVE-2026-107888](https://security-tracker.debian.org/tracker/CVE-2026-107888) | MEDIUM | `cups 2.4.10-3+deb13u2` | none |
| [CVE-2026-107890](https://security-tracker.debian.org/tracker/CVE-2026-107890) | LOW | `cups 2.4.10-3+deb13u2` | none |
| [CVE-2026-34979](https://security-tracker.debian.org/tracker/CVE-2026-34979) | MEDIUM | `cups 2.4.10-3+deb13u2` | 2.4.17-1 |
| [CVE-2026-34980](https://security-tracker.debian.org/tracker/CVE-2026-34980) | MEDIUM | `cups 2.4.10-3+deb13u2` | 2.4.17-1 |
| [CVE-2026-39314](https://security-tracker.debian.org/tracker/CVE-2026-39314) | MEDIUM | `cups 2.4.10-3+deb13u2` | 2.4.17-1 |
| [CVE-2026-39316](https://security-tracker.debian.org/tracker/CVE-2026-39316) | MEDIUM | `cups 2.4.10-3+deb13u2` | 2.4.17-1 |
| [CVE-2026-41079](https://security-tracker.debian.org/tracker/CVE-2026-41079) | MEDIUM | `cups 2.4.10-3+deb13u2` | 2.4.17-1 |
| [CVE-2026-87875](https://security-tracker.debian.org/tracker/CVE-2026-87875) | MEDIUM | `cups 2.4.10-3+deb13u2` | none |
| [CVE-2026-87876](https://security-tracker.debian.org/tracker/CVE-2026-87876) | LOW | `cups 2.4.10-3+deb13u2` | none |
| [CVE-2026-8286](https://security-tracker.debian.org/tracker/CVE-2026-8286) | HIGH | `curl 8.14.1-2+deb13u5` | 8.21.0~rc2-1 |
| [CVE-2026-8924](https://security-tracker.debian.org/tracker/CVE-2026-8924) | CRITICAL | `curl 8.14.1-2+deb13u5` | 8.21.0~rc2-1 |
| [CVE-2026-8927](https://security-tracker.debian.org/tracker/CVE-2026-8927) | CRITICAL | `curl 8.14.1-2+deb13u5` | 8.21.0~rc2-1 |
| [CVE-2026-107161](https://security-tracker.debian.org/tracker/CVE-2026-107161) | HIGH | `cyrus-sasl2 2.1.28+dfsg1-9` | none |
| [CVE-2026-77214](https://security-tracker.debian.org/tracker/CVE-2026-77214) | HIGH | `expat 2.8.3-1~deb13u1` | 2.9.0-1 |
| [CVE-2026-93990](https://security-tracker.debian.org/tracker/CVE-2026-93990) | HIGH | `expat 2.8.3-1~deb13u1` | 2.8.4-2 |
| [CVE-2026-24882](https://security-tracker.debian.org/tracker/CVE-2026-24882) | HIGH | `gnupg2 2.4.7-21+deb13u1` | 2.4.9-4 |
| [CVE-2026-57062](https://security-tracker.debian.org/tracker/CVE-2026-57062) | LOW | `gnupg2 2.4.7-21+deb13u1` | 2.4.9-5 |
| [CVE-2026-67693](https://security-tracker.debian.org/tracker/CVE-2026-67693) | HIGH | `gnutls28 3.8.9-3+deb13u4` | none |
| [CVE-2026-88647](https://security-tracker.debian.org/tracker/CVE-2026-88647) | UNDEFINED | `gnutls28 3.8.9-3+deb13u4` | none |
| [CVE-2026-88648](https://security-tracker.debian.org/tracker/CVE-2026-88648) | UNDEFINED | `gnutls28 3.8.9-3+deb13u4` | none |
| [CVE-2026-95184](https://security-tracker.debian.org/tracker/CVE-2026-95184) | HIGH | `gnutls28 3.8.9-3+deb13u4` | none |
| [CVE-2026-95209](https://security-tracker.debian.org/tracker/CVE-2026-95209) | HIGH | `gnutls28 3.8.9-3+deb13u4` | none |
| [CVE-2026-95210](https://security-tracker.debian.org/tracker/CVE-2026-95210) | CRITICAL | `gnutls28 3.8.9-3+deb13u4` | none |
| [CVE-2026-107708](https://security-tracker.debian.org/tracker/CVE-2026-107708) | MEDIUM | `krb5 1.21.3-5+deb13u1` | none |
| [CVE-2026-107778](https://security-tracker.debian.org/tracker/CVE-2026-107778) | HIGH | `krb5 1.21.3-5+deb13u1` | none |
| [CVE-2026-74860](https://security-tracker.debian.org/tracker/CVE-2026-74860) | HIGH | `libxml2 2.12.7+dfsg+really2.9.14-2.1+deb13u3` | 2.15.3+dfsg-1 |
| [CVE-2026-76781](https://security-tracker.debian.org/tracker/CVE-2026-76781) | MEDIUM | `libxml2 2.12.7+dfsg+really2.9.14-2.1+deb13u3` | 2.15.4+dfsg-1 |
| [CVE-2026-86137](https://security-tracker.debian.org/tracker/CVE-2026-86137) | MEDIUM | `libxml2 2.12.7+dfsg+really2.9.14-2.1+deb13u3` | 2.15.4+dfsg-1 |
| [CVE-2026-86138](https://security-tracker.debian.org/tracker/CVE-2026-86138) | HIGH | `libxml2 2.12.7+dfsg+really2.9.14-2.1+deb13u3` | 2.15.4+dfsg-1 |
| [CVE-2026-86139](https://security-tracker.debian.org/tracker/CVE-2026-86139) | HIGH | `libxml2 2.12.7+dfsg+really2.9.14-2.1+deb13u3` | 2.15.4+dfsg-1 |
| [CVE-2026-86140](https://security-tracker.debian.org/tracker/CVE-2026-86140) | HIGH | `libxml2 2.12.7+dfsg+really2.9.14-2.1+deb13u3` | 2.15.4+dfsg-1 |
| [CVE-2026-86141](https://security-tracker.debian.org/tracker/CVE-2026-86141) | LOW | `libxml2 2.12.7+dfsg+really2.9.14-2.1+deb13u3` | 2.15.4+dfsg-1 |
| [CVE-2026-86142](https://security-tracker.debian.org/tracker/CVE-2026-86142) | HIGH | `libxml2 2.12.7+dfsg+really2.9.14-2.1+deb13u3` | 2.15.4+dfsg-1 |
| [CVE-2026-86143](https://security-tracker.debian.org/tracker/CVE-2026-86143) | HIGH | `libxml2 2.12.7+dfsg+really2.9.14-2.1+deb13u3` | 2.15.4+dfsg-1 |
| [CVE-2026-86144](https://security-tracker.debian.org/tracker/CVE-2026-86144) | HIGH | `libxml2 2.12.7+dfsg+really2.9.14-2.1+deb13u3` | 2.15.4+dfsg-1 |
| [CVE-2026-58055](https://security-tracker.debian.org/tracker/CVE-2026-58055) | MEDIUM | `nghttp2 1.64.0-1.1+deb13u1` | 1.70.0-1 |
| [CVE-2026-107705](https://security-tracker.debian.org/tracker/CVE-2026-107705) | HIGH | `poppler 25.03.0-5+deb13u4` | none |
| [CVE-2026-18495](https://security-tracker.debian.org/tracker/CVE-2026-18495) | MEDIUM | `tiff 4.7.0-3+deb13u3` | 4.7.1-1 |
| [CVE-2026-52490](https://security-tracker.debian.org/tracker/CVE-2026-52490) | CRITICAL | `tiff 4.7.0-3+deb13u3` | 4.7.2-1 |
| [CVE-2026-85091](https://security-tracker.debian.org/tracker/CVE-2026-85091) | HIGH | `zlib 1.3.dfsg+really1.3.1-1` | none |

Five older omitted findings remain separately OPEN:

| CVE | Selected provider | Debian unstable first-fixed lead (not adopted) |
|---|---|---|
| [CVE-2026-95619](https://security-tracker.debian.org/tracker/CVE-2026-95619) | `gcc-14 14.2.0-19` | 14.4.0-3 |
| [CVE-2026-78410](https://security-tracker.debian.org/tracker/CVE-2026-78410) | `util-linux 2.41.5-0+deb13u1` | 2.42.3-1 |
| [CVE-2026-78408](https://security-tracker.debian.org/tracker/CVE-2026-78408) | `util-linux 2.41.5-0+deb13u1` | 2.42.4-1 |
| [CVE-2026-76642](https://security-tracker.debian.org/tracker/CVE-2026-76642) | `util-linux 2.41.5-0+deb13u1` | 2.42.3-1 |
| [CVE-2026-78409](https://security-tracker.debian.org/tracker/CVE-2026-78409) | `util-linux 2.41.5-0+deb13u1` | 2.42.3-1 |

GCC provider naming changed from gcc-12 to gcc-14; omission is not remediation. util-linux78409's upstream >=2.42/kernel6.15 description versus Trixie flagged2.41.5 is an unresolved applicability conflict. Earlier TIFF12912, LibreOffice63277 and util-linux53615 fix leads are distinct findings; they do not close52490 or the remaining utility CVEs. No all-copy patched-source adjudication was performed.

## Method, evidence and limits

Read AGENTS, implementation standards, adopted plan G1/release requirements, current STATUS/G1 work, security/build/roleless/canary reports and exact recipe/SDK/definition source as data. Sole tracked output is this report. No tests, candidate/helper imports, native execution, Docker, AWS/API scan, install, model/provider/source calls, Hermes or production change occurred. Public primary advisory metadata was read only. One auxiliary `rg` Windows wildcard lookup failed with invalid-path123; literal source reads supplied the needed facts. Its failure was not a product defect and no runtime check was replayed.

Source/package/image identity is not runtime authority. No current system-library-to-bundled-copy mapping, all-process/runtime loader proof, all-copy absence, exploitability adjudication or physical cleanup was newly established. The owner must choose after fresh exact admission evidence. This report is **CLOSED preparation only; G1 OPEN, Office DEFERRED, all49+five OPEN**.

Ignored evidence: `.task-inputs/security-data/inventory.json` 187487B/SHA256 `2a06ebae4df66d31cbad76e434697ec29c9d9525276e35615334be7cd9838c46`; manifest 13168B/SHA256 `07ac8d1cf444de93408afe2ca84e8c352371bd518944eaa0d497b78bdd6bb6c6` binds all54 raw HTML responses and14 raw-Git-equal source records. These private ignored files must be retained with the review; they are not committed release artifacts.
