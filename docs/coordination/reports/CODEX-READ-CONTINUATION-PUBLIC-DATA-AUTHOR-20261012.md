# Economic, federal grant and legacy award read contracts

Author source: `31093cd5b6aaaf246a870eb4f473a6639cc2a7df`. Independent review is
pending. The new private family describes `query_economic_data`,
`search_federal_grants` and `search_federal_awards`; it executes no producer and
does not yet add a canonical binding. All existing availability remains unchanged.

`public-data.schema.json` owns closed requests/results; the factory in
`public-data-validation.mjs` owns normalization, source/window/selector checks;
`public-data-deadlines.mjs` owns only grant/award date consistency. Existing
`snapshotOperationData` supplies bounded inert JSON admission, with no duplicate
walker, source import, runtime initialization or new dependency. The test compiler
is test-only. Root owns later canonical loader/catalog integration.

Economic results retain Census/BLS/BEA distinctions, nullable storage numbers,
reported units/periods and opaque Census JSON. BLS has at most twelve points per
series; BEA projected tuples are not treated as unique. Source registration
advertises fewer fields than its actual method supports: the contract expressly
includes BLS `seriesId/query` and BEA `datasetName/dataset/year` selectors. It
retains irrelevant selectors in normalized requests without treating them as
filters for other variants. Unsupported sources retain an error result rather
than an empty successful result. New closed typed admission rejects malformed
numeric year/selector values instead of preserving permissive legacy coercion;
valid zero year continues to establish no year predicate. Limits preserve
finite number/string truncation and clamping, with malformed limit fallback.

The two money-source operations require an explicit trusted
`evidenceAccuracyMode` of off/shadow/enforce. It is not a model argument or an
authorization decision; the future gateway/source owner must establish the
current tenant/surface rollout context. Off/shadow retain legacy shapes; enforce
requires the source's additional date projection. No current data/entitlement
claim follows from mode or shape. Generated instants are reported source anchors.

Grants keep stored status separate from the ET close-day status and structured
deadline. Truthy `responseDateDesc` forces structured unknown even when the text
resembles an ISO datetime; that text is preserved. A raw close date can still
have a different legacy status. The validator checks literal Eastern end-of-day
anchors (including seasonal offset), echoed asOf and days/status consistency; it
does not generate new source deadlines. Award amount is the source's explicit
Decimal-to-number projection, not a decimal-string or exact arithmetic promise.
Signing, latest action, update, performance and sync date fields remain distinct;
unknown values stay null rather than borrowing the action date. The legacy owner
is global `listLegacyGlobalContracts`, not tenant-aware `listContracts`. A client
conversation must not silently narrow this global source boundary.

Query and count calls are separate observations, so count/row cardinality is not
forced to a shared snapshot. Award page/limit/continuation fields are checked,
including page10000 with possible remaining data and no nextPage. No new source
freshness, coverage, uniqueness, numeric positivity or percentage limits are
invented. Every current authorization/source qualification obligation remains
with its existing gateway/source owner.

Fourteen immutable reference identities (paths/blobs/raw SHA256/byte counts) are
recorded in `read-continuation-20261012/public-data-author/reference-identities.json`.
All are unchanged from Capiro `fd8765ec01d292013758606204f2c9d886cd31c1` to observed
`4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. The projection wrapper blob is
`753b425b3e6b8cf55a7d0863aa961a3c9a696dea`; Prisma schema is
`cdf1923217edae6e7624993796a5671922b61ac0`; the legacy owner is
`b3cdb456644eda3ff7e318f2c883931a27a29000`. No private bodies were published or
copied into this repository and no legacy source was executed.

Focused source tests: **27/27 PASS** at the exact author commit with zero source
diff. Raw stdout SHA256
`5f5cbb7622faf6fdacad7c1bb4323a80d4b021c0fd7e331cc5a87d7fd738626c`;
stderr empty. Owned group148232 exited and is absent, without timeout or kill.
The suite covers all result variants, null/omission/type limits, normalization,
clock/mode/selector substitution, ET boundaries, count races, pagination,
unknown semantics and hostile-data refusal. No runtime/native, database/service,
provider/model, customer data, frontend, cloud or image action occurred. Combined
integration/public checks follow independent family acceptance; G1 remains OPEN.
