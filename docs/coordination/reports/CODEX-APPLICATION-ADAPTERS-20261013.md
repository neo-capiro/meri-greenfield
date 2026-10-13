# Application authority adapters and mounted local flow

Implemented and independently **ACCEPT_SOURCE**: concrete Capiro authority HTTP client, server-bound context adapter and session/action application mount. Base is PR46 `ad0bdfeb830fee11f1f39c4a8a7037215595c4cf`; author source `1afbb5a53ebbf0eca9252b3b09ceb3e404918151`, author packet `949842404dccc2bbed61f21de985a5f42f8204a2`, independent review `3760a7fe8ba54639ef978f705ca05127838368d6`. Capiro owner-request packet is `88d964efa3d16718fd933fe418e9f69797b38784`.

The new [mounting README](../../../apps/control/action-host/application-adapters/README.md) contains exact constructors and an executable application composition. The [Capiro implementation request](CODEX-CAPIRO-APPLICATION-AUTHORITY-REQUEST-20261013.md) names the existing native owners, literal endpoint contracts and required owner tests. An early exact request was [posted for parent relay](https://github.com/neo-capiro/meri-greenfield/pull/46#issuecomment-6137886495) while implementation proceeded. No Capiro or shared frontend source was edited.

## Implemented behavior and ownership

- `packages/contracts/action-authority-0.2/validate.mjs` owns the private cross-application route/request/receipt vocabulary. Public0.1.1 exports, artifact, registry and original tests remain byte-for-byte unchanged.
- `application-adapters/authority-http.mjs` performs the two fixed HTTPS POST calls with only the existing native bearer, closed bodies, no ambient cookies/cache, no redirects/retries, bounded streamed UTF-8 JSON and response-body cleanup. It is inert and disabled by default.
- `application-adapters/context-adapter.mjs` checks the exact native principal and fresh identity revision, then joins native conversation/client authority with the server-owned command context and canonical `currentRun(binding,{signal})` before and after native context authorization. It derives exactly one client scope under the current run policy. Hash echo is correlation only; browser selectors cannot create authority. Changed principal/revision/policy/fence, expiry, mismatch and parked/late callbacks fail closed under the original cutoff.
- `application-adapters/mount.mjs` composes the existing session owner and action host on one Fetch application. `createApplicationActionHost` returns `{app,close,status}`; `hostPorts` remains exactly the existing allocator and credential/execution broker. The original proposal correlation and explicit approval owners remain in charge. Close invalidates only the owned process-local sessions, leaving borrowed services/pools/clients untouched.
- The only modified original files are `session/owner.mjs` and its README: the owner passes the existing native credential directly to the trusted context adapter. It is never exposed in public receipts or a second credential registry. Source activation remains off by default.

The frontend issuance/action protocol from PR46 is unchanged. Same-origin transport first calls `/api/action-followthrough/session` using its existing native identity credential, then uses the returned opaque credential on query/draft/prepare/execute. Existing public0.1.1 `receiveActionResponse` continues to validate those four action responses. No new browser scope, native secret, approval field or permissive CORS is introduced.

## Executed evidence

| Check | Exact source / scope | Result |
| --- | --- | --- |
| Independent source review | `1afbb5a5`, exact author bytes | 50/50 independent, 11/11 author, 9/9 affected original session checks |
| Root integrated regressions | `6dfc050e489d5790bd6ae009707195aac1c3890f`; new adapters, original session/host/shared-allocation recovery and public receiver | **245/245**, zero failures/skips/cancellations, 12.642 seconds |
| Separate two-listener HTTP replay | `97299694a4650426ad4755c58bbc477a0d85ea2b`; identical accepted application source, before adding reviewer-only controls | **PASS**, 3.325 seconds |
| Root preservation/metadata audit | accepted source and three lane manifests | **104/104**; all11,081 originals retained,11,079 unchanged;57 manifest members;28 pinned private source identities checked without publication of bodies |

The two-listener replay uses a synthetic native authority server and the real application mount. The client sends its fixed HTTPS URLs through a test-only mapping to the loopback authority listener; this is not TLS or a real native endpoint qualification. It uses the existing isolated action fixture and canonical synthetic current-run interface, with actual accepted lookup/proposal/command owners and inert persistence/source ports.

Observed sequence: session200; native bearer on an action401; query/draft/prepare200; unapproved execution `NOT_DISPATCHED` with zero effects; one explicit synthetic approval; observed command with exactly one synthetic task effect; same-proposal replay with no second effect; native revocation causes401 and removes the session; closed mount503. Both listeners closed with zero sockets, and session count returned to zero. There were91 identity reads,91 context reads and182 current-run checks. These counts expose the existing repeated fresh-check composition; they are not live latency, quota or performance evidence. No providers were called.

Run the exact isolated replay with existing dependencies:

```sh
MERI_REVIEW_SOURCE_ROOT="$PWD" node docs/qualification/candidates/application-adapters-20261013/integration/run-mounted.mjs --run
```

The runner is inert on import; `--help` performs no fixture allocation and passed. Exit codes are0 success/help,1 check failure and2 invalid arguments. The [root packet](../../qualification/candidates/application-adapters-20261013/integration/) retains commands, exact heads, raw streams, durations and process ownership.

Failures remain visible. The first author attempted an extra `deadlineMs` option on canonical currentRun; its closed existing implementation correctly refused, and the exact interface was repaired. Independent review reproduced missing explicit cache/cookie suppression and acceptance of an actual redirected200 response; both were repaired and the negatives remain. Reviewer fixture alignment and a missing sparse-checkout dependency are recorded separately from source defects, with unchanged legacy checks passing after exact restoration. Root's initial metadata audit assumed every lane used `members`; the documentation packet uses `files`. The exact failed audit and preimage are retained, the parser now follows that explicit schema, and no product tests were rerun for this tooling correction.

Owned root groups485990,486108 and486353 are freshly absent. Both root-created dependency links were removed and their donors preserved. Author's three groups and reviewer's four groups are absent, with their owned dependency cleanup recorded. No dormant jobs, listeners or model calls were left by this work.

## Exact remaining source and runtime dependencies

The inspected Capiro main is `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. It contains the existing Clerk verifier, tenant/membership middleware, active owned conversation predicate and client ethical-wall owner. It does **not** yet contain the proposed `/api/clio/application-authority/identity` and `/context` endpoints. Its profile receipt lacks the required expiry/revision, and its exact conversation GET intentionally permits archived records. The linked implementation request asks its designated owner to add the narrow bridge using those owners, under the already authorized source-work scope, without new credentials, roles, permissions or auth-policy replacement. Stable revisions, original expiry and current native-session revocation must be established; existing token signature verification alone is not advertised as online revocation. The client-bound action slice refuses null-client conversations without changing their existing routes or the full capability scope.

Three independent Meri inspections found no general product run-admission/current-run implementation in accepted PR46. The canonical currentRun interface is consumed; concrete local owners are synthetic and the retained SDK registry is qualification-specific. Therefore live mounting must supply the actual admitted lifecycle owner for tenant/actor/conversation/run, attempt, worker, fence, policy and original deadline, including replacement/revocation. The adapter implements that exact consumer join; it neither invents worker/fence authority nor promotes qualification rows. This is a concrete missing source-owner dependency, not a runtime-admission restriction on the local tests, which were completed.

The mounting path is runnable with isolated fixtures now. Capiro endpoint implementation, a real admitted Meri run owner and trusted existing allocator/broker/services composition, frontend browser replay, native PostgreSQL evidence and deployment remain separate. Source acceptance does not close **G1 OPEN** or enter G2–G7. Full139 capability accounting and source-off production descriptors remain unchanged. No paid evaluation, new credentials, real identity/customer/database access, cloud/image/network/security changes, source enablement, deployment or main merge occurred.
