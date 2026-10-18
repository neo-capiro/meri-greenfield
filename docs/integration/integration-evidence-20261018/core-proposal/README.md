# Core history native identity proposal — approval required

**Proposal only. Production middleware is unchanged and the history batch remains unmounted.** Base: `neo-capiro/capiro-backend` commit `78ceaf9bdfe00c8f013aac15eb8483312ae4f803`. This packet reuses its existing parser, JCS hash, selected-client leaf, repeatable-read transaction option and batch owner.

## Concrete approval scope

Target: [`apps/api/src/tenant/tenant-context.middleware.ts`](https://github.com/neo-capiro/capiro-backend/blob/78ceaf9bdfe00c8f013aac15eb8483312ae4f803/apps/api/src/tenant/tenant-context.middleware.ts). Its header says:

> Do NOT modify this file (or anything touching Clerk auth, the tenant-context middleware, JWT/session handling, Microsoft Graph OAuth, the Clerk webhook, or integration connection/token persistence) without EXPLICIT prior approval from Neo.
>
> Investigate read-only and PROPOSE first; wait for go-ahead before editing, merging, or deploying.

The proposed `tenant-context.patch` is **65 additions / 2 deletions** in that one file:

- Supply the two existing batch-native interface methods: lock the original request's user, tenant and exact selected membership on the caller transaction; then make a **new** original-session Clerk observation and read the existing identity predicate through that same transaction.
- Add a private exact-native history-target/provenance guard. The new first slice refuses marked tokens, impersonation and alternate membership selection. Existing ordinary authority and impersonation behavior stay intact.
- Let the existing private identity reader receive that transaction; its default still uses the existing system transaction owner.
- Add the two exact history-release spellings to the **pre-auth response no-store list**. This is not a credential admission list. `MERI_CONTROL_POST_PATHS` is unchanged; marked credentials remain rejected before local DB work on history-release.

This approval scope does not mount a route, alter Clerk, admit another token class, change the ordinary authentication/provisioning pipeline, create a credential/grant or authorize a migration/deployment/chat attempt. Ordinary `use()` still has its existing provisioning/self-heal/lastSeenAt behavior; a future route is not being represented as a new read-only admission path.

## Reproduce offline in isolated scratch

Requirements: Node24 (recorded `24.19.0`), Git, and **TypeScript5.9.3** already available in a normal local `node_modules` resolution location or supplied explicitly. No install, global compiler discovery, network fetch or credential is performed. This packet bundles only eight necessary immutable Core files (about104KiB); each is pinned by Git blob and SHA256 in `source-manifest.json`. No schema dump, dependency tree or production worktree is bundled.

From this packet directory:

```sh
node scripts/prepare.mjs --output /tmp/core-native-proposal-run
export CORE_PROPOSAL_RUN_ROOT=/tmp/core-native-proposal-run
# Optional when normal local require('typescript') cannot resolve exactly5.9.3:
export CORE_PROPOSAL_TYPESCRIPT_MODULE=/absolute/node_modules/typescript/lib/typescript.js
node --experimental-vm-modules --test --test-reporter=tap tests/native-identity-proposal.test.mjs
CORE_PROPOSAL_VARIANT=baseline node --experimental-vm-modules --test --test-reporter=tap tests/native-identity-proposal.test.mjs
node --test --test-reporter=tap "$CORE_PROPOSAL_RUN_ROOT"/baseline/apps/api/src/auth/history-release-source.focused.test.mjs "$CORE_PROPOSAL_RUN_ROOT"/baseline/apps/api/src/auth/history-release-batch-owner.focused.test.mjs
```

Use a fresh/empty output directory outside the packet and source checkout. `prepare.mjs` verifies all published bytes, copies them to scratch, dry-runs and applies the one-file patch **only to its proposed scratch copy**, then verifies the resulting digest. Optional `--core-source-root /absolute/local-core-source-root` uses caller-supplied local files instead; all eight bytes must match and an existing Git checkout must be exactly at the pinned commit. No automatic fetch is supported.

## Actual checks and their limits

| Check | Result |
| --- | --- |
| Proposed native methods **composed with the real published batch/wire** plus direct edge cases | **34/34 pass**, no skips |
| Same proposal tests against unchanged published middleware | **2 pass / 32 fail**: proposed methods and history no-store entry are absent; these are proposal qualification cases, not Meri's original32 failures |
| Existing unchanged published wire/batch focused tests | **10/10 pass** |
| Exact source hashes, scratch patch dry-run/application and JS syntax | Pass |

Tests execute the actual proposed class and published canonical batch/wire/leaf over synthetic dependencies. Most direct cases seed private request provenance in scratch-only instrumentation; a separate case invokes the actual ordinary `use()` and consumes its real private provenance without that seed. Cases cover exact SQL predicates/values; original locks before subject locks and a fresh online call; no nested lease after RR start; empty/selected vectors; failed commit and commit-time expiry; expiry during fresh/local reads; changed session facts and replacement membership; wrong target/token/context; ordinary authority/impersonation; marked refusal with pre-auth no-store. No assertion is skipped or weakened.

This is not implementation-ready or runtime acceptance. TypeScript transpilation checks syntax, **not semantic typechecking**. Full supported Core typecheck/Nest regressions, genuine Clerk freshness and PostgreSQL locks/snapshot conflicts/RLS/pool contention remain unrun. Synthetic timeouts/rows do not prove those properties. Original24-case attempt logs live outside this final packet and are superseded by its34-case logs.

## Remaining canonical-contract and Meri integration work

The published wire accepts transcript **exactly one** subject and at most100 total scopes; the selected-client leaf accepts exactly one client scope plus an active owned Core conversation, and refuses special metadata/scopes. Do not weaken or bypass those restrictions to activate history.

Before activation, extend this **same** canonical owner/contract with the transferred owner to preserve:

- Positive immutable Meri scheduled-occurrence custody without a Core conversation, distinct from positively absent origin. Core decides current member/client facts; Meri proves owner/destination/effect/scopes. An origin label or failed Core lookup never proves custody.
- Every applicable current client/wall fact for multiclient subjects and canonical prospect/RP/other scope owners; unsupported facts refuse the whole response.
- Complete transcript/fork and cursor-visible subject sets. `promptLineage.sourceBinding.conversationId` may name a foreign fork source; `nextBefore` may retain a row filtered by retention. Authorize/fence each disclosed subject or withhold the response; no silent omission or unreviewed cursor/redaction change.

Meri must retain the whole-page retention fence and PR181's held-session occurrence reads. Finish canonical custody/retention filtering and size checks, freeze exact response bytes once and derive the ordered subjects, run existing membership recheck, then make **one final awaited Core batch call** through the request-private native bearer closure. Validate every echo, principal/hash/freshness/deadline synchronously and publish those same bytes with no later awaited owner check or second serialization. No cached receipt, fallback authority or next-turn/SDK effect follows a read failure.

Prior authority review: `78ceaf9b` ← `33c83905` (client leaf) ← `b5facbcc` (transaction isolation) ← `c9cc03fe` (wire) ← `a7e72d37` (proposal) ← PR96 `784b1c3a`. The original middleware blob is `dda870eedf9efb389e0f120029cdf8a69b78f15d`. The exact header is preserved in both source and patch. No AGENTS.md exists at the inspected root/apps/api/src/tenant ancestor locations at this pin.
