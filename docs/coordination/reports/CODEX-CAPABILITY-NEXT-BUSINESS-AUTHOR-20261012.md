# Business-development read contracts: author submission

Allocated base: `e0163fb65a639a28d9423e929058b40b48cc556d`. Source freeze:
`bf9a06cfba22c5c3bac87949689348b16febcbc5`, tree
`7385ddaee6665cb09219da9eca7bced31b480b28`. Dedicated worktree:
`/workspace/meri-business-development-20261012`, branch
`task/meri-business-development-20261012`.

This submission implements the three selected read projections in new private
`business-development.schema.json`, `business-development-validation.mjs` and
`test/retrieval-business-development.test.mjs`. It contains no source adapter,
handler, grant decision, watch runner, provider client or approval behavior.
Root exclusively owns canonical loader/catalog integration and final source
acceptance. This author's freeze changes no capability mapping or availability.

## Contracts and canonical ownership

The factory is `createBusinessDevelopmentValidators({validateShape,schema})`.
It exposes `businessDevelopmentSchemaId`, `BUSINESS_DEVELOPMENT_OPERATION_IDS`,
`businessDevelopmentInputDefinition(id)`,
`businessDevelopmentOutputDefinition(id)`,
`normalizeBusinessDevelopmentInput(id,request)`,
`validateBusinessDevelopmentShape(definition,value)`, and
`assertBusinessDevelopmentOutput(id,value,request)`.

The distinct definition pairs are
`BusinessDevelopmentContextInput` / `BusinessDevelopmentContextOutput`,
`BusinessDevelopmentEvidenceInput` / `BusinessDevelopmentEvidenceOutput`, and
`BusinessDevelopmentRecentChangesInput` /
`BusinessDevelopmentRecentChangesOutput`. Each output pins its own original
operation name in `tool`. No brief, source-resolution or write operation is
admitted through this family.

Normalization returns frozen `{input,metadata}`. A valid conversation UUID is
required, reflecting the actual frozen handler boundary rather than the less
strict advertised required-field list. The only default is recent-changes
`limit:10`, bounded to 1–25; UUID case and supplied scalar values are preserved.
Metadata explicitly says the selector is not authority, source connectivity and
producer qualification are absent, and validation does not establish absence.
Unknown properties and coercion are refused. This closes the context/evidence
input grammar more strictly than the frozen handlers, which specifically
rejected authority-like keys but could ignore other extras. It does not add
authority or change the selected read intent.

The factory consumes the canonical injected shape validator. Root's unchanged
bounded JSON admission was exposed privately as `snapshotOperationData` in
`685fe100233da10991485be49b2a1e8e31dd8308`; its author-worktree cherry-pick is
`443814c519edacb88eeae215d6f0c41c57e51a96`. That dependency was supplied and owned
by root, not authored in this lane. Both direct family entry points and the
existing operation resolver use this admission; there is no second generic JSON
walker or compiler in production. Tests alone compile this new schema with the
existing pinned strict Ajv setup until root registers it in the canonical loader.

## Preserved projection behavior

- Context exposes only the nine selected prospect fields, three preference
  arrays, and the newest 20 history entries with five exact projected fields.
  Nullable ownership/identity fields remain nullable. Count and truncation
  relationships and chronological order are checked; these checks cannot prove
  that an upstream source supplied every authorized history row.
- Evidence exposes at most 24 projected rows, source identity/locator aliases,
  separate dates, relationship strength, lifecycle stage, section states and
  counts. Allowlisted facts remain exact or explicitly omitted. Only descriptive
  facts can be excerpted, with retained string/array bounds and truthful markers.
  Physical-address keys are narrowly projected. Raw provider/contact payloads
  cannot appear as extra fields. Allowed generic JSON values remain inert data;
  validation is not factual or source-attribution verification.
- Evidence `complete` records whether the returned record window fits the cap;
  `partial` independently records row truncation, omitted/excerpted facts or
  limited source sections. Both can legitimately be true. Scope-specific empty
  evidence does not prove universal absence. Null source locators remain null;
  no URL, identifier or evidence-ready flag is invented.
- Recent changes preserve the actual nullable-string alert DTO vocabulary, not
  narrower internal watch-runner enums. The output limit must match the request;
  returned counts must match rows. Implications remain explicitly inferential.
  Before/after changed values are JSON data, while raw baseline/delivery state
  stays excluded. The unread count is independent of returned rows. Truncation
  is reported without inventing a continuation request, total or completeness.

Schema hash at this freeze:
`fff7362e49e0d981b1aeaeec881ea2e72e2fa263d9f64dfad94456fd50b330f1`.
Producer-generated timestamps must be parseable instants, preventing leap-second
NaN comparisons. Other source date fields retain their declared string/null
types; the contract does not invent date-format or freshness guarantees.

## Frozen source references

All references are Capiro
`fd8765ec01d292013758606204f2c9d886cd31c1`. Their blobs are unchanged at observed
`4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. Only interface/projection/type/policy
facts were used; no private source body was copied into this repository.

| Path | Git blob | Boundary |
| --- | --- | --- |
| `apps/api/src/meri/meri-tools.service.ts` | `753b425b3e6b8cf55a7d0863aa961a3c9a696dea` | Advertised request schemas and delegation |
| `apps/api/src/meri/meri-bizdev-tools.service.ts` | `25db80eb7a7e39db58662c5a144f410971f7bf38` | Exact three producer result projections, defaults, caps and fact-key projection |
| `apps/api/src/meri/meri-bizdev-tools.service.spec.ts` | `022678284dd159f29620268bec89e0bc47eaf7b4` | Operation-specific contract assertions and scope refusal |
| `apps/api/src/business-development/bizdev-evidence.types.ts` | `1d90361d75000add6514c178389b69a7b363a760` | Evidence envelope and vocabularies |
| `apps/api/src/business-development/bizdev-watch.types.ts` | `d8595d972fda8b52ac55c6229cfd604c9d28cbc4` | JSON changed values; internal diff is not the tool result |
| `apps/api/src/business-development/bizdev-watch.service.ts` | `29fbe4b770f2a3418f5d6f5ab7bc194f9710813f` | Actual nullable alert-row DTO |
| `apps/api/src/business-development/bizdev-meri-scope.service.ts` | `2cb7e71ff5929a6a78a97d60d27668409633572d` | Persisted prospect selection and current-scope boundary |
| `apps/api/src/business-development/bizdev-meri-scope.service.spec.ts` | `2d99109db0f60f03f8e1514cf68cea24606bba5e` | Flags, tenant isolation, changed scope and ordinary edits |
| `apps/api/src/business-development/bizdev-dossier.service.ts` | `6b405a7ab8f4118133eba1877c95511e1a93d4a1` | Dossier identity type and live SAM qualification caveat |
| `apps/api/src/business-development/bizdev-dossier.service.spec.ts` | `e980be77c30d19265a398859958f15cf14170159` | Source/identity/provider coverage limitations |
| `apps/api/src/meri/meri-prospect-scope.helpers.spec.ts` | `dccdfdba2a3514bc750b12e86ebf37a5db98d307` | Missing/stale selection refusal and no retargeting |
| `apps/api/prisma/schema.prisma` | `cdf1923217edae6e7624993796a5671922b61ac0` | Prospect/history/preference scalar and null types |
| `apps/api/src/vendor-reference/vendor-reference-sam.client.ts` | `fe586e9c425af353a4b1fb9312258bdeddf0c816` | Normalized address DTO and six string/null leaves |
| `apps/api/src/vendor-reference/vendor-reference-sam.client.spec.ts` | `0fcf56e628df3123e40f5089baa21345fe8559de` | Complete address and missing-section null contract |

The address references were added after an independent review provenance question.
`SamPhysicalAddress` (lines 23–30), `SamEntityRecord.physicalAddress` (line 41)
and the normalized address projection (lines 197–206) establish the six
string/null leaves. The dossier forwards that typed value (line 1105), while
the tool filters its keys. This clarification changes no source or assertion.
The prior evidence freeze `9a8027c4f162447be4aa30d441bc8990ead3f4de` remains
preserved; the reference receipt records a bounded display-loop failure without
copying private source bodies.

The discovery assessment was corrected after root clarified that a separately
named complete DTO is unnecessary when a frozen producer projection closes the
result. That earlier conservative discovery did not alter source or inventory.

## Verification and remaining gates

The initial focused check stopped during strict Ajv compilation because a JSON
scalar union used a multi-type keyword. The schema was corrected to explicit
`anyOf` branches; strict compiler settings were preserved. Exact failed stdout,
command, exit and the author's then-current source files remain in
[`business-author/`](../../qualification/candidates/capability-next-20261012/business-author/).
Those files were initially untracked, so that first capture's empty Git diff is
not a source identity receipt; its separate failure archive binds their bytes.

The next focused run passed 31/31. After adopting root's shared admission helper
and adding standalone boundary controls, 33/33 passed. The pre-helper source
patch is retained. Original assertions/tests were not changed or skipped.
The original root contract suite plus the new family tests passed **295/295**
against the exact source freeze. This broader check reaped two exited
descendants and confirmed its owned group absent.
The offline packet verifier passes **84/84** checks. Git-tree comparison
preserves 5,054 of 5,055 original paths byte-for-byte; the sole exception is the
exact root-owned canonical helper export. All original tests remain unchanged.
The staged whitespace check passes, including the retained raw failure output.
Synthetic resolver tests use the real canonical resolver with test-only
descriptors; they do not claim canonical registration or current authorization.
Root performs final combined loader/catalog and unavailable-gateway validation.

All check receipts use the supplied Linux subreaper capture, with owned process
groups confirmed absent and no timeout/kill. Existing dependency trees were
physically copied by root; this lane performed no install or lifecycle script.
The canonical helper is the only pre-existing source-file change in this branch,
and is an exact root-owned dependency. No public contract or lockfile changed.

Current ownership and expiry of the conversation, authenticated actor/tenant,
persisted prospect scope, canonical/client linkage and required feature flags
remain source-adapter/current-authority prerequisites. The raw frozen projections
contain no Meri RunBinding/subject envelope; no gateway result-release path is
activated by these contracts. Missing raw lineage must not be treated as an
authorized product result merely because the family schema validates.

The evidence wrapper's comment about local reads is not proof of no provider
work: `suppressJev:true` suppresses Jev scheduling, while the dossier can still
perform flag-gated exact-UEI/CAGE SAM lookup. Source/provider entitlements and any
paid call require their separate qualified owner. No producer ran here. Recent
change reads do not mark alerts read/dismissed or prove bid/win intent. No watch
diff algorithm or source retrieval implementation was imported or recreated.

At this author freeze the original inventory remains 139/96 selected/43 deferred,
with 14 mapped unavailable originals and 82 unmapped; the action-item partial
binding remains separate. Mapping changes require root's independent reviewed
integration. G1 remains open, G2–G7 unentered, and source connectivity disabled.
