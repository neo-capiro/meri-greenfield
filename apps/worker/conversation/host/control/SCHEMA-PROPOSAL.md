# Host control persistence proposal — unallocated, unapplied

This is an exact source handoff to the **control/migration owner**. No product migration ID or database role has been allocated to this lane. Do not deploy the adapter until that owner reconciles these tables with the canonical admitted-run and certificate lifecycle schemas, assigns the migration, grants narrowly scoped roles, and proves PostgreSQL transaction behavior. The source in `postgres-store.mjs` executes only the three fixed statements below through a borrowed acknowledged write transaction; it creates no schema or pool.

```sql
CREATE SCHEMA meri_host_control;
REVOKE ALL ON SCHEMA meri_host_control FROM PUBLIC;

CREATE TABLE meri_host_control.host_allocations (
  host_id uuid NOT NULL,
  generation bigint NOT NULL CHECK (generation > 0),
  tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 128),
  conversation_id uuid NOT NULL,
  allocation_json jsonb NOT NULL,
  allocation_sha256 char(64) NOT NULL CHECK (allocation_sha256 ~ '^[0-9a-f]{64}$'),
  host_identity_json jsonb NOT NULL,
  host_identity_sha256 char(64) NOT NULL CHECK (host_identity_sha256 ~ '^[0-9a-f]{64}$'),
  client_cert_sha256 char(64) NOT NULL CHECK (client_cert_sha256 ~ '^[0-9a-f]{64}$'),
  client_dns_name text NOT NULL,
  client_cert_not_after_ms bigint NOT NULL,
  credential_revision bigint NOT NULL CHECK (credential_revision > 0),
  lease_deadline_ms bigint NOT NULL,
  state text NOT NULL CHECK (state IN ('active','revoked','quarantined','terminated')),
  PRIMARY KEY (host_id, generation),
  CHECK (client_cert_not_after_ms <= lease_deadline_ms)
);

CREATE TABLE meri_host_control.request_nonces (
  host_id uuid NOT NULL,
  generation bigint NOT NULL,
  nonce_sha256 char(64) NOT NULL CHECK (nonce_sha256 ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (host_id, generation, nonce_sha256),
  FOREIGN KEY (host_id,generation) REFERENCES meri_host_control.host_allocations(host_id,generation)
    ON DELETE RESTRICT
);
```

`allocation_json` and `host_identity_json` are immutable for a host generation. The control owner must enforce immutability with a restricted writer or trigger. `state` is one-way away from `active`; it cannot return to `active` for this host generation. Certificate rotation, if needed, atomically compares and advances `credential_revision`, current DER fingerprint, DNS SAN and not-after time under the host row lock. A revoked fingerprint cannot be reused. The exact DER fingerprint and not-after time must describe the **same issued certificate**; the issuer/row writer must verify that invariant before COMMIT. The certificate subject has only the host-specific DNS SAN, chains to the reviewed client CA, is valid for at most 900 seconds and expires no later than the host allocation. The host image and boot/instance identity are pinned by the immutable JSON and checked again by the adapter.

The canonical run/attempt/worker/fence/tenant/client/policy state remains in its existing owner, not a second currentness table. The control owner implements `readCanonicalRun(client,{allocation,binding,signal})` on the **same PostgreSQL client and transaction**. It must lock the canonical run row, recheck exact full RunBinding and current task/generation, cancellation/quarantine/lease, and derive from the persisted effective policies:

```js
{
  binding,                    // full current RunBinding, not the presented copy
  browserPolicySha256,        // canonical effective browser policy digest
  capabilityPolicySha256,     // canonical effective SDK capability policy digest
  sdkAdmitted,                // active isolated SDK execution, including browser-only
  browserAdmitted,            // false while BROWSER_ACTIVATION is held
  bashAdmitted,               // true only for the separately admitted sandboxed Bash path
  phase: 'active',
  currentUntilMs             // persisted current run/attempt/grant cutoff
}
```

The adapter chooses the digest and admission flag by the fixed, trusted `sdk`, `browser` or `bash` purpose in the mTLS request. It does not accept the presented digest as stored authority. Each successful read takes the host row `FOR SHARE`, calls that canonical locked reader, inserts the SHA-256 of a fresh 256-bit nonce with `ON CONFLICT DO NOTHING`, then takes `clock_timestamp()` from PostgreSQL and clips `currentUntilMs` to the run cutoff, host allocation, current certificate and source `maxLeaseMs` (at most 30 seconds). Only an acknowledged COMMIT releases the signed-transport response. A replayed nonce, uncertain COMMIT, stale credential, inactive purpose or contradictory row yields no receipt. `request_nonces` stay until the host has a verified terminal teardown and the certificate has expired; there is no early replay-window purge.

All lifecycle writers that revoke/replace a run or certificate must use the same canonical transaction/lock order as this reader (host row, then canonical run row, then nonce insertion) or have an explicitly reviewed deadlock retry/uncertain-outcome policy. Do not share the transaction client with a different connection or return a cached boolean. Revoke/cancel updates and a currentness read must serialize on their persisted rows. The transaction owner must bound connection, lock and statement time, reject or evict on unknown BEGIN/COMMIT/ROLLBACK, and never turn an uncertain commit into a positive receipt. Read-only database roles should receive no mutation grant on the host allocation; the currentness service needs row-read permission and nonce insert only, plus the narrowly scoped canonical run reader. Credential writer and host lifecycle roles are separate. No DB role, migration, pool or live credential was created here.
