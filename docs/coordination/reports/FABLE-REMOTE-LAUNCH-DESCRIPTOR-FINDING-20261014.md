# Finding: the real SDK launch descriptor cannot pass the remote launch gates at PR86 (slice 3)

Base `c6053e24b465be677cc5980533009b4aab03beab`. Author: Fable. Evidence: `docs/qualification/candidates/fable-first-chat-rehearsal-20261014/` (two machine-written receipts from `scripts/qualification/first-chat-rehearsal/capture-sdk-descriptor.mjs`, no process spawned, no network, secret values hashed).

## What was attempted

Slice 3 set out to run the composed first-chat path locally with the real pinned CLI 2.1.295 inside the existing remote task composition (real PostgreSQL 16, real supervisor process, synthetic ECS/identity, zero model turns), extending `apps/runtime/native-authority/test/prepared-runtime-pg.test.mjs`, whose native child is a Node stand-in. The first step is to feed the real SDK's launch descriptor, produced from the product option builder (`apps/worker/conversation/options.mjs`), through the same gates the remote task applies to a descriptor: `prepareNativeSdkQuery` (inert JSON), `matchPreparedDescriptor`/`remote-task-http` (per-task config directories under the approved parent, exact env equality with the configured launch template) and `compileNativeLaunch` (string-only env, forbidden keys). That step fails at PR86 for three distinct reasons, so the full rehearsal was not run and no passing end-to-end receipt is claimed.

## What the receipts show

The SDK hands its spawn hook exactly `options.env` plus three SDK constants (`CLAUDE_CODE_ENTRYPOINT=sdk-ts`, `CLAUDE_AGENT_SDK_VERSION=0.3.295`, `CLAUDE_CODE_SDK_READS_SESSION_STATE=1`); it does not merge the host environment and it adds no config directory. The argv for the product option set is deterministic and recorded in the receipt (`--output-format stream-json --verbose --input-format stream-json --max-turns=1 --max-budget-usd=… --model=… --permission-prompt-tool=stdio --tools= --setting-sources= --permission-mode=default --include-partial-messages --session-mirror --settings {"autoMemoryEnabled":false}`).

| Gate | PR86 option builder | After reconciliation 1 (this slice) |
| --- | --- | --- |
| Inert JSON descriptor (`prepareNativeSdkQuery`) | FAIL: `ANTHROPIC_API_KEY`/`CLAUDE_CODE_OAUTH_TOKEN` are `undefined` entries, which `data()` refuses | PASS |
| `CLAUDE_CONFIG_DIR` present under the approved config parent (`remote-task-http`, `matchPreparedDescriptor`) | FAIL: absent | FAIL: absent (gap 2) |
| `CLAUDE_SECURESTORAGE_CONFIG_DIR` present | FAIL: absent | FAIL: absent (gap 2) |
| Static launch template equality | not reachable | OBSERVED: `ANTHROPIC_AUTH_TOKEN` (the per-task proxy credential) is inside the descriptor env, so a configured template could only match by containing the secret (gap 3) |
| `compileNativeLaunch` with the directories injected | FAIL (non-string values) | PASS |

Earlier Codex receipts did not meet these gates because they bypassed them: the single-query component probe built its own env (both config directories, loopback proxy, two disable flags) and derived the launch configuration from the SDK request itself; the composed PostgreSQL tests use a Node child with a fixed descriptor. Neither exercised the product option builder against the configured-template path.

## Reconciliation made in this slice (routine)

`buildConversationOptions` no longer places `undefined` entries in `env`. Node drops `undefined` env values at spawn, so the entries only ever served as "unset if inherited" for the SDK's default spawner; the remote path hands `env` verbatim to the launch plan, which admits only strings. Account keys stay out by omission, and the runner's existing `assertRunnerEnvironment` refuses any task process that inherits them. The existing option control now also asserts that every env value is a string and that neither account key is present. Worker suite 135/135 after the change.

## Remaining gaps, owner and proposed shape

- Gap 2 (bounded composition, `apps/runtime` and `apps/worker/conversation`): the task must create its per-task SDK config directory under `preparationIntent.configParentDirectory`, use `preparationIntent.secureStorageDirectory`, and the runner's `prepareRuntime` must carry both into the SDK options env (`CLAUDE_CONFIG_DIR`, `CLAUDE_SECURESTORAGE_CONFIG_DIR`) so the SDK materializes its configuration there before launch and the task's `captureSdkConfiguration` can pin it. This is implementation within the approved design; it can proceed as a Fable task once dot allocates the paths.
- Gap 3 (owner decision, `native-authority/preparation-intent.mjs`, `remote-task-http.mjs`, `prepared-candidate-config.mjs`): the configured `launchTemplate.env` is compared for exact equality after stripping only `CLAUDE_CONFIG_DIR`. The SDK places the per-task proxy credential in the env, so either the template must contain that secret (contradicting the secret-file configuration design) or the matcher must treat `ANTHROPIC_AUTH_TOKEN` like `CLAUDE_CONFIG_DIR`: stripped from the equality check and verified separately against the task's issued proxy credential. The second shape keeps secrets out of configuration and keeps the exact-argv guarantee; it changes a closed matcher and therefore needs dot's decision before code. The receipt's argv and env key set give the owner the exact approved template to configure.
- Not a gap: the CLI runs without `PATH`/`HOME` (the earlier Codex probe launched it with only the keys above), so no host environment needs to leak into the template.

## What this does and does not establish

It establishes, with reproducible receipts, that the product option builder and the remote launch gates disagree at PR86 and exactly how. It does not run the real CLI through the composed path, does not change any gate, and claims nothing about native, image, Temporal, provider or live behavior.
