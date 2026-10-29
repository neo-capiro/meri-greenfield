# SCRUM-238 AskUserQuestion — isolated-tree completion handback — 29 October 2026

Author session 20261029_154054_c5be2d (deepseek/deepseek-v4.1-flash-1017 via openrouter). No git init, no global Git/model/auth change, no reset, no new actor, no replacement session.

## Tooling disposition (unchanged, unresolved, not retried)

The previously rejected junction removal was not retried, bypassed or retargeted, and no command resolves or writes through that shared donor alias. The exact rejected command/evidence stays in `outputs/SCRUM238-54545-SHARED-LINK-REPAIR-20261029/`. The old checkout `C:/dev/meri-cap-scrum238-20261029/meri` and the shared 188 donor are untouched by this turn.

## New sole author workspace and dependencies

- C:/dev/meri-cap-scrum238-isolated-20261029/meri, branch `hermes/scrum238-askuserquestion-isolated-20261029`, base c26157591db6d057663365de7ba170edd98cf2ca. All prior work carried over; nothing restarted.
- Locked dependencies installed **into this tree only**, scripts disabled:
  - root `npm ci --ignore-scripts` EXIT=0
  - apps/worker/conversation `npm ci --ignore-scripts` EXIT=0 (104 packages, incl. zod 4.6.7, SDK 0.3.295)
  - packages/contracts `npm ci --ignore-scripts` EXIT=0 (24 packages, incl. esbuild 0.28.2)
  - packages/ui-stream `npm ci --ignore-scripts` EXIT=0 (13 packages, needed by the legacy HTTP owner)
  No junction, no link into another worktree, no write through a shared target.

## The four connected defects, fixed

1. **Native multi-select shape.** `capabilities/questions.mjs` now returns `updatedInput.answers` as `Record<string,string>`: multi-select arrays are comma-joined at the native boundary (`nativeAnswers`), and a general reply is mapped onto the one question it answers instead of a bare `response` success. Verified against the installed `sdk-tools.d.ts` (`answers: {[k:string]: string}`, "multi-select answers are comma-separated"). Single-select array, unknown question, duplicate and cross-tenant answers still refuse.
2. **Claim envelope.** `questions/dispatch.mjs` now reads `commandSha256` from `claim.control` (the real envelope) instead of inside `command`, refuses to half-apply a claim without a valid digest, and forwards the original bound `signal` to the ack. A test asserts the ack carries the envelope digest.
3. **Recovery seam.** `createQuestionEventJournal.read()` no longer pretends: it throws `USER_QUESTION_RECOVERY_UNAVAILABLE` (a suspended native callback does not survive its process, and a display event is not a resumable SDK owner). `registry.recover()` returns `resumable:false`, and `deliver()` on a recovered question returns `USER_QUESTION_UNRECOVERABLE` rather than resuming a dead call. The client keeps the card answerable only while the run is live.
4. **235 integration.** Fetched `b28b4aee2c5f6f299ce93a595745fcf4228e2b9f` from the 235 repo (same 4927 activity/runner lineage) and merged it into this branch: merge commit `882b64328`, no conflicts. `activity.mjs` now carries both 235's `capabilityPolicy` argument and my 13-line question join; `apps/runtime/conversation-runner.mjs` has 235's Bash readiness postimage; 236's NotebookEdit hunks are preserved. 235's own readiness suite runs green alongside mine.

## Frontend question journey (written, not described)

- `packages/meri-client/src/conversation-questions.ts` — pending-question projection from the run's durable events, answer mapping keyed by the asked question text, and the exact `answer` control builder. Re-exported from `@capiro/meri-client/conversation`.
- `apps/web/src/features/meri/conversation/QuestionCard.tsx` (+ `question-card.module.css`) — real card: one control per question, radio/checkbox by `multiSelect`, free-text per question, waiting/error/unavailable states, submit.
- `apps/web/src/features/meri/conversation/useRunQuestion.ts` — subscribes to the conversation port, re-derives the question from events on every change (so refresh/reconnect restores it), posts the answer control through the existing `control()` API, and surfaces refusal as a state.
- Mounted in `SessionComposer` (`ConversationView.tsx`) above the composer; a card whose port is gone renders as no longer answerable.
- Receiver proof: `apps/control/conversations/lifecycle/test/answer-route.test.mjs` posts an answer control at the **real mounted route** `/api/conversations/control` and asserts it reaches the lifecycle owner unchanged and that malformed answers are refused by the real validator. No new Core route was invented — the existing one already carried it once the answer intent was in the canonical contract.

## Focused results (direct exits; logs under scratch/scrum238)

- meri, questions + dispatch + mounted answer route + lifecycle-answer: **18/18 pass, EXIT=0** (`final-all.log`)
- meri, with 235's readiness suite joined after the merge: **24/24 pass, EXIT=0** (`iso-merged.log`)
- frontend, question projection/mapping/control: **4/4 pass, EXIT=0** (`final-fe.log`)
- generators: `generate-lifecycle`, `generate-conversations`, `generate-history` each regenerate and `--check` EXIT=0
- frontend TSX/TS parse: esbuild `PARSE_OK` on all five touched files
- Earlier real failures kept, not hidden: the resolve-after-delete deadlock, the long-timer hang, and the wrong registry-vocabulary assertion are all still visible in the retained logs, fixed rather than deleted.

## Commits (Root owns merge/push)

- meri: `d9ad038b5` question gate/durable events/answer control/dispatch → `882b64328` 235 merge → `8bb86e59c` mounted-route proof (HEAD `8bb86e59c`)
- frontend: `e9d00383c` question card, projection and answer control (HEAD `e9d00383c`)

## Not run / not claimed

- Frontend `tsc`/`next build`/vitest and the Playwright journey: the frontend worktree has no `node_modules`; installing Next.js deps was not performed in this turn, so typecheck/build/visual evidence is unrun. Files parse, and the pure logic is covered by the node run.
- No live SDK/provider/cloud/DB/browser effect. Native AskUserQuestion against a deployed mounted receiver, and true post-restart resumption, remain unproven — recovery is explicitly refused rather than faked.
- 237 search leaves (public-web schema/validator, catalogs, tariff) were transferred away and are untouched here; `apps/worker/conversation/sandbox-readiness/*` Bash qualification is 235's, not claimed complete.
