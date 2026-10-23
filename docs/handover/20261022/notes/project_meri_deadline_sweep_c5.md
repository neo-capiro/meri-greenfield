---
name: project-meri-deadline-sweep-c5
description: "10-20 deadline sweep of Meri candidate 5 (4797f7da): ranked BLOCKS-CHAT list (8 s capture, per-delta publish, 3 s session RPCs...), 3 fixes on fable/adj-sweep-deadlines-20261020, D3 rehearsal through the live control composition"
metadata:
  node_type: memory
  type: project
  originSessionId: 132a8902-f161-42d4-b1f8-47a3f7430573
  modified: 2026-10-20T21:14:00.798Z
---

Deadline sweep of candidate 5 `4797f7da`, 2026-10-20. Report: `C:\dev\fable\adj-reports\adj-e-SWEEP-DEADLINES.md`. Inventories (631 rows): `adj-e-notes\sweep-{runner,control,owner-proxy}.md`.

**Top BLOCKS-CHAT (unfixed):**
- **B2.** The end-of-turn capture rides an 8 s control→runner channel (`transportLimits` default; `prepared-run-registry.mjs:94` passes no limits) plus the router's 8 s. It needs about 14 s at median, so every streamed turn would end `failed`.
- **B1.** One fully authorized publish per SDK `text_delta` (32 Core calls: 6.3 / 10.5 / 15.7 s measured). Capacity is about 82 / 47 / 30 deltas before the E−279 s wall; c5 measured 40 deltas failing at tail after 30.
  - **Fixed on C6:** `fable/adj-c6-delta-coalesce-20261020` @ `1a738718` makes it 2 publications at every profile (`adj-e-C6-COALESCE.md`).
- **`d234d354` (125 s keep-alive) broke the C6 image gate:** `close()` waited for late kept-alive responses. Fixed on `fable/adj-c6-keepalive-close-20261020` @ `032b1174`.
- **B3.** SDK session-mirror RPCs at 3 s (`session-client.mjs` default), about 3.6 s at tail.
- **B6.** The proxy's 5 s watch refresh shares the owner `operation` lock with reserve and settle.

**Fixed on the branch** (pushed, not merged):
- `d234d354`: control keep-alive 125 s, past the ALB's 120 s.
- `496a9e59`: the owner never idle-closes the proxy's pinned sockets (was 900 s, and the proxy never reconnects).
- `b0d253e5`: Temporal broker native calls and stop at 10 s (were 3 s).
- `7afaeb83`: proxy in-request checks and close at 15 s.
  - Before, `check_seconds` was 5 s, which undid candidate 5's F1 on the request path.
  - `cleanup_seconds` was 1 s, so a request ending mid-refresh quarantined the proxy for good: about 25 % of closes at median.
  - This was my own F1 gap.

**D3 rehearsal (measured, quiet / median / tail):**
- Acknowledgement 21.5 / 32.9 / 49.1 s. Admit 18.1 s at tail against 25 s.
- Refresh and reconnect work with no event lost. Each reconnect costs 3.1 / 4.8 / 7.2 s of history read.
- Stop with a 20 s native stop answers 502 while the run is cancelled.
- A double submit gives one run.

**Root pattern:** fixed per-hop budgets enclosing N Core-backed verifies. Raising one budget moves the failure outward. The real levers are fewer verifies per hop (F3) and one nested budget table (C's lane).

**Why:** the next live attempt needs these before or alongside candidate 5. **How to apply:**
- Re-run `apps/runtime/test/first-turn-rehearsal.test.mjs` and `d3-rehearsal.test.mjs` on each new candidate, one container at a time.
- Discard any run that recorded `clockSteps` ([[reference-meri-in-image-test-recipe]]).

Related: [[project-meri-proxy-403-owner-grant-and-exchange-budget]], [[project-meri-greenfield-fable-shipping]]
