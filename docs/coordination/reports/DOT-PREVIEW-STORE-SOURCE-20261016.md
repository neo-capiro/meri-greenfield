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
