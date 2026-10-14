# Task-resident workspace restoration

Base `ab0d7a2ac302f95869063a223d79a991662303a3`, existing shared dedicated worktree. Root explicitly approved the bounded existing-RPC extension and owns the subsequent single-Query launch preparation changes. No delegate commits, migrations, new durable owners, credentials, provider calls, Docker/AWS mutations or recursive agents.

Design and ownership recorded before implementation in the parent handoff:

- Existing trusted supervisor owns its compiled original binding, workspace and lease. New cohesive `supervisor-workspace.mjs` validates physical restore/readback and uses existing `workspace-restore.mjs`; no caller path is accepted.
- Existing independent-task private inherited IPC carries `workspace-restore` and `workspace-verify`; SDK worker receives only separate stdin/stdout byte pipes and cannot upload RPC authority.
- Canonical `store.restorations` remains the sole durable claim/RESTORED/UNKNOWN owner. The child keeps only an ephemeral one-use physical guard. It cannot acknowledge SQL admission or authorize a dispatch retry after an ambiguous parent acknowledgement.
- Existing `native-restorer.mjs` accepts a borrowed closed `workspaceOwner:{restore,verify}` port. Canonical claim acknowledgement precedes RPC/file effects. Fresh metadata readback pins original binding, restore key, workspace hash, current observation time and exact original expiry. Replay/snapshot always verify actual task bytes. Legacy local fixture behavior is retained; production composition must bind `tasks.workspace`.

Private port DTOs:

```
restore({binding, restoreKey, workspaceSha256, manifest,
         files:[{bytes, sha256, base64}], signal?})
verify({binding, restoreKey, workspaceSha256, manifest, signal?})
  -> {binding, restoreKey, workspaceSha256, checkedAtMs, expiresAtMs}
```

Parent boundaries copy inert JSON before IPC, refusing nested getters/proxies. Restore requests are bounded48MiB, verify requests2MiB; child enforces existing native file limits256 files, 8MiB/file and32MiB aggregate, canonical manifest/hash, exact base64 roundtrip and immutable byte/hash references. Physical restoration must precede CLI spawn. Verification checks the configured task filesystem; caller-supplied control filesystem paths are never used. Root owns qualified deployment placement and namespace/isolation evidence.

Verification:

- Initial **6/6 PASS**, actual exit0, `workspace-rpc-initial.tap`: actual independent supervisor IPC and real filesystem bytes, canonical synthetic claim before write, inode-preserving replay/task readback, foreign binding/path/getter/hash refusals, lost-ACK UNKNOWN nonretry, actual task byte tamper refusal, worker stdin JSON isolation, and genuine independent observation of a **synthetic native-format fixture child**.
- Final **18/18 PASS**, actual exit0, `workspace-rpc-final.tap`: eight new controls plus ten existing native-restorer controls. Added mismatched task readback receipt refusal with UNKNOWN nonretry, and original lease expiry refusal without deleting task data. `git diff --check` and `node --check` passed.

The control-side restorer test uses an unmounted control path and forwards restoration/readback through the actual task RPC. This proves the source transport does not require direct control filesystem access; it does **not** prove two-machine, Fargate or host isolation. Synthetic authority/journal fixtures are plainly distinguished from actual supervisor/process/filesystem mechanics. Every owned supervisor/fixture child is closed and physical cleanup asserted before temporary fixture roots are removed.

Shared-file ownership release: this delegate added only the two workspace RPC handlers and workspace port, then returned `independent-task.mjs` and `supervisor-process.mjs` to root before root's deferred-spawn extension. No launch matching, registration lifetime, provider model loop, or native witness semantics were weakened. Independent exact-source acceptance and actual single-Query SDK qualification remain root responsibilities.
