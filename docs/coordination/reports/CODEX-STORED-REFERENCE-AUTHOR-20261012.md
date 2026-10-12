# Stored intelligence and dataset metadata: author source qualification

Source `450d48fc158dbcdd24f224ec32d6f5b2f92aca80`, tree
`b05312f1586ea5b055a9ea9bbd7c9b1b52eeb687`, adds two separately cohesive private
contract families at base `4566cef6417428d46274a14f7937ca11df66ae9d`. All 6,001
original Git blobs remain unchanged. The six new files are each family's
schema, validator and focused test. Root owns shared canonical registration;
no live handler, source, authority or query engine is added.

## Separate interfaces

| Operation | Factory | Definition stem | Schema ID suffix |
| --- | --- | --- | --- |
| `search_intel_articles` | `createStoredIntelligenceValidators` | `StoredIntelligenceSearch` | `stored-intelligence:0.2.0` |
| `list_global_datasets` | `createDatasetMetadataValidators` | `DatasetMetadataList` | `dataset-metadata:0.2.0` |

Each factory takes `{validateShape,schema}`. Schema IDs begin
`urn:meri:retrieval:`; each stem has `Input` and `Output`. Factory results expose
its prefixed `SchemaId`, `InputDefinition`, `OutputDefinition`,
`normalize...Input`, `validate...Shape` and `assert...Output` functions, plus
`STORED_INTELLIGENCE_OPERATION_IDS` or `DATASET_METADATA_OPERATION_IDS`.
Prefixes are `storedIntelligence` and `datasetMetadata`, respectively.
Both canonical bindings require `contextKeys:[]`. Assertions receive the
original request. The actual canonical resolver is tested with synthetic,
unavailable descriptors for immutable request/context/digest composition.

The unchanged `snapshotOperationData` is the sole bounded inert JSON admission
owner. Strict Ajv compilation exists only in tests until root integrates the
canonical loader. Neither module imports the other or any legacy implementation.
The outline was recorded before source work; source identity and raw commands
are retained in the author packet.

## Stored article semantics

The closed request admits query/source as string or null. Optional null, empty
or blank values are absent; strings are trimmed then clipped at 240/60 UTF-16
units, preserving case and the source's possible half-surrogate boundary. The
source supports neither a `q` nor `search` alias. Limit defaults to 20 and is a
strict integer from 1 to 50. Root approved the explicit exclusion of legacy
numeric strings, booleans, null limits, fractions and out-of-range clamp values;
non-string/non-null selectors also refuse. Full legacy coercion is not claimed.

Rows preserve id/source/title/url/author/publishedAt/summary/categories/topics.
IDs and URLs are stored strings without invented UUID or URL-format rules;
author alone is nullable. Null stored summaries project to the required empty
string. Title and summary are normalized whitespace excerpts bounded by 240
and 400 UTF-16 units, including valid truncated half-surrogate outputs. An
exact-limit literal need not end in three dots; the validator cannot infer
whether hidden source text was omitted. Repeated category/topic strings remain
valid because their stored arrays have no uniqueness guarantee. Extra source
columns such as feedUrl, agencies, syncedAt and raw content are not projected.

Published dates are newest first, with ties allowed, and article IDs are unique.
Dates use a declared canonical comparable four-digit JSON instant wire policy;
no midnight or ambient-now constraint is imposed on stored timestamptz values.
This excludes alternate offsets, omitted milliseconds, leap seconds, invalid
calendar dates and expanded years rather than claiming all historical Date
wire strings are admitted. Date shape does not establish publication truth or
freshness.

The exact source selector and request limit bind results. Keyword matching can
occur beyond the returned excerpts; the validator does not fabricate a second
search implementation. The list and total are separate stored observations,
so total may be below returned length, or positive when a concurrent list is
empty. No pagination, terminal absence, full-article or whole-corpus guarantee
is invented. Metadata states `countScope:'separate-local-count'` and denies
authority, connectivity, producer qualification and absence evidence.

## Dataset metadata semantics

The only request is a closed empty object. The result projects
`tool/generatedAt/datasets`, where summaries contain
`key/description/supportsAsOf/fields`, and fields contain
`name/type/description/filterable/groupable/aggregatable`.
The six exact types are string, number, boolean, date, timestamp and string[].
All projected booleans must be present; defaults belong to the source registry
projection and are not silently filled by validation. Aggregatable is true
exactly for number. Filterable/groupable are independently typed flags, and
supportsAsOf is descriptive metadata, not permission to choose a time or query
rows. Dataset keys and field names within each dataset are unique; names may
repeat across datasets.

The contract does not copy private registry contents or pin an installed
registry instance. Empty or future typed metadata lists are admitted as shape
compatibility, not as a claim that the frozen source registry is empty or that
new fields are approved. Exact installed registry identity, defaults, instance
membership and completeness remain source-adapter qualification obligations.
Descriptions remain inert strings. No raw table, column, expression, SQL,
query spec, row, limit or access grant is projected. Metadata explicitly denies
`queryAuthorized`, `rowAccessAuthorized` and `registrySnapshotQualified`.
The separate `query_global_data` capability is not implemented or authorized.

## Source, authority and evidence

Six relevant immutable reference pairs are pinned at
`fd8765ec01d292013758606204f2c9d886cd31c1` and compared with observed
`4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`; all match. The metadata-only receipt
contains paths/blob IDs/sizes/hashes and projection locators. It retains no
private body. Article field/null types come from IntelArticle in Prisma, with
summarizeText's projection semantics independently inspected. Dataset vocabulary
and projection come from the declared registry types and summary projection;
raw registry SQL/expressions are neither retained nor imported.

The source wrapper checks active execution; existing route role/service guards
and trusted tenant identity still apply. The selected article path makes two
stored reads under withSystem, with no provider call or write in that path.
The dataset summary path is a pure registry projection plus generatedAt.
Those observations do not grant access or establish physical cancellation,
release safety, current authorization, source qualification or global query
permissions. Cooperative cancellation does not itself roll back started DB work.
No live producer, database, service, provider, model, native runtime or cloud
operation was executed here.

| Check | Actual result |
| --- | --- |
| Focused new families | 31/31 pass, captured patch exactly bound to source commit |
| Full source checks at frozen source | 1,321/1,321 pass |
| Public distribution | Generated/type checks and 7/7 tests pass |
| Original preservation | All 6,001 blobs unchanged; six new allocated source/test paths |
| Reference drift | Six exact pairs unchanged |
| Native/source/SQL/provider qualification | UNRUN |

All three command captures used the byte-identical accepted Linux subreaper,
with a 120-second bound and only each newly owned process group. Every group
was absent at completion; five exited descendants were reaped, with no timeout
or group kill. Root/contracts dependencies were physically copied from the
accepted prior worktree; no package installation, lifecycle scripts or lock
change occurred, and borrowed trees were untouched. Raw outputs and exact
command/head/diff identities remain preserved. Independent source acceptance
is owned by the separate reviewer; root owns integration and ledger updates.
Public 0.1, shared loader/catalog, original tests, frontend, proxy, worker,
runtime and infrastructure remain unchanged.
