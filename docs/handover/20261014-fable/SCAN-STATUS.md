# Scan status and remedies investigated

## Evidence references and admission

Shipping's established read-only observer reports that all 99 live ECR finding names/severities/attributes match the checksum-verified sealed receipt, with pagination complete. This executor did not retrieve that private ZIP; its exact-version GetObject attempt stopped with CredentialsProviderError and no access changes. No additional AWS discovery is requested.

Source: PR86 `c6053e24b465be677cc5980533009b4aab03beab`.
Shipping reports the image was built and passed native/source/Temporal gates, but remains scan-blocked by 2 Critical and 48 High findings. There is no product Meri deployment.

The established observer matched the complete live finding set against a checksum-verified private sealed receipt. Raw scan files, object/version identifiers, detailed resource inventory and receipt bodies remain with the sole shipping owner. They are intentionally absent from this public repository. Obtain them only through an approved private handoff. No further AWS action or access reconstruction is authorized here.

Existing dedicated qualification resources are **historical inventory only**, not newly refreshed or product-ready. Product PostgreSQL, Temporal, current authority/independent registration, provider proxy, routing, checkpoint grants and browser/renderer hosting remain unbound. Shipping performs any separately approved current readback/build/deployment; Fable implements source and dot validates.

Basic ECR scanning does not supply fixed Debian package versions. Use Debian source-package/version data, exact image SBOM and supported suite backport evidence, not a floor guessed from upstream prose. [AWS distinguishes basic OS scanning from enhanced OS/language scanning](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning.html).

## Public vendor facts checked before the safe stop

These are primary-source observations from 14 October, not package changes, complete scan remediation, or freshly qualified image results. Refresh vendor status before proposing a fix.

| Public advisory | Debian observation | Consequence for investigation |
| --- | --- | --- |
| [Python CVE-2026-19445](https://security-tracker.debian.org/tracker/CVE-2026-19445) | Bookworm security lists `python3.11 3.11.2-6+deb12u9` fixed; Bookworm `...u8` vulnerable. | A real Debian backport exists for this CVE; it does not establish all Python CVEs or a fixed image. |
| [TIFF CVE-2026-52490](https://security-tracker.debian.org/tracker/CVE-2026-52490) | Bookworm/security `4.5.0-6+deb12u4` vulnerable; fixed `4.7.2-1` is unstable, not a Bookworm floor. | Do not claim an ordinary Bookworm update resolves this Critical. No removal, unsupported suite mixing or backport was selected. |
| [util-linux CVE-2026-53615](https://security-tracker.debian.org/tracker/CVE-2026-53615) | Bookworm `2.38.1-5+deb12u3` vulnerable; Trixie `2.41.5-0+deb13u1` fixed for this CVE. | Trixie fixes this row only; other util-linux Highs remain unresolved there. |
| [util-linux CVE-2026-76642](https://security-tracker.debian.org/tracker/CVE-2026-76642) | Bookworm/Trixie vulnerable; unstable floor `2.42.3-1`. | No confirmed Bookworm floor. |
| [util-linux CVE-2026-78408](https://security-tracker.debian.org/tracker/CVE-2026-78408) | Bookworm/Trixie vulnerable; unstable floor `2.42.4-1`. | No confirmed Bookworm floor. |
| [util-linux CVE-2026-78409](https://security-tracker.debian.org/tracker/CVE-2026-78409), [CVE-2026-78410](https://security-tracker.debian.org/tracker/CVE-2026-78410) | Bookworm/Trixie vulnerable; unstable floor `2.42.3-1`. | No confirmed Bookworm floor. |
| [zlib CVE-2026-85091](https://security-tracker.debian.org/tracker/CVE-2026-85091) | Debian lists Bookworm/Trixie/unstable vulnerable and no fixed package. Description discusses a narrower upstream range. | The range discussion is not a Debian backport or scanner waiver; zero High gate remains. |

Cyrus-SASL's CVE page retrieval timed out; no vendor fix floor was established. Broader HEIF/OpenEXR/MariaDB/RSVG/TIFF-High advisory investigation was stopped on Neo's handoff instruction. The independent audit did not create an advisory document or establish additional fixes. Bookworm-backports or alternate base digests were not verified or selected. No new lookup or remediation should be inferred from these notes.

## What remains for Fable and dot

Obtain the full private finding table from shipping, map each source package to actual binary packages and runtime/Office/native dependencies, and verify each applicable Debian-supported fix. The blockers are OS findings, not evidence that npm SDK/Temporal dependencies should be upgraded. Do not remove runtime-used dependencies merely because they are labelled dev.

Choose a minimal supported candidate after dependency tracing. A compatible reviewed base-argument change can preserve all 45 source bytes; any Dockerfile change must preserve the original 45-row evidence and rebind the complete candidate manifest. Native SDK/CLI/Temporal/SWC pins, full planned capabilities, non-root/read-only/noexec restrictions and the zero High/zero Critical gate stay intact. No candidate was implemented at this checkpoint.

Return a reviewed source candidate to dot. The sole existing AWS shipping owner controls any separately approved fresh build/native/source/Temporal/scan action. A proposed package/base change is not a passing scan or release. No paid build, new access, production migration, deployment or legacy deletion is authorized by this document.
