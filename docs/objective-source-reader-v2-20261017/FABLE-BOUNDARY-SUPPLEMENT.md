# Objective / Strategy / Planner boundary supplement for Fable

Sealed handoff, 2026-10-17. Fable owns all Meri source, shipping and Meri-specific
UI after this supplement. This Objective lane stops Meri edits after publishing
the supplement. Dot retains Core, shared frontend coordination and live E2E.
No source below is deployed or accepted as a coherent first-chat image.

**The PostgreSQL increment is INCOMPLETE / UNQUALIFIED. Do not mount it or run
its migration.** Every current Meri edit was preserved in Git before this seal;
there is no required machine-local source packet. The supplement's immutable
URL identifies the final documentation commit; its source parent is the exact
checkpoint listed below. The primary Meri handoff must link that URL rather
than infer a newer first-chat source from this separate branch.

## Exact published stacks

Meri branch: `feat/objective-source-custody-postgres-20261017`, draft
[PR129](https://github.com/neo-capiro/meri-greenfield/pull/129).
The source is separate from the primary owner's newer first-chat branch and
has not been received into it.

| Layer | Exact commit | Exact tree / disposition |
| --- | --- | --- |
| First-chat base, PR121 | `0d6ba1590b41e3bc911e8c50f7c7407632101832` | `76c2028796552ca20fae3a0103bcb22e1325fa0a`; base only, not the latest primary shipment |
| Frozen reader v2, PR123 | `b2f0a5d71e1c1b6a6cf79b1e9a496ad663ef641a` | `3131379c8c258e1ac02b13b71524e49028598024`; reviewed wire freeze |
| Pure source factories, PR127 | `d1512708859f97b6aa7369dfcc8dd9f6448de911` | `ca3bb8005b497e63e408d6e9de9b3ca856decdf0`; source ACCEPT, unmounted |
| Concrete splice proposal, PR129 first commit | `affcb184d731e6b1aa0b31cdbd7ca4691233f3ba` | `432a6c78b6f3541351c19d84d1f9e31197a332b3`; prose, unreceived |
| All current custody/index source | `86753ff1e1a5f228844b4c1b7efefc4b72e37531` | `6c4f696d2093bb99b26a551b6099cee4c202d61e`; REVIEWED_HOLD, incomplete/unqualified |

Core branch: `feat/objective-reader-v2-receiving-20261017`, draft
[PR66](https://github.com/neo-capiro/capiro-backend/pull/66), exact
`49f328eb8fbf797a38e9a5dc3df254eb652daa39`, tree
`371466cded927b976d91d846d1b2e7768a891c9e`.
The following ordered PR source pins are predecessors, not a merged release:

| Core PR | Exact head |
| --- | --- |
| 42 | `6d24414da975b52ab9802a883b22c868ad14fc92` |
| 49 | `db6ef0a617f4b570cadfa6e05bad7296017d0f70` |
| 50 | `5591eac08428635bf911a0aa32acea859e2a5d95` |
| 51 | `81dd0313760c0f18858cb8aa2ad73191da71f138` |
| 53 | `57f8c8047a73df6d4a73351a98a5239f38240a24` |
| 56 | `bdcb546804f35d0973603fca5e99dbd4d640953f` |
| 57 | `b05918cb7d2c3368b01415e4c40d733e100ad361` |
| 58 | `151a2ec995b95817a2f4002a7cc3dba7899d06ee` |
| 60 | `88174160e2f6d1d7a9ee45a9f3f0eaa0d0671b4f` |
| 61 | `eef7cd1b874549bc2115b313ebb00fe83e2e57da` |
| 63 | `6c97e0f993ab47d5cc5c94b8021c985b0399ef8a` |
| 64 | `806a0939267806e7481bb2bbfe260f5a5a0794c3` |
| 66 | `49f328eb8fbf797a38e9a5dc3df254eb652daa39` |

Core PR63 tree `e1c181054058c6f7c568a3405c5a220b4cac47d8` composes admission
through explicit trusted bindings, while its production provider remains
hard-disabled. PR64 tree `8ce40a9383d701f8ff28cb2dc97ef869a607c0f0` adds the
matching strict reader client/signer. PR66 adds initial-only acceptance and
retained receiving; its actual native owner/credential bindings remain absent.
Existing Strategy authority methods and delegation `enabled=false` hold remain.

## Protocol and source custody decision

The accepted choice is a **distinct Objective-only v2 Ed25519 protocol**, with
closed nested request binding and separate issuer, audience, purpose and key
pins for active source, historical source and retained result. Preserve the
existing Meri gate, historical Core RS256 and separate Temporal protocols.
There is no dual algorithm acceptance, fallback or key reuse.

Canonical wire artifact SHA256:
`d461baaaf2300aa7ffd363bc4b58295d22c437360c126884e96433e10ac16ec1`.
[CONTRACT.md](CONTRACT.md) and the frozen
`packages/contracts/objective-reader-2/reader.schema.json` own the exact envelope.
The v2 source contract is initial Strategy only; it does not authorize inventing
a Strategy type from nullable legacy input or widening regeneration semantics.

The three fixed POST routes are `/v2/internal/objective-generation/accepted-source/read`,
`/v2/internal/objective-generation/historical-source/read` and
`/v2/internal/objective-generation/retained-result/read`.
Their request body is exactly `{schemaVersion:2,purpose,generationJobId,sourceAdmissionSha256}`.
Caller binding is absent. Immutable seven-field binding derives only from the
canonical accepted request/run and genuinely ISSUED protected facts. Never
serialize `resolveFacts` or let a Core publication echo create Meri custody.

## Allocated PostgreSQL increment and exact gaps

The [central allocation](https://github.com/neo-capiro/meri-greenfield/blob/93838193c46a13b2fdda9dee9c142d1af0e60cba/docs/coordination/tasks/CODEX-PACKAGE4-CENTRAL-MIGRATION-ALLOCATIONS-20261016.md)
is commit `93838193c46a13b2fdda9dee9c142d1af0e60cba`, ledger blob
`03ad26a0c11e0a34fcc577ed568a8c8b5990cd7d`. It reserves only
`apps/runtime/objective-source/migrations/0001_objective_custody.sql`, schema
`meri_objective_source`, table `custody`, for this lane. The central owner
reported a collision-free check of 383 heads / 379 distinct tips and independent
design/scope review. This supplement does not reallocate another migration.

The SQL source has global job PK, unique issuance reverse key, canonical run and
issuance FKs, immutable private record/claim fence and claim-v1/commit-v2 guards.
The two write phases require canonical accepted-request/full-binding and actual
ISSUED metadata equality. Reads remain tenant-qualified; reverse lookup also
compares the exact binding and facts hash. CLAIMED/uncertain data confers no
authority. No read-side completion, reclaim or ordinary-chat fallback is added.

[POSTGRES-SOURCE-CHECKPOINT.md](POSTGRES-SOURCE-CHECKPOINT.md) is authoritative
for the interrupted implementation. The adapter and synthetic pool fixture were
preserved before their first import, syntax check or test. Its main test file
was not created. Known defects are missing adapter-local sticky uncertainty
after ambiguous claim commit, and missing final cancellation/deadline check
after transaction cleanup. Additional defects may remain. The row decoder's
13 passing source tests do not qualify the adapter or SQL.

Before any use, Fable must finish/review/test that code and obtain separate
approval for native PostgreSQL syntax/trigger/role/concurrency/uncertain-COMMIT
and backup/restore qualification. No SQL was executed, no role/grant or real
credential created, and no cluster or DB process started for this increment.
Retention classification/suppression/purge for the private prompt/full facts,
actual control-role/source-row-lock privileges and mounting remain unbound.

## Shared splice and coordinated interfaces

The [concrete receiving proposal](SHARED-SPLICE-PROPOSAL.md) is source-portable,
not a received or applied patch. Its exact earlier immutable publication is
`affcb184d731e6b1aa0b31cdbd7ca4691233f3ba`. No first-chat shared file changed.
Fable must accept a narrow receiving patch against its coherent primary pin
before any caller/reconstructor edit:

- `prepared-run-issuance.mjs`: decorate before immutable bindFacts, and reuse
  the same optional pair in resolveFacts. Importing the decorator back directly
  would cycle because it imports canonical parseTransport from this file.
- `prepared-run-registry.mjs`: build must use the same composed recompilation;
  a prepare-only patch breaks every Objective replay.
- `prepared-run-bindings.mjs` retireInitial and native task-router/poststart
  authorities: preserve the original pair through a durable issuance-key/full
  binding/facts lookup. Preserve expired cleanup's existing authority.
- Native remote completion composition: pass the genuine preparedFacts owner
  to completion capture; the primary source seam was still omitted at audit.

Cross-repository changes require **Fable + dot coordination** for protected
facts/pair and whole-facts hash, job-to-original-binding custody, the three
signed routes/claim schema/algorithm/purpose/key pins, strict retained decoder
and native Core credential/currentness ownership. No caller-provided selector,
receipt, Core echo or fixture credential supplies those owners.

Browser contracts stay separate: Core PR53 GET/commands/confirm-pair, PR56
current-only Planner outputs and the v2 Strategy intake contract are unchanged.
Frontend PR69/75 receivers remain default off and require normal Planner access
recheck. A fresh initial intake retry requires requested revision ID/version
equal current saved Objective revision; exact immutable receipt recovery is
checked before new-command preflight. Workload-only internals never become
browser job/output selectors. Strategy output discovery remains separate work.

## Actual qualification, without transferring results between pins

| Source | Actual evidence | Limit |
| --- | --- | --- |
| Meri PR123 frozen wire | Node24 5/5, independent exact-tree ACCEPT | Contract only |
| Meri PR127 factories | Node24 130/130; reviewer independently reran six composition cases | Synthetic credential/storage/native replies, existing matching ECS3.1151.0; no real retained object capture |
| Meri custody checkpoint | Pure decoder Node24 13/13; SQL/decoder source reasoning; whole snapshot REVIEWED_HOLD | Adapter/fixture unimported, untested; SQL/native unrun |
| Core PR63 | 116/116 + scoped strict TypeScript, independent ACCEPT | Explicit synthetic native rows; production provider disabled |
| Core PR64 | 67/67 + scoped strict TypeScript, independent ACCEPT | Genuine production credential owner absent |
| Core PR66 | 28/28 + scoped strict TypeScript; five independent positive/negative probes, ACCEPT | Synthetic native owner/HTTP/credentials; initial-only, unmounted |
| Core PR61 exact eef7cd1b | Isolated PG16.15 39/39, run `1d28b3384cae4e43a0a1c7646a3bd6b9` | Original Core source/run only; not rerun or relabeled for Meri |

Cross-factory fixture manifest SHA256 was
`6f03cc85e9c6a33ae20b00ff2bb14b5d40fb36b16aac614d899922a0f8bcdec1`.
It binds eight actual emitted Core modules and mandatory canonical Admission /
Binding parsers. The test requires an explicitly supplied fixture and refuses
to skip or replace it. A newly emitted fixture after a different source HEAD
will have a different manifest; verify the declared source/output hashes.

No AWS, image/build/archive, deployment, activation, live key/grant, migration
execution or first-chat shipping pin changed. All task-owned processes/sessions
have exited; earlier protected source checkouts and native evidence are kept.

## Fresh-machine source-only commands

Use new owner-controlled directories, sufficient disk and explicit Node24.19.
These commands retrieve and check source; they authorize no infrastructure,
DB, credential or mount. Provision existing locked dependencies under Fable's
own resource/access approvals; do not copy old machine junction targets or
invent private-registry credentials. No installation was run in this lane.

```powershell
git clone --filter=blob:none --no-checkout https://github.com/neo-capiro/meri-greenfield.git meri-objective
git -C meri-objective sparse-checkout set apps/runtime apps/artifacts apps/control apps/gateway apps/worker packages/contracts packages/runtime packages/skills packages/ui-stream packages/window-resolution docs/objective-source-reader-v2-20261017
git -C meri-objective checkout --detach 86753ff1e1a5f228844b4c1b7efefc4b72e37531
git -C meri-objective rev-parse 'HEAD^{tree}'
git clone --filter=blob:none --no-checkout https://github.com/neo-capiro/capiro-backend.git core-objective
git -C core-objective sparse-checkout set apps/api apps/api-strategy packages/shared docs/objective-strategy-core-20261017
git -C core-objective checkout --detach 49f328eb8fbf797a38e9a5dc3df254eb652daa39
git -C core-objective rev-parse 'HEAD^{tree}'
node -e "if(process.versions.node.split('.')[0]!=='24')throw Error('Node24 required');console.log(process.version)"
```

Expected trees are `6c4f696d2093bb99b26a551b6099cee4c202d61e` and
`371466cded927b976d91d846d1b2e7768a891c9e`. Fetch the immutable supplement URL
separately or check out its final documentation commit to retain this file.

Meri uses committed npm lockfiles at root and apps/runtime; Core pins pnpm9.12.0
and pnpm-lock.yaml. A separately approved fresh dependency preparation may use
`npm ci --ignore-scripts` at those two Meri roots and Core's frozen pnpm install.
For the same-checkout source qualification, Meri also needs a task-local
`apps/node_modules/@capiro/meri-contracts` link to its own `packages/contracts`
(tracked distribution included). Create that link only if absent; never
overwrite an existing install or point it at the old host. This is test source
resolution, not public package release or production dependency qualification.

With approved dependencies available, run the pure source checks only:

```powershell
Set-Location core-objective
node apps/api/node_modules/jest/bin/jest.js --config docs/objective-strategy-core-20261017/qualification/reader-v2.jest.cjs --runInBand
node apps/api/node_modules/typescript/bin/tsc -p docs/objective-strategy-core-20261017/qualification/reader-v2.tsconfig.json --noEmit
node apps/api/node_modules/jest/bin/jest.js --config docs/objective-strategy-core-20261017/qualification/reader-v2-receiving.jest.cjs --runInBand
node apps/api/node_modules/typescript/bin/tsc -p docs/objective-strategy-core-20261017/qualification/reader-v2-receiving.tsconfig.json --noEmit
$fixture = Join-Path (Split-Path (Get-Location) -Parent) 'objective-core-fixture-new'
node docs/objective-strategy-core-20261017/qualification/emit-reader-v2.cjs $fixture
$env:CORE_OBJECTIVE_V2_MODULE_DIR = $fixture
Set-Location ../meri-objective
node -e "const fs=require('node:fs'),p=require('node:path');const link=p.resolve('apps/node_modules/@capiro/meri-contracts');if(!fs.existsSync(link)){fs.mkdirSync(p.dirname(link),{recursive:true});fs.symlinkSync(p.resolve('packages/contracts'),link,process.platform==='win32'?'junction':'dir')}"
node --test packages/contracts/objective-reader-2/schema.test.mjs apps/runtime/objective-source/protected-facts.test.mjs apps/runtime/objective-source/projection.test.mjs apps/runtime/objective-source/custody.test.mjs apps/runtime/objective-source/prepared-reader.test.mjs apps/runtime/objective-source/native-authority.test.mjs apps/runtime/objective-source/reader-gate.test.mjs apps/runtime/objective-source/production-composition.int-test.mjs
node --test apps/runtime/objective-source/postgres-records.test.mjs
```

The fixture directory must be new; the emitter refuses overwrite. The adapter
test file does not exist, and no command here runs the unfinished adapter or
executes SQL. Complete that work under Fable ownership before designing and
separately approving an isolated native PostgreSQL procedure.
