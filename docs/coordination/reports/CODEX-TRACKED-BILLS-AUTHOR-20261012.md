# Tracked bill private contract

## Outline before implementation

Exact base `a3e946c1fa264ae7b33205f5b87804ee1ef75773`, isolated branch
`task/meri-tracked-bills-20261012`. Own only new tracked-bills schema/validator,
focused test, this report and tracked-bills-author evidence. Root owns shared
loader/catalog/registry. Source stays disabled; no SQL/private source execution.

Read unchanged AGENTS/implementation standards/R2 source and ownership boundaries.
Trace immutable fd8765ec projections/types/policies and compare4be13b0b identities.
Only seven approved small existing dependency packages are copied locally; no
installation, hooks, large dependency tree or native binary execution.

Proposed factory createTrackedBillsValidators({validateShape,assertSubject,
canonicalSha256}) supplies normalizeTrackedBillsInput(request,options) and
assertTrackedBillsResult(result,request,options). Required schema ID is
urn:meri:retrieval:tracked-bills:0.2.0. Proposed closed context binding/subject/
clientReference reuses current canonical one-client subject while explicitly
binding the normalized original lookup reference. UUID reference must also match
subject UUID case-insensitively; name lookup is a trusted adapter assertion,
not recreated by pure validators. This context and result binding/subject wrapper
are new Meri source contracts, not legacy wire fields or proof of current access.
Root approved this exact source-only context/interface before implementation.
No current visibility or wall enforcement is established, and no trusted context
producer is connected.

Preserve complete returned count, no invented page/50-row cap, tenant/client
tracking scope, unique tracking IDs and bill IDs (source unique client/bill),
createdAt descending with ties, nullable global enrichment and exact identifier
correlation. Enumerate all nested scalar/null/array types; do not infer current
bill visibility or legislative status. No schema/handler/catalog activation.

Use canonical snapshotOperationData for direct inert admission, canonical subject
and hash validators for lineage. Test-only Ajv family compilation until root
registration, adversarial shape/context/order/count/null and resource-budget
controls. Capture focused offline tests and metadata/preservation checks with
existing subreaper; preserve failures and owned group exit evidence.

## Implemented source boundary

Schema definitions TrackedBillsContext/Request/Input/Bill/Row/Data/Result are
closed. Factory/API and the root-approved context are as outlined. Raw required
clientId is trimmed and sliced at80 UTF-16 units, with a new raw transport ceiling
of16384 Unicode code points. It must match the trusted clientReference exactly;
a UUID-shaped reference also case-insensitively matches the resolved subject UUID.
The name-to-ID association is not calculated or authenticated by this contract.
Normalized input is exactly {clientId: resolved subject ID}.

Private result {binding,subject,data} preserves legacy data fields tool/generatedAt/
clientId/total/bills. Binding and subject must exactly match trusted context;
source clientId and complete returned count correlate. Tracking IDs are UUIDs;
primary IDs and stored unique(clientId,billId) prevent repeated tracking identities.
Outer rows descend by createdAt; tie order remains unspecified. No tracking row,
action-text or subject-name cap/page/limit is invented. The canonical bounded JSON
admission refuses a whole oversized response instead of slicing it.

Each tracking row contains id/billId/note/createdAt/bill. Global bill can be null;
otherwise its identifier matches billId and all nine nested keys are required:
identifier/title/latestActionDate/latestActionText/status/actionTexts/sponsorName/
sponsorParty/subjectNames. Stored nullable text stays nullable; arbitrary status
strings and opaque/empty bill IDs are not replaced by a fabricated enum or identity
parser. SQL ARRAY produces actionTexts strings; subjectNames coalesces to an array.
No order or uniqueness is inferred for those text arrays. Global latestActionDate
is a nullable SQL date at UTC midnight; outer createdAt is a timestamp, not a date.

Date admission requires finite canonical four-digit UTC Date.toISOString values.
Expanded-year serializations are deliberately outside this typed schema; source
runtime cannot be declared incapable of them. Counts are safe nonnegative integers.
Model authority keys, unknown fields, getters, proxies and non-JSON data refuse.
These are explicit new admission boundaries, not source completeness guarantees.

## Authority and integration limits

The frozen helper named ensureClientVisible resolves a tenant/nonarchived UUID or
case-insensitive client name. Its inspected predicates contain no actor/wall check.
The new binding/subject/clientReference context is therefore an explicit trusted
resolver assertion whose producer is not connected; it does not establish current
visibility, wall enforcement or source access. Canonical assertSubject enforces
its existing structural lineage, not scope.resourceId authorization. Tests retain
that limitation instead of inventing a second policy engine.

Null global enrichment is not proof that a bill does not exist. Returned tracked
count is not all legislative relevance or current legislative truth. No global
bill current-visibility proof is asserted. Root owns registry/loader integration;
search_tracked_bills remains selected/pending/null and source connectivity disabled.
No source bodies, SQL/query implementation, provider code or runtime were imported,
copied or executed. Only DTO/projection/storage/policy metadata and identities are
published. Public contracts, original schemas/locks/tests and all native paths stay
unchanged.

## Failure, repair and checks

Initial author26/26 PASS did not characterize standalone return ownership. The
independent reviewer then reproduced a real alias defect: the validator checked
an admitted snapshot but returned the caller's original object, so later caller
mutation changed the accepted client identity. Exact three-file preimage, initial
26-pass receipt, and independent findings are preserved. The author added an
observable mutation control and reproduced26 PASS/1 FAIL before changing source.

The narrow repair returns the validated snapshot. No validation or source-field
correlation was relaxed. The former positive return-identity assertion deliberately
became detached/deep-equal to implement the corrected return contract; all other
original assertions remain. Added caller-mutation regression passes. Final focused
suite27/27 PASS. Raw initial/failed/repaired outputs remain in the evidence packet;
owned groups237686,237854,237989 absent, no timeout or kill. No broader/public/native
suite was run. Independent exact-source acceptance is still required.

Exact source freeze `e020f4ff2af3c23412adf2fd634f8362140eeb51`. Repaired tested file hashes
match committed source byte-for-byte. Metadata audit43/43 PASS; four pinned/current
source references unchanged and6,110 base files byte-identical. Owned group238520
absent, no timeout/kill. All checks are focused source or metadata; no current
source authority, native runtime or deployment acceptance is claimed.

Evidence-only closeout: the final diff check failed on two trailing-space lines
in unchanged raw Node assertion output. The exact failure was captured as
whitespace-before (Git exit2), including its own raw diagnostic. Scoped
.gitattributes marks only those two raw stdout files -text/-diff; no failed
stdout bytes were rewritten. Source/docs whitespace checking remains active.
whitespace-after passes exit0. Owned groups245395/245492 absent, no timeout/kill.
Source e020f4f is unchanged; packet3014188 remains preserved.
