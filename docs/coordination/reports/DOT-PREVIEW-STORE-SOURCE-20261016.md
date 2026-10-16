# Preview store source batch, 16 October 2026

Branch `dot/meri-preview-store-20261016`, exact base
`2124306473aa84054158e9fe1f0fdff01c9357ba`. The sealed atomic-snapshot branch is
preserved. Separately published current-head repair
`855e423376c7724fb96124002dbd89092a479cfc` received the parent's independent
source ACCEPT with 47 synthetic controls; it is not silently integrated into
this separate child. Actual authoritative sink and PostgreSQL qualification
remain pending. Preview0003 source DDL at eb52 was accepted; it is unchanged here.

Qualification confirmed exclusive ownership of preview claim/service/inventory,
the new preview/postgres-store module and its focused tests. Startup retains
runtime/control/readiness ownership. No shared runtime composition was edited.

The bounded implementation outline is now executable source:

- Strengthen the existing local claim packet using canonical binding, scope and
  deadline validation. Refuse extra keys, invalid original binding, inconsistent
  expiry and noncanonical creation time before claiming. Recovery retains an
  expired original packet without extending its authority.
- Read reserved0003 projections through the existing canonical retention
  journal's bounded transaction owner and shared recovery exclusion, explicitly
  READ COMMITTED. Reuse the canonical artifact version reader after returning
  the metadata lease, avoiding nested pool acquisition while holding that lease.
- Validate normalized tenant/artifact/source identity and all canonical claim,
  object reference and immutable preview record hashes. Native physical version
  identity remains distinct from the content digest. Published metadata must
  match its retained known object receipt exactly.
- Expose only metadata `read(versionId,signal)` and artifact-scoped `custody(signal)`.
  This adapter has no claim, object-recording or commit method, and cannot satisfy
  publication service configuration. It grants no user authority. Current
  artifact authorization remains the service's responsibility after future wiring.
- Refuse the whole inventory on overflow, duplicates, corrupt packets or unknown
  transaction completion. The default row bound is 128, configurable to 256; the
  response ceiling is 8 MiB. Returned restorable metadata is not an authoritative
  absence, outside-rollback recovery certificate or purge inventory.

Canonical owners: `apps/artifacts/preview/claim.mjs` and
`apps/artifacts/preview/postgres-store.mjs`; no new transport, migration,
framework, provider implementation or placement. Read-only construction performs
no I/O; borrowed journal/version owners are never disposed by the adapter.

Verification is synthetic production source and scripted SQL, **not PostgreSQL
execution**. Eight malformed/creation regressions fail unchanged212430 claim
source. The initial fixed packet/custody batch passes 15/15. Final combined batch
passes **19/19**, no skip, exit0, Node636ms / controlled wall765ms. One process,
128 MiB V8 heap, sampled peak working set93,872,128bytes, fresh available memory
12,201,840,640bytes. A 120-second hard wall and pressure stop were installed.
Process exit and local preview fixture cleanup were observed.

```
node --max-old-space-size=128 --test --test-isolation=none apps/artifacts/test/preview-claim-validation.test.mjs apps/artifacts/test/preview-postgres-store.test.mjs apps/artifacts/test/preview-custody.test.mjs apps/control/document-application/test/preview-custody-configuration.test.mjs
```

Evidence under task-9/evidence: `preview-claim-212430-negative*`,
`preview-claim-fixed*`, `preview-projection-fixed.tap`, empty stderr and
`preview-projection-fixed-process.json`. The first combined batch17/19 is retained
as `preview-projection-first*`: a mutation assertion now explicitly expects the
canonical boundary's frozen detached result, and overflow classification now
occurs after the canonical read transaction closes instead of being masked by
its retention-domain error wrapper. No partial inventory or source release is
allowed, and no lease cleanup assertion was weakened.

## Pending parent decisions and activation holds

The effectful PostgreSQL write path, startup custody replay, allocation lookup
and authoritative retention inventory remain **pending**, not denied or attempted.
The existing suppression/purge ledger vocabulary cannot silently absorb preview
events. Qualification has relayed this precise bounded recommendation to parent:
reuse the existing shipping write-once evidence owner with a purpose-isolated
preview namespace and accepted CLAIMED/OBJECT_RECORDED/COMMITTED/TOMBSTONE facts,
bound to the original claim hash, allocation, binding and deadline. Replay must
rebuild the restorable projection under existing recovery exclusion before
readiness; UNKNOWN never remints and tombstones survive database rollback.

The object owner currently exposes only put/get. A separately accepted bounded
allocation lookup must enumerate exact native versions and verified metadata
for the tenant/scope/object allocation with complete-page proof. Missing or
incomplete results cannot prove absence. No provider endpoint or new schema ID
was invented. Full paging/inventory and effectful write methods remain planned
work, not silently reduced product scope.

All historical manifests/proposals and the 45 candidate-h proof rows remain
unchanged; h remains HOLD. No runtime activation, SQL execution, real object/DB/
provider/browser call, migration/purge, credential, cloud operation, heavy suite
or P2b stopped-review retry occurred. This new preview source needs independent
review; source acceptance alone cannot activate its held dependencies.

## Accepted continuation design and implementation outline

Parent independently accepted856b0ad8c8cd5d69ae72e30fe2f0cb5d006599a0
(19 focused controls, three boundary probes, eight old-source negatives). The
parent then released bounded source custody implementation: genuine conditional
first-winner exclusion outside SQL rollback; purpose-isolated CLAIMED,
OBJECT_RECORDED, COMMITTED and TOMBSTONE facts; original claim/authority retention;
current complete durable facts checked against coherent SQL snapshots on every
read/claim; replay under the existing recovery exclusion. This supersedes the
pending-design paragraph above, not its live-activation holds.

Canonical responsibilities and exclusive source paths:

| Owner/path | Continuation responsibility |
| --- | --- |
| Existing preview/service.mjs | Keep the publication/authorization/render/readback loop and existing claim interface. Only a newly won durable claim followed by certified projection can return claimed:true. |
| preview/custody-journal.mjs | Bound a separate preview namespace on the shipping evidence owner; validate conditional write receipts and complete immutable facts, canonical claim/source/receipt/record packets and hashes. No retention enum or sequence-certificate reuse. |
| Existing preview/postgres-store.mjs | Add insert-or-identical claim/publication and null-to-exact native receipt CAS through journal.tx and0003; compare one joined SQL snapshot with current durable facts before release. |
| preview/custody-recovery.mjs | Reuse journal.exclusive; recover canonical source prerequisites, replay immutable projections, re-read current facts and certify exact projection before readiness. TOMBSTONE overlays serving and dispatch without SQL DELETE. |
| storage/allocation-lookup.mjs | Read-only bounded exact-allocation observations through the existing object owner; verified native versions/delete markers and stable complete pages. Empty observations never prove terminal absence or purge while an unknown writer may still complete. |
| Startup-owned runtime/control/product-applications/readiness | Narrow composition only after the concrete callable handoff. This lane does not edit shared runtime files. |

Effect order is durable conditional claim acknowledgement, SQL claim commit,
current authority, rendering and put, durable native receipt acknowledgement,
SQL receipt CAS, exact byte readback/current authority, durable immutable commit
acknowledgement, SQL publication commit. Lost acknowledgement or unknown COMMIT
stops the original operation. Replay restores custody without acquiring another
dispatch right; conflicting claims retain the first allocation and original
binding/deadline. No local cache or restorable boolean certifies freshness.

The source adapter requires actual conditional write and current complete-read
methods from the trusted, purpose-scoped evidence owner. The repository baseline
only supplies a retention append/read port and a synthetic memory sink; these
cannot meet winner exclusion. Shipping has been asked for the concrete binding.
Missing guarantees refuse construction/live composition, rather than inventing
a provider. Canonical prerequisite source recovery must similarly be supplied
by its owner; preview replay cannot infer a current artifact head from an old
preview claim. No migration ID or schema change is implied.

Focused controls will cover competing owners, identical/conflicting claims,
lost durable/SQL acknowledgements at each boundary, restored-away rows and an
unseen later event, tombstone rollback, malformed/overflow/unstable allocation
pages, and lease/deadline cleanup. All use synthetic ports/scripted SQL. Two
existing-port characterization controls already pass2/2: lost claim ACK retains
the original allocation/binding/deadline on allowed retry; current revocation
blocks a second custody call. One128MiB process, exit0, Node421ms, wall555ms,
sampled peak91,127,808bytes; fresh available11,922,784,256bytes. Its120-second
hard wall and memory-pressure guard did not fire; it exited with no children or
fixtures. Evidence: preview-custody-continuation.tap/stderr/process.json. No broad
suite or provider/DB/storage action was run.

## Implemented continuation and exact activation boundary

The child `dot/meri-preview-custody-20261016` starts exactly at accepted856b0ad8.
It preserves the sealed212 snapshot branch and separate accepted855 current-head
branch. Qualification owns their eventual single integration; no retention source,
frozen contract, migration or lockfile was changed in this continuation.

The source now implements the outlined adapters. `postgres-store.mjs` delegates
to cohesive `postgres-custody.mjs` only when a custodyJournal is supplied. Without
it, the accepted read-only owner remains read-only and cannot enable publication.
The existing canonical storage-envelope validator has one additional pure export;
custody reuses it rather than copying its source/spec/inspection validation.

`custody-journal.mjs` binds namespace
`meri.artifact-preview-custody.proposal-1`. Its borrowed evidence owner must supply:

- `claim(request,signal)`: atomically conditional on **both** tenant/sourceKey
  and tenant/scope/object allocationKey, outside SQL rollback. Return the stored
  winner plus a newly-created acknowledgement only to the actual winning call.
  Identical replay returns created:false; a source conflict returns the original;
  an allocation already owned by another source refuses. Competing append-only
  claim records cannot implement this method.
- `append(request,signal)`: insert-or-identical immutable state fact for the exact
  tenant/source/state key; never overwrite a native receipt, commit or tombstone.
- `read({namespace,tenantId,artifactId},signal)`: **current complete** immutable
  artifact partition outside rollback, including all original claim/source
  packets. It is a trusted owner guarantee, not a caller-set complete/restorable
  boolean. Rows carry canonical entry and receipt hashes. The adapter bounds and
  validates the complete set, and derives its distinct positionSha256 from those
  immutable facts; it never borrows the retention sequence/watermark.

Each write carries canonical namespace/tenant/artifact/source/state/claim hash
and facts. Each acknowledgement binds namespace, exact state key and entry hash;
its stored packet is checked before use. A durable CLAIMED packet retains the
canonical source storage envelope needed by the source owner during recovery.
UNKNOWN never gains dispatch from re-projection, alternate allocation or retry.

The SQL extension uses the existing journal.tx, explicit READ COMMITTED and
shared recovery lock; writes additionally lock the tenant/source key. Claim and
commit are insert-or-identical, and the first physical receipt is a null-to-exact
CAS, with exact canonical readback inside that transaction. Lost COMMIT retires
the existing transaction owner's lease. Durable acknowledgements precede SQL.
Ordinary reads/readiness and claim decisions compare one joined SQL snapshot with
the current complete immutable facts, including events this reader never saw
before restore. No process-local high-water mark can stand in for that comparison.

Original native receipts may be retained after tombstone or SQL restore: this is
custody bookkeeping, not serving or dispatch permission. TOMBSTONE blocks release
and any new claim, remains in the durable facts after SQL rollback, and preserves
known/potential orphan inventory without issuing SQL DELETE or claiming deletion.
The service rechecks custody before render, put and commit and after bytes are
read. The existing document and artifact runtime wrappers preserve assertCurrent.

The sealed recovery interface is
`createPreviewCustodyRecovery({store,sourceRecovery,now,maxRequestMs})`, returning
`reconcileExclusive(signal)` and `ensureServing(signal)`. The former performs ONE
bounded replay and current-facts certification and returns
`{positionSha256,subjects}`. Startup must call it inside its existing raw
journal.exclusive, before that existing fence opens. The existing coordinator
owns exclusion, settling/retry and gate opening; this module adds no gate or
second recovery loop. `sourceRecovery.recover(originalStorageEnvelope,signal)`
must recover immutable prerequisites and the authoritative source/head lineage
through their canonical owner. A preview claim cannot nominate a historical head.

`s3-objects.mjs` now exposes read-only observeAllocation over its existing key
derivation and exact native-version metadata verifier. Actual upstream
ListObjectVersionsCommand is reused. The bounded lookup traverses all observed
versions and relevant delete markers twice, refusing overflow, looping cursors,
duplicates, mismatched scope/request metadata and unstable results. Each returned
page retains its observed cursor and next cursor; the observation has a canonical
hash. **Native S3 listing does not provide a point-in-time snapshot cursor or
durable allocation closure/fencing.** Consequently the result explicitly reports
complete:false and terminalAbsent:false, even for equal exhausted empty passes.
It is observed custody only. No purge-complete inventory or terminal absence is
exposed; a real owner with those additional guarantees is still required.

## Verification and retained failures

All evidence is synthetic production source, scripted SQL and synthetic object
ports, including actual upstream SDK command classes. No PostgreSQL, AWS, native
browser/compiler, renderer process, real storage/provider call or install ran.

- `preview-custody-focused-final*`: **51/51**, no skip, exit0, Node1191ms,
  controlled wall1350ms, sampled peak working set125,210,624bytes. This includes
  16 initial durable custody controls and35 affected-owner controls (claim,
  read-only projection, local custody, document configuration, allocation and
  existing S3 owner checks).
- Four additional durable boundary controls and a final source refinement were
  then added: preserve an exact receipt after tombstone/restore; tombstone during
  SQL publication; late conditional ACK after timeout; source recovery failure.
  `preview-custody-sealed-source*`: **20/20**, no skip, exit0, Node919ms,
  wall1094ms, sampled peak111,427,584bytes; fresh available12,120,936,448bytes.
  These20 replace the earlier16 for changed custody/recovery source. The35 other
  checks reuse their valid, unchanged exercised source evidence; **55 distinct
  controls**, not a claim of one55-case invocation. Each process used128MiB V8
  heap, test-isolation=none, a120-second hard wall and pressure stop. Every owned
  process exited; no test child or local preview fixture remained.
- Lost durable/SQL acknowledgements assert the exact failure cause, not merely
  a generic effect error. Two independent store owners issue one put; all
  acknowledgement/restore/tombstone replays retain original custody and issue
  zero additional object effects.

Earlier failures remain retained: source-first0/15 (missing SDK resolution and
TXT inspection fields in a synthetic PDF envelope); source-corrected exit7
(Windows --import needed a file URL); source-loader-fixed7/21 (fixture map passed
Array.map's numeric index to structuredClone options); source-fixture-fixed5/14
(historical fixed clock expired against render's real deadline). Fixture/loader
corrections preserved validators and strengthened exact failure-phase checks.
The intermediate clock-fixed16/16 and boundary-final20/20 are retained too; only
the final sealed-source20 result binds the last recovery refinement.

The local SDK junction attempt was denied (New-Item Access is denied); no junction
was created and no denied action was retried or escalated. Tests instead used a
task-owned Node resolution hook reading existing task4 @aws-sdk/client-s3
**3.1141.0** and its dependencies. This establishes source-control evidence only,
not clean-install/image qualification. Exact argv, actual exits, stderr, sampled
peak measurements and cleanup are in each task-9/evidence process receipt. The
task-owned hook/capture script are retained there for reproduction.

`preview-byte-release-negative*` removes only the final preview-custody check
after byte retrieval: the tombstone-during-read regression fails1/1 as expected
(missing expected rejection, exit1), proving that guard changes observable byte
release. This is an exact guard-revert control, not a whole-old-source claim.
Source restoration SHA256 is
67c25d43c9111521dfbf52cc466abe879a5041df87c5ee04c0cfbe70340fb15b,
identical before/after; the current source's positive control is in sealed20/20.
The negative process exited normally, no pressure/timeout, wall621ms,
sampled peak105,955,328bytes. No extra object/provider action was performed.

### Remaining blockers and ownership

Runtime wiring is **pending**, not attempted/denied: Startup retains
runtime/control/product-applications/readiness. Its owner confirmed the existing
retention append/read port provides no conditional preview winner or purpose
namespace. No concrete product Shipping evidence implementation or canonical
source/head recovery factory has been supplied; both are required before live
composition. This source refuses missing methods instead of fabricating a provider
or inferring durable completeness from restored SQL. Shipping was asked for the
exact existing owner/pin; no cloud action was requested.

The bounded native allocation observer cannot meet snapshot/closed-writer terminal
absence guarantees. Final absence, complete purge inventory, SQL deletion,
retention0014/receipt amendments and any new certificate allocation remain HOLD.
No distinct certificate table was needed or authored for exact-fact comparison.
Parent exact-source independent review and Qualification integration are pending.

The historical manifest SHA remains
79a5f7fc5254c0152c0119264d653cdb5b561f27ded91d379569d00ba73a5c1e;
all45 candidate-h current hashes still match its recorded rows: **zero changed
proof rows**, zero repins. Historical proposals and manifests remain untouched;
candidate h and live qualification remain HOLD. No P2b stopped-review retry ran.

## Independent duplicate-claim release finding and focused successor

Parent review of3b2940b8 found a missing final custody check in the losing-claim
recovery branch: another owner can commit after the first missing read, and a
tombstone acknowledged during the later current artifact-authority check could
still return a successful existing preview. This did not redispatch an object,
but it released stale publication metadata.3b remains unaccepted for this finding.

The separate child `dot/meri-preview-custody-release-20261016` adds the same final
stored-record/current-custody equality check already used by the other existing
record branch. No adapter architecture, authority, recovery or dispatch semantics
are changed. A new production-module synthetic regression uses two canonical
stores, one real source service winner, one object-port put and a durable tombstone
during the losing caller's authority check. The regression fails unchanged3b1/1
(missing expected rejection, exit1) and passes fixed1/1 (exit0); both processes
exit and no second put is issued. Evidence `preview-duplicate-release-3b294-negative*`
and `preview-duplicate-release-fixed*` retains exact argv, fresh memory, measured
sampled peaks, TAP/stderr and cleanup. No broad rerun or live action was performed.
Parent's portable independent probe remains pending; source acceptance is separate.

## Concrete owner discovery and disabled continuation outline

The subsequent parent instruction asks for real source wiring rather than another
generic required port. Discovery at3ca32b13 confirms:

- `scripts/qualification/sdk-native-evidence-owner.mjs` composes a signed,
  one-shot qualification observer/publisher. Its canonical fixture S3 transport
  has fixed qualification-kind keys and IfNoneMatch writes; it has no product
  conditional winner, complete preview namespace or authoritative head recovery.
- `scripts/qualification/aws_evidence.py` is an owner-only CLI qualification
  capture with fixed build-upload targets. It is not a product evidence service;
  those qualification bucket/KMS values cannot become product configuration.
- `apps/artifacts/recovery.mjs` recovers a producer-owned invocation only by
  reading already stored, published lineage through versions.read. The canonical
  `storage/postgres-versions.mjs` commits immutable rows/head CAS but has no restore
  operation. Neither can reconstruct an absent authoritative head from a preview.

Shipping was asked only for exact existing source/interface/resource facts. No
credentials, provider call, new resource or security/policy change was requested.

The smallest concrete source extension being prepared on separate child
`dot/meri-preview-evidence-source-20261016` uses actual existing S3 SDK commands
and canonical bounded storage validation: a purpose-scoped tenant index updated
with IfNoneMatch initially and IfMatch on its observed ETag thereafter. One
conditional index update excludes both source and allocation and retains the
complete bounded immutable fact set; ETag is a concurrency token, never a digest.
Exact native version, checksum/KMS/account metadata and full-byte readback precede
acknowledgement. Unknown PUT acknowledgement never retries; a proven412 may
re-read before a bounded CAS retry. Ordinary reads use that single current index,
not object listing as a completeness certificate. All new activation defaults
disabled, and no qualification resource is silently selected. Bound exhaustion
refuses; it does not silently truncate inventory or grant dispatch.

A concrete PostgreSQL source-recovery owner will insert-or-identical the retained
canonical immutable source row under the existing exclusive recovery transaction,
then revalidate it through the existing versions.read/head-lineage path. It never
inserts, nominates or rewrites a head from a historical preview claim. If the
authoritative head is absent, rolled back outside provable lineage or itself
unrecoverable, readiness remains unavailable. The remaining minimal head-contract
proposal is separate durable artifact publication/head-CAS evidence from the
canonical version publication owner; no new enum/table or generic replacement is
silently invented. Actual runtime control/readiness remains Startup-owned.

### Concrete implementation result

The described extension is now implemented in `storage/s3-preview-evidence.mjs`,
`storage/postgres-source-recovery.mjs` and `preview/postgres-composition.mjs`.
It does not require another anonymous evidence or recovery factory: the concrete
composition accepts the existing borrowed S3 client/configuration, pg pool and
canonical retention journal, then constructs the actual adapters itself.

The S3 owner uses one bounded, purpose-scoped tenant index containing the full
immutable fact set and allocation reservations. Its actual PutObject conditions
atomically select the source/allocation winner. The existing installed upstream
SDK3.1141.0 PutObjectRequest declaration includes both IfMatch and IfNoneMatch;
no provider endpoint/method was invented. Exact versioned GET readback checks
full bytes, SHA256 checksum, KMS key, expected account, namespace and tenant.
ETag is used solely for concurrency. Only proven412 permits bounded re-read/CAS;
any other unknown write/readback acknowledgement holds, and an identical replay
cannot regain created:true. Reads never use listing or a cached completeness flag.
Known delete-marker errors, unavailable versioning,403, malformed metadata,
overflow and contention refuse. The default bound is1024 facts and8MiB per tenant
index; hitting it is an explicit unavailable barrier, never partial inventory.
Larger retained history requires a reviewed paging/index extension before live
capacity qualification; no full-scope capability is declared released here.

Immutable source recovery inserts-or-identical existing0001 rows inside the
canonical exclusive transaction. The same storage packet/relational-row validators
are reused. It restores a complete bounded prerequisite batch before checking
each version through the existing canonical published-lineage reader. The preview
replay accepts this concrete recoverAll method and preserves the original recover
fallback. No source head row is inserted, updated, deleted or selected from a
historical preview. The outer canonical recovery domain preserves failures in
its cause chain and keeps readiness unavailable.

Concrete composition defaults disabled: preview/readiness/recovery methods refuse
before SQL/SDK work. Enabled source fixtures are explicitly synthetic and do not
establish authority to enable any product runtime or select a resource. No runtime
control/readiness file or actual configuration was changed. No qualification
bucket, key, credential or policy is reused as product configuration.

`preview-concrete-evidence-fixed*` passes **39/39**, no skip, exit0:
18 concrete conditional SDK/SQL/composition controls,20 custody controls and the
independent release-race regression. Node1259.8ms, controlled wall1444ms, sampled
peak working set120,537,088bytes;128MiB V8 heap, fresh11,664,261,120bytes and120s
hard wall/pressure stop. All owned work exited. The full concrete fixture publishes
once, clears SQL immutable/preview projections, recovers through actual canonical
owners and returns existing with one total object-port put. Constructor/default
disabled paths issue zero SQL/SDK calls. CAS races select one winner; allocation
collision, failed/lost native ACK/readback,403, changed metadata, inventory limits,
and missing/rolled-back head refuse. These remain **synthetic scripted SQL and
SDK replies**, not native database/cloud acceptance.

One additional targeted control, `preview-concrete-index-absence*`, passes1/1
for known index delete-marker errors (both native property and HTTP header) and
foreign-bucket404. None is treated as empty current custody and no PUT occurs.
This adds one distinct control to the39 without re-running broad checks. Actual
unknown/malicious removal of the authoritative evidence namespace is outside its
required non-rollback resource boundary; source cannot replace that missing
Shipping qualification with a local cache or boolean. **40 distinct controls**
have valid synthetic evidence for this concrete continuation.

The first concrete batch14/15 is retained: its one failure expected the inner
SOURCE_HEAD_UNAVAILABLE code at the outer recovery boundary. The corrected
assertion explicitly requires RETENTION_STORE_UNAVAILABLE with that exact inner
cause; no production owner/error policy was weakened.

### Exact remaining head and resource decision

No inspected product source at3ca32b13 supplies a durable current artifact
publication/head journal outside SQL rollback. Preview custody contains only
previewed versions, so it cannot identify a later **unpreviewed** publication or
prove that a restored SQL head is the latest authoritative head. Existing lineage
verification is retained, but it is not presented as outside-rollback head proof.
An absent or unreachable head is refused; the concrete source extension does not
close that broader authoritative-head gap or activate restore serving.

Recommended minimal parent-owned contract: the canonical version publication
owner must retain the full immutable storage envelope and expectedParentVersionId
with its original authority binding in a separate artifact-publication namespace;
conditional per-artifact head CAS precedes SQL head projection. Current complete
publication/head receipts rebuild exact lineage and head, with lost acknowledgements
remaining UNKNOWN and current authorization on replay. Likely affected paths are
the canonical postgres-versions publication seam, one cohesive publication
evidence owner reusing the concrete S3 CAS transport, and preview composition.
This is a precise **pending proposal**, not an implemented/accepted new enum,
schema, certificate, migration or placement. The frozen ArtifactVersion is unchanged.

Shipping's exact existing product evidence bucket/purpose-prefix/KMS/owner and
outside-rollback, deletion/rollback-protection facts remain pending; no concrete
resource binding was received. The source extension can implement the missing
conditional semantics using current SDK methods, but cannot make an unqualified
or restorable bucket authoritative by a boolean. No real storage write, cloud
resource/security/credential operation, migration execution or purge was attempted.

The parent portable release probe was also copied and run against3ca32b13 with a
wrapper requiring EFFECT_UNKNOWN caused by TOMBSTONED:1/1 pass, wall675ms,
sampled peak106,041,344bytes. Precision: copied executable LF bytes hash
e7bcba8af115350ecda1e861765cf694abcff71ea6c51930c68c192286ae6632
differs from announced34160d9751be151a316f8bd7ac5ce2ec952e40a16372f1d6ebf6262fe9edf62b;
HTML arrow entities were decoded and no LF/CRLF ending variant matched. The copy
and wrapper are retained as evidence; byte identity to the announced artifact is
not claimed. Root temporary copies were removed and the mismatch was relayed.
