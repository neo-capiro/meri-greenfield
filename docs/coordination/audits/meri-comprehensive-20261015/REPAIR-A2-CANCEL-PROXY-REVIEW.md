# Bounded independent review: A2 cancellation and proxy route

Reviewed 2026-10-15, against branch `fable/a2-cancel-proxy-route-20261015` at **0d88e209dc811fc417b7bdec4327174a6582f876**. The branch resolved to this exact SHA during review. GitHub compare reports three commits ahead of **e046be844fbc4e56a8111dbfa28c330169e4536e**, zero behind, and twelve changed files. Fable retains implementation ownership.

## Verdict

- **L5 unsupported/default broker-mode repair: source ACCEPT.** Official worker configuration now refuses the unsupported mode, and the registered activity has no legacy dispatch branch. The named cancellation/timeout ownership paths use the existing prepared original-stop owner.
- **SEC-REL-01 exact pinned inference-route repair: source ACCEPT.** The retained ingress admits exactly HTTPS POST with path/raw-path `/v1/messages` and raw query bytes `beta=true`; other spellings, values, routes and query forms remain refused.
- **Runtime/live/release acceptance: PENDING / HOLD.** No real CLI → retained proxy → provider flow, real Temporal cancellation delivery, ECS process termination, durable grant revocation or migration execution was independently established. This review does not close the wider audit.
- **Narrow inherited cleanup caveat:** the broad statement that every refused launch receipt closes the original is stronger than the current broker boundary guarantees. A wrong-ID kickoff receipt injected after dispatch redirects cleanup to that rejected ID. Current trusted prepared-owner source cannot emit that receipt. This is a separately reported inherited invariant-violation/hardening gap, not a demonstrated reachable deployed defect and not a blocker to accepting removal of the original unsupported/default path.

No implementation, repository, deployment, cloud configuration, user-computer, credential, database or provider changes were made. Review files and synthetic probes were created only in the isolated review workspace.

## 1. L5: what is accepted

The baseline audit explicitly allowed either startup refusal of the unsupported mode plus an in-flight plan, or a new original-bound cleanup path. It distinguished the broken legacy/default branch from existing prepared cleanup: [baseline L5](https://github.com/neo-capiro/meri-greenfield/blob/82a015083f1965851ffddbc05d4f181bb90ecac2/docs/coordination/audits/meri-comprehensive-20261015/lifecycle-report.md#L104-L121).

### Startup and dispatch ownership

- [Configuration lines 27–30](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/apps/runtime/config.mjs#L27-L30) require `native.preparedKickoff === true` for `temporal-worker`, including when omitted. False, string `"true"`, numbers and null fail.
- [CLI lines 6–10](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/apps/runtime/cli.mjs#L6-L10) load/validate configuration before importing and starting the selected runtime. The accepted startup-refusal claim concerns this official executable path.
- [Broker lines 20–32](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/apps/runtime/temporal-worker.mjs#L20-L32) remove the `preparedKickoff` selector and dispatch only `execution/kickoff`. `workerOptions` registers that same activity. There is no fallback to `execution/start`.
- [Broker lines 23–29](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/apps/runtime/temporal-worker.mjs#L23-L29) memoize one cleanup promise, use a new independent 3000 ms lifetime, call `execution/kickoff/stop`, validate its receipt, and refuse successful completion if cleanup is unknown. Terminal preparation and execution results explicitly await cleanup; errors converge through the same cleanup.
- [Prepared owner lines 22–33](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/apps/runtime/native-authority/prepared-kickoff.mjs#L22-L33) retain native ownership: stop validates original binding/ID, invokes the owner's existing close, cancels startup, waits boundedly for allocation work, then invokes controller close. Late allocation handling remains with that owner. No second cleanup authority was introduced.

The three-second activity bound is a bound on awaiting a verified cleanup outcome, not a guarantee that ECS has terminated by then. The shared lifetime explicitly reports `physicalStopProven:false`: [operation lifetime lines 44–52](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/packages/runtime/operation-lifetime.mjs#L44-L52). The native owner has its own cleanup bounds and can leave physical cleanup UNKNOWN.

### Tests and migration scope

The added test covers default-construction cancellation and startup refusal: [broker cleanup test lines 24–40](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/apps/runtime/test/broker-cleanup.test.mjs#L24-L40). Its loopback composition uses real native-client/HTTP/owner code, but its controller close only flips synthetic `terminated`/`revoked` flags: [lines 43–68](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/apps/runtime/test/broker-cleanup.test.mjs#L43-L68). Assertions cover one stop, one owner close, zero legacy starts and the 3000 ms bound for after-launch cancellation, lost acknowledgment, blocked-poll cancellation and lease expiry: [lines 71–95](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/apps/runtime/test/broker-cleanup.test.mjs#L71-L95). These are meaningful source-composition tests; they are not physical-process or durable-revocation receipts.

The [written in-flight plan](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/docs/coordination/reports/FABLE-L5-CANCEL-PROXY-ROUTE-20261015.md#L24-L32) preserves old workers while draining, uses revoked admission/terminal polling for native retirement, and requires original-owner reconciliation when an old worker disappeared. It correctly says lease expiry is not stop proof. [Workflow line 5](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/apps/control/conversations/workflow.ts#L5-L9) retains maximumAttempts:1 and does not add automatic redispatch.

This is an acceptable documented source plan. No live task inventory, old-worker drain, physical retirement receipt or migration rehearsal was checked here. The report's “no legacy-mode product execution” statement is author-reported deployment context, not an independently observed cloud fact. In particular, ordinary Temporal cancellation of an old worker must not replace the proposed native retirement/reconciliation step.

## 2. SEC-REL-01: exact route contract

[Ingress lines 22–29](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/apps/proxy/qualification/runtime/ingress.py#L22-L29) pin the observed request. [Lines 68–107](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/apps/proxy/qualification/runtime/ingress.py#L68-L107) compare raw path and query using exact byte types/equality before peer/header checks and fresh grant admission. No decoding, normalization or general query parser broadens the allowed route.

The accepted tuple is:
- ASGI HTTP scope, HTTPS, POST
- decoded path exactly `/v1/messages`
- raw path exactly bytes `b"/v1/messages"`
- query exactly bytes `b"beta=true"`

Empty/missing query, alternate values/case, duplicate/extra parameters, separators, whitespace, encoded spellings, string/bytearray values, trailing slash, count_tokens and raw-path-with-query are denied. Existing peer binding, capability hash, forbidden authority headers and fresh-state/stream checks remain intact.

The positive/negative tests explicitly cover the observed shape and zero state reads for denied variants: [test_ingress lines 119–154](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/apps/proxy/qualification/test/test_ingress.py#L119-L154). The ASGI caller test checks denied route/header/key inputs before upstream/body access: [test_server lines 45–57](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/apps/proxy/qualification/test/test_server.py#L45-L57).

The [recorded CLI receipt](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/docs/qualification/candidates/fable-resume-20261015/rehearsal/standin-probes-20261015.json#L6-L13) establishes that CLI 2.1.295 emitted `GET /api/hello` followed by two inference POSTs with `?beta=true` in that earlier stand-in experiment. It does not establish real provider success or every CLI call shape. The hello probe remains outside this inference route. Non-beta SDK/CLI paths fail closed; compatibility across real streaming/cancel/next-turn behavior remains unrun.

## 3. Independent execution performed

Environment: Node v24.19.0; Python 3.12.14. Twenty-three downloaded source files were checked against their GitHub Git-blob SHA-1 values at the exact reviewed commit. No packages were installed.

### Unmodified Python modules

- 25/25 `test_ingress` tests passed, including the 21 query-negative subtests, missing query, strict path/raw-path variants, authorization boundaries, stream revocation and close behavior.
- 2/2 focused `test_server` cases passed: admitted upstream/body/private context; route/header/key refusals before body/upstream.
- Final combined run: **27 tests passed**.

These used the actual downloaded ingress, admission, grants, pricing, server and lifetime modules with their synthetic stores/upstream. No socket, TLS endpoint, provider, database or AWS request was made.

### Independent JavaScript control-flow probes

The exact broker, config and native-client function bodies were extracted without logic edits; module import/export scaffolding was removed to avoid unavailable package dependencies. The real downloaded `own`/`data` boundaries and operation-lifetime implementation were used. Schema validation, deterministic hash, Temporal context and transport were synthetic. Consequently these are control-flow probes, not a full module graph or upstream SDK test run.

Six configuration cases established omitted/false/string/number/null refusal and literal true acceptance. Fifteen broker cases exercised completion, terminal-before-poll, cancellation after poll, lost acknowledgment, blocked-poll cancellation, lease expiry, poll/heartbeat errors, malformed binding/shape/expiry/poll receipts, malformed stop receipt, hung stop and wrong kickoff ID.

Expected assertions held:
- no legacy start;
- one cleanup attempt per dispatched scenario;
- independent live cleanup signal;
- canonical stop target in the ordinary and lost-acknowledgment cases;
- malformed or hung stop never yielded successful completion;
- hung stop reached `BROKER_KICKOFF_CLEANUP_UNKNOWN` at approximately 3002 ms.

The wrong-ID case reproduced the inherited caveat below rather than satisfying the stronger “all rejected receipts clean original” claim.

The user/owner-reported **18 runtime / 25 ingress** rerun is distinct from these independent checks. I did not rerun the full runtime suites, owner loopback composition suites, real Temporal bundler, or the report's 205-test aggregate. The required `MERI_REVIEW_SOURCE_ROOT` setup and those outcomes remain owner-reported, not silently promoted to independent evidence.

## 4. Inherited cleanup target caveat, separated from L5 acceptance

[Broker line 24](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/apps/runtime/temporal-worker.mjs#L23-L24) assigns a structurally valid kickoff receipt to `started` before checking its execution ID. If the ID is wrong, it throws `BROKER_START_REFUSED`, but [line 23](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/apps/runtime/temporal-worker.mjs#L23-L24) chooses `started?.executionId ?? executionKey` for cleanup. The rejected ID can therefore replace the original key for the stop request.

Independent injection after a synthetic original reached STARTED produced:
- calls: kickoff → kickoff/stop;
- cleanup target did not equal the canonical original key;
- exact prepared-owner input/stop logic rejected the mismatched ID;
- owner close count before explicit test teardown: 0;
- activity result: `BROKER_KICKOFF_CLEANUP_UNKNOWN`;
- explicit canonical owner teardown then closed once.

This selection expression already existed in [base prepared-mode lines 15–17](https://github.com/neo-capiro/meri-greenfield/blob/e046be844fbc4e56a8111dbfa28c330169e4536e/apps/runtime/temporal-worker.mjs#L15-L17). It is not introduced by this lane.

**Reachability limit:** the current trusted owner validates `executionId === executionKey === hash(binding)` through [remoteOriginal lines 6–7](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/apps/runtime/native-authority/remote-task-boundary.mjs#L6-L7), retains that inert original, and builds/returns its own receipt: [prepared owner lines 23–24 and 43](https://github.com/neo-capiro/meri-greenfield/blob/0d88e209dc811fc417b7bdec4327174a6582f876/apps/runtime/native-authority/prepared-kickoff.mjs#L23-L43). No current trusted-source path that emits the wrong receipt was found. The probe deliberately violated that boundary through injected transport. There is no evidence here of a reachable production leak, authorization bypass or wrong-task stop.

Recommended bounded follow-up for Fable: retain the original execution key as unconditional cleanup authority; only store a validated start receipt; add the mismatched kickoff-ID regression. Until then, qualify the broad “every refused receipt closes original” wording. This does not undo source acceptance of startup refusal/removal of legacy mode or the proxy route repair.

## 5. Remaining acceptance gates

1. Approved real pinned CLI → actual retained proxy → provider flow, covering streaming termination, cancellation and next turn, with exact route/header evidence.
2. Real Temporal cancellation/heartbeat-timeout delivery and original ECS task/descendant termination plus durable grant-revocation receipts within the accepted operational bound.
3. Verified inventory/drain/reconciliation of any actual legacy-era in-flight work before rollout.
4. Broader release and other audit findings are outside this review; no new image/deployment or whole-product acceptance is implied.

## Local evidence

All evidence is under `/workspace/shared/a2-cancel-proxy-review/`:
- `source-manifest.json`, `source-verification.json`
- `proxy-final-test-stdout.txt`, `ingress-tests.txt`, `proxy-server-focused.txt`
- `runtime-probe.mjs`, `runtime-probe-results.json`, `runtime-probe-stdout.txt`
- `owner-wrong-receipt.mjs`, `owner-wrong-receipt-result.json`

This report: `/workspace/shared/review-a2-cancel-proxy.md`.

