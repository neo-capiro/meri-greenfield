---
name: project-meri-p1-p2-plans
description: "P1 refreshed and P2 drafted for Neo's external agents (10-21) at main e3ba4e47; live owner/proxy baseline numbers; agent harness = P0 scripts at 43b705c8"
metadata:
  node_type: memory
  type: project
  originSessionId: 132a8902-f161-42d4-b1f8-47a3f7430573
  modified: 2026-10-21T06:24:23.377Z
---

**The plans (2026-10-21, both at greenfield `main` @ `e3ba4e47`):**
- `adj-reports/phases/P1-PLAN.md`: the budget table. Refreshed at `e3ba4e47`.
- `adj-reports/phases/P2-PLAN.md`: proof reuse. New, written from `adj-b-PROOF-REUSE-DESIGN.md`.

**P1:**
- **Inventory:** `P1-INVENTORY.md` regenerated with a "since 5a8da2fd" column. The generator `p1-inventory.py` reads local sweep notes, so agents use the committed file, not the script.
- **§9 decision:** one `meri.budget.table` startup line (sha only), as a droppable last commit.
- **§10 conflict rule:** rebase onto the latest main and regenerate the golden file from the rebased base. Never hand-edit it.

**P2:**
- **Two PRs:** PR-A (pair lease + admission lease + partner **re-proof** replacing the permanent retire + failure rules) and PR-B (wire collapse).
- **No dual wire shapes:** pins are per deploy, so mixed revisions can't pair.
- **No flags:** O55 says rollback is the previous release.
- **An independent security review** is required.

**Live baseline** (P0 telemetry, candidate 8, one model request at 05:55Z):
- 31 owner exchanges;
- ≈ 650 proxy ECS/EC2 calls, about 493 of them landing in the background rollup. That is a P0 attribution gap: the parallel discovery threads lose context;
- 609 owner ECS/EC2 calls, 93 owner Core calls, 5 405 owner DB statements;
- bootstrap 6.5 s, settle 10 s.

**Agent environment:** `git show 43b705c8:scripts/qualification/p0-telemetry/{verify.py,evidence.py,in-image.sh,proxy-tests.sh,proxy-test.Dockerfile}`. That harness ran end to end (adj-a).
- **The deployed proxy image can't be built by agents:** it uses a private `PROXY_ASSEMBLY_IMAGE`. The shipper re-runs the proxy suites in the deployed image.

**Why:** the agents have only GitHub. **How to apply:** validate against these plans; re-check anchors if main moved.

Related: [[project-meri-hot-path-phase-workflow]], [[reference-meri-owner-proxy-pair-restart]]
