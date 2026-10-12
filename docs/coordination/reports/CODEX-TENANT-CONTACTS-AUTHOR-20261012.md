# Tenant contact discovery private contract

## Outline before implementation

Exact base `a3e946c1fa264ae7b33205f5b87804ee1ef75773`, isolated branch
`task/meri-tenant-contacts-20261012`. Own only new tenant-contacts schema/validator,
focused test, this report and tenant-contacts-author evidence. Root owns canonical
loader/catalog/registry; no shared source edits. No native/source/provider/DB calls.

Factory `createTenantContactsValidators({validateShape})` supplies
`normalizeTenantContactsInput(request, options={})` and
`assertTenantContactsResult(result, request, options={})`. Definitions:
TenantContactsRequest/Input/Context/Contact/Result. Context is closed empty data
(`contextKeys: []`), approved by root. Reuse canonical snapshotOperationData.
No result lineage or current grant is fabricated; trusted tenant/current actor,
client lookup/wall and all joined source access remain adapter obligations.

Preserve selectorless refusal versus normal envelope, raw optional client lookup
reference/domain/query normalization and finite number/string limit clamp1..100
(default25), nullable stored contact scalars, normalized history lookup and count,
returned-window ordering, profile flags and exact source-note correlations. No
contact ID is projected; duplicate email/name rows are legitimate. Linked-client,
domain and query are OR within tenant; a selected client does not make this a
client-only search. Client-derived domain and profile sets are unreturned facts.

Schema is closed at every object. Six nullable scalar fields plus messageCount,
source and onProfile form the exact nine-field contact. No arbitrary JSON escape.
Request transport ceilings are new Meri admission limits, not producer source
caps. Native authorization, completeness, email truth, profile mutations, current
correspondence and evidence freshness cannot be inferred from the DTO.

Test a real Ajv family compiler while unregistered; normalization, branch/field
correlations, nullable histories, returned caps/order, duplicate records, hostile
inert admission, no authority extensions and pinned reference preservation.
Capture raw checks with existing Linux subreaper, retain failures and physical
owned exit. Dependencies are read-only symlinks to approved existing trees.

## Implemented boundary

The pure family uses closed Request/Input/Context/Contact/Refusal/Page/Result
schemas. Context stays empty; clientId is a lookup reference, not a current client
subject. Normalization follows UTF-16 slice200; domain and query trim again after
truncation, domain lowercases. Locale-independent lowercasing can expand strings
(e.g. capital dotted I), so no false200-unit post-lowercase cap is imposed. Limit
follows finite number/string conversion, truncation, clamp1..100/default25.

The no-selector response is a distinct refusal with empty contacts and no client
or matchedOn fields. Normal responses always include nullable clientId/clientName,
matchedOn domain/query/linkedClient, contacts and the source note. The validator
checks requested query/explicit domain, selected-client presence, returned cap,
exact note/count/profile correlation and descending lastContact with nulls last.
Client-derived domain and actual profile membership remain unreturned facts.

Every contact has exactly name/email/phone/title/organization/lastContact,
messageCount/source/onProfile. Stored text can be null, blank or non-address text;
no inferred email/telephone grammar or identity uniqueness is added. No normalized
email means no history lookup, so count0/lastContact:null. Positive counts can
coexist with null timestamps; calendar history can coexist with zero mail count.
Returned source dates use finite Date.toISOString serialization. A selected client
permits a linked-client OR match even when name/email do not match other selectors.
Without a client, SQL NULL fields cannot satisfy the supplied field predicates;
the validator does not reproduce database collation or unseen linkage.

The exact joins are fully typed: EngagementContact's five text fields are nullable,
source is nonnull String; Client name is String/website nullable; ClientPerson name
is String/email nullable; MailMessage.receivedAt/fromEmail nullable; MeetingAttendee
has nullable email, nonnull createdAt/meeting; Meeting.startsAt is nonnull. The
producer selects the latest attendee by createdAt, then compares its meeting date
with the latest mail receivedAt. This is not a claim about the latest of all
meetings, all correspondence or contacts outside the returned initial window.

## Authority, compatibility and remaining gates

The pinned query is tenant AND (linked-client OR email-domain OR name/email query).
History joins use tenant plus email. This producer does not call the separate
owned-mail/calendar query predicates inspected for comparison. Therefore no
client-only or actor-private-mail authority is asserted; the current source adapter
must explicitly qualify the applicable tenant/contact/history access and client
lookup/wall policy before any connection. No policy or self-approval rule changes.

The original note mentions proposing update_client_profile. It is preserved as
source guidance only; that deferred write is neither registered nor permitted.
The result has no contact ID, total, cursor, absence proof, freshness proof,
coverage or authorization extension. Organization fallback and onProfile are
source assertions. No original helper/body, reader, query or retrieval
implementation was copied or executed.

Intentional typed admission: reject unknown/hidden/accessor/proxy fields and
wrong scalar types; cap raw text at16384 Unicode code points and raw limit string
at128 characters; require safe integer counts and canonical finite source date
serialization. These transport/admission rules do not claim legacy source bounds.
No new dependencies/locks; approved dependency trees are read-only symlinks.

Canonical loader/catalog/profile/availability integration belongs to root and is
not changed here. find_contacts stays selected/pending/null; source remains
unavailable. Current identity, source reads, database behavior and any native
runtime remain UNRUN. Independent review must precede integration/acceptance.

## Checks

Initial focused author suite:26/26 PASS, exit0; owned PID/PGID223014 absent,
no timeout or kill. Raw receipt/stdout/stderr retained, with explicit identities
for the new untracked tested files. No source test failure occurred in this run.
Two initial guessed certification-family paths were absent at this exact base;
existing disclosures conventions were used instead. Those inspection errors remain
in the interactive transcript and metadata; no failure output was fabricated.

Source freeze `0aba55ef096a68a3cfd92f770783dec3fddfea22`. Metadata audit34/34 PASS; all6,110 base
files byte-identical and4/4 source references unchanged across both pins.
Owned PID/PGID224138 absent, no timeout/kill. Explicit tested file hashes
match committed source byte-for-byte; no redundant broad test run. Independent
review remains pending. No author acceptance or runtime qualification claim.

Independent-review wording clarification: date-time schema admission plus exact
Date.toISOString equality accepts canonical four-digit-year UTC instants.
Expanded-year Date.toISOString values are excluded by this typed schema; this
is an explicit Meri admission restriction, not a claim that JavaScript or the
source database cannot produce them. Validator/schema/test bytes are unchanged.
The necessary nonnull-field guard does not prove full SQL OR membership.
