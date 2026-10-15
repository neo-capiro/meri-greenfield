# Conversation browser capability

`createBrowserCapability({binding,cwd,policy,artifacts,receipts,now})` returns one composable fragment for the conversation's single Claude Agent SDK query. It never starts a second agent loop.

- `mcpServers.meri_browser` is a stdio configuration for Playwright MCP 0.0.83 (the integration pinned in `docs/COMPONENTS.md`). It runs headless Chromium with explicit `--sandbox`, a per-conversation `--user-data-dir` and `--output-dir` under `<cwd>/.browser/` (where `cwd` must end in the bound conversation ID), `--allowed-origins` from policy, `--block-service-workers` and `--no-webmcp`. Its environment is limited to `PLAYWRIGHT_BROWSERS_PATH` and a workspace-local `HOME`. It passes no storage state, secrets file, extension, CDP endpoint or saved session, so no credential persists. Nothing is created or launched when the fragment is built.
- `allowedTools` holds the policy's subset of a bounded public-browsing allowlist (`BROWSER_TOOLS`). Script evaluation, code execution, uploads, cookie/storage/network tools, devtools, PDF and coordinate tools are never exposed.
- `hooks.PostToolUse` records one `meri-browser-receipt/1` receipt per browser tool call through `receipts.record`: the action, the page URL host (never the full URL), the injected clock time, a workspace-relative screenshot or trace reference inside the output directory, and the outcome. Page text, titles, snapshots and images are never recorded. If a receipt cannot be recorded, or the call is not an allowed browser tool, the hook stops the run.
- `downloads.accept({filename,url})` moves a downloaded file out of the output directory only through `artifacts.ingest`. It checks the source origin against policy, the extension against the policy formats, the content against the format (strict UTF-8 or file signature), the size limit, the file-count limit, the plain-file and no-symlink rule, and the returned checksum. The file goes out with the canonical MIME type (`packages/contracts/artifacts-0.2/artifact-formats.mjs`), the binding and the policy's source scopes, a download receipt is recorded, and the local copy is then removed.

The policy is disabled by default (`{enabled:false}`), and a disabled policy contributes no server, tool or hook. An enabled policy must state the installation paths and the exact 0.0.83 version, the tools, HTTPS origins, timeouts, download limits and same-tenant source scopes; any unknown key refuses. `--allowed-origins` is not a security boundary. Infrastructure egress enforcement remains required.

Tests (`node --test apps/worker/conversation/browser/test/browser.test.mjs`) use a scripted MCP configuration and scripted ports. No browser or MCP process is launched.

## Not qualified

No browser host is qualified. D005 authorizes qualifying a new dedicated isolated browser host after the measured Fargate namespace failure, and that qualification has not run. This fragment does not prove a non-root browser or renderer sandbox, network controls, per-conversation host isolation, cancellation, restart or revocation. Remaining work:

1. Run the D005 host qualification (`docs/qualification/G1-REMAINING-WORK.md`) and the browser probe on the approved host, with real browser and renderer sandbox evidence.
2. Have the owner of `options.mjs`/`activity.mjs` compose this fragment into the single query and its permission baseline. Today `options.mjs` admits only the `meri_original_reads` server.
3. Add `@playwright/mcp` 0.0.83 to the conversation worker's package and lockfile through the lockfile owner. The installation paths come from policy until then.
4. Add an artifact ingest operation for externally sourced files to the artifact owner. The canonical service exposes create/revise/download but no ingest.
5. Add action approval for side-effecting interactions (typing, form fills, clicks that submit), uploads, and authenticated workflows. Each of these qualifies individually, as the plan requires.
