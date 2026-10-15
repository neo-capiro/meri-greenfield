# Fable lane P1a: default-off Claude Agent SDK capabilities (15 October 2026)

Branch `fable/p1a-sdk-capabilities-20261015`, base `ba40647`. Owned paths: `apps/worker/conversation/**`, `packages/skills/**` and this report. SDK `0.3.295`, CLI `2.1.295`. Every option, hook event, hook input field and Agent tool field used here was checked against `apps/worker/qualification/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` and `sdk-tools.d.ts`. No contracts, lockfiles, migrations, credentials, network, deployment or cloud actions.

## Implementation outline

Responsibilities and owners:

- The **Claude Agent SDK** still owns the model loop, tool selection, subagent execution, compaction and plugin loading. This lane only configures supported options for it.
- The **control run owner** decides whether a run gets capabilities. It does that by returning a sibling `capabilities` policy beside `run` from `load`. The closed `Run` contract cannot carry the policy, so it sits beside `run`; see "Contract proposal" below. Today's control service never returns it, so production stays off.
- The **runtime preparation owner** supplies trusted facts: `cwd` and an optional `skillPluginDirectory`, which is the immutable image copy of the plugin. The policy never carries paths, credentials or authority.
- The **worker conversation activity** validates the policy before any claim. It builds the fragment only when a policy is present, displays admitted progress summaries, and fails the run if a capability event was refused.

Modules and their public interfaces (`apps/worker/conversation/capabilities/`):

| Module | Responsibility |
| --- | --- |
| `policy.mjs` | `assertCapabilityPolicy` and `readCapabilityPolicy`. The policy has flags `subagents`, `auditHooks`, `compactionHooks`, `skillPlugin`, `workspaceTools` and `subagentProgress`, all default `false`. It also has bounded allowlists `subagentTypes`, `workspaceToolNames` and `skillNames`, plus `maxParallelSubagents`, which ranges from 1 to 4 and defaults to 2. The result is frozen, and validating it a second time returns the same policy. |
| `workspace-tools.mjs` | Built-in `Read`/`Write`/`Edit`/`Glob`/`Grep`/`Bash` (as allowlisted). One path rule, `withinWorkspace`, serves both a PreToolUse gate and `canUseTool`. The gate is needed because tools in `allowedTools` skip `canUseTool`. Rules: absolute paths must be under cwd; Glob `pattern` and Grep `glob` must be relative and must not escape. For Bash, `..`, `~`, `$`, backticks, NUL, a directory change with no target, and any absolute path outside cwd (other than `/dev/null`) are refused. Every other built-in tool goes into `disallowedTools`. |
| `subagents.mjs` | SDK `agents` for `research`, `analysis`, `artifact_production` and `verification`. Each sets `description`, `prompt`, `tools`, `disallowedTools` (always `Agent`, so subagents cannot nest), `model: 'inherit'`, `maxTurns` and `omitClaudeMd: true`. Subagent tools are limited to the workspace tools the policy enables, so the default is no tools. A PreToolUse admission gate on `Agent` checks the declared type and rejects `model`, `isolation`, `mode` and `team_name`. It forces `run_in_background:false` and counts in-flight calls against `maxParallelSubagents`. |
| `skill-plugin.mjs` | SDK `plugins: [{type:'local', path, skipMcpDiscovery:true}]` and `skills` set to plugin-qualified names (`meri-original-skills:<name>`). `Skill` is listed in `tools` but not in `allowedTools`, because the d.ts marks that entry as deprecated. `canUseTool` admits only those exact names. The directory must be absolute and must not be cwd, inside cwd or a parent of cwd. `settingSources` stays `[]`. |
| `hooks.mjs` | PreToolUse, PostToolUse and PostToolUseFailure publish `tool.audit` with tool name, tool-use id, `canonicalSha256` of the input and response or error, duration, interrupt flag and subagent origin. PreCompact and PostCompact publish `compaction.boundary` with the trigger plus the summary's SHA-256 and byte count. SubagentStart and SubagentStop publish `subagent.lifecycle` with the agent id and type. Raw input, output, errors, summaries, transcript paths and last assistant messages are never published. A refused publication denies the tool (PreToolUse) or returns `continue:false` (other hooks). |
| `progress.mjs` | Displays SDK `task_progress` summaries as `message.delta` (`<type>: <summary>`), and only when `subagentProgress` is on. Task descriptions and subagent frames carrying `parent_tool_use_id` are never displayed. |
| `fragment.mjs` | `assertCapabilityFragment` validates own keys only and refuses unknown keys, undeclared hook events, matcher `timeout`, foreign agent types and non-image plugin paths. `mergeCapabilityFragment`, `mergeHookSets` and `chainPermissions` do the merging. |
| `index.mjs` | `createSdkCapabilities(policy, {runOwner, binding, cwd, skillPluginDirectory?, now, newId})` returns `{policy, options, check()}`. An all-off policy yields `{}`. Events go through `runOwner.append` with the activity's binding, clock and id source. After the first refusal no further event is attempted, and `check()` throws `CAPABILITY_EVENT_REFUSED`. |

Other changes:

- `packages/skills/plugin.mjs` adds `describeSkillPlugin()` and `materializeSkillPlugin({directory})`. They generate `.claude-plugin/plugin.json` and byte-exact `skills/<name>/SKILL.md` through `index.mjs`. Thirteen originals are included. Bill Watch 1.0.0 is listed as excluded because it has no SDK frontmatter. No prose is copied into Git.
- `options.mjs` takes an optional fifth argument, the fragment, and accepts an optional `skillPluginDirectory` runtime fact. When the fragment is absent, the output keys, order and values are unchanged.
- `activity.mjs` reads the policy before claim, builds the fragment only when a policy is present, and adds progress parts. It calls `capabilities.check()` at the successful result frame, before completion or checkpoint capture.

Dependency direction: `activity → capabilities/index → {policy, workspace-tools, subagents, skill-plugin → packages/skills/plugin → packages/skills/index, hooks, fragment}`, and `options → capabilities/{fragment, skill-plugin}`. Shared validators are reused: `canonicalSha256` from `packages/contracts/validate.mjs`, `own` from `commands-0.2/execution-boundary.mjs`, and `validateShape('RunBinding')`. There are no circular imports, and importing any module has no side effects.

Failure ownership:

- An invalid policy is refused before claim. The run stays `queued` and no SDK query is made.
- An invalid fragment or a missing plugin directory after claim produces a `failed` run (`EXECUTION_FAILED`).
- A refused capability event denies or stops inside the SDK, and the run then fails at the result frame.

## What is now configurable, and what stays off

These SDK features can now be turned on per run, all off by default:

- `agents` and `agentProgressSummaries`
- `hooks`: PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, PostCompact, SubagentStart, SubagentStop
- `plugins` and `skills`
- `tools`, `allowedTools`, `disallowedTools` and `canUseTool` for the bounded built-in workspace tools

These stay off or unchanged:

- **SDK `sandbox`, `permissionMode` changes and `settingSources`.** The sandbox has not been qualified on the approved host, and `permissionMode` stays `default`. The workspace gate is a textual path rule, not isolation. It does not resolve symlinks inside cwd, and it cannot stop an allowed Bash program from reading its environment.
- **Bash in particular.** The SDK `env` gives the CLI process the proxy task capability (`ANTHROPIC_AUTH_TOKEN`), and Bash children probably inherit it. Bash should not be enabled for any run until a credential-free tool environment or the qualified sandbox exists. Policies can already leave it out with `workspaceToolNames`.
- **Model-invoked skills.** The original SKILL.md frontmatter sets `disable-model-invocation: true`, so loading the plugin makes the skills selectable explicitly, not chosen by the model. The existing explicit selected-skill path is unchanged.
- **Background, remote, worktree and model-override subagents.** All are refused. `forwardSubagentText` is never set.
- **Audit, compaction and subagent lifecycle events in production.** The control service (`apps/control/conversations/service.mjs` `publish`) admits only `run.status` and `message.delta`. With today's control owner, turning these hooks on therefore fails every run closed. This is tested with the real fixture service.

## Contract proposal (not edited; `packages/contracts/**` is frozen)

I propose the following for dot/Codex review.

1. Add the execution-record field `capabilities` to the run owner's `load` result. It sits beside `run`, because `Run` has `additionalProperties:false`, and its shape is the policy in `policy.mjs`.
2. Add three RunEvent variants:
   - `tool.audit`, with data `{phase:'requested'|'completed'|'failed', toolUseId, tool, inputSha256, agentId|null, agentType|null}` plus `responseSha256` and `durationMs|null` for completed calls, or `errorSha256`, `interrupted` and `durationMs|null` for failed ones.
   - `compaction.boundary`, with data `{phase:'pre'|'post', trigger:'manual'|'auto', agentId|null, agentType|null}` plus `summarySha256` and `summaryBytes` for the post phase.
   - `subagent.lifecycle`, with data `{phase:'started'|'stopped', agentId, agentType}`.
3. Add the same three types to the control `publish` allowlist.

These events are worker-attested telemetry and grant no authority. Until this is accepted, the event names are a worker-side proposal only.

## Checks run (Node v24.21.0)

- `node --test apps/worker/conversation/test/*.test.mjs`: 72/72 pass, 3 runs: 2 at default concurrency and 1 at `--test-concurrency=1`. This includes the new `capabilities.test.mjs` (8), `options-capabilities.test.mjs` (3) and `activity-capabilities.test.mjs` (5).
- `node --test apps/worker/conversation/continuation/test/*.test.mjs apps/worker/conversation/skills/test/*.test.mjs`: 82/82 pass.
- `node --test packages/skills/test/*.test.mjs`: 60/60 pass, including the new `plugin.test.mjs` (2).
- `cd apps/control/conversations && npx tsc --noEmit -p tsconfig.json` (this project includes `apps/worker/conversation/options.mjs` and therefore `fragment.mjs` and `skill-plugin.mjs`): pass. Its first run on the inherited work failed with 6 type errors in `fragment.mjs` and `skill-plugin.mjs`. The fixes were explicit fragment typedefs, null-safe permission chaining, a typed plugin description, and moving JSDoc annotations onto their own lines.
- A temporary strict tsc config in the session scratchpad covered `capabilities/index.mjs`, `progress.mjs` and `options.mjs` with the same compiler options. It passed after fixing 3 errors in `index.mjs`. The hook merge and permission chaining that `index.mjs` and `fragment.mjs` had each written separately are now one implementation, shared by both.
- `cd apps/runtime && npx tsc --noEmit -p tsconfig.json`: pass (unaffected).
- Wider importers: `node --test apps/control/conversations/skills/test/*.test.mjs` plus `apps/runtime/test/{sdk-configuration-directories,runtime,first-session,remote-conversation-runner,product-mount}.test.mjs` gave 60/65. The same 5 tests fail identically on a `git archive ba40647` snapshot with the same `node_modules`, so they predate this lane. The cause is `path argument undefined` in `skills/test/pipeline.test.mjs` (4 tests) and `read-association.test.mjs` (1 test), which points to the environment.

Failures that remain visible:

- **Timing flake (predates this lane).** `activity.test.mjs` "late SDK iterator is bounded by deadline…" sets a 30 ms runtime deadline. Under parallel load it sometimes expires before the SDK query starts (`calls 0 !== 1`). It failed in 2 of 4 runs of the expanded suite on this branch, and in 4 of 6 runs of the base snapshot under similar extra load. It passes alone and passed in the final recorded runs. It was left unchanged.
- **Inherited test expectation.** A `withinWorkspace` case in the inherited work expected the enabled-tool check inside the pure path rule. It was separated, so the path rule and the enabled-tool check are now asserted on their own.

Not exercised: no real SDK process, CLI plugin loading, live hook delivery, subagent execution, compaction or model call. All SDK behaviour here comes from scripted frames and direct hook invocation, so none of this is live, sandbox, Fargate or release evidence.

## Integration needs and open questions

1. The runtime image build, owned by dot or the runtime owner, must call `materializeSkillPlugin` into an immutable image path and pass it as `skillPluginDirectory` from runtime preparation.
2. The contract and control owners need to accept or amend the proposal above before audit, compaction or subagent hooks can be on in any real run.
3. The policy source (per tenant, per request, or per skill manifest) and its authority are undecided. The worker only consumes it.
4. Bash enablement waits on the sandbox or a credential-free environment (see "What stays off").
5. The SDK documentation allows both plain and `plugin:skill` names in `skills`. Plugin-qualified names were chosen. This needs confirming against a live CLI load.
