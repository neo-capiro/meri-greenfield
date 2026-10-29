# SCRUM-238 AskUserQuestion — implementation handback — 29 October 2026

Session 20261029_154054_c5be2d (same session continued; DeepSeek/OpenRouter configuration preserved, no model/auth/config change).
Prior wrappers 14143 (CLOSED1/a8871d, 16:46:36Z) and 67296 (CLOSED1/01b59c, 16:31:33Z) were stopped only after their last local command completed; no test/provider/cloud/DB command was left unresolved. No reset, no Git init, no global config change, no reread of the standing corpus.

## Workspaces and bases (unchanged)

- meri: C:/dev/meri-cap-scrum238-20261029/meri — base c26157591db6d057663365de7ba170edd98cf2ca, branch hermes/scrum238-askuserquestion-20261029
- backend: C:/dev/meri-cap-scrum238-20261029/backend — base 0b326f4e990b02bcd84130954241777e96461894 (clean, untouched this turn)
- frontend: C:/dev/meri-cap-scrum238-20261029/frontend — base f7fac5917180f7341f27d78481385d53ef23a2e7 (clean, untouched this turn)

## Actual changed paths (meri only, uncommitted)

Modified:
- packages/contracts/conversation-lifecycle/schema.mjs — answer control/command/event/receipt vocabulary on the existing lifecycle contract.
- packages/contracts/conversation-lifecycle/validate.mjs — workerActionForIntent('answer') -> 'answerQuestion'; assertWorkerControl accepts the answer action with questionId+answers only, refusing prompt/proposalId/proposalSha256 and refusing answer-shaped payloads on other actions; receipt intent stays its own.
- apps/worker/conversation/capabilities/questions.mjs — new: real AskUserQuestion adapter over the registry; question-specific canUseTool handling and answer delivery into the suspended SDK call.
- apps/worker/conversation/questions/registry.mjs — new: durable pending-question registry keyed by tenant/actor/conversation/run/question; wait, answer, cancel, recover; duplicate replies safe; stale/revoked/cross-tenant refused; no auto-answer on elapsed time or shutdown.
- apps/worker/conversation/capabilities/index.mjs — index composition join for the questions fragment; askUserQuestion admitted through the policy.
- apps/worker/conversation/capabilities/policy.mjs — question capability fragment/policy admission (sandbox-aware), existing unadmitted behavior preserved.
- apps/worker/conversation/options.mjs — options join; AskUserQuestion exposed to the SDK tool list when admitted.
- apps/control/conversations/lifecycle/service.mjs — answerQuestion() on the existing control service plus question state on snapshots; per-turn lease held for the answer operation; no new queue/approval/ledger.
- apps/control/conversations/lifecycle/journal.mjs — question events journalled/read back so a pending question survives restart and recovery.
- apps/control/conversations/retention-inventory-decode.mjs — question rows decode/retention inventory for the existing sweep.

New tests:
- apps/worker/conversation/test/questions.test.mjs
- packages/contracts/test/conversation-lifecycle-answer.test.mjs

## Focused results (real exit codes, no pipes masking failure)

- packages/contracts answer suite: PASS 5/5, EXIT=0. Command: `node --test packages/contracts/test/conversation-lifecycle-answer.test.mjs`; log /c/ProgramData/Hermes/cache/scratch/scrum238/contracts-answer.log. Covers answer control carrying questionId+labels, refusing missing/malformed selection, intent->single worker action, refusing answer-shaped payloads on other actions and prompt-on-answer, receipt intent separation.
- `node --check` on all 10 modified/new modules: OK for each (parse-level only, no behavioural claim).
- No failing assertions were deleted, no --test-force-exit used, no assertion weakened. Earlier outer-exit-0-while-output-failed pipelines are superseded by the redirected-log/EXIT capture above.

## Failures still open (exact blockers)

1. Worker registry test not yet runnable: `node --test apps/worker/conversation/test/questions.test.mjs` resolves its imports but the transitive `../intents/registry.mjs` requires the bare specifier `zod`, which does not resolve from a path-run module under this workspace without the package's npm install. Exact command + module: `apps/worker/conversation/intents/registry.mjs` -> `zod`. Installs are prohibited this turn; the test stays written and unrun rather than mocked away.
2. Receiver/UI join not reachable: `packages/contracts/dist/` has no answer vocabulary (0 matches) and cannot be regenerated because `esbuild` (root devDependency 0.28.2) is not installed in this worktree. Exact command: `npm run check:contracts:distribution`. No dist edit was hand-written, because generated output is the build's product.

## Ownership respected (no edits)

- SCRUM-155 three frontend paths (apps/web/src/shared/capiro/registry.ts, .../settings/preferences-unavailable.ts, .../settings/MeriPreferencesPanel.tsx): untouched, transferred to 155.
- SCRUM-237 infra/product-preview/manifest.mjs and infra/product-preview/first-chat/stage3-bindings.mjs plus their tests: untouched.
- SCRUM-235 apps/worker/conversation/activity.mjs and conversation/telemetry/turn-lines.mjs: untouched. Confirmed by grep that activity.mjs still has no answerQuestion dispatch — that join is 235's.
- SCRUM-236 workspace-tools/notebook leaf: untouched; its accepted hunks were not composed here (Root integrates PR374).

## Integration handback — what the connected path still needs, in order

1. SCRUM-235 (its files): dispatch the `answerQuestion` control in the conversation pump alongside approval.wait — deliver to the registry and release the lease; add the lifecycle action mapping; keep "no auto-answer" on shutdown/cancel. My service-side `answerQuestion()` and journal events are ready for that caller.
2. Core control route owner: construct the answer control command in the existing lifecycle command builder and map question-answer refusals (stale/revoked/cross-tenant) to the existing 409/503 handling rather than a new surface. Core is a separate repo from this worktree's control module; no edit attempted there.
3. Contract distribution: run `npm ci` then `npm run check:contracts:distribution` to regenerate `packages/contracts/dist` with the answer vocabulary; this is the prerequisite for the frontend control/event join. Generated-file ownership stays with the build, not with a hand edit.
4. Frontend/UI join (238-owned, not the three 155 paths): answer card in the existing conversation/control surface driven by the dist event contract — selection + free text + multiselect, waiting/cancelled/error states, refresh/reconnect recovery. Not started; it cannot compile against an unregenerated dist.
5. SCRUM-236 NotebookEdit hunks remain Root's to compose; my policy/options default-admitted branch is written to accept the name without claiming native notebook proof.

## Remaining acceptance (unrun, honest)

No deployed behaviour was exercised: no cloud, no product image build, no browser journey, no provider/DB/live effect. Native SDK AskUserQuestion against a real mounted receiver is unproven here; a static card or mocked assistant question is not evidence and none is claimed. Source success in this handback is not deployment and not Done. Remaining live criteria: deployed chat triggers a native question, the answer reaches the suspended SDK call and the run continues, free text/multiselect work, refresh/reconnect retains the question, cancel runs no unintended action, duplicate/stale/cross-tenant/revoked replies handled — to be proven by a separate acceptance session after Root's merge and shipment.

## Next action requested from Root

Allocate the two blocked joins (235 pump dispatch; Core control route) and one `npm ci` window for the contracts dist regeneration, then I continue this same session on the UI join and the worker registry test against the installed tree.
