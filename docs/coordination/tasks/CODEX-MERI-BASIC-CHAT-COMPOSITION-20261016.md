# Ordinary Meri first-chat composition - 2026-10-16

Base: local Meri source `5b166bf`; task branch `work/meri-basic-chat-membership-20261016` in a separate checkout. Objective generation remains disabled and is outside this change.

## Narrow source change

The existing Core membership gate is already the current member/client-roster owner for history. Trusted `assembleControl` will pass that same gate into the existing opaque action-session owner. The session owner will keep the original Core `/identity` receipt and `/context` hash join intact, pin the admitted membership principal at session issuance, and recheck that principal and selected client around each session use and transition. A changed, removed, or suspended membership will invalidate the stored session before an ordinary request or stream result is released. No browser claim or worker payload becomes authority; the worker must present an existing native identity credential that Core accepts.

The conversation service, PostgreSQL journal, Temporal dispatcher, SDK loop, stream producer, and membership-gated history remain their canonical owners. The source change adds no route, framework, credential, migration, or provider call.

## Focused verification and remaining binding

Extend the existing `assembleControl` fixture to exercise session issuance, first input/submit, public events, and history under current and revoked membership. Use the existing scripted worker/stream fixture for a saved assistant delta and reload if it runs without an install. Run focused Node 24 checks with the existing dependency tree; do not build or install while disk is constrained. Review the owner and composition diff independently before acceptance.

The focused offline results at this task branch are `session.test.mjs` 9/9, `transition-owner.test.mjs` 69/69, and `startup-history.test.mjs` 12/12 under Node 24. The assembled startup fixture exercises allocation, submit, private scripted delta publication, public SSE, and the same saved delta in the membership transcript. It also denies removed, changed, or client-excluded membership before new session, admit/submit, stream, and reload release. The scripted publication is not a model call or physical worker launch. No dependency install or production build was run.

For the single fixed preview, control's configured `nativeCandidate.identity.commandContext.binding.conversationId` must name an active, unarchived backend `ClioConversation` row owned by the same tenant/actor and selected client. The existing authenticated backend `POST /api/clio/conversations` can create that row, but no live write or configuration is authorized here. Reusable new-chat allocation needs its own reviewed source composition. Other live bindings remain the frontend Clerk/Core/Meri origins and flags, product PostgreSQL schema, Temporal TLS/queue, isolated native task/session observation, and qualified model proxy/provider pin.
