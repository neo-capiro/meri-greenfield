# Preview attempt custody: local proposal, not an allocated migration

Extends Fable documents P2/P6 for R4-DOC-2. No SQL migration ID, deployed adapter,
frozen contract amendment, store activation or purge execution is authorized here.
Qualification owns the collision-free allocation record and parent approval.

## Required store protocol

`apps/artifacts/preview/claim.mjs` defines the local
`meri.artifact-preview-claim.proposal-1` packet:

```
{claimVersion, versionId, artifactId, tenantId, conversationId,
 sourceVersionSha256, sourceSha256, binding, scopes, deadlineMs,
 previewId, objectId, createdAt}
```

The source identity is the hash of the complete canonical immutable version.
`binding` is the original trusted requesting run; `deadlineMs` is its original
bounded authority window. IDs are pure candidate names. Only the atomic winner's
allocation becomes canonical; rendering and every object effect follow its claim.
Uncertain claim acknowledgement never licenses rendering or another put.

Trusted port methods:

- `claim(packet, signal) -> {claimed:boolean, claim:packet}`: atomically insert
  once by `(tenantId, versionId)` (also verify conversation/artifact/source hash).
  On conflict return the retained allocation unchanged. No lease expiry or claim
  stealing. A different source identity is a conflict, never a new attempt.
- `recordObject(packet, ObjectReference, signal) -> void`: insert-or-identical
  exact returned physical object version for that claim, before publication.
  It must match its retained logical `objectId`. Lost ACK stays UNKNOWN.
- Existing `read(versionId, signal)` and `commit(record, signal)` remain
  insert-or-identical; commit requires the matching original claim/allocation.
- `custody(signal) -> [{claim, object:ObjectReference|null,
  record:ArtifactPreview|null, state:'COMMITTED'|'UNKNOWN'}]`: source-local
  inventory. The deployed owner must provide bounded tenant/subject paging and
  canonical retention routing rather than exposing this scan to users.

Source-local implementation uses atomic exclusive directories, synced temporary
files and rename; reopen preserves claims. Partial publications leave exclusion
held. An incomplete claim file cannot have dispatched bytes. A second store
instance borrows its root; disposing it does not delete retained state. This is
process-restart source evidence, not host-crash/fsync or deployed DB qualification.

## Proposed PostgreSQL allocation, without an invented ID

Allocate alongside, or before, the proposed `meri_artifacts.previews` table:

```
meri_artifacts.preview_attempts
  tenant_id text NOT NULL
  version_id uuid NOT NULL REFERENCES meri_artifacts.versions
  conversation_id uuid NOT NULL
  artifact_id uuid NOT NULL
  source_version_sha256 text NOT NULL
  source_sha256 text NOT NULL
  claim jsonb NOT NULL
  claim_sha256 text NOT NULL
  object jsonb NULL
  object_sha256 text NULL
  PRIMARY KEY (tenant_id, version_id)
  UNIQUE (tenant_id, (claim ->> 'objectId'))
```

Exact column syntax/foreign-key shape must follow the actual allocated versions
schema. Preserve immutable claim identity with a trigger; permit object null→one
matching immutable reference only. The preview record references its claim.
Use the canonical bounded transaction/lease owner: unknown COMMIT retires its
lease and holds the claim. Insert-or-identical is atomic under a subject/row lock.
No object write may follow an uncertain insert acknowledgement.

Recovery reads the committed preview through current canonical artifact authority
and returns it without another render/put after a lost commit ACK. With no record,
the attempt stays UNKNOWN, including after original expiry or process restart.
Do not turn UNKNOWN into an automatic retry. Resolving an uncommitted object into
a preview would require a separately reviewed current-authority recovery owner,
the exact retained allocation and immutable source, and a verified object read.

## Retention mappings requested

Canonical owner: artifacts. Subject: `(tenant_id, artifact_id)`, with the exact
conversation and source-version linkage retained. Scopes: immutable version
scopes, checked by canonical artifact reads. Proposed classes, pending approval:

| Class | Exact inventory key | Custody/deletion requirements |
| --- | --- | --- |
| previewAttempts | tenant + source version + claim SHA | Retain while any effect is UNKNOWN; keep a durable tombstone through restore. |
| previewRecords | tenant + source version + preview ID + record SHA | Immutable; enumerate with source version before ordered row deletion. |
| previewObjects | tenant + logical object ID + exact physical object version + SHA | Include references from published records and known uncommitted objects. |
| previewPotentialOrphans | tenant + retained logical object ID + source version + claim SHA | A lost put ACK has no trusted physical version yet: block purge until the trusted object owner enumerates/proves all versions under this exact allocation. |

Never infer absence from missing metadata or delete only the latest object
version. An uncertain put retains a logical identity before dispatch, even if
the store loses its response. The existing object port has no approved
lookup-by-allocation recovery contract; propose one instead of inventing a
provider endpoint. Before live wiring, inventory existing unclaimed preview
objects too and reconcile them under the same custody rules. Do not silently
classify these local records as external memory proposals or claim complete purge.

P6 filing currently uses the existing durable command claim as its exclusion and
UNKNOWN owner. No UNKNOWN filing retry is added. A future attachment recovery port
must use an immutable key derived from canonical command identity + selected
object identity + trusted destination, return insert-or-identical receipts, and
recover without replacing the original binding/expiry. This remains a proposal;
the current host-broker contract and product integration are not accepted here.
