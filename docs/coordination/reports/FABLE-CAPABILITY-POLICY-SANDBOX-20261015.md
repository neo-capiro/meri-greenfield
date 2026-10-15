# Fable lane P2a: capability policy, SDK-native confinement and sandboxed Bash (15 October 2026)

Branch `fable/p2a-capability-policy-sandbox-20261015`, based on `6d9bb39` (P1a). Owned paths are `apps/worker/conversation/**` and this report. There is one deliberate recipe edit in `apps/runtime/Dockerfile`, kept in its own commit (see "Runtime image recipe"). No contracts, lockfiles, migrations, credentials, deployment, paid build or cloud action were touched or used.

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
   - the query is then closed, its consumer awaited, temp directories removed, and any observed turn or cost fails the check.

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
2. **Plugin path binding.** `assertSkillPluginDirectory` requires `realpath(dir) === dir`, so no alias or symlink is allowed anywhere on the path. The directory must be a real directory whose tree holds only regular files and directories (bounded at 1024 entries and depth 8). It must be disjoint from the resolved workspace in both directions. `buildConversationOptions` refuses a fragment whose plugin path is not exactly the trusted `skillPluginDirectory` runtime fact, or that has plugins with no such fact. Tests use real temporary directories for an alias, a symlinked parent, a symlink to the workspace, a workspace reached through an alias, a symlink inside the plugin tree, a mismatch and a missing fact.
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
- **Digest semantics**: lowercase hex SHA-256 of the RFC 8785 canonical JSON (`canonicalSha256`) of the SDK hook field. For `compact_summary` and `error`, the digest is taken over the UTF-8 string value. Absent fields hash `null`. Digests support correlation only. They are never evidence of content, and the raw values are never transmitted or stored.
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

## Runtime image recipe (separate commit)

The worker runtime recipe is `apps/runtime/Dockerfile`, which builds the image that contains `apps/worker/conversation` and the SDK. It had no OS-package convention of its own. This lane follows `apps/worker/qualification/Dockerfile`:
- the fixed signed Debian snapshot `20261009T000000Z` with Signed-By keyring verification and `Check-Valid-Until: no`;
- HTTP, because the slim base has no CA bundle; apt still verifies the signed InRelease;
- exact versions read from that snapshot's trixie `Packages` index: `bubblewrap=0.12.0-1~deb13u1` (depends libc6, libcap2, libselinux1) and `socat=1.8.0.3-1+deb13u1` (depends libc6, libssl3t64, libwrap0).

Nothing was built.

- **Visible failure.** `scripts/qualification/assembled-image/source-proof.test.mjs` asserts that the proof row `apps/runtime/Dockerfile` is unchanged, and it now fails 1 of 5 tests. On the parent commit it passes 5/5. Fixing it requires a new candidate manifest from the shipping or candidate owner. This lane does not rewrite proof manifests. Drop commit `c509ca1d` if the recipe change should wait.
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
8. `source-proof.test.mjs`: 4/5, the intentional recipe failure described above.

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
3. The shipping or candidate owner to cut a new candidate manifest or drop the recipe commit, and to reconcile it with the FROM-scratch proposal.
4. Placement approval if Bash is wanted anywhere Fargate cannot run bubblewrap.
