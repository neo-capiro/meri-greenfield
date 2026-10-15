# Package 3 integration, dependencies and proof review

15 October 2026. Exact reviewed branch head: **81e20025b7a805ac28a44f2044df87b0ebab905b**, `fable/repair-package-3-20261015`. The abbreviated pin and branch both resolved to this full SHA.

## Scoped verdict

**ACCEPT at source level:** canonical-package S3/Agent SDK re-exports, preservation of the previous cancellation/proxy/readiness repairs, inclusion of the advertised lane tips, and candidate-f static provenance at the exact final bytes below. Static source proof independently passes **5/5**.

**HOLD for an all-green reproducible integrated checkout and image/live qualification.** The dependency guard is a useful explicit-debt ratchet, not proof that all imports are declared or all suites load. Runtime 221/228 and schedules 153/154 remain failed aggregate runs. Their raw final logs were not supplied; failure attribution is owner-reported except for the source facts identified below. The inherited Docker-closure test also has a definite stale-hash assertion that must be aligned before that gate can pass.

**P2b synchronization remains independently incomplete.** No blocked probe was retried, recreated by another route, or treated as accepted by ancestry or static proof. No implementation, package installation, database/cloud/provider action, Docker build or deployment was performed.

## 1. Integration provenance

Package 3 is 41 commits ahead of package 2 `69040f9b4ab2d239bec1a057354d578d2bf24b1e`, zero behind, with that exact merge base. The comparison contains 104 changed paths and **no package.json or package-lock.json changes**.

All advertised implementation lane tips are verified ancestors (merge base equals full tip, zero behind):
- Clean checkout: `3fae9112bfdd13c6bb1182b670ffa476491c47b2`
- L4/settlement: `a1a6bd88da1aae890ecf5c2b3a8e9daf4b3c474b`
- L6 schedules: `56ed803dbf83a94688e1a9fb5fbf63f70fc35337`
- Reads/mail: `28f83c6d4c6dc512c9816e3e24dc6bccd8771e4d`
- PDF page tree: `b6dc012c65830b018524a61433074f66722e1baa`
- PDF revision: `cab18e6acba310fd58cb88abf03e43978a7f0ecc`

The merged activity factory retains both `generalReads` and `terminalAttemptMs`, validates both and uses both: [apps/worker/conversation/activity.mjs lines 24-43](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/conversation/activity.mjs#L24-L43) and [apps/worker/conversation/activity.mjs lines 78-85](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/conversation/activity.mjs#L78-L85). This confirms the stated conflict integration, not full semantic acceptance of the new reads/recovery lanes.

Unsupported worker-mode refusal, proxy ingress and accepted P2a readiness/plugin implementation paths have no changes since package 2. Temporal worker changes extract the same independent cleanup into `stopOriginal` and add reconciliation. Importantly, cleanup now always sends **canonicalSha256(binding)** as the execution ID, closing the prior nonblocking injected-receipt hardening caveat; it no longer selects the untrusted started receipt's execution ID. The normal broker cleanup remains independently bounded at 3000 ms. [apps/runtime/temporal-worker.mjs lines 20-44](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/runtime/temporal-worker.mjs#L20-L44). New L4 reconciliation semantics belong to their focused review; no live stop-time claim follows.

## 2. Dependency seam and clean-checkout claim

The new modules re-export the upstream ESM names from their owning package:
- Storage owns S3 **3.1141.0**: [apps/artifacts/storage/s3-sdk.mjs lines 1-4](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/artifacts/storage/s3-sdk.mjs#L1-L4), [apps/artifacts/storage/package.json lines 13-18](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/artifacts/storage/package.json#L13-L18).
- Conversation worker owns Agent SDK **0.3.295**: [apps/worker/conversation/agent-sdk.mjs lines 1-4](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/conversation/agent-sdk.mjs#L1-L4), [apps/worker/conversation/package.json](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/conversation/package.json).
- Runtime imports S3 from storage; SDK query preparation keeps its dynamic import through the worker seam. [apps/runtime/prepared-candidate.mjs lines 1-7](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/runtime/prepared-candidate.mjs#L1-L7), [apps/runtime/native-authority/sdk-query-preparation.mjs lines 10-16](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/runtime/native-authority/sdk-query-preparation.mjs#L10-L16).

These re-exports preserve the same package-resolved ESM class/module identity used by the owner. They introduce neither a second installed SDK copy nor a credential selection policy. This is a sound source repair of the package-2 root-hoist dependency. The unchanged Dockerfile already installs the owner packages and retains its now-redundant root SDK links; removing those is a separate image-candidate decision, not required for this repair.

The pristine-export run is **author evidence from the clean-checkout lane at eafcb769**, not an independently rerun final-package archive. It reports 13 locked installs, no links, 30/30 prepared-candidate controls, 17/17 checkpoint-capture, 5/5 runner-query and 10/10 SDK-continuation. Its full result was 27/38 suites passed, 9066 passes, 169 failures, not a clean all-suite pass. [docs/coordination/reports/FABLE-CLEAN-CHECKOUT-20261015.md lines 42-98](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/reports/FABLE-CLEAN-CHECKOUT-20261015.md#L42-L98). Raw outputs stayed uncommitted in the owner's session ([docs/coordination/reports/FABLE-CLEAN-CHECKOUT-20261015.md lines 119-121](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/reports/FABLE-CLEAN-CHECKOUT-20261015.md#L119-L121)); this reviewer did not receive them.

### Procedure/source-root

The new shell procedure checks the exact 13 lock directories, refuses linked node_modules, installs in dependency order with scripts disabled, and delegates to the existing runner. [scripts/qualification/local-baseline/clean-checkout.sh lines 7-26](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/scripts/qualification/local-baseline/clean-checkout.sh#L7-L26). The runner assigns `MERI_REVIEW_SOURCE_ROOT` to the requested checkout and removes ambient credential-shaped variables; it records failures rather than silently skipping them. [scripts/qualification/local-baseline/run-suites.mjs lines 21-38](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/scripts/qualification/local-baseline/run-suites.mjs#L21-L38). Documentation now gives the explicit hand-run source-root and module-mock setup: [scripts/qualification/local-baseline/README.md lines 25-35](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/scripts/qualification/local-baseline/README.md#L25-L35).

**Coverage limit:** the baseline recipe's runtime glob omits telemetry, although runtime npm test includes it; its worker glob omits browser and newly added reads tests. [scripts/qualification/local-baseline/suites.json lines 14-18](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/scripts/qualification/local-baseline/suites.json#L14-L18), [apps/runtime/package.json lines 7-12](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/runtime/package.json#L7-L12). Thus the documented archive command is not equivalent to every combined suite in the package-3 report. Keep those separate commands in a portable recipe, or extend the suite inventory before calling it a complete package-3 baseline.

## 3. Dependency guard: explicit debt, not a new-resolution regression

The guard compares exact owner/package/file triples and rejects both unlisted imports and stale exceptions. Its source scan is a regex-based first-party ratchet, excludes docs/evidence, and accepts root declarations; it is not a complete resolver or image closure proof. [scripts/qualification/local-baseline/dependency-ownership.test.mjs lines 11-40](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/scripts/qualification/local-baseline/dependency-ownership.test.mjs#L11-L40).

Integration expands known cases precisely:
- Two new conversations workflow tests use the already locked transitive `@temporalio/common` **1.24.0**.
- Reads schema/tools use worker `zod` **4.6.7**, already locked as an auto-installed SDK peer.
- A reads fixture uses `@modelcontextprotocol/sdk` **1.32.1**, likewise already locked as a worker peer.
- The schedules harness is lexically root-owned, but its `createRequire` is explicitly anchored to **conversations/package.json**, where Temporal client **1.24.0** is declared. [apps/control/schedules/test/scheduled-dispatch-harness.mjs lines 4-15](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/control/schedules/test/scheduled-dispatch-harness.mjs#L4-L15). This new exception does not demonstrate a missing-module regression; it records a cross-package ownership choice the simple scanner cannot model.

The existing genuinely unresolved `pg` and `jszip` cases remain visible in the guard and lane failure report. No evidence indicates that these new exception rows conceal a newly broken resolution path. **Accept the guard as honest explicit debt; do not interpret its green result as debt removal.**

### Recommended technical owner decision: ACCEPT explicit declarations at existing pins

Recommend approving the following narrow dependency cleanup rather than keeping ordinary declarations blocked merely on coordinator ownership. Regenerate only the affected locks, preserve already locked resolutions/integrities, and introduce no version upgrades or providers:

1. **apps/control/conversations:** devDependencies `pg 8.23.1` (the already reviewed runtime pin) and `@temporalio/common 1.24.0` (already locked transitively here). Storage may retain its independent `pg 8.23.0` test pin; this decision does not upgrade it.
2. **apps/worker/conversation:** dependencies `zod 4.6.7`; devDependencies `@modelcontextprotocol/sdk 1.32.1`, both matching its existing peer-resolved lock entries.
3. **apps/worker/qualification:** dependencies `zod 4.6.5`, matching its already locked runtime/probe dependency tree.
4. **Root package:** devDependencies `pg 8.23.1` for the existing root-owned gateway/local-action fixtures, and `jszip 3.10.2` for root-owned artifact tests. JSZip 3.10.2 is verified in the [existing worker-qualification lock](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/qualification/package-lock.json#L1267-L1272); do not select a newer registry release. This is the smallest ownership decision without relocating legacy tests.
5. **Schedules Temporal client:** accept conversations as its existing owner at `@temporalio/client 1.24.0`, retain the explicitly anchored require or replace it with a conversations-owned re-export. A duplicate root install is unnecessary and an ordinary root import could split class identity from the conversations owners. The guard exception can describe this approved owner seam rather than a missing-module fix.
6. Keep the frozen runtime SDK type-only fixture exception explicitly scoped; it is not covered by the ordinary suite claim.

After implementation, remove only resolved guard exceptions, run the guard and impacted tests in a pristine archive with no comparison links, and retain all other failures in the receipt. Preserve historical proof manifests/metadata byte-exact; any changed current proof row needs a successor candidate. These inherited test/declaration debts do not revoke the accepted product import seams or make every product lane fail.

The underlying proposal is [docs/coordination/reports/FABLE-CLEAN-CHECKOUT-20261015.md lines 106-113](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/reports/FABLE-CLEAN-CHECKOUT-20261015.md#L106-L113); integrated additions are listed in [docs/coordination/reports/FABLE-REPAIR-PACKAGE-3-20261015.md lines 44-51](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/reports/FABLE-REPAIR-PACKAGE-3-20261015.md#L44-L51). No lockfile change is authorized merely by these report statements.

## 4. Candidate f and the chain

**Independent result: 5/5 static proof checks passed, Node v24.19.0.** The owner reports v24.21.0. This execution used verified source blobs and only built-in static filesystem/hash/assertion code.

Final SHA-256 pins:
- Candidate **f**: `3215210633f64dcb4c8d98aa1c7e17af658c512511bc4f7bdf3df4f8a4085017`
- Preserved **e**: `41814143b72e4288f83bf3137b4cfcd7f14c9a93df467772b3685b0f1b35c341`
- Source-proof test: `b92a9e9773ac8c6bcb7d186fd9ddabba4af0cb4d541822381279e7dafeae474a`
- Independent test output: `cee91a6f60e59633c88194e229bc00432e8e36aa452b1664f5957d8ff18d6ee6`

Candidate f has **18 changed / 27 unchanged** historical rows. Exactly four rows changed since e; each records e's exact previous hash:
- prepared-kickoff: `b8623c6b9c78b92a81a858756073dace0fd47a4646c12eadb9f403a80dfcf875` → `3650e3af495e5a096a108c0071703012dfbaaf0e27d61e8469bd7eaf22a2d0e7`
- prepared-candidate: `b69fb73c10302cab199278b2318479f3f27074bd487d8bd8110195f1b7b7e8bb` → `a27377181aa678db1228c2f60832aad74084eb0cf39439125f86fad8639bb36e`
- temporal-worker: `1261353767a00898a27ec368f1914f3a67cacfc6113faf284f6a58d537b1f5d8` → `4a0a145c2014bf08006e7623cce9e9f325c1c4c03ee8ef436377189b00c9ca3e`
- prepared-temporal test: `268de545811af6b2e89b04e6f1ae76f4e6493cc7e7d3dbb3b7f8b912052453cc` → `67a68c78fd3942e0d66678b8bbebff9e45cccac510d68a7dda7446860f550b50`

The c/d loops now preserve historical hashes only; e supplies the immediate-predecessor check. This is appropriate: one `previousCandidateSha256` cannot name several different ancestors after repeated edits. The earlier manifests remain fixed by hardcoded whole-file hashes and predecessor-chain assertions, while current file hashes, historical hashes, path inventory and reasons remain asserted. **No provenance weakening found in this change.** [scripts/qualification/assembled-image/source-proof.test.mjs lines 13-53](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/scripts/qualification/assembled-image/source-proof.test.mjs#L13-L53).

Because f was edited before final review, acceptance applies only to the final f hash above at this exact commit; it does not retroactively seal earlier f bytes. Future changes need a new candidate or an explicitly re-reviewed exact pin. f still has null sourceHead/publicationSource and HOLD status; the bounded 45-path proof is not a complete image closure or admission. [scripts/qualification/assembled-image/candidate-manifest-fable-20261015f.json lines 1-19](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/scripts/qualification/assembled-image/candidate-manifest-fable-20261015f.json#L1-L19).

## 5. Runtime 221/228: precise qualification

The package report lists seven failures at [docs/coordination/reports/FABLE-REPAIR-PACKAGE-3-20261015.md lines 31-41](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/reports/FABLE-REPAIR-PACKAGE-3-20261015.md#L31-L41). **No raw final runtime RESULTS/stdout/stderr was supplied.** Do not certify observed error codes, exact failing names, or all seven as environmental solely from that label.

| Reported group | Source-supported classification |
|---|---|
| Image closure, 1 | Docker is genuinely required. Additionally, the unchanged test reads historical source-manifest.json and compares copied bytes to those obsolete hashes. This is a definite inherited test/proof defect, independently established from source and manifest hashes. |
| PostgreSQL, 2 | Owner reports missing-cluster connection failures. Exact two failing tests and observed errors are unverified without logs. Keep prerequisite failure distinct from the separate undeclared-pg import failures in conversations. |
| process, 3 | The runner-specific cases call runConversation. Ambient credentials are explicitly refused; root workspace ownership is explicitly refused. These are plausible source prerequisites, not independently observed final errors. |
| runner-bootstrap-files, 1 | The test's chmod(0500) cleanup-failure scenario is root-sensitive. Root can remove the directory anyway. This is a fixture assumption, not a RUNNER_WORKSPACE_REFUSED path. The bootstrap test/module never invokes the runner workspace guard. Exact observed failure still needs its log. |

Evidence: [apps/runtime/conversation-runner.mjs lines 15-15](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/runtime/conversation-runner.mjs#L15-L15), [apps/runtime/conversation-runner.mjs lines 62-62](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/runtime/conversation-runner.mjs#L62-L62), [apps/runtime/test/process.test.mjs lines 22-55](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/runtime/test/process.test.mjs#L22-L55), [apps/runtime/test/process-fixture.mjs lines 46-47](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/runtime/test/process-fixture.mjs#L46-L47), [apps/runtime/test/runner-bootstrap-files.test.mjs lines 53-57](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/runtime/test/runner-bootstrap-files.test.mjs#L53-L57).

The lane's scrubbed archive run explicitly removes ambient AWS variables, so its root-sensitive outcomes must not be conflated with a later unsanitized npm-test run. The final report's “ambient AWS / root” wording does not identify which error actually occurred.

### Definite inherited Docker-proof mismatch

[apps/runtime/test/image-closure.test.mjs lines 62-67](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/runtime/test/image-closure.test.mjs#L62-L67) compares every copied file against the **historical** manifest. The first changed row is native-preparation-journal:
- historical: `6f0d34c67d179af93f15dd6179c56a4ae437f1ca63250baf637a836df8dd63a5`
- candidate f/current: `b8aadcb9ca7b06cb5ad9571da5b72b1134827b7c949498a949a54dcbafb439c9`

Even if Docker becomes available and COPY succeeds, this assertion cannot pass at the reviewed tree. Minimal fix: preserve and verify historical bytes/paths, but verify copied current bytes against the explicitly selected, frozen candidate manifest. Do not overwrite historical proof hashes or dismiss this as Docker availability alone. The test was unchanged since package 2; this is an inherited gate issue, not a new import-seam regression.

## 6. Schedule result remains red

The aggregate is **153/154**, with owner-reported “expiresAtMs substitution” failure and five passing targeted reruns. Those reruns are useful flaky-test evidence; they do not make the original or final full suite green.

The unchanged test freezes its inspector clock in the harness but builds the expired receipt with **Date.now()-1**. If real time advances sufficiently, that “expired” timestamp is at or after the frozen logical now and the expected refusal becomes timing-dependent. Source evidence is direct: [apps/control/schedules/test/temporal-inspection-independent.test.mjs lines 13-31](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/control/schedules/test/temporal-inspection-independent.test.mjs#L13-L31). The inspector applies the injected clock/lifetime ([apps/control/schedules/temporal-inspection.mjs lines 25-36](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/control/schedules/temporal-inspection.mjs#L25-L36)).

Minimal test correction: derive the expired receipt from the same injected clock, or inject one consistent fixed clock into the case, then rerun the complete schedule suite at the exact final pin. No production clock policy change follows from this fixture issue.

## 7. Smallest remaining evidence/fixes

1. Supply portable **final** runtime and schedules receipts: command/file list, exact source commit/export provenance, Node/UID and sanitized selectors, exit/counts, every failing test/stack, plus stdout/stderr hashes and the five targeted-rerun results. Do not include credentials. Include the earlier clean-archive RESULTS and relevant import-control logs if independent archive verification is desired.
2. Align the Docker-copy assertion to the frozen candidate while retaining historical verification.
3. Fix the schedule clock fixture and run the full suite; align the baseline inventory or publish the separate combined-suite commands.
4. Resolve the explicit dependency ownership/lock decisions above. No new S3/Agent SDK runtime lock is required for the accepted seam.
5. Freeze only candidate f's exact final hash. Image build/scan/admission, real PostgreSQL, non-root runner controls, Temporal recovery, ECS termination, SDK/provider and other live gates remain separate.
6. Keep P2b independent synchronization review open. This review cannot close the prior stopped action.

## Evidence retained

`package3-integration-review/` contains 34 newly fetched GitHub-blob-verified files, source snapshots, ancestry/comparison metadata, the static proof result and SHA-256 inventory. The unchanged 41 of 45 proof paths and historical proof support were taken from the prior blob-verified snapshot and checked against the complete package-2 → package-3 changed-path comparison; four changed proof paths were freshly fetched. No claim is made that this partial snapshot is a full runnable checkout.

Additional SHA-256:
- Dependency guard: `52a9435430461b486cf06bba88f2e3950daeda4450c2f9e2ff82a8f2233dfa59`
- Clean-checkout script: `3f3acf929b8e82bcbb54d235c8d60ccb445395b5a24c58f6f735c547cce1e151`
- Baseline runner: `ff2d54f04184431b2f499aea195c9553abd826f6b5eace87b0fd0c1c112d2522`
- Suite inventory: `76325eb9490ebc26f5c635678453f9dafbabffb6eec1e19bd5e2ef98777631b7`
- S3 seam: `b92f2bad11c67397ee2cf0d8349e5863d3fe71d532f9ad6011f47c8b565f2e66`
- Agent SDK seam: `74880926499cb34ad138adc75ffe85dd28a6dce22ea3a53aad8c2b5b1efde8d6`
- Fresh-file verification inventory: `e95edb17b4f3009cf01a4629683c1dec418918a7d4c87c9d94d76becdff7af34`

