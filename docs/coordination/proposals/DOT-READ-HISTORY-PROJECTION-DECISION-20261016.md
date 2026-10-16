# Read-history and citation projection decision candidate

**PROPOSAL FOR PARENT CONTRACT DECISION.** No frozen contract, event, journal implementation, migration or runtime activation is changed. Inputs: package four `eca78d458acb46cbfd54a94cf870841d999ef6b1`; READS candidate `922c07778c482419871e992e776d00351ed86f79` and its `DOT-READS-CONTRACT-REQUESTS-20261016.md` R-READ-2; published core/artifact reviews `2e8419a0766476b41e63a03364f21cad3c65eee4`. The parent's passive-design acceptance of READS does not qualify the 18 constructible operation references as live tools; exact tests/negative controls/typechecks and ordinary runtime composition remain HOLD.

## Recommended contract decision

**Project read history from the existing canonical durable tool-invocation journal. Do not create another execution/receipt journal.** Use a current-authorized paged control read first; do not add an unsupported event to UIEvent0.1.0. A later separately reviewed event may invalidate that read by reference only. A worker receipt, historical grant, model statement or UI cache never establishes an execution, a citation or current release authority.

Canonical state already exists in `meri_product_budget.tool_invocations` (product-budget0001), with the equivalent qualification fixture namespace. The trusted `createToolInvocationOwner` owns preparation, reservation association, completion identity and durable accounting. The ordinary `createDurableToolDispatch.executeOwned` and `createCurrentToolAuthority` remain the execution/current-authority owners. The history reader must not call execute, prepare, reserve, reconcile or settle. Existing `reconcile` can change UNKNOWN accounting, so it is not a read API.

The existing `readCompletion` is a current-allocation/expiry-bound lease operation, not a historical UI read. Do not reuse it after expiry or weaken its original deadline. Introduce a bounded metadata-read method on the same canonical journal owner, called only behind the conversation/current-source read authority, which cannot issue grants, revive writers or mutate accounting.

## Persistence gap and proposed same-owner amendment

At the pinned source the journal stores raw request digest, normalized argument digest and completion result digest/bytes, plus immutable delivery/facts and operation. It does **not** durably retain all worker receipt/citation fields:

- Worker `argumentsSha256` hashes submitted arguments only.
- Journal `raw_request_sha256` hashes `{operation,arguments}`; it cannot be substituted for the submitted-argument hash or used to recover it.
- Journal `arguments_sha256` is the separately normalized canonical argument hash.
- Worker receipts remain process-local. Subject wrappers may carry decision/policy, but that is not a guaranteed durable projection.
- Journal completion currently has a closed marker. Arbitrarily adding fields to it breaks its exact equality check.

Propose an immutable, typed **read-projection metadata field on the existing invocation row**, with its own canonical hash and version, under the existing transaction/claim owner. This is an amendment of the canonical journal, not a new receipt table/index. Do not modify the closed completion marker in place. A schema amendment needs a separate collision-checked source allocation; **no new migration number is assigned here**, and product-budget0002 is not reused or edited.

The trusted dispatch/typed source owner must capture the projection from canonical normalized arguments, current decision, exact measured installation/catalog and admitted result/evidence, before releasing the result. Use the existing trusted retention hook/transaction composition; the worker cannot submit a self-attested history receipt. The immutable projection references the same invocation, reservation and result digest. A reader exposes it only when the canonical completion marker and accounting are SETTLED and all referenced identities/digests agree. Missing metadata, PENDING/UNKNOWN accounting, ACK uncertainty or mismatch stays explicitly unavailable; never redispatch to fill history. A lost projection ACK is recovered by exact row readback through the canonical owner, never a second write with new identity. Failed writes must not become empty successful history or fabricated citation links.

Legacy invocations without the projection remain recognizable as legacy/incomplete metadata; do not backfill source content from the model transcript or current source values. Durable failures/UNKNOWN may be shown only through an independently scoped accounting-status projection and must never appear as successful read evidence.

## Closed proposed payload and correlation

Proposed local version: `meri.read-history/0.1-proposal` (not a modification or freeze of public0.1.0). Each successful receipt contains exactly:

```text
{
  version: 'meri.read-history/0.1-proposal',
  receiptId: Sha256,
  binding: RunBinding,
  deliveryId: string,
  invocationId: string,
  reservationId: uuid,
  producerKeySha256: Sha256,
  operation: {id: string, version: string},
  rawRequestSha256: Sha256,
  submittedArgumentsSha256: Sha256,
  normalizedArgumentsSha256: Sha256,
  resultSha256: Sha256,
  executionCatalogSha256: Sha256,
  executionDecision: {decisionId: uuid, policyRevision: string},
  createdAt: UTCDateTime,
  evidenceStatus: 'bound' | 'unavailable',
  evidence: SourceEvidence[],
  receiptSha256: Sha256
}
```

All keys are required; unknown keys refuse. Digests are lowercase64-hex. `binding`, `Scope`, `SourceEvidence` and operation identity reuse their existing canonical validators/types; no copied authority model. `receiptId = canonicalSha256({binding,deliveryId,invocationId,producerKeySha256})`. `receiptSha256` hashes the entire closed receipt except that field. `createdAt` is the journal's trusted immutable preparation time, **not** invented completion time. Deduplicate by receiptId and refuse any same identity/different payload hash.

`SourceEvidence` already carries sourceId, recordId, sourceVersionId, observedAt, sourceUpdatedAt, citationId, scopes, contentSha256 and authorizationDecisionId. Reuse these exact immutable identities; do not fabricate source versions or locators for families that do not produce them. A canonical `(sourceId,recordId,sourceVersionId)` resolves the source locator through its existing source owner; no raw URL, blob path, token or new locator vocabulary crosses this projection. Evidence arrays are capped at128; metadata page serialization is capped at256KiB. Over-bound or unverifiable evidence yields explicit unavailable projection, never silent truncation represented as complete.

For `evidenceStatus:'unavailable'`, evidence is empty and the UI cannot render citations. For `bound`, all entries validate, at least one exists, and the trusted typed result producer has established their relationship to this exact invocation/result hash. Hash agreement alone is insufficient if the producer cannot establish that relationship. No raw arguments, tool result, excerpt, credential, untrusted label or caller-supplied authority is stored or returned. Display names derive from the current canonical operation registry.

Citation selection is the tuple `{receiptId,receiptSha256,citationId}`. The current-authorized citation owner resolves this tuple to the retained exact SourceEvidence and source/version/hash, then uses the canonical source read/locate port and rechecks authority after awaits. A bare citation UUID or currently updated source record is not enough. Raw content can be returned only through that source owner's separately admitted contract; this proposal adds no content fetch capability.

## Proposed control/history read and event policy

The canonical conversation host owns `readToolHistory({conversationId,runId?,after?,limit?},{signal})`; final route/export is reviewed with L3 rather than introduced by a parallel router. Proposed request: no tenant/actor/binding/grant fields; omitted limit defaults25, integer range1–100; omitted cursor means first page; explicit null and unknown keys refuse. runId, when supplied, must name an authorized historical run in this conversation. The authenticated principal and permitted history/run set are derived server-side.

Success is `{version,receipts,nextCursor}` with the closed version above. Order by immutable journal `(created_at,invocation_id)` ascending; query over the canonical authorized conversation's historical run set with bounded paging. Cursor uses the history owner's reviewed mechanism and binds conversation/filter and exact position. It is a selector, never authority. Revalidate on every page; a foreign conversation/filter/corrupt cursor refuses. No unbounded per-row scan or second durable index is silently introduced; if measured bounded execution is impossible, return the concrete indexing/DDL need to the parent for separate allocation.

Fail closed with explicit `UNAVAILABLE`, `ACCESS_DENIED`, `INVALID_ARGUMENTS`, `CURSOR_INVALID`, `DEADLINE`, `CANCELLED` or `RESULT_NOT_RELEASED`. An empty success means a completed bounded authorized query found zero visible settled receipts, not missing owner/schema/metadata, query failure, revoked source or unqualified installation. Do not reveal hidden receipt counts or cross-scope identifiers. If current authority cannot release a requested page, withhold that page rather than silently converting a revoked receipt to evidence of no activity. Cancellation/deadline/suppression after an awaited read prevents release.

Existing `run.status`/`message.delta` shapes are unchanged. Initial reload/reconnect/UI refresh calls the current-authorized read; streamed prose never becomes a citation receipt. A proposed future invalidation event may carry only `{conversationId,runId,receiptId,receiptSha256}`, and the UI still fetches current-authorized history. It requires a separately reviewed event version/schema and producer before emission; no UIEvent0.1 escape hatch or fake message-delta encoding.

## Authority, expiry and retention

Conversation membership/historical read permission is necessary but insufficient: the canonical current owner also checks tenant, actor, current client/source/subject scopes, policy, suppression and exact source-version visibility before projection and after awaits. Original receipt/evidence scopes may only be intersected/narrowed; current policy cannot retarget evidence to a different client/version. History visibility does not grant current writer eligibility, execution, source connectivity or allocation renewal. Original execution deadlines/issuance remain immutable; current read authority is independently fresh. No cached original grant or membership-only lookup can authorize result release.

Invocation rows/projection metadata, source identifiers and evidence links must join explicit conversation/receipt and subject retention mappings. Suppression withholds history/citations immediately. Approved purging may remove protected payload/locator metadata while retaining only an authorized minimal accounting/UNKNOWN tombstone; no read error becomes evidence that an effect never occurred. The held conversation0014/receipt amendments and preview design do not automatically cover product-budget invocation metadata. Exact retention mapping/privileges and a separately allocated journal amendment are prerequisites, not implied by the ten source-ID reservations. No live purge or new retention TTL is chosen.

## Proposed ownership and acceptance

One canonical invocation owner authors the journal metadata/read seam (coordinate budget owner B); READS owns trusted typed receipt/evidence extraction; L3 owns the authorized historical-run paging/transport; UI only consumes a reviewed version; retention owner A reviews mappings. These are proposed seams for parent allocation, not permission to edit each other's files. No new sessions or second implementation.

Required independent negatives: lost completion/projection ACK; concurrent/replayed delivery; process restart; page/reconnect dedup; raw-versus-normalized hash mismatch; wrong result/catalog/decision/source version; missing evidence; hidden/cross-tenant/client/actor/run; expiry and current revocation; suppression during awaits; corrupt/retargeted cursor; stale citation on updated source; PENDING/UNKNOWN/legacy projection; cancellation/size bounds. Prove zero redispatch/reservation/grant writes and unchanged canonical accounting during all history reads. Source-unit doubles are synthetic; real-engine concurrency/RLS/retention and actual SDK/UI completion remain separate gated qualification.

Parent decisions needed: accept this read-first/same-journal contract direction and exact payload semantics; allocate the canonical metadata/read seam and any required journal amendment only after its concrete DDL/retention design; settle L3's exact public export/route and current read-authority port; reserve future event schema separately if desired. The three retained Core reads remain blocked pending Engagement owner `01a141b6-e98c-7690-8369-7140722bf0d2` endpoint/DTO/trusted-context evidence. No Core route is invented here.
