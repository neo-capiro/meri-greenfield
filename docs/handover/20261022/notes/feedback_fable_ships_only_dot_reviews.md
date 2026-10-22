---
name: feedback-fable-ships-only-dot-reviews
description: Neo 10-22 ~00:40 UTC — Fable writes phase BRIEFS and SHIPS (merge, deploy, build/image gates, AWS facts); dot owns code reviews and live verification; no Claude reviewer sessions
metadata:
  node_type: memory
  type: feedback
  originSessionId: 57abea96-0ea5-4faa-b2f1-7f8812ef4cd3
  modified: 2026-10-22T00:36:38.895Z
---

**Neo, 2026-10-22:** "yes delegate review jobs to dot as well" … "you should only be shipping since dot cant do that" … then "lets move them. i want you to create briefs and ship".

**Why:** dot and its ChatGPT sessions (e.g. astra 6 in ultra code) can review and verify but can't merge, deploy or touch AWS. Fable's Claude reviewer sessions duplicated that work and cost tokens.

**How to apply:**
- **Fable does:**
  - write each phase's agent briefs (verbatim ticket text + standing rules), posted on #202;
  - merge PRs that dot's reviewers ACCEPT;
  - build and run the image/CodeBuild/container qualification gates (they need AWS or Docker);
  - deploy, plus the kit health gates and rollback;
  - database migrations (snapshot first);
  - read-only AWS/DB facts that agents or reviewers need;
  - post acceptance packets for verification after each deploy.
- **Fable does NOT:**
  - review code;
  - start or assign Claude reviewer sessions;
  - run live chat checks.
- Review requests go to dot on #202, with the PR, head SHA, acceptance source (ticket text or change list) and required gates.
- Where a gate needs Docker or AWS that dot's reviewers lack, dot marks it BLOCKED and Fable runs it as part of shipping.
- Supersedes the review parts of [[feedback-agent-relay-autonomy]]. Related: [[feedback-neo-does-post-deploy-verification]].
