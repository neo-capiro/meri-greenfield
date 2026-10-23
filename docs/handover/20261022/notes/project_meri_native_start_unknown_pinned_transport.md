---
name: project-meri-native-start-unknown-pinned-transport
description: "2026-10-20 Meri first chat (runner 283f12c5, source 2b4421f6) RUNNER_FIRST_FAILURE native-start UNKNOWN — root of the UNKNOWN is pinned-native-transport.mjs code-less rejections; repair on local branch fable/pinned-transport-failure-codes-20261020"
metadata:
  node_type: memory
  type: project
  originSessionId: f3488900-8e67-422e-a0ef-cf2d2e544fbb
  modified: 2026-10-20T02:19:23.206Z
---

Deployed 2b4421f6 (head of `fix/runner-transport-diagnostic-20261019`; worktree `C:\dev\fable\wt-meri-2b4421f6`).
Runner task 283f12c5 (runner:20) started 01:40:01.9Z, `RUNNER_FIRST_FAILURE origin=native-start code=UNKNOWN` at 01:41:02.451Z;
runner's own hono listener logged "Client connection prematurely closed." at .449 and control (c95be8bc, control:35) at .448;
private ALB had 1 ELB-generated 4xx, 0 5xx in that minute; proxy/owner/issuer silent (no provider reach). No WAF on the private ALB.

**Why UNKNOWN:** runner's fetchImpl is `apps/runtime/pinned-native-transport.mjs` (via runner-poststart-cli → conversation-runner:121 → remote-conversation-runner:43 processTransport). It rejects EVERY failure, incl. any non-200 status, as `Error('PINNED_NATIVE_REFUSED')` with no `code` (line 37; status check 45). `codeOf` in runner-runtime-diagnostics only reads an own allowlisted `code` → UNKNOWN. Lifetime deadlines print REMOTE_TASK_REFUSED (race verified), so live UNKNOWN is NOT the 23 s cutoff. The existing runner-first-failure tests hand the client `Response` 403s, which the product transport never produces.

**Repair (PUSHED 10-20 02:20Z as a separate branch, not merged):** `fable/pinned-transport-failure-codes-20261020` @32d06db2 (parent 2b4421f6), worktree `C:\dev\fable\wt-meri-repair-pinned`: constant `PINNED_NATIVE_*` codes on rejections + diagnostics allowlist; tests `pinned-native-transport-live.test.mjs` (real transport over local TLS, openssl CA, fs/promises.open mocked for Windows uid/mode) and `native-start-pinned-transport-loss.test.mjs`. Deliverables: `C:\Users\neoma\OneDrive\Documents\Claude\meri-native-start-unknown-20261020\` (DIAGNOSIS.md, patch, tests).

**Why:** dot owns AWS/live; Neo asked for a diagnosis + smallest repair kept separate. **How to apply:** don't re-derive; posted to dot as PR121 comment 6281829287 (10-20 02:21Z); await dot's response before any further Meri work; after rollout the first-failure class discriminates ALB 4xx vs control 403 vs reset. Related: [[project-meri-first-chat-a16cc40d-handoff]], [[reference-meri-greenfield-windows-test-env]]
