# P1C independent review handoff — 15 October 2026

Central coordinator decision: **HOLD source and live qualification; browser fragment remains default disabled and uncomposed.** Fable owns implementation; Codex's current support is limited to independent review and documentation. This record does not authorize source edits by this lane, contract freeze, runtime activation, migration execution, AWS, model/provider calls or deployment.

Exact source: [`e0f94fe00a65ddd7f3f663bc2eafd25def7dfda4`](https://github.com/neo-capiro/meri-greenfield/commit/e0f94fe00a65ddd7f3f663bc2eafd25def7dfda4), tree `580df3710c26c19dd14c8933a068c4278eccd1df`.

Review base: `ba40647c5b6f1f81773869e41ce82c099d64d505`; five commits and 52 new files. These describe scope, not acceptance.

The central coordinator's independent reviewers supplied and reproduced the diagnostics below. In this bounded documentation lane, the author inspected cited source and Git identities. The author did **not** rerun diagnostics, tests or qualification. Review requirements are not an approved replacement wire or implementation.

## P1c: browser effects, download claims and usable artifacts

1. **Gate effects before execution.** [browser/index.mjs, lines 19–20](https://github.com/neo-capiro/meri-greenfield/blob/e0f94fe00a65ddd7f3f663bc2eafd25def7dfda4/apps/worker/conversation/browser/index.mjs#L19) adds tools including click, type, form fill, selection, keypress and dialog handling to SDK `allowedTools`, with only a post-use receipt hook. The coordinator's SDK review identifies the autoapproval path ahead of `canUseTool`. Require a pre-execution approval/deny owner and negative controls proving a refused action never executes. Disallowed tool discovery must also be unavailable or denied. A post-use receipt cannot authorize the preceding action.

2. **Claim download count and identity atomically.** [downloads.mjs, lines 26–36](https://github.com/neo-capiro/meri-greenfield/blob/e0f94fe00a65ddd7f3f663bc2eafd25def7dfda4/apps/worker/conversation/browser/downloads.mjs#L26) checks the count before awaits and increments afterward. The coordinator's controlled-port probe with `maxFiles:1` allowed two concurrent ingests; duplicate-filename claims can also race. Reserve the bounded count and file identity atomically and preserve unknown artifact outcomes. Do not infer that a failed acknowledgement means ingestion did not happen.

3. **Do not call a ZIP signature a usable DOCX.** [usable-file.mjs](https://github.com/neo-capiro/meri-greenfield/blob/e0f94fe00a65ddd7f3f663bc2eafd25def7dfda4/evals/promptfoo/graders/usable-file.mjs#L4) checks magic bytes, and [the authored test](https://github.com/neo-capiro/meri-greenfield/blob/e0f94fe00a65ddd7f3f663bc2eafd25def7dfda4/evals/promptfoo/test/graders.test.mjs#L37) accepts eight bytes `PK\x03\x04rest` as a DOCX when no required text is configured. The coordinator reproduced `pass:true`. Require structural and native artifact validation for a usable-file claim; otherwise mark that qualification UNRUN.

4. **Qualify real egress enforcement.** [policy.mjs](https://github.com/neo-capiro/meri-greenfield/blob/e0f94fe00a65ddd7f3f663bc2eafd25def7dfda4/apps/worker/conversation/browser/policy.mjs#L15) validates HTTPS-origin syntax without excluding localhost, private or link-local addresses. [The pinned Playwright MCP 0.0.83 instructions](https://github.com/microsoft/playwright-mcp/blob/v0.0.83/README.md) explicitly say allowed origins are not a security boundary and do not affect redirects; this was independently read for this handoff. Keep activation on HOLD until real egress, private-address, redirect and DNS enforcement and negative cases are qualified on the approved isolated host. Do not substitute syntax checks for that proof.

5. **Correct profile/persistence and evidence claims.** [server.mjs](https://github.com/neo-capiro/meri-greenfield/blob/e0f94fe00a65ddd7f3f663bc2eafd25def7dfda4/apps/worker/conversation/browser/server.mjs#L9) uses `--user-data-dir`; the [README's “no credential persists” statement](https://github.com/neo-capiro/meri-greenfield/blob/e0f94fe00a65ddd7f3f663bc2eafd25def7dfda4/apps/worker/conversation/browser/README.md) is not proved by omitting an input storage-state file. Require explicit profile lifecycle and isolation evidence. The review reports 60 cohort slots with only 12 synthetic runnable cases and 48 real cases missing; 144 isolation cases are synthetic and performance acknowledgement is scripted. Promptfoo CLI remains untested. No independent full suite, browser or SDK execution was performed. Default-disabled, uncomposed source is not a deployed exposure claim.

## Ownership and next evidence

Fable must return reviewed corrections at a new exact commit with focused regression evidence for every finding, keeping failed/skipped checks visible. Any separately proposed contract, migration or integration requires its existing owner review. No synthetic or scripted outcome supplies native, isolation, live authority or release proof.

The stopped discovery candidate and prior source-only/proposal-only checkpoints retain their original scopes. No product source is changed by this record.
