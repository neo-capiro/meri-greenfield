# Regulatory docket source contract

Source `57e09ebfda15d6057bdf4bfb7fc84b4061eac03f`, tree
`485860a7d9b2d4cf1e9f19a45c00cd80213ca088`, adds one private DTO family for
`query_regulatory_dockets`. Base `a3e946c1fa264ae7b33205f5b87804ee1ef75773`
retains all 6,110 original blobs. Three product/test files and the pre-code
outline at `96604969426a93e51f4f3d3f3ed1b6ca9a1244fd` are the only additions
in this source freeze. Root owns registry/loader integration; no operation was
registered or connected here. The full 139/96/43 capability scope is unchanged.

`createRegulatoryDocketsValidators({validateShape,schema})` owns the closed
schema `urn:meri:retrieval:regulatory-dockets:0.2.0`, definitions
`RegulatoryDocketsQueryInput/Output`, and the prefixed input/output-definition,
normalize, shape-validation and output-assertion functions. The exported
`REGULATORY_DOCKETS_OPERATION_IDS` contains the single operation. All transport
admission uses the existing `snapshotOperationData`; no query implementation,
clock, persistence, authorization layer or legacy source module is imported.
Future canonical binding requires `contextKeys:[]` and the output assertion
with the original request. Direct component-shape validation does not replace
that complete relational assertion.

Input normalization returns frozen `{input,metadata}`. Absent/null upcomingOnly
becomes false; true selects the upcoming branch. Limit is an integer 1–50,
default 20. Days is an integer 1–365, default 30 only in the upcoming branch.
Root explicitly approved refusing legacy numeric strings, null limits/days,
fractions and out-of-range clamp inputs as a narrower typed admission policy.
The producer's permissive clamp is not described as a defect. Optional
agencyId/documentType are string or null, trimmed then clipped at 40/80 UTF-16
units with case preserved; blank/null becomes absent. Supplied selectors
irrelevant to a branch remain in the normalized request/hash, without claiming
that the source applies them there. Upcoming ignores agencyId/documentType;
ordinary ignores days. Unknown selectors, paging and model authority refuse.

The result retains all fourteen raw scalar columns with explicit required
nullable fields. The primary key is stored String without @db.Uuid; IDs and
document IDs have no invented UUID grammar. Titles remain raw text, including
whitespace. Stored dates have no invented midnight, comment-start/end or
freshness relationship. Wire dates use a declared narrower canonical comparable
four-digit JSON-instant policy; not all historical Date wire values are admitted.
Primary IDs and separately unique document IDs cannot repeat in one result.

Ordinary total/list are separate observations, so total may be below returned
length or positive with no rows. Rows obey the request limit and exact agency
and document-type filters. Nonnull posted dates descend with ties; exact null
placement remains a source-adapter obligation, not a claim of full ordering.

Upcoming total is the one service query's returned window length, capped at 50,
before the wrapper slices it. Results therefore contain exactly
`min(total,limit)` rows and windowDays matches the request. They are not
withdrawn and have nonnull ascending comment-end dates. The pinned service uses
elapsed milliseconds, with inclusive endpoints; returned endpoints may span at
most `days * 86400000`. This is a necessary consistency check only. The source
query clock is absent from the result and differs from the wrapper generatedAt.
No comparison to generatedAt establishes window membership, current comment
eligibility or freshness. Metadata explicitly denies authority, source
connectivity, producer qualification, absence evidence and current-window
qualification; countScope distinguishes both branches.

Seven source/policy reference pairs at
`fd8765ec01d292013758606204f2c9d886cd31c1` match observed
`4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. The packet records only names,
locators, blob identities, sizes, hashes and derived projection facts. The
selected service paths perform stored reads; no provider or write is invoked
there. Existing trusted route/role/tenant, configured service-secret and active
request controls remain separate requirements. A projected global row is not
an access grant; current authorization and actual source behavior remain
unqualified. Private code was read and parsed as data, never copied, imported,
compiled or executed.

| Check | Actual outcome |
| --- | --- |
| Focused actual validators, strict Ajv and canonical resolver | 23/23 pass |
| Pinned source/policy metadata predicates | 24/24 pass; seven pairs unchanged |
| Source preservation | All 6,110 original blobs unchanged |
| Full/public-distribution suite | UNRUN in this lane at root direction; root owns later combined checks |
| Native, database, provider, service, cloud and runtime | UNRUN |

The focused capture retains exact command, pre-commit patch, source head and
raw streams. Its owned group 222862 was absent without timeout or kill. The
accepted subreaper is byte-identical; no descendants remained. There were no
failed focused controls or source repairs in this lane. Dependency access used
only the root-authorized existing targets through two author-owned symlinks;
no install, lifecycle script or dependency mutation occurred. Only those links
are removed at closeout. Public 0.1, original tests, shared owners, proxy/worker,
frontend and runtime are unchanged. Independent acceptance belongs to the
separate reviewer. Source/current authorization, clock qualification and all
runtime gates remain HOLD.
