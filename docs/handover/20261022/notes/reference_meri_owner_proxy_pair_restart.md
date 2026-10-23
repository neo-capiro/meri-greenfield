---
name: reference-meri-owner-proxy-pair-restart
description: Never restart the Meri model owner or proxy alone — the owner locks its pair identity and refuses a replacement proxy forever
metadata:
  node_type: memory
  type: reference
  originSessionId: 57abea96-0ea5-4faa-b2f1-7f8812ef4cd3
  modified: 2026-10-20T22:48:57.222Z
---

**The lock.** The model owner fixes the (owner task, proxy task) pair identity on its first pair read and retires itself on any different proxy task (`apps/proxy/product/service-task-leases.mjs:16`: `if(identity!==null&&identity!==current){retired=true;fail();}`). The proxy has the same rule (`service_pair_discovery.py`, `self._identity`). The pair snapshot refuses whenever it sees more than one RUNNING task in either service.

**The failure.** On 2026-10-20 I force-restarted only the proxy, to get clean diagnostics after its 50-line refusal cap was spent. The first live chat then failed with `PRODUCT_PROXY_REFUSED gate=exchange step=reply-status phase=placement`: the owner refused the new proxy. Fixed by force-new-deployment on both services at the same moment, logged as O58.

**What a normal restart of both looks like:**
- Under the 200/100 rollout, both new tasks refuse the snapshot while the old tasks overlap.
- One owner usually exits `PRODUCT_OWNER_UNAVAILABLE` after about 3 min of pair wait, and ECS replaces it.
- Then the pair forms. A healthy pair is silent in the logs.
- Wait for 60–75 s of no `gate=pair` lines before a chat.

**How to apply:** restart owner and proxy together, or not at all. ADR P2 (proof reuse) should replace permanent retirement with a re-proof. Related: [[project-meri-hot-path-phase-workflow]].
