# Image remediation research — 11 October 2026

Owner: Codex delegated source-only research; integration and acceptance remain with the primary Codex owner.

Pinned base: `a5c41c7afdd9ec235ac3a0184a96e4c457ef2f90`, tree `3181f8e0d75299e39fc45a738baff4c41e01463e`, source-equivalent to backend publication `415a55827b3f6343a0835e1d0e30fa0c69d673e6`.

Exclusive paths: this task, `docs/coordination/reports/CODEX-IMAGE-REMEDIATION-20261011.md`, and `docs/qualification/candidates/image-remediation-20261011/**`. Dockerfile, component pins, historical scan bytes, source contracts and shared build guards are reference-only.

Implementation outline: consume the canonical PR8 47-row UTF-8 scan and actual historical package/filesystem metadata; refresh official Debian/upstream advisory facts; distinguish distribution fixes from upstream leads and unmapped embedded copies. Produce a finite findings matrix and source-only decision packet. Keep research observations, remediation options, and executable build prerequisites separate. Do not create an arbitrary mixed-suite image, remove required functionality, disable controls or assert compatibility without a real build.

Verification: input identities, all 47 finding rows, source/provider reconciliation, researched URL attribution, metadata-only embedded-copy mapping, JSON structure and diff scope. No Docker, package installation, cloud write, provider call, native image execution or CVE proof-of-concept execution is authorized. Research time bound: 20 minutes; no recursive workers.

External actions: read-only official documentation/security tracker retrieval. A supported reproducible patch set is required before source recipe edits; unresolved upstream/vendor facts remain HOLD. No build authorization follows from this research.

Completion: bounded research returned `SOURCE_ONLY_HOLD_NO_VERIFIED_SUPPORTED_PATCH_SET`. The report and candidate evidence preserve all 47 current findings, five older obligations and the missing historical-scan locator; a native 30-file metadata subset supplies exact-copy review leads. Seven source-only verification groups pass, including input hashes, row/count preservation, link resolution, false authorization flags and pristine recipe/pins/locks. No application/native/cloud checks were run. The source-only research task is complete for independent primary review; remediation/build/runtime/G1 remain incomplete.
