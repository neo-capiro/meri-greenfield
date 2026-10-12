# Legislative directory source candidate

**Candidate awaiting independent review.** Production freeze `c511b4bf6ee3f30674f3bd7badae79df82a61aab`, tree `476f858af07032e72e56f9322d9864356e0600de`, extends `4280ebaba4cab554baf7e6b23175c34d21027097` in the isolated legislative-directory worktree. This author does not grant source acceptance or availability. Root approved the factory/context proposal before implementation; independent review belongs to memory_reviewer.

Only `get_committee_roster` and `list_members` are implemented as passive private request/result contracts. The new schema owns projections, the56-entry state/territory vocabulary, role-policy patterns and explanatory notices. The124-line cohesive validator reuses `snapshotOperationData` and injected schema validation; it contains no querying, source adapter, identity authority, service initialization or provider work. Root alone owns catalog/loader integration. Their bytes and all original files remain unchanged, so this branch still has37 typed unavailable operations,36 mapped originals and60 selected pending, within139 originals/96 selected/43 deferred.

## Interface and behavior

`createLegislativeDirectoryValidators({validateShape,schema})` exposes `normalizeLegislativeDirectoryInput`, `assertLegislativeDirectoryOutput`, `validateLegislativeDirectoryShape`, `legislativeDirectoryInputDefinition` and `legislativeDirectoryOutputDefinition`. `LEGISLATIVE_DIRECTORY_OPERATION_IDS` contains exactly the two operation IDs. Definition prefixes are `CommitteeRoster` and `MemberList`. Normalization returns frozen input plus frozen empty metadata. Context keys are empty; arbitrary model authority/context keys refuse. Direct operation and shape selectors reject nonstrings before key lookup.

Member lists normalize state/territory aliases, ignore invalid chamber values, and retain explicit invalid-state or missing-filter refusals. The numeric/string/null limit preserves finite truncation/clamping1–100/default100. Returned count is row count, with the request's bounded window; it is not a source total or completeness assertion. State filtering compares the persisted string case-insensitively; only House rows may carry their stored signed32-bit district. Free-form persisted chamber values are preserved when no chamber selector applies. Returned notices retain the producer's incompleteness caveat.

Committee selectors retain UTF16 clipping and case normalization, missing namespace/selection and missing-state refusals. Federal code identity is case-sensitive; state ID identity is case-insensitive. Names are not resolved here: exact code/name uniqueness and current source selection remain adapter obligations. Unresolved/ambiguous source selection has null committee, null leaders and empty members; a resolved unsynced roster is a separate shape. State committee projections contain no state field, so the validator does not fabricate a state from an ID.

Federal and state membership shapes remain distinct. Federal rows carry state, side, nullable rank/title and no district. State rows carry nullable chamber/district/party/role, and rankingMember is always null. Leadership must equal the first reported row matching the pinned role policy, with federal rank sorting treating null as999. Roster sizes remain uncapped apart from the existing canonical JSON admission ceiling. Member IDs obey source primary/unique membership keys. Nullable/free-form stored scalars and signed32-bit integers are preserved; no invented UUID patterns or stored-value enums were added.

Intentional private admission restrictions are explicit: closed inert JSON scalar types refuse arbitrary legacy object coercion, accessors, proxies, cycles, extras and nonfinite numbers. Post-case expansion beyond typed selector bounds refuses instead of widening the contract. Missing request selectors remain admitted so their explicit refusal projections can be represented. `generatedAt` must serialize canonically but is metadata only: old timestamps are valid and no freshness, current authorization or live qualification is claimed. The state/territory map was transferred as approved vocabulary data; no legacy resolver/handler/query or agent implementation was copied or imported.

## Pinned evidence and authority

[Reference identities](../../qualification/candidates/read-continuation-20261012/legislative-directory-author/reference-identities.json) bind10 paths at immutable inventory `fd8765ec01d292013758606204f2c9d886cd31c1` and observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. All10 complete blobs are unchanged. The evidence file contains paths, Git blobs, byte lengths and SHA256 values, not private bodies.

- `apps/api/src/meri/meri-tools.service.ts`: schemas1328–1348; member projection/defaults5765–5828; committee namespace/result projections5947–6134; scalar normalization9948 and10044. Blob `753b425b3e6b8cf55a7d0863aa961a3c9a696dea`.
- `apps/api/src/meri/meri-tools.list-members.spec.ts` and `meri-committee-roster-representation-tool.spec.ts`: behavioral constraints on refusal, state aliases, namespace/id/name matches, nullable leaders and no guessed roster.
- `packages/shared/src/index.ts`: leadership policy1386–1415 and committee match contract1909–1917; exact federal code comparison verified by independent discovery. Blob `62eb32931826f77abd985bc142f6a65adad6a23a`.
- `apps/api/prisma/schema.prisma`: CongressMember4210, CongressCommittee4262, membership4294, StateLegislator6722, StateCommittee6942 and membership6964 establish projected nullability, Int domains and unique keys. Blob `cdf1923217edae6e7624993796a5671922b61ac0`.
- `packages/shared/src/us-states.ts` and `apps/api/src/common/us-states.ts`: exact56-entry vocabulary and full-name alias semantics.
- `apps/api/src/meri/meri.controller.ts`, `tool-service-secret.guard.ts` and `apps/api/src/auth/roles.guard.ts`: authenticated tenant context, standard_user minimum-role gate and additional internal-service route boundary. Tool execution retains an active-request guard. These are future trusted gateway/admission obligations, not authority supplied or granted by this DTO. The source's development/test observe mode does not authorize Meri execution or weaken its gates.

## Verification and retained failure

Strict Ajv compilation and all29 author tests pass at the repaired source. Coverage includes every refusal/result namespace, all56 state aliases, limits/defaults/Unicode, nullable/free-form rows, role/title variants and first-row correlation, namespace/identifier/filter lineage, no federal district inference, state ranking refusal, row identity/count/window, detached results and hostile selectors/data. The original28 tests passed at `04a93406727998e2eda945ff2223b38f881ea4ef`.

An author-side review found that the initial validator accepted duplicate member identities despite source primary/membership uniqueness. A new failing control was captured unchanged at `d2b6a8704d29f4fcd7a222029601bbfc00e29fe0` (0/1); the repair adds one shared uniqueness predicate at `c511b4b`. All29 tests then passed, including duplicate refusals for federal roster, state roster and member list. The original source, counterexample and raw failure remain preserved.

The offline audit passes **6027/6027**: every pre-existing file is unchanged, both new production files bind the freeze, all20 pinned/current reference versions authenticate to recorded Git blobs/bytes/hashes, the state vocabulary matches, private definition names do not collide, and captured streams/owned cleanup verify. Authored whitespace passes. No full integration suite was run here because the two contracts are not wired into the canonical loader; root and the independent reviewer own that later qualification.

Commands actually run under the established120-second child/five-second cleanup capture:

```sh
node --test --test-concurrency=1 packages/contracts/test/retrieval-legislative-directory.test.mjs
python3 -B docs/qualification/candidates/read-continuation-20261012/legislative-directory-author/verify-source.py
```

Raw receipts bind exact argv, source Git/diff identity and stream hashes. All owned groups exited. Existing local dependencies were physically copied, with no installation, downloads or lifecycle scripts. No native33/nine-budget tests, SQL, provider/customer source, service/container/browser, model, cloud/image, credential/network change, spend, deployment or main merge occurred. G1 and all source/runtime gates remain unchanged.

[Author packet manifest](../../qualification/candidates/read-continuation-20261012/legislative-directory-author/manifest.json) includes source, tests, reference metadata and raw outcomes. Independent ACCEPT_SOURCE/HOLD and root canonical integration remain outstanding.
