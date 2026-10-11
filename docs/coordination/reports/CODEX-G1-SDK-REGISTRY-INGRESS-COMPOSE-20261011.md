# G1 SDK fixture registry/ingress composition review

Codex source decision: **ACCEPT the bounded service composition; G1 HOLD**.
Base `b5d591f4d13114400317d9b26bc0e008fbe35292`; shared policy
`neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`,
machine map 2026-09-30 00:21:48 UTC. This is a local-only source candidate.

The new `service/` boundary maps the four fixed private ingress operations to
the existing `FixtureRegistry` and an explicitly supplied trusted checkpoint
storage port. Authorization uses PostgreSQL's after-lock time and current
grant/fence. A stale A denial includes B's full canonical context only after
the service proves it matches the locked current row. Commit reauthorizes A
before object preparation and publishes the independently reread receipt under
the current A fence. A lost COMMIT acknowledgement gets one read-only receipt
identity reconciliation, never a replay. B load and verify select the
registry's committed reference, check the stored receipt/bytes, and recheck
current authorization after object I/O before returning the result.

The state registry now returns its trusted after-lock `checkedAtMs` with an
authorization decision. The synthetic certificate generator and loopback
harness add a second distinct trusted client certificate, so test A and B
credentials are actually different at the TLS socket.

## Verification and boundaries

- Pinned Node 24.19.0 ingress plus service unit suites: 34/34, exit 0.
- Real loopback TLS 1.3 mTLS plus isolated PostgreSQL 16.15 source test: 1/1,
  exit 0 on the first service database, then 6/6 combined service cases on a
  fresh second database. A commits, B replacement revokes A, exact A receives
  typed stale denial, B authorizes/loads/verifies, and wrong peer/substituted
  current context/late A commit refuse. The late commit causes no second
  synthetic storage preparation.
- Existing registry transactions: 5/5, exit 0 on a third fresh isolated
  database after applying the allocated migration. These include ambiguous
  commit readback, after-lock expiry and immutable row guards.
- The service storage port in these tests returns synthetic receipt and bytes.
  No real S3 object version, readback, ECS certificate issue, image scan/build,
  Fargate replacement, native SDK recovery or physical task revocation ran.
  The result cannot close G1 or support a durability claim.

The source commit is `b1fbc8643d07f7906c52b67f083fa3c4c9db1885`.
On that exact commit, the combined ingress/service unit/real PostgreSQL suite
passed 35/35, exit 0, against a fourth fresh isolated database. The test
cluster was under ignored `.task-inputs/sdk-service-pg-1/` on loopback port
55441. `pg_ctl stop -m fast -w` exited 0; a subsequent process and port
readback found no owned PostgreSQL process or listener. The worktree was clean
after the source commit. No AWS, provider, source-data, PR, merge or deployment
side effect occurred.
