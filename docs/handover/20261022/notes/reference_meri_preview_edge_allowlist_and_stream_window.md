---
name: reference-meri-preview-edge-allowlist-and-stream-window
description: "Meri preview edge facts - Core preview host ALB path allowlist (404 PREVIEW_ROUTE_NOT_FOUND), no CloudFront, ALB idle/WAF/log settings, and the 30 s SSE window race"
metadata:
  node_type: memory
  type: reference
  originSessionId: d3a92189-b181-4f1b-8b86-f8c6293dbf1c
  modified: 2026-10-20T17:25:03.810Z
---

Read 2026-10-20 (adj-g sweep, `C:\dev\fable\adj-reports\adj-g-SWEEP-FRONTEND-EDGE.md`).

- **Core preview `first-chat-preview.app-dev.capiro.ai` sits behind `capiro-prod-alb` listener rules 1–3, which form a path ALLOWLIST.** Allowed: POST `/api/clio/application-authority/{identity,context,membership}` and `/api/clio/conversations/bootstrap`; GET `/api/me`, `/api/clients`, `/api/clients/<uuid>`. Everything else, including OPTIONS, gets a fixed 404 `{"error":"PREVIEW_ROUTE_NOT_FOUND"}` with no CORS headers. A Core route that exists in capiro-backend is still a live 404 until a rule admits it (for example tools/get_client_context).
- `meri-preview.capiro.ai` (control) is on the same ALB (rule 4). The ALB has idle timeout 4000 s and WAF `capiro-dev-waf` (AWS Common, KnownBadInputs, SQLi, body-XSS block), so chat prompt bodies are WAF-inspected. Access logs are off.
- `portfolio-preview.app.capiro.ai` is its own ALB with idle timeout 60 s, no WAF and no access logs. The browser goes through the portfolio-web proxy only (same origin); control sends no CORS headers.
- No CloudFront in front of any of them.
- Control's SSE window is ≤30 s by control's own clock, with no heartbeat. Client and proxy timers must sit past it. Before capiro-frontend `3451cfd5` they were 30 s and cut every window ("failed to pipe response … Conversation observation interrupted" in `/capiro/portfolio-preview` logs).
- Frontend tests: the Windows `node_modules` is not faithful. Use WSL `/opt/fe-ship-<sha>/src` (adj-b's installed tree) copied, with `PATH=/opt/adj-b-transport/node/bin:$PATH`; Playwright browsers are under `/root/.cache/ms-playwright`.

Related: [[project-meri-greenfield-fable-shipping]], [[reference-portfolio-preview-frontend-ship-flow]]
