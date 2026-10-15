# Fable lane P2a: capability policy, SDK-native confinement and sandboxed Bash (15 October 2026)

Branch `fable/p2a-capability-policy-sandbox-20261015`, based on `6d9bb39` (P1a); reviewed by dot at `ff52b9e` (HOLD on P2a-R1/R2). The successor repairs are on `fable/p2a-r-readiness-plugin-20261015`, based on `ff52b9e`; see "Successor-review repairs (15 October 2026)" at the end. Owned paths are `apps/worker/conversation/**` and this report. The runtime image recipe change was authored in commit `c509ca1d` and then reverted at the final pin, so `apps/runtime/Dockerfile` is unchanged; the packages are a proposal for the image owner (see "Runtime image recipe"). No contracts, lockfiles, migrations, credentials, deployment, paid build or cloud action were touched or used.

Pinned versions: SDK `@anthropic-ai/claude-agent-sdk` 0.3.295 and CLI 2.1.295. Every option used was checked in `sdk.d.ts`:
- `Options.sandbox`, `Options.settings` and `Options.managedSettings` (around lines 2155–2240);
- `SandboxSettings` (around 3465–3570);
- `Settings.sandbox` and `Settings.permissions` (around 6860 and 8704–8940).

Two SDK behaviours were also read in the bundled `sdk.mjs`:
- `Options.sandbox` is merged into the inline `--settings` (flag) tier.
- `Options.managedSettings` is passed as `--managed-settings`, a restrictive-only parent policy tier. Its restrictive-key list includes `sandbox.enabled`, `failIfUnavailable`, `allowUnsandboxedCommands`, `strictAllowlist`, `allowAllUnixSockets`, `allowLocalBinding`, `filesystem.disabled`, `enableWeakerNestedSandbox` and `permissions.blockReadsOutsideWorkingDirectories`.

None of this is sandbox, Fargate, live policy or release evidence.

## Implementation outline (recorded before the substantial changes)

| Responsibility | Owner | Module |
| --- | --- | --- |
| Platform maximum, platform defaults, role ceilings | Capiro platform record, held by Core (dot) | input to `capabilities/policy-resolution.mjs` |
| Tenant-admin capability settings | Core (dot), tenant admin UI | input to the resolver; validate on save with `assertTenantCapabilitySettings` |
| User role | Core's trusted identity record | input to the resolver |
| Effective policy | pure resolver (this lane) | `resolveCapabilityPolicy` |
| Policy validation | worker | `capabilities/policy.mjs` |
| Bash sandbox attestation | runtime preparation owner, on the worker host | produced with `sandbox-readiness/cli.mjs`, passed as runtime fact `bashSandbox` |
| Model loop, permissions, sandbox, skills, hooks | Claude Agent SDK | configured by `capabilities/*` |
| Capability events | control owner | proposal below; still refused today |

Dependency direction:
- `activity → capabilities/index → {policy, workspace-tools, bash-sandbox, subagents, skill-plugin, hooks, fragment}`
- `options → capabilities/{fragment, skill-plugin, bash-sandbox}`
- `sandbox-readiness/{cli → readiness, host-probes} → capabilities/bash-sandbox`
- `policy-resolution → policy`

There are no cycles, and importing any module has no side effects. `host-probes.mjs` performs I/O only when its ports are called.

## Decisions implemented

### 1. Capability policy: platform ∧ tenant ∧ role

`capabilities/policy-resolution.mjs` (new, pure):

- `resolveCapabilityPolicy({platform, tenant?, role})` computes `maximum ∧ tenantLevel ∧ platformRoleCeiling[role] ∧ tenant.roles[role]?`.
  - `tenantLevel` is the platform defaults with the tenant's `capabilities` applied field by field.
  - Flags combine with AND, allowlists intersect, and `maxParallelSubagents` takes the minimum.
  - `sandboxNetworkDomains` intersect by coverage: `*.d` covers sub-domains but not the apex.
  - List order follows the tenant setting.
  - The output always passes `assertCapabilityPolicy`.
- Widening is refused with stable codes that carry the field name, and is never clipped:
  - `CAPABILITY_TENANT_WIDENING_REFUSED` when a tenant setting exceeds the maximum.
  - `CAPABILITY_ROLE_WIDENING_REFUSED` when a tenant role narrowing exceeds the platform role ceiling. This applies whichever user asks, so a record is either valid or invalid as a whole.
  - `CAPABILITY_ROLE_UNKNOWN` for a role with no platform ceiling.
  - `CAPABILITY_PLATFORM_LIMITS_REFUSED` when defaults or a ceiling exceed the maximum.
  - An unknown key gives `INVALID_COMMAND`.
- Empty intersections turn the scoped capability off (subagents, workspaceTools, skillPlugin; subagentProgress follows subagents). They still validate.
- `intersectCapabilityPolicies(p,p) === p`. Resolution is deterministic, monotone and idempotent: feeding a result back in as the tenant setting changes nothing.

Policy shape changes in `policy.mjs`. These are worker-side proposals and nothing is frozen:
- New flag `bash` (default false), giving explicit eligibility for sandboxed Bash. `Bash` left the `WORKSPACE_TOOLS` file-tool catalog, so enabling `workspaceTools` never makes Bash eligible. This closes dot HOLD item 3.
- New `sandboxNetworkDomains` (default `[]`, at most 32 entries). Each entry must be a lower-case DNS name with an optional leading `*.`. IP literals, ports, schemes, `localhost`, `.local` and `.internal` are refused.
- An allowlist may be empty while the flag it scopes is off. Previously every allowlist needed at least one entry. `{subagents:true, subagentTypes:[]}` is still refused.

### 2. Bash only inside the SDK sandbox, layered on the disposable worker

`capabilities/bash-sandbox.mjs` (new) builds no sandbox of its own. It configures the SDK's sandbox and decides admission.

**Admission.** Bash is admitted only when:
- the effective policy has `bash: true`, AND
- the trusted runtime fact `bashSandbox` from runtime preparation has `available: true`.

The `bashSandbox` attestation is a closed shape: `{available, sdk:'0.3.295', cli:'2.1.295', weakerNestedSandbox, outerIsolationBoundary, readinessSha256?}`. If admission fails, Bash stays out of `tools` and is listed in `disallowedTools`, and the composer applies the policy with `bash:false`. Subagent definitions always list Bash in `disallowedTools`. Run data never supplies the attestation: the activity copies it from `prepareRuntime`'s result only.

**SDK settings used, and why.**

| Setting | Value | Why |
| --- | --- | --- |
| `sandbox.enabled` | `true` | Run Bash inside the SDK sandbox |
| `sandbox.failIfUnavailable` | `true` | Bash must never run unsandboxed; the CLI refuses to start instead (measured, see check 6) |
| `sandbox.allowUnsandboxedCommands` | `false` | `dangerouslyDisableSandbox` is ignored. A false value in `--settings` or managed settings holds against lower tiers |
| `sandbox.autoAllowBashIfSandboxed` | `true` | Sandboxed Bash is approved by the SDK because it is sandboxed. The permission callback denies any Bash call that reaches it |
| `sandbox.network.allowedDomains` | policy `sandboxNetworkDomains` (default `[]`) | Network allowlist from the policy |
| `sandbox.network.strictAllowlist` | `true` | Unlisted hosts are refused, never prompted. Honoured only from user, managed/policy and `--settings`; `Options.sandbox` reaches the CLI as `--settings` |
| `sandbox.network.allowAllUnixSockets` / `allowLocalBinding` | `false` / `false` | No Docker socket and no local listeners. `allowUnixSockets` is never set |
| `sandbox.filesystem.allowWrite` | `[cwd]` | The task workspace is the only added writable path. The SDK's own default writable set must be confirmed live |
| `sandbox.filesystem.denyRead` | the secure-storage directory, when it is distinct from the config directory | Keep the CLI's secure storage unreadable |
| `sandbox.filesystem.disabled` | `false` | Keep filesystem isolation on |
| `sandbox.credentials.envVars` | `deny` for every name in `SANDBOX_DENIED_ENV` | Includes the proxy task capability `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, provider keys, every AWS/ECS credential and metadata variable, `DATABASE_URL`, `PGPASSWORD`, `TEMPORAL_API_KEY` and `MERI_NATIVE_ADMIN_TOKEN` |
| `sandbox.credentials.files` | `deny <configDir or ~/.claude>/.credentials.json` | Protect the CLI's credentials file |
| `sandbox.enableWeakerNestedSandbox` | from the attestation | See the tradeoff below |
| `managedSettings.sandbox` | the restrictive subset of the above | Parent policy tier, as a second layer |
| `managedSettings.permissions` | `blockReadsOutsideWorkingDirectories:true`, `disableBypassPermissionsMode:'disable'` | Parent policy tier, as a second layer |
| `env.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` | `'1'` | Scrub inherited credentials from CLI subprocesses |

`settingSources: []` stays, so no user, project or local settings file is loaded and nothing a sandboxed command writes can widen these settings.

Never set: `excludedCommands`, `ignoreViolations`, `httpProxyPort`/`socksProxyPort`, `tlsTerminate`, `bwrapPath`/`socatPath`, `ripgrep`, `allowMachLookup`, `enableWeakerNetworkIsolation` and `allowAppleEvents`. The fragment validator (`assertSandboxSettings`, `assertSandboxLocks`) refuses any of them, any unlocked value, and any fragment that has `Bash` in `tools` without all three of the sandbox, the policy-tier locks and the scrub. A fragment that leaves Bash out of `tools` must list it in `disallowedTools`.

**Weaker nested sandbox tradeoff.** `enableWeakerNestedSandbox` skips the fresh `/proc` mount inside bubblewrap, so the host `/proc` stays readable to sandboxed commands. That likely includes `/proc/<cli-pid>/environ`, which holds the proxy task capability. In that mode the env deny list does not protect the CLI process's own environment. It is therefore accepted only when the runtime preparation owner also asserts `outerIsolationBoundary: true`, meaning the disposable, single-conversation worker with a short-lived, task-bound capability is the real boundary. The policy-tier lock `enableWeakerNestedSandbox:false` is then omitted. This is recorded, not hidden, and needs owner acceptance per host.

**Placement note.** The approved deployment notes record Fargate namespace creation failing with EPERM (D005 / Baseline3). bubblewrap needs the same kernel facility, so the readiness check is expected to report not ready on Fargate, and Bash then stays off. Running Bash on another host is a placement change that needs separate human approval. This lane does not change placement.

### 3. Readiness check

The check lives in `sandbox-readiness/`. `readiness.mjs` does the orchestration with injected ports, `host-probes.mjs` holds the real ports, and `cli.mjs` is the entry point. It measures:

1. that `bwrap` and `socat` are on PATH;
2. a bubblewrap namespace probe (`--unshare-all --die-with-parent --new-session`, running the Node binary) with a fresh `/proc` and without one;
3. that no `/etc/claude-code/managed-settings.json` exists, since an admin tier would silently drop the parent-tier locks;
4. the SDK's own sandbox startup with the exact product settings, without a paid or any model call:
   - the prompt is an async iterable that never yields a user message;
   - `ANTHROPIC_BASE_URL` is `http://127.0.0.1:9`, and the token is a non-secret placeholder;
   - with `failIfUnavailable`, an unavailable sandbox produces an error result instead of a session;
   - a ready host completes `initializationResult()`;
   - after a short quiet window the query is deliberately closed, its consumer awaited and temp directories removed. Every frame observed before, during and after initialisation, including during the shutdown, is validated and accounted; any result, model turn, cost, error or failure refuses, and a failed shutdown is never ready (successor repair P2a-R1, below). At `ff52b9e` only error results were retained and a later contrary frame could not override an earlier initialisation; dot reproduced that.

`toBashSandboxAttestation(report, {outerIsolationBoundary})` derives the runtime fact. A host that needs the weaker nested sandbox without that assertion is reported unavailable.

CLI usage is `--help`. Exit codes: `0` ready, `1` not ready, `2` usage or configuration error (arguments are validated before anything is allocated), `3` incomplete.

The real sandboxed-command behaviour still needs a synthetic-budget run that cannot be done without a model turn. The proposed check, to run later under the approved synthetic budget: one query on the attested host, with the product settings and a fixed synthetic instruction to run Bash commands that:
- print the environment and expect no denied variable;
- reach an unlisted host and expect refusal;
- reach `169.254.169.254` / `169.254.170.2` and expect refusal;
- write outside cwd and expect refusal;
- read the secure-storage directory and expect refusal;
- under the weaker mode, read `/proc/<ppid>/environ`.

Results would be checked in-process from PostToolUse inputs, with only digests published. That check is designed here, not implemented.

### 4. "Use the SDK as much as possible": review of P1a's custom logic

| P1a custom piece | Now | Why |
| --- | --- | --- |
| `workspace-tools.mjs` textual path gate plus its PreToolUse duplicate (`withinWorkspace`) | Removed. Replaced by `permissions.blockReadsOutsideWorkingDirectories` (Read/Grep/Glob/LSP outside the working directory refused in every mode) and the allow rules `Read(//<cwd>/**)` and `Edit(//<cwd>/**)`. Edit rules also govern Write. The permission callback denies whatever the rules did not pre-approve. | SDK-native, and it resolves real paths, which the textual rule did not. **Public interface change:** the `withinWorkspace` export is gone; its only consumer was a test. |
| Bash regex gate | Removed. Bash runs only under the SDK sandbox. | A regex is not isolation. |
| Skill name gate in `skill-plugin.mjs` `canUseTool` | Removed. The SDK `skills` option emits `Skill(<name>)` allow rules (read in `sdk.mjs`), hides unlisted skills and rejects them. The callback denies the rest. | SDK-native. |
| Subagent admission gate (type, no `model`/`isolation`/`mode`/`team_name`, foreground only, parallelism bound) | Kept. | The SDK has no per-call setting that forbids a model override, isolation or background execution, and no parallelism bound. |
| Audit, compaction and lifecycle hooks | Kept; these are SDK hooks. | The projection to digests is Meri's secrecy rule. |
| `mergeHookSets`, `chainPermissions`, `mergeSettings` | Kept, minimal. | The SDK takes one `canUseTool` and one settings object, and the selected-skill options must be merged with the fragment. |
| Progress projection | Kept. | `agentProgressSummaries` is native; display is the UI-event owner's job. |

### dot HOLD items on P1a (6d9bb39)

1. **Latching.** Every hook validation, projection or publication error now latches. `hooks.mjs` requires a `latch` port. `subagents.mjs` latches malformed hook input, refused Agent input and duplicate tool-use ids. Reaching the parallelism bound is a capacity denial, so it denies but does not latch. `check()` throws `CAPABILITY_HOOK_FAILED` (or `CAPABILITY_EVENT_REFUSED`), and no event is attempted after a latch. The activity checks the latch before using each SDK frame, before each `message.delta`, before a held-checkpoint return, and before skill output publication and completion. Tests cover every hook path, directly and through the activity.
2. **Plugin path binding.** `assertSkillPluginDirectory` requires `realpath(dir) === dir`, so no alias or symlink is allowed anywhere on the path. The directory must be a real directory whose tree holds only regular files and directories (bounded at 1024 entries and depth 8). It must be disjoint from the resolved workspace in both directions. Since the successor repair P2a-R2 the workspace must also exist and is resolved by realpath; at `ff52b9e` a missing workspace was compared lexically, which dot showed lets a symlinked parent hide an overlap. `buildConversationOptions` refuses a fragment whose plugin path is not exactly the trusted `skillPluginDirectory` runtime fact, or that has plugins with no such fact. Tests use real temporary directories for an alias, a symlinked parent, a symlink to the workspace, a workspace reached through an alias, a symlink inside the plugin tree, a mismatch and a missing fact.
3. **No implicit Bash.** Covered by the explicit `bash` flag (above), with tests at policy, composer and activity level.
4. **Contract proposal amended.** See the next section.

## Contract proposals for dot (not edited; `packages/contracts/**` is frozen)

### A. Policy inputs and placement

- **Platform record** (Capiro, held by Core): `{maximum, defaults, roleCeilings: {<role>: policy}}`. Each member is a `CapabilityPolicy` as defined in `policy.mjs`. This lane proposes it be stored as a versioned, reviewed configuration document in Core, not in tenant-writable storage. The worker never reads it.
- **Tenant-admin record**: `{capabilities?: Partial<CapabilityPolicy>, roles?: {<role>: Partial<CapabilityPolicy>}}`, keyed by tenant and versioned. Core should call `assertTenantCapabilitySettings(record, platform)` on save and refuse with the stable codes above.
- **Role source**: the user's role from Core's server-side identity record at run creation. It is never taken from client input.
- **Delivery**: at run creation Core computes `resolveCapabilityPolicy`, stores the result in the execution record beside `run` (because `Run` is closed), and returns it from `load`. This is unchanged from P1a. The resolver module can move to a shared package once dot accepts the shape.
- **Runtime facts from preparation**: `bashSandbox` (the attestation above) and the existing `skillPluginDirectory`, `sdkConfigDirectory` and `sdkSecureStorageDirectory`.

### B. Capability telemetry: amended proposal (replaces P1a's "RunEvent" proposal)

The stored and public wire is the closed `UIEvent` 0.1.0 in `meri.schema.json`. Its types are `run.status`, `message.delta`, `tool.started`, `tool.completed`, `source.available`, `approval.required`, `artifact.available`, `checkpoint.verified`, `usage.recorded` and `run.error`, each with `additionalProperties:false` and a per-run `sequence` cursor. P1a wrongly called this "RunEvent". UIEvent 0.1.0 must not be widened.

Proposed: a separately versioned telemetry receiver, `CapabilityTelemetry` 0.1.0, rather than a new UI wire version. The capability events are worker-attested audit data, not display events, so keeping them off the UI cursor avoids any client compatibility or replay change to UIEvent.

- **Envelope** (closed): `{contractVersion:'0.1.0', telemetryId: uuid, binding: RunBinding, sequence: integer ≥ 1, createdAt: RFC3339 Z, type, data}`.
  - `binding` must equal the run-owner credential's bound run, checked by the receiver like `publish`'s STALE_WRITER check. Tenant and scopes come from the receiver's own record, never from the event.
  - `sequence` is a per-run telemetry cursor, independent of the UIEvent sequence.
- **Types and data** (each closed, phase-specific, through `oneOf` on `phase`):
  - `tool.audit`
    - `requested`: `{phase, toolUseId(1–128 [A-Za-z0-9_-]), tool(1–64 [A-Za-z0-9_]), inputSha256, agentId|null, agentType|null}`
    - `completed`: the same plus `responseSha256` and `durationMs|null` (0 to 86 400 000)
    - `failed`: the same plus `errorSha256`, `interrupted: boolean` and `durationMs|null`
  - `compaction.boundary`
    - `pre`: `{phase, trigger:'manual'|'auto', agentId|null, agentType|null}`
    - `post`: the same plus `summarySha256` and `summaryBytes` (0 to 16 777 216)
  - `subagent.lifecycle`
    - `started` / `stopped`: `{phase, agentId(1–128), agentType ∈ SUBAGENT_TYPES ∪ {'subagent'}}`
- **Digest semantics**: superseded by the single precise rule and test vectors in "Successor-review repairs", proposal T1. (The earlier wording here mixed RFC 8785 bytes, raw UTF-8 string bytes and "absent hashes null", and did not match the hooks, which hash the JSON string form and then normalised a missing summary to `''`.) Digests support correlation only. They are never evidence of content, and the raw values are never transmitted or stored.
- **Bounds**: at most 4096 telemetry events per run and 1 KiB per serialized event. Exceeding either is refused, which latches the worker and fails the run.
- **Replay and idempotency**:
  - Same `telemetryId` with identical canonical bytes: accepted idempotently.
  - Same `telemetryId` with different bytes: refused with `TELEMETRY_CONFLICT`.
  - Sequence gaps are refused. A worker resume after a checkpoint continues from the receiver-reported last sequence.
  - Events after the run's terminal state are refused.
  - Reads are `history({after, limit})`-style, by run, for audit consumers only, never streamed to the UI.
- **Failure semantics**: any refusal is a latched worker failure. This is already implemented: the tool is denied or the loop stopped, and the run fails instead of completing unaudited.
- **Alternative** if dot prefers one wire: UIEvent 0.2.0 adds these three closed types, with an explicit compatibility rule (0.1.0 readers must reject or skip 0.2.0 events by `contractVersion`) and shared-cursor handling (the sequence stays contiguous across both kinds, and 0.1.0 clients receive a `cursorFloor`). This lane recommends the separate receiver.

Until dot accepts one of these, the hooks fail closed and should stay off in real runs.

## Runtime image recipe (proposal; commit reverted at the final pin)

The worker runtime recipe is `apps/runtime/Dockerfile`, which builds the image that contains `apps/worker/conversation` and the SDK. It had no OS-package convention of its own. This lane follows `apps/worker/qualification/Dockerfile`:
- the fixed signed Debian snapshot `20261009T000000Z` with Signed-By keyring verification and `Check-Valid-Until: no`;
- HTTP, because the slim base has no CA bundle; apt still verifies the signed InRelease;
- exact versions read from that snapshot's trixie `Packages` index: `bubblewrap=0.12.0-1~deb13u1` (depends libc6, libcap2, libselinux1) and `socat=1.8.0.3-1+deb13u1` (depends libc6, libssl3t64, libwrap0).

Nothing was built.

- **Reverted, not dropped from history.** Commit `c509ca1d` changed `apps/runtime/Dockerfile` and made `scripts/qualification/assembled-image/source-proof.test.mjs` fail 1 of 5 (the recipe is a frozen proof row). The image recipe belongs to the shipping/candidate owner and must be reconciled with dot's minimal `FROM scratch` proposal, so the lead reverted it at the final pin; source-proof passes 5/5 again. Proposal for the image owner: add `bubblewrap=0.12.0-1~deb13u1` and `socat=1.8.0.3-1+deb13u1` from the fixed snapshot above (diff available in `c509ca1d`), then issue a new candidate manifest. Until the worker image carries them, the readiness check reports not ready and Bash stays disabled.
- **Coordination.** dot's unpublished minimal `FROM scratch` runtime proposal would need bwrap, socat and their ELF closure in `runtime-root-policy.json`.

## Checks (Node v24.21.0)

1. `node --test apps/worker/conversation/test/*.test.mjs`: **103/103 pass**, 3 runs (2 at default concurrency, 1 with `--test-concurrency=1`). New test files: `policy-resolution` (8), `bash-sandbox` (6), `skill-plugin-binding` (4), `sandbox-readiness` (5), `legacy-tools-excluded` (5). Extended files: `capabilities`, `options-capabilities` and `activity-capabilities` (3 new activity tests).
2. `node --test apps/worker/conversation/continuation/test/*.test.mjs apps/worker/conversation/skills/test/*.test.mjs`: 82/82 pass.
3. `node --test packages/skills/test/*.test.mjs`: 60/60 pass.
4. `cd apps/control/conversations && npx tsc --noEmit -p tsconfig.json`: pass. This project includes `options.mjs` and so reaches `fragment`, `skill-plugin`, `bash-sandbox` and `workspace-tools`.
5. A temporary scratch config extending that tsconfig over `capabilities/*.mjs`, `sandbox-readiness/*.mjs` and `options.mjs`: passes after fixing the errors it first reported (JSDoc parameter names, `noUncheckedIndexedAccess` indexing, implicit any). `cd apps/runtime && npx tsc --noEmit`: pass.
6. A real local run of the pinned SDK through the readiness check, with no model request. This container has no bwrap or socat. The result was `sdkStartup: refused / SANDBOX_DEPENDENCIES_MISSING`, `modelTurns 0`, `userMessagesSent 0`, CLI exit 1 (not ready), temp directories removed and no CLI process left. Two related measurements on CLI 2.1.295:
   - with `failIfUnavailable`, the CLI returns an `error_during_execution` result with cost 0 instead of starting;
   - `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` makes the CLI itself require bubblewrap and exit even earlier.

   This is local readiness only.
7. Wider importers, branch versus a detached snapshot of `6d9bb39` with the same `node_modules`:

   | Suite | Branch | Base | Notes |
   | --- | --- | --- | --- |
   | `apps/control/conversations/skills/test` plus 6 runtime tests | 80/85 | 80/85 | The same 5 environment failures as P1a reported (`path argument undefined`, mounted DOCX pipeline) |
   | `apps/control/conversations/test` | 170/244 | 170/244 | 74 failures need an allocated test database or source root |
   | `npm run check` | 4238/4241 | 4238/4241 | Same 3 failures |

   One later rerun showed 2 extra load-timing failures in `lifecycle-transition.test.mjs`. That file passes 20/20 three times in isolation on both branch and base, and `apps/control` is unchanged by this branch.
8. `source-proof.test.mjs`: 5/5 at the final pin `ff52b9e` (the recipe commit `c509ca1d` made it 4/5 and was reverted, as described above; dot independently reproduced 5/5).

Not run or blocked:
- `apps/runtime/test/image-closure.test.mjs`: needs Docker, and no build is authorized.
- Any live CLI permission-rule check: `Read(//…)`/`Edit(//…)` matching, an absolute Glob pattern, a symlink inside cwd.
- Any real sandboxed command, network refusal, credential scrub or `/proc` exposure check, which needs the synthetic budget and an attested host.
- Fargate or the dedicated host.

Repository size or architecture guard: none exists in the repository. New modules are cohesive: the resolver, Bash sandbox, readiness orchestration, host ports and CLI are kept separate.

## Legacy tool exclusion (owner request)

`test/legacy-tools-excluded.test.mjs` carries the owner's 43 names verbatim. For each name it asserts:
- the catalog original is `deferred` with no replacement;
- the name is absent from catalog operations, their SDK tool names and aliases;
- it is absent from every packaged original manifest's `allowedOperations`;
- `resolveOperationContract` refuses it;
- it is absent from the SDK tool surface the worker can build: built-ins, file tools, subagents, skill-plugin names, a fully enabled fragment, and `meri_original_reads` tool names for every selectable skill.

There is no product browser tool list on this branch. Only the qualification browser probe is scanned, and it uses none of the names. No catalog or contract file is edited.

## Integration needs

1. dot to review proposals A and B before any freeze, then provide the receiver and Core's policy storage.
2. The runtime preparation owner to run `sandbox-readiness/cli.mjs` on the actual worker host, decide `--outer-isolation-boundary`, and pass `bashSandbox`. The runtime launch configuration hashes the env and args, so `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` and the `--settings`/`--managed-settings` content must be part of the prepared request when Bash is admitted. Until then the launch fails closed.
3. The shipping or candidate owner to decide the bubblewrap/socat image proposal (the recipe commit is already reverted at `ff52b9e`; nothing needs dropping), cut a new candidate manifest if accepted, and reconcile it with the FROM-scratch proposal.
4. Placement approval if Bash is wanted anywhere Fargate cannot run bubblewrap.

## Successor-review repairs (15 October 2026)

Branch `fable/p2a-r-readiness-plugin-20261015`, based on `ff52b9e`. Acceptance: dot's corrected P2a capability-policy re-review (HOLD on P2a-R1 and P2a-R2; telemetry receiver direction accepted as a proposal only). The accepted narrow repairs (hook latch, explicit Bash flag, pure resolver, canonical plugin-path equality in options) are unchanged. No contract, UIEvent, migration, lockfile, Dockerfile, credential, deployment or cloud change. Node v24.21.0.

### Outline (recorded before the changes)

| Finding | Owning module | Change |
| --- | --- | --- |
| P2a-R1 readiness | `sandbox-readiness/` | New pure `startup-observation.mjs` accounts for every frame/failure and derives one verdict; `readiness.mjs` keeps orchestration only (start, race, quiet window, deliberate shutdown, cleanup) |
| P2a-R2 plugin/workspace | `capabilities/skill-plugin.mjs` | Fail closed when the workspace does not exist (no lexical fallback) |
| Digest blocker 1 (worker side) | `capabilities/hooks.mjs` | Refuse a missing/non-string required SDK string field; no contract or event-shape change |
| Report corrections | this report | Stale "4/5" check and "drop the recipe commit" integration item corrected |

### P2a-R1: readiness verdict over every observed SDK frame (closed in source)

- Every frame is validated and counted. Bookkeeping `system` frames from a closed startup list (`init`, `status`, `hook_*`, `plugin_install`, `commands_changed`, `worker_shutting_down`) are tolerated; frames that exist only after a model request (`assistant`, `user`, `stream_event`, `rate_limit_event`, `tool_progress`, `tool_use_summary`, `prompt_suggestion`, and `system` `api_retry`/`thinking_tokens`/`model_refusal_*`/`compact_boundary`/`memory_recall`/`permission_denied`) are model activity; anything else, or a non-object/typeless frame, refuses.
- Every result frame, success or error, is accounted. `num_turns` must be a non-negative safe integer and `total_cost_usd` a finite non-negative number (otherwise `SDK_FRAME_MALFORMED`); both are summed over all results. Any turn or cost refuses with `READINESS_MODEL_TURN_OBSERVED` (now a refused report, previously an exception with no report). An error result refuses with the bounded reason code. A zero-usage success result still refuses (`SDK_UNEXPECTED_RESULT`): the probe never asks for a turn.
- The verdict is computed once, after the full consumption and the deliberate shutdown, in fixed precedence: model activity, malformed frame, startup error (error result, `initializationResult()` rejection, iterator rejection or `query()` throwing), unexpected frame/result, stream ending on its own, timeout, missing initialisation, failed shutdown, then `ready`. Contrary evidence observed at any time, including after initialisation and during the shutdown, therefore wins over an earlier `ready`.
- Initialisation is followed by a 1 s quiet window (`OBSERVE_MS`) that ends early on contrary evidence.
- **Deliberate shutdown versus startup failure.** After the probe begins its own close, a normal end of the stream or an `AbortError` from the iterator is the deliberate shutdown. Any other iterator failure (`SDK_SHUTDOWN_FAILED`), a throwing `close()` (`SDK_CLOSE_FAILED`), a consumer that does not settle within 5 s (`SDK_CLEANUP_TIMEOUT`) or an unremovable temp directory (`READINESS_CLEANUP_FAILED`) is a failed shutdown (`shutdown:'failed'`) and never ready. Before the close begins, the stream ending or failing for any reason is an unexpected startup failure.
- `sdkStartup` now reports `{status, reasonCode, userMessagesSent:0, modelTurns, costUsd, messagesObserved, resultsObserved, initialized, shutdown}` (schema still `0.1-proposal`). `toBashSandboxAttestation` additionally requires a clean verdict (ready, initialised, no result, zero turns and cost, clean shutdown), so a report whose `ready` flag contradicts its verdict is not available.

Regressions, `test/sandbox-readiness-verdict.test.mjs` (11 tests, scripted ports, synthetic control flow): positive control (no frames, a tolerated `system` frame, an `AbortError` on close); reviewer case 1 (init, then success with `num_turns:1`, `total_cost_usd:0.01`); reviewer case 2 (init, then `error_during_execution` "Sandbox required but unavailable", zero usage); both race orderings for error and usage results, plus cost on an error result; multiple results; results during the shutdown; iterator throw and unprompted end after init; model-activity, malformed and unexpected frames; close failure, non-abort shutdown failure, unsettled consumer, temp-dir removal failure, timeout with an unsettled consumer; `query()` throwing; tampered reports. Every negative asserts `ready:false` and `available:false` with and without the outer-boundary assertion, no user message, exactly one close, and temp-dir removal. `test/sandbox-readiness.test.mjs` is updated for the new report fields only.

Reverted-fix proof: with `readiness.mjs` temporarily restored to `ff52b9e`, all 11 tests fail. Both reviewer cases fail on the `ready:false` assertion with the old verdict `{"status":"ready",...,"messagesObserved":1}`; the positive control fails only on the new report fields.

### P2a-R2: missing workspace refused (closed in source)

Runtime preparation provides the workspace (`configuration.workspace`, restored into by the supervisor) before `buildConversationOptions`/`createSdkCapabilities` run, and the SDK cannot start in a missing cwd, so a missing workspace has no legitimate use here. `assertSkillPluginDirectory` now resolves both the plugin and the workspace with `realpath` and requires both to be existing real directories; any error (missing, dangling link, not a directory) refuses with `SKILL_PLUGIN_DIRECTORY_REFUSED`. The lexical pre-checks, plain-tree walk and the exact trusted-path equality in `options.mjs` are unchanged.

Regressions in `test/skill-plugin-binding.test.mjs` (2 new tests, real temporary directories): the reviewer's exact probe (`root/workspace-alias -> root/plugin`, workspace `root/workspace-alias/missing-conversation`); a dangling workspace link into the plugin; the reverse direction (plugin beneath the directory an aliased workspace parent resolves to, both with an existing workspace and with a missing one); a canonical but missing workspace; a file as workspace; the same through `buildConversationOptions`; controls (canonical disjoint accepted, existing alias into the plugin refused, `/./` plugin spelling refused, canonical trusted path still bound exactly). An ancestor of an existing plugin always exists, so the "workspace contains the plugin" direction with a missing leaf cannot occur; it is covered by the existing-alias case.

Tests that bound the plugin to the nonexistent `/workspace/conversations/<id>` path (`capabilities`, `options-capabilities`, `legacy-tools-excluded`) now use `preparedWorkspace()` from `capability-fixture.mjs`, a real directory as runtime preparation provides; one hard-coded `Read(//workspace/...` prefix assertion now derives from that path. The 43-name exclusion assertions are unchanged.

Reverted-fix proof: with `skill-plugin.mjs` restored to `ff52b9e`, both new tests fail ("Missing expected exception: missing leaf beneath a parent aliasing into the plugin", and the missing options workspace).

### Worker-side digest fix (freeze blocker 1, local behaviour only)

`hooks.mjs` normalised a missing `compact_summary` to `''` and digested a missing `error` as `null`. Both are required `string` fields in the SDK hook types (`PostCompactHookInput`, `PostToolUseFailureHookInput`). They are now refused through the existing latch (`COMPACTION_INPUT_REFUSED` / `AUDIT_INPUT_REFUSED`, loop stopped, `check()` throws `CAPABILITY_HOOK_FAILED`); a present value, including `''`, is digested exactly as before. `test/hook-digest.test.mjs` (4 tests) pins the vectors below and these refusals. Reverted-fix proof: with `hooks.mjs` restored, the two refusal tests fail; the vector and unknown-field tests pass on both (they pin unchanged behaviour). `hooks.mjs` is outside this lane's named paths; the lead authorised this local fix, and the accepted latch is untouched.

### Checks

| Check | Base `ff52b9e` | This branch |
| --- | --- | --- |
| `cd apps/worker/conversation && node --test 'test/*.test.mjs'` | 103/103 | **120/120**, 3 runs (2 default concurrency, 1 `--test-concurrency=1`) |
| `node --test 'continuation/test/*.test.mjs' 'skills/test/*.test.mjs'` (same package) | 82/82 (lane report) | 82/82 |
| `node --test 'packages/skills/test/*.test.mjs'` | 60/60 (lane report) | 60/60 |
| `node --test scripts/qualification/assembled-image/source-proof.test.mjs` (repo root) | 5/5 | 5/5 |
| `apps/control/conversations`: `npx tsc --noEmit -p tsconfig.json`; `apps/runtime`: `npx tsc --noEmit` | pass | pass |
| Scratch strict `checkJs` config over the changed modules | n/a | no errors in `capabilities/*`, `sandbox-readiness/*` or `options.mjs`; `checkJs` also reaches `continuation/*.mjs`, which reports pre-existing implicit-any errors outside this lane |
| Real pinned SDK readiness run on this container (no bwrap/socat, no model request) | refused / `SANDBOX_DEPENDENCIES_MISSING` | refused / `SANDBOX_DEPENDENCIES_MISSING`, `initialized:false`, `shutdown:'clean'`, 0 turns, 0 cost; no CLI process left |

Not run: a ready-host SDK startup (needs bubblewrap/socat on an attested host), so the real CLI's frames and iterator behaviour on a deliberate close of an initialised session are unmeasured; if it throws a non-abort error there the check reports `SDK_SHUTDOWN_FAILED` (fail closed) and the classification must be revisited with that measurement. The tolerated startup `system` subtypes come from the SDK types, not a live trace. Every item in the earlier "Not run or blocked" list is still unrun.

### Proposals for dot: telemetry receiver freeze blockers (proposal text only; nothing frozen or edited)

**T1. One digest rule.** `digest(v)` = lowercase hex SHA-256 of the UTF-8 bytes of the RFC 8785 (JCS) serialisation of the JSON value `v` (`canonicalSha256` in `packages/contracts/validate.mjs`). For a string this includes the surrounding quotes and JCS escaping: only `"`, `\` and U+0000–U+001F are escaped (`\b \t \n \f \r` short forms, otherwise `\u00xx` lower-case); every other code point, including U+2028/U+2029 and astral characters, is literal UTF-8. Field classes:
- SDK-required string fields (`error`, `compact_summary`): absent, `null` or non-string is refused and latched (worker fix above), never digested as `''` or `null`. `''` is valid.
- SDK-required `unknown` fields (`tool_input`, `tool_response`): JSON cannot carry `undefined`, so an absent key and `null` both digest as `null`.
- A lone surrogate has no UTF-8 encoding; the JCS serialiser throws and the projection is refused and latched. The same holds for any value JCS cannot serialise.
- `summaryBytes` is the UTF-8 byte length of the string value itself (no quotes, no escaping), 0–16 777 216; larger is refused.
- The receiver cannot recompute digests (it never sees raw values); it validates `^[0-9a-f]{64}$`.

| Vector | JSON value | Exact canonical bytes | SHA-256 |
| --- | --- | --- | --- |
| empty | `""` | `""` | `12ae32cb1ec02d01eda3581b127c1fee3b0dc53572ed6baf239721a03d82e126` |
| absent or null (`unknown` fields only) | `null` | `null` | `74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b` |
| escaping | `a"b\c` + LF + TAB + `/` | `"a\"b\\c\n\t/"` | `37cbb89a95cfae327a2e8681bc1627570b46bbf6b4a0cb672c174d38ebb9d05d` |
| control | U+0001 | `"\u0001"` | `b81cfb0a6715e53b373345b49e8ad94eb55fd777519dc539373d0634973c186e` |
| Unicode BMP | U+00E9 | `"é"` (4 bytes: quotes plus 2-byte UTF-8) | `f2886017e9c7abacf804b54d64787dce2b611c9544ba21f3affdd126a6e50086` |
| Unicode astral | U+1F600 | `"😀"` (literal) | `7a0c50b92434b015545fe93ab723db2d4b2cdd14a441405624a9ce8be29f1d5a` |
| U+2028 | U+2028 | literal, unescaped | `8aa716ff98153a8b537e4e21f27cb75d7ebe92f4754aca11a38ee7a27b714941` |
| key order | `{b:1,a:[true,null,"x"]}` | `{"a":[true,null,"x"],"b":1}` | `54a65415ad370228851a1da4b31b6fd42dc58b19a50d35cae759325f7388ce64` |
| missing required string | absent `compact_summary` / `error` | refused | none |
| lone surrogate | U+D800 | refused | none |

**T2. Closed bounds.** Proposed for the receiver schema and mirrored by the worker before publishing. Today the worker's `agentId`/`agentType` are unbounded strings, so this needs a worker change once agreed.
- `agentId`: `null` or `^[A-Za-z0-9_-]{1,128}$`. `agentType`: `null` or one of `research`, `analysis`, `artifact_production`, `verification`, `subagent`. Both are `null` together or non-null together. This is the same rule in `tool.audit`, `compaction.boundary` and `subagent.lifecycle`; in `subagent.lifecycle` both are required non-null. Real SDK agent-id formats must be measured before freeze.
- `toolUseId` `^[A-Za-z0-9_-]{1,128}$`; `tool` `^[A-Za-z0-9_]{1,64}$` (MCP names to be measured); `durationMs` `null` or an integer 0–86 400 000; `trigger` `manual|auto`; `interrupted` boolean.
- `telemetryId`: lower-case UUID v4. `sequence`: integer 1–4096 (the per-run cap, far below 2^53−1). `createdAt`: exactly `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`, and it must round-trip through `new Date(x).toISOString() === x`.
- Size: every string field is ASCII-pattern-restricted, so the persisted event `{contractVersion, telemetryId, sequence, createdAt, type, data}` has a computed JCS maximum of 777 bytes (`tool.audit` failed; completed 763, compaction 489, lifecycle 365), below the 1 KiB cap. `RunBinding` is not part of the bounded bytes: its JCS worst case is 1 799 bytes (128-character tenant/actor ids of control characters). The receiver takes the binding from the run-owner credential and its own run record, and the request's binding must equal it. The receiver refuses any request whose JCS body exceeds 1 024 bytes, or that fails the schema, before persistence. It stores and logs only a refusal code, never the rejected body.

**T3. Cursor, idempotency and fencing in one transaction.**
- *Allocation and serialisation.* The worker composer allocates `sequence` from one per-attempt counter. Publication goes through a single in-flight queue (concurrent hooks from parallel subagents are serialised), so requests arrive in sequence order. The receiver is the authority and enforces contiguity.
- *Receiver transaction* (one database transaction holding the run's row lock, the same lock used for terminalisation and fence advance):
  1. Authenticate the run-owner credential, rejecting revoked or expired credentials (checked per request, not cached), and derive the binding.
  2. Look up `(runId, telemetryId)`. If present with identical canonical bytes and an identical stored binding (attempt, worker, fence), acknowledge with the stored sequence and write nothing. If present with different bytes or binding, refuse `TELEMETRY_CONFLICT`.
  3. If the credential's attempt, worker or fence is not current, refuse `STALE_WRITER`.
  4. If the run is terminal, refuse `TELEMETRY_RUN_TERMINAL`.
  5. Require `sequence === head + 1`, otherwise `TELEMETRY_SEQUENCE_GAP`, and require `sequence ≤ 4096`.
  6. Insert the row (unique `(runId, sequence)` and `(runId, telemetryId)`), advance the head, commit, then acknowledge.

  Step 2 before steps 3–4 reconciles "events after terminal refused" with "identical replay accepted": after terminalisation only a byte-identical replay of an already committed event from the same binding is acknowledged, and nothing new is written.
- *Resume.* The cursor is per run and continuous across attempts. The transaction that advances the fence for a new attempt/worker reads the head; `load`/resume returns `{telemetryHead}`, and the new attempt continues at `head + 1`. The old writer is fenced out from that commit, so its uncommitted events are refused and never re-sent. An unknown outcome of an old in-flight event never licenses re-sending it under the new binding.
- *Reads.* `history({runId, after, limit ≤ 256})` for authorised audit principals only, with tenant scope from the receiver's record. It is never streamed to the UI. Retention and purge follow the run's audit record, as decided by the control owner.
- Any refusal is a latched worker failure, as today.

**T4. Receiver and worker adapter remain unimplemented.** The composer still calls `runOwner.append` with `eventId`, and the control service still accepts only `run.status`/`message.delta`, so capability events fail closed today. After T1–T3 are accepted: a new `runOwner` telemetry port and adapter in `capabilities/index.mjs` (worker), and the receiver plus storage (control owner, with a centrally allocated migration). Not started here. UIEvent 0.1.0 is unchanged.

### Residual risks

- Readiness is still local evidence only. The quiet window is a bounded heuristic: a contrary frame the SDK never delivers after `close()` cannot be observed.
- The plugin check proves canonical, existing, disjoint paths at check time only. It does not prove an immutable mount, ownership, file hashes, or the absence of a workspace swap between the check and SDK start; the runtime preparation/image owner must establish those.
- The telemetry receiver, bounds and cursor are proposals; hooks must stay off in real runs until dot accepts and implements them.
