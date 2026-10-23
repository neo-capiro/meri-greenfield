---
name: feedback-neo-does-post-deploy-verification
description: "Neo 10-21 — Fable doesn't do live post-deploy verification; post acceptance criteria to dot on #202, and dot hands them to the 'astra 6' session in ultra code"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 57abea96-0ea5-4faa-b2f1-7f8812ef4cd3
  modified: 2026-10-21T22:59:51.285Z
---

**Neo, 2026-10-21:** "after deployments leave the verifications to me you dont have to do those". Then, refined: "actually give live verifications to dot. give dot acceptance criteria, and tell it to give it to astra 6 sesssion in ultra code."

**Why:** live checks (two-turn chat, fresh-tab checks, UI walkthroughs) took a lot of Fable's time per release. A separate verifier session does them.

**How to apply:**
- Still run the deploy kit's own health gates: service stable, healthy targets, circuit-breaker or rollback on failure. They are part of deploying safely.
- Do NOT run live chat checks, browser walkthroughs or acceptance checks after a deploy.
- After each deploy, post on neo-capiro/meri-greenfield#202 "FROM: Fable | TO: dot (relay to astra 6, ultra code) | TYPE: acceptance". Include:
  - what shipped (SHAs, images, revisions);
  - numbered pass/fail acceptance criteria with exact steps and expected results;
  - what counts as a failure;
  - the rollback command, which only Fable runs.
- Act on astra 6's results when dot relays them (fix routing, rollback).
- Give Neo a one-line note per deploy.

Related: [[feedback-agent-relay-autonomy]], [[project-meri-greenfield-fable-shipping]].
