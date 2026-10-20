# Integrated source release manifest — 18 October 2026

Status: **source candidate, held for successor review and release qualification**. This
manifest records immutable repository commits and their dependencies. It is not an
image, migration, deployment, or production activation instruction. The separate
[deployment packet](DEPLOYMENT-PACKET-20261018.md) remains a draft with older
Meri/Core/frontend source placeholders and must be re-pinned after the final source
freeze. No capability is silently removed to make this candidate appear ready.

## Implementation outline and ownership

The Meri manifest branch starts at the accepted [PR179](https://github.com/neo-capiro/meri-greenfield/pull/179)
source head and fast-forwards to the first published [PR180](https://github.com/neo-capiro/meri-greenfield/pull/180)
audit successor. Those two commits are parent and child, so no patch replay or shared
file conflict is involved. A later PR180 fence commit was examined but is held
for its owner's repair of a reproducible pool starvation path. This branch adds
only this manifest after the safe receipt.
The Meri receiving branch, PR175 first-chat branch, frontend PR97/PR98 branches,
and Core PR96 branch retain their own owners; this document does not move code
between repositories or change their feature, schema, image, or render inputs.

The following pins were read from published commits on 18 October 2026.
"Received on this manifest branch" applies only to Meri code in this branch;
PR185's distinct source receipt is scoped to its own branch. Frontend and Core
are separate repositories and remain referenced source candidates.

| Repository and scope | Immutable source pin | Relationship and disposition |
| --- | --- | --- |
| `neo-capiro/meri-greenfield` [PR179](https://github.com/neo-capiro/meri-greenfield/pull/179), integrated A8, Florida, first chat, memory, and seven audit repairs | `141f2ada6378382f2bf7462d8a2c5dc7758230d0` | Accepted Meri receiving base, descended from `main` `8b123bea4c90794dc2d766814b6ddbdbfe0928bc`. |
| `neo-capiro/meri-greenfield` [PR180](https://github.com/neo-capiro/meri-greenfield/pull/180), first audit follow-up | `7e4e75828abcd870137ea8f72ff5fbea08fa25a6` | Parent is exact PR179 pin above; received by fast-forward on this manifest branch. Closes the awaited history-membership and rapid-successor gaps. |
| `neo-capiro/meri-greenfield` [PR180](https://github.com/neo-capiro/meri-greenfield/pull/180), later retention fence/evidence candidate | `a1876afaeaa59d9da47729487d490cba8cfc9d9c` | **Not received** here. The source fence is direct child `1aa5c66e9283024e78ad6f26f5450cbc61a37659`; this head adds evidence/docs only. A finite PostgreSQL pool can starve while the fence holds a lease and a nested retention read requests another. |
| `neo-capiro/meri-greenfield` [PR181](https://github.com/neo-capiro/meri-greenfield/pull/181), held-lease retention follow-up | `a50ce248337f3ce1ab7103e045bb8ab826ca92dc` | Draft direct child of PR180 `a1876afa`; **not received** here. Focused finite-pool source repair is published for review. Real PostgreSQL qualification and the separate consistent Core authorization decision remain open. |
| `neo-capiro/meri-greenfield` [PR182](https://github.com/neo-capiro/meri-greenfield/pull/182), control private-origin CA trust | `58b13b1644726bb307ea3e58461c7c0a970215f9` | Draft direct child of frozen PR175 `993f52a9`; independent source review GO. Cherry-picked into PR185 as `8753a2fb`; **not received on this manifest branch**. Live trust behavior and image qualification remain open. |
| `neo-capiro/meri-greenfield` [PR183](https://github.com/neo-capiro/meri-greenfield/pull/183), native usage stream counts | `b51687d4dadbb8cbf8ee817490e5f95c01e60d54` | Draft successor based on PR180 `a1876afa` through its first commit `97906eb5`; **not received** here. Optional terminal metrics correction and offline regression source candidate, pending review. Exact live Sonnet 4.6 stream/cache behavior and image qualification remain open. |
| `neo-capiro/meri-greenfield` [PR184](https://github.com/neo-capiro/meri-greenfield/pull/184), first-chat SDK model alias | `6be3e4abccebb5da56092572ccb0feddaf514d0e` | Draft direct child of PR180 `a1876afa`; **not received** here. Standalone renderer/runtime measurement source candidate, also cherry-picked into PR185 as `2bc282d8`. The checked-in image receipt is stale; no image qualification is implied. |
| `neo-capiro/meri-greenfield` [PR185](https://github.com/neo-capiro/meri-greenfield/pull/185), combined control CA and model alias source | `67a7bfbc7df47f326e4287de8df7f0f59b110b8c` | Draft based on PR180 `a1876afa`; source received **only on PR185's separate branch**. Exact PR182 and PR184 patches are cherry-picked as `8753a2fb` and `2bc282d8`; `85e71366` and this docs-only child record the receipt and its diagnostic scope. **Not received on this manifest branch or the final Meri receiving tree**; review and qualification remain open. |
| `neo-capiro/meri-greenfield` document-executor image lane, [PR121 handoff](https://github.com/neo-capiro/meri-greenfield/pull/121) | `d2f054362521f622b9dd63c65ef5eaa3bdde8d5a` | Separate successor to lane I `94b692648c47fd509e62a621cc5b612e0d356ed3`; **not received** in PR179/PR180 or this manifest branch. The final Meri source must receive its owned image/package/wheel closure before image qualification. |
| `neo-capiro/capiro-frontend` [PR97](https://github.com/neo-capiro/capiro-frontend/pull/97), receiving Meri, Modules/Settings, Portfolio, and Portfolio Core source | `d9959a9cee267365d1f13a72351802a66c6dbfe2` | Open receiving candidate against frontend `main` `02c02d95bdf3949662b9123f425271c6491ffdab`. This head is a documentation-only child of the reviewed code pin `a0a542d5eff162bef572564ff0397e460d74ed77`; not a Meri-tree merge. |
| `neo-capiro/capiro-frontend` [PR98](https://github.com/neo-capiro/capiro-frontend/pull/98), session renewal and cross-run composer guard | `5c784e3e46114816ba57db17ad7a2c2013a8d81a` | Reviewed frontend source candidate, **not received** by PR97. Its first commit starts at exact PR97 code pin `a0a542d5eff162bef572564ff0397e460d74ed77`; the cross-run guard is in its second code commit `d626bb080d7774ba5fc8167661d21893d9f1e3c8`, and this head adds docs/evidence. The branches diverge only by PR97's later documentation commit. Frontend owner receipt and release qualification remain pending. |
| `neo-capiro/capiro-backend` [PR96](https://github.com/neo-capiro/capiro-backend/pull/96), Core plus Directory receiving source | `784b1c3a91eb6d78f16d92c42e71f05c12c5b5bb` (tree `93b41a8cb736a8276fcb32182c1e07e601e4b417`) | Open draft against that repository's default `backend-import` `c76f5fc0df6688743afeec274211afd2e67fe8f1`; source only. |

The frontend PR97 lineage includes Meri desktop [PR92](https://github.com/neo-capiro/capiro-frontend/pull/92)
`271a267da93aa952a89b208d1f42eed0ffb080c2`, Modules/Settings
[PR94](https://github.com/neo-capiro/capiro-frontend/pull/94)
`e1de3f1d41f508629a79c198a21b71103e17c245`, Portfolio desktop
[PR95](https://github.com/neo-capiro/capiro-frontend/pull/95)
`88088d9ca86dc9c2f8ea9b2e42507348ca7652b1`, and Portfolio Core
[PR96](https://github.com/neo-capiro/capiro-frontend/pull/96)
`45528667db95f805660d2ded5f7a20b5c91c909b`. These four commits are
ancestors of PR97, not additional cherry-picks. The frontend PR96 and backend
PR96 numbers name different repositories.

The published frontend PR97 and PR98 heads were checked again before this
manifest update. PR97's sole new commit after `a0a542d5` changes only
`docs/coordination/reports/CODEX-THREE-REPO-SOURCE-PIN-AND-NON-MERI-PREVIEW-20261018.md`.
The comparison from current PR97 head to PR98 reports one commit behind and
three ahead, with `a0a542d5` as their common parent. The independent frontend
review returned GO for PR98's source candidate with 35 extracted-source
assertions. This records a reviewed source pin; the PR97 receiving owner still
has to incorporate and verify the PR98 commits while retaining its newer
documentation before the frontend source can be frozen.

Core PR96 includes the guarded Core and Directory lineage documented in its
[source candidate](https://github.com/neo-capiro/capiro-backend/blob/784b1c3a91eb6d78f16d92c42e71f05c12c5b5bb/docs/integration/CORE-INTEGRATED-SOURCE-CANDIDATE-20261018.md).
It carries the accepted Core PR84–95 work in that receiving DAG; its Stage 1
`090000` migration is payload preserving, while `100000` remains held. Its
[deployment source packet](https://github.com/neo-capiro/capiro-backend/blob/784b1c3a91eb6d78f16d92c42e71f05c12c5b5bb/docs/integration/CORE-DEPLOYMENT-SOURCE-PACKET-20261018.md)
is not a qualified image or live route readback.

Meri first-chat [PR175](https://github.com/neo-capiro/meri-greenfield/pull/175)
remains the frozen first-chat shipping source at
`993f52a97e5d9edcf65c9f89423c097aa52831c7`. Its accepted changes are
also represented in the later PR179 ancestry, as recorded by the
[receiving report](MAIN-RECEIVING-SOURCE-20261018.md). This manifest branch
does not alter PR175 or imply that its earlier image ships the later source.

## Receipt evidence and remaining source work

The received PR180 commit changes 19 Meri paths: seven production `.mjs` files,
related tests and fixtures, two generated metadata files, and its
[audit report](AUDIT-REPAIR-REVIEW-20261018.md). The received source diff contains no
Dockerfile, dependency lock, feature selection, allocation, migration, render,
or deployment edits. Its generated metadata changes source fingerprints and
byte counts, without a wire-version change. The owner reports **585/585 focused
backend tests** passing. The Meri receiving report records **374/374 focused
post-audit tests** for its earlier seven fixes. These are local source/fixture
results, not release qualification.

The later PR180 fence commit changes another 14 paths. Its three directly
affected test files passed **85/85** locally (retention release fence and product
effect/release 30, history HTTP 55), but the tests do not model a finite pool.
Using a disposable one-connection scripted PostgreSQL pool, `withRelease` held
the only lease while its callback's `assertServable` requested a second. The
request timed out as `RETENTION_READ_UNAVAILABLE` after 81 ms, with two checkout
attempts and one queued. Production composes the journal and watermark against
the same pool; at pool size N, N concurrent pages can reproduce this wait.
The relevant path is `postgres-journal.mjs` `withServing` → history release →
retention gate → watermarked read → `postgres-watermark.mjs` → `journal.tx`.
This is source-only synthetic evidence of a release blocker, not a live outage.
PR180's later evidence commit documents its own source tests and inherited
baseline; it does not change the nested lease behavior. Draft PR181 publishes a
held-lease repair and reports **112/112 focused source checks**. Review remains
before receipt; real PostgreSQL qualification remains before release acceptance.

The separate native source candidates branch from exact PR180 `a1876afa` and
have not been combined with PR181 or this manifest's Meri code. PR183 reports
**62/62 focused credential-free Python checks** of terminal usage, response
settlement, host observation/composition, and callback behavior. Its parser
requires a bound `message_start` input count, final cumulative `message_delta`
output count, terminal stop, and complete stream EOF. Bedrock stop invocation
metrics are optional; if present, their input/output/latency shape is checked
against the bound counts. Malformed, conflicting, or unexpected raw stop usage
remains `UNKNOWN`. Optional cache counts can only be zero; exact live Sonnet 4.6
stream and cache billing behavior remain unqualified. The full upstream LiteLLM
streaming test did not run because its local environment lacked FastAPI; no
provider stream was observed. PR184 reports **8/8 runtime-values tests**,
**1/1 pinned-SDK/CLI local HTTPS stand-in flow**, and **8/8 native-auth tests**.
The stand-in used a
synthetic token and no provider call. Its runtime test used a synthetic image
digest; the existing N21 receipt remains stale. The SDK-facing alias is aligned
with the fixed native/proxy allowlist while the provider profile and pricing
stay pinned. Both drafts require review
and ancestry/overlap checks before receipt. Neither qualifies an image,
provider behavior, live auth, or first-chat activation.

PR182 is an independent source-GO control trust candidate based on frozen PR175;
its parent repairs were already replayed into the PR180 receiving line. PR185
starts at exact PR180 `a1876afa` and receives the PR182 and PR184 patches on a
separate branch. Both cherry-picks have the same stable patch IDs as their
respective source commits. Their shared `render-material.mjs` changes composed
without a manual conflict: the control task binds the composite CA bundle,
while first-chat SDK options select the fixed authorized model alias. The
Bedrock profile, provider mapping, pricing, native allowlist, and other feature
rendering remain pinned. This is a branch-local source receipt, not receipt by
this manifest branch or the final Meri receiving tree.

PR185 reports focused Linux evidence: new CA tests **13/13**; integrated render
and Stage 3 bindings **13/13**; runtime values and the pinned SDK local HTTPS
stand-in **9/9**; native authorization **8/8**. Host task/material checks were
**40/41** because an unchanged deadline fixture could not write this host's
`/run`. Disposable offline Linux/amd64 Node containers with writable task-like
mounts ran exact PR182 source, whose CA files match PR185's cherry-pick. These
diagnostics did not exercise the whole combined branch. The deadline fixture
passed **1/1**, and synthetic control init wrote **15 files** with owner-only
modes. The fresh-process startup readback/fetch probe stopped in the diagnostic
DNS fixture before product code, so that result is unverified. No
product Dockerfile image was built or qualified; the N21 measurement is stale,
and physical material VersionIds, live trust, first-chat activation and
deployment remain held.

The following owners must publish and review successors before a release freeze:

| Owner | Pending source or evidence |
| --- | --- |
| Meri retention/history | Review PR181's held-lease successor against PR180, including finite-pool behavior, shared/exclusive transition ordering, and real PostgreSQL lock/session behavior. The separate Core membership/currentness race still needs a consistent authorization decision before release. |
| Meri native usage and first-chat trust/model | Review PR183's standalone usage correction and PR185's branch-local CA/model source receipt while preserving PR184's standalone pin, settlement, provider and budget authorization. Remeasure source-bound image/runtime inputs after source freeze; no current receipt qualifies these drafts. |
| Frontend | Receive the independently reviewed PR98 session renewal and cross-run guard into PR97, retaining PR97's later documentation and exact request identity. PR98's owner reports 14/14 browser, 69/69 unit, TypeScript, and 283/283-page build checks; authenticated release qualification remains separate. |
| Backend audit | PR180's held evidence commit inventories the standard `npm run check` baseline (**4,357 passed, 32 failed**) and runtime/control typecheck diagnostics (**3/18**) against PR179. Resolve or explicitly disposition those red release gates without weakening assertions. |
| Core and frontend product owners | Qualify authenticated Portfolio Core behavior and complete the Modules aggregate metrics and remaining Settings contracts/design decisions. PR97 and Core PR96 are source candidates; production behavior is not inferred from ancestry. |

The separate Meri image lane retains a `linux/amd64` Wolfi/Python/wheel lock,
matching the observed ECS `X86_64` task target. The receiving tree still has
the older package lock (SHA-256 `5c7724e6c9837dabc3146256aa55b3dce2230d10de5a2ff7c479f519aafb3ac9`)
and no `runtime-wheels.lock.json` or checked-in wheel files. The lane's package
lock is SHA-256 `5dc3b335d8dc7f0377c75852c28addc1a2517bb4bcc05e2125d0e1e31a97bdea`.
Its native diagnostic image and focused generation checks therefore do not
qualify an image from this later Meri source. The frozen 15 October image-closure
candidate has stale hashes and must be regenerated from the final source. The
image owner must receive the exact lane-owned dependency closure and verify its
provenance without an ARM64 switch or accidental re-pin.

## Source receipt and release gates

1. Receive only published, reviewed successor commits on their repository's
   receiving branch after checking exact parent/ancestry, changed paths, and
   retained behavior. Update this manifest to their new full commit IDs. Do not
   replay PR98 in Meri or PR180 in frontend/Core.
2. Keep source findings separate from release evidence. PR180's received report
   records the broader 32 failing checks and 3/18 type diagnostics; the frontend and Core
   source reports identify their own open qualification. Resolve or explicitly
   disposition these before calling any integrated test gate green.
3. Receive the separate Meri image lane's owned Dockerfile, package lock,
   wheel lock/artifacts, and architecture verifier with their exact hashes;
   preserve the current owners of CLI, control, config, and render. Freeze exact
   Meri, frontend, and Core commits together. Rebuild and measure the Meri image
   from that final Meri commit for actual `linux/amd64`, then
   record immutable image digests, scan, source-bound config/render, and
   authenticated readbacks. Core and frontend require their own exact image
   and deployment evidence. Update the draft deployment packet's older `TBD`,
   Core #86, and frontend #92 references at that time.
4. Keep migrations, retained operations, memory, document reads, Portfolio
   dependencies, and production traffic behind their existing activation
   gates. The Core Stage 1 migration needs role/target preflight; held Stage 2
   is not authorized by this manifest. The Meri image, generated closure,
   configuration and active selection remain unqualified.

There has been no main merge, AWS build or deploy, live SQL, IAM change, secret
change, or traffic activation as part of this source receipt.
