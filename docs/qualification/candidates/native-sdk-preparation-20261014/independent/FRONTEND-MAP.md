# Independent frontend connection-map review

Initial local read-only source review at HEAD `a0f4cabdfecd4850e0ed62ffcfa5508c5a466453` on 2026-10-14. Source hashes below identify the reviewed working files; this is not frontend PR36 verification, deployment qualification or live API acceptance. Initial review made no source changes or network calls. Parent subsequently authorized the narrowly scoped private snapshot composition fix below. No frontend repository, live API, provider or AWS calls were made; verification used task-owned loopback HTTP only.

Verdict: public contract map matches canonical owners. The private snapshot composition gap discovered in the initial review has been fixed and locally qualified; production origin/authority/resource binding remains pending.

- Issuance is POST `/api/action-followthrough/session`, JSON hints with only optional `conversationId`, `runId`, `clientId`, identity Bearer credential. Receipt is exactly `credential`, `expiresAtMs`, `context` containing `tenantId`, `actorId`, `conversationId`, `runId`, `selectedClientId`. The opaque credential is issued by the existing process-local owner, not supplied by the browser. Context binding/scopes/revision are reread and pinned; policy revisions reside in scopes. No new frontend token or guessed receipt fields are needed.
- Backend authority client uses unchanged canonical identity/context routes via `applicationAuthorityRoutes`; identity body is empty and context body is `identitySha256`, `conversationId`, `clientId`. The browser must not call this private bridge with guessed authorization facts. Existing identity-context composition, actual account/client/run mapping and serving origin still need production binding.
- Public POST submit/history/cancel/events and GET reconnect match protocol package version `0.1.3` (wire contract `0.1.0`). Submit is `{requestId,prompt,windowRequest?,skill?}`; history is `{after?,limit?}`; cancel is `{}`; canonical events is `{command:{conversationId,intent:'view.subscribe'}}`. Server also supports a closed legacy events cursor body `{after?,limit?}`. Do not add a conversation/run/client selector to submit/history/cancel. Their current run comes from the session. Events/reconnect selectors must match that session's run. GET reconnect has no body/content-type, uses `x-meri-resume-sequence`, and rejects Last-Event-ID/query selectors. Forward statuses/no-store and UI stream bytes without wrapping/re-encoding.
- Private execution start/poll use the control capability; runtime/session operations use the original task capability and owner authority. These are not frontend proxy operations. Gateway maps `/v1/runner/<run-owner-op>` to `/internal/conversations/<op>` and maps `/v1/runner/session/<op>` to the same private path on its fixed `controlOrigin`. Runtime `/v1/runner/runtime` is a separate broker execution receiver, not a gateway run-owner route.

## Private mount finding and qualified correction

Initial review found that the gateway's fixed snapshot route forwarded to control while the standard control product mount omitted the snapshot port. Parent authorized capturing the optional borrowed `sdkSessionSnapshot.readSnapshot` via the existing inert `storageMethod`, then passing it to `createNativeSdkSessionApplication`. The root-owned broker stack now supplies `sdkSessionSnapshot:continuation`, reusing the canonical continuation owner. No public route, request factory, token, JSON contract or alternate storage owner was added. Absent the optional snapshot port, the route remains 404.

`apps/runtime/test/snapshot-mount.test.mjs` passes 3/3 controls: actual `assembleControl` plus two loopback HTTP listeners and fixed gateway deliver snapshot bytes to the captured original port; foreign/revoked capabilities are refused by the borrowed owner; no public snapshot route exists; absent port stays 404; getters/proxies remain inert. Snapshot checkpoint content and authority decisions are explicitly synthetic. No real checkpoint lifecycle or authority was claimed. Existing product mount, native gateway and session HTTP controls plus these tests pass 22/22. Initial fixture used an artifact response bound above its canonical cap and failed construction (1/3); failure is retained, fixture corrected to the existing cap before final runs. Captures: `author/snapshot-mount-initial.tap`, `author/snapshot-mount-final.tap`, `author/snapshot-mount-regression.tap` in this candidate. Syntax/diff checks passed. Independent production-source review and exact source freeze remain parent-owned.

Frontend must retain its unavailable state pending the approved fixed proxy origin, actual authenticated session/context binding and deployment resources, plus end-to-end native registration/events/transcript/cleanup acceptance. The map does not establish recent-conversation listing, approval counters or activation. The PR36 source SHA mentioned by the map was not independently fetched/read in this local-only task.

## Reviewed file SHA256

| Local source | SHA256 |
|---|---|
| `docs/coordination/reports/CODEX-FRONTEND-CONVERSATION-BINDING-20261014.md` | `69fd2d974789d54878810e6febc024b08997ed3cff170cda884a219a250489a0` |
| `apps/control/action-host/session/http.mjs` | `2403d12bf43147aeea9b6fd040ca1dd662d4f30d3dd19e263187e2bc38b69542` |
| `apps/control/action-host/session/owner.mjs` | `7239a73d05784f492d1d7c68a371ab1ca5c94fada71fc74a20b8c3f372769084` |
| `apps/control/action-host/application-adapters/authority-http.mjs` | `ba9af89c706dc6bbb27f55e06c9e6331e5c655edabb3a22d2cc13269750ef993` |
| `packages/contracts/action-authority-0.2/validate.mjs` | `40fa36caeedb7ec17bef27119c846feb372bf5e1c6678032d5bcd0ab540ebd79` |
| `packages/contracts/conversation-application/schema.mjs` | `c60771d1febe7cafdcacc0240345f019bbfa6e2097c0ba253279e922c58c7512` |
| `packages/contracts/conversation-application/protocol.mjs` | `7c515d2eedaa17b5e76977c8c8650cc53920f5d5653acae4741e262baffe80e2` |
| `apps/control/conversations/http.mjs` | `2e65b13ceb17ae74afc96490b639b1afc0a5cdce37ffd76ddc2c1eb28fb28b79` |
| `apps/control/conversations/service.mjs` | `4ba8918c187a0c749f9f199402b2090ef110623ca3af7ab63d47c44bab083170` |
| `apps/runtime/control.mjs` | `c800bd1650d7548df956057ffa34f6bf2ad96c36d0b4385b13e29a10afade67e` |
| `apps/runtime/product-applications.mjs` | `0786822a690e5f2f7d7f5e48e799a9caa8bc347cc79225dfd3b8245ba1de9f11` |
| `apps/runtime/worker-http.mjs` | `4506bbd6e16c7bc05b52312abf1ee4030b5df461e9c65e3a0d10a5837bb8b1ff` |
| `apps/runtime/native-runner-gateway.mjs` | `ee7344c472cf838b9120de1f2a5bff40b09e3f68248948038836d71d048506d4` |
| `apps/runtime/native-authority/execution-http.mjs` | `b25b932af2b0817e99cecbc2f16b0d8641d12232419db11c38eb8a704b7a1e81` |
| `apps/runtime/native-authority/session-http.mjs` | `09e4228c1c0e4eece7d0d940f59838de1b75e67e003efec7a36ea233d321b4b4` |
| `apps/runtime/native-authority/broker-stack.mjs` | `171761ce42c3b9c8517b69adad4df761c9d1fb491c5e178338cf6070bf326bb5` |
| `apps/runtime/test/snapshot-mount.test.mjs` | `2bb91e2a19b9b779d3d1a29a3e1b56209e7894c3a8e9dd96e0ed700a370f5bf0` |
