# Runtime image source closure repair — 14 October 2026

Base/staged PR81 remains `480944bae488932ab5dea5452d2d3dbdcb04a755`. Tested repair code is `0898fadd077c61245fdb5c42365efacdb727d7c0`; publication adds evidence only. This is a focused source packaging fix, not deployment or Meri acceptance. Parent reports the one authorized PR81 shipping build failed at missing typed-reads; its raw shipping trace/build identity remains pending and is not inferred here. No paid build was retried.

## Measured defect and repair

The blanket `**/evidence` and `**/qualification*` Docker context rules remove six reachable production files:

- `packages/skills/evidence/typed-reads.mjs`
- `packages/skills/evidence/material-records.mjs`
- `packages/skills/evidence/record-pages.mjs`
- `apps/gateway/qualification/action-gateway.mjs`
- `apps/worker/qualification/checkpoint/verify-session-store.mjs`
- `apps/worker/qualification/sdk-options.mjs`

Control reaches the evidence helpers through commitments composition and gateway through canonical artifact composition; conversation runner reaches checkpoint verification and SDK options lazily. The repair adds precise parent traversal/child exclusion and those six keep rules. Existing two checkpoint keep rules remain. It does not expose entire evidence/qualification directories, move modules, alter canonical ownership, Dockerfile, package dependencies, locks, contracts, provider architecture or initialization behavior.

The former workspace fixtures had access to files excluded from Docker context. The new regression test builds a **local, network-none FROM-scratch COPY-only fixture**, derived from the three existing Dockerfile source COPY instructions. It exports the actual Docker-filtered filesystem without starting its container. Locked TypeScript AST traverses static imports/exports, literal/conditional dynamic imports, URL resources and canonical skill assets for CLI and all three role roots: 259 module/resource paths plus 28 skill files, 287 total. Each path must exist. The test then reproduces all seven frozen Docker npm-ci dependency prefixes (storage omits dev), runs the exact existing dependency alias command, verifies source/dependency symlink containment, and imports CLI, all roles and lazy module targets using real Node from the isolated tree. It asserts zero intercepted network/listener attempts and successful CLI help. Docker-generated `/etc/mtab` is outside copied source/dependency containment checks. No runtime task, Temporal service, HTTP listener, model turn or provider call is started.

## Evidence and checks

Raw receipts are in [the candidate directory](../../qualification/candidates/runtime-image-closure-20261014/); [SOURCE-MANIFEST.json](../../qualification/candidates/runtime-image-closure-20261014/SOURCE-MANIFEST.json) pins both changed source files and the explicit clean diff including `.dockerignore` (the capture helper’s generic diff excludes that filter).

- `baseline-copy-failure`: failed before qualification because Docker attempted a read-only home client-config directory. Subsequent runs use task-owned `--config`; no permission change/escalation.
- `baseline-copy-ready`: expected FAIL on unmodified PR81 filters; exactly six missing paths out of 287, actual Docker COPY.
- `repaired-copy-working`: COPY passes 287/287; the additional real upstream Temporal workflow bundling fails on this host. Working helper was untracked and raw diff fields are not an exact committed helper pin. This retained receipt is diagnostic only.
- `frozen-copy-imports`: committed helper42ce fails on overly broad containment of Docker-generated `/etc/mtab`; own fixture cleanup confirms absent. Corrected scope checks copied apps/packages/node_modules without allowing escaping dependency links.
- `corrected-copy-imports`: **PASS 1/1** on exact0898fadd, clean tracked source diff; 287/287, real isolated imports, zero network attempts, CLIhelp0, container/image absent, owned process group and children absent, no timeout or forced kill.
- `native-swc-probe`: explicit failed direct binding load, `ERR_SWC_NATIVE_CACHE`; raw stderr retained. The native addon rejects cache ancestors on this host. No chmod/chown, trusted-cache bypass or fake workflow compiler used. Optional `MERI_IMAGE_CHECK_WORKFLOW_BUNDLE=1` retains the real bundle check for a compatible environment.
- Independent exact-source actual Docker COPY/import/CLI rerun **PASS 1/1**: 287/287, zero network attempts, help0, owned resource/group/children absent, no timeout/kill (89.443 seconds). Bounded verdict and source hashes are recorded in the independent candidate directory.

Source/report/manifest whitespace checks pass. An all-evidence `git diff --check` reports original trailing spaces in retained raw `.stdout.bin` failure receipts; those bytes are preserved with their recorded hashes rather than edited into a passing receipt.

This local check runs host Node24.19 on x86_64 and frozen npm dependencies. It is not a build of the approved NODE_IMAGE/platform, native ABI qualification, non-root/Fargate isolation, approved deployment, live authorization/database/Temporal acceptance or first chat. Native Temporal workflow bundling remains failed/unqualified here; the authorized shipping owner must qualify it in the approved image environment before advancement. Actual application/worker start and live acceptance remain open. PR81 remains the staged immutable pin until parent explicitly selects a repair candidate; PR82 and PR83 pins are unchanged.

## Resource ownership

Each capture retains stdout/stderr hashes and its owned subreaper/process-group cleanup. The fixture attempts container/image cleanup independently, rereads absence and removes its owned export/tree/config; uncertainty fails qualification. All task-installed dependency directories and npm/SWC probe caches are removed after independent release, with exact path absence readback. Shared Docker builder cache is not broadly pruned. Prior worktrees, existing PostgreSQL resources, parent-owned historical zombies and protected unknown-owner paths are preserved. No new credentials, security changes, paid provider calls, AWS mutations, document generation or backend authority duplication.
