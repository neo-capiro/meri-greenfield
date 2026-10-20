# Launch measurement for a new Node runtime image

These helpers produce the measured `runtime-values` that `first-chat/render-material.mjs --runtime` needs for a new image. They were promoted from the release-E handoff packet (`handoff/runner-diagnostic-release-20261020`, `docs/integration/runner-diagnostic-release-20261020/measurement-packet/`); the copies on that branch stay as history.

Every step on this machine is offline. The operator runs the two AWS steps between them:
- the payload upload;
- the CodeBuild job and its readbacks.

**Pins come from arguments.** Nothing is edited by hand:
- the measured commit comes from `--source-commit`;
- the reviewed public deployment baseline comes from `--baseline-commit`, `--baseline-path` and `--baseline-sha256`;
- `measurement-build-wrapper.py` is a template whose only variable line is the source commit, which `measurement-payload.mjs renderWrapper` fills in. Never run the wrapper unrendered.

The project, role, KMS key and verifier pins stay as reviewed constants. A test fails when the in-repository verifier no longer matches `VERIFIER_SHA256`.

| Step | Command | Result |
| --- | --- | --- |
| 1 | `node prepare-measurement.mjs --source-root <clean checkout at the commit> --source-commit <sha> --request request.json --product-receipt product-image-receipt.json --deployment deployment-inputs.candidate.json --policy …/first-chat/policy.json --allocation …/first-chat/allocation.json --baseline-commit <sha> --baseline-path <path> --baseline-sha256 <hex> --project-role-arn <role> --attempt <hex32> --out <new dir>` | Plan, payload, launch overrides and `preparation-hashes.json` (`OFFLINE_MEASUREMENT_PAYLOAD_PREPARED_AWAITING_VERSION_PIN`) |
| 2 | Operator: conditional PutObject of `measurement-payload.json` to the `payloadKey`, with SSE-KMS; then the authenticated HEAD → `payload-pin.json` | Immutable VersionId pin |
| 3 | `node finalize-measurement.mjs --packet <dir> --payload-pin payload-pin.json --source-commit <sha>` | `measurement-buildspec.json`, `measurement-start.request.json`, `packet-hashes.json` |
| 4 | Operator: submit `measurement-start.request.json` once. No retry. Then read back the product and measurement builds, the ECR image and scan, and download the six selected-version results into the operator and results directories | Authenticated public records |
| 5 | `node verify-measurement.mjs --source-root <checkout> --source-commit <sha> --packet <dir> --results <dir> --operator-dir <dir> --out runtime-values.measured.json` | `MEASUREMENT_VERIFIED_AND_ASSEMBLED` and the canonical `runtime-values.mjs assemble` output |

Each command is create-only. It refuses an existing output and never deletes evidence.

**Byte compatibility.** For the 3dc993ef release, the promoted helpers were run against the recorded inputs of measurement build `d441f856`, and every output matched that run byte for byte:
- prepare: plan, payload, overrides, hashes;
- finalize: pin, buildspec, start request, hashes;
- verify: assembled runtime values.

`fixtures/3dc993ef/` keeps the plan and hash records. The tests use them to prove that the template and the finalizer still reproduce that run.
