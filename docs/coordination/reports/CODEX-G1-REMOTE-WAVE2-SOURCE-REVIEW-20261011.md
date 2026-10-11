# G1 remote wave 2 — Codex combined source review

Date: 2026-10-11 UTC. Decision: **ACCEPT INERT SOURCE CANDIDATE ONLY**. G1 and REL-02 remain **OPEN**; G2–G7 remain unentered. Shared operating policy was refreshed from `neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac` (`origin/main@b2b0ce8c2bf03817b81e671d968b7892985b8d06` is its ancestor); the local machine map is dated 2026-09-30 00:21:48 UTC. No external action was authorized by that refresh.

The wave-2 branch `task/remote-rel02-meeting-source-20261011` descends from reviewed wave-1 source checkpoint `1e5b9eb391e1b716c7f11608d7ebbe833f85fdd1`. Bounded H4D returned source commit `2202fdf33501772c39f616287161b4ef74fa3b7e` after allocation `65b293fd5919cf18bc33fbf3c3cda5051118461b`. Its PID/session were independently closed and the registry is CLOSED. Codex independently checked the changed paths, committed file hashes and frozen Capiro Git-object producer spans, then recorded the nullable calendar-status correction and source-only disposition in `88a0608503336ad868aebe877db92814512889d3`. The candidate covers calendar inventory, debrief list/exact body and meeting inventory/exact body for three selected intents; it registers no operation, handler, source or skill.

After review, Codex corrected a separate coordination overclaim in `70a289491b03bf05c72be01e94aa7e6c5c9e323f`: a local Cleanup1 chat response is a lead, not proof of the active other-server execution named in the pinned handover. GitHub PR #2391 currently identifies source head `952272ec657937da47ada998534c382fb73955d2` and says its native Linux/Docker gate has not run, but gives no active remote session locator or owner handoff. Shared API/auth/CORS/schema/migration/source-access, fixtures, resource cleanup, merge and release remain held pending verified coordination.

## Independent integrated checks

- Pinned Node 24.19.0 `npm run check`: **138/138 pass**, exit 0. This is the repository's contracts plus Hermes-session script; it is narrower than the combined command below.
- `node --test packages/contracts/test/*.test.mjs apps/worker/qualification/checkpoint/fixture-channel.test.mjs apps/worker/qualification/checkpoint/fixture-transport.test.mjs evals/qualification/hermes-session.test.mjs`: **188/188 pass**, exit 0. This is the reviewed wave-1 combined source scope plus the 16 new meeting cases.
- The meeting candidate's focused tests are **16/16** and the contract-only suite is **133/133**, both exit 0. The source commit's three code files match the SHA256 values in its handoff report.
- The branch is a clean descendant of `1e5b9eb`. No source connection, model call, native job, cloud write, push, PR, merge or deployment occurred in this wave.

The historical `.task-inputs`/H1 archive, 75 real-request owner/location, effective cloud role/resource binding, actual proxy authorization and revocation, durable budget/model, two-task SDK restore, native browser host, RG-08, measured cohorts, exact-image security/license closure and verified remote Cleanup1 owner remain open. Synthetic source checks do not substitute for these gates.
