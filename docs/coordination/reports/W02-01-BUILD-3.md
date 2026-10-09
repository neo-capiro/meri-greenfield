# Refreshed worker build, probe-only admission

Reviewed worker797da3a84cdc56f3fd96f0a2fa1f3b1c0d7617c0 integrated in source8785118bff574e2cf3f520a542f6a7b56e075f9e. Codex uploaded its104-entry375544-byte Git archive, SHA256 `8b2f9480f2ec026452466aa570755f2dead79b3d1b2f21b7663087cc37bb1fbc`, to the new versioned/KMS build bucket; exact sourceVersion `5YiVSqMGATX_fenHEwO8qmYFkiY7ygPd`. Fresh exact-account STS preceded upload and StartBuild; checksum/version/metadata readbacks matched. No ignored/private/cache files enter the archive.

CodeBuild `meri-greenfield-qualification-build:55c89c64-547f-41ff-8a8b-3120e25d8b39` SUCCEEDED21:45:18Z–21:48:55Z. Immutable source tag8785118 maps to:

`967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:7327f04575b09a633730b0ffe4b5fdeeeffe151a5c0db6dc027cc6edb8960d75`

Codex recomputed returned ECR manifest SHA256 and matched the digest. Independent review verified the actual304-package inventory, all34direct OS pins, Node24.21.0/Python3.11.2/LibreOffice7.4.7.2, targeted Debian security revisions, exact SDK binary size/hash, computed Chrome/original-helper/alias hashes and final root-owned4755/setuid assertions after all ownership operations. The no-removal inherited upgrade succeeded. Historical archive hash logging is distinguished from freshly computed installed-byte assertions.

ECR basic scan COMPLETE21:49:22Z:2CRITICAL/13HIGH/23MEDIUM/7LOW/3UNDEFINED. All ten targeted prior critical findings disappeared. Remaining criticals are exactly CVE-2026-95210 GnuTLSu7 and CVE-2026-52490 TIFFu4, without snapshot fixes. All remaining findings remain open. libtiff-tools is absent from package inventory; that alone does not prove filesystem/use unreachability. No security clearance or application/G1 admission.

Codex admits this digest ONLY to one bounded closed-network synthetic isolation/kernel/tool probe under unchanged nonroot/read-only/dropALL/required-Chromium-sandbox controls, empty worker role and no provider/source/customer/external-content authority. New Runtime image-only change set is prepared for independent review; no task runs yet. Prior failed build/baselines/reviews remain preserved. Paid inference spend0/$10, no source/cutover. Evidence: ignored private-evidence/W02-build-8785118 and W02-runtime-image-8785118.
