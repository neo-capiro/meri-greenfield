# Handoff for Github Access Blocker

11 October 2026 UTC. Neo explicitly requested that the separate session named
**Github Access Blocker** also use the AWS authentication prepared here.
This is a credential-free status handoff; it contains no authentication code,
token, credential, cache or active sign-in URL.

## Authentication status

**AWS login has not completed.** The locally installed, signature-verified
AWS CLI `2.37.12` ran remote console login for intended account
`967807252336`, region `us-east-1`, profile `meri-g1`. Token exchange failed
to connect. An unauthenticated verified-TLS request through the normal managed
network received a 195-byte `Site unavailable` HTML page at the official token
endpoint. No caller identity was verified and no AWS account API or resource
change occurred. The previously submitted one-time code must not be replayed.

No shared machine or cross-chat messaging endpoint has been established.
This chat cannot directly notify another ChatGPT session. Credentials are not
automatically shared between independent runtimes. On an AWS-capable trusted
runtime, establish a fresh local login and verify caller identity/account
before any permitted read-only qualification. Keep credential isolation,
official endpoints and TLS verification. Do not copy token/cache files into
Git, source bundles, handoff text or chat.

AWS authentication does not supply GitHub authentication. No new repository
push, remote branch, PR or merge was completed by this continuation.

## Source pickup and authority

All frontend code belongs in `neo-capiro/capiro-frontend`; Meri backend in
`neo-capiro/meri-greenfield`; existing Portfolio/Modules backends in
`neo-capiro/capirov2`. Do not move Meri UI code into the backend repository.

Newest tested backend implementation is
`72c8afa5f7854505f99ccbd569c5de8c9e6bd1d9`, extending delivered backend
`7f1d20d2c28db25948ecc02d26545645e87a3e3c`. It adds a modular trusted evidence
owner, early canonical key admission and offline exact-image scan preparation.
See `CODEX-G1-TRUSTED-COMPOSITION-ACCEPTANCE-20261011.md` for exact checks,
retained failures and live prerequisites. Later delivery commits add only docs
and evidence. The new source bundle must be imported after its exact base;
import into an isolated branch and preserve active work.

Existing source deliveries remain immutable:

- `meri-g1-source-handoff-20261011.zip`: original backend chain.
- `meri-g1-runtime-delta-20261011.zip`: backend through `7f1d20d`.
- `capiro-frontend-meri-ui-delta-20261011.zip`: independently accepted Figma Home
  corrections; final head `85e96b968a3e984407886b2e06536b20810eccef`.

Figma reference remains
https://www.figma.com/design/Zc2dEN5aLU47dVdsewDmiJ/Capiro-3.0-%E2%80%94-UI-Redesign?node-id=411-40601.
Meri/Portfolio/Modules toggles remain in the Meri shell. This continuation does
not implement Portfolio/Modules views or alter the accepted frontend source.

**G1 remains OPEN; image/build/runtime HOLD.** The old image has recorded
five critical and seventeen high findings. The current 53-member source context
has no new build authority. Real interruption/replacement/resume, stale-worker
fencing and physical cleanup remain unproved. Read-only connectivity/auth
work does not authorize cloud shipment, resource creation, production cutover
or reuse of consumed one-build approvals. Prepare a concrete reviewed source,
image/resource/IAM/network/cost/cleanup candidate and notify Neo before shipping.
