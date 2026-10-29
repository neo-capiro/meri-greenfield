# SCRUM-236 — Notebook editing: author handback (29 October 2026)

Author session: `20261029_154054_9cae76` (genuine Hermes author session; model unchanged: deepseek/deepseek-v4.1-flash-1017 via openrouter).
Base: `c26157591db6d057663365de7ba170edd98cf2ca` / tree `f60f0d74bb819a16404d463cad5d66f16c50ad89`, branch `hermes/scrum236-notebook-20261029`,
worktree `C:/dev/meri-cap-scrum236-20261029/meri`.

## 1. What changed (owned paths only)

| Path | Change |
|---|---|
| `apps/worker/conversation/capabilities/workspace-tools.mjs` | `NotebookEdit` is now a bounded workspace file tool: exported as `NOTEBOOK_TOOL`, included in `FILE_TOOLS`, and added to `WRITE_TOOLS` so an admitted notebook tool emits the `Edit(//<cwd>/**)` allow rule. Header comment records the pinned SDK's rule matching (Edit rules govern Write **and** NotebookEdit; a `NotebookEdit(...)` rule is accepted but never matched). |
| `apps/worker/conversation/test/notebook-workspace.test.mjs` | New focused suite (5 tests) for notebook admission, rule emission, callback denial, rule-name refusal and the workspace-root fence. |

Why `WRITE_TOOLS` matters: the SDK checks notebook writes against `Edit(path)` rules only. Before this change the Edit rule was emitted only when
`Write`/`Edit` were admitted, so a policy that admitted NotebookEdit alone would have every cell edit fall through to the deny callback. Notebook
creation stays `Write` of valid `.ipynb` JSON; NotebookEdit replaces/inserts/deletes one cell by id and preserves other cells, outputs and metadata.
No notebook execution is added here; execution stays with SCRUM-235's isolated executor.

Removed confirmed incorrect stubs created by the rejected fallback attempt (byte-identical snapshots retained under
`outputs/HERMES-236-238-FALLBACK-PARTIALS-20261029/236/`):
`C:/dev/meri-cap-scrum236-20261029/meri/capabilities/workspace-tools.mjs` (0 bytes),
`C:/dev/meri-cap-scrum236-20261029/meri/capabilities/workspace-tools.tests.mjs` (474 bytes),
`C:/dev/meri-cap-scrum236-20261029/meri/handback.txt` (238 bytes).

## 2. Integration hunks required from SCRUM-238 (not edited by this author)

`apps/worker/conversation/capabilities/policy.mjs` (line 14) — add the name to the allowlist universe:

```js
export const WORKSPACE_TOOLS=Object.freeze(['Read','Write','Edit','Glob','Grep','NotebookEdit']);
```

`apps/worker/conversation/options.mjs` — the fragment's own `tools`/`disallowedTools` are destructured away (line 54) and a static list is applied
(line 64), so the per-run policy currently cannot admit NotebookEdit. Add the admission check before the options literal:

```js
const admittedNotebook=Array.isArray(_tools)&&_tools.includes('NotebookEdit');
```

and replace line 64 with:

```js
disallowedTools:[...(capabilities.sandbox?[]:['Bash']),...(admittedNotebook?[]:['NotebookEdit'])],
```

This is behaviour-preserving when NotebookEdit is not admitted (exact previous arrays) and removes only the NotebookEdit entry when the fragment admits it.
Notes for 238: (a) appending the name keeps existing ordered assertions intact; (b) adding it to `WORKSPACE_TOOLS` makes it the default for an
undefined `workspaceToolNames` on every `workspaceTools` run — accept that (notebooks are ordinary workspace files under the same Edit rules) or
exclude it from the default list explicitly; (c) `apps/runtime/product-ports/capability-policy.mjs` derives the preview profile from `WORKSPACE_TOOLS`,
so it follows automatically; (d) subagents already exclude it — `subagents.mjs` disallows every WORKSPACE_TOOL a role does not name, and no role names it.
No `fragment.mjs` change is needed: its validator accepts `Read`/`Edit` rules only, which is exactly what the SDK matches.

## 3. Bounded rewind assessment (decision: no rewind, documented omission)

Pinned SDK 0.3.295 rejects `enableFileCheckpointing` together with the required `sessionStore` (backup blobs are not mirrored; store-backed resume
cannot rewind), and product options always pass `sessionStore` with batched flush. Durable file custody already exists: workspace/task bytes are
captured and restored by `native-files-owner.mjs` (`capture`/`restore`), and document versions/restore are owned by the artifact/document owners.
That covers persistence, not user-directed undo of one file. Notebook cell undo is the ordinary edit path (NotebookEdit `replace`/`delete` on the same
cell). Native checkpointing is therefore omitted for the SessionStore incompatibility; no new rewind/version ledger was added, and rewind would never
have undone external actions.

## 4. Checks actually run (Windows host, Node `v24.22.1`)

| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `node --test test/notebook-workspace.test.mjs` (cwd `apps/worker/conversation`) | 0 | 5 passed, 0 failed |
| 2 | Failure witness: same file with `WRITE_TOOLS` reverted to `['Write','Edit']` (exports kept) | 1 | exactly the 2 rule-emission tests fail (`a cell edit is pre-approved by the Edit path rule`); the other 3 pass |
| 3 | `node --check capabilities/workspace-tools.mjs` | 0 | syntax OK |
| 4 | `node -e "import('./capabilities/index.mjs')"` | 0 | composition imports |

Environment/setup facts (no install performed): this worktree had no `node_modules`; dependencies were reused read-only from the sibling SCRUM-235
worktree (`C:/dev/meri-cap-235-20261029`) through directory junctions — `node_modules`, `apps/worker/conversation/node_modules`,
`packages/window-resolution/node_modules`, `packages/ui-stream/node_modules`, `apps/runtime/node_modules`. All are git-ignored. No shared dependency,
lockfile or package change was made.

## 5. NOT RUN (and why)

- `apps/worker/conversation/test/capabilities.test.mjs` and `test/options-capabilities.test.mjs`: these build the workspace from
  `capability-fixture.mjs` (`preparedWorkspace`), which yields a Windows path; `assertWorkspaceRoot` enforces the POSIX container contract
  (`posix.isAbsolute`), so they refuse on this host with `WORKSPACE_ROOT_REFUSED`. They are Linux/WSL tests. WSL **Codex-Gates** is currently
  unattachable on this host (`Failed to attach disk ... ext4.vhdx`, `ERR_PATH_NOT_FOUND`), so the Linux gate was not available. Their inputs are
  unchanged by this diff (the new name cannot enter a policy list until the 238 hunk lands), so this is an environment gap, not a proven regression.
- Any live chat/notebook run, browser artifact download and resumed-chat persistence: out of scope for the author turn; separate deployed acceptance
  must prove them on `app.capiro.ai`.
- Notebook structural validity of a real SDK edit: the SDK's NotebookEdit is invoked by the model loop, not callable directly here; narrow native/API
  proof belongs to the acceptance step.

## 6. Remaining integration needs before acceptance

1. Apply the two 238 hunks above, then re-run the Linux gate for `capabilities.test.mjs`, `options-capabilities.test.mjs` and
   `notebook-workspace.test.mjs` at the integrated head.
2. Confirm the effective preview/tenant policy actually names `NotebookEdit` (platform default follows `WORKSPACE_TOOLS`; a saved tenant `workspaceToolNames`
   list must include it).
3. Deployed acceptance: create a notebook, insert/edit/delete named cells, confirm unrelated cells/outputs/metadata survive, confirm an
   outside-workspace and an invalid-cell request is refused, download the `.ipynb` and open it, then resume the conversation and confirm the file persists.

## 7. Rollback

Single revert of this commit (module + new test + this handback); the stub cleanup needs no rollback, and no shared resource or configuration changed.
