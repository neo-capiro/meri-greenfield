---
name: meri-d016-delegated-decisions
description: "2026-10-18 Neo delegated the Meri integration activation decisions to Fable; rule = production-grade, no over-engineering, no scope increase; recorded as D016"
metadata:
  node_type: memory
  type: feedback
  originSessionId: b81da8ea-2099-4b5e-98f7-0b59fee31c83
  modified: 2026-10-18T07:55:29.937Z
---

On 2026-10-18 Neo delegated the open Meri integration decisions to me (verbatim: "make good decisions for me . make decisions that will produce production grade product but dont over engineer or increase scope … you can add reasonalble work but nothing significant that will slow things down"). I recorded them as **D016** in `meri-greenfield` `docs/coordination/DECISIONS.md` (integration branch `fable/meri-integration-20261018`).

**Why:** three days of first-chat troubleshooting; Neo wants the integrated product shipped, not more decision loops. Dot's reviews had been turning engineering choices into owner questions.

**How to apply:** decide engineering details myself under that rule; approve what is built, measured and reviewed; defer anything that is genuinely new scope or new policy (option B read delegation, unattended routine firing, Objective activation, W1 WAF). Quote Neo's instruction verbatim when dot asks for owner authority. Each activation still goes through the one reviewed deployment packet and dot's read-only review; nothing is deployed on merge alone. See [[meri-dot-pr121-coordination]] and [[meri-greenfield-fable-shipping]].

**Superseded in part by D016-A** (18 Oct 07:50–07:51 UTC, `docs/coordination/DECISIONS.md` in meri-greenfield). Neo said "pretend this is going to be production grade". Under that amendment:
- option B read delegation and unattended routine firing are **in scope**;
- Objective ships composed but disabled until Core's phases land.

Do not treat these three as deferred. W1 stays not applied. The 20 Oct canonical capability ledger (`CAPABILITY-LEDGER-20261018.md` §R2) records this.
