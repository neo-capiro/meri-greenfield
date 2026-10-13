# Public action receiving contract — ACCEPT_SOURCE

The frontend receiving boundary is available as `@capiro/meri-contracts` **0.1.1**, export `@capiro/meri-contracts/action-application`. Exact implementation is `3a6e3391b8fb3bb8113496c897f997683a27da2d`; independent review is `36e0a33922317715333a25d1731c52f5b265959a`, author packet `fcd5595e2b3fef94996ed8ae00353fd762725662`. Root tested integrated commit `2077d0177a81caae213a6bb7a434cc00008a5c77` with zero product-source diff. This draft successor is based on PR42 `f1df1bc20b8f5ef06495c50d885b18ce2af73eb1`; it has no host-composition or frontend source dependency beyond that accepted application wire.

Use the exact retained [public tarball](../../qualification/candidates/action-wire-20261013/integration/capiro-meri-contracts-0.1.1.tgz), or run `npm pack ./packages/contracts --ignore-scripts` from the frozen checkout. It contains 15 public distribution files, 175627 bytes, SHA256 `0ca8d0552a2960157ebdf7b8cecf6cacdcda48ef91c475060a54f15192535651`. Author, independent reviewer and root produced the same bytes. Both author and reviewer installed it in isolated consumers and checked the exported runtime and strict TypeScript types. It was not published to an npm registry.

```ts
import { receiveActionResponse } from '@capiro/meri-contracts/action-application';
const received = await receiveActionResponse('query', response.status, await response.text());
if ('error' in received) {
  // Preserve the returned uncertainty; no inferred rollback or retry permission.
} else {
  // Query results are recommendations with acceptedTasks:false.
}
```

The route parameter is `query | draft | prepare | execute`. Exported types include `ActionRoute`, `ActionResponse`, `ActionResponseMap`, `ActionQueryResponse`, `ActionDraftResponse`, `ActionPrepareResponse`, `ActionExecuteResponse` and `ActionErrorResponse`. A valid non200 canonical error envelope returns its typed body. Invalid JSON, shape, hash, correlation, route or status throws `ActionResponseError`. Pass primitive text, not `Response.json()` or arbitrary objects. Parsed results are detached and deeply frozen. Browser WebCrypto in a secure context and TextEncoder are required. Text is bounded to16MiB UTF-8, depth64 and100000 parsed nodes.

The receiver checks exact envelopes and canonical nested definitions, query/draft/command hashes and available internal correlations. It accepts canonical event sequence gaps and original-A/current-B preparation recovery. Shape or hash agreement authenticates neither transport nor current access. Preparation remains `approval_required`. Execute does not carry the original proposal: the consumer retains and separately correlates the originating immutable proposal/command. Receipt shape and uncertainty never grant approval, source authority or retry permission. No approval issuer, execution function, credential helper or private runtime import is exported.

Root integrated checks passed **80/80**: original public7, new author29 and independent44, plus both deterministic generators and old/new/independent strict types. Root offline pack passed; root audit passed87 checks. The independent suite additionally exercised actual application outputs, browser VM isolation and isolated public-only consumption. Root groups464704 and465114 exited, with four successful esbuild descendants reaped and no forced kill. Evidence under `action-wire-20261013/{author,review,integration}` retains initial generator/setup/npm-cache failures and the nonconsecutive-event preimage; none were replaced by passing output. Root cleanup is separately recorded.

The original public0.1 schema and all original generated root/browser artifacts and tests are unchanged. Among PR42's10563 original tree entries,10560 are unchanged; only the approved package manifest, package-local lock root version and appended README differ. The distribution version0.1.1 does not change embedded public wire0.1.0 or private0.2 owners. The new receiving schema has its own initial ID `urn:meri:action-application:0.1.0`. Generation follows canonical definitions at build time, and publishes only the receiving projection.

No shared frontend source, production descriptor, native evidence, cloud resource or customer data changed. No provider/model call, deployment, image operation, main merge or runtime activation occurred. G1 remains OPEN, G2–G7 unentered. Current runtime/security/durable identity approvals remain separate; source acceptance is not runtime acceptance. Frontend integration owner installs the frozen artifact in its isolated branch. Root will attach the exact publication and handoff receipt after draft creation.
