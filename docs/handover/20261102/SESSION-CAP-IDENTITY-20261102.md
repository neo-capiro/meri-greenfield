# Session cap and identity receipt: renewal cadence (2 Nov 2026)

Lane: Fable, `fable/session-cap-identity-20261102` (Meri) with the companion frontend branch of the same name. Scope: measure
what bounds an action session on preview, decide whether the session may outlive the identity receipt, prove the cadence.

## What bounds the session (source)

- Control: `apps/control/action-host/session/owner.mjs:153` sets a session's expiry to
  `min(identity.expiresAtMs, current.expiresAtMs, started + sessions.maxTtlMs, membership admission expiry)`; a recheck only
  shortens it (`:168`, `:175`). `sessions.maxTtlMs` is 300 000 on preview
  (`infra/product-preview/first-chat/render-material.mjs:471`, bound at `apps/runtime/config.mjs:129`).
- The identity and context facts are projected from one Core `/current` receipt per issuance
  (`apps/runtime/native-authority/identity-context.mjs:21-25`); the context adapter also takes the local run fact's
  deadline, `min(run expiry, now + runWindowMs)` with `runWindowMs` 900 000 on preview
  (`apps/control/action-host/application-adapters/context-adapter.mjs:85`, `apps/runtime/conversation-identity.mjs:19`,
  `infra/product-preview/first-chat/policy.json:13`).
- Core: the identity evidence expires at `min(JWT exp, Clerk session expireAt, abandonAt)`
  (`capiro-backend apps/api/src/auth/clerk.service.ts:214`), and `/current` caps it at
  `checkedAt + APPLICATION_AUTHORITY_CURRENT_RECEIPT_TTL_MS` (`application-authority.ts:185,213`): 120 s before Core PR
  408 (merged as `895d35ad95`), 300 s after.
- Frontend: the session issuance route mints a 300 s Clerk token for the signed-in session
  (`capiro-frontend apps/web/src/shared/meri-actions/identity-token.server.ts:7-18`, used by
  `apps/web/src/app/api/action-followthrough/[operation]/route.ts:42`); only when that mint fails does it fall back to the
  cookie token (60 s). The controller ends an idle session `RENEW_LEAD_MS` (45 s) before its cap
  (`apps/web/src/shared/meri-actions/opaque-session-controller.ts:33,184-189`).

## Measured cadence

- Live, 2 Nov 02:22-02:24Z, frontend 4a586773, Core before PR 408 (`C:/dev/fable-meri-20261031/ACCEPTANCE-20261101/
  ACCEPTANCE-REPORT-20261101.md`, X14 evidence (b)): `action-followthrough/session` 200 about every 71 s per idle tab. That is
  the 120 s Core receipt minus the 45 s lead (75 s), not a 60 s Clerk token (which would renew every 15 s): the 300 s mint is
  working on preview, and Core's 120 s receipt was the binding input.
- After Core PR 408 is deployed: the Core receipt, the Clerk token and the control cap all sit at 300 s, so an idle tab
  renews once per ~255 s (the control cap is reached a few hundred ms before `started + 300 s` because the Clerk token's exp
  predates issuance by the mint latency). The "about 60 s identity receipt / every 15 s" statement in
  `DOCUMENT-CARDS-20261102.md` was an inference, not a measurement.

## Decision

The session cannot safely outlive the identity receipt, and no control, Core or frontend change to the cap or the lead is
needed:

- The session record pins the native Clerk token it was issued with and re-presents that token to Core on every recheck,
  transition and read relay (`owner.mjs:132,168,190,228`); Core refuses an expired JWT outright
  (`clerk.service.ts:187-188`, `tenant-context.middleware.ts:662-663`). The identity receipt's expiry is therefore the hard
  bound for that credential at Core, not a freshness hint: letting control hold the session past it (option a) would only
  make every later operation fail at Core and hand reads a dead credential. A Core receipt lifetime independent of the JWT
  (option c) is impossible for the same reason.
- A renewal lead proportional to a short receipt (option b) would shorten the time an idle tab's session has left when a
  send starts (15 s instead of 45 s on a 60 s receipt) and so cut more turns at the hard cap; it changes nothing at 300 s.
  Short receipts only occur on the mint fallback, which is not what preview does.

What this lane adds instead:

- Meri: counting tests in `apps/control/action-host/session/issuance-fanout.test.mjs` through the real issuance route,
  session owner, native identity context and membership gate: a 300 s Core receipt under the 300 s cap costs one fresh
  `/current` read per 255 s renewal and nothing between; 120 s and 60 s receipts bound the session below the cap; a revoked
  user (Core 403) loses the session at the next operation and the next renewal is refused. The fixture's run-fact deadline
  is now 900 s, as on preview, so it no longer bounds the session below the cap at 100 s.
- Frontend: `receiveSessionReceipt` now applies the client's own 300 s bound to a receipt instead of refusing it. With the
  300 s token and Core PR 408 the server receipt sits at that bound to within the issuance latency, so a browser clock a
  second or two behind would otherwise refuse every Files/tasks session; the Meri-side expiry is unchanged. Plus a cadence
  test in `tests/meri-conversation-reconnect.test.ts`: one issuance per 255 s on an idle 300 s session, four in 765 s, and
  a refused (403) renewal ends the tab's access with no further issuance.

## Live input still needed

Deploy Core `895d35ad95` (PR 408) and re-read the X14 idle window: `action-followthrough/session` should recur about every
255 s per tab. If it still recurs every ~71 s with that Core, the receipt's `expiresAtMs - now` on one issuance says which
input binds (about 120 s: the Core receipt; about 60 s: the token mint fell back to the cookie token; check the frontend
task's Clerk secret).

## Separate item: 403 on the event-stream reconnect (coordinator's live note, ~06:09Z, control :101, frontend :76)

Control never ends an open stream because a renewal issued a newer session: sessions coexist until each one's own cap
(`owner.mjs:156-158`; the new cadence test holds two). A renewal only replaces the session on the client, which disposes the
old port and aborts its stream (`opaque-session-controller.ts:88-97` -> `conversation-network.ts:249-260`). What control
does do:

- A stream is a chain of <=30 s observation windows (`apps/control/conversations/events.mjs:5`, `maxSubscriptionMs`), each
  opened with a fresh session observation (`service.mjs:178` observe -> `operation()` -> `fresh()` at `:70-76`) and
  re-observed every 10 s idle and after every delivered page (`events.mjs:5` `idleRecheckMs`; `service.mjs:182-186`). The
  client resumes the next window with `GET /api/conversations/events/<id>/stream` and `x-meri-resume-sequence`
  (`packages/meri-client/src/guarded-transport.ts:285-290`, `useRunObservation.ts:85`).
- If the session expires or is refused inside a window, the recheck fails and the window body errors without a status
  (`events.mjs:14`, `SUBSCRIPTION_UNAVAILABLE`); the next reconnect GET is then refused at open: `valid()` (`owner.mjs:76`)
  or a context mismatch (`owner.mjs:135,152`) -> `fail('SESSION_REFUSED')` -> `http.mjs:60` answers
  `conversationErrorStatuses.SESSION_REFUSED.at(-1)` = **403** (`packages/contracts/conversation-application/protocol.mjs:4`,
  `[401,403]`). The same 403 covers an expired session, a revoked user and a session pinned to a run that a reservation has
  since superseded (`owner.mjs:79` pins the run; `apps/control/conversations/next-run.mjs:26` returns the RESERVED successor
  before the exact-run check, so the recheck's binding differs).
- The client treats any 401/403 on that route as a revocation (`conversation-network.ts:323-327` -> `revoke()` :241-248 ->
  `onAccessLost`); the controller reports "expiry" only if the browser clock is already past `session.expiresAtMs`, else
  "access-lost" (`opaque-session-controller.ts:168-169`), and an access-lost hides the conversation
  (`useConversationConnection.ts:64-76`). So a 403 reaches the UI as a denial whenever control refuses an old credential
  before the browser's own expiry timer (`conversation-network.ts:221-224`) has fired: a session held past its cap while
  `busy()` deferred the renewal (`host-controller.ts:42-51`: submit/cancel pending, history/lifecycle in flight, feedback,
  artifacts or uploads pending) with control's clock ahead of the browser's, or a run superseded under a still-open session.

Not fixed in this lane: which trigger it was needs the 403 body code and the refused session's `expiresAtMs` against the
time of the 403 (`CONTROL_SESSION_REFUSED step=... code=...` lines on control, `owner.mjs:41-48`, say whether it was
`identity`, `context` or an expired record). A candidate fix is client-side: on a port-level denial, reopen through a fresh
issuance and let that issuance's own 401/403 decide access loss (it re-verifies at Core, `opaque-session-controller.ts:197-200`),
instead of deciding from the browser clock; that is a conversation-lifecycle change for its owner, not a cap change.
On "the client renews every ~15 s": frontend 99270c9b carries the 300 s token mint (`identity-token.server.ts:7`), so a
15 s cadence means 60 s receipts, i.e. the mint fell back to the cookie token on that build; one receipt's
`expiresAtMs - now` on the serving build settles it.
