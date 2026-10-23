"""Time budgets for one proxied model request.

A request resolves its bearer with two owner exchanges (placement read, then admission read) under one exchange
budget, and each exchange proves the service pair four times (proxy and owner, before and after). Live ECS/EC2
latency made the original 3 s exchange and 5 s bootstrap impossible (20 Oct, attempt 2: the first two pair proofs
alone used the 3 s and the owner's placement expired). The Node mirror is OWNER_MAX_REQUEST_MS in
service-pair-discovery.mjs; the render emits the same 15000 for the owner request and ownerPeer.max_exchange_ms.
"""

MAX_OWNER_EXCHANGE_MS = 15000
"""Cap on ownerPeer.max_exchange_ms: both owner exchanges of one bearer resolution share this budget."""

OWNER_CARRIER_WAIT_MS = 10000
"""Bound on waiting for a free owner carrier (one pinned TLS connection). Waiting sends nothing, so it is never part of an
exchange's own budget: the exchange clock starts once the carrier is held, and an expired wait is a plain refusal
(OWNER_CARRIER_BUSY) that never poisons the host gate."""

MIN_OWNER_EXCHANGE_MS = 8000
"""After waiting for its carrier, an exchange whose caller deadline leaves less than this (or than the exchange budget, if
smaller) is refused before sending: an exchange needs about 4-8 s at live-tail latency, and one started without that room
would overrun and poison. A carrier that was free at once never applies this rule."""

IN_REQUEST_CHECK_SECONDS = (OWNER_CARRIER_WAIT_MS + MAX_OWNER_EXCHANGE_MS) / 1000 + 1
"""Bound on each owner step at a request's start (its one admission and session resolution). Each is one owner exchange
that may first wait for its carrier, so it gets the carrier wait plus the exchange budget and a second of margin; a shorter
bound would cut a read that is still within its own limits and leave it running in its thread."""

REQUEST_CLEANUP_SECONDS = IN_REQUEST_CHECK_SECONDS
"""How long close waits for an owner exchange still running in a thread before quarantining the proxy until restart; close
must outlast the bound that exchange is still inside."""

BOOTSTRAP_SECONDS = 25.0 + OWNER_CARRIER_WAIT_MS / 1000
"""Cap and default for one request's bearer/ENI bootstrap: the exchange budget plus the runner ENI read, with margin, plus one
carrier wait for its placement read. A bootstrap that overruns it still quarantines the proxy."""


# P2 background proof/admission budgets. P1 will absorb these into its canonical
# rendered table; no request-path deadline or provider budget is changed here.
PAIR_LEASE_TTL_MS = 30000
PAIR_RENEW_MS = 10000
PAIR_RENEW_JITTER_MS = 1000
PAIR_REPROOF_MS = 30000
PAIR_REPROOFS_PER_10_MIN = 3
PAIR_REPROOF_WINDOW_MS = 10 * 60 * 1000
CARRIER_RESETS_PER_MIN = 3
CARRIER_RESET_WINDOW_MS = 60 * 1000
PAIR_RENEWER_QUARANTINE_COOLDOWN_MS = 30000
assert PAIR_LEASE_TTL_MS >= 2 * PAIR_RENEW_MS
