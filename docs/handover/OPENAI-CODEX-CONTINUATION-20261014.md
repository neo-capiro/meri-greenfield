# Current OpenAI/Codex continuation

Use this guide for fresh project workers. The human's latest instruction keeps Meri engineering, review and coordination within OpenAI/Codex. Do not hand off engineering to Claude, Fable, Hermes or another external coding agent. Preserve the existing product architecture: Claude Agent SDK remains the approved product orchestration loop, alongside the existing model/provider integrations, AI SDK UI transport and Temporal. Changing project workers does not authorize changing product providers.

Read [AGENTS.md](../../AGENTS.md) and [implementation standards](../IMPLEMENTATION-STANDARDS.md) before work. Use dedicated worktrees and exact reviewed bases. Parallelize bounded independent work only within the user's authorized OpenAI/Codex sessions, with one owner per shared interface, contract, lock or migration. Independently review returned source and evidence before acceptance; do not recursively delegate or use background schedulers. Dated [11 October instructions](20261011/CONTINUATION-INSTRUCTIONS.md), [remote pickup records](20261011/REMOTE-PICKUP.md) and Hermes evidence remain unchanged historical records. Their external-worker execution directions are superseded by this guide.

## Recover the current source

Repository: `neo-capiro/meri-greenfield`. The source/evidence stack below is published as draft PRs. Verify remote heads and actual local state before choosing a new base; these are pickup pins, not assertions that remote heads can never change. Fetch a reviewed commit into a new branch/worktree without resetting another session's checkout. A PR being published or mergeable does not establish deployed acceptance.

| Draft | Recorded head | Relevant increment |
| --- | --- | --- |
| [66](https://github.com/neo-capiro/meri-greenfield/pull/66) | `53c845e2da5e3c038d05688f3bafbd634391f38f` | Original continuation base |
| [67](https://github.com/neo-capiro/meri-greenfield/pull/67) | `c87a7321db17091db4baac75182d4727ad8acd75` | Fresh SDK session capture and registration barrier |
| [68](https://github.com/neo-capiro/meri-greenfield/pull/68) | `23707a621d960e6492f1deb963ecddaa22b3004b` | Native task-authority and first-run adapters |
| [69](https://github.com/neo-capiro/meri-greenfield/pull/69) | `a8655da564233e5a7b5ba4e53838ba923fb7f69d` | Local database refusal and zero-provider SDK mechanics evidence |
| [70](https://github.com/neo-capiro/meri-greenfield/pull/70) | `742e57287db5294f84724b6c1878c113bff3bba8` | Control mount factory using the owned pool/native client |
| [71](https://github.com/neo-capiro/meri-greenfield/pull/71) | `7e822a7cfe5150b2c8d8fc1d5984fd2348ae4866` | Fixed ten-route native runner relay and backend extraction boundary |

PR71 is the source base for this instruction update. Preserve previous branches, worktrees, failed checks and qualification evidence. The prior local `/workspace/meri-greenfield` checkout is not the latest integration head. A fresh machine need not have the old absolute paths; recover the committed records through the repository. Report exact remote/source pins and checks actually run.

Start with [the relay handoff](../coordination/reports/CODEX-NATIVE-RUNNER-GATEWAY-20261014.md), [the first-run binding report](../coordination/reports/CODEX-FIRST-RUN-BINDINGS-20261014.md) and [the local qualification report](../coordination/reports/CODEX-FIRST-SESSION-LOCAL-20261014.md). Their committed candidate directories preserve successful and failed outcomes. Public contract candidate is `0.1.5`, frontend contract candidate `0.1.3`; the private RuntimeVersions contract/checkpoint format remains a separate `0.1.0` version domain. Qualified local SDK/CLI mechanics used `0.3.295` / `2.1.295`. These are source/local pins, not deployed provider or image acceptance.

## Next executable gate

The objective remains one real authenticated conversation, followed by a separately approved output run producing editable DOCX. The relay and mount source increments are accepted; the authenticated first session and output remain HOLD. The local SDK `/status` probes had zero model turns, zero cost and zero provider requests; scripted transport ACKs and local database refusal checks do not supply native authority or prove a product conversation.

Obtain genuine owner inputs before a live first-session attempt: approved canonical application-authority origin and current identity; approved product database with current allocation/grants; actual native task verifier; independent registration reader for authentic native init/main session observations and original expiry; genuine native broker/execution/runtime with model/proxy pin and physical isolation; and approved Temporal endpoint, namespace, queue and TLS bindings. The independent reader must be independent of the worker/control observation producer. It does not require another repository or a second Capiro Meri runtime. Do not substitute worker-reported keys, fixture receipts or fabricated registration/readiness replies.

Read [the Capiro backend integration boundary](../coordination/reports/CODEX-CAPIRO-BACKEND-INTEGRATION-BOUNDARY-20261014.md) before cross-repository coordination. Preserve/extract the native application identity/context bridge and shared domain authorization/read services when the new private backend removes legacy Meri. SDK, broker, Temporal, artifacts and native runner execution remain in Meri. Do not infer the bridge is absent from a stale checkout or add a second backend agent runtime.

The current task authorizes no paid provider calls, AWS changes, production writes, credential creation or security changes. Do not assume credentials or physical isolation. There is no staging environment. Document creation requires separate explicit output approval and approved renderer/storage resources; otherwise record output awaiting approval. Frontend preview and cleanup remain separate workstreams. Preserve the stopped protected PostgreSQL qualification fixture and other sessions' resources; previous use of a fixture is not permission to restart, reset or reseed it. Wait through the supported startup mechanism only if the needed execution environment is transiently starting.

Implement only independent source gaps supported by actual available inputs. Run meaningful targeted checks, preserve failures and their rerun reasons, obtain independent OpenAI/Codex review, and publish qualified changes as focused draft PRs. Do not broaden scope, repeat settled tests without a changed reason, merge or deploy merely because a draft is published. Report precise blocked action, missing owner/input, actual results and remaining HOLD gates.
