# Proxy ASGI lifetime/server independent review

Review outline, 10 October 2026. This Codex reviewer did not author the server/lifetime candidate. The review starts from `e1d7dea29872176476c2455cc97f3ffa34b1ef92` and waits for the author's closed exact commit before reading new source.

The finite review covers independent lifetime scheduling, original deadlines, genuine canonical ingress renewal, single receive ownership, bounded body/queues, sticky denial before cancellation, bounded cleanup and readiness quarantine, and the native transport guard's count/UNKNOWN/presend wiring. Existing GrantAdmission, ingress, Postgres ledger and native counter remain canonical owners; no alternative authority or accounting store is introduced.

After complete source inspection, run scoped offline checks and useful independent boundary controls once with binary captures, finite direct-child bounds and pinned runtime/source pre/post records. Real upstream callback assembly, direct TLS/ECS provenance, continuous production revocation, durable database/accounting and physical termination remain outside this source review. No AWS/provider/server/database/Docker/Hermes execution or dependency installation is authorized. Findings, exact source/evidence identities and a bounded verdict follow when the candidate is closed.

## Verdict and scope

**BLOCKED for source acceptance.** The independent composed controls reproduce three ways a mandatory background task can disappear without denying the request. This is separate from the intentionally unqualified real LiteLLM/TLS/ECS composition and from the independently retained canonical timing errors below. No runtime, security, G1 or deployment authority follows from this review.

The reviewed author commit is `f8c122c19136976b94f34c90d4a7fc9f2933cacf`, directly based on `e1d7dea29872176476c2455cc97f3ffa34b1ef92`. It changes exactly the seven allocated paths. The dedicated review branch copied that commit with an ordinary cherry-pick to `731414c21acf41e8b09cda387410eafc9c1c2873`; every reviewed source byte is equal to the original candidate's raw Git blob. The reviewer did not author the seven-file candidate and modified no candidate source, dependency, contract, migration or infrastructure. The outline above preceded candidate inspection and execution. The fixed discovery report at `5728589c1b7447e0585ded18be8f26d679dc9f36` and unchanged ingress/admission/guard/counter/ledger/store boundaries were read first; no mutable author source was inspected before closure.

## Required repair: unexpected background cancellation must latch deny

`runtime/lifetime.py:107` retrieves the observer/state task result. A canceled task raises `asyncio.CancelledError`, which `refresh` at122–123 and `_watch` at138–139 propagate without setting the deny latch. The task completion callback at91–96 removes/observes tasks but provides no mandatory-watcher failure supervision. Consequently, a trusted observer which raises cancellation on its second call, or the canonical authority's injected store which raises cancellation on its second check, silently removes the watcher. The quiet upstream remains running; `reason` stays `None`, readiness stays true, and no later renewal is scheduled. The request's original deadline still exists, but this does not satisfy continuous renewal/failure denial before that deadline.

Two independent one-request controls reproduce this after a successful initial canonical admission. Both observer and state-cancellation cases observe two observer calls; state cancellation observes two state calls. At the finite observation before the original deadline, the active task list contains the upstream, receive pump and deny waiter, with no watcher; the upstream's finally block has not run. These use a genuine `IngressAdmission`, `GrantAdmission`, typed `PeerLease` and full independently fixed `RunBinding` with a synthetic in-memory store. They do not mutate production functions or import candidate fixture expectations. The ordinary `RuntimeError` observer control denies and closes correctly, showing that the cancellation classification is material.

`runtime/server.py:84–85` has the corresponding receive-owner path: if the actual receive awaitable raises `CancelledError` independently, the pump exits silently. In the third control, the watcher continues checking current state, but the upstream stays active and the local reason remains unset. An upstream waiting for request data can thus remain stranded until the original deadline; disconnect/receive processing is no longer owned by an active task.

The bounded repair should make unexpected termination/cancellation of mandatory observation/receive work deny the request before cleanup cancellation, while preserving ordinary whole-request cancellation and `close()` behavior. Existing `deny()` is sticky, and `close()` already latches `REQUEST_CLOSED` before canceling tasks, so those intentional paths can remain distinguishable without new authorization/accounting state. Cover the observer, state-result and receive-owner cases with permanent composed controls, retain the original failed evidence, and independently re-review the new source. Do not treat cancellation completion as physical provider termination or refund UNKNOWN.

## Measured disconnect/backpressure limitation

The bounded queue preserves one actual receive owner and finite memory. It also limits disconnect observation: with an upstream that never consumes request data, two request events are queued and one is held at `channel.put` (`server.py:83`). The next disconnect event remains unread. The independent finite control observes exactly three receives, no disconnect read, an active request and seven observer calls. This is a documented limitation of this queue policy, not evidence that the independent authorization watcher stopped.

The paired control revokes the canonical grant under the same full channel. It still observes exactly three receives/no disconnect read, but the watcher denies and cancels the upstream. Single receive ownership and body bounds should be preserved; do not widen queues or discard request data to conceal the limitation. Actual server/disconnect behavior, later partial-body handling and physical transport termination remain separate qualification work. The report must not imply that every disconnect is observed immediately under backpressure.

## Source properties established within this scope

The ASGI entry is import-inert and calls an explicitly injected upstream after canonical scope/key/peer/current-state checks. It creates the independent watcher before body/upstream tasks, preserves the supplied absolute monotonic deadline, and validates typed finite non-widening limits. Peer renewal checks exact private IP, full run/attempt/task/fence/policy binding, grant, non-regressing observation time and freshness. A typed lease supplied by a trusted callback is an interface, not measured ECS/socket provenance.

The request pump bounds aggregate bytes/events and its channel; response start/body order and aggregate event/byte bounds are checked. Local failure responses are fixed and content-free; a response already started is not replaced by an invented successful terminal event. Awaited sends can be canceled by the separate authorization watcher. Synchronous trusted callbacks/CPU work can still block the event loop.

Cleanup publishes sticky denial before cancellation, uses finite `asyncio.wait`, keeps unresolved state-thread tasks uncanceled and retains strong references in `PendingWork`. Unresolved work denies readiness/new local admission even after eventual completion. These are cooperative local controls, not thread/process/remote-stop guarantees. The original PostgreSQL grant/run/fence and UNKNOWN ledger remain canonical; no key issuer, second budget store, settlement or refund path was added.

The transport change is additive: an optional trusted synchronous `lifetime_check` is checked before/after CountTokens, before/after UNKNOWN reservation and before returning from the final request hook. Existing exact native-body/count binding, one-hook retry denial and deadline checks remain. Its default is still `None`; actual deployment must explicitly connect the private ASGI context to the real LiteLLM callback/client. The assembled source control demonstrates an injected real guard, not actual native app/lifespan/callback configuration.

## Actual independent checks and retained failures

The selected canonical44 suite was executed **once**, after full source reading and the runtime preflight. It attempted all44 tests:39 passed and five raised timing errors. The suite reports68.774s; the direct child ran20:17:20.312672–20:18:53.295894Z,92.985s, exit1 within120s. Failed labels are:

- `test_original_deadline_not_reset_by_observer_renewal`;
- `test_blocked_send_revokes_without_downstream_resume`;
- `test_body_bound_and_malformed_event_deny`;
- `test_observer_mismatch_revokes_during_blocked_body`;
- `test_single_receive_owner_and_bounded_queue`.

The retained stderr includes slow-task/scheduling diagnostics and tight40ms/300ms fixture deadlines. The reviewer added physical network auditing with stack/path checks, which can itself impose overhead. These five outcomes are neither erased nor attributed conclusively to source, host load or instrumentation. No unchanged suite replay or fixture weakening occurred. The author's distinct final44 PASS/5.089s suite and all earlier interrupted/failed captures remain unchanged; that PASS does not replace this review's outcomes.

The six independently fixed controls ran **once**,20:18:53.341060–20:18:54.653915Z,1.313s, exit1: three expected-denial failures (observer/state/receive cancellation) and three passing controls (ordinary observer error, explicit disconnect-visibility limitation, and revocation despite a full body channel). All fake request tasks were canceled/observed in `finally`; no production lifecycle entrypoint/server was launched.

Each child used fixed `-I -B` argv, a credential-free replacement environment, binary streams, `shell=False`,120s direct-child timeout and a post-completion2MiB stream cap. Application physical connect/bind/DNS/sendto was denied. Only CPython's exact Windows socketpair machinery was allowed. The canonical import's exact pinned urllib3 `_has_ipv6('::1')` bind was physically denied, caught upstream and recorded separately; no unexpected network audit event was recorded. This is not a claim that no library attempted a network primitive. The independent child has zero stderr. No provider, AWS, database, actual HTTP listener, Docker, package installation or Hermes invocation occurred.

Raw check evidence is under `.task-inputs/server-review-1/`. Canonical stdout2539B SHA256 `5c5f388fa0d1aa38972a349a929bdc506d24bed22bed08d56250b9c88f1d9dce`; stderr46724B SHA256 `2d255ca61e069636b44b47f5d6554fe3ee7da87c6fc8fb45caa0e44b8a08fa45`. Independent stdout2127B SHA256 `e4d412c77d8d2718f71297c38862fbf9392b908dbec9954ce5c7c88d5b1edbd9`; stderr0B SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

## Source and evidence identities

| Candidate path | Bytes | SHA256 |
| --- | ---: | --- |
| runtime/lifetime.py |5930|`7077b7835ae1e12c0bec803a17295b2deb2dcff1a0d9dd77549b3dcfec260243`|
| runtime/server.py |7679|`8571185768a97f4491c39d1ede2afbb312b811e8ea117e6c22366500a11c6aa1`|
| runtime/bedrock_transport.py |7595|`0a07f8c47d88aaacaebb6016a81e57af2a926f20b29085798224b07c7aa01884`|
| test/test_lifetime.py |6399|`df252c7d6602f5c4304120cdd4205b614733cb9c1dfa89cbccce965653a3e822`|
| test/test_server.py |10494|`547b1c7adf68647249a4b35d22d857dce1007883a6b107f2bc5412e22d95299a`|
| test/test_bedrock_transport.py |29476|`25409107f3077a8500340e11b79e24b6f8813396d6cc5eb3e246c5c87c1ceae3`|
| author report |10849|`9b676e9ca1ad3505d37ff05c322460930986b6c643816a61fc1355785e257326`|

Runtime/test paths above are under `apps/proxy/qualification/`; the author report is `docs/coordination/reports/CODEX-G1-PROXY-SERVER.md`. Fourteen bounded read-only Git captures independently establish seven-file scope, exact candidate blobs and six unchanged canonical blobs. The author manifest28268B SHA256 `f86d1c92644550427504d3e7336b710b566176aaaa2e3eefc9af6e02bebe6e32` remeasured all75 payloads plus seven owned/six protected records. Author commit readback3601B SHA256 `1077bd23fc06f5a7f375f80fc572044dcb3ea1c4158527621a4c655d615531f6` remains retained. Local filesystem/Git observations assume the trusted checkout; they are not hostile filesystem attestations.

The supervisor measured the13 selected source files and six helper/runtime inputs before/after: all19 rows match. Both10,658-record runtime snapshots exactly match each other and the original transport record. The two historical tokenizer/NumPy pycache RECORD exceptions remain explicit. This is a measured installed environment, not a pristine wheel, complete Python execution closure or Linux/server image. Final source/runtime stability and the finite evidence seal are recorded in the companion ignored manifest; supervisor exit0 means capture completion, while both test children exited1. A first DATA-only traceback extractor failed before output because its literal newline regex did not match CRLF stderr. Its failure is retained; the new version uses explicit line projection, preserves full raw stderr and performs no test/candidate replay.

The root integration owner retains acceptance. Real native virtual-key/lifespan/callback assembly, direct TLS/current ECS peer mapping, actual CountTokens/inference IAM, <=30s loaded-server revocation, PostgreSQL concurrency/recovery, aggregate budget, usage reconciliation and physical termination remain OPEN. Current Meri is untouched.
