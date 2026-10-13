# Action recommendation lookup: source acceptance

Outcome: **ACCEPT_SOURCE; runtime HOLD.** This continuation of draft PR38 implements one complete source path for showing action recommendations for an already selected, authorized client. The actual HTTP adapter, canonical current-authority gateway, owned invocation/budget accounting, PostgreSQL lookup store, existing public UI events, fresh-authorized result read and offline evaluator are composed in local tests. Their HTTP and SQL ports are inert. No live source, database durability, native execution, model quality or release acceptance is claimed.

Base: `77cedb126d57a0223d2df42ad2f3fe988eb51759`; integrated source freeze: `a82543fcff94e4ed31c27185408e3e6f0ae3ece6`. Branch: `task/meri-task-slice-20261012`. Original branches, raw failures and negative controls are preserved. Main remains `8b123bea4c90794dc2d766814b6ddbdbfe0928bc`.

## Implementation and independent review

| Responsibility | Source freeze | Independent review |
| --- | --- | --- |
| Canonical action dispatch profile and normalized policy context | `84a9313735ec9fb079e35a92adb074f6afaf32e7` | `87b9f20328631e63fe8d8b1a24f5750680a7f671` |
| Fixed-route action HTTP adapter, request correlation and projection | `eaa00fd0ea8ec98bc77b050caaa6526a2738405e` | `87b9f20328631e63fe8d8b1a24f5750680a7f671` |
| Control delivery, immutable result journal and current-authorized reads | `6f14d780a40e878fa62bc928c4d520286313f56c` | `1b02c38f88e904d8cfd55b475fba32b2d6e8ddcb` |
| Approved-input corpus integrity and actual-observation scoring | `a57f5cf0e2345975ec11a3c2f43157c6e6769a73` | `5a4473b0ccda92b89d419c86ffbce45f0b0c5b2b` |

The source adapter lives in `apps/gateway/sources/action-items/`; existing dispatch owners consume its canonical governed envelope. The new context module performs syntactic normalization, while existing current policy supplies authority. Selected client names and unscoped requests remain unavailable in this slice. Source freshness, snapshot, coverage and negative-assertion limits remain explicit.

`apps/control/task-lookup/index.mjs` exposes the supported delivery/store composition. Durable claim and dispatch markers must acknowledge before execution. Ambiguous acknowledgements never trigger automatic redispatch; a committed result cannot be replaced by an error. Result reads recheck current authority and preserve original provenance. Migration0001 is source only and was not applied. Borrowed pool ownership and finite timeout requirements are documented.

`evals/task-lookup/cli.mjs --help` documents bounded offline ingestion and scoring. It consumes captured results and actual current-read callback records. Missing, denied, unknown, failed and ineligible cases stay visible. Synthetic reference captures test interface behavior; they are not independently adjudicated quality gold or real-request evidence. Qualified real requests remain zero. Clarification remains explicitly ineligible for this selected-client observation contract, with the broader requirement pending.

## Validation and preserved failures

- Consolidated run at `565c01b10d3a26ec499ac810bb56fb3f6fdf8f84`: **691/694 passed**, three expectation failures, zero skipped/cancelled. Two new evaluation fixtures omitted the canonical descriptor's full source set; one existing profile expectation omitted the reviewed action profile.
- Repair `9377ffed70b5cae6f8d1a485855929dae61347b9` changed only those expectations. The separate reference capture supplies full source metadata before the observed run; strict source/semantic checks remain. The old helper gains one literal profile row, with every previous expectation retained. **57/57 affected tests passed**; this was a targeted rerun, not another 694-case run.
- Independent integrated controls: **17/17 passed**, including actual accounting/SQL effects, current read denial, raw client injection, grant reduction, replay rejection, recovered task-B access, retained corruption, cancellation and lost acknowledgement at each durable boundary. Unknown results and label-only denials cannot pass evaluation. Their commits are `5b596b72d04219bdafed2ceabe5a256050a2997a` and `3ea5d8736c4c7f39f4f076494f003cc69232e5e1`.
- Earlier focused checks: dispatch/authority **90/90**, action contracts **82/82**, actual connected lookup **6/6**. Separate author/reviewer checks include action **64/64**, final control independent **49/49**, and evaluator **111/111**. These overlap; they are not summed into a unique-case total.
- Exact-source audit retains **9,667/9,667** base entries, **9,663 unchanged**. Changes to original paths are three reviewed production files and one explicit test-helper insertion. All original test modules remain unchanged. All **17** production files match reviewed pins. Worker, proxy, runtime, native fixture, public contracts and requirement ledger are unchanged.

Raw streams, bounded capture commands, source identities, initial failures, repair patch and process-group absence receipts are under `docs/qualification/candidates/task-slice-20261012/`. No observed source-test failure remains unresolved. Local checks do not establish real PostgreSQL crash/concurrency behavior, current production policy, live credentials, native isolation or actual model outcomes.

## Handoff and remaining gates

The separate frontend owner can consume existing public0.1 `tool.started`, `tool.completed` and sanitized `run.error` observations, together with immutable result references and current-authorized reads. These are recommendations, not accepted tasks, run completion or delivered work. Trusted server context must supply the selected UUID, original binding and globally reserved event slots; an application-owned current-policy adapter must authorize execution and reads. No frontend or alternate SSE implementation was added.

The full canonical scope remains **139 originals: 96 selected, 43 deferred**. All **97** current production operation descriptors retain null handlers, pending qualification, unavailable state and zero retries. Of 53 governing requirements, two source-discovery requirements are complete and 51 whole requirements remain pending; zero are runtime-qualified. Claude Agent SDK, Temporal, AI SDK/Elements and governed-proxy responsibilities remain as adopted. No legacy implementation or private policy bodies were imported.

Native probe tree `8944e41425d73d517fb84b3632465792ffd9716b` is unchanged. The separate native owner can compose its minimal advertisement overlay without a full backend merge or another backend signoff. Its latest checked remote handoff branch still pointed to PR38, so readable overlay bytes remain the concrete composition input; no native evidence is inferred from reported tests or an unavailable archive.

Runtime gates remain: qualified current task identity/auth/expiry/revocation and source credentials; durable PostgreSQL/budget/Temporal recovery; trusted event-slot/current-reader producers; reviewed runner and patched supported image; native task-A/B checkpoint recovery and stale rejection; sandboxed browser/renderer, egress/watchdog/teardown and artifact inspection. The prohibited vulnerable image was never launched. Existing Aurora remains selected and untouched. Approved real-request/source-snapshot corpus and actual measurements remain missing. Paid-model allowance is unreconciled; security/infrastructure approvals are not established. The private host-policy404 blocks affected host/Hermes operations only. No paid calls, provider messages, deployment, resource creation, credentials, customer data access or cloud/database/security changes occurred.
