# Public-data read boundary outline

Root authors three selected reads from immutable producer projections:
`query_economic_data`, `search_federal_grants`, `search_federal_awards`.
Independent reviewer: native_supervisor_author, isolated at e948655. These
public/synced result shapes are not the separate federal-market rail.

New exclusive modules: `public-data.schema.json` owns the three closed input and
result families; `public-data-validation.mjs` composes domain input/result
validation; `public-data-deadlines.mjs` owns only grant and award date consistency.
New author tests: `retrieval-public-data.test.mjs`. Evidence lives here; root's
shared canonical integration remains separately reviewed. No dependency/export,
gateway implementation, producer adapter or authorization engine is added.

The canonical snapshotOperationData helper owns inert bounded JSON admission.
The existing loader injects validateShape and the schema. Factory interface:
createPublicDataValidators({validateShape,schema}), normalizePublicDataInput(id,
request,context), assertPublicDataOutput(id,page,request,context), input/output
definition lookup and shape validation. The two money-source operations require
explicit trusted evidenceAccuracyMode off/shadow/enforce. Economic reads require
no mode. Mode is never model-controlled, never inferred from result fields and
never grants source access. Generated timestamps are reported source anchors,
not proof of current data. Grants echo generatedAt as asOf.

Input selectors follow frozen trim/UTF-16 bounds and limit/page defaults. The
economic producer supports BLS seriesId/query and BEA datasetName/dataset/year
beyond its shorter registered description; expose their actual supported shape
explicitly. Inapplicable selectors do not silently become new query predicates.
Unsupported sources retain their error result, not an empty successful page.

Schema scalars follow Prisma and the wire projection: nullable stored integers
and floats, explicit award Decimal-to-number conversion, serialized dates and
opaque Census JSON. Do not invent percentage ranges, financial non-negativity,
stable snapshots, normalized units, source freshness or exhaustive coverage.
Preserve independent query/count race limits; a short page does not prove total.
Award paging ends at 10000 with explicit remaining-data limitation.

Domain checks bind applicable source/selector, limit/page and output identity;
grants retain stored status separately from ET close-day and structured deadline
status. Trusted enforce requires the additional deadline/date projection; off
and shadow omit it. Unknown textual deadlines stay unknown even if the raw
close date produces a separate open/closed hint. Award date labels preserve
signing versus latest action, update, performance and sync anchors.

Tests cover positive variants and exact null/omission behavior, numeric/storage
bounds, pagination, ET/DST boundary status, response lineage, mode substitution,
hostile-data refusal and schema closure. Reference metadata records every
inspected path/blob at fd8765ec01d292013758606204f2c9d886cd31c1 and drift against
4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace without publishing private bodies.
No producer, SQL, provider, service, native, browser, cloud or paid action occurs.
All handlers remain null, source connectivity false and qualification pending.
