# Private SDK fixture mTLS ingress

`createFixtureIngress` is an inert, source-only transport. Trusted composition
supplies `{ bind, tls: { cert, key, clientCa }, limits, resolveCredential,
handlers, now }` and calls `start()` and `close()` on the returned handle.
Importing or constructing it does not bind a socket or load credentials.
The only route is `POST /v1/qualification/sdk-fixture/interruption` over TLS 1.3
with a verified client certificate.

The resolver receives `{ fingerprintSha256, operation, signal }`, where the
fingerprint is derived from the authenticated socket certificate. It returns
`{ peer, context, producer, audience }` or `null`. For authorization, the
presented context must equal either the original `producer` or the bound
current `context`; commit requires `producer`, and load/verify require
`context`. In every case the presented context must also occur in `audience`.
The two trusted contexts must share the same run, namespace, clock, pins and
canonical actor lineage. This does not prove which grant is currently active.
This is a credential binding check on data, not a currentness decision. The
resolver must be backed by trusted authority; the transport has no fallback.

Exactly four injected handlers are required. Each receives `{ peer, context,
producer, operation, request, nowMs, signal }`. The request is canonical decoded
data. The handler must compose the durable fixture registry for current
grant, fence, expiry, stale-binding decisions and atomic publication, plus
real immutable object-store readback. The transport validates a successful
response against the private contract before sending canonical UTF-8.
Unknown credentials, failures and timeouts produce bodyless HTTP refusals;
none is a protocol stale-binding denial.

The raw request and response ceilings are 50 MiB. `bodyMs` and `handlerMs`
default to 30 seconds each and their sum cannot exceed 60 seconds. The latter
is one post-body deadline across credential resolution and handler dispatch.
Abort signals are cooperative: a timed out or disconnected peer stops waiting
and closes the connection, but this does not prove downstream work stopped.
The owner must supervise and clean up downstream work separately.

Test certificates are synthetic and ignored by Git. From the repository root,
run `apps/control/qualification-sdk-fixture/ingress/test/generate-certs.ps1`
once, then run the pinned Node 24 test file
`apps/control/qualification-sdk-fixture/ingress/test/ingress.test.mjs`.
The generator refuses to overwrite existing certificates. Its `-OutputDirectory`
argument permits a separate generation check. No test certificate is a live
admission credential or durable evidence.
