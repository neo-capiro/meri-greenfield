"""Time budgets for one proxied model request.

A request resolves its bearer with two owner exchanges (placement read, then admission read) under one exchange
budget, and each exchange proves the service pair four times (proxy and owner, before and after). Live ECS/EC2
latency made the original 3 s exchange and 5 s bootstrap impossible (20 Oct, attempt 2: the first two pair proofs
alone used the 3 s and the owner's placement expired). The Node mirror is OWNER_MAX_REQUEST_MS in
service-pair-discovery.mjs; the render emits the same 15000 for the owner request and ownerPeer.max_exchange_ms.
"""

MAX_OWNER_EXCHANGE_MS = 15000
"""Cap on ownerPeer.max_exchange_ms: both owner exchanges of one bearer resolution share this budget."""

IN_REQUEST_CHECK_SECONDS = MAX_OWNER_EXCHANGE_MS / 1000
"""Bound on each in-request freshness step (the opening refresh, session resolution and every watch refresh). Each is one
owner exchange, so it gets the exchange budget; the former 5 s cut exchanges that need about 4-8 s at live-tail latency."""

REQUEST_CLEANUP_SECONDS = IN_REQUEST_CHECK_SECONDS
"""How long close waits for an owner exchange still running in a thread before quarantining the proxy until restart. A
refresh is often in flight when a request ends; the former 1 s quarantined it although its own bound would settle it."""

BOOTSTRAP_SECONDS = 25.0
"""Cap and default for one request's bearer/ENI bootstrap: the exchange budget plus the runner ENI read, with margin.
A bootstrap that overruns it still quarantines the proxy."""
