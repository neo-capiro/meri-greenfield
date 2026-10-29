# Core retention serving witness

The private control listener exposes `GET /v1/internal/retention/serving-witness`
when the existing retention startup owner and Core service-secret reader are
composed. It uses the existing `x-internal-service-secret` transport credential.
It never accepts a user token, a subject, a tenant, a query string or a body.
The public listener returns 404, including when a valid service secret is sent.

A successful response is the closed content-free object
`{schemaVersion: 1, sequence, entrySha256}`. The position comes from the current
external ledger after the canonical fence verifies the recovered database
watermark. It is not inferred from a restorable Core conversation, cached in the
process, or copied into a new ledger. Responses are not cacheable. An unavailable
or unverified proof returns 503; a malformed request returns 400. The response
does not expose internal errors, subjects, retained content or credentials.

This is a snapshot, not an authorization, reservation, expiry-based permission
or lease. Core must keep its ordinary tenant, member, client and wall checks.
Its transaction must compare the witness to the canonical native watermark and
subject projection while holding the existing retention transition/recovery
exclusions, and obtain a fresh matching witness before releasing content or
committing activation. In particular, an earlier successful witness alone
cannot authorize a later write. A suppression followed by release changes the
position, even if the final subject is readable again.

The endpoint deliberately performs no recovery. A Core caller may already hold
shared recovery exclusion while obtaining its final witness; starting exclusive
reconciliation from that call would invert ownership and can deadlock. The
existing startup/readiness owner recovers first. A closed serving fence stays
closed until that owner proves recovery. Cancellation or timeout discards late
results; it does not claim that a backing-store read physically stopped.

`test/serving-witness.test.mjs` exercises the actual private route composition,
canonical startup/fence and synthetic independent restore boundary. It covers
unseen suppression after database rollback, unavailable dependencies, corrupt
watermarks, secret rotation, deadlines, disconnects and suppression/release.
These tests do not establish deployed recovery.

Canonical integration ordinal 71 adds
`meri_core_authority.retention_serving_v1(tenant, actor, conversation, sequence, hash)`.
It reuses the existing non-login `meri_core_admission_reader`, with column-only
reads of native conversation identity, suppression and recovery watermark. Core
gets EXECUTE only. The installer removes temporary schema CREATE and role
membership before commit, preserves the prior 70-entry plan, and can replay after
an uncertain phase commit. No raw native table grants are given to Core.

The predicate checks Core's current tenant, tries shared canonical transition then
recovery exclusion, verifies the watermark and native owner, and rejects a
suppressed subject. A null subject performs final watermark verification while
locks acquired by earlier subject calls remain held. Try-lock refusal prevents a
Core candidate-row holder from waiting behind a native purge calling Core cleanup.

The paired Core migration `20281029200000_memory_restore_serving` and shared
`memory/conversation-serving` transaction helper consume this predicate and the
fresh witness. Their ordinary-role PostgreSQL tests qualify suppression,
notification copies, rollback, grants and lock behavior; the Core wire integration
test consumes this actual private route/startup. Install this native phase and
endpoint before admitting the paired Core application. Coordinate Core migration
and application rollout because old Core readers cannot supply the new proof.
Source tests do not qualify deployed roles, transport or database recovery.
