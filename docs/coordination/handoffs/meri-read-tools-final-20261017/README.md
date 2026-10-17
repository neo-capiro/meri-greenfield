# Meri read-tools portable handoff — 2026-10-17

**SEALED SOURCE HANDOFF; IMPLEMENTATION STOPPED.** Fable becomes the single Meri source/shipping owner at seal. Dot coordinates Core/frontend and end-to-end work. This lane has cancelled its heavy-window request and has no running or queued install, compiler, build, test, native call, archive or publication worker after the final publication record. Do not resume work from this document alone. Neo requested preservation of current work, including explicitly incomplete edits, followed by safe-stop.

The primary Meri handoff is `docs/handover/20261017/fable-final/README.md` on `codex/meri-first-chat-runtime-integration-20261017`. This supplement covers the independent read stack. It does not integrate that stack into first-chat, change a shipping image or establish live installation. Primary owner thread: `01a1450f-68da-7707-a574-9ed20372c0db`; Core owner: `01a14534-418c-74f6-b593-fe3c52bb90c5`; frontend owner: `01a14534-18b7-7234-b9c6-9e34393c20e9`. The old shared read checkout and other release candidates were preserved.

## Read this first

| Layer | Final state |
| --- | --- |
| Accepted published Meri implementation | PR125, head `6968836486738cab4ba62a39e799356914cd7c85`, tree `aa31607522e34df3bca96b9e381caae0d599d398`; source **69 complete + 3 partial + 10 absent = 82** |
| Accepted SDK source policy | **71 OperationRefs / 41 families**; 43 passive constructors; selected-family private kernel 72, with held legal-reference sibling filtered out |
| This newer Meri source snapshot | **INCOMPLETE / HOLD_TESTS**: five-operation mode source, reader/native-owner/installation/SDK plumbing and explicit-client outreach-name correction; candidate policy **76/42**, constructors44, private kernel77. These are candidate source counts, not promoted acceptance |
| Separate Core mode source | Draft [PR68](https://github.com/neo-capiro/capiro-backend/pull/68), head `8d6733c38044cc45ceae60acdd09a2d837ccc197`, tree `c9a2f94fa1c750ebd9599e7840e07f737ec0d796`; **ACCEPT_SOURCE, Jest/TypeScript UNRUN** |
| Inventory/parser tooling | Full reviewed repair is LOCAL ONLY at `4081b2129c4f243eb6f41c17e064e0b96a73bc91`, tree `7832848cc0f7e7ab8a0281b6f0ed9124fdbd5b23`; exact ledger publication denied. Unaffected 65-file recovery patch is included; denied ledger payload is excluded |
| Installed / qualified / live reads claimed by this lane | **0 / 0 / 0**. No native/provider/database/model/cloud capture or deployment qualification |

The enclosing draft PR and final coordinator message provide this supplement's immutable head/tree. Its parent is the exact public PR125 commit above. The local tree-identical PR125 base was `4359e05bd11b7756d4f1d42fcd2243b3e07f126b`; that different local commit is not a remote dependency.

## Immutable accepted stack and inventory

The independent Meri stack is **this incomplete handoff -> PR125 -> PR119 -> PR118 -> PR112 -> PR110 -> PR109**. None is automatically part of ordinary first-chat shipping source.

| Checkpoint | Full published head | Tree |
| --- | --- | --- |
| [PR125](https://github.com/neo-capiro/meri-greenfield/pull/125) installation + five completions | `6968836486738cab4ba62a39e799356914cd7c85` | `aa31607522e34df3bca96b9e381caae0d599d398` |
| [PR119](https://github.com/neo-capiro/meri-greenfield/pull/119) semantic KB | `36ec54b54c8caa91c8c90f037b65ee2863d6c907` | `b1f79a9832393053c2db64cc9437bad8d59fc8e4` |
| [PR118](https://github.com/neo-capiro/meri-greenfield/pull/118) funding observations + KB proposal | `56627c1fe31e5c7386f79ca23e7605ba5dc59b83` | `a1c0ca277a0eda6ac2a29622c21cc38829990e0b` |
| [PR112](https://github.com/neo-capiro/meri-greenfield/pull/112) earlier portable handoff | `1b59b96a0f7cbaaeb611a07bd36cb72041d2538b` | `e1a6cc9b55501191f56142bf684e3782d94534cd` |
| [PR110](https://github.com/neo-capiro/meri-greenfield/pull/110) original remaining-family source | `f7f4ed5b397fcd44576251739ed361aee6941d7a` | `e5f752758583cc56a720c1b40093c1fb23a7372c` |
| [PR109](https://github.com/neo-capiro/meri-greenfield/pull/109) five funding carrier checkpoint | `b4daa4adf6e8269e7c341751db9a02bf6d4f062b` | Obtain from that immutable commit; no newer tree inferred |

The [accepted per-operation scope ledger](https://github.com/neo-capiro/meri-greenfield/blob/6968836486738cab4ba62a39e799356914cd7c85/docs/coordination/ledgers/scope-ledger.json) is the exact 82-row source inventory. The [accepted completion report](https://github.com/neo-capiro/meri-greenfield/blob/6968836486738cab4ba62a39e799356914cd7c85/docs/coordination/reports/CODEX-READ-INSTALLATION-REMAINING-20261017.md) explains its current counts and source boundaries. Research portfolio, research portfolio changes, and Florida budget project reads remain in scope and in that inventory. All43 historical exclusions and original scope fields are preserved. Do not silently drop these families when rebuilding exposure metadata.

The [earlier PR112 portable packet](https://github.com/neo-capiro/meri-greenfield/blob/1b59b96a0f7cbaaeb611a07bd36cb72041d2538b/docs/coordination/handoffs/meri-read-lane-20261017/README.md) retains the older **58/13/11 = 82**, SDK60/36, 1029/1029 checkpoint. Those are historical counts. PR125's five final completions are state status/floor votes, tracked-bill client-name selection, hearing client-name selection, and legislative research search. The remaining thirteen original operations are listed below. Constructor/SDK/operation/source-name counts use different denominators; do not add or equate them.

Historical published read pin `b8f8339ce5c8899a9f023e6646cc143f775551b9` and previously unverified local `c68bcca48971608bf5e72e6eedcb5cd75fc77ea0` are not selected as current handoff bases. Use the exact published stack above; do not substitute an old local pin merely because a directory still exists.

## Accepted native contracts and current installation

Accepted client-name resolution uses the actual authenticated `POST /api/clio/clients/check-ref`, exactly `{ref}`. The reader brackets selection with actual native identity; the credential owner joins current task/capability/entry, tenant/user membership and resource grants, rechecks after awaits, and pins reference/UUID/first expiry. Native tenant-wide uniqueness, including hidden duplicate ambiguity, remains native. Only the resolved UUID is sent to the domain tool. Original raw arguments, canonical request hash and observation context remain bound. Static or delegated substitutes do not authorize names. Personal hearings retain their native personal-wall semantics; tracked bills require the current client task. Legal search reuses existing native folder/client admission; legal-reference parsing remains held.

Accepted funding observation depends on published [Core PR52](https://github.com/neo-capiro/capiro-backend/pull/52), head `51c157444ac43035eeb489ff46aee5a4e89ba3ac`, tree `54af881dddef397db0ff215d6eb2a72d74c0d1bd` (109 focused Jest tests and focused TypeScript pass). KB depends on [Core PR59](https://github.com/neo-capiro/capiro-backend/pull/59), head `59efe08f2f3429918758eef30539e9dde4dbb868`, tree `c2babd8e0d386b1c9f18ed32ebcd4472d5ebf486`, parent PR52 (74 focused Jest tests and 2,996-file TypeScript graph pass). These are reviewed source dependencies, not deployed-build/origin/configuration evidence.

Private observations use `x-meri-read-observation`, schema `meri-native-read-observation/1`, canonical JSON/base64url, strict finite JSON/Unicode, bounded decoded bytes and original pre-normalization body SHA256. Funding five retain `{asOf}`; `search_client_knowledge@0.2.0` retains closed body/`{asOf}` and generatedAt on no-client, success/empty and caught-unavailable branches. Ordinary KB calls retain their existing clock and throws. Literal fixtures must remain byte-exact:

| Fixture | Git blob | Meaning |
| --- | --- | --- |
| Funding five | `9536c662f4abd3487b6bdb4000ff06a0250f44ae` | Existing PR109 UTF-8 carriers accepted by corrected Core PR52 |
| KB | `a807a90718c2260f2c980bd04e04cec2d8c9414f` | PR118 2,018-byte literal consumed by Core PR59 |
| New mode five | `b056a4aa0efd0384c1cd90cc810d9def181d6818` | `docs/coordination/proposals/native-read-mode-20261017/golden.json`, 8,295 bytes, SHA256 `e793fb92fa13a175939f9ae0015787c12e281fe50d7133cc8698a5913956ca56`; candidate Meri/Core source, not qualified |

Installation source already has the actual seam. Read [CODEX-READ-INSTALLATION-20261017.md](../../reports/CODEX-READ-INSTALLATION-20261017.md) together with PR125's final report; the earlier 70/40 table is explicitly historical. `prepareGeneralReadInstallation({familyIds,newId,taskPorts,sourceRoot?})` prepares immutable measured source asynchronously and supplies synchronous `createReadsRuntime(admittedTuple)` / `createTaskHandlers(admittedTuple)`. Reuse the actual existing `createPreparedNativeReads` admission and hook. Never replace it with a parallel registry or a worker-created authority.

The admitted tuple remains `{pool,binding,original,allocationJson,grantFactsJsons,grantId,taskArn,issuanceFactsSha256,runRequestSha256,scopes,readCurrentEntry,currentOwner,sourceEnabled,limits,now,taskVerifier,taskCapability,approvedReads,signal?}`. Trusted synchronous `taskPorts` supplies actual `gateway`, canonical `families`, optional `nativeCredentials` and borrowed `contextPorts`. Gateway authority/producer/grant/task capability must correlate to that tuple. Native family configuration supplies only its existing origin/transport/limits; the factory constructs fresh task-owned credentials/context and current-result gates. No task-owned state is shared across runs.

The actual general installation owner consumes `readCurrentInstallation({binding,scopes,policyRevision,signal})`. Its closed result binds `{binding,scopes,policyRevision,baseCatalogSha256,installationId,executionCatalogSha256,operations:[{operation,descriptorSha256,handlerSourceSha256,qualificationReceiptId}],checkedAtMs,expiresAtMs}`. It checks identity/scopes/policy/catalogs/freshness and remeasures source files. Current discovery, task authority and native identity/membership remain separate gates. Selected skills retain their own request/selection/skill/current-client qualification owner; do not relabel a general receipt.

No production qualification producer, receipt UUID, grant or startup mount was fabricated. A real issuer must bind reviewed source to actual deployed Core/Intel/source build, origin/configuration, current grants/policy and native consumption/effect evidence, and revoke on drift. Preparation and synthetic receipt fixtures establish no installation. Bring any mount delta to Fable as a separately reviewed exact patch/API. This lane did not edit startup/control/cli/config/prepared-candidate/prepared-run-bindings/proxy/Temporal/infra/lockfiles or shipping candidates.

## Current incomplete source, preserved without promotion

The new mode operations are exactly `search_federal_grants`, `search_federal_awards`, `search_program_elements`, `get_program_element`, `get_pe_budget_timeline`, each `0.2.0`. Meri's private codec exports that finite set and adds only their closed `{evidenceAccuracyMode:'off'|'shadow'|'enforce'}` arms; public retrieval/result contracts are unchanged. Original five funding and KB carrier bytes remain unchanged. Public-data keeps economic's empty-context path. A cohesive program-elements adapter/family delegates to actual existing native operations, not a fake result producer.

`native-read-credentials/read-mode-observation.mjs` implements fixed `POST /api/clio/application-authority/read-mode-observation` through the actual core-client. Request: `{operation:{id,version},requestSha256}`. Response: `{operation,requestSha256,principal:{tenantId,actorId},surface:'chat',evidenceAccuracyMode}`. It requires actual native Bearer plus matched service secret, exact operation/raw hash/principal/revision and strict bounded 4096-byte UTF-8 JSON; no redirects, cookies, ambient authentication or caller origin/header overrides. It brackets the call with current native identity.

The optional trusted `getReadModeServiceSecret` port is separate from the normalized source-secret getter. Current task/entry/native membership/resource grants are checked immediately before it, after its await, after mode observation, before/after source credentials and before output release. Original request hash and the first expiry remain pinned; fresh observations cannot renew authority. Prepared installation forwards this trusted port through the existing native credential owner. Missing current ports/qualification remain unavailable. No fallback mode or static credentials are introduced.

**Latest production correction APPLIED, UNRUN:** the first reader incorrectly copied an additional three-second local fact lease. Current source keeps the three-second HTTP budget and sends fixed `x-meri-deadline-at` for Core's existing membership latch. The local fact expires at `min(original caller deadline, first native identity expiry, second native identity expiry)`. The owner passes its actual outer cutoff and retains first-expiry pinning/current checks. No HTTP timeout was increased. Reader/owner assertions were updated and five source-over-3,500ms cases authored, but no new test ran after this correction. This supersedes the older reader report's fact-lease/final-hash wording; its original captures remain unchanged. [Final static safe-stop review](../../reports/CODEX-NATIVE-MODE-SAFE-STOP-REVIEW-20261017.md), SHA256 `38d8b2c17c95e1f053f2e3a97d1acd77968e06ab47089a18b9a2b67741781349`, is **HOLD_TESTS / INCOMPLETE** and records exact current Meri/Core hashes.

Outreach explicit-client campaign lists now reuse actual check-ref and pass the resolved UUID while preserving original raw proof/context; UUID input remains unchanged. Current task/native client wall is mandatory. This correction is partial source work only: unscoped campaign filtering and nested record/client/meeting/prep/debrief preauthorization are still held. [Outreach report](../../reports/CODEX-OUTREACH-NAME-CORRECTION-20261017.md), SHA256 `4d40137d5811410be0f3a9ec369c98602058387cb96feadcadc503ffa24a10bd`, preserves its successful and initial failed runs. No outreach completeness or SDK promotion is claimed.

The candidate SDK policy derives76 operations/42families, including optional program-elements and the full public-data family. Passive constructors44; selected-family kernel77; the held legal reference remains filtered from candidateSDK76. These numbers describe authored source only. Current accepted ledger remains69/3/10 and SDK71/41. Candidate registry source does not mean all its advertised operations are accepted, installed, qualified or shipped.

## Separate Core boundary

Core draft [PR68](https://github.com/neo-capiro/capiro-backend/pull/68) is remote verified: head `8d6733c38044cc45ceae60acdd09a2d837ccc197`, tree `c9a2f94fa1c750ebd9599e7840e07f737ec0d796`, sole parent PR59 `59efe08f2f3429918758eef30539e9dde4dbb868`. Branch `feat/core-read-mode-observation-20261017`. [Exact portable Core report](https://github.com/neo-capiro/capiro-backend/blob/8d6733c38044cc45ceae60acdd09a2d837ccc197/docs/coordination/reports/CODEX-NATIVE-READ-MODE-20261017.md), SHA256 `4d6482b605f2d19de66e47f31a7f26d886966149aaf0847297f3ad78da0b6153`.

Sixteen changed files are the allocated new auth mode controller/service and specs; narrow application-authority module/spec; finite observation decoder/spec/HTTP spec; tools.service's five native entry checks and award/grants/new PE focused specs; literal fixture; report; scoped raw-directory attributes. Existing `meri.controller.ts` was allocated but needed no change. The source uses `ApplicationMembershipService.read` and `applicationMembershipRequest`, with actual authenticated current membership plus a matched internal-service identity. Closed operation/hash validation occurs before membership I/O. Each native producer compares the exact actual tenant/chat enum before queries and uses that captured value throughout. Legacy mode sampling and grants' clocks/deadlines, awards projection and PE lineage behavior remain intact.

Independent frozen production review was **ACCEPT_SOURCE**. Actual Core checks were nine parse-only Node24 checks, 35 literal fixture assertions, two old fixture byte comparisons and whitespace. No Nest execution, Jest, imported TypeScript graph, package install, Prisma generation, database/provider/native call or build ran. The tests are authored, not qualified. No active heavy operation remains. Fable's Meri ownership does not allocate Core first-chat PR48, Temporal, general Clerk/Tenant auth, shared runtime manifests, migrations, shipping, rule clocks, locale or citation. Core owner must explicitly allocate any later backend work; Dot coordinates that boundary.

## Tests, failures and exact limits

| Snapshot/evidence | Actual outcome | Qualification limit |
| --- | --- | --- |
| Accepted PR125 final | **613/613** code tests across23files; **36/36** ledger tests, CLI refresh/check0; independent exact-tree ACCEPT | Exact PR125 source only; earlier1056/1056 four-operation checkpoint overlaps and is not additive |
| New reader/core-client initial | **109/109**, exit0 | Older reader before latest lifetime/header correction |
| New native owner/mounted gateway initial | **65/65**, exit0 | Older lifetime bytes; latest70 authored owner cases UNRUN |
| Finite private wire | **138/138**, exit0 | Wire component checkpoint; no current combined acceptance |
| Mode source adapters + economic | **66/66**, exit0 | Synthetic HTTP only: economic21, public mode17, PE28 |
| SDK + installation initial | **84 passed /17 failed /101 total**, exit1 | Ten tests mutated captured ports after preparation; five expected wrong source-error classifier; fifteen test corrections APPLIED, UNRUN. Two real award DEADLINE outcomes exposed the fact-lifetime defect. They are retained and are not dismissed as flakiness |
| Outreach source correction | **27/27**, after retained initial21/27; root reference/owner selection **74/74** | Explicit client-name source only; partial family remains held |
| Latest Meri mode source | Independent static **HOLD_TESTS / INCOMPLETE** | No rerun after lifetime/header/fixture corrections; no final combined result |
| New Core PR68 | **9 parse-only checks +35 literal assertions**, old fixture equality | Jest/TypeScript/install/Prisma NOT RUN |
| Full local tooling repair | Author **74/74** =22parser+15inventory+37exposure; two CLI checks0; independent37/37 parser/inventory +exact staged ACCEPT | Full held local tree only. The 65-file recovery patch is not this fully qualified tree |

Raw outputs, failures and exact argv/status/hash receipts are retained in `docs/coordination/reports/{read-completion-next-20261017,read-mode-reader-20261017,native-mode-20261017,native-mode-sdk-20261017,outreach-name-correction-20261017}/`, and mode adapter evidence under `apps/gateway/sources/public-data/test/evidence/`. [SDK safe-stop report](../../reports/CODEX-NATIVE-MODE-SDK-20261017.md), SHA256 `52127e61040fab4a9b85b151ee2e38fcbdccb294f2f57feb8fade7ce9e817332`, explains all17 failures and unrun repairs. Earlier installation/name/clock/parser failures remain in their original reports. Do not add overlapping component totals or report preparation, syntax-only checks, source review or prior bytes as current acceptance.

## Held tooling tree and exact external publication blocker

Local branch `codex/meri-inventory-parser-20261017`, checkout `C:/Users/Administrator/Documents/Codex/2026-10-16/task-4/meri-inventory-next`, is clean at commit **`4081b2129c4f243eb6f41c17e064e0b96a73bc91`**, tree **`7832848cc0f7e7ab8a0281b6f0ed9124fdbd5b23`**, parent local PR125 equivalent `4359e05bd11b7756d4f1d42fcd2243b3e07f126b`. Sixty-six files comprise the exact reviewed tree. This commit is **not fetchable from GitHub**; no tooling remote tree, commit, branch or PR was created. Sixty-five non-ledger immutable blobs were accepted/verified; that is not a published commit.

The repair replaces an obsolete inline-return profile regex with bounded static literal-guard extraction tied to exact canonical owner functions; ambiguous/missing/duplicate/dynamic/decoy guards fail closed. It fixes Windows relative-path normalization and derives family ordering from canonical declarations while preserving prior priorities. Five metadata rows describe eleven already-published reads (acquisition2, disclosures3, Florida1, public reports3, research portfolio2); it does not add runtime behavior or promote completeness. Its actual adapter exposure is40adapters/74OperationRefs/73selectedcapabilities, a different denominator from accepted SDK71/41. Current inventory SHA256 is `0616014eefedd534ffa7d6a9774a65873434bca13f54eb8a0d163397fca53cfd`; source review SHA256 `0c50d9835304bade523729315874581f5f4ab610421cd8ccde3d8e16e0cb87a6`.

**DENIED external action:** publish exact `docs/coordination/ledgers/scope-ledger.json` to `neo-capiro/meri-greenfield` on intended branch `codex/meri-inventory-parser-20261017`. Held ledger Git blob **`28865e43d10740fe7515f2109e7d619529340ccf`**, SHA256 **`0a97c45b959d8181290fea4fe1c87a89c00509c68da361ae013089dc737ab26b`**. Automatic approval review rejected this blob twice: it classified the internal architecture/ownership/private-source metadata payload as requiring exact payload/destination authorization beyond the standing draft-PR instruction. The second attempt supplied already-published baseline evidence showing only sourceExposure provenance/hash/8 adapter-path rows changed and historical counts unchanged; it was still rejected before execution. Fresh exact Neo approval was requested and has not arrived. Primary explicitly instructed no retry or indirect routing. The action is DENIED, not uncertain; it is not queued. Transient separate usage-review errors recovered and are no longer the blocker.

The denied ledger payload is **not** in this supplement, patch, manifest, bundle, inline tree or another upload. Only identifiers needed to locate the held local source are recorded. Do not reconstruct/publish it as part of recovery or reinterpret this supplement as approval. Primary will reference the denial separately. Accepted PR125 ledger remains the published accounting source.

The independently verified [65-file recovery patch](packets/inventory-source-EXCLUDES-HELD-LEDGER.patch) has exactly387803bytes, SHA256 **`b6a6db83ca7e7998fc70f1de9a38df8e165870e8d98de6faa2d025ba70c4212b`**. [Manifest](packets/inventory-source-manifest.json) lists every included file's Git blob, SHA256 and byte count. It is byte-for-byte the held local diff against the PR125-equivalent base **excluding** the denied ledger path; independent review verified all65 files and absence of the denied payload. This is unaffected-source preservation only, not the full74-test qualified tree. Keep it on a separate PR125-based recovery branch, not over this newer mode snapshot. Existing scope-ledger provenance remains old in that partial recovery, so exposure consistency/acceptance remains held; no generated-ledger update or publication is authorized by this packet.

## Thirteen remaining operations and owner decisions

These remain the accepted baseline's incomplete operations across ten families (nine skill-declared/four undeclared). Five have the unqualified mode source above; none is promoted by this handoff. Remaining work is concrete source/authority plumbing, not an unspecified product decision. Core allocations outside MODE are still ungranted.

| Operation(s) | Required completion / hold |
| --- | --- |
| `search_federal_grants`, `search_federal_awards`, `search_program_elements`, `get_program_element`, `get_pe_budget_timeline` | Qualify current candidate source and actual native observation/enum consumption; exact deployed source/origin/config/current installation required. Preserve original provider behavior, clocks/deadlines and PE shadow lineage |
| `search_sam_opportunities` | Actual mode plus three distinct native instants: presentation asOf, source-status comparison and source-health freshness; preserve48-hour boundaries and source-reason precedence. Not allocated in Core MODE |
| `get_state_rule_status` | Independent stageAsOf/commentAsOf threaded into existing optional helper parameters. generatedAt is not a replacement. Core owner explicitly has not allocated it |
| `get_certification_status` | Observe actual native comparison locale and consume it consistently in query/ID/CSO/CSP folding; no invented default locale. Preserve native ICU behavior, ID precedence, order and caps |
| `get_legal_reference` | Canonical native effective citation identity/edition before I/O; do not copy parser or infer from result. Preserve parser-independent rule/version branches and explicit-ID precedence |
| `search_legiwatch_news` | Effective native folder/client scope, cutoff, implicit personnel year, actual Clerk/current monitor owner/resource authorization |
| `query_outreach` | Candidate explicit names are not enough: establish actual unscoped campaign/client predicate and preauthorize nested record/client/meeting/prep/debrief resources before private reads |
| `search_research_sources` | Preserve six branches; conjoin meeting ownership OR with text OR; client walls before content. Directory notes remain tenant-shared; reuse current reference owner |
| `get_business_development_evidence` | Actual org-linked client/facility task grants before dossier content. `suppressJev` does not disable all SAM/provider calls; preserve enabled lookups/budgets and separately qualify effects, rather than inventing stored-only behavior |

Read-only next-packet evidence, **not an allocation**: Core `meri-tools.service.ts` state-rule status ~6139–6292 already calls shared stage/comment helpers (`packages/shared` helpers ~1825/~1867) with independently supported today parameters. Smallest proposal is one finite `{stageAsOf,commentAsOf}` arm and separate threading through four presenter calls, without shared-helper edits/new endpoint. Reconfirm line locations against the chosen Core pin.

Citation evidence: Core tools ~2506–2532 delegates to Intel keyword-meri controller ~79–85 and ResearchService.references ~425–459; shared legislative-research parsers ~45–98/key ~10–43 own effective identity. Reuse effective native precedence and compare selected citation, not a hash of the rewritten UUID request. A truthy explicit reference ID bypasses `legalReferenceKey`; unconditional parsing would introduce new long/deep citation errors. Preserve rule/version bypass, constitution edition-null and unused-facts-null semantics. Locale/citation/rule and later mode packets require exact native owner/path allocation before edits.

## Fresh-machine recovery and separately authorized resume

No Windows absolute checkout or borrowed mutable dependency directory is required for the published source. Clone into a NEW owned directory, verify pins, and keep the accepted baseline separate from the incomplete handoff. Commands below are **resume instructions, not commands run during sealing**. Read the primary handoff and repository instructions first. No activation, credentials, native SQL/provider call, migration, deployment or new feature work follows automatically.

```sh
# Accepted Meri source baseline, independent from shipping.
git clone --filter=blob:none --no-checkout https://github.com/neo-capiro/meri-greenfield.git meri-reads-accepted
git -C meri-reads-accepted fetch origin codex/meri-reads-installation-20261017
git -C meri-reads-accepted checkout --detach 6968836486738cab4ba62a39e799356914cd7c85
git -C meri-reads-accepted rev-parse HEAD 'HEAD^{tree}'

# Incomplete current source + this portable packet; final PR gives HANDOFF_HEAD.
git clone --filter=blob:none --no-checkout https://github.com/neo-capiro/meri-greenfield.git meri-reads-incomplete
git -C meri-reads-incomplete fetch origin codex/meri-read-native-next-20261017
git -C meri-reads-incomplete checkout --detach HANDOFF_HEAD
git -C meri-reads-incomplete rev-parse HEAD 'HEAD^{tree}'

# Separate Core source boundary; no implementation authority is implied.
git clone --filter=blob:none --no-checkout https://github.com/neo-capiro/capiro-backend.git core-reads-incomplete
git -C core-reads-incomplete fetch origin feat/core-read-mode-observation-20261017
git -C core-reads-incomplete checkout --detach 8d6733c38044cc45ceae60acdd09a2d837ccc197
git -C core-reads-incomplete rev-parse HEAD 'HEAD^{tree}'
```

Use an explicitly coordinated resource window before installs/compiler/tests. Check disk/process ownership; avoid duplicate installs/heavy archives and preserve release checkouts. Meri declares Node24 and committed npm lockfiles, not Core's pnpm setup. In a fresh Meri checkout, the narrow source/SDK fixtures need the root dependencies and `apps/worker/conversation`'s own pinned SDK/zod closure. A separately authorized setup can use `npm ci --ignore-scripts --no-audit --no-fund` in each of those two directories. Do not copy task-4 dependency links or modify lockfiles; retain exact install output/status. If the environment cannot resolve an import, preserve that failure before arranging the correct isolated dependency closure.

After that separate authorization, the latest unrun corrections require at least the following serial Node24 selection, retaining complete raw stdout/stderr, exact argv/status and before-run hashes. This is not a claimed passing selection or a substitute for final independent review/current qualification:

```sh
node --max-old-space-size=256 --test --test-concurrency=1 --test-timeout=30000 apps/runtime/native-authority/native-read-credentials/test/read-mode-observation.test.mjs apps/runtime/native-authority/native-read-credentials/test/core-client.test.mjs apps/runtime/native-authority/native-read-credentials/test/mode-context.test.mjs packages/contracts/native-read-observation-0.2/test/mode.test.mjs packages/contracts/native-read-observation-0.2/test/validate.test.mjs packages/contracts/native-read-observation-0.2/test/kb.test.mjs apps/gateway/sources/public-data/test/handler.test.mjs apps/gateway/sources/public-data/test/mode-handler.test.mjs apps/gateway/sources/program-elements/test/handler.test.mjs apps/worker/conversation/reads/test/newmode.test.mjs apps/runtime/native-authority/general-read-installation/test/phase3-mode.test.mjs apps/runtime/native-authority/general-read-installation/test/preparation.test.mjs
```

Then cover all changed SDK policy/family/installation/name regression files identified by the diff and saved receipts, resolve real failures, and obtain final exact-tree independent review. No broad all-repository/build run is needed merely to repeat unchanged evidence. Core separately declares pnpm9.12.0; its [PR68 report](https://github.com/neo-capiro/capiro-backend/blob/8d6733c38044cc45ceae60acdd09a2d837ccc197/docs/coordination/reports/CODEX-NATIVE-READ-MODE-20261017.md) names the unrun eight-suite focused Jest selection and compiler command. Frozen `--ignore-scripts` setup may still require approved local internal-package/Prisma artifacts; no DB connection/migration or copied task-3 config/dependencies is authorized. Preserve baseline compiler/import failures rather than disguising them.

To recover only unaffected tooling source, make another fresh branch at accepted PR125, read the manifest, verify patch SHA256, then `git apply --check /path/to/inventory-source-EXCLUDES-HELD-LEDGER.patch` and `git apply` there. The packet must not be applied over this mode branch. Its manifest records the held full-tree identities for audit, not fetch commands for a nonexistent remote commit. Do not generate, transfer or publish the denied ledger while its exact-file approval is absent. A local Windows operator can inspect the retained clean commit read-only; Fable on another machine has the65-file partial source packet and the published accepted baseline, with the full-tree publication blocker explicitly outstanding.

At seal this lane relinquishes Meri implementation to Fable, leaves all candidates outside first-chat unless separately integrated, and has no active operation. Outstanding gates are latest Meri tests/review, actual Core Jest/TypeScript qualification, genuine installation/deployed-native/effect qualification, explicit Core allocation for remaining packets, and exact Neo approval for the denied ledger payload. No live capability is asserted.

Packaging integrity: all 81 staged files match working bytes and all 12 staged JSON files parse. The exact recovery patch retains original CRLF raw captures and diff context spaces; a broad whitespace check flags those embedded bytes. The scoped whitespace check excluding only that byte-preserved patch artifact passes. Its independently verified raw hash remains unchanged. No tests ran during sealing.
