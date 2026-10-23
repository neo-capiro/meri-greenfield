---
name: reference-meri-greenfield-windows-test-env
description: How to run meri-greenfield apps/runtime tests in a fresh worktree on this Windows host without reinstalling — junctions to meri-source installs + the missing @capiro/meri-contracts link
metadata:
  node_type: memory
  type: reference
  originSessionId: f3488900-8e67-422e-a0ef-cf2d2e544fbb
  modified: 2026-10-20T13:25:17.804Z
---

Fresh worktree of neo-capiro/meri-greenfield (e.g. `git -c core.autocrlf=false worktree add --detach <dir> <sha>` from `C:\dev\fable\meri-source`) has no node_modules. Do NOT `npm ci`; link the existing installs with PowerShell junctions (Bash `cmd //c mklink` mangles `/J`):
`New-Item -ItemType Junction -Path <wt>\<d> -Target C:\dev\fable\meri-source\<d>` for d in `node_modules`, `apps\runtime\node_modules`, `apps\worker\conversation\node_modules`, `packages\contracts\node_modules`, `apps\control\conversations\node_modules`, and also `packages\window-resolution\node_modules`, `apps\artifacts\storage\node_modules`, `apps\worker\qualification\node_modules`, `packages\ui-stream\node_modules` (without window-resolution's, worker-http suites fail with ERR_MODULE_NOT_FOUND `@js-temporal/polyfill`).
Then add `<wt>\apps\node_modules\@capiro\meri-contracts` → `<wt>\packages\contracts` (the Dockerfile creates this link in the image; the shared install lacks it, so `runner-runtime-diagnostics`, `runner-poststart-cli`, `activity-runtime-diagnostics` suites fail with ERR_MODULE_NOT_FOUND otherwise).
Run: `node --experimental-test-module-mocks --test --test-concurrency=1 <files>` (Node 24.19.0). Known Windows-only failures: child-process path `C:\C:\` tests. `openssl` exists at /mingw64/bin for throwaway CAs. `mock.module('node:fs/promises', …)` works for builtins when the mocked import happens via dynamic import after the mock. Suites asserting "explicit source root required" (task-verifier, session, http-independent) need `MERI_REVIEW_SOURCE_ROOT=<worktree>`.

**Why:** avoids reinstalling the application per worktree (memory/time) and explains the misleading suite-level failures. Related: [[project-meri-native-start-unknown-pinned-transport]]
