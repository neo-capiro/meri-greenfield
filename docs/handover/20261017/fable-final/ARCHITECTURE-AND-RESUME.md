# Architecture and fresh-machine resume

## Status and reading order

This supplement describes the preserved implementation at the **2026-10-17 06:47:33 UTC** implementation cutoff. Read [README.md](README.md), [ROOT-SOURCE.json](ROOT-SOURCE.json), [STATE-AND-GATES.md](STATE-AND-GATES.md), [CHECKS.json](CHECKS.json) and [LANES.md](LANES.md) first for ownership, immutable pins, evidence and current lane supplements.

The root implementation checkpoint is `59856683e07efde3e04772f6b5229faa931c4b85`, tree `d2120719e83132a2d62dce9d6ad3342d801725c1`. It preserves the incomplete integration in `1cc71ba6c2b039962a2213e178e6d208b706240b` and receives the exact issuer PR130 files. **The combined root tree has no final independent acceptance or combined test rerun.** A committed executable is not evidence that its configuration, service, image or credentials exist. Historical handoffs remain evidence for their own dates; their owner, port, source and activation statements do not override this checkpoint.

Fable receives Meri source continuation and integration ownership through the primary README. Dot retains Core/shared frontend coordination and authenticated live E2E acceptance. A shared resource must have one named shipping owner before a write. This file grants no live action or additional paid attempt.

## Repository and legacy boundary

| Repository | Responsibility | Receiving rule |
| --- | --- | --- |
| `neo-capiro/meri-greenfield` | Meri control, run admission/custody, Temporal workflow and poller, isolated conversation runner, SDK integration, model proxy/budget owner, documents, tools and Meri feature lanes | Use the root checkpoint plus the separately pinned feature stacks in LANES. Remote `main` alone does not contain all recovered local work. |
| `neo-capiro/capiro-backend` | Existing Core data and authorization authorities: native identity, current conversation context, membership/client roster, conversation bootstrap, and separately held Objective/read producers | Follow the Core owner supplement and exact PR/source pins. Meri calls its fixed authenticated contracts; a copied receipt or browser identity is not Core authority. |
| `neo-capiro/capiro-frontend` | Browser login, selected client, preview gateway, Meri host and shared navigation, plus separate non-Meri frontend work | Use exact selected source and consumer contract pin. The frontend PR70 image attempt failed its architecture gate and produced no new image. Later source-only fixes require their own final qualification. |
| Legacy `capirov2` | Behavioral, data/schema and existing product boundary for the rebuild | No exact legacy source pin was supplied for this cutoff. Do not invent one, copy its implementation into the greenfield runtime, or treat the rebuild as an automatic production cutover. Resolve any required legacy fact against a named owner and exact source before use. |

The ordinary first-chat candidate includes the recovered admission lineage through PR121. Read tools, preferences/tasks/routines, Objective/Planner and their frontend consumers have separate reviewed or incomplete stacks. They are transferred as source, **not implicitly mounted or qualified by the root first-chat checkpoint**. Receive them individually, preserve their accepted behavior, and use the minimal shared-file receiving proposals rather than replacing newer root files with older feature branches.

## Runtime map

```text
Browser / Clerk session
  -> frontend server gateway (fixed route/target and write policy)
     -> Core native identity / membership / conversation bootstrap
     -> Meri control HTTP/session owner
        -> canonical conversation/run/input/issuance/allocation stores
        -> Temporal authenticated frontend
           -> Meri Temporal poller / prepared kickoff broker
              -> one fresh isolated conversation task
                 -> Claude Agent SDK -> trusted product model proxy
                    -> native LiteLLM request -> approved provider
                    -> mTLS Node model owner -> canonical product budget

Control and poller startup
  -> task-local post-placement CSR bootstrap
  -> private Temporal issuer :8445
     -> current service-task registration + fresh ECS/ENI proof
     -> external RSA KMS signer -> short-lived namespace JWT
```

This is the intended source composition. Arrows are not serving receipts. The real private transport, native provider, database grants, task identities and image pair still require the gates in STATE-AND-GATES.

| Process or service | Actual source entrypoint / main owner | Boundary |
| --- | --- | --- |
| Trusted Meri control | `apps/runtime/cli.mjs control`; `control.mjs` | Owns application PostgreSQL Pool, canonical sessions/conversation service, native authorities and Temporal client. One control replica and process-local opaque sessions are the current isolated-preview profile. |
| Temporal poller | `apps/runtime/cli.mjs temporal-worker`; `temporal-worker.mjs` | Runs canonical workflows/activities and the prepared kickoff broker. It does not execute the model loop in the poller process. |
| Conversation task | `apps/runtime/cli.mjs conversation-runner` | Exact run binding, workspace and short-lived capability; canonical SDK query. No database, provider-account or Temporal service credentials belong in this task. Fresh physical isolation must be proved. |
| Temporal issuer | `apps/runtime/temporal-issuer-cli.mjs`; received `temporal-issuer/entrypoint.mjs` | Dedicated registration Pool, KMS signer, server/client CA custody, task proof and private TLS listener. Source selects `0.0.0.0:8445`, not historical port443. |
| Product model owner | `apps/proxy/product/owner-entrypoint.mjs` | Node private mTLS service on8444. Joins canonical admitted run/issuance/allocation and current Core context, and invokes the existing reservation/settlement owners over one canonical budget store. |
| Product model proxy | `apps/proxy/product/main.py` | Separate Python TLS service on8443; exact native LiteLLM loader, socket capture, admission, guarded final request/response transport, and owner channel. |
| Static material initializer | Existing `apps/runtime/material-init.mjs` and `material-init-plan.mjs` | Sole short-lived writer for reviewed static files. Main roles receive read-only static mounts; runtime-generated identities use their dedicated task-local writable volume. |

The broader Temporal server deployment is the pinned five-role server topology, distinct from the Meri SDK task and poller. Its server, namespace, queue, durable primary/visibility stores, TLS, audience and JWKS are real deployment bindings, not defaults created by CLI. The control listener and poller health listener remain separate. Health is liveness/readiness only; it never grants model, user or task authority.

## First-chat authority and durable flow

1. The browser obtains its genuine native Clerk session token. The frontend preserves a stable New Chat retry intent before POST and calls the narrow Core bootstrap route. Core returns a candidate conversation UUID. Receipt identity fields are not Meri admission authority.
2. Meri independently reads fresh Core identity and context, joining the native principal to configured tenant/actor, selected active client and that conversation. Membership supplies the current client roster. Missing, foreign, archived or wrong-client records refuse. Native authority operations are POST `/api/clio/application-authority/{identity,context,membership}`; bootstrap is POST `/api/clio/conversations/bootstrap`.
3. The immutable `meri_conversations.initial_run_bindings` journal admits the writer-fence-1 binding for that tenant/conversation and reviewed configuration. Canonical run, input, request, issuance and allocation owners remain separate; the journal does not replace them. Exact replay reuses the original identity/expiry. Uncertain writes are not a new-run signal.
4. Protected issuance facts and the full binding commit to the actual accepted request, versions, policy, scopes, allocation and task request before native launch. The original expected placement is reconstructed from those durable facts; fresh AWS observations compare to it and cannot create it.
5. Temporal dispatches the prepared kickoff and follows the same physical execution identity. The workflow identity is `meri:<tenant>:<conversation>:<run>`; the broker must not retry an uncertain launch. The isolated runner uses the exact admitted workspace, versions, deadline, proxy origin and task capability.
6. The canonical conversation service persists events/history/checkpoints and streams only through the current session/scope owner. Saved history/model sends recheck current Core context. These are point-in-time checks, not proof of instant archive revocation or physical stop.

Frontend Core reads need only GET `/api/me`, `/api/clients`, `/api/clients/:id` at the fixed Core target. Core conversation history GET is not a dependency: list/history/transcript go through Meri. Core target and listener/guard ownership must be reconciled with dot before any routing change.

### State ownership

- Application conversation state uses dedicated Meri schemas in the approved existing database boundary. The runtime never applies migrations at startup. The allocated migration inventory and applied-versus-unapplied status are in STATE-AND-GATES.
- Canonical `run_issuances` and `native_allocations` retain actual issuance/allocation custody. Model capabilities remain separate from raw user bearer credentials. Budget reserve/capture/settle uses the existing canonical product budget; there is no second allocator or parallel ledger.
- Temporal service identity uses the separately allocated `meri_service_identity.service_task_registrations`, not the per-run allocation table. It has irreversible revoked-task tombstones and prior-fingerprint CAS rotation. Its migration is source only and native qualification remains UNRUN.
- Temporal server primary and visibility stores are separate from the registration table and from conversation state. Runtime workers must not receive their database credentials.
- SessionStore/checkpoint/artifact paths retain their canonical owner and exact SDK session/run identity. Selected source/artifact installation, S3 versioning and provider qualifications cannot be asserted from a test callback or filesystem substitute.

## Temporal authentication, materials and failure behavior

Static issuer files are owner-only direct children of `/run/meri`. The canonical initializer alone receives the reviewed exact-version Secrets input, writes0600 files under0700, and exits successfully. The main issuer receives only the read-only file volume. Configuration is closed and SHA-bound; no JSON module selector or arbitrary factory installs authority. A known static material-init late-open/post-deadline write gap remains unfixed at this cutoff and must be resolved before claiming bounded material startup; see STATE-AND-GATES.

Control and poller cannot use a shared presealed leaf: ECS assigns the task ARN after placement. They bootstrap distinct CSR/key pairs using task-local metadata only as an ARN selector. The issuer independently joins the actual direct TLS peer IPv4 to fresh service-scoped ECS/EC2 task/ENI, pinned service/task definition/image/role/network facts and durable registration. No forwarding header, caller task ARN, metadata response or role-principal name alone proves the task.

Generated key/cert material lives under `/run/meri-temporal/identity`; the token path is `/run/meri-temporal/token.json`. Root startup installs generation-specific0600 pairs in0700 task-local storage, wipes returned key buffers, drains the old mTLS client and rotates through the canonical registration CAS before expiry. The default leaf is five minutes; failures or expiry fence readiness and execution. Linux filesystem/late-write/rotation behavior remains a real qualification gate.

The received protocol pins RS256, an exact public JWK/KID and `iss = issuerOrigin + '/'`, with a bare HTTPS issuer origin containing explicit `:8445`. Tokens have audience `meri-temporal`, bounded lifetime at most60seconds and `permissions:['meri:write']`. Stock Temporal1.32.1 treats this as broad non-admin namespace RoleWriter, not queue-scoped permission. Its default mapper does not enforce exact issuer/sub/jti as the Meri issuer/client do. Already-issued tokens may remain usable until expiry after revocation; cached JWKS refresh is another limit. Do not claim instant server revocation.

Loss of current token/identity synchronously fences ordinary control/native operations. The narrowly preserved original stop operation retains its original authorization and request/signal; it is not a new grant. Cleanup tracks actual pending startup, material, network, signer, DB and handler work. `CLEANUP_UNKNOWN` remains sticky. An abort, timeout, rejected promise or closed listener alone is not physical task or borrowed-operation settlement.

## SDK and model proxy

The product loop remains Claude Agent SDK **0.3.295 / CLI2.1.295**. Trusted options set `ANTHROPIC_BASE_URL`, task-scoped `ANTHROPIC_AUTH_TOKEN` and the reviewed model; raw provider API/OAuth keys and ambient alternative-provider settings are excluded. Do not replace the SDK loop or serialize trusted fact producers into caller configuration.

The Node runtime image and Python proxy image are separate. The Python product recipe reuses the pinned Debian/CPython **3.13.5** assembly with LiteLLM **1.104.2**, HTTPX0.28.1, Boto3/Botocore1.43.111, Uvicorn0.51.0 and h11 0.16.0. Do not copy a Python venv into the Wolfi/GNU Node image. Local source controls used Node24.19 and Python3.12; the selected Node image runtime is24.21. Matching version metadata and borrowed installs are not clean install/image provenance.

The proxy binds actual accepted sockets, performs opaque-bearer-to-genuine-issued-task admission, checks native Core currentness and independently captures final native request/complete response before canonical reserve/settle. Four fixed owner routes remain under `/v1/internal/product-model/owner/`: `session/open`, `operation`, `capture/poll`, `capture/reply`. Caller claims or codec framing alone authorize nothing.

Service-pair discovery solves the owner/proxy prelaunch task-ARN/IP cycle from immutable service/task-definition/digest/network pins, then fresh unique service task/ENI observations. This identifies the service peers only; it does not replace original per-run placement authority. The current source snapshots a pair and permanently retires on drift. Plan a coordinated drain/restart for replacement; no stale peer fallback or uncontrolled rolling reconnect is qualified. The final service-pair receiving fixture/review is incomplete; consult PROXY-REVIEW and CHECKS before changes.

The native LiteLLM compatibility layer is exact-version/function-source-hash guarded and changes two in-memory product-only native auth boot decisions. It does not modify installed third-party files or permit unguarded master/JWT/OAuth modes. The real installed native lifecycle, CPython verified-chain API, TLS, SDK Messages/CountTokens wire, cancellation, provider response and physical cleanup are UNRUN here. The current8192-input/256-output/no-thinking/local_echo diagnostic cap is not a measured real SDK envelope or an accepted user-facing answer.

## Fresh-machine source pickup

Use a new workspace and existing authorized GitHub access. Do not copy this host's `.aws`, tokens, cookies, private keys, environment bundles, caches or `node_modules`. The approved root source is Git-backed; any denied/unpublished lane payload remains the explicit exception identified in its final supplement, not a machine-only dependency to bypass. If a reference cannot be fetched at its immutable pin, stop that receiving operation and report the missing repo/path/SHA; do not substitute `main`.

The following commands are source pickup examples, not commands executed at this cutoff. Replace only the final handoff SHA from the delivered immutable URL. Keep implementation and handoff checkouts separate so the documentation successor is not mistaken for a tested implementation commit.

```sh
git clone https://github.com/neo-capiro/meri-greenfield.git meri-handoff
cd meri-handoff
git fetch origin codex/meri-first-chat-runtime-integration-20261017
git checkout --detach <FINAL_HANDOFF_COMMIT_FROM_IMMUTABLE_URL>
git show --no-patch --format=fuller HEAD
python3 -B docs/handover/20261017/fable-final/verify_handoff.py

# This is the preserved implementation, not a new test/activation claim.
git cat-file -e 59856683e07efde3e04772f6b5229faa931c4b85^{commit}
git worktree add --detach ../meri-source 59856683e07efde3e04772f6b5229faa931c4b85
cd ../meri-source
git rev-parse HEAD
git rev-parse HEAD^{tree}
```

Expected implementation tree is `d2120719e83132a2d62dce9d6ad3342d801725c1`. Use ROOT-SOURCE.json for per-file hashes/ancestry and ISSUER130-RECEIVING.json for the exact copied issuer closure. Side-lane fetches use their immutable full heads from LANES and each supplement; they are not automatic merges.

For a separate lane whose branch is not in the local object set, use its published pull-request ref, then verify the documented full commit before creating another checkout. For example, from the Meri clone:

```sh
git fetch origin refs/pull/130/head
git cat-file -e eb603f28023c5fcbfcdbf42953e86411a1a83bca^{commit}
git worktree add --detach ../meri-issuer-source eb603f28023c5fcbfcdbf42953e86411a1a83bca
```

Use a different unused destination for each feature source; resolve the final read/product/Objective pins from LANES, not the moving `FETCH_HEAD`. Their supplements contain the full stack and any held publication exception.

Run the offline verifier in the **documentation seal checkout**, where this packet exists. It checks the separately pinned Git source objects and never imports the application, installs packages, starts a process listener or calls AWS. Python optimization is refused. A successful result is source-object integrity only, not runtime acceptance.

```sh
git clone https://github.com/neo-capiro/capiro-backend.git capiro-backend
git clone https://github.com/neo-capiro/capiro-frontend.git capiro-frontend
# In each repository, fetch the branch in its owner supplement, then:
git checkout --detach <SELECTED_FULL_OWNER_PIN>
git rev-parse HEAD
git rev-parse HEAD^{tree}
```

Do not globally configure Git trust, change ACLs or bypass denied Docker access to reproduce the old machine. A normal receiving machine must have its own approved tool/runtime/network setup. Use source and lock hashes, not this machine's junction layout.

## Source checks after receiving review

No tests or installs were run while writing this handoff. First review preserved incomplete source, then prepare one clean locked dependency installation per package, using the exact supported Node/npm/Python and original lockfiles. Root `package.json` may be absent from a sparse checkout even though the full repository/image recipe needs it: fetch a full checkout instead of inventing a replacement.

The committed runtime Docker recipe identifies the Node package install boundaries: repository root, `apps/runtime`, `apps/worker/conversation`, `packages/ui-stream`, `packages/window-resolution`, `apps/control/conversations`, and `apps/artifacts/storage` (storage uses production dependencies). A receiving-host offline/sandbox install plan must be reviewed against those exact locks. These are the existing command forms, **not a claim that a fresh install was qualified here**:

```sh
node --version
npm --version
python3 --version
npm ci --ignore-scripts --no-audit --no-fund
npm ci --prefix apps/runtime --ignore-scripts --no-audit --no-fund
npm ci --prefix apps/worker/conversation --ignore-scripts --no-audit --no-fund
npm ci --prefix packages/ui-stream --ignore-scripts --no-audit --no-fund
npm ci --prefix packages/window-resolution --ignore-scripts --no-audit --no-fund
npm ci --prefix apps/control/conversations --ignore-scripts --no-audit --no-fund
npm ci --prefix apps/artifacts/storage --omit=dev --ignore-scripts --no-audit --no-fund
```

Do not use these Node commands to resolve the separate Python native proxy assembly. Its committed requirements/artifact pins and existing assembly recipe are the source of truth; native assembly/image qualification needs a separately allocated action. The root KMS dependency3.1151.0 is committed but was not installed in the outgoing borrowed tree.

Focused check selectors below exist in the checkpoint. They use synthetic owners where the test supplies them and may need repaired receiving fixtures before a coherent run passes. Preserve first failure output, exact source/runtime/lock identities, skipped cases and process cleanup. Do not sum overlapping subset counts or report a skipped installed-native test as passing.

```sh
# Runtime receiving, rotation, authorization and actual cleanup ownership
node --test apps/runtime/temporal-product-authorization.test.mjs apps/runtime/temporal-product-bootstrap.test.mjs apps/runtime/temporal-runtime-fence.test.mjs apps/runtime/test/product-temporal-startup.test.mjs apps/runtime/test/control-temporal-startup.test.mjs apps/runtime/test/temporal-worker-startup.test.mjs apps/runtime/test/http-cleanup-ownership.test.mjs apps/runtime/test/temporal-issuer-cli.test.mjs apps/runtime/test/issuer-material-plan.test.mjs

# Owner placement/currentness and new pair selection; source-root fixture binding
MERI_REVIEW_SOURCE_ROOT="$PWD" node --test apps/proxy/product/product-owner-placement.test.mjs apps/proxy/product/owner-native-currentness.test.mjs apps/proxy/product/service-pair-discovery.test.mjs apps/proxy/product/service-task-leases.test.mjs apps/proxy/product/owner-entrypoint.test.mjs apps/proxy/product/owner-https.test.mjs

# Pinned synthetic Python product controls; installed-native skip is material
python3 -B -m unittest apps.proxy.product.test.test_main apps.proxy.product.test.test_native_auth apps.proxy.product.test.test_native_compatibility apps.proxy.product.test.test_service_pair_discovery apps.proxy.product.test.test_startup_config apps.proxy.product.test.test_owner_https apps.proxy.product.test.test_owner_startup

# Closed disabled deployment/template contracts, not a rendered live service
node --test infra/product-preview/manifest-token-writers.test.mjs infra/product-preview/temporal-deployment.test.mjs infra/product-preview/temporal-launch.test.mjs infra/product-preview/temporal-product-join.test.mjs
```

On PowerShell, set `$env:MERI_REVIEW_SOURCE_ROOT=(Get-Location).Path` before the Node owner checks rather than using shell assignment syntax. Use CHECKS for the actual historical command/results; this list is a future receiving selection, not a new receipt. Broader runtime `npm test`/typecheck and image gates should be batched once the combined source is coherent. Do not create another test framework or run an audit of unrelated source.

The isolated issuer PG16 harness is published source but remains UNRUN and specifically approval-gated. Do not execute it, create credentials, redirect it to system5432/Aurora, or infer approval from the commands above. Initial-run journal0017 has separate historical isolated evidence; it does not qualify the new service identity schema or the live database.

## First-chat acceptance sequence for the receiving owner

These are ordered acceptance criteria, **not permission to activate resources**. Each earlier source/security/image/database gate in STATE-AND-GATES must be closed with exact receipts before its live step. Fable coordinates Meri shipping; dot owns the authenticated E2E and shared Core/frontend routing.

1. Freeze one exact compatible frontend/Core/Meri source+image+config set. Review the full first-chat diff and dependency inputs, including issuer8445, dynamic certificate volume, native session audience/template, selected client and fixed proxy origins. Confirm the relevant applied migrations/role grants and rollback originals. Feature lanes remain separately received until qualified.
2. Qualify the exact new Node and Python images, native imports, nonroot paths, TLS/peer proof and clean completed scan. The old f005 image does not contain the preserved new root implementation. Frontend PR70's failed image attempt cannot supply a new frontend digest.
3. Establish the approved issuer DB/KMS/CA/network/material bindings, task-local bootstrap, rotation, expiry/revocation behavior and terminal cleanup. Prove Temporal namespace/JWKS/audience/write semantics with the intended stock server. Do not substitute a stale static token to get past startup.
4. Recheck native Core/selected-client authority. Neo confirmed same-application Clerk key pairing at05:17 UTC; actual native session/template/member/client admission remains UNRUN. Verify privately without displaying or placing bearer material in Git/evidence.
5. Enable only the separately approved fixed preview routes and narrow bootstrap write exception. Check liveness/ready and exact image/task/config/target state; health alone is insufficient. Keep all unrelated writes held and retain the original stop/reconcile path.
6. Dot logs in to the preview with the real user, selects an active permitted client, starts New Chat with stable retry intent and sends one real Meri prompt. Verify one canonical accepted request/run despite retry or navigation; no duplicate allocation/submit after uncertain acknowledgement.
7. Observe a real provider answer stream through the canonical SDK/proxy path, with current authority before send, one canonical budget reservation and confirmed complete settlement. A synthetic echo or prebuilt fixture answer does not satisfy this step.
8. Confirm durable transcript/save and conversation list, navigate away, reload and reopen the same conversation. Verify exact user prompt, assistant content/order, selected client and no duplicated initial turn. Continue once to exercise successor binding/currentness.
9. Exercise the approved interruption/cancel case and reconcile actual Temporal/native allocation/ECS effects. Keep UNKNOWN visible; do not auto-retry a partial model effect or infer physical stop from a UI Stop button. Capture only nonsecret release/run/custody and terminal cleanup identifiers.
10. Return the exact sources/images/config/material-reference revisions and E2E evidence to dot. Leave live flags and rollback state explicit. Preserve old controller/image/config for all old and successor runs until actual physical-stop/drain proof; a changed configuration hash can still make old saved conversations incompatible after drain.

## Inputs still requiring an owner, not a guess

The master state and lane supplements carry the exact outstanding resource and permission list. At this cutoff the missing factual bindings include the final combined-source acceptance, new image qualification, exact live issuer material/KMS/registration-role/primary-store and network pins, real Temporal and proxy/native behavior, live native Clerk member/client admission, provider pricing/wire fit and old-pin task inventory. Existing physical resource observations are dated snapshots. An exact legacy `capirov2` source pin was not supplied. Resolve these explicitly before activation; do not turn source proposals, tests or observed AWS task facts into authority.
