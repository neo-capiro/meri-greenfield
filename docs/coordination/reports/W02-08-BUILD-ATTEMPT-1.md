# Refreshed worker build attempt 1 — API rejection

Codex integration owner, 10 October 2026 UTC. **No new build was observed; no image, Linux inventory, scan or runtime was produced.** The exact one-shot attempt is closed and its reservation remains consumed. No automatic retry or reuse is authorized.

Prepared source `27fe2fa82acfbd64166c7e7b197193f62430e945`, run UUID `7bb6e1ad-d12b-4955-b107-1191296fba93`, review-request SHA256 `63c365531b7fa695c5545816f483c4bdbb36c34ed6e56f59e6e8622b1e6d104d`, archive SHA256 `3ed2c3f9211a30014d1bea84d0b942d0c30a92ac54d6c38d921c0d1c29072616` (1,200,597 bytes, 241 entries). Separate actual Hermes source review and a bounded prepared-archive audit preceded owner one-build admission; the latter passed 743 byte/data/binding assertions. The audit explicitly discloses its author made an earlier helper repair; it is not another separate Hermes source review.

Fresh owner STS and builder IAM trust/inline/attached-policy readback matched the reviewed new builder. The transaction separately rechecked fresh exact account/principal, repository, full project configuration and terminal previous builds, then uploaded only the new source object to the isolated qualification bucket. Its returned version `MeGcY273EufjiA2qVeEUQ9gfU2OSiaJl` is recorded authoritatively in private receipts; version/checksum/KMS/metadata were verified by HEAD. No provider/source/app/runtime permission was added.

After another full project and fresh identity check, CodeBuild StartBuild rejected the exact mandatory inline override at the retained local observation 01:29:43Z:

> InvalidInputException: Max buildspec length is 25600

The override is 25,900 bytes; compact JSON alone is still 25,840 including final LF (25,839 without LF). This API validation constraint was missing from local preparation checks. The helper stopped with `STOPPED_OR_OUTCOME_UNCERTAIN`; no further mutation followed. Its captured error reports zero AWS retries. Read-only reconciliation subsequently confirmed the exact same three build IDs as before dispatch, all terminal, with no newly observed build. This observation plus the explicit API validation response supports rejection before build creation; it is not an inference from an absent local result alone.

The uploaded version and exclusive reservation are preserved. ECR publication, result upload, Linux inventory and the refreshed-image scan did not occur. The earlier baseline's findings remain unresolved and no admission transfers from that image.

Codex is preparing a minimal representation/whitespace repair and a local inline-size guard. Any changed helper/override requires renewed review, a new committed source/archive/request, a fresh owner one-build admission and fresh authority checks. The old reservation/request must never be removed, altered or replayed. Runtime/native/browser/Bedrock, G1 and cutover remain unadmitted; application/control remain isolated on Fargate and current Meri/Capiro remain untouched.
