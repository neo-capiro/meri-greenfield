---
name: project-meri-first-chat-a16cc40d-handoff
description: 2026-10-19 Meri preview at a16cc40d image deployed; first chat still fails activity-load DEADLINE; AWS ownership handed to dot (PR121 6274410983)
metadata:
  type: project
---
State 2026-10-19 18:33Z (PR121 comment 6274410983; record branch fable/source348-a16cc40d-deploy-record-20261019 @5a42ec96):
- Live: Node image sha256:9bff84ba… (source a16cc40d), proxy 734a20ec (34851020); control:33 worker:32 runner:18 issuer:32 owner:31 proxy:31; secrets label FIRST_CHAT_20261019C. AWSCURRENT never moved.
- First chat (18:15Z) still fails `RUNNER_RUNTIME_FAILED stage=activity-load code=DEADLINE` even with the 23 s load budget: ~223 serial Core authority calls (~75 s) per load; Core ade7fc88 calls Clerk getSession per request.
- Open: event-stream 403 (control maps SESSION_REFUSED/CHANGED→403), static candidate deadline/grantIntents = render+15 min (expired before rollout ends), worker AZ/overlap restart, candidate j, terminal/grant readback.
- **I handed AWS operator ownership to dot.** Do not mutate AWS for Meri preview unless ownership is explicitly handed back. Neo still does secret uploads; re-render needs neomart private inputs.

**Why:** dot took over code fixes + integration and asked for a single operator.
**How to apply:** read-only only; check PR121 for a handback before any AWS action. Related: [[reference-meri-preview-rollout-traps]], [[feedback-meri-dot-pr121-coordination]]
