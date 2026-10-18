# Lane 8: browser and Bash

| | |
|---|---|
| Owner | Fable (Claude Code), lane-8 session |
| meri-greenfield branch | `fable/meri-lane8-browser-bash-20261017`, base `0bab8e34` (tip of `fable/meri-first-chat-receiving-20261017`) |
| Draft PR | [#139](https://github.com/neo-capiro/meri-greenfield/pull/139) into `fable/meri-first-chat-receiving-20261017` |
| Status vocabulary | **source complete** = code and offline tests in this branch; **integrated** = received into PR #133 and wired by the runtime owner; **qualified** = measured on the real Linux target; **live** = serving users. Everything this lane added is **source complete** only. Nothing is integrated, qualified or live. |
| Shared files touched | None of the lane-1 pinned files, contracts, migrations or lockfiles. `apps/worker/conversation/{activity,options}.mjs` gain two optional trusted runtime facts (`bashEgress`, `bashApprovals`); absent facts leave every option unchanged. |
| First-chat pin | `sdkOptionsSha256` `af7f07b8…5431b` recomputed from this branch's source with `probeTemplateSha256` (policy.json + deployment-inputs.json): **equal** to `runtime-values.json` and the launch receipt. `apps/runtime/test/dynamic-sdk-options.test.mjs` 8/8. `runtime-values.test.mjs` 4/5, the same failure as the base (`RENDER_INPUT_REFUSED: deployment.imageScans`, lane 1). |

## 1. Inventory (state at base `0bab8e34`, then what this lane changed)

Paths are under `apps/worker/conversation/` unless stated. Line numbers are at this branch's tip.

| Capability | State before | File:line | After this lane |
|---|---|---|---|
| Browser capability fragment (Playwright MCP 0.0.83 config, tools, hooks, downloads, receipts) | complete (source) | `browser/index.mjs:18`, `browser/fragment.mjs:21`, `browser/server.mjs:30` | unchanged |
| Browser activation gate | complete, **held** (`BROWSER_EGRESS_UNQUALIFIED`) | `browser/activation.mjs:15-34` | unchanged: still held; opens only by a reviewed change citing measured evidence |
| Browser destination decision (allowlist, platform non-public limits, WebSocket mapping, redirect chain) | complete (pure reference) | `browser/egress.mjs:49,63`, `browser/public-web.mjs:20,30` | unchanged |
| Browser run-bound egress control (grant, revocation, expiry, all-addresses-public, pinned connect address) | complete (pure, no sockets) | `browser/egress-control.mjs:97,112`, `browser/egress-proxy.mjs:154` | now served by the new socket proxy (below) |
| **Socket-level egress proxy** (the thing that actually connects) | **absent** | none | **added** `egress/proxy-server.mjs:67` `startEgressProxy`: HTTP CONNECT, absolute-form and upgrade, SOCKS5 CONNECT; dials only the checked IP; no redirect following; Host must equal target; no pooling; `revoke()` destroys open tunnels |
| Browser approvals (interaction tools → canonical approval owner) | complete (source; owner side absent) | `browser/permissions.mjs:56`, `browser/approval-binding.mjs:25-53` | `receiptRefusal` parametrized (`approval-binding.mjs:35`) and `decideWithin` exported (`permissions.mjs:27`) for reuse; browser defaults unchanged, `permissions.test.mjs` 10/10 |
| Browser run preparation, grant and cleanup ordering | complete (scripted ports) | `browser/runtime.mjs:17,27`, `browser/lifecycle.mjs:19` | unchanged |
| `@playwright/mcp` + Chromium in the worker package/image | **absent** | `package.json` has no playwright | unchanged (lockfile owner) |
| Bash admission (policy `bash` + sandbox attestation) | complete | `capabilities/bash-sandbox.mjs:62` | extended: networked Bash also needs `bashEgress` fact + approval port |
| Bash SDK sandbox settings and policy-tier locks | complete | `capabilities/bash-sandbox.mjs:74,88,102,117` | networked: `httpProxyPort`/`socksProxyPort` = Meri proxy, `autoAllowBashIfSandboxed:false`; validator enforces both invariants |
| **Bash destination enforcement beyond names** | **partial**: SDK proxy matches names only, never checks resolved addresses (rebinding to 169.254.169.254 or 10/8 passed) | (CLI internal) | **added** `egress/bash-egress.mjs:53` `createBashEgressControl`: names only (IP literals refused), platform public-name rules, ports 80/443, every resolved address public, pinned dial; `startBashEgress` (`:99`) returns the runtime fact |
| **Bash approvals for risky actions** | **absent**: every sandboxed call auto-allowed | none | **added** `capabilities/bash-approval.mjs:36`: every networked Bash call is decided before it runs by the same canonical approval port (`meri-bash-command/1`), consumed once, replay refused; network-less Bash stays auto-allowed |
| Bash sandbox readiness (bwrap/socat, namespace probe, managed-settings tier, SDK start without model request) | complete (source; measured only on a host without bwrap) | `sandbox-readiness/readiness.mjs:52,87,105`, `cli.mjs`, `host-probes.mjs` | unchanged |
| **Linux runtime qualification harness** | **absent** | none | **added** `sandbox-readiness/linux-qualification.mjs:62,111`, `linux-qualification-cli.mjs` |
| Runner env scrub | complete | `apps/runtime/conversation-runner.mjs:18` (refuses ambient credentials, pinned bytes, not edited); `options.mjs:59` (SDK env replaces `process.env`: proxy URL/token, config dirs, CA, caps only); `capabilities/bash-sandbox.mjs:32,36` (`SANDBOX_DENIED_ENV` deny list + `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1`); `apps/runtime/build/first-chat-launch-measurement.mjs:40` | unchanged; test expectation refreshed for the two token-cap env vars |
| Gateway destination enforcement | **absent** (no egress/allowlist code in `apps/gateway`; it governs model and read calls, not tool network) | — | not needed there: enforcement lives at the run's egress proxy |
| Canonical approval owner accepting browser/Bash subjects + consume | **absent** (`apps/control/commands/approval-metadata/owner.mjs` handles task-create commands only) | `apps/control/commands/approval-metadata/owner.mjs:12` | proposal only (section 4); shared contract, dot's |
| Runner image carries bwrap, socat, Chromium | **absent** (`apps/runtime/Dockerfile`; earlier bwrap/socat recipe `c509ca1d` reverted) | `apps/runtime/Dockerfile:36-65` | unchanged (image owner) |
| Runner task posture | read-only root, `privileged:false`, `capabilities.drop:['ALL']` | `infra/product-preview/manifest.mjs:132,140`, `infra/product-preview/first-chat/stage3-deploy.mjs:93-94` | unchanged (lane 1) |

Backlog row (BACKLOG.md lane 8): "to inventory" → inventory above; source complete for the Meri side.

## 2. What was built (source complete)

Commits on this branch: `0bd69dd9` (POSIX path checks, stale test), `3b467447` (egress proxy + Bash control), `7d7e8e85` (networked Bash through the proxy, approvals), `50c4ba89` (qualification harness), plus this file.

**Destination enforcement, deny by default.**
- Browser: the effective platform ∧ tenant ∧ role origin allowlist (unchanged rules) is now enforced at a real socket proxy. Bash: the effective `sandboxNetworkDomains`; an empty list starts no proxy and the sandbox has no network.
- No bypass:
  - *redirects* are relayed, never followed, so each hop is a new admission;
  - *IP literals* are refused for Bash (the list names hosts) and pass the platform non-public rules for the browser;
  - *DNS rebinding*: every answer must be public, a mixed answer refuses the name, and the proxy dials the checked address, never the name;
  - *Host-header confusion* is refused;
  - only ports 80/443;
  - *SOCKS* is CONNECT-only, with no BIND or UDP;
  - revocation kills open tunnels.
- What it cannot see: the inside of TLS. Connection coalescing and domain fronting inside an admitted tunnel stay on the host checklist (`browser/ACTIVATION-CHECKLIST.md`).

**Approvals.** Networked Bash has `autoAllowBashIfSandboxed:false`, so every call reaches `canUseTool`.
- Approval goes through the existing approval port shape (`approvals.decide`) with the browser's receipt checks:
  - an approved decision;
  - an exact subject digest;
  - the same tenant;
  - unexpired;
  - consumed;
  - once per proposal, consumption and tool-use.
- The subject binds the run binding, tool-use, exact input digest, sandbox-settings digest and domains digest.
- `dangerouslyDisableSandbox` is refused outright.

**Qualification harness.** `node apps/worker/conversation/sandbox-readiness/linux-qualification-cli.mjs --run-directory /run/meri [--skip-sdk] [--live-egress-name <name>]`. It measures the following and writes `/run/meri/qualification/lane8-qualification-<ms>.json`:
- host and ECS/Fargate marker presence;
- NoNewPrivs, seccomp mode and CapEff/CapBnd (CAP_SYS_ADMIN bit);
- userns sysctls;
- root read-only and run directory writable;
- a bubblewrap namespace ladder: userns, +pid, +net, `--unshare-all` with and without `/proc`;
- socat;
- the SDK sandbox start with no model request;
- the 11-case egress matrix over real loopback sockets.

It reports `bashSandbox`, `chromiumSandbox`, `egressProxy` and `liveEgress` verdicts with the first failing reason. Exit codes: 0 all feasible, 1 measured but infeasible, 2 usage, 3 incomplete. No credential, metadata request or model request. Smoke-run on this Windows host: egress 11/11, both sandboxes `NOT_LINUX`, exit 1.

## 3. Tests (one file at a time, `MERI_REVIEW_SOURCE_ROOT=<worktree>`, Windows host, Node 24)

| File | Result | Note |
|---|---|---|
| `egress/test/egress-proxy.test.mjs` (new) | 10/10 | real loopback sockets, scripted resolver, injected dialer |
| `test/bash-network.test.mjs` (new) | 5/5 | |
| `test/linux-qualification.test.mjs` (new) | 6/6 | includes the real loopback egress matrix |
| `test/bash-sandbox.test.mjs` | 6/6 | was 1/6 on Windows at base (POSIX paths, stale env list) |
| `browser/test/permissions.test.mjs` | 10/10 | after the receipt-check refactor |
| `browser/test/egress-control.test.mjs`, `browser/test/egress.test.mjs` | 7/7, 5/5 | |
| `test/sandbox-readiness-verdict.test.mjs` | 11/11 | |
| `test/sandbox-readiness.test.mjs` | 4/5 | same as base: the real-SDK case expects `SANDBOX_DEPENDENCIES_MISSING`, Windows gives `SDK_STARTUP_FAILED` (Linux-only case) |
| `apps/runtime/test/dynamic-sdk-options.test.mjs` | 8/8 | first-chat pin |
| `test/activity-capabilities.test.mjs` | 0/8 | **same 0/8 at base**: scripted PG fixture returns `STORE_UNAVAILABLE` (fixture drift in `apps/control/conversations/test`), not lane 8 |
| `test/capabilities.test.mjs`, `test/options-capabilities.test.mjs`, `browser/test/browser.test.mjs` | 4/8, 0/3, 6/9 | **identical failures at base** (Windows paths/symlink EPERM, stale default-options shape); not lane 8 |

## 4. Fargate feasibility verdict

**Neither sandbox is feasible inside the Fargate runner task.** That covers the SDK's bubblewrap sandbox for Bash and Chromium's own namespace sandbox for the browser.

- Both need unprivileged user namespaces, plus pid and net namespaces, created from inside the container.
- Fargate offers no privileged mode and no custom seccomp profile (`dockerSecurityOptions` is unsupported). The only capability that can be added is `SYS_PTRACE`.
- The runner task also drops ALL capabilities.
- The project has already **measured** this on Fargate: D005 records the Baseline3 Chromium namespace `EPERM`, which is why a dedicated browser host was approved.
- `enableWeakerNestedSandbox` does not help. It skips only the fresh `/proc` mount and still needs the namespaces.

The harness turns this into a recorded reason. The expected result on the runner task is `USERNS_DENIED_SECCOMP_NO_CAP_SYS_ADMIN`, or `BWRAP_MISSING` on the current image, which has no bwrap.

Alternatives:

1. **Recommended: the D005 dedicated isolated host, extended to Bash.** This is a per-conversation EC2 or ECS-on-EC2 host (AL2023) with user namespaces enabled and the reviewed seccomp profile (`seccomp.chromium-155-amd64.json` lineage). Its posture:
   - no instance or task credentials reachable from the tool user (IMDSv2 hop limit 1 or blocked, no container credential URI);
   - egress only to this lane's egress proxy (security-group egress to the proxy alone, no NAT bypass).

   The browser already has D005 approval. Bash placement there needs Neo's approval, as the 15 Oct capability report already notes.
2. **Fargate-only fallback: no in-task sandbox.** Run tools in a separate, credential-free, per-conversation Fargate task. The microVM per task is the boundary, and egress goes only through this lane's proxy.
   - This cannot use the SDK's built-in Bash. Unsandboxed, a command could read the CLI process environment, which holds the model-proxy capability.
   - Bash would become a remote-execution MCP tool served from the tool task.
   - The browser would run Chromium `--no-sandbox` there.

   This needs new source and an explicit owner security decision, because it gives up the renderer and command sandbox.

## 5. What real Linux qualification needs (dependencies)

| # | Item | Owner | Blocks |
|---|---|---|---|
| 1 | Image with `bubblewrap` + `socat` (Wolfi packages), Chromium + `@playwright/mcp` 0.0.83 (package + lockfile) | image/lockfile owner (lane 1, dot), coordinated on PR #121 | qualified |
| 2 | Run `linux-qualification-cli.mjs --run-directory /run/meri` once in the Fargate runner task to record the infeasible verdict with its reason | lane 1 (ECS RunTask is an AWS write) | Fargate verdict as measured evidence |
| 3 | Neo: placement decision for Bash (D005 host, or the Fargate tool-task fallback) | Neo | qualified for Bash |
| 4 | On the D005 host: the harness with `--live-egress-name <allowlisted>`, then every item of `browser/ACTIVATION-CHECKLIST.md` with Chromium through `startEgressProxy` + `createEgressControl` | lane 1 + browser host owner | browser activation |
| 5 | Runtime preparation owner: per run with non-empty domains, `startBashEgress` → pass `bashEgress` + `bashApprovals` facts, close the proxy on settle; browser host: one `startEgressProxy` per run grant | runtime owner (`apps/runtime`, lane 1 pins) | integrated |
| 6 | Canonical approval owner: accept `meri-browser-action/1` and `meri-bash-command/1` subjects (digest as `commandSha256`), durable one-time consumption, receipts `meri-browser-approval-receipt/1` / `meri-bash-approval-receipt/1` | dot (`apps/control/commands`, shared contract) | integrated |
| 7 | Host network: security-group egress only to the proxy; resolver is the VPC resolver | lane 1 infra | qualified |

## 6. Remaining risks and open items

- TLS-internal coalescing and domain fronting cannot be seen by the proxy. Mitigation is on the host checklist: Chromium `--disable-http2`/`--disable-quic`, or a coalescing probe.
- The PreToolUse/permission ordering of the real CLI 2.1.295 is unmeasured for Bash with `autoAllowBashIfSandboxed:false`. It is expected to call `canUseTool`; the harness does not cover it, because that needs a model turn.
- That the SDK sandbox's bridge reaches a custom `httpProxyPort`/`socksProxyPort` on Linux is documented in the SDK types (`sdk.d.ts:8752-8758`). It is not yet measured.
- Pre-existing base failures listed in section 3 belong to other lanes.
