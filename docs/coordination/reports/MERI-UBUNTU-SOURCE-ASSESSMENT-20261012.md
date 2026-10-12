# Ubuntu 26.04 source assessment — 12 October 2026

Ubuntu 26.04 is a supported compatibility lead with concrete package mappings, but an immutable worker source candidate is **not yet demonstrable**. **HOLD / NOT_EXECUTABLE**. No recipe, lock, package-selection pin or runtime admission is changed. The 54 original obligations and 35 direct-package functions remain intact; all 54 image dispositions remain OPEN.

Base `1e6d430cf9c239caca4198aea42a762f13021cd5` (PR14); branch `task/meri-ubuntu-source-assessment-20261012`. This bounded task began at 04:14:15 UTC on 12 October 2026. Exclusive paths are this report and [the author packet](../../qualification/candidates/ubuntu-source-assessment-20261012/author/). PR13/14 Debian, license, bundled-library and failure evidence remains unchanged. AGENTS, implementation standards, adopted R2 and COMPONENTS apply. Parent independently reviews this candidate; this is an author assessment.

## What the deeper vendor read establishes

The [official Canonical VEX documentation](https://documentation.ubuntu.com/security/security-updates/vex/) identifies `canonical/ubuntu-security-notices/vex` as an official publication route. The packet freezes commit `6609070af95e04758e8895a14e22e292b8ebc587`, preserves 39 complete CVE JSON bodies with exact Git blob verification, and retains the first read failures: 38 bodies, 15 exact-path 404s, and one empty GCC connector body. A bounded public metadata read recovered the GCC record; its first partial read is preserved too. These are metadata records, not runtime artifacts.

| Exact resolute/source VEX result | Obligations | Consequence |
| --- | ---: | --- |
| `fixed` | 18 | Candidate version evidence, requiring authenticated composition and copy binding |
| `not_affected` | 4 | Scoped vendor rationale; cannot be transferred to old image or bundled copies |
| `under_investigation` | 12 | Remains open; includes known vulnerable/deferred zlib |
| No applicable source statement or unavailable record | 20 | Explicit vendor/source prerequisite; absence does not establish closure |

The [54-row matrix](../../qualification/candidates/ubuntu-source-assessment-20261012/author/obligations-54.json) retains every original ID, cohort, severity, old source version, prior Ubuntu observation, exact new source PURL/statement and next dependency. The original current 47 still comprise 5 critical, 17 high, 17 medium, 7 low and 1 undefined; five older GCC/util-linux and two historical krb5 obligations remain additional rows. Vendor priority is not substituted for scanner severity.

Positive evidence covers curl `8.18.0-1ubuntu2.7`, five CUPS rows at `2.4.16-1ubuntu1.3`, eight libxml2 fixes plus two scoped not-affected rows at `2.15.2+dfsg-0.1ubuntu0.3`, gnupg2 `2.4.8-4ubuntu3.1`, nghttp2 `1.68.0-2ubuntu0.2`, and two Avahi not-affected rows. These are exact package observations, not assertions about the first fixed version.

Three consequential limits are now concrete:

- **zlib85091 remains known vulnerable/deferred.** Its frozen VEX notes say the proposed patch did not fix the reproducer and record no developer fix as of the note's 11 September date. Canonical's documentation maps deferred to `under_investigation`, explaining the retained web/VEX wording without weakening it. The observed zlib version is `1:1.3.dfsg+really1.3.1-1ubuntu3.1`.
- **GCC provider substitution does not close GCC95619.** Resolute `libstdc++6` and `libgcc-s1` come from `gcc-16`, version `16-20260322-1ubuntu1`. The recovered 7,647,008-byte VEX record (Git blob `10de893863b34c6cfb4d497f8d60039420962e18`) has gcc-12/13 not-affected statements but no resolute gcc-16 source statement. Obtain explicit provider-specific applicability.
- **Critical GnuTLS/TIFF obligations remain unresolved.** Frozen GnuTLS CVE paths are absent and supported API reads failed. The [official TIFF52490 API record](https://ubuntu.com/security/cves/CVE-2026-52490.json) returned an active CVE with no package or patch entries, which establishes no Ubuntu disposition. Expat, SASL, TIFF18495, three CUPS and four util-linux rows also remain open. Nothing is waived or removed.

## Concrete package and function assessment

[Package/function evidence](../../qualification/candidates/ubuntu-source-assessment-20261012/author/package-function-assessment.json) maps all 35 original direct functions, with original names/versions and proposed Ubuntu package names, exact observed versions, source, architecture, dependencies, conflicts, pool filenames, payload sizes and SHA-256 values. It also preserves all 21 exact-alpha Playwright Chromium dependency names and the relevant transitive package metadata. These are availability and dependency records; **dependency solving and installed closure are UNRUN**.

| Required behavior | Observed Ubuntu 26 composition | Qualification still required |
| --- | --- | --- |
| Native Office conversion and recalculation | core/writer/calc/impress-nogui `4:26.2.6.3-0ubuntu0.26.04.2`; actual UNO, Draw and common dependencies retained | Approve module delta and demonstrate DOCX/XLSX/PPTX/PDF parity; retain full modules if needed |
| PDF rendering/text | poppler-utils `26.01.0-2ubuntu0.2`; pypdf `6.20.0` retained | Real renderer/text extraction, malformed-input bounds and artifact inspection |
| Python/venv | python3/python3-venv `3.14.3-0ubuntu2`; actual Python 3.14 maintenance package metadata retained | Python 3.14 runtime/API and packaging qualification |
| Fonts | Liberation, DejaVu, Noto, Carlito and Caladea mapped; OpenSymbol/fontconfig dependencies preserved | Glyph/fallback/layout/embedding-license inspection |
| Browser | Existing MCP `0.0.83`, Playwright/core `1.64.0-alpha-1790635538000`, Chromium `1247` unchanged | Exact native/runtime library linkage and non-root browser plus renderer sandbox |
| Model loop | Existing Claude Agent SDK `0.3.295` and native CLI `2.1.295`; Node `24.21.0` unchanged | Native ABI, redistributable-license closure and separately authorized runtime evidence |

The [seven-library Python metadata read](../../qualification/candidates/ubuntu-source-assessment-20261012/author/python-metadata-assessment.json) verifies that the six pure-Python wheel hashes match the current lock. lxml `6.1.3` offers cp314 wheels, including SHA-256 `a7eb78ba28b187e1e9203a55c60fcf70df2d22cb205fe6d51b9383d6097419f0`; no wheel was downloaded. The current cp313 lock is unchanged. Metadata eligibility is not runtime compatibility.

**lxml needs an explicit supported packaging choice.** The preserved prior cp313 wheel contains its own libxml2/libxslt copies; an OS parser update cannot replace them. Either prepare a supported same-version lxml source-build plan against qualified vendor shared libraries, with complete source/build/license evidence, or approve distro `python3-lxml 6.0.2-1ubuntu0.1` and its API/venv impact. The cp314 wheel bytes remain uninspected; no vulnerability inference transfers from cp313. No homegrown patch or source archive was downloaded. The [functional and bundled-library packet](../../qualification/candidates/ubuntu-source-assessment-20261012/author/functional-and-bundled-requirements.json) separately retains Node, CLI, Chromium, LibreOffice and Poppler embedded-copy obligations. Universe availability does not imply an approved Pro subscription or security support entitlement.

## Immutable and authenticated evidence boundary

The prior OCI proposal remains exact: Ubuntu `resolute-20260927`, index `sha256:f144425ff09be612d6d9ad965196e9cdc23dae1f42110a8a11a3e9a8198759f7`, amd64 manifest `sha256:88a381d5b5eeb2b35d3ad70925a362c37ce569daf43ede89ff818ec20e4d3794`. No layers were downloaded. Published Node and browser hashes remain inherited observations, not new artifact verification.

All six complete Main/Universe live indices for resolute, resolute-updates and resolute-security are retained and match the SHA-256/size fields of the corresponding InRelease files. This adds complete base and security metadata to prior updates metadata. It **does not authenticate their signatures or turn live pockets into a dated snapshot**. Base InRelease is dated 23 April; retained updates/security InRelease files are dated 12 October. No valid-until assertion is invented.

[Canonical's primary trust documentation](https://documentation.ubuntu.com/security/software-integrity/image-verification/) identifies archive signing fingerprint `F6ECB3762474EDA9D21B7022871920D1991BC93C`. The ASCII public-key read failed with proxy403 and its supported web fallback was inaccessible; no system key store was modified. Proposed snapshot `20261012T000000Z` still has retained proxy403 failures. No bypass, mirror substitution, unsigned mode, suite mixing or package-payload fetch was attempted.

The [producer-specific prerequisite packet](../../qualification/candidates/ubuntu-source-assessment-20261012/author/source-prerequisites.json) names the required outputs in order: vendor fixes/applicability; GCC16 assessment; archive-key authentication; supported dated-snapshot metadata and availability; coherent dependency solution including base inventory; supported lxml choice; functional/license review; independent immutable-source review. Only then can a concrete recipe candidate be reviewed. A source candidate under HOLD must still have demonstrable immutable pins; this assessment does not substitute null selections for them.

## Checks, failures and remaining authority

Run offline from this worktree:

```sh
python -I -B -S docs/qualification/candidates/ubuntu-source-assessment-20261012/author/verify-packet.py
```

The retained verification output records passed integrity, all-54/cohort/severity retention, exact VEX blob/purl scoping, all-35 function and all-seven Python mappings, metadata/index bindings, and negative controls for wrong release, wrong provider and wrong architecture. Derivation and verification run only local standard-library code; derivation uses `/usr/bin/dpkg --compare-versions` for ordering, never apt/install. The manifest binds the report, scripts, data, public raw failures and inherited source evidence. Exact source is independently reviewable.

Failures stay visible: proxy403/timeout/inaccessible/429 reads; 15 VEX exact-path404s; initial empty/transport-failed GCC connector results and bounded partial-body failure; 38 author serialization LF mismatches corrected only after exact Git-blob proof; and an author-assumed UNO package name corrected to actual `uno-libs-private` after a failed local derivation. These are distinguished from runtime failures. No fresh runtime check is claimed.

Build, package install, image launch/push/scan, customer/provider/model calls, license acceptance, cloud work, sandbox qualification and G1 acceptance are **UNRUN and unauthorized here**. The old held image must never launch. No frontend, recipe, lock, original branch or existing evidence was changed. No owned background processes remain. The next decision is the supported lxml/Ubuntu module proposal plus the concrete security/evidence prerequisites above; no infrastructure or policy approval is requested by this packet.
