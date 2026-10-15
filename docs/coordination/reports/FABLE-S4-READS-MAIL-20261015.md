# Fable lane report: general read server and family 1.1 mail (15 October 2026)

Lane: general read tools, phase 1 start. Branch `fable/s4-reads-mail-20261015`, base `866110f8` (package two). Binding design: [FABLE-GENERAL-READ-TOOLS-20261015.md](../proposals/FABLE-GENERAL-READ-TOOLS-20261015.md) §2, §2.3–§2.9, §5, §6 and §7, with the owner adjustments of 15 October 2026. Audit input: `data-artifacts-report.md`, section "Required design/acceptance correction" (ordinary no-skill institutional MCP binding = 0, P1), and README sequence step 4 ("Bind approved institutional reads").

**Nothing here is live.** Production supplies no general-read port and no native general-read installation exists, so zero reads are available in every run today. Everything below is source-level wiring with synthetic tests. "Reachable" means source-level wiring only.

## Implementation outline

| Responsibility | Owner | Module |
| --- | --- | --- |
| Model loop and tool calls | Claude Agent SDK `query` (unchanged, single loop) | `apps/worker/conversation/activity.mjs` |
| Which reads appear (six gates) | worker, pure function over trusted inputs | `reads/availability.mjs` |
| Validation of gateway availability facts (P1/P2 local shapes) | worker | `reads/snapshot.mjs` |
| Tool definitions, schemas | worker, derived from catalog descriptors and canonical schemas | `reads/tools.mjs`, `reads/schema.mjs` |
| Correlation hook, handler, receipts, closed errors | worker | `reads/server.mjs`, `reads/results.mjs` |
| Per-run ceilings (P3 local) | worker ledger; durable allocation stays authoritative | `reads/budget.mjs` |
| Mount decision and options merge (P12 local) | worker | `reads/runtime.mjs`, `reads/options.mjs`, `options.mjs` |
| Policy fields (P8 local) | capability policy and resolver | `capabilities/policy.mjs`, `capabilities/policy-resolution.mjs` |
| Authorization, budget reservation/settlement, invocation records | gateway: `createCurrentToolAuthority`, `createDurableToolDispatch.executeOwned` (unchanged) | `apps/gateway/general-reads/mount.mjs` |
| Implemented-and-qualified installation (P2 local) | gateway over the native qualification port | `apps/gateway/general-reads/installation.mjs` |
| Source querying | existing mail HTTP adapter and handler (unchanged) | `apps/gateway/sources/mail/` |

Dependency direction: activity → `reads/runtime.mjs` → port (`readAvailability`, `execute`) supplied by trusted composition → gateway mount → durable dispatch → mail adapter. The worker imports no gateway module. State ownership: the gateway owns authority, budget and invocation records; the worker owns only the per-run correlation map, ledger and receipt list, closed with the run.

## What changed

### Gateway (`apps/gateway`)
- `catalog/installed-catalog.mjs`: extracted `createInstalledCatalogView` (receipt-agnostic execution view); `createInstalledRuntimeCatalog` keeps its signature and validates the skill installation first.
- `catalog/measured-handlers.mjs` (new): handler registration and source-byte measurement moved out of `catalog/selected-installation-owner.mjs`, which now uses it. Behaviour preserving.
- `test/scripted-tool-pool.mjs` (new): the scripted SQL protocol, moved out of `selected-skills/fixture.mjs` for reuse.
- `general-reads/installation.mjs` (new): general installation owner over the native port; validates the P2 receipt and measures each installed handler's files.
- `general-reads/mount.mjs` (new): `readAvailability` (installed ∩ allocated operations plus the discovery grant) and `execute` through `createDurableToolDispatch.executeOwned`, rechecking the installation before execution and at release. Source disabled by default. A refused or revoked installation is `UNAVAILABLE`.
- `general-reads/fixture.mjs`, `general-reads/mount.test.mjs` (new): synthetic composition and tests.

### Worker (`apps/worker/conversation`)
- `reads/` (new): `families.mjs`, `availability.mjs`, `snapshot.mjs`, `schema.mjs`, `tools.mjs`, `results.mjs`, `budget.mjs`, `server.mjs`, `runtime.mjs`, `options.mjs`, and `test/` (fixture, availability, server, options tests).
- `options.mjs`: optional sixth parameter `readOptions`, merged with the skill mount (servers by name, `allowedTools` union, hooks by event, `canUseTool` chained) before the capability fragment. Refuses a read tool whose operation `meri_original_reads` already exposes. The default prompt sentence changes only when `meri_reads` is mounted.
- `activity.mjs`: optional trusted `generalReads` port. Only when the resolved policy has `generalReads` and the port is present does it build the runtime. A selected skill narrows to its operations; operations the skill server exposes are excluded (so the two admitted skills get no `meri_reads` server, and `meri_original_reads` is unchanged). The runtime is closed in `finally`.
- `capabilities/policy.mjs`, `capabilities/policy-resolution.mjs`: P8 fields.
- `test/legacy-tools-excluded.test.mjs`: also scans every constructible `meri_reads` name and checks that the server's never-register list equals the owner's 43 names. `test/capabilities.test.mjs`: default-policy assertion extended for the new fields.

### Behaviour of the server (family 1.1 mail)
- Tools: `mcp__meri_reads__mail_list_messages`, `mail_search_messages` and `mail_read_thread` (operations `mail.list_messages@0.2.0`, `mail.search_messages@0.2.0` and `mail.read_thread@0.2.0`, legacy `list_emails`, `search_emails` and `get_email_thread`). Legacy aliases are never names. Descriptions come only from descriptors. `alwaysLoad` applies at 24 tools or fewer; above that, `searchHint` is used.
- Schemas: the canonical schema is loaded by id from the file whose bytes the descriptor hashes; a mismatch is a configuration failure. `$ref`s are inlined and annotation `default`s dropped, then the schema is converted with `z.fromJSONSchema`. It is advertised only when `isNarrowerOrEqual` proves the result is no wider than canonical; otherwise the `{arguments: record}` envelope is used. All three mail schemas convert in canonical mode. A tool whose shape cannot become JSON Schema throws `READ_SCHEMA_CONFIGURATION` and is never silently dropped.
- Gates: (1) read-only descriptor; (2) operation in the current measured installation; (3) `generalReads` and family in `readFamilies`; (4) operation in the discovery grant; (5) `clientScope:'required'` families need a client scope (mail is `optional`: subject is client or personal, and the gateway's subject checks decide); (6) deferred catalog originals (the owner's 43) are never registered.
- Correlation: the hook checks the event, tool-use id, pinned session, that the tool is listed, that the tool-use id is new, and the call ceiling. It issues a one-time token and derives `deliveryId = 'sdk:' + sha256({binding, sessionId, toolUseId})`. The handler requires the exact token, operation and argument hash, then rechecks current availability. Every failure is `isError` with one fixed text per gateway code: UNAVAILABLE, ACCESS_DENIED, DEADLINE, CANCELLED, INVALID_ARGUMENTS, BUDGET_UNCERTAIN, INVALID_RESULT, RESOURCE_LIMIT, GATEWAY_CONFIGURATION, INTERNAL_ERROR. None is ever an empty success.
- Permission layers: names are pre-approved in `allowedTools` (the pattern `meri_original_reads` uses, so `canUseTool` never rewrites hook-updated input). Every PreToolUse hook must not deny: the correlation hook plus any capability audit hook. The handler token must match. `canUseTool` allows only the exact names, chained with the capability fragment's `chainPermissions`, and denies other names.
- Receipts: `{deliveryId, operation, argumentsSha256, resultSha256, decisionId, policyRevision, executionCatalogSha256}` per completed call, held in the run (`runtime.receipts()`). They are never published as events (P9).
- Budget/timeout: server `timeout` and per-call deadline are each bounded to 1–60 s and by the run deadline. Cancellation arrives through the SDK `extra.signal`. Per-run ceilings are 24 calls, 1 MiB per result, 2 MiB aggregate and no recovery attempts; a skill can only narrow them.

## Audit finding status

- data-artifacts "Ordinary no-skill institutional MCP binding = 0" (P1 exposure gap): **partially addressed at source level** for family 1.1 mail only. A general in-process read server over the canonical gateway, derived from the registry, exposes only installed, policy-admitted and grant-eligible operations and refuses explicitly otherwise. Families 1.2–1.13, phase 2 adapters, governed non-read routes (`meri_intents`, P10) and all live qualification remain open.
- The audit warns that a general reader "needs an explicitly reviewed run-level admission shape rather than fabricating a skill." The mount does not fabricate one. It accepts the run's existing frozen allocation, and a base general-read allocation is proposal P3. The synthetic manifest-shaped allocation exists only in the test fixture, as the budget README permits for tests.

## Checks

Node v24.21.0. Dependencies were symlinked only where lockfiles were byte-identical (`cmp`).

| Suite | Before (base `866110f8`) | After |
| --- | --- | --- |
| Worker `test/*.test.mjs skills/test browser/test` (+ `reads/test` after) | 193/193 | 219/219 (+25 reads, +1 guard) |
| Gateway, every `*.test.mjs` under `apps/gateway`, `MERI_REVIEW_SOURCE_ROOT` set | 1238 pass, 1 fail, 1 skipped (1240) | 1246 pass, 1 fail, 1 skipped (1248); +8 mount tests |
| `apps/runtime` `npm test` | 187/196 | 187/196, same 9 failures |
| `apps/control/conversations/skills/test/pipeline.test.mjs` (imports the refactored fixture) | 0/4 | 0/4, same failure |
| `scripts/qualification/assembled-image/source-proof.test.mjs` | — | 5/5; no hashed proof row changed |

Failures present at the base and unchanged:
- The gateway failure is the mail-history DOCX test: `ARTIFACT_CLEANUP_FAILED`, LibreOffice "failed to launch javaldx".
- The runtime failures are Docker COPY, PostgreSQL-backed and native-runner tests.
- The control pipeline failure is `ERR_INVALID_ARG_TYPE` (an unset path argument in this environment).

Under load, `test/activity.test.mjs` "late SDK iterator is bounded by deadline" failed once in a combined run and passed 3/3 alone (timing). Reported, not hidden.

**Reverted-fix proofs.** Each guard was temporarily removed, its tests run, and the file restored byte-exact:

| Guard removed | Result |
| --- | --- |
| Installation gate (availability) | 1 fail |
| Discovery gate | 4 fail |
| Client-scope gate | 1 fail |
| Duplicate tool-use check | 1 fail |
| Call ceiling | 1 fail |
| Per-call availability recheck | 1 fail |
| Failures rendered as empty success | 4 fail |
| Skill/general collision check | 1 fail |
| Policy gate in runtime | 1 fail |
| Gateway default-disabled availability | 1 fail |
| Gateway release-time installation recheck | 0 fail at first; a test was added (installation revoked during the source call), then 1 fail |

**Unrun, with reasons.**
- Real SDK `query` → `meri_reads` → gateway → Core mail endpoint qualification (§5): no live sources, no model or provider calls authorized.
- Real PostgreSQL budget and invocation durability: scripted SQL only.
- Broker credentials.
- SDK tool-search deferral: mail has 3 tools, so `alwaysLoad` applies.
- The SDK CLI's own schema conversion of these tools: the MCP in-memory listing is the evidence.
- TypeScript check of `// @ts-check` files: no `tsc` in the borrowed dependencies.

## Proposals for dot (exact text)

These remain proposals. Local shapes are marked in source.

- **P1, discovery grant.** Proposed text: "A per-run `GeneralReadDiscoveryGrant` `{binding: RunBinding, policyRevision: digest, operations: OperationRef[≤128, unique], checkedAtMs, expiresAtMs}`, issued by a gateway discovery owner when the claims carry `tool.read`, the business policy grants each operation's `requiredGrants` to this actor and role, and the operation's sources are enabled for the tenant. It only pre-filters the tool list; `createCurrentToolAuthority.check` remains authoritative on every call." Local: `reads/snapshot.mjs`; producer port `discoveryOwner.readDiscoveryGrant({binding, policyRevision, signal})`.
- **P2, general-read installation receipt.** Proposed text: "`GeneralReadInstallation` `{binding, scopes, policyRevision, baseCatalogSha256, installationId, executionCatalogSha256 = sha256({baseCatalogSha256, installationId, operations}), operations:[{operation, descriptorSha256, handlerSourceSha256, qualificationReceiptId}], checkedAtMs, expiresAtMs}`, issued only by the native qualification owner for read-only descriptors with measured handler source." Local: `apps/gateway/general-reads/installation.mjs`; the worker sees the projection `{installationId, baseCatalogSha256, executionCatalogSha256, operations:[OperationRef], checkedAtMs, expiresAtMs}`.
- **P3, general-read budget allocation.** Proposed text: "A base read allocation `{run, profile:'general-reads/1', allowedOperations, budgets:{maxToolCalls:24, maxOutputBytes:1048576, maxReadBytes:2097152, maxRuntimeSeconds, maxCostMicroUSD, maxRecoveryAttempts:0}, schedule}` accepted by `tool-budget-binding.allocation` beside the SkillManifest form. A selected skill can only narrow it. The values are unqualified upper bounds, never spending authority." Local: `reads/budget.mjs` (`GENERAL_READ_CEILINGS`). Until P3 exists, an ordinary run has no allocation, so no mount can be composed.
- **P8, policy fields.** Proposed text: "`generalReads: boolean` (default false) and `readFamilies: string[]` (allowlist over constructible read families, default all), resolved platform ∧ tenant ∧ role: flag AND, list intersection, widening refused, empty list switches the flag off." Implemented locally in `capabilities/policy.mjs`; the universe is `reads/families.mjs` (today `['mail']`).
- **P9, receipt event admission.** Proposed text: "Admit a `tool.read.receipt` conversation event carrying only `{deliveryId, operation, argumentsSha256, resultSha256, decisionId, policyRevision, executionCatalogSha256}`, never raw results." Not implemented; receipts stay in `runtime.receipts()`.
- **P12, conditional default prompt.** Proposed text when `meri_reads` is mounted: "Only the read-only institutional source tools listed for this activity are enabled; every other institutional source is unavailable." Unmounted, the existing sentence "No institutional source tool is enabled for this activity." is unchanged. Implemented in `reads/options.mjs` (`readPromptSentence`).

## Residual risks and coordination

- The production composition (`apps/runtime`) does not yet pass a `generalReads` port, a discovery owner, a native general-read installation owner or a P3 allocation; each is fail-closed when absent. Wiring them is a separate reviewed change.
- In a selected-skill run whose allocation is the skill manifest, the mount would accept only that manifest's operations. For the two admitted skills those are all excluded, so no second server appears.
- `isNarrowerOrEqual` is conservative: an unrecognised canonical keyword yields the envelope, which is advisory and wider. The gateway still re-validates every call.
- The design §4 deferred-tool notice was not implemented, because mail results contain no deferred guidance. It belongs with family 1.5 (tenant contacts).
- Another lane edits `apps/control/conversations`; this lane touched none of it. It did change `apps/gateway/selected-skills/fixture.mjs`, which `apps/control/conversations/skills/test/pipeline.test.mjs` imports; its `setup` export is unchanged.
