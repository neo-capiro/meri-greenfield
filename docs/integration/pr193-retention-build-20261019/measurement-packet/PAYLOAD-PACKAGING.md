# Version-pinned public payload packaging

The real inline packet refused the 25,600-byte buildspec limit. A raw UTF-8 envelope was 26,725 bytes; direct concatenated bytes were 26,418 bytes. Neither produced a StartBuild request or started a job. Codec iterations stopped. The original reviewed packet and review remain under `superseded/inline-base64-20261019/`.

The established product pattern is `infra/product-preview/image-build-producer.py:351-360`: HEAD an exact VersionId, bound its length, GET that same version, verify response identity, actual length and SHA256 before use. Canonical `image-build-recipe.mjs` uses an inline base64 request and a hash-checked source script; it does not provide a compressed or external S3 buildspec helper. This packet follows those verified-source and immutable-download patterns. Direct S3 buildspecOverride was not used because explicit VersionId binding was not established.

One nonsecret public payload is uploaded by root to the **existing** versioned KMS bucket and existing role's `inputs/*` read scope. No source archive, image, wrapper or runtime evidence join changes. Root owns the conditional upload, authenticates its Put/HEAD VersionId/checksum/KMS records, and supplies those immutable fields to offline finalization. No upload occurs inside these preparation tools.

## Stage one: real prepared payload

Directory: `task-2/pr193-retention-measurement-prepared/`.

- Payload: `measurement-payload.json`, **76,918 bytes**.
- SHA256: `3587ebafba8f379e944845d80f43c2c2046496c85d67b37f576bd7257a0628c7`.
- Plan SHA256: `66b5956d6ca139a2e4159b827a096bb8b739d72712671ac8a149b35440e36298`.
- Unchanged wrapper SHA256: `8afb2093090a80c92f50f6988e21d182cf8a98fce61d5923674bb60db2d5d93c`.
- Bucket: `meri-greenfield-qual-build-967807252336-us-east-1`.
- Key: `inputs/launch-measurement/5b395d4ce9218b872b21c420dc00a3af31739824/113ba3cc0d3f4baf978e157a347c9654/measurement-payload.json`.
- Existing KMS key: `arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042`.

The payload JSON contains base64 of each original file's exact bytes, its byte count and SHA256. There is no compression or custom codec. Source/public C inputs and complete expectations were produced by the existing canonical generator. The deployment only changes C's node image and source fields; three turns, one tool, absent capability profile and absent active-read selectors remain unchanged.

## Stage two: finalize only after authenticated upload

Root supplies a JSON object with `bucket`, `key`, `versionId`, `bytes`, `sha256`, `checksumSha256` (base64 SHA256), `serverSideEncryption` equal to `aws:kms`, and `kmsKeyArn`. The bucket, key and KMS key must equal the reviewed values. A null or guessed VersionId is refused. The local payload must match the selected version's declared length/hash/checksum. Preserve the actual authenticated Put and HEAD records separately; a hand-authored pin does not authenticate itself.

```powershell
node .\pr193-retention-measurement-packet\finalize-measurement.mjs --packet .\pr193-retention-measurement-prepared --payload-pin <authenticated-root-payload-pin.json>
```

Finalization is create-only. It emits `payload-pin.json`, the small `measurement-buildspec.json`, `measurement-start.request.json`, and `packet-hashes.json`. The root and independent reviewer inspect these before root submits job two. The final verifier reconstructs and compares the exact pinned-payload buildspec, checks payload and pin hashes, and joins decoded plan/wrapper bytes before its existing source/image/receipt checks and canonical assembler.

Root completed the authenticated upload and offline finalization for this payload:

- Selected VersionId: `s2LyKxvj0w39XEMmWWKZ1oKI1HEKbPFS`.
- Inline buildspec: **3,867 bytes**, SHA256 `38340a4f678d8000fa5fae237cea8f6d67a6bbf34e78b19a098f79501db56c54`.
- StartBuild request SHA256: `dd581fab794c42ed9aeeed683bbd4ac0c02943caf6ba9b4ddfc14ff964ddaed4`.
- Payload pin file SHA256: `271bcce5cb6e0806a4526837fa7235679ab8e5d431f1d7a7575bbe4a815152fa`.

These are packaging records, separate from measurement build execution and acceptance.

## Bootstrap bounds and failure behavior

The inline bootstrap first checks the exact canonical verifier file SHA256 before importing its bounded command adapter. HEAD and GET both name the same immutable VersionId. HEAD requires 1 through 1,048,576 bytes, the exact declared length, aws:kms and the exact existing KMS key. GET requires matching VersionId, downloaded length and file SHA256 before JSON/base64 decoding. Decoded plan and wrapper must each match their separately embedded exact byte count and SHA256 before being written into the owned 0700 temporary directory.

The total bootstrap deadline is 540 seconds including fetch. Each fetch call has a 20-second maximum and bounded captured output. It refuses to start the unchanged wrapper unless at least 500 seconds remain, allowing its 420-second work budget and bounded cleanup. The measurement job remains ten minutes, queue five, retries zero. Fetch/verification failure never emits a success receipt. A constant-only phase marker identifies PRECHECK, SOURCE_VERIFY, PAYLOAD_HEAD, PAYLOAD_GET, PAYLOAD_DECODE or WRAPPER; arbitrary exception text and child diagnostics are not printed or overwritten.

## Focused evidence

`payload-test-evidence.txt`: **12/12 passed**. Tests use the actual prepared payload and exact generated Python bootstrap, replacing AWS calls and wrapper execution. They verify exact byte reconstruction, selected-version and downloaded-byte refusals, constant failure markers, private temporary-directory cleanup, aggregate deadline, and wrong bucket/key/version/length/hash/checksum/KMS rejection. Existing 34/34 receipt joins are unchanged and were not rerun for this packaging repair. No AWS or Docker command was executed by the author.

Finalized request review and Linux measurement remain separate gates. The payload tests establish packaging behavior only.
