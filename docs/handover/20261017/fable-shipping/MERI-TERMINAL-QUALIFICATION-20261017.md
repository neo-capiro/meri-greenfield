# Current Meri image qualification: HOLD

This is the current operation checkpoint after Neo resumed Meri ownership. Codex/dot owns shipping coordination. Earlier local-seal/no-upload/no-StartBuild records are dated history.

## Exact consumed operation

- Source `38f52df94b1738649776792b2a28aac743801c19`, tree `7980fe7530d6623a2de9a788e150a377aca8201b`, draft PR101.
- One attempt `f238e6f45da84885bd2e3c0b6a0fa92f`; build `meri-greenfield-qualification-build:5b67476a-5b30-43a7-9957-d83c72525aa2` started 01:41:36.557 UTC and ended **FAILED/COMPLETED at 01:44:10.906 UTC**, 17 October 2026. One StartBuild, automatic retries 0, timeout/queue 30/5 minutes.
- Immutable input ZIP VersionId `ZoCyjIswQjO0iWjwM8Hm3E6uo6Fzrws1`; manifest VersionId `Jn0nOAeAbGkgnMMWGpERe5r7OLk15y8Q`. Exact sizes/hashes remain in the [machine-readable checkpoint](MERI-CURRENT-QUALIFICATION.json) and prior source record.
- Exact pushed image digest `sha256:e318ab002a9f1dfb86245c352d2f521f09c66086f31d9ffd92f08cbf39f0b236`, repository `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker`; immutable tag `product-38f52df94b1738649776792b2a28aac743801c19-f238e6f45da84885bd2e3c0b6a0fa92f`.

## Two distinct failures

1. **Scan-read timing:** CloudTrail identifies the builder's exact `DescribeImageScanFindings` read at 01:44:09 UTC as `ScanNotFoundException`. The producer's immediate nonzero command failure ended the build before its pending-scan loop could wait. This was not an IAM denial. A source correction is being prepared to tolerate only this exact pending condition within the existing bounded poll/deadline. Unrelated errors and denied access must still fail immediately.
2. **Actual image findings:** a separate read-only exact-digest read found scan **COMPLETE at 01:44:31 UTC**, with **HIGH 3, MEDIUM 9, LOW 3**. Consequently fixing scan timing alone cannot qualify this image. The zero-HIGH/zero-CRITICAL gate remains unchanged. No success receipt exists, and independent terminal review is **HOLD**.

| HIGH finding | Package in scanned image | Primary current reference |
| --- | --- | --- |
| CVE-2026-85091 | zlib `1.3.dfsg+really1.3.1-1` | [Debian tracker](https://security-tracker.debian.org/tracker/CVE-2026-85091) |
| CVE-2026-19499 | glibc `2.41-12+deb13u4` | [Debian tracker](https://security-tracker.debian.org/tracker/CVE-2026-19499) |
| CVE-2026-5435 | glibc `2.41-12+deb13u4` | [Debian tracker](https://security-tracker.debian.org/tracker/CVE-2026-5435) |

These references and scan results are a dated snapshot, not a waiver or claim of exploitable application behavior. At review, the stable Debian package rows were still marked vulnerable. A base remediation must preserve the runtime's native glibc/SWC/Temporal requirements; a blind Alpine swap is not a compatible source fix.

## Preserved gates and evidence

The pinned producer reached ECR_SCAN only after its source/image/runner/nonroot checks, mandatory 24-case B6/R6/W12 Linux gate, registry authentication, push and exact-tag readback. No Linux failure ID was reported by this attempt. There is no separately retained success Linux report or product-image success receipt; do not turn this observation into complete image acceptance.

Cleanup status is **OK**. The one encrypted failure artifact has VersionId `ExfjxJQcgwvC4FBYNd9Hw4ycuCH39iLQ`, **406 bytes**, SHA-256 `9af48e591eadb2f12c65ac1e8c07ceab37f2f9e9abcf016eb3e287637cf94c0c`; exact HEAD/GET version, bytes, checksum and approved KMS key matched. Its key and independent review hash are in the machine-readable checkpoint. Private logs, CloudTrail events, raw scan descriptions and credentials are excluded from this Git handoff.

## Next source and allocation boundary

The consumed $4 allocation was already included in central reservations **$335/$400**. Actual billed charges are unknown. **No further build is allocated, active or authorized by this record.** Preserve this tag and all failure evidence; do not overwrite or relabel it.

Prepare and independently review the exact scan-pending correction, a truthful base remediation proposal and focused changed-behavior checks before requesting another qualification allocation. The frontend's consumer 0.1.8 and Meri producer package 0.1.7 are distinct valid facts; see [contract compatibility](MERI-CONTRACT-COMPATIBILITY.md). No package label change or frontend rebuild is required solely for equality. Exact image/native authenticated allocate-admit/recovery and live chat remain separate unpassed gates.
