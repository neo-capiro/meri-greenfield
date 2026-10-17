# Isolated PostgreSQL 16 qualification plan

**Prepared source only.** Do not run `run-isolated.ps1` until the deployment owner
approves this exact disposable local execution and the heavy process window is
free. The script initializes PostgreSQL, creates temporary credentials and
executes migration `0001_service_task_registrations.sql` against a new task-owned
database. It never targets an application or AWS database.

## Source-only verification

The issuer successor's nine focused Node 24 test files passed **100/100** on
2026-10-17, including the 8445 origin join, `/run/meri` direct-child material
paths, pending-work cleanup receipts, and registration privilege refusals.
`qualify.mjs` passed `node --check`, `run-isolated.ps1` passed PowerShell AST
parsing, and `git diff --check` passed. A manual static review checked the
exact fixed loopback target, source-head/blob gate, postmaster PID and
authenticated primary readback before SQL writes, and the owned-root cleanup
conditions. These are source checks: the local PostgreSQL qualifier remains
**UNRUN**, and no native registration or live issuer claim follows from them.

## Exact target and source closure

- Source base: Meri draft PR #126, `5a979d13dd9c3eae6a3a5fa160b5f0b4423081c4`.
- Migration Git blob: `607929b14678283f62ef4945cf350f3427ec7917`.
- Adapter Git blob: `94937b6ee0dca7d3d7d0fb0ee306ebd0604e99ba`
  (reviewed cleanup successor; repin if its final independent lifecycle review changes it).
- Installed PostgreSQL: `C:\Program Files\PostgreSQL\16\bin`, required `16.15`.
- Bundled Node: `C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`, required Node 24.
- Fresh cluster root: `C:\Users\Administrator\Documents\Codex\2026-10-16\task-3\issuer-pg16-qualification-20261017`.
- Loopback: **127.0.0.1:56457**. Database: `meri_issuer_native_qual`.
- Bound: **8 minutes**, owned cluster **400 MiB**, 2 GiB free disk before init and 1.5 GiB after startup.
- The runner requires `-ApprovedSourceHead` naming the reviewed, committed successor.
  It verifies HEAD and the on-disk Git blobs of the runner, qualifier, README,
  migration, adapter, runtime package and lock before any cluster or credential
  write. The exact head must be recorded in
  the separate execution approval after source review; a mutable branch is not
  sufficient.
- Node imports `pg` only from this checkout's frozen `apps/runtime/node_modules`.

The runtime install is currently **absent**. A separate Meri checkout was
inspected read-only
at `C:\Users\Administrator\Documents\Codex\2026-10-16\task\capiro-rebuild\repos\meri-basic-chat\apps\runtime`:
Git head `caa7810ff19c09c8f7ea1c2524c025f36f99ccd6`, package blob
`6f4bb8574be99cb7ad76028a28c42647344a6db6`, lock blob
`52c56e1c13758ea680ed23c7b908e155b5c0c91e`. Its `pg` directory is an
ordinary directory, version 8.23.1. All 14 recursive `pg` packages match the
task-owned frozen lock by version and integrity and are installed at those
versions. This is a read-only inventory; the runner does **not** import, copy, link or change
that checkout. Matching lock metadata does not prove installed file bytes.
The reviewed task-owned runtime package and
lock Git blobs at PR #126 are `aa61b0521a2c6c3b9e0f0460828a3198463c5b69`
and `b2481cede45da976b38c17aab1cb50a4368ce10a`. Subject to that separate
approval and a released heavy process window, the bounded install would use
this checkout's frozen lock and a new
task-3 cache, with all lifecycle scripts, audit and funding disabled:

```powershell
$node24 = 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$npmCli = 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js'
$previousNpmCache = $env:npm_config_cache
$env:npm_config_cache = 'C:\Users\Administrator\Documents\Codex\2026-10-16\task-3\npm-cache-issuer-pg16-qualification'
Push-Location .\apps\runtime
try { & $node24 $npmCli ci --omit=dev --ignore-scripts --no-audit --no-fund }
finally { Pop-Location; $env:npm_config_cache = $previousNpmCache }
```

This is a **plan, not an action already taken**. Recheck the
lock/package blobs, disk floor, exact task-owned cache path and another
owner's heavy process window before installing. Do not copy or link dependency
trees. If the approved frozen install is unavailable, native qualification
stays held.

Preflight checks the exact committed source head/blobs, PR ancestry, complete
ancestor reparse chain, absent cluster path and listener, binary versions,
task-owned dependency and disk floor. Only then does it
generate two disposable random passwords and run `initdb` with SCRAM on this
fresh folder. The postmaster listens on the fixed loopback address and port.
Before `createdb` or any role/migration write, an authenticated readback proves
the server's `data_directory`, address, port, database and primary status;
the listener PID must equal the new cluster's `postmaster.pid`.
The sole test database is owned by the disposable `postgres` bootstrap user.
The separate `meri_issuer_native` login is `NOINHERIT NOSUPERUSER NOBYPASSRLS
NOCREATEDB NOCREATEROLE NOREPLICATION`, is **not a member of the owner role**,
and receives CONNECT to this database, schema USAGE, table SELECT and INSERT,
and UPDATE only on `certificate_sha256`, `expires_at_ms`,
`proof_observed_at_ms`, `generation`, `updated_at`, and `revoked_at`.
No role, schema, grant, migration or credential is created outside this cluster.

## Native checks

`qualify.mjs` uses a dedicated runtime Pool for the actual adapter and a
separate owner Pool only for adversarial SQL and evidence. It checks:

1. PostgreSQL 16 primary, exact loopback/database, dedicated role attributes,
   no owner membership or SET privilege, and actual `probe()` success.
2. Runtime denial of DELETE, TRUNCATE, unauthorized UPDATE/CREATE, plus absence
   of TRIGGER, REFERENCES, database CREATE, PUBLIC ACLs and grant options.
3. Actual migration triggers refusing DELETE, TRUNCATE, immutable identity,
   skipped generation, direct SQL rotation with unchanged expiry or regressing
   proof time, and resurrection after revoke; unique certificate index.
4. Exact replay, one-winner concurrent initial registration, one-winner CAS
   renewal, stale revision refusal, irreversible revoke before or after first
   registration, and concurrent revoke versus renewal.
5. Database-clock certificate expiry, a real transaction rollback witness,
   and a synthetic lost COMMIT acknowledgment with `CLEANUP_UNKNOWN` close
   receipt followed by exact primary replay. The normal adapter close must be
   `CLEAN` with zero pending work; both PostgreSQL Pools must close successfully.

The synthetic rows contain no real task, certificate or AWS identity. The test
does not contact AWS, issue keys, call providers or exercise a live service.
The report prints case labels, pass/fail, and error codes only. A failed native
test is retained as failure evidence and cannot qualify activation.

## Invocation and cleanup

After the separate exact approval, from a PowerShell shell:

```powershell
& .\apps\runtime\temporal-issuer\qualification\run-isolated.ps1 `
  -ExecuteApprovedLocalQualification -ApprovedSourceHead <exact-reviewed-40-hex-head>
```

No native run, install or credential creation has happened for this source
packet. The runner starts the Node child hidden, bounds its execution by the remaining
eight-minute window, and runs cleanup in `finally`. It stops only the owned
cluster after checking the exact data path and recorded postmaster PID, verifies
its process, PID and 56457 listener are gone, checks every path ancestor and
the recursive target for reparse points, then removes only that disposable
root. Temporary password
files and process environment values are retired. A sanitized receipt remains
under task-3 `issuer-pg16-qualification-evidence/`; host port 5432 PID/listener
is checked for drift and never targeted. If process/port ownership cannot be
proved, data is **retained** and the run fails rather than deleting a live root.
If `pg_ctl start` fails before a postmaster PID can be established, the exact
disposable root is conservatively retained even if the failure appears clean;
inspect it and prove no owned process remains before manual disposal.

The migration deliberately creates no deployment role or grant. Production
still needs separately reviewed role membership, primary-writer connection,
backup/revocation and rollback procedures. Restoring a snapshot taken before a
revocation loses its tombstone: stop issuer tasks and reconcile the complete
revocation log before re-enabling issuance. This harness does not perform a
destructive restore or claim that native qualification approves deployment.
