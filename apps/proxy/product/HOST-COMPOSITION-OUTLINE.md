# Product model proxy host composition

The direct TLS server supplies the actual socket peer and ASGI scope. The
`bearer_eni_admission.py` resolver hashes the CLI's opaque bearer, resolves
its control-owned product grant and original issued task, and reads fresh ECS
task plus attached EC2 ENI state. It requires the task's persisted
startedBy/group/tags, image digest, placement and RUNNING status, plus the
ENI's private IPv4 matching the **actual TLS socket peer**. The existing
request lifetime rechecks that join before CountTokens and inference send.
The trusted resolver constructs the existing
`TrustedRequest`/`IngressAdmission`; only the opaque bearer hash locates a
persisted grant, while no worker-provided ARN, grant ID, tenant, model, owner
or provider credential supplies authority. The existing
`InferenceApp` owns the original request lifetime and exact Messages and
CountTokens routes.

The pinned Claude Agent SDK 0.3.295 options expose only `ANTHROPIC_BASE_URL`
and `ANTHROPIC_AUTH_TOKEN` for this worker; a runner client certificate is not
supported by the observed options. The disabled plan therefore does not
require runner mTLS. The service still needs direct server-authenticated TLS
through the TCP NLB, a reviewed server callback that reads the accepted
socket rather than copying `scope.client`, a durable bearer-to-issued-task
lookup, and short-deadline/no-retry task-role ECS/EC2 clients. The source
reader requires exact region/HTTPS endpoint and at most one-second connect
and read timeouts with no retry; it cannot prove task-role or network
configuration. No such service bootstrap is mounted. Actual Linux NLB source
IP preservation and the pinned CLI wire need a native check.
The existing `InferenceApp` invokes its resolver synchronously before the
request watcher. `create_bearer_eni_product_proxy_app` now resolves the durable
grant and ECS/ENI lease off the ASGI loop with a five-second maximum bootstrap
wait. The original deadline starts at request arrival. Timeout or cancellation
of an unfinished lookup permanently poisons host readiness; a late result
cannot reauthorize the request or allow another send. The same long-lived
`InferenceApp` retains its own pending-work quarantine. Python cannot stop a
hung thread; each socket reader, durable lookup and ECS/EC2 callback must have
an independent reviewed bound, and native process-supervisor shutdown still
needs qualification. This source remains unmounted for the other named
peer, channel and LiteLLM ports.

For each admitted Messages call, a trusted session resolver supplies the
immutable current run, original deadline, selected client, one product model
grant, pinned CountTokens client, provider HTTPX transport, and an authenticated
bridge to the **existing** JavaScript product budget reservation and historical
settlement owners. `host_composition.py` installs the actual final-HTTPX
observation hook before the existing send guard, wraps the CountTokens client,
and nests the response observation and settlement transports around the one
provider transport. Only this composed HTTPX handler is passed to the pinned
LiteLLM request invoker. The separate CountTokens route uses the same admitted
ASGI lifetime and pinned model, but cannot reserve or send inference. It
refreshes the direct peer/grant and rechecks current Core conversation context
both before and after its CountTokens call.

`product-owner-composition.mjs` joins the two existing JavaScript product
reservation/settlement bridges using the **same borrowed canonical pool**,
persisted allocation/grant facts and one request ID. Its required private host
channel supplies independent request and completed-response captures. It opens
no channel, listener or second store. A missing or mismatched channel refuses
construction. The Python bridge still needs a real authenticated transport
implementation that binds that channel to the direct socket and the response
tee before it can satisfy `make_owner_bridge`.

The existing `boundary_codec.py` is bounded encoding, not channel
authentication or independent observation. An HTTP client that merely sends
the Python claim cannot satisfy the JavaScript reservation owner's
`captureAuthenticatedCall` and settlement owner's
`captureAuthenticatedComplete`. The receiving side needs its own trusted
capture of exact native request and response/EOF, with an allocated issuer and
channel policy, before this port can be filled without weakening those owners.

The authenticated bridge must independently capture the Python host's direct
peer, bearer, original/final native bytes and complete response under an
operation-bound private channel. It must invoke
`createProductProxyReservationBridge` and
`createProductProxySettlementBridge` with the current allocation, grant facts,
Core conversation check and **one** canonical product budget store. A codec
frame, a caller-provided `taskArn`, or a Python `UsageResult` alone does not
authorize SQL. Missing bridge, capture, currentness, provider, or LiteLLM
injection ports deny construction; this module opens no listener, fetches no
credentials, runs no SQL, and never performs a model call at import time.

The host owns closure of each newly created HTTPX handler and transport. The
original ASGI lifetime owns cancellation/deadline checks. A lost reservation
acknowledgement retains UNKNOWN and forbids another send. Only the canonical
settlement owner's confirmed `BudgetCommitUncertain` permits a read-only
historical outcome check. Focused source tests exercise construction refusal,
hook order, one native call, EOF settlement and failed currentness. Native
Linux TLS, task-lease, LiteLLM injection, provider wire, database and spend
checks remain separate activation gates.

The accepted LiteLLM 1.104.2 `/v1/messages` route uses global proxy processing
and a provider client dispatch. This source has an explicit `invoke_litellm`
port so a future reviewed image can inject this exact per-request handler;
none of the current focused tests proves that upstream route uses it. The
port cannot be replaced with a global LiteLLM client or a test HTTPX client
for live traffic. The assembled pinned image and native wire qualification
remain required before this host can serve product requests.
