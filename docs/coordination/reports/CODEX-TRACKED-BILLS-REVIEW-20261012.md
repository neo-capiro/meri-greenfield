# Independent tracked-bills source review

**ACCEPT_SOURCE** for `e020f4ff2af3c23412adf2fd634f8362140eeb51` on exact base `a3e946c1fa264ae7b33205f5b87804ee1ef75773`. This decision covers the new private `search_tracked_bills` family only. Source connectivity and runtime remain **HOLD**; no registry, loader, adapter or context producer was implemented or enabled by this lane.

Exact replay passes **53/53** local checks: **26 independent + 27 author**. The immutable source/provenance audit passes **81/81**; all **6,110** original files are byte-identical and **6/6** pinned Capiro reference pairs are unchanged. Criteria were frozen at `8abfc0531e38bc8fa15d95aa6fff4eaf95d14afa`, initial24 controls at `bcd0d6b6115b49b873047744b38c4abce604bc62`, and final26 at `946faec` before exact source replay. Every initial assertion remains as an unchanged prefix; two additional controls cover observable postvalidation mutation and authority limits.

## Scope and behavior

The schema is `urn:meri:retrieval:tracked-bills:0.2.0`. `createTrackedBillsValidators({validateShape,assertSubject,canonicalSha256})` supplies `normalizeTrackedBillsInput` and `assertTrackedBillsResult`. The existing canonical JSON admission and subject/hash functions remain their owners; no parallel resolver, authorization engine, store, query or runtime was added.

The root-approved new Meri context is exactly `{binding,subject,clientReference}`. The required model selector is trimmed and clipped at 80 UTF-16 units, then compared with the original reference asserted by the trusted resolver. A UUID selector must additionally match the one-client subject UUID case-insensitively. Name resolution and source collation are not reproduced. The new request transport ceiling of 16,384 Unicode code points is distinct from the producer's 80-UTF-16 normalized reference and is disclosed as a Meri admission bound.

The new private result wrapper is `{binding,subject,data}`; binding and subject must match the supplied context exactly. These are new Meri correlation fields, not legacy producer fields or proof of authority. Raw data remains `{tool,generatedAt,clientId,total,bills}`. `total` must equal the returned tracking array length; no corpus, legislative-relevance or completeness claim follows. A 75-row independent positive control proves there is no invented50 cap or silent truncation. Canonical JSON resource ceilings can refuse an oversized response as a whole.

Rows preserve `id,billId,note,createdAt,bill`. Tracking UUID primary-key and per-client bill uniqueness derive from the actual model. Creation timestamps descend, with ties permitted. This is tracking chronology, not legislative action chronology. A nullable linked global bill does not erase its tracking row or prove that the legislative bill is absent.

A non-null global bill carries all nine projected fields: identifier, title, latestActionDate, latestActionText, status, actionTexts, sponsorName, sponsorParty and subjectNames. Its identifier equals the tracking billId without a guessed federal-ID grammar. Stored nullable/empty text and unknown statuses remain unchanged. Title and action/subject arrays have no new source-specific cap, uniqueness or ordering claim. SQL latestActionDate is nullable midnight wire data; outer timestamps permit time of day. Canonical date serialization is a deliberate typed transport boundary, not proof that every database date representation is supported.

## Pinned source and current authority limits

The [reference manifest](../../qualification/candidates/read-continuation-20261012/tracked-bills-review/reference-identities.json) binds exact `fd8765ec01d292013758606204f2c9d886cd31c1` and observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. Wrapper8480–8491, visibility9789–9829, owner4407–4472, TrackedBill/CongressBill/CongressBillAction/Client models and HTTP guard metadata were inspected independently. [Projection findings](../../qualification/candidates/read-continuation-20261012/tracked-bills-review/projection-findings.json) retain derived behavior and locators, never private implementation bodies. No Capiro source was imported or executed.

The source helper resolves a tenant-scoped UUID or case-insensitive client name and excludes archived clients. Its inspected predicates contain no actor/client-wall check. Tracking rows use tenant/client scope; enrichment reads globally stored congressional records. The controller declares `standard_user` through RolesGuard and a configuration-dependent service-secret guard on tool HTTP entry.

The new trusted context producer remains disconnected. Canonical subject validation checks structural lineage; it does not prove current membership, client visibility, scope-resource authorization, source entitlement or release authority. An explicit positive control preserves this limitation: a shape-valid subject with a different scope resource is not treated as a demonstrated live grant. No new policy predicate was silently introduced. Actual scoped resolution, fresh authorization, SQL/RLS behavior, result release and source connectivity remain unqualified.

All original public0.1 contracts, private shared schemas, registry/catalog, tests, locks, gateway, migrations, native/runtime paths and capability ledger are preserved. R2's SDK loop, Temporal ownership and state placement are unchanged. Root owns later integration; this family acceptance does not advance a runtime gate.

## Failure and repair sequence

- Initial independent run: **23 PASS / 1 FAIL**. The validator admitted and checked a detached snapshot but returned the caller's original object. New-Meri source preimages and identical before/after hashes are retained.
- An additional observable control reproduced **23 PASS / 2 FAIL**: mutating the original client's UUID after validation also changed the returned accepted client. This establishes a real alias consequence, beyond merely asserting object identity. The same failed source hashes and both raw stdout/stderr captures are preserved.
- The author separately reproduced the defect with **26 PASS / 1 FAIL** after its initial26 positives, then changed only the returned value to the validated snapshot. The former author return-identity assertion was explicitly corrected to detached/deep equality; validation and source correlations were not relaxed. All independent controls remain unchanged.
- Exact source replay: **53 PASS / 0 FAIL**, followed by the **81-check** source/preservation audit. No broad/public suite was run in this lane.

The Linux subreaper captured and physically reaped only owned process groups: **237153** initial tests, **237486** observable mutation tests, **244873** exact final tests and **245057** initial audit. Each was absent after completion, with no timeout or kill needed. This demonstrates local test cleanup, not physical native-task teardown or database cancellation.

Seven existing small dependency packages were copied and verified against the donor package data and unchanged exact root lock. No package install, lifecycle hook, network fetch or donor mutation occurred. No SQL, database connection, native fixture, service, provider, paid model, cloud, customer-data, frontend or private implementation execution occurred.

Repeat focused checks from this worktree:

```sh
node --test packages/contracts/test/retrieval-tracked-bills-independent.test.mjs packages/contracts/test/retrieval-tracked-bills.test.mjs
```

For evidence capture, use the allocated `capture-reaped.py` with a fresh write-once label. The optional `MERI_TRACKED_REVIEW_SOURCE_ROOT` override was used only for prefreeze characterization; exact replay used the immutable candidate merged locally with no override. Author metadata and final packet hashes are bound in the closeout below.
