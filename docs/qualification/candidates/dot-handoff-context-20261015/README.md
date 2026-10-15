# Committed continuation context — 15 October 2026

This packet preserves previously local-only **nonsensitive** source drafts and findings for the [Dot-to-Fable handoff](../../../coordination/reports/DOT-HANDOFF-TO-FABLE-20261015.md). No product source is changed by these files. The merge checkpoint1003 preserves the artifact and process-fixture commits; the image/root/support proposals here remain unapplied and unadmitted.

| Material | Location | State |
| --- | --- | --- |
| Four-repository visibility/branch/fullSHA/tree readback | [repository-pins.json](repository-pins.json) | Read-only point-in-time GitHub metadata; no deployment claim or private source bodies |
| Full immutable changed-file inventory | [changed-file-inventory.json](changed-file-inventory.json) | PR86-to-Fable700, Dot454, transition353 and both separate source slices |
| Independent353 Linux result relay | [VALIDATION-353-RELAY.json](VALIDATION-353-RELAY.json) | Source-qualified scopes only; raw logs/environment receipt remain with validator |
| Sanitized50-finding disposition | [SCAN-AGGREGATE.md](SCAN-AGGREGATE.md) | Aggregates/public-package comparison only; no raw private rows/AWS receipt |
| Exact Node bundled comparison and complete probe | [NODE-BUNDLED-ZLIB.md](NODE-BUNDLED-ZLIB.md), [readonly-node-probe.mjs](readonly-node-probe.mjs) | Missing upstream reset stores independently confirmed; runtime base HOLD |
| Finite shell/NSS/TLS/locale/license/artifact-placement summary | [SUPPORT-AND-PLACEMENT.md](SUPPORT-AND-PLACEMENT.md), [support-profile/PROFILE.json](support-profile/PROFILE.json) | Unapplied support choices; no policy enablement or proprietary snippets |
| Alternative official immutable NODE-only source patches | [image-base-source-candidates/README.md](image-base-source-candidates/README.md), [metadata](image-base-source-candidates/candidate-source-metadata.json), [validation](image-base-source-candidates/VALIDATION.json), [Bookworm patch](image-base-source-candidates/bookworm-slim-base-argument-only.patch), [Trixie patch](image-base-source-candidates/trixie-slim-base-argument-only.patch) | Alternatives; do not apply both; no build or source producer mutation |
| Minimal final-root source draft | [image-runtime-source-proposal/REVIEW.md](image-runtime-source-proposal/REVIEW.md), [draft manifest](image-runtime-source-proposal/PROPOSAL-MANIFEST.json), [proof impact](image-runtime-source-proposal/PROOF-IMPACT.json), [validation](image-runtime-source-proposal/VALIDATION.json), [combined source patch](image-runtime-source-proposal/runtime-and-base-source.patch), [recipe-only patch](image-runtime-source-proposal/runtime-final-stage.patch), [proposed recipe](image-runtime-source-proposal/Dockerfile.proposed) | Original reviewed bytes preserved; finite policy deliberately HOLD; unapplied |
| Draft helper, policy and pure tests | [materializer](image-runtime-source-proposal/apps/runtime/build/materialize-runtime-root.mjs), [policy](image-runtime-source-proposal/apps/runtime/build/runtime-root-policy.json), [tests](image-runtime-source-proposal/apps/runtime/build/test/materialize-runtime-root.test.mjs) | Source-only; no materialization/native execution/build |
| Final public context byte inventory | [CONTEXT-MANIFEST.json](CONTEXT-MANIFEST.json) | Exact committed payload hashes; excludes itself and the separate audit receipt to avoid circular hashes |
| Public-content/link audit result | [PUBLIC-CONTENT-AUDIT.json](PUBLIC-CONTENT-AUDIT.json) | Bounded checks and manual dispositions; not security/image admission |

The two image directories are **historical byte-preserved draft snapshots** from their original outside-Git preparation. Their original 'outside Git/unpublished' wording describes that preparation time; this handoff now commits the draft bytes as documentation, while leaving them unapplied to the product. Likewise, the preserved artifact/process candidate READMEs describe their original local-only/no-push checkpoints; remote availability of those exact commits follows only the final handoff publication readback. Their original manifests and hashes stay valid through local `.gitattributes` byte preservation. Current status is this packet plus the main handoff: the independent bundled-Node diagnostic is now reported complete and still blocks selection. No old draft request or `buildOrPublicationAuthorized:false` field grants or removes current handoff-publication authority; no build is authorized.

The sanitized support profile rebases its policy reference and replaces raw Node function bytes with the separate comparison summary. All other support choices remain draft. It contains public OCI/OS metadata, not a final image inventory or permission to flip HOLD. The materializer needs a further reviewed finite helper/SONAME/generated-support/ownership profile before any separately approved materialization.

Artifact continuation is already committed in [the artifact candidate](../dot-artifact-lock-20261015/README.md), including its exact21-wheel inventory, review and Linux runbook. The older local-only artifact proposal README is intentionally superseded, not copied. Runtime continuation is in [the process-fixture candidate](../dot-runtime-completion-fixture-20261015/README.md). All referenced nonsensitive source/context is in Git or immutable published references. Do not require access to the original workstation cache to reconstruct it.

Intentionally excluded secure inputs: shipping's raw50-row scan and AWS receipts/private resource inventory; original native binaries/OCI layer caches; proprietary CLI extraction text; credentials; raw validator environment/log receipts containing private paths/identifiers; prior unsanitized local publication ancestry. Obtain those only from their current owners through approved secure access. This exception is deliberate; it does not authorize public disclosure or fabrication.

Checks that may be repeated without native execution from this packet directory:

```sh
node --check image-runtime-source-proposal/apps/runtime/build/materialize-runtime-root.mjs
node --test --test-concurrency=1 image-runtime-source-proposal/apps/runtime/build/test/materialize-runtime-root.test.mjs
node --check readonly-node-probe.mjs
```

Do not run the materializer. `git apply --check --unidiff-zero` for the combined draft against the preserved353 source validates patch shape only and must not be replaced by applying it to the handoff. Source/archive/image binding, source-pin discrepancy, target imports/behavior, full notices/SBOM/security and release/live gates remain open.
