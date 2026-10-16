# Retained-read integration successor

Sealed base: `75a6bd646a7df70bb650afe6b5827cd5aeb88542`, tree `9652b8ec42e0299871ee4e1e496d2e4025b36623`. Independent review continues on that immutable candidate. This work uses separate branch `dot/meri-reads-core-wiring-20261016`; no owner source is automatically integrated.

## Concrete caller and authority trace

Startup confirmed published `a3e1afc8be840049bd07dd6fbb2410f189e98e6c`: `apps/runtime/general-read-port.mjs` captures the canonical mount's existing `readAvailability` and `execute` methods; `conversation-runner.mjs` and `remote-conversation-runner.mjs` forward them to the existing activity, with source access disabled. These exact source files and its `DOT-ORDINARY-READ-RUNNER-SEAM-20261016.md` were read at that pin. The forwarding connection exists; no new runner adapter is necessary.

Startup `936ef078c707d25669a78cd5ae84772cbd265e9f` carries the native user bearer only inside the current product HTTP request lifetime, including membership rechecks. Core's `feat/core-current-membership` source starts at `016e79b585c14f20d13669e13c987c01e3dd29dd` and adds a sibling `POST /api/clio/application-authority/membership {}` beside the existing identity endpoint. The Core owner confirms it reports actor/tenant membership and permitted clients, with `permissions: []`; it supplies no conversation, folder or portfolio authority method. Its implementation/review pin remains pending. Neither ordinary membership nor client-list responses authorize a retained read.

Both owners explicitly confirm there is currently no concrete `retainedContextPorts.readCurrent` or retained `getCredentials` caller/resource binding in prepared control. Do not turn membership into a scope proof, retain the incoming native bearer for a background task, expose it to a worker, or fabricate a lease.

## Exact existing resources and required action

The existing native Capiro/Clerk user bearer is verified online by Core's existing `CLERK_SECRET_KEY` owner. Florida's existing legacy tool route separately requires the applicable `INTERNAL_SERVICE_SECRET` gate. `meri-gateway` run capability is neither credential. No new key, issuer, workload resource, permission or cloud activation is allocated.

Parent action required: allocate the genuine control-side current run/conversation-to-Core principal and retained scope corroboration owner, plus task-bound delegated credential brokerage using the approved existing resources and recipient. Portfolio requires current captured portfolio subject/grant and client walls; Florida requires current feature/member/folder/client resolution. The ordinary no-skill allocation and qualified native installation/discovery owners also require real binding. Source-only normalization, HTTP producers and runner forwarding are already present. Live qualification follows allocation; no abstract replacement port is added in this successor.

## Focused source outline

While those bindings are pending, add retained-read admission controls over the actual measured installation owner, canonical gateway mount/current authority/durable invocation, worker availability runtime and in-memory MCP server. Extend only synthetic fixture inspection/mutation points; test native receipt substitution, current discovery revocation, allocation mismatch and release changes. Keep all runtime flags disabled by default and label fake HTTPS/scripted SQL separately from real qualification. Run only the new focused files, one process, 128MiB heap, isolation disabled, concurrency1, 120s hard wall after fresh memory. No broad historical reruns, compiler, install, database, browser, provider or daemon work.

Owned successor paths: this report, `apps/gateway/general-reads/admission.test.mjs`, `general-reads/test/durable-fixture.mjs`, and `apps/worker/conversation/reads/test/admission.test.mjs`. No production module, contract, lockfile, migration, startup/finally or other owner's source is claimed.
