# GitHub publication and continuation checkpoint

11 October 2026 UTC. **G0 accepted; G1 OPEN; G2–G7 unentered.** This note
supersedes the GitHub-access blocker in the earlier status handoff. It changes
no image admission, deployment authority, live source connection or release
decision. Historical reports and delivered Git bundles remain available.

## Repository access and reviewed publication

The human approved the access change at action time. GitHub confirmed the
existing ChatGPT Codex Connector installation was updated for `neo-capiro`.
Only `meri-greenfield` and `capiro-frontend` were added to its selected
repositories; existing `capirov2` selection was preserved. An actual backend
branch creation succeeded after the update. No repository visibility,
protection, app permission category or account credential changed.

| Review | New publication commit | Exact reviewed tree | Original reviewed commit |
| --- | --- | --- | --- |
| [Backend draft PR #7](https://github.com/neo-capiro/meri-greenfield/pull/7) | `d0c36aaa8cf10aa63a8c50e54ef110ac4758b600` | `2735d5c3e7b8409f8084d045dc2ca8b1e60d6eba` | `32709fd72b895cdd27ebeac0ac617ed21cd6721a` |
| [Frontend draft PR #4](https://github.com/neo-capiro/capiro-frontend/pull/4) | `ad04c660a8a181aa99b4786bf51926dd4957ea3a` | `9d662c6d1090af8211a459e9ff95310242ec21da` | `85e96b968a3e984407886b2e06536b20810eccef` |

The connector publishes Git objects but cannot supply original commit metadata.
These are source-equivalent review commits, not the original local ancestry.
Complete tree identity was required before commit creation. Parents are current
backend main `8b123bea4c90794dc2d766814b6ddbdbfe0928bc` and frontend main
`02c02d95bdf3949662b9123f425271c6491ffdab`. Only the new owned review branches
were advanced, with expected-head checks and `force:false`; neither main moved.

Backend publication includes all 360 changed paths and qualification
dependencies. It restores no Portfolio frontend. The existing published
`8d045221aa314871edf214deb2c9f1800fde6b17` tree was used solely as an object
transport seed; it is not the new commit's parent or a reduced review scope.
Both binary handover files are present. Frontend publication includes all 11
changed paths and the verified PNG wordmark blob
`7e5eeae964a1ef641c2517dec7d06b82b4bce7d0`.

Original SDK/root/package/scan/visual source checks remain applicable to their
identical trees. Publication metadata is not runtime evidence. See the linked
PR descriptions and their canonical acceptance reports for actual checks,
retained failures and limits. Fresh independent Git readback is a separate
publication check, not a replacement for those tests. Independent depth-one
fetches into fresh standalone repositories passed: all 1,118 backend and 912
frontend checkout files matched the reviewed bytes, all 1,047 and 890 unique
raw blobs respectively rehashed correctly, and strict Git integrity/clean
checkout checks passed. Neither fresh repository used borrowed objects or
alternates. All 26 Git commands and both verification processes exited zero.
The [retained readback](../../qualification/candidates/github-publication-20261011/publication-readback.json)
includes the exact binary hashes and source-only limits.

## Continued implementation boundary

Two bounded source tasks now have independent source acceptance: federal-market
composition at `63fc6e0d2e0a56003f6d5f647af0bf530392be2e` and data-search
composition at `2b1f2c12938417d52aeb7f00b539d99d6e054773`. Both use the existing
specific validator factory pattern. The canonical private validator owns one
structural compiler; cohesive family modules retain normalization and domain
rules. All 17 federal and 12 data-search original domain test bodies remain
byte-identical. Only the import expectations change in their separate import
tests, with existing effect/permission assertions preserved.

Independent focused checks passed 20 federal and 16 data-search tests. Domain
algorithms, schemas, catalog, public distribution and image authority remain
unchanged. Family wrappers continue to refuse foreign definitions before
delegating structural checks. Federal paging, raw search bounds, cursor/window
rules, conditional memory and nonauthoritative client scope remain separate
domain responsibilities. Neither task enables a tool, connects a source or
accepts REL-02 as a whole. Gateway authorization and live producer serialization
still require their own qualification.

This note also corrects an earlier report's mistaken placement of 75 existing
requests in G1. The latest [resume handover](REMOTE-RESUME-CURRENT-20261011.md)
explicitly excludes that input from G1. The real-request baseline remains later
release qualification when a protected corpus exists.

## AWS and shipping boundary

GitHub access does not authenticate the AWS CLI. The official task-local CLI
login ended before credentials were established: this environment could not
reach `https://us-east-1.signin.aws.amazon.com/v1/token`. A separate unauthenticated
transport observation returned the managed `Site unavailable` response. Do not
replay the old auth code, extract browser credentials, bypass the transport
policy or disable TLS. An AWS-capable trusted execution host is required for
the next cloud phase.

The old image remains **PUBLISHED_NOT_ADMITTED**, with the recorded exact-digest
47-finding scan including 5 critical and 17 high findings. Source publication
does not fix them. Before shipping, prepare and review the supported patched
component set, complete notices/security disposition, exact fresh source and
image identity, current policy/coordination, account/resource/IAM/network
bounds, cost limit and physical cleanup plan. Old build approvals were consumed.

Runtime qualification still includes genuine trusted observer/signing isolation;
task-bound identity and short-lived proxy authentication/revocation; PostgreSQL
and immutable S3 wiring; native A interruption, durable bounded checkpoint,
positive A stop, B replacement/resume and stale-A effect denial; discovery and
durable aggregate budget; isolated browser-host sandboxes and Office acceptance.
Full product SessionStore/Temporal/source/memory/UI integration remains later
work under the existing plan. No merge, AWS shipment or production cutover is
performed by this checkpoint.
