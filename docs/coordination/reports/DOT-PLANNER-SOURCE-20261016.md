# Planner receipt/client source packet — source review pending, runtime HOLD

Source commit `b8b75414340fc6e0367f50dbefdb01c3830f823b`, tree `241bb5eaa6376e1071770f0ede46feaa1529aefb`, direct parent `cf639d4707df0060524218c65d941834ed7ea2e3`; isolated branch `dot/live-planner-successor-20261016`. Review only the nine added paths in this commit; do not merge its whole author branch into the joint integration candidate. Model/intent/startup accepted source is preserved. Separate model terminal-fence successor remains `af5804e507ad27a07b9375b52d91b5b7b0b4d0a4`, tree `2ab30de1cb2ede36981055b5f8d1596a5816dbf4`.

## Delivered and owned paths

- `apps/control/objective-planner/identity.mjs`: closed canonical token/selection/work, deterministic original intent+actor request/workflow IDs. A changed generation job/version under that identity changes the work digest and must conflict, rather than reminting an effect ID. Canonical IDs are reservations, not output proof.
- `core-receipts.mjs` in that directory: correlate the existing Core622 ObjectiveReceipt requested revision/context/result; decode the actual current MaterializationResult including human edits, partial/unavailable outputs and linked context. These are data checks, not an authenticator or immutable Planner creation ACK.
- `materializer.mjs`: compatibility client for the existing browser-guarded relative POST/GET routes, over a borrowed trusted transport; own bounded deadline/abort lifetime, no credentials/ambient connections/retry/runtime mounting. POST uncertainty stays UNKNOWN. Current GET returns an observation only; 404/SOURCE_STALE is not absence proof.
- Three synthetic fixture/test files, candidate `dependency-seams.mjs`/`run-controls.ps1`, and `docs/coordination/proposals/DOT-PLANNER-CONTINUATION-20261016.md`.

Core source references: `neo-capiro/capiro-backend` sealed622 `622905839c7a510ab01a512ef8012926b2e1b4ce`, tree90503a35520425ccd20fdccd44380940fd826d0f. Actual ObjectiveReceipt and materialization source/type declarations were fetched read-only. Core's accepted findings-context nine-file tree005806a89c89d039aacd32a6bcbd54ba20c2ca6c (local5afc / published97286c on draftPR31) introduces no workload receiving authority. No Core implementation was imported.

## Exact evidence and limits

Evidence directory: `docs/qualification/candidates/dot-planner-20261016/`. Each metadata JSON records actual argv, file SHA256s, current source parent, memory probe, sampled process working set, wall bound, exit and cleanup.

| Evidence | Exit | Result | Sampled peak working set |
| --- | --- | --- | --- |
| `controls.*` | 1 | 26 passed, 9 failed in fixture setup: mutation attempted against frozen expectedSource data | 49,373,184 bytes |
| `after-fixture-copy.*` | 0 | 35/35 after cloning the fixture; no assertion removed | 49,500,160 bytes |
| `final-work-boundary.*` | 0 | 35/35 after validating work before decoder field access | 48,893,952 bytes |

Latest exact Node argv is in `final-work-boundary.json`; rerun with `./docs/qualification/candidates/dot-planner-20261016/run-controls.ps1 -Name unused-evidence-name`. Runner refuses proof overwrite. One Node process, V8 heap128MiB, hard wall30s, working-set cap256MiB, isolationnone/concurrency1, zero services/ports. Final elapsed147ms; host probe12,030,021,632 free physical bytes. All owned processes exited and owned timers were closed. Hanging borrowed promises are not proof of physical upstream stop.

All35 are **synthetic source controls**. Hash-only dependency stub replaces unavailable canonicalize/Ajv import; native inert JSON boundaries, real decoders/client/lifetime code execute. Fixed synthetic Core receipts and scripted transport do not establish Core auth, SQL durability, immutable stored custody, Temporal crash/replay, browser close/reopen, real provider or runtime qualification. Those stages are UNRUN. `git diff --check` passed. No compiler/browser/install/DB/daemon/provider process ran.

Historical manifests, h proof rows, frozen contracts, held0012 and all existing SQL/source paths are unchanged. No new proof-row closure is claimed.

## Exact pending actions, owners and reason

**PENDING, not denied or attempted:** compose server-owned automatic continuation and its authenticated Core receiving path. Core receiving owner `01a13d85-a042-7236-b84f-a797c4cd3030` is preparing Git-bound `objective.plan.prepare` request/ACK/read and association-persistence proposal. Need a named allocated workload issuer/audience/current actor-delegation verifier (or an actual retained current-user authorization owner), immutable original intent/expiry/action/source/request binding, and stored creation ACK lookup independent of eligibility for another effect. Existing live Clerk identity/context digest receipts and generic InternalServiceGuard secret do not provide this delegation. Current public materialization GET is mutable and may become SOURCE_STALE after an earlier commit. Missing receipt cannot authorize redispatch. No fake receiver/Temporal adapter around browser routes was authored.

Core direction: explicit automatic defaultgroup uses reserved canonicalProjectId as its actual row ID via a shared creation/receipt-check resolver; arbitrary/manual groups keep actual IDs. This mapping, immutable association receipt and persistence are not implemented/accepted by this Meri packet. Meri never picks a first output project or aliases output IDs. Reuse actual deterministic materializer after proven Strategy application; no second Planner model loop.

**PENDING exact configured duration binding:** this source has no action-consent policy/registry accessor for `objective.strategy.draft` or `objective.plan.prepare`. `command-preparer.mjs` supports only create_task/task.create; existing command approval metadata consumes injected preparePolicy.proposalExpiresAt. Neither provides these Objective action durations. Core was told to request the canonical configured policy ID/revision/milliseconds or explicit allocation. No24h default, budget TTL, availability duration or Temporal token lifetime substitution. This absence claim is scoped to exactb8 source; later jointf54 source was not locally scanned.

No Meri migration is requested: held0012 remains unused/unauthored. No credential generation, real SQL, provider, cloud or expanded public/frozen wire authority was inferred. Parent/qualification owns acceptance and integration; source review remains pending.
