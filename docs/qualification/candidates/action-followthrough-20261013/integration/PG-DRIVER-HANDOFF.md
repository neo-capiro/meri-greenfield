# Canonical PostgreSQL driver materialization

The parent explicitly authorized materializing official `pg@8.23.1` through existing allowed registry access, without new credentials. The unchanged canonical manifests at PR40 `cacbe543941db52cc8dcf085bf96c1919e8c155f` were copied to `/tmp/meri-pg-8.23.1-action-followthrough-20261013` and installed successfully with `npm ci --ignore-scripts --no-audit --no-fund`, an explicit `https://registry.npmjs.org` registry, an empty user npmrc, zero fetch retries and a20second fetch timeout. No install scripts, database driver constructor, pool, SQL, migration, image or service ran.

The exact canonical lock SHA256 is `c5ab764dcd9dcd8dee88d2cab3e7412fb9752e3a869c0a1693839c0567d3973a`; package manifest SHA256 is `e6ff93a2cfdf3ca49b19b0e40b72bf065a6b885951370b293cdcb861401629e6`. All14 installed package versions match the existing lock and retain its official registry URLs/integrity pins. Importing the actual driver succeeds with version8.23.1 and exported Pool constructor. The lockfile is byte-identical after installation. Package versions/licenses and exact commands/raw output are in the adjacent `pg-materialization*` receipts. The install's only stderr output is an npm update notice; no npm upgrade was performed.

The temporary dependency directory is intentionally retained as this environment's materialized driver, with no processes running. It is not committed or silently linked into another owner's checkout. Other environments should reproduce from the published canonical manifests rather than depend on this absolute path:

```sh
npm ci --prefix apps/control/qualification-sdk-fixture/state --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org --fetch-retries=0 --fetch-timeout=20000
```

Run that command only in the owner-controlled checkout admitted for execution, using its existing registry access. The driver anchor used by PR40 is `apps/control/qualification-sdk-fixture/state/package.json`; Node must resolve the pinned driver from that anchor. Do not add credentials or change dependency versions to work around an install failure. Existing application manifests/lockfiles require no changes.

PR40's portable executable contract remains [`scripts/local-action/README.md`](../../../../../../scripts/local-action/README.md), with the exact private admission fields in its unusable-until-filled `input-template.json`. The fixture owner already has the real database workstream; no duplicate fixture gate is introduced here. Its admission identity, existing finite lifetime, bounded process supervisor and cleanup responsibility remain authoritative. Driver availability alone does not admit a connection, apply migrations, prove the six PostgreSQL cases or close G1.
