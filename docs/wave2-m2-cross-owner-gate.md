# Cross-owner management source gate

This is an explicit root-run, synthetic, disposable PostgreSQL 16 test. It is not a product composition or deployment recipe. R has syntax-checked the harness and has not executed a database. Use a fresh database in an isolated Linux network namespace listening only on `127.0.0.1`; do not use any ambient database URL or a Windows native client.

Core is pinned to commit `eb0894f8a08063819476674fd183413f96e12352`, tree `c8c46303328b573b71c181b5a1f48ea693960578`. `apps/runtime/test/management-core-pin.json` records the exact Git blob SHA256s. Read from a clean Linux checkout with LF Git blob bytes. Never normalize bytes to make a hash pass. This deliberately revised pin includes U's baseline bootstrap-guard repair. The original baseline migration remains unchanged; the forward General migration recognizes and repairs its exact known guard. Root must rehearse the complete pinned stack.

Required source:

- Meri repository at this checkpoint, its existing runtime and contracts dependencies, and all imports of `apps/runtime/test/conversation-management-cross-owner-pg.mjs`.
- Core's pinned `apps/api/src/meri/conversation-management/{service,contract}.ts`, `apps/api/src/prisma/prisma.service.ts`, full `apps/api/prisma/schema.prisma`, and the three migrations named in the pin file. Use the pinned repository manifests/lock and existing shared package build for TypeScript resolution.
- Generated Prisma client from that exact full schema. No copied or mocked Prisma metadata/CAS function is used. The fixture's small pre-migration tables contain only synthetic data and the columns queried by these functions.

In the isolated Core checkout, install/build dependencies with its existing pnpm lock and generate the client. A synthetic explicit URL can be supplied to `prisma generate` if its configuration parser requires one; generation does not execute a migration. Compile the narrow source graph, for example from `apps/api`:

```sh
pnpm exec prisma generate --schema prisma/schema.prisma
pnpm exec tsc --target ES2022 --module Node16 --moduleResolution Node16 \
  --experimentalDecorators --emitDecoratorMetadata --esModuleInterop --skipLibCheck \
  --rootDir src --outDir .wave2-management-build \
  src/meri/conversation-management/service.ts src/prisma/prisma.service.ts
```

The harness dynamically imports `.wave2-management-build/meri/conversation-management/service.js` and `.wave2-management-build/prisma/prisma.service.js`. These are test preparation outputs only. Production imports no test bridge.

Create a fresh database named `wave2_m2_management_` followed by 8–32 lowercase hexadecimal characters. The harness refuses an existing Core `tenants` table or Meri schema. It applies `management-pg-fixture.sql`, then canonical Core migrations `20281016020000`, `20281023010000`, `20281023020000`, then canonical Meri migrations `0001`–`0011`, `0013`, `0016`, `0017`, `0020` (the exact filenames are in `management-pg-fixture.mjs`). It does not run the full Core product migration history. No migration or fixture guard is disabled.

Config contains exactly these intended values (use the task-owned port/database):

```json
{
  "url": "postgresql://postgres@127.0.0.1:5432/wave2_m2_management_0123abcd",
  "coreRoot": "/work/core-eb0894",
  "coreCommit": "eb0894f8a08063819476674fd183413f96e12352",
  "coreTree": "c8c46303328b573b71c181b5a1f48ea693960578"
}
```

Run from the Meri checkout:

```sh
node apps/runtime/test/conversation-management-cross-owner-pg.mjs --config /work/synthetic-management.json
```

Exit 0 and the final PASS receipt are required. Preserve full output and exact source/build pins. The runner closes its Prisma client and pool in `finally`; root owns disposal of the isolated database/container. It intentionally leaves synthetic rows for inspection on failure, rather than attempting deletion through production immutability guards.

Checks use the actual Core metadata/CAS/idempotency functions and tenant-scoped Prisma service, actual Meri advisory/row locks, PostgreSQL retention journal, and canonical suppression owner. The external ledger sink is synthetic in-memory storage. Cases include real Trash FK insertion while management holds `FOR NO KEY UPDATE`, an unknown response after committed Core mutation, exact replay, restore/re-Trash with an obsolete restore request, archive racing a pre-issued input, restore admission, terminal history and active successor, empty draft refusal, and history release contending with management.

The baseline Meri `0009` database index currently requires unique conversation-wide writer fences. The scripted test also exercises repeated per-run fence values; the native fixture preserves the actual index and uses fences 1 and 2. It does not silently remove that schema constraint. Incoming S2's session borrower change is separate and remains unmerged into this pinned candidate.

New admission paths use `postgres-store`'s conversation advisory lock, including initial input, next run, native preparation and lifecycle; the initial binding journal independently uses the same key. Existing retention row deletion uses its own retention subject/recovery lock, not this conversation advisory lock. The `FOR NO KEY UPDATE` row lock still conflicts with physical DELETE/UPDATE, so no deletion safety claim relies solely on the advisory lock. Full transcript/Core-row finalization is not implemented by this gate.
