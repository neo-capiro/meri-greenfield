# Independent regulatory docket source review

**ACCEPT_SOURCE** for `57e09ebfda15d6057bdf4bfb7fc84b4061eac03f`, tree `485860a7d9b2d4cf1e9f19a45c00cd80213ca088`, based on `a3e946c1fa264ae7b33205f5b87804ee1ef75773`. native_supervisor_author authored the new private family; readiness_author independently reviewed it in `review/meri-regulatory-dockets-20261012`. This verdict accepts the source boundary for `query_regulatory_dockets`, before canonical registration. Runtime/source access remains unavailable.

Criteria and seven paired reference identities were frozen in `4c57922dc8d7eb1c8584f2ec5bf88ca8e0537762`. The 26 initial independent controls were prepared in `558a31c` before candidate import `d340365c2a6f75291a158f8d6d45a0de81b28044`; all passed unchanged on first replay. Two appended controls bind the explicit qualification metadata and direct output helper. No production defect or failed source test was found.

The source correctly distinguishes an ordinary independent count from the upcoming service's capped 50-row window. Ordinary total may be zero with nonempty returned rows. Upcoming total is at most50 and returned length is exactly `min(total,limit)`. Upcoming ignores ordinary agency/document-type selectors; those supplied values remain in normalized input without being applied as filters. The family preserves all14 required raw fields, nullable storage values, generic string IDs, uniqueness, free text and signed/date relationships without inventing a UUID constraint or content enums.

Upcoming rows are nonwithdrawn with nonnull ascending end dates and a span no larger than the declared elapsed-day interval. Those are necessary relationships only. The actual service clock is absent and contextKeys is explicitly empty: `generatedAt` is an independent wire timestamp, never the service clock or proof of current comment eligibility. Ordinary nonnull posted dates descend; exact null placement is left as an explicit adapter qualification obligation. Source truth, full-window membership and completeness remain unqualified.

Intentional compatibility restrictions are explicit: root approved strict integer limit/days admission and rejection outside1..50/1..365, excluding the legacy producer's numeric-string coercion and clamping. Default limit20 and upcoming-only default days30 remain. Selectors trim and clip40/80 UTF-16 units, with null/blank omitted. Canonical four-digit JSON instants and safe nonnegative counts are narrower wire admission. No currentness, authorization, start/end ordering or sync/modified relationship is invented.

The cohesive module reuses only the canonical inert snapshot helper; it adds no source client, resolver, authorization engine or ambient clock. Hostile operation and schema-definition selectors are refused without coercion effects. Caller input/result data remains unchanged and the normalized bundle is detached/frozen. Metadata explicitly denies authority, source connection, producer qualification, absence evidence and current-window qualification, and names the two count scopes. An initial reviewer interface note incorrectly abbreviated metadata as empty; this was corrected transparently after inspection, with no failed assertion or production change.

| Verification actually run | Result |
| --- | --- |
| Initial independent replay | 26/26 passed unchanged |
| Complete focused family run | 51/51 passed: 28 independent +23 author |
| Exact source/reference/schema/receipt audit | 58/58 passed |
| Original base blob/mode preservation | 6110/6110 unchanged |
| Immutable Capiro reference pairs | 7/7 unchanged across both pins |
| Final author packet metadata | 44/44 passed; all12 manifest members verified |

All test captures have zero skips and retained raw stdout/stderr, source/diff identity and cleanup receipts. Broad/public/gateway/integration suites were deliberately not repeated in this lane; root owns the later combined run. No native33/9, service, database, provider, model, cloud, image, frontend or customer-data operation ran. Two dependency preparation ENOSPC failures are preserved as honest summaries of tool readbacks (the first was truncated), not fabricated complete raw streams. Only the reviewer-created partial copy was removed, then parent-approved read-only dependency links were used. A guessed metadata filename and a guessed outline-report path were corrected by source/tree discovery without implying those paths existed.

Candidate changes are precisely three allocated source/test additions plus the pre-code outline. All previous public0.1, private catalog/registry, capability ledger, tests, source, failure evidence and native/proxy/worker/infra/frontend files remain unchanged. No original inventory scope or mapping count is changed by this unregistered family. Current role/request-active checks and source provenance require later runtime qualification.

Evidence lives under `docs/qualification/candidates/read-continuation-20261012/regulatory-dockets-review/`. The read-only `audit.py` binds exact source and private reference metadata without publishing or executing producer bodies. The final manifest binds this report, independent tests and lane evidence. Four owned process groups223089,223546,230640,232685 exited and were absent; both borrowed dependency links were removed and their targets were never mutated.

Final author packet `6d0ce36bed11605d49f97c363ee0ce29657a6293` preserves the same source. Its12-member manifest SHA256 is `66718412380284a6d9034eca9157a3b967b1bcbbc1c9fa74b5855e8788a8f3cd`. Independent metadata verification checks every member, seven paired reference hashes, original author23-test raw streams and the exact captured dirty-source patch from outline9660496 to source57e09eb. The author initial capture is honestly bound through that patch; independent first and final family replays ran with zero source diff. No author verifier/build-schema/producer script was executed by the reviewer.
