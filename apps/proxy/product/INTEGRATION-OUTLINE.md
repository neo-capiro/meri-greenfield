# Product model proxy source integration

The direct TLS proxy owns the incoming socket, authenticated worker peer, bearer,
raw request bytes and final LiteLLM HTTPX request. It supplies those observations
through a constructor-captured private bridge. The existing Python
`AwsNativeCounter` makes one CountTokens call on those final native bytes. The
private one-shot JavaScript shape adapter compares the Python observation with
an independent authenticated host capture; it never promotes the Python
argument into evidence. The JavaScript gateway owner checks the configured model grant, hashes the exact final
bytes, verifies the authenticated proxy's CountTokens observation and delegates
the durable UNKNOWN hold to the
canonical `createProductModelReservation`. The Python send guard waits for that
receipt before its one native send. The separate response transport observes
complete native usage and invokes the canonical historical settlement owner.
It derives its usage binding after the guarded send is armed from the validated
UNKNOWN receipt, final native bytes, AWS count and retained original-request
hash; it cannot precompute those values at transport construction.

The bridge has no public route, listener, credential creation or provider client.
The deployable host must still provide an authenticated cross-process transport
and codec that preserves exact bytes, captures the direct peer independently,
and binds the same guarded CountTokens observation, plus an independently
observed ECS task lease. It must also carry complete response evidence to the
canonical settlement owner. If any owner is absent, the
proxy cannot be mounted for product traffic. CountTokens preflight from the pinned
CLI is a separate exact read route and never substitutes for final native counting.

Focused checks cover digest, route, count and hold binding; the existing budget
tests cover current allocation, fence, revocation, caps and uncertain commits.
Production TLS, ECS identity, AWS CountTokens and live provider behavior remain
separate qualification gates.

## Native envelope decision at the integration pin

`qualification/runtime/bedrock_body.py` still admits only the small text and
local tool envelope with `max_tokens <= 256`, fixed native version, no thinking,
cache control, inference beta or other Bedrock feature headers. The new CLI
CountTokens preflight route does not widen that inference envelope. Before a
real first chat can be accepted, capture the pinned CLI's **final translated
HTTPX method, URL, headers and raw body** offline, compare the actual
`max_tokens`, tools, thinking and beta fields with this validator, and make a
specific reviewed decision for any mismatch. Keep the fixed US profile and
the 256 output ceiling unless pricing and native usage bounds are separately
qualified. A mismatch must refuse before reservation or dispatch; it is not a
reason to admit arbitrary routes or silently drop a feature.
