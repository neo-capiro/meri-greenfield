# Deferred-tool discovery options: source candidate

Source-only candidate on base `595920e989d088972351db3999aada38d18bf6b9`, branch `task/sdk-discovery-options`, dedicated worktree `C:/dev/main/meri-greenfield-worktrees/g1-sdk-discovery-options`. Outline preceded implementation at `.task-inputs/sdk-discovery-options-1/OUTLINE.md`. This task adds exactly this report and `apps/worker/qualification/probes/sdk-discovery-options{,.test}.mjs`. No accepted capture, contracts, lock, infrastructure or SDK implementation was edited. Independent review and owner acceptance remain required.

The options module composes the existing `sdk-capture-options.mjs` builders and validator. The canonical public contracts Node entry (`packages/contracts/validate.mjs`, exported as `@capiro/meri-contracts/node`) owns RunBinding validation and contract version. The new module adds no schema, authentication registry, tool executor or agent loop. Its ordinary-record checks reject accessors, symbols and nonenumerable fields before copying context; canonical validation decides the RunBinding fields, formats and fence constraints.

The builder requires the full RunBinding, version `0.1.0`, an explicit UUID session ID, the canonical qualification cwd/model, exact `http://127.0.0.1:<integer-port>` ingress, a live caller-owned AbortController, the exact in-process SDK MCP server configuration, and injected permission/spawn callbacks. It retains all RunBinding fields and the session/version in a separate immutable copy. These are qualification DATA supplied by an integration caller, **not authenticated authority**. Freezing an object proves no trust, current grant, tenant access or task identity. The binding never enters prompts or child environment.

The replacement child environment comes entirely from `buildCaptureEnv`; the only environment differences are `ENABLE_TOOL_SEARCH='true'` and omission of `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`. No caller environment, key, provider selector, route, persistence or arbitrary SDK-option override is accepted. There is no invented top-level `enableToolSearch` SDK option. Canonical restrictions remain, including no inherited configuration, built-in tools, skills, plugins, custom agents, hooks, fallback, resume or sessionStore. The fixture title binds the run ID, the session ID is explicit, and the settings permission `ask` list names the two synthetic fixture tools rather than the old echo tool. The gateway-owned callback is passed through unchanged; the module does not decide authorization.

`DISCOVERY_FIXTURE` contains inert public `tool()` / `createSdkMcpServer()` configuration DATA: server and tools use `alwaysLoad:false`; `lookup_message` and `lookup_messages` have distinct exact-ID/subject descriptions and paraphrase hints. Four declared future cases cover similar names, paraphrase, an attachment tool absent from the catalog, and revocation after discovery. No actual server, schema/handler registration, discovery result, tool call or revocation was executed. The caller must construct the real public SDK server from these definitions. The builder cannot inspect an instance's hidden tool registration or prove it honored deferral. No live capability catalog or operation handler is invented.

## Pinned upstream evidence

Installed DATA was read from `C:/dev/main/meri-greenfield-worktrees/w02-image/apps/worker/qualification/node_modules/@anthropic-ai/claude-agent-sdk`. Exact records and eight bounded source excerpts are retained in `.task-inputs/sdk-discovery-options-1/upstream-data.json` (12,309 bytes, SHA256 `73ec8102563af36d90da75d0530e29a9f2b1cce7cd7047c0fafd564fc508494a`).

| File | SHA256 |
| --- | --- |
| package.json, SDK 0.3.295 | a7458d6612be0b2ff7d104418b103186873f6a18028573edd064843c865a4211 |
| sdk.d.ts | e4d91d71404ce4ffc918aa590f545c7a67df6a1dfe5de8cd28a05db0a7fe872b |
| sdk.mjs | 86ba133f4d52e80d03f04cb47f1022d5c8010a7971c7ed937a45a629c0bf2cf0 |
| manifest.json, CLI version metadata 2.1.295 | b36d7b376c95dd409212ecce0b700cd547266d9ea014ab1f81a1d5bc49cb3cbe |

The types declare per-tool `searchHint`/`alwaysLoad` and creation-time server `alwaysLoad`; an SDK MCP server configuration itself has no `alwaysLoad` field. The types contain neither `enableToolSearch` nor `ENABLE_TOOL_SEARCH`; runtime recognizes the environment name. CLI version metadata is not a fresh CLI binary identity or execution proof. Official [SDK tool-search documentation](https://code.claude.com/docs/en/agent-sdk/tool-search) confirms the explicit proxy override and beta-disable precedence. Provider/model support and native request compatibility still need measurement.

## Verification and retained failures

Only the new source-only Node test file ran; no SDK/CLI import, query, provider, cloud, source, listener, native SDK binary or model call occurred. Node 24.19.0 used its permission model with only the worktree and borrowed root dependency tree readable, no subprocess/addon permission, and a preload denying JS socket/DNS/HTTP/fetch/process entry points. This instrumentation is not OS network isolation. Dependencies were borrowed through an owned worktree junction; no install or resolution ran.

The fixed Python `-I -B -S` supervisor launched:

```text
C:/Program Files/nodejs/node.exe --permission
  --allow-fs-read=<dedicated-WT> --allow-fs-read=<ROOT-node_modules>
  --import file:///<new-evidence>/no-network.mjs
  --test --test-isolation=none
  apps/worker/qualification/probes/sdk-discovery-options.test.mjs
```

The first launch exited 7 before fixture loading: Windows preload paths require a `file:` URL (`ERR_UNSUPPORTED_ESM_URL_SCHEME`). Original binary streams, envelope and pre/post hashes remain. The versioned instrumentation correction changed that path representation only and passed 11/11. A subsequent source review removed a redundant local RunBinding key list, leaving field validation entirely with the canonical schema, and added nonenumerable/symbol refusal coverage. That source change justified a final fresh 11/11 run, with no failed/skipped/cancelled cases. Final run: `2026-10-11T01:23:50.842971Z`–`01:23:51.258717Z`, exit 0, no timeout, 0.422 seconds under the external 60-second direct-child bound. Stdout 1,175 bytes SHA256 `4817e1f239c9844b49578b1024a17efb9966ade200c44f06de8d5136d129475a`; stderr empty. All 574 recorded source, runtime and dependency file identities matched before/after each run. Seven protected canonical files also matched exact base Git blobs before each launch.

The 11 groups cover exact environment deltas/default preservation, full binding/session/version copy, borrowed resource/callback identities, unchanged session limits, canonical malformed identity/fence/version/session refusal, model/cwd/route/port substitution, forbidden overrides, record representation hazards, aborted lifecycle/foreign MCP/missing callback refusal, and finite fixture descriptions. They do not test actual selection, authorization, search results, SDK registration or provider protocol. Dependency package bytes and Node executable are measured, not a claim of pristine OS/runtime isolation. Captured streams are buffered before hashing; no memory stream cap or descendant-process cleanup guarantee is claimed. Permission denial prevents child-process dispatch for this run.

A DATA excerpt helper initially looked for the non-existent `export declare type CreateSdkMcpServerOptions` spelling. The installed declaration is non-exported `declare type`; a separately named helper corrected only that needle. The initial ValueError is retained in the tool transcript, not a binary failure capture. Other path-search/setup refusals likewise establish no candidate behavior failure.

## Remaining qualification

This remains a first-session loopback fixture. Canonical `persistSession:false`, file checkpoints off, `autoCompactEnabled:false`, `tools:[]`, two-request capture ceiling and three-turn cap are unchanged. The pinned types say `tools:[]` disables built-in tools; source-only tests cannot establish whether the native CLI still inserts its search meta-tool. Native wire qualification must measure an actual search and deferred tool-reference/tool-use/result sequence under this profile, and stop for a separately reviewed profile change if these inherited limits prevent it. No silent limit expansion is authorized here.

The follow-up must use a newly bound image/source/session/run, register real SDK tools with the declared deferral settings, capture search plus successful exact/paraphrased calls, prove the unavailable tool cannot execute, and prove a discovered tool fails after gateway revocation. Real proxy/Bedrock preservation of beta headers and tool-reference blocks, native model support, task binding, spend and cleanup remain open. Separate durable SessionStore/resume and post-compaction/replacement fixtures must preserve opaque session state, current scope/version/fence checks and current gateway authorization. This fixture changes no W05 or product SDK responsibility, including skills, hooks and subagents. No operational admission, provider spend or G1 acceptance follows from these tests.
