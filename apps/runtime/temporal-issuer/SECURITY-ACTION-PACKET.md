# Temporal issuer source and activation packet

This subtree is a source-only issuer for the existing task-local Temporal token
writer. It does not provision a key, certificate, IAM grant, binding store,
listener, service, or Temporal namespace. No runtime entrypoint imports it until
the Meri runtime owner mounts the reviewed source.

## Frozen source interface

- `parseTemporalIssuerDeliveryConfiguration(raw)` performs no I/O. The closed
  raw shape is `{schemaVersion:1,issuerOrigin,audience:'meri-temporal',namespace:'meri',
  identity:{role,subject,workloadPrincipal},publicKey:{kid,alg:'RS256',jwkSha256,manifestFile},
  tls:{serverName,issuerCaFile,clientCertFile,clientKeyFile},requestTimeoutMs,maxReplyBytes}`.
  `issuerOrigin` is a bare HTTPS origin without `/`; the parser derives the one
  accepted writer/JWT issuer as `issuerOrigin + '/'`. The parsed object can be
  passed to the factory by object identity; a caller-supplied `issuer` field
  in raw JSON is rejected.
- `createTemporalIssuerDelivery({configuration,readMaterial?,now?,request?})`
  returns `{read,close,available}`. `read` accepts the existing writer's exact
  request and calls the fixed `POST /v1/internal/temporal/token/read` using
  client-certificate TLS with the pinned issuer CA. It verifies the response's
  pinned public RSA key, RS256 signature, exact claims, currentness and bounds.
  The existing writer requires a strict one-property port:
  `delivery:{read:issuerDelivery.read}`. The runtime owner retains and closes
  the issuer delivery separately. Closing aborts in-flight requests and reads;
  an injected reader that ignores cancellation is reported as unsettled and
  cannot release its late result or private-key buffer.
- `createTemporalIssuerService({configuration,taskAuthority,sign,publicJwk,now?})`
  returns `{handle,listen,close,available}`. `listen` requires externally
  supplied TLS key/cert/CA material and does not run during import. Public
  `GET /.well-known/jwks.json` returns the pinned public JWK. Token POST
  requires an authorized client certificate and a server-owned task mapping.
  It checks currentness before external signing and again before release.
- `createTemporalIssuerTaskAuthority({configuration,ecs,ec2,bindings,now?})`
  supplies `readCurrent`. Its AWS reader adapter uses ECS DescribeServices,
  ListTasks (service scoped, bounded exhaustive membership), DescribeTasks,
  DescribeTaskDefinition and EC2 DescribeNetworkInterfaces on every read.
  It pins task role, execution role, image digest, service, task definition,
  private VPC/subnet/security groups, authenticated peer fingerprint/CN/URI
  SAN, task ARN and revision. `bindings.readCurrent` is mandatory, is read
  before and after AWS facts, and must provide a fresh, strongly current
  certificate-to-task/revision/revocation record. Missing or ambiguous facts
  fail closed.
- `createTemporalIssuerToken` accepts an external `sign(signingInputBytes)`
  port and checks its RS256 signature against the pinned public JWK before
  release. No private key is created or loaded here.

The public-JWK SHA256 pin is the lowercase SHA256 of UTF-8
`JSON.stringify({kty:'RSA',kid,alg:'RS256',use:'sig',n,e})` in exactly that key
order. The manifest is closed `{keys:[<that exact public JWK>]}`. A rotation
that needs more than one JWKS key requires a separate reviewed protocol and
Temporal refresh plan.

## Claim and authorization boundary

Only RS256 is issued. The JWT header is `alg:'RS256',typ:'JWT',kid:<pinned>`;
the claims are exact `iss:issuerOrigin+'/'`, `aud:'meri-temporal'`, the pinned
role subject, bounded `iat/nbf/exp`, random UUID `jti`, and
`permissions:['meri:write']`. Expiry is at most 60 seconds and is clipped to
the current-task lease. The two role subjects and principals are distinct and
fixed as `meri-temporal-control:v1`/`meri-workload-control:v1` and
`meri-temporal-worker:v1`/`meri-workload-worker:v1`.

Temporal 1.32.1's default mapper requires the string-array permission shape.
`meri:write` grants **all non-admin writes** in namespace `meri`, including
termination, deletion and schedule mutation; it is not task-queue scoped.
The stock mapper verifies signature/time/audience but does not independently
pin this source's `iss`, `sub` or `jti`. These checks are enforced at the issuer
and delivery client, and the deployed Temporal JWKS/audience/default mapper
and authorizer must be qualified separately. An accepted JWT can remain usable
until its expiry after a task is revoked. The stock JWKS provider's configured
300-second refresh and system CA behavior must also be qualified; this client's
CA pin does not alter Temporal server trust.

## Held live security actions and receipts

Before mounting or activating, the designated owner must bind and privately
verify: the same HTTPS issuer origin and trailing-slash authorization issuer;
the public JWK/KID and matching **separate** external RSA signing authority;
server and per-role client mTLS chain, purpose, peer SAN and pinned file
inventory; a durable strongly current binding/revocation provider and its
read credentials; exact ECS service/task definition/image/role/VPC/private
subnet/security-group pins; the empty owner-only task-local writer volume; and
Temporal's audience, JWKS URI, default mapper/authorizer, refresh behavior and
namespace. The signer must expose only the exact RSASSA-PKCS1-v1_5 SHA-256
operation for the reviewed public key. No key or secret value belongs in Git,
chat, scan logs or qualification receipts.

Qualification must use an actual client/server TLS handshake, a live current
task and revocation read (including a stopped/standalone/mismatched task), a
real signed token accepted by the pinned Temporal server, and refusal after
revocation/expiry. It must also prove startup closes the client and fails
readiness if the issuer, writer or Temporal connection loses authority. No
source-only test is a substitute for those receipts. IAM and network changes,
key/certificate creation, image build and deployment require their own
action-time approval; this packet performs none of them.
