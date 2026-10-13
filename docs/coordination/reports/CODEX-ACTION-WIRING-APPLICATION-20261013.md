# Action application source handoff

Source freeze: `7cea5042a57f3fa9202d87b0c3ba433d7c77a9dd`, from exact base `f3127d742b6b4ec556b00dba939d35e5622a9ad1`. Initial source/preimage `bdad9a1f2618dc492f1800a20d13f450d46ce9d6` remains immutable. Independent review is separately owned by gateway_reviewer; its exact repaired replay passed 36/36 before this packet seal.

## Delivered behavior

`apps/control/action-application/index.mjs` exports `createActionApplication({resolveSession,now,limits})` returning `handle(Request)`. The README defines the fixed, new, unactivated POST query/draft/prepare/execute routes and closed request/session contracts. Query calls actual lookup then authorized retained-result read; draft/prepare reuse actual followthrough; execute delegates the existing command interface, current approval, authority, journal and source executor. Preparation has no task effect. Supporting recommendation evidence remains outside the approved command hash, with no authenticated durable source-link claim.

`http.mjs` owns bounded UTF-8 JSON streaming, fixed route admission and content-free no-store JSON responses without CORS. `session.mjs` correlates trusted current bindings, scopes, client resolution and fresh session receipts; it clips source/metadata deadlines to the original request cutoff. There is no new policy, approval, persistence, source mapping or worker loop. Fresh host query IDs/event slots are a session owner obligation. The opaque application session is separate from lookup and execution credentials.

Known retained results survive a later denied read as RESULT_NOT_RELEASED. Existing UNKNOWN, STORED_NOT_RELEASED, NOT_STORED and READ_UNAVAILABLE metadata dispositions remain explicit. NOT_STORED describes metadata insertion only; read unavailability does not prove absence or authorize retry. Rejection objects are inspected only through inert own data descriptors after Proxy exclusion. Internal application error facts have a private WeakMap. No credentials/private error text are returned.

## Checks and preserved failures

Author focused Request/Response controls: **15/15 PASS**, source diff bound exactly to the repaired commit by `source-audit.json`. Actual canonical lookup/store/current identity and command executor/journal/source modules run over explicitly inert SQL, HTTP and metadata fixture ports. Explicit separate approval leads to one task effect and journal replay; query/draft/prepare do not create tasks. Independent exact-source replay: **36/36 PASS**, reported owned group 446116 absent; final independent packet acceptance remains that reviewer's responsibility.

Preserved author captures: initial test syntax failure (0/1); after syntax repair, 11/14 passed and three query-path failures exposed reused synthetic event sequence slots colliding with the fixture's retained initial query. Fresh slots repair the fixture without weakening assertions. The repaired run adds a real identity-revocation/read-denial regression.

Independent initial source failures remain in the review lane: stored query misclassified as NOT_DISPATCHED (29/30, then actual identity denial reproduced); hostile rejection Proxy/getter invocation and lost STORED_NOT_RELEASED metadata outcome (1/4, with lost INSERT ACK already passing UNKNOWN). All were repaired in this new application boundary. No existing canonical owner changed.

Source audit: **22/22 PASS**, all **10,378** base entries byte-identical, only allocated additions. Raw captures and exact source hashes are retained. Author groups **443675, 443961, 445617** freshly absent; no timeout or cleanup kill. Only our two dependency symlinks were removed; donor resources and borrowed owners were preserved. No additional broad run was needed.

## Activation handoff and limits

Import the factory without side effects, provide the exact trusted `resolveSession`/`authorizeExecution` contracts in README, and pass Fetch Requests to `handle`. The separate local author composes a synthetic one-shot graph and owns its CLI; this lane creates no listener or service. A production host still must authenticate sessions, bind actual identity/tenant/current policy, allocate fresh lookup delivery IDs/slots and supply qualified persistence/source/approval owners. No native SQL engine, actual HTTP producer, provider, cloud, paid model, customer data, browser or production security/activation was exercised. Cancellation is cooperative; a bounded response is not proof an issued external operation physically stopped. Production source/catalog availability remains unchanged and unavailable.
