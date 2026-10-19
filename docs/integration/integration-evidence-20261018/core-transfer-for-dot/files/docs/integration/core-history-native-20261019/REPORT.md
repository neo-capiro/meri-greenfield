# Core history native identity implementation

Applies the exact Neo-approved middleware proposal from [Meri PR188](https://github.com/neo-capiro/meri-greenfield/pull/188), packet pin `b3611559582be27f4545509d9c2f03dc3b1332cd`, to the existing [Core handoff](https://github.com/neo-capiro/capiro-backend/commit/78ceaf9bdfe00c8f013aac15eb8483312ae4f803). Neo explicitly approved that 65-addition/2-deletion proposal with “yes i am approve”; this implements only that approved scope. The protected source header remains intact. [Core PR96](https://github.com/neo-capiro/capiro-backend/pull/96) is the receiving ancestor.

## Source and custody

- Exact parent: `78ceaf9bdfe00c8f013aac15eb8483312ae4f803`; parent tree `6cae619af4ad0d67a6693c57a6721fc775037172`.
- Published handoff branch remained `codex/core-history-release-safe-handoff-20261018` at that parent. PR96 remained `784b1c3a91eb6d78f16d92c42e71f05c12c5b5bb`. Ownership comments showed the existing transfer and proposal publication, with no successor history-release PR found before implementation.
- Independent follow-up branch: `fix/core-history-native-identity-20261019`. No other branch is changed.
- Original middleware blob: `dda870eedf9efb389e0f120029cdf8a69b78f15d`; SHA256 `cad811e48368c01519aa720d419a281f03190907966819feca9276d3852fcaa9`.
- Approved patch SHA256: `9f4ded7f8a111154cf32dea7888fb145c7bcb72b73b4eef1d7f3870a6e7f4043`; resulting middleware SHA256: `d9931a98db2de9ca10cbd2aa161983747c159773e30bbc04bcb36474530095e0`. The implementation is byte-identical to the reviewed result.
- Work was performed on an isolated eight-file API materialization, without a full clone or dependency installation. The follow-up Git tree is based on the complete published parent tree, preserving all untouched files. `MANIFEST.json` records the exact basis and published payload hashes. The `20261019` path/branch label is a work label; checks ran at `2026-10-18T23:37Z` UTC.

## Exact behavior

The two existing batch-native interface methods now lock the original native user, tenant and selected membership in that order on the caller's transaction, then obtain a new online observation of the same original Clerk session and read identity facts through that transaction. A private provenance guard binds the request/context, session and exact native history target. The first history slice refuses marked credentials, impersonation and alternate membership selection. The existing identity reader accepts an optional transaction; its ordinary default still uses `withSystem` and ordinary impersonation keeps its existing behavior.

The exact two history-release path spellings join the pre-auth response `no-store` list. Credential admission lists, provisioning, ordinary authentication and route mounting are unchanged. The batch remains unmounted. No integration route, migration, deployment or chat attempt was performed.

## Checks and commands

Runtime: Linux, Node `24.19.0`, npm `11.9.0`, TypeScript `5.9.3`. The compiler was reused read-only from an existing dependency installation via the explicit absolute `CORE_PROPOSAL_TYPESCRIPT_MODULE` override; no dependency installation or shared dependency mutation occurred. Core declares Node `>=20.11.0` and pnpm `9.12.0`; A pnpm fallback executable exists on the host, but the supported Core dependency/generated-client graph was absent from this sparse workarea; no package-manager install was attempted.

From the repository root, with TypeScript exactly `5.9.3` locally resolvable or an existing absolute compiler module path exported:

```sh
export CORE_PROPOSAL_TYPESCRIPT_MODULE=/absolute/existing/node_modules/typescript/lib/typescript.js
node --experimental-vm-modules --test --test-reporter=tap apps/api/src/tenant/tenant-context.history-release-native.focused.test.mjs
node --test --test-reporter=tap apps/api/src/auth/history-release-source.focused.test.mjs apps/api/src/auth/history-release-batch-owner.focused.test.mjs
node --check apps/api/src/tenant/tenant-context.history-release-native.focused.test.mjs
```

The before check used the identical new focused test over the unchanged eight-file parent materialization, before applying the approved patch. Patch application commands were `git apply --check <approved-packet>/tenant-context.patch` then `git apply <approved-packet>/tenant-context.patch`. `cmp` against the prepared approved result passed; an independent no-index diff reports exactly `65` additions and `2` deletions. Applying the same test to a full checkout of the exact parent reproduces the before check without changing production source:

```sh
# Run in an isolated checkout of 78ceaf9bdfe00c8f013aac15eb8483312ae4f803.
# Copy only this follow-up's new focused test into its same relative path.
node --experimental-vm-modules --test --test-reporter=tap apps/api/src/tenant/tenant-context.history-release-native.focused.test.mjs
```

| Check | Before exact parent | Approved implementation | Evidence |
| --- | --- | --- | --- |
| New native interface, guards, native-to-canonical-batch composition, expiry/commit/provenance cases | 2 pass / 32 fail | 34 pass / 0 fail | `baseline.tap`, `native-focused.tap` |
| Existing unchanged published wire/batch tests | Previously packet-qualified 10/10 | Fresh 10 pass / 0 fail | `published-focused.tap` |
| JS syntax; exact approved result; diff whitespace | — | Pass | Commands above; manifest |
| Full Core semantic TypeScript / Nest suite | **UNRUN** | **UNRUN** | Required Core dependencies/generated Prisma graph absent; no install under disk hold |

All executed test groups have zero skips/cancellations/todos. Baseline 32 failures are the absence of these newly proposed interfaces/header behavior in Core78, **not Meri's original 32 backend failures**. Full assertions, errors and stacks are retained in `baseline.tap`; only host workspace prefixes and process IDs are scrubbed. The before fixture has 34 cases; no existing assertion was removed or weakened to obtain green.

The tests execute the actual middleware class and unchanged published batch/wire/selected-client owner with synthetic external Nest/Clerk/Prisma dependencies. Most direct cases seed private provenance only in an in-memory instrumented test module; a separate case invokes actual ordinary `use()` and consumes the real recorded provenance. They check exact SQL predicates/values/order, no nested system lease under the held transaction, fresh online observation, empty/selected subject vectors, commit failure and expiry, fresh/local read expiry, changed session revision, original-membership replacement, wrong request/context/credential targets, ordinary authority/impersonation and pre-auth no-store refusal. Transpilation diagnostics check syntax; **they do not establish semantic type correctness**. No semantic TypeScript pass is claimed.

## Remaining integration limits

Live Clerk freshness, real PostgreSQL lock/snapshot/RLS/pool behavior and a complete Nest admission regression suite remain unrun. The new native methods rely on the existing canonical batch owner to supply the intended RepeatableRead transaction; these synthetic checks do not prove real database isolation.

The published wire/owner remains intentionally narrow: transcript requires exactly one subject; at most100 scopes; one client scope and active owned Core conversation per selected-client leaf. Scheduled positive Meri occurrence custody without a Core conversation, multiclient/special scope owners, complete cursor/fork subject sets, and the final frozen-byte Meri consumer still require the same canonical owner/integration work. None is bypassed here. Unsupported subjects continue to refuse. Ordinary admission still has its existing provisioning/self-heal/lastSeenAt behavior.

Deployment, chat and merge holds remain active. No route is mounted by this change.
