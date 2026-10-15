# Durable artifact storage ports

These adapters supply the existing artifact service's storage ports. They do not authorize scopes, activate artifact delivery, or prove native rendering. The existing service continues to request current authorization before and after its effects and release.

```js
import {createS3ArtifactObjects, createPostgresArtifactVersions} from './index.mjs';
const objects = createS3ArtifactObjects({
  client, bucket, prefix, expectedBucketOwner, kmsKeyId, now: Date.now,
  maxRequestMs: 15000, maxBytes: 8388608,
});
const versions = createPostgresArtifactVersions({pool, now: Date.now, maxRequestMs: 15000});
```

`client` is a borrowed upstream S3Client-compatible client. `pool` is a borrowed node-postgres pool; each operation acquires and releases one lease, and never closes the pool. Neither constructor performs IO. `createConfiguredS3ArtifactObjects` additionally accepts explicit `region`, a required credentials-provider function, and optional HTTPS `endpoint`; it constructs an owned S3Client with one attempt. Its `close()` destroys only that owned client. No default credential chain is selected. The runtime owner must supply approved explicit role credentials and manage its own pool. Credentials never appear in canonical returned records or object metadata.

The required configuration maps to an existing version-enabled general purpose bucket, a trusted ASCII prefix, a 12-digit expected bucket account, and an exact KMS key ARN. Keys contain the SHA256 of all canonical scopes, the lowercase canonical object UUID, and the bytes' SHA256. ObjectReference.versionId is the server's native S3 VersionId, independently verified against exact-version HEAD and GET responses; it is never replaced with the content SHA256. Put uses If-None-Match `*`, SHA256 FULL_OBJECT checksums, and SSE-KMS. A 412 replay must match current HEAD request metadata and the exact native version. Checksums, content lengths, scopes, IDs, KMS key, native version, and bounded downloaded bytes must all agree. Unknown write acknowledgements remain UNKNOWN. SDK streams acquired after a timeout are retired.

The behavior follows upstream [PutObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html), [HeadObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadObject.html), [GetObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html), and [GetBucketVersioning](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketVersioning.html) APIs. The SDK is pinned to installed upstream `@aws-sdk/client-s3` 3.1141.0 (Apache-2.0). No donor application source is imported. The test-only real driver is `pg` 8.23.0 (MIT); leases and transactions follow [node-postgres guidance](https://node-postgres.com/features/transactions).

Apply `../migrations/0001_versions.sql` only through an explicitly approved migration owner against an isolated product database. This source phase did not apply it. The `meri_artifacts` schema stores canonical immutable JSON records, native object references, owner/session tuples, request/spec/inspection hashes, and one CAS head per artifact. A trigger prevents version UPDATE/DELETE. Creation/revision acquire an advisory transaction lock and compare the exact expected head, preserving tenant, actor, conversation, scopes, operation and format. Lost COMMIT acknowledgement quarantines the lease and returns UNKNOWN. Exact replay uses the existing bounded `readLocalReplay` kernel and publication lineage; a request hash alone cannot discover unrelated legacy random IDs. The store retains original run/attempt/fence provenance; the unchanged service checks current access. Statement and lock timeouts plus bounded rollback cleanup prevent a caller deadline from holding a reusable lease indefinitely.

## Bucket privacy proof

`createPrivateBucketVerifier({client,bucket,expectedBucketOwner,now,maxRequestMs?}).verifyPrivate({signal})` (`s3-private-bucket.mjs`)
performs four read-only bucket requests with `ExpectedBucketOwner`: every Block Public Access setting must be true, the bucket policy
status must not be public (no policy is not public), object ownership must be `BucketOwnerEnforced` (ACLs grant nothing) and versioning
must be Enabled. A missing setting is `ARTIFACT_S3_NOT_PRIVATE`; an unreadable one is `ARTIFACT_S3_PRIVACY_UNVERIFIED`, never assumed
private. It lists and reads no object and writes nothing. The account-level Block Public Access setting is an S3 Control read and is not
claimed. The runtime download-link gate requires this proof before serving links. The control role needs
`s3:GetBucketPublicAccessBlock`, `s3:GetBucketPolicyStatus`, `s3:GetBucketOwnershipControls` and `s3:GetBucketVersioning`; granting them is
the shipping owner's decision. The `bucketIdentity` check in `boundary.mjs` is shared with `createS3ArtifactObjects`.

## Source checks and remaining native gates

`node --test test/*.test.mjs` checks actual SDK command and S3Client serialization, actual pg Pool/Client wire serialization using an injected inert stream, SQL transaction/CAS/replay/tamper/cleanup fixtures, and the unchanged artifact service using both ports. All synthetic replies are explicitly fixtures. They prove source integration and failure handling, not AWS or PostgreSQL deployment qualification. The Linux capture helper records raw streams, exit status and owned process-group absence.

Native qualification still requires an approved bucket with versioning Enabled, exact account/region/key ownership, KMS/IAM version-specific read/write/checksum permissions, bucket policies preventing overwrites/deletion by the runtime role, successful real Put/Head/Get checksum/version correlation, and an isolated product PostgreSQL migration/permissions/CAS/concurrency/rollback/restart/lost-ACK check with the configured real driver. Runtime activation and live cloud/database calls remain outside this phase.

The first lockfile command succeeded while observing a borrowed local package link and produced an unsuitable donor-linked lock. Its receipt remains retained. Clean public-registry generation failed ECONNREFUSED and is also retained. The final portable npm lock was generated offline from installed upstream package metadata and the donor's native pnpm registry SHA512 integrities, with 40 pinned packages and no donor links. Actual offline `npm ci` first found missing optional pg-cloudflare metadata; that failure is preserved and the native installed optional package was added. The second actual offline `npm ci` passed the lock consistency stage and failed ENOTCACHED while fetching unavailable registry tarballs. Fresh installation therefore remains HOLD/unverified until registry connectivity or an independently verified tarball cache is available. The earlier empty npm config double-load failure is preserved in `test/evidence/initial-config-failure.txt`. Owned dependency links and temporary cache/config files are removed after checks; donor dependencies are preserved.

### Approved public installation followup, 2026-10-13

The source owner resolved the earlier installation prerequisite at unchanged package and lock hashes. Actual `npm ci --ignore-scripts --no-audit --no-fund` fetched all 40 pinned packages from the official public registry under the explicitly approved network tool permission. Distinct empty user/global npm configuration and an environment allowlist excluded ambient npm credentials. Two failed attempts remain retained: missing permission-provided transport routing caused timeouts; preserving routing without the tool's CA trust caused certificate verification failures. The successful attempt retained only the permission-provided credential-free proxy routing and Node/SSL CA trust paths. TLS verification stayed enabled; there was no alternate endpoint, credential acquisition, or native service call.

`public-installed-integrity.json` independently hashes every cached registry tarball against its unchanged native lock SHA512 and verifies all installed package versions. `storage-public-installed.json` records 18/18 checks against those freshly installed SDK/pg bytes. `public-install-cleanup.json` records the absence of owned dependency links, temporary installations, cache/config files and captured process groups, with donor metadata unchanged. Native AWS/PostgreSQL qualification remains pending. This local evidence followup is not published because the root reported a GitHub authentication blocker; the earlier published source pin remains available.

### Constructor admission repair

Independent controls found that reading `client.send` and `pool.connect` during construction executed configured getters. The original failure and the owner's reproduction remain retained. Adapter construction now admits methods through inert property descriptors along a proxy-free prototype chain, rejects accessors/proxies before invoking traps, and retains the admitted function bound to its original receiver. Later replacement with a getter cannot change the admitted operation. Real S3Client/pg.Pool prototype methods remain supported. The final 29/29 source checks include direct and inherited getter/proxy controls, native constructor positives, retained-method mutation controls, and the original 18 storage/service checks, all against a second fresh unchanged public dependency installation. Independent acceptance of the repaired source remains the root reviewer's responsibility.
