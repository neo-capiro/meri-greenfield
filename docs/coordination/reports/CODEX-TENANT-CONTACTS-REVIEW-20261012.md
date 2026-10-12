# Canonical contact repair follow-up

**ACCEPT_SOURCE** for root repair `1e31f94bb8e399eede1f28609cb241b87e356b62`, with author-test correction `e890cff6d1110a1d29bd5dec0b7f340db0e41f06`. The schema now uses `urn:meri:retrieval:tenant-contacts:0.2.0`; both result branches return their validated detached snapshot. The narrow byte audit confirms exactly those changes.

Three new unchanged controls first reproduced **34 pass / 3 fail** on original `0aba55ef`: normal and refusal outputs retained caller identity, and the schema namespace was noncanonical. The first repaired replay preserved **61 pass / 2 fail**, because the original independent and author tests asserted the previous same-reference API. Those assertions were explicitly superseded with deep-value preservation; new nested detachment controls remain unchanged. The final focused replay passed **63/63** (37 independent plus 26 author), no skips. All three owned process groups were absent and every raw failure remains retained.

This intentionally changes returned reference identity. It does not change projected values, selectors, authorization, timestamps, count semantics or source availability. The earlier verdict below covered the standalone DTO; it did not establish canonical composition. The canonical follow-up manifest is authoritative for current review files; the original manifest and verifier remain historical and are verified against `5e5d6abe11091fda90dd07b2701b8b2e85e1b718`. Broad/public and runtime checks were not repeated in this lane. Current authority, source connectivity and all native/G1 gates remain **HOLD**.

---

# Independent tenant-contact review

**ACCEPT_SOURCE** for `0aba55ef096a68a3cfd92f770783dec3fddfea22`, tree
`2a84b8964b23b4ebd178bfe619376680b9a21f6f`, limited to the private
`find_contacts` DTO family. Criteria were frozen at `92670d9` before candidate
inspection. Author packet `15969416f8ba0b6f4cc9b6bb44237946a3a38ab7` and its
documentation-only clarification `62aafb3ad8bef0bc6520c82ed3bb6ff2a75a630c`
are independently bound; product source is identical in both.

The pure `createTenantContactsValidators({validateShape})` factory exposes
`normalizeTenantContactsInput(request,options={})` and
`assertTenantContactsResult(result,request,options={})`. Normalized input contains
nullable clientId/domain/query plus the bounded limit. Context is closed empty;
it is not a substitute for the source's trusted tenant/current actor. The family
reuses canonical inert JSON admission, adds no query implementation and does not
register, connect or authorize the operation.

The review confirms selectorless refusal versus normal envelopes; finite legacy
number/string limit conversion and clamp; distinct post-truncation trims;
UTF-16 clipping and lowercase expansion; and the nine-field contact projection.
Six fields are nullable. Stored names, email, phone, organization and source remain
opaque strings without invented email/telephone enums or identity uniqueness.
Client is a separately resolved reference: the native UUID storage constraint
supports the returned client ID format, while input aliases need not equal it.
No contact ID is projected.

Selection is trusted tenant AND (linked client OR domain OR query). The DTO must
not turn that into a client-only filter or require all selectors to match each
row. Necessary NULL-field eligibility checks do not prove database collation or
full OR membership. Unreturned client-domain/profile facts, organization fallback
and current visibility remain source-adapter obligations. Source history reads
use tenant plus normalized email; the separate owned-mail/calendar access helpers
are not invoked by this producer. No stronger actor-private correspondence policy
is inferred from the DTO.

A blank normalized email has no history lookup. Positive mail counts can have a
null timestamp, and calendar history can exist with zero mail count. The selected
meeting is the latest attendee by creation time, not necessarily the latest of
all meetings. Returned history ordering is checked within the admitted wire range;
no timestamp is compared to generatedAt to invent freshness. onProfile and note
counts correlate with the returned window without proving profile authenticity.
The exact source note is inert guidance and grants no deferred profile-write
permission.

Typed admission excludes unknown/hostile fields and wrong scalars, caps raw text
at 16,384 Unicode code points and limit strings at 128, and requires safe integer
counts. Date admission is canonical four-digit UTC ISO; valid native expanded-year
Date.toISOString strings are excluded. The author clarified this restriction and
the limits of OR-membership checks in documentation only. Both original packet
and clarification are preserved; no production correction was necessary.

| Check | Result |
| --- | --- |
| First independent focused controls | 33/33 pass |
| Added disclosed date-boundary control; exact final suite | 34/34 pass |
| Independent source/policy/type metadata, including note hashes/templates | 33/33 pass; eight reference pairs unchanged |
| Source, receipt, preservation and both author manifests | 72/72 pass |
| Author focused receipt, independently byte-audited | 26/26 pass |
| Broad/public, native, SQL/provider/service/cloud/runtime checks | UNRUN in this lane |

The 6,110 original blobs remain unchanged, preserving public 0.1, private/shared
owners, original tests and the full 139/96/43 scope. Candidate additions are three
product/test files and the author report. The clarification changes only that
report and its manifest. Both 14-member author manifests match exactly. Initial
author tests used untracked new files; their separate explicit size/hash receipt
matches all three committed product/test files. That limitation is retained rather
than treating an empty captured Git diff as sufficient source binding.

All three independent captures used the retained bounded subreaper; their owned
groups were absent without timeout or kill. No independent source assertion
failed. The reference audit first passed 31 checks; adding both exact normal-note
template comparisons produced 33/33. Only allocated dependency symlinks are
removed at closeout; installed targets are unchanged. Private source was parsed
as data, never imported/executed, and no private bodies were published.

**HOLD** remains for canonical registration/composition, current tenant and client
visibility, actual contact/history/profile/domain provenance, source qualification,
physical cancellation/release and every native/G1 runtime gate. This verdict adds
no send, update, provider, model or customer-data authority.
