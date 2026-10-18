# D2: Stage 1 database (first-chat preview)

Branch `fable/meri-d2-grants-20261017`, cut from integration `5fbd6c06`. Status: **source**. The SQL has not been run against any PostgreSQL. Nothing below has been created in AWS.

Files:

- `infra/product-preview/first-chat-database.sql`: one psql script with four phases (`bootstrap`, `meri_grants`, `temporal_grants`, `release`).
- `infra/product-preview/first-chat-migrate.mjs`: the one-shot runner (`plan`, `meri`, `temporal`).
- `infra/product-preview/first-chat-seed-budget.sql`: the D1 budget seed.
- `infra/product-preview/first-chat-database.test.mjs`: offline tests (18).
- `apps/runtime/Dockerfile`: one added `COPY` line, so the next Node runtime image contains the three files above.

`node infra/product-preview/first-chat-migrate.mjs plan` prints every pinned path and sha256. The sha256 of `first-chat-database.sql` is the value for `database.grantsSha256` in the Temporal binding (`temporal-binding.mjs` requires a 64-hex value but pins no file).

## Why the script has phases

Table grants and guard triggers can only run after the tables exist. Two migrations also run `CREATE SCHEMA` without `IF NOT EXISTS` (budget `0001`, issuer `0001`), so the bootstrap cannot pre-create those schemas. The order is therefore:

1. **bootstrap** (admin): roles, CONNECT, temporary CREATE on `capiro` for the schema owner, the ledger, the Temporal databases and `btree_gin`.
2. **ordered migrations and seed**: run by the runner, each as `meri_product_migrator`.
3. **meri_grants** (admin, acting as the schema owner): guards, grants and a privilege readback.
4. `temporal-sql-tool` applies both Temporal schemas as `meri_temporal_migrator`.
5. **temporal_grants** (admin, acting as the Temporal owner): checks the catalog, grants, then disables the Temporal migrator login.
6. **release** runs at the end of every runner invocation. It revokes the admin's temporary SET memberships and the schema owner's CREATE on `capiro`.

## What it creates

### Roles

All roles are `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`, marked with `COMMENT ON ROLE … 'meri-first-chat-d2'`, and members of no role. Passwords reach the script only as psql variables. The runner turns each one into a SCRAM-SHA-256 verifier before it is sent.

| Role | LOGIN | Used by | Secret (proposed name; JSON keys `username`, `password`) |
|---|---|---|---|
| `meri_product_migrator` | no | Owns `meri_conversations`, `meri_product_budget`, `meri_service_identity`, `meri_migration_ledger`. The admin reaches it with a temporary `SET`-only membership. | none |
| `meri_control_runtime` | yes, limit 20 | `meri-product-preview-control` (`database.connectionFile` in the control bundle) | `meri/product-preview/db/control` |
| `meri_model_budget_owner` | yes, limit 20 | `meri-product-preview-owner` (`apps/proxy/product/owner-entrypoint.mjs` database file) | `meri/product-preview/db/model-owner` |
| `meri_temporal_issuer_service` | yes, limit 4 | `meri-product-preview-temporal-issuer` (`registrationRole` must equal this name) | `meri/product-preview/db/temporal-issuer` |
| `meri_temporal_primary_runtime` | yes | the five Temporal role services: `POSTGRES_USER`/`POSTGRES_PWD` from `database.primarySecretVersionArn` | `meri/product-preview/db/temporal-primary` |
| `meri_temporal_visibility_runtime` | yes | the same five services: `VISIBILITY_POSTGRES_USER`/`VISIBILITY_POSTGRES_PWD` | `meri/product-preview/db/temporal-visibility` |
| `meri_temporal_migrator` | yes until `temporal_grants`, then NOLOGIN | the one-shot `temporal-sql-tool` task only | `meri/product-preview/db/temporal-migrator` |

Passwords must be 32–128 characters from `[A-Za-z0-9._~-]` and all distinct, so the services' `?sslmode=verify-full` URIs need no escaping. For control, owner and issuer, each service's material bundle carries `postgresql://<role>:<password>@<writer>:5432/capiro?sslmode=verify-full`, built from the same secret version. The runner also uses the existing Aurora admin secret.

### Schemas and objects on `capiro`

- `meri_conversations`, `meri_product_budget` and `meri_service_identity` are created by the migrations, owned by `meri_product_migrator`, with PUBLIC revoked.
- `meri_migration_ledger.applied(ordinal, name, sha256, applied_at, applied_by)` records each migration and phase.
- Guard functions are `meri_conversations.reject_lock_column_update()` and `meri_product_budget.reject_lock_column_update()`. The eight statement-level `BEFORE UPDATE OF <column>` triggers come from `EXISTING-DATABASE-GRANTS-20261016.md`.
- Grants are exactly the proposal's four first-chat blocks (control store, control SDK/selected, control allocation/tenant, model owner) plus the issuer grants in its migration comment. The optional retention block is **not** granted, and neither are `tool_reservations` and `tool_invocations`. Column-level UPDATE is used wherever the proposal specifies it.
- `GRANT CONNECT ON DATABASE capiro` goes to the three Meri logins. PUBLIC, Core grants and `capiro`'s `public` schema are not touched.
- Seed: `meri_product_budget.budget(id=1, cap_micro_usd=25000000, consumed_micro_usd=0, quarantined=false)`.

### Temporal

- Databases `temporal` and `temporal_visibility` (template0, UTF8), owned by the admin and marked with a comment. PUBLIC has no access to either database or its `public` schema.
- `meri_temporal_migrator` gets CONNECT plus USAGE and CREATE on `public` in both. Each runtime login gets CONNECT plus USAGE on its own database only.
- `btree_gin` is installed in `temporal_visibility` by the admin.
- After schema application, `temporal_grants` refuses unless:
  - the `public` catalog is exactly the reviewed 37 primary tables plus `schema_version` and `schema_update_history`, and the only sequence is `buffered_events_id_seq`;
  - visibility holds exactly `executions_visibility` and the two schema tables;
  - `schema_version` reads `1.19` and `1.14`, and the migrator owns everything.

  It then grants the proposal's Temporal blocks.

## Order of operations

The ledger order is the change set's: conversations `0001–0011, 0013, 0015, 0016, 0017` (0012 and 0014 held), budget `0001_product_budget`, `0002_tenant_budgets`, issuer `apps/runtime/temporal-issuer/migrations/0001_service_task_registrations.sql` (blob `607929b1…`), seed, `#meri_grants`, `#temporal_grants`.

Runner rules:

- The pinned sha256 of every file is checked before connecting.
- One session advisory lock is held for the whole run.
- Each migration runs in one transaction: `SET LOCAL ROLE meri_product_migrator`, the body (one outer `BEGIN;…COMMIT;` wrapper is stripped), the ledger row, then `COMMIT`.
- Applied, unchanged files are skipped. A changed applied file, a ledger gap or an unknown row is refused before bootstrap. A file that contains `SET ROLE`, `RESET ROLE` or extra transaction control is refused.
- `release` always runs at the end.

## One-shot Fargate runs

Prerequisites, all outside Stage 1 as written:

- a migrator security group with an Aurora 5432 ingress rule on `sg-059b4e4de0b1dcca5`;
- an execution role with `secretsmanager:GetSecretValue` (plus `kms:Decrypt`) on the seven secrets below, ECR pull and logs;
- the log group `/meri/product-preview/migrate`;
- the six new login secrets;
- the RDS CA secret;
- a Node runtime image built from this commit or later (N3).

N2 (`d375d43d`) and `6617b236…` do **not** contain the runner. Every other input already exists in the image (`apps/**/migrations`, `pg` 8.23.1 under `apps/runtime/node_modules`).

### A. `meri` stage (Meri Node runtime image)

```json
{
  "family": "meri-product-preview-d2-migrate",
  "requiresCompatibilities": ["FARGATE"], "networkMode": "awsvpc", "cpu": "256", "memory": "512",
  "runtimePlatform": {"operatingSystemFamily": "LINUX", "cpuArchitecture": "X86_64"},
  "executionRoleArn": "<migrate execution role>",
  "volumes": [{"name": "run-meri"}],
  "containerDefinitions": [{
    "name": "d2-migrate", "essential": true, "user": "1000:1000", "readonlyRootFilesystem": true,
    "image": "967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:<N3 digest>",
    "mountPoints": [{"sourceVolume": "run-meri", "containerPath": "/run/meri"}],
    "entryPoint": ["/bin/bash", "-c"],
    "command": ["set -euo pipefail; umask 077; printf '%s' \"$MERI_D2_RDS_CA_PEM\" > /run/meri/rds-ca.pem; unset MERI_D2_RDS_CA_PEM; printf '%s  /run/meri/rds-ca.pem\\n' \"$MERI_D2_RDS_CA_SHA256\" | sha256sum -c - >/dev/null; exec node infra/product-preview/first-chat-migrate.mjs \"$MERI_D2_STAGE\""],
    "environment": [
      {"name": "MERI_D2_STAGE", "value": "meri"},
      {"name": "PGHOST", "value": "capiro-dev-data-auroracluster23d869c0-ltmz40k47ewv.cluster-csryw28ai752.us-east-1.rds.amazonaws.com"},
      {"name": "PGPORT", "value": "5432"}, {"name": "PGDATABASE", "value": "capiro"},
      {"name": "PGSSLMODE", "value": "verify-full"}, {"name": "PGSSLROOTCERT", "value": "/run/meri/rds-ca.pem"},
      {"name": "MERI_D2_RDS_CA_SHA256", "value": "<sha256 of the exact secret string>"}
    ],
    "secrets": [
      {"name": "PGUSER", "valueFrom": "<Aurora admin secret ARN>:username::<VersionId>"},
      {"name": "PGPASSWORD", "valueFrom": "<Aurora admin secret ARN>:password::<VersionId>"},
      {"name": "MERI_D2_CONTROL_PASSWORD", "valueFrom": "<db/control ARN>:password::<VersionId>"},
      {"name": "MERI_D2_MODEL_OWNER_PASSWORD", "valueFrom": "<db/model-owner ARN>:password::<VersionId>"},
      {"name": "MERI_D2_ISSUER_PASSWORD", "valueFrom": "<db/temporal-issuer ARN>:password::<VersionId>"},
      {"name": "MERI_D2_TEMPORAL_MIGRATOR_PASSWORD", "valueFrom": "<db/temporal-migrator ARN>:password::<VersionId>"},
      {"name": "MERI_D2_TEMPORAL_PRIMARY_PASSWORD", "valueFrom": "<db/temporal-primary ARN>:password::<VersionId>"},
      {"name": "MERI_D2_TEMPORAL_VISIBILITY_PASSWORD", "valueFrom": "<db/temporal-visibility ARN>:password::<VersionId>"},
      {"name": "MERI_D2_RDS_CA_PEM", "valueFrom": "<RDS CA secret ARN>:rdsCa::<VersionId>"}
    ],
    "logConfiguration": {"logDriver": "awslogs", "options": {"awslogs-group": "/meri/product-preview/migrate", "awslogs-region": "us-east-1", "awslogs-stream-prefix": "d2"}}
  }]
}
```

Run it with `aws ecs run-task --cluster capiro-dev --launch-type FARGATE --platform-version 1.4.0 --network-configuration 'awsvpcConfiguration={subnets=[subnet-0920665f91c905f01,subnet-0e38bd390f8961fef,subnet-06db79cd21239de19],securityGroups=[<migrator SG>],assignPublicIp=DISABLED}'`.

There is no task role, because the runner calls no AWS API. Logs are JSON lines (`ledger`, `phase`, `applied`, `skipped`, `complete`). ALTER ROLE lines are logged as `PASSWORD <redacted>`. Exit code 0 is success.

### B. Temporal schemas (`temporal-sql-tool`)

Run `temporal-sql-tool` from the pinned admin-tools image `temporalio/admin-tools@sha256:4fdaf9122f8beb448c823976232f6616a8cd94687f6984eeaf25c2b1457d5fed`. That is 1.32.1, linux/amd64, source `af08a5e5`, the digest in `temporal-migration-plan.mjs`. It carries the matching `schema/postgresql/v12` trees. Mirror it into a Meri ECR repository first (a new resource). Use the same SG, subnets and execution role as task A, without a mount.

```sh
set -eu; umask 077
printf '%s' "$MERI_D2_RDS_CA_PEM" > /tmp/rds-ca.pem
S=/etc/temporal/schema/postgresql/v12
temporal-sql-tool --db temporal setup-schema -v 0.0
temporal-sql-tool --db temporal update-schema -d "$S/temporal/versioned"
temporal-sql-tool --db temporal_visibility setup-schema -v 0.0
temporal-sql-tool --db temporal_visibility update-schema -d "$S/visibility/versioned"
```

- Environment: `SQL_PLUGIN=postgres12`, `SQL_HOST=<writer>`, `SQL_PORT=5432`, `SQL_USER=meri_temporal_migrator`, `SQL_TLS=true`, `SQL_TLS_CA_FILE=/tmp/rds-ca.pem`, `SQL_TLS_ENABLE_HOST_VERIFICATION=true`, `SQL_TLS_SERVER_NAME=<writer>`.
- Secrets: `SQL_PASSWORD` ← `db/temporal-migrator:password`, and `MERI_D2_RDS_CA_PEM`.
- Confirm the flag and env names and the schema path with `temporal-sql-tool --help` and `ls /etc/temporal/schema` in that exact image before the run; they were not executed here.
- `setup-schema -v 0.0` is for the first run only. `update-schema` re-applies nothing below the recorded version.

Task A must have run first: it creates the databases and gives this login LOGIN and CREATE on `public`.

### C. `temporal` stage

This is task A with `MERI_D2_STAGE=temporal`. It refuses unless every `meri`-stage ledger row is present. It re-runs the idempotent bootstrap, applies `#temporal_grants` and releases. Afterwards `meri_temporal_migrator` is NOLOGIN; re-running stage `meri` restores it for a reviewed upgrade.

### Read-only checks after C (admin, `capiro`)

```sql
SELECT ordinal, name, sha256, applied_at FROM meri_migration_ledger.applied ORDER BY ordinal;  -- needs SET ROLE meri_product_migrator
SELECT rolname, rolcanlogin, rolinherit, rolsuper, rolbypassrls, rolcreaterole, rolconnlimit FROM pg_roles WHERE rolname LIKE 'meri\_%' ORDER BY 1;
SELECT roleid::regrole, member::regrole, admin_option, inherit_option, set_option, grantor::regrole FROM pg_auth_members WHERE roleid::regrole::text LIKE 'meri\_%' OR member::regrole::text LIKE 'meri\_%';
SELECT datname, datacl FROM pg_database WHERE datname IN ('capiro','temporal','temporal_visibility');
SELECT * FROM meri_product_budget.budget;  -- as the owner
```

## Rollback (drops only the new objects)

First stop every Meri and Temporal service (desired count 0) so that no session holds the Temporal databases. Then run as the admin on `capiro`. Core tables, `capiro`'s PUBLIC ACL and `public` schema, and every existing role are untouched. No restore is needed.

```sql
\set ON_ERROR_STOP on
-- Refuse if anything outside the Meri schemas references them (expected: zero rows; no other role has USAGE).
SELECT c.conrelid::regclass AS foreign_dependent FROM pg_constraint c JOIN pg_class t ON t.oid = c.confrelid
 WHERE t.relnamespace::regnamespace::text IN ('meri_conversations','meri_product_budget','meri_service_identity','meri_migration_ledger')
   AND c.connamespace::regnamespace::text NOT IN ('meri_conversations','meri_product_budget','meri_service_identity','meri_migration_ledger');
DROP DATABASE IF EXISTS temporal;
DROP DATABASE IF EXISTS temporal_visibility;
GRANT meri_product_migrator TO CURRENT_USER WITH INHERIT FALSE, SET TRUE;
SET ROLE meri_product_migrator;
DROP SCHEMA IF EXISTS meri_conversations, meri_product_budget, meri_service_identity, meri_migration_ledger CASCADE;
RESET ROLE;
REVOKE CONNECT ON DATABASE capiro FROM meri_control_runtime, meri_model_budget_owner, meri_temporal_issuer_service;
REVOKE CREATE ON DATABASE capiro FROM meri_product_migrator;
REVOKE meri_product_migrator FROM CURRENT_USER;
REVOKE meri_temporal_migrator FROM CURRENT_USER;
DROP ROLE IF EXISTS meri_control_runtime, meri_model_budget_owner, meri_temporal_issuer_service,
 meri_temporal_primary_runtime, meri_temporal_visibility_runtime, meri_temporal_migrator, meri_product_migrator;
```

`CASCADE` stays inside the four schemas, which only the Meri owner can reach. Delete the six login secrets afterwards, with a recovery window.

## Findings that affect shipping

1. **The issuer probe will refuse on Aurora.**
   - In PostgreSQL 16, a non-superuser `CREATEROLE` admin (the Aurora master) is automatically recorded as an ADMIN-only member of every role it creates. The row's grantor is the bootstrap superuser (`rdsadmin`), so the master cannot revoke it.
   - `service-task-registration-pg.mjs` (`role_membership`) refuses **any** `pg_auth_members` row that names the issuer role. Its isolated qualification created the role as a true superuser, which records no such row.
   - Expect issuer readiness `unavailable` until the probe accepts that one row: `roleid` = issuer, `admin_option`, no `inherit_option`, no `set_option`, grantor = bootstrap superuser. This is a source change in the issuer, not made here.
2. **There is no tenant policy row.** Control admission goes through `tenant/native-admission.mjs`, which refuses with `TENANT_BUDGET_UNCONFIGURED` unless `meri_product_budget.tenant_budgets` has a row for the tenant. Stage 1 seeds only `budget id=1`. Before the first prompt, an operator-reviewed INSERT (tenant id, `monthly_cap_micro_usd`, `max_concurrent_runs`) is needed as `meri_product_migrator`. The values are not decided by D1.
3. **The Node services cannot verify the RDS certificate as configured.** Control, owner and issuer accept only `?sslmode=verify-full` in their URIs, so `pg` verifies against Node's default CA store, which lacks the RDS CA. Their task definitions need `NODE_EXTRA_CA_CERTS` pointing at the RDS bundle, or TLS will fail. Temporal already pins `rdsCa`.
4. **The runner is not in any built image.** The image builds `COPY apps` and `COPY packages` only. This branch adds one `COPY` line to `apps/runtime/Dockerfile`, so Stage 1 needs a Node image built from this commit (N3).
5. **Stage ordering.** The one-shot task needs a migrator SG with Aurora ingress, an execution role, a log group and the login secrets. The change set places all of these in Stage 2, after Stage 1.
6. **Credentials.** The change set's "dedicated migrator credential" is replaced by the admin login plus a NOLOGIN owner role reached through a temporary SET membership. `temporal-sql-tool` cannot `SET ROLE`, so `meri_temporal_migrator` is a sixth LOGIN, disabled after use. The change set counts five logins.
7. **Logins versus privilege roles.** The grants packet proposed NOLOGIN privilege roles with separate logins. As instructed, the three Meri roles are LOGIN roles directly.
8. **Temporal catalog equality is strict.** If the pinned versioned migrations leave a legacy table that is absent from the reviewed 37, `temporal_grants` refuses and grants nothing. That is safe, but the catalog then needs review.
9. Retention (`meri_artifacts`, watermark) and source-tool tables get no grants. Control's `retention` config must stay unset, and `sourceEnabled` false.
