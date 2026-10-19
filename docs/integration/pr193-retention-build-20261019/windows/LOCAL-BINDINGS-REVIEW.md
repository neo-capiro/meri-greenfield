# Local bindings review and bounded correction

## Outline before correction

Root prepares the local-only binding wrapper after Neo's upload. The wrapper composes existing ACL/hash/process helpers and the exact canonical source `stage3-deploy.mjs bindings`, followed by the unchanged C update-compatibility helper. Upload continues to own metadata preservation and idempotent remote writes; Bind accepts its final receipt and writes three local templates and a metadata receipt. Root independently reviews returned public metadata. No runtime source, dependency locks, AWS state, credentials or deployment configuration is edited here.

Independent source review found two concrete receipt-boundary gaps in the existing unpublished wrapper: it did not require the new approved-manifest hash on both upload records, and its final input recheck omitted some consumed summary/public/expected files. Correct these joins, retain canonical semantic validation, and add focused fake cases for missing/wrong manifest and input mutation during child commands. Require the fixed approved hash in the final binding receipt. Preserve all previously generated private outputs on failure; do not silently retry or delete them.

Verification is limited to the actual Windows PowerShell 5.1 fake composition suite and independent static review of the correction. Fake adapters exercise wrapper boundaries, not real private rendering or live deployment. The wrapper is a CLI invoked with `-File`; it is not advertised as safe to dot-source. Canonical modules and shared helper modules retain their existing import behavior.

## Final outcome

Both source-review findings are closed. State and final upload receipt must contain approved manifest SHA256 `870bc3e9abd6a53f6da97d220261ccb83ff5f9947ec1be5c8d0623fe54c19c50`; the final binding receipt propagates it. Final input checks include all five bundles, receipt/state/TSV, summary, stage3, public input files, helper, five expected-material records and both complete public manifests. Receipt-bound files are checked directly against their render receipt hashes again, so a change between initial validation and snapshot cannot become an accepted new baseline. The upload-owned historical-version metadata remains bound by the upload state hash and is not reimplemented here.

An independent reviewer confirmed closure at wrapper SHA256 `b7d36ea29347d60311660845deccdb51a525bdcb9f1cdfe9aa742a0216d67fd7`. Root independently executed the final fake suite with actual Windows PowerShell 5.1, exit 0: missing upload receipt refusal; four missing/wrong manifest refusals before composition; successful manifest propagation, canonical argv, three template records, ACL and suppressed-output checks; and 17 persistent input-mutation refusals. Test SHA256 `56e29657c9c6e1b5ef388e0556b274b93a90b6dd335d009fb54f940eefa84195`.

An initial fake run passed before the last receipt-bound final recheck was added; root reran the same focused suite after that correction and it passed. No broad test sweep, real private render or actual synthesis on Neo's inputs occurred. The next required evidence is Neo's local binding receipt and the three exact generated templates for the parent's diff review. AWS registration/deployment remains held.
