# First-chat acceptance: exact PR39 host and staged PR81

This runbook is ready for the shipping/runtime owner after approved deployment/configuration and explicit permission for the original prompt budget. **No live acceptance, deployment or provider call has been executed here.** Keep init-owned zombie helpers untouched; no privilege escalation or unrelated cleanup.

## Exact pins and necessary configuration

| Subject | Pin or required owner input |
| --- | --- |
| Frontend | PR39 `348c98dfe1962fac962157eb785732281a282d06`, public SDK0.1.3/wire0.1.0. |
| Staged runtime | PR81 publication `480944bae488932ab5dea5452d2d3dbdcb04a755`, tested code `fbb25c374c835e907c500da27c555ca628368a41`. **Do not stage PR82.** Only a required measured defect justifies a source change through its owners. |
| Serving images | Actual frontend/Core/runtime source and immutable image references; measured runtime runner/executable/entrypoint/init and non-root task proof. Source hashes alone are not image proof. |
| Host/auth | Existing designated Clerk application/token template and Core base including `/api`; pathless HTTPS `MERI_API_BASE_URL`; approved literal `MERI_CONVERSATION_WORKFLOW_ENABLED=true` and ordinary serving mode. Existing preview containment requires release-owner activation. No new auth layer/key; Strategy/Workspace activation is unnecessary for plain chat. |
| Current backend authority | PR17 `dd02f3ba0b4ab77e3725e83e4b9af27aecdc8eca` authority extraction or an explicitly qualified equivalent; existing native user.id/tenant/session, active owned conversation/client mapping, current wall/membership and expiry. Fixed context and identity credential reference must agree. An arbitrary UUID is not the mapping. |
| Dedicated runtime | Private PostgreSQL/schema/current budget and immutable original allocation/grant/fence pack; Temporal persistence/endpoint/namespace/queue/TLS; control/poller/fresh one-conversation task; private HTTPS/bootstrap/control callbacks and exact resource/role/task-definition/network bindings. |
| Provider/budget | Approved dedicated proxy/model/credential reference and explicit one-prompt original turn/cost/output/deadline limits. One SDK Query, no selected skill/tools/source reads/artifacts. Pilot availability does not extend worker lease. |
| Mandatory candidate settings | PR81's existing object bucket/prefix/KMS settings remain required by its configuration. This run does not add checkpoint publication/restore or request wider object permissions. |

Use [PR81's deployment/configuration/startup handoff](../reports/CODEX-PREPARED-CANDIDATE-DEPLOYMENT-20261014.md). [The exact authority-input report](https://github.com/neo-capiro/meri-greenfield/blob/5a87ffd7f0a5441919c1b4a869295824f1a32d08/docs/coordination/reports/CODEX-CURRENT-CONVERSATION-AUTHORITY-INPUTS-20261014.md) supplies backend identity/context and separately owned Meri grant/resource inputs; reading it does not stage PR82. First chat requires **no continuation/approval owner, target recipe or independent decision issuer**.

## Canonical bootstrap gate: existing mapping before Connect

The backend owner is identifying the **existing mapping owner**. Before live execution, obtain that owner's current authoritative read/reference for an active, unarchived conversation whose exact `{id,tenantId,userId,clientId}` matches the verified native actor and permitted client. `userId` must be the current native `user.id`, not a Clerk subject. Record the mapping ID/reference and current-check receipt without credentials. Missing or mismatched mapping means first chat is **NOT READY**; an arbitrary newly generated conversation UUID is insufficient.

Bind that exact mapping id to `nativeCandidate.identity.commandContext.binding.conversationId`, with its tenantId/native actorId and selected client resolution. The approved original runtime binding, allocation run identity and action session context must match those same identities; scopes/policy/grants remain the existing Meri/control owner's inputs. Verify using the canonical candidate validator plus actual backend identity/context receipts, not a fixture or echoed selector. The frontend's first selection sends only `{clientId}`; it does not create conversationId/runId, an authorization record or a task grant. The existing server context selects the approved prebound run. Subsequent observed conversation/run hints constrain that same binding and must refuse mismatches.

Use the backend's existing owned-conversation/domain authorization lookup and current client-wall/session checks. Do not invent a new authority store/API, copy backend implementation, seed a replacement row or relax owner/current-actor checks. The exact mapping owner/reference is still a necessary input until the backend owner supplies it; this runbook does not claim it has been verified live.

First submit persists the source's canonical queued run **before** Temporal kickoff/allocation. The later resume/fork path's admission-before-target-row versus allocation-needs-queued-row issue is separate deferred work. It is not a reason to precreate a fake first-chat target, add continuation authority or bypass this existing mapping gate.

## Executable offline source check

Run from the staged PR81 source checkout. It uses no dependencies, credentials or network:

```bash
python - <<'PY'
import hashlib, json, pathlib, subprocess
root = pathlib.Path.cwd()
runtime = '480944bae488932ab5dea5452d2d3dbdcb04a755'
assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip() == runtime
assert subprocess.check_output(['git', 'status', '--porcelain', '--', 'apps', 'packages', 'scripts', 'package.json', 'package-lock.json'], text=True) == ''
p = root / 'docs/qualification/candidates/native-prepared-kickoff-20261014/SOURCE-MANIFEST.json'
assert hashlib.sha256(p.read_bytes()).hexdigest() == '8b4d6bd5cf9cfcd5c10bef89b134841b270b74a7d0153391a7736c9ce26b1fd2'
m = json.loads(p.read_text())
assert m['sourceHead'] == 'fbb25c374c835e907c500da27c555ca628368a41'
for f in m['files']:
    assert hashlib.sha256((root / f['path']).read_bytes()).hexdigest() == f['sha256'], f['path']
print('PR81 source and 39 pinned files match; live acceptance NOT RUN')
PY
```

Use the existing control/temporal-worker/conversation-runner CLI commands with owner-supplied files. Do not substitute the synthetic example IDs/secrets. Private readiness is checked by the trusted owner, not a browser capability.

## Primary live path: one completed prompt

Run ordinary PR39 `/meri`, not a fixture page/private runner endpoint. Record nonsecret requestId/context/status/cursor/timestamp and receipt references. Never export bearer values, cookies, credential files or unredacted HAR. The fixed harmless prompt below avoids private business content.

1. **Authenticate/connect.** Log in normally; select the permitted client through existing Core/Portfolio controls. Verify native account/client and click **Connect conversation service** once. Browser POST `/api/action-followthrough/session` uses same-origin auth and initially `{clientId}` hints; the trusted proxy supplies upstream identity-bearing issuance. Expect HTTP200 `{credential,expiresAtMs,context:{tenantId,actorId,conversationId,runId,selectedClientId}}`. Keep credential inside the existing SDK. Context must equal the approved original/account/client; later connects constrain the observed conversation/run. **Connected session; transcript not loaded** is not chat acceptance.
2. **Submit once.** Enter `Reply with exactly MERI_FIRST_CHAT_OK. Do not use tools or access sources.` Click **Send message** once. UI retains one requestId and exact input. Native POST `/api/conversations/submit` body is `{requestId,prompt}`, with no skill/window/attachments. Expect HTTP200 `{run,requestId,lastSequence,replayed:false}`, exact approved binding and actual state. The request is durable before Temporal start; workflow ID is `meri:<tenantId>:<conversationId>:<runId>`. Queued acceptance is not a model result.
3. **Stream the real answer before loading history.** Immediately after the accepted submit, click **Observe current run**: the SDK's submitted view has an admitted cursor0, so it can stream all actual durable events including assistant deltas even if the short prompt already completed. Do not load history first: that can advance the cursor past every text delta and leave an empty terminal reconnect. **Observe current run** is enabled only at cursor0; do not force it after history advances. If history was already loaded, **Reconnect observed events** can observe only future suffix events; without an actual assistant delta, record streaming NOT EXERCISED and do not send another prompt. Reconnect is GET `/api/conversations/events/{conversationId}/stream` with SDK-owned `x-meri-resume-sequence`; initial subscribe is POST `/api/conversations/events` with its closed `view.subscribe` command. Admit `data-meri-event` eventId/binding/sequence/type and contiguous progression. `message.delta` provides assistant text; normal statuses are queued→starting→running→completed, though a page may already show the latest state. Require actual answer and real SDK/proxy/model receipts under budget. HTTP200, SSE start/finish or stream outcome alone cannot pass.
4. **Persisted history/reconnect.** At a known cursor, leave or stop observation. This cancels the subscription only, not the durable run; never resubmit. Reopen under the same account/client, reconnect the observed context and load/paginate history. Compare same requestId/binding and admitted event IDs/sequences/bytes, final text and persisted completed status; no duplicate prefix/missing suffix. Reconnect again after the SDK's acknowledged sequence. Server subscriptions are bounded to30seconds; their end may require explicit reconnect and is not durable completion. Trusted readback of existing PostgreSQL run/request/events proves persistence beyond browser memory. Restarting control is outside this process-local-session single-replica pilot check.
5. **Terminal cancel semantics.** After canonical completed history and when no awaited stream keeps the UI busy, click **Cancel current run**. POST `/api/conversations/cancel` body is `{}`. If upstream Temporal acknowledges, expect `{state:'completed'}` with unchanged history/result and no new run/prompt/query. PR81 calls Temporal cancel even for terminal state: if the live service refuses it, record the actual failure and leave this check unaccepted. Repeating successful cancel must preserve state/transcript. This does **not** prove active cancellation.
6. **Original cleanup/budget.** Trusted owner joins actual ARN/image/runner, canonical ADMITTED/STARTED allocation, SDK registration/mirror, workflow and one Query/model execution to the same binding. Require final original control-stop ACK, genuine native/supervisor exit, actual task retirement/authority state, callback/listener cleanup and bounded cost/usage readback. Terminal UI state or task-capability stop alone is insufficient. Unknown cleanup leaves acceptance incomplete. Browser credentials cannot issue private cleanup; unrelated/init-owned resources stay untouched.

## Retry and active-cancel branches

**Unknown submit:** if a genuinely failed/lost ACK produces **Retry same request**, recheck same-context history and owner state first. Retain exact requestId/prompt/optional bytes. `retrySubmit()` requires retained unknown state; never create a new UUID, edit input, clear retained journal or switch context. An explicit approved identical retry may recover the original queued Temporal start and execute that same authorized workload; do not label it zero-provider-effect without receipts. Verify original workflow/resource/Query deduplication and budget. Normal observed input has no Retry button; do not fabricate unknown state. If no delivery uncertainty occurs, record live unknown-submit retry **NOT EXERCISED**, with fixture semantics separately referenced. Optional terminal exact-byte replay through the existing public SDK/transport owner must return replayed:true and unchanged request/binding/history/task/query/provider counters; that supplementary protocol check is not another PR39-host end-to-end receipt.

**Active cancellation alternative:** choose before execution **instead of** the completed-result path, under the approved one-prompt budget. Submit once; use short explicit history checks until actual running/provider execution is observed, then **Cancel current run** while no long observation action keeps UI busy. The view disables cancel during an awaited stream operation; do not bypass/change the host. Expect successful `{state:'cancelled'}`, durable cancelled history, refusal of late publication and genuine original task/authority/budget cleanup. If completion wins, record actual state and active cancel **NOT EXERCISED**; never send another prompt to chase the race. If the cancel ACK is genuinely uncertain, **Retry cancellation** repeats `{}` for this same run and must not replace the task or launch another Query. One run cannot prove both natural completed-result and active-cancel acceptance. Qualifying both needs separately approved fresh originals/budgets in later runs, not added continuation/approval infrastructure.

## Failure diagnostics

| Observation | Bounded diagnostic/check |
| --- | --- |
| Host unavailable | Exact PR39 source, flag/preview containment, existing Clerk/Core config and permitted account/client; no guard/claim changes. |
| Connect401/403/unavailable | Frontend proxy and native current identity; backend source/origin, native user.id, owned active conversation/client, wall/revocation/expiry. Compare nonsecret principal/revision/context/status. |
| Submit502/408 | Delivery may be unknown: exact requestId/input hash, durable SQL accept, Temporal workflow/history, finite native kickoff. Do not infer NOT_DISPATCHED/new run. |
| Accepted but queued | Poller queue/namespace/TLS/current worker and workflow/activity history; actual allocation/admission/bootstrap/private readiness. Queued is not model acceptance. |
| Stuck/refused preparing | Grant/fence/policy/original lease, actual ARN/definition/image/runner, fresh backend context, private task/control callbacks and canonical launch latch. No fixture facts/lease extension. |
| Proxy/provider failure | Approved model/proxy/grant/budget and safe status/error/usage/correlation; retain failure and stop original. No paid retry outside budget. |
| Stream without answer or reconnect gap/403 | Canonical history/status/mirror/provider receipts, fresh opaque context/expiry, eventIds/sequences, selector/content type and branded SDK cursor. No manual Last-Event-ID/query cursor or sample transcript. |
| Cancel502/408 or ACK without stop | Durable state, Temporal ACK/error, activity independent cleanup and original control-stop/physical-task proof. Terminal refusal and active cleanup uncertainty remain distinct. |
| Any budget/cleanup uncertainty | Acceptance incomplete; preserve evidence and contain original via its approved owner. No unrelated cleanup or init-zombie reaping. |

## Receipt and pass boundary

Keep exact source/image/configuration references; COMPLETED or ACTIVE_CANCEL scenario; approval/original-budget reference; nonsecret account/client/binding/requestId/workflowId/actual ARN/timestamps; issuance context/expiry sans credential; submit/cancel statuses and receipt hashes; event IDs/sequences/final state/text hash; persisted SQL reference; real SDK session/Query/proxy/provider usage/cost and physical/task cleanup receipts. Existing SDK/contracts remain the wire validators; this runbook creates no protocol schema or authority.

A completed first-chat PASS requires ordinary authenticated PR39 host→PR81 durable submit→one real SDK/native/provider execution→actual streamed answer→same-context persisted history/reconnect→proven original cleanup within budget. Report terminal cancel and genuine unknown retry separately. An active-cancel receipt does not pass completed-answer acceptance. All broader337, continuation/approval/full-plan rows remain open. Use LIVE only for actual observations; otherwise SOURCE/FIXTURE/UNRUN.

Reuse these existing artifacts; do not relabel them as live:

- [PR81 qualification](../../qualification/candidates/native-prepared-kickoff-20261014/FINAL-QUALIFICATION.json): author241/241, independent77/77; actual isolated PG/HTTP/supervised Node, scripted ECS/authority/SDK and zero provider/model turns. [Frozen command](../../qualification/candidates/native-prepared-kickoff-20261014/author/FROZEN-CHECK-COMMAND.json) and [review](../../qualification/candidates/native-prepared-kickoff-20261014/independent/FINAL-REVIEW.md) retain exact source/failures.
- `apps/control/conversations/test/application.test.mjs`: existing lost-ACK replay/revocation/cancel/reconnect over fixtures. Staged `apps/runtime/test/{prepared-candidate,prepared-temporal,remote-conversation-runner}.test.mjs`: public mount/finite kickoff/listener cleanup. Never point PG fixture files at shared/production databases.
- [PR82 first-chat regression evidence](https://github.com/neo-capiro/meri-greenfield/blob/5a87ffd7f0a5441919c1b4a869295824f1a32d08/docs/qualification/candidates/native-conversation-continuation-20261014/author/FIRST-CHAT-QUALIFICATION.json): supplementary binding/replay/hints/revocation source proof, not staged code/live acceptance.
- Exact PR39 [view](https://github.com/neo-capiro/capiro-frontend/blob/348c98dfe1962fac962157eb785732281a282d06/apps/web/src/features/meri/conversation/MeriConversationView.tsx), [actions](https://github.com/neo-capiro/capiro-frontend/blob/348c98dfe1962fac962157eb785732281a282d06/apps/web/src/features/meri/conversation/useConversationActions.ts), [bootstrap](https://github.com/neo-capiro/capiro-frontend/blob/348c98dfe1962fac962157eb785732281a282d06/apps/web/src/shared/meri-actions/session-bootstrap.ts) and receiving handoff preserve original labels/auth/lifetime; all337 native rows remain open.
