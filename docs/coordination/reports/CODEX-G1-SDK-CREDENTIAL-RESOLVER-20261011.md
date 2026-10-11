# G1 SDK certificate resolver source review

**Decision: ACCEPT source-only; G1 HOLD.** The existing qualification registry
now resolves the SHA-256 fingerprint from a verified mTLS socket to exactly one
admitted grant without a new schema or migration. A run/current row and its
historical grants are read under a lock. The closed private contexts are
reconstructed from database facts; a certificate gets only its own A or B
audience. Currentness, revocation, expiry and publication remain decided by the
existing later registry transaction. A duplicate fingerprint across runs
refuses, as do unknown credentials and inconsistent rows.

Base `8c4554d70b0e4552320a9047307260846b199e1c`; shared policy
`neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`;
machine map 2026-09-30 00:21:48 UTC.

Pinned Node 24.19.0 checks: actual isolated PostgreSQL 16.15 registry suite
6/6, exit 0, including A/B fingerprint resolution, stale A audience and
cross-run duplicate refusal; separate fresh database plus real loopback TLS
1.3 mTLS A/B certificates and the same PostgreSQL resolver 1/1, exit 0.
The real mTLS flow authorized A, committed its synthetic storage receipt,
admitted B, returned exact stale A denial, authorized/loaded/verified B, and
refused late A commit before another storage preparation. `pg_ctl stop -m
fast -w` exited 0; port 55442 listener and owned pidfile were absent.

No AWS write, real certificate issuer, ECS task identity, S3 object write,
image, native SDK run, PR, merge or deployment occurred. The issuer must bind
fresh unique certificate fingerprints to observed task ARNs and admit them
through the trusted registry. The dedicated database/control task, private
network, storage and two-task lifecycle remain to be admitted. The 75 real
requests belong to the later REL-01/REL-06 benchmark, not this G1 synthetic
qualification.
