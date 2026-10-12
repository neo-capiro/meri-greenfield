# Trusted memory context implementation outline

Author gateway_author; separate reviewer gateway_reviewer; integration owner root.
Base `5db2714b6dcbd3109c528e0afafcb654216133ca`; isolated branch
`task/meri-trusted-memory-context-20261012`. Root approved this interface before
source edits. No publication or delegation; 35-minute soft author budget.

Add only `dispatchProfile: 'memory-proposals/1'` to the canonical memory operation
binding. Raw contract APIs and schemas remain unchanged. Existing canonical
shape validation admits inert parsed arguments before an authority preflight;
the preflight sees raw/defaultable input and supplies the server-owned subject.
Normalize using that subject and reauthorize normalized input; stable authority
must match before effects, after results and before release. Decision IDs may
refresh but actor/tenant/run/fence/policy/subject selection may not drift.

Gateway modules: operation-context selects the canonical dispatch profile;
memory-read-context owns validation of caller-injected continuation ports and
bounded retained-record receipts; read-result-envelope validates the private
memory wrapper and delegates raw result validation to the existing family.
tool-dispatch remains the coordinator, using existing lifetime and budget owners.
Legacy 13-operation behavior is preserved. No second operation registry, grant
engine, model loop or production in-memory store is introduced.

Trusted port API: `loadPrevious({key, signal})` returns raw JSON
`{record, checkedAtMs}`. Record is exactly `{key, previous:{request,page},
previousSha256, recordedAtMs, expiresAtMs}`. Key is exactly `{binding, operation,
policyRevision, subject, cursor}`; binding is the full RunBinding and subject is
current validated subject selection without the per-check decision ID.
`retain({record, signal})` returns raw JSON `{decision:'retained', keySha256,
previousSha256, checkedAtMs}`. Missing, stale, future, mismatched or corrupt facts
fail closed. Times must be safe integer epochs; all ports use the current lifetime.
Retention expiry is bounded by the minimum observed authority and retained-record
expiry. Existing family validation checks cursor, limit and previous page order.

The memory-only private result wrapper is exactly `{binding, subject, operation,
argumentsSha256, result}`. It binds effect authority and normalized request, and
contains the unchanged raw memory DTO. Retain a nonterminal page only after valid
release authority, then settle and reauthorize before releasing output. Late
ignored writes/settlement cannot release output; physical stop and storage
durability remain unproved. No proposal becomes an approved fact or absence proof.

Owned source paths: tool-dispatch, new operation-context/memory-read-context/
read-result-envelope modules, new memory-context test, and the one approved
catalog-validation metadata field. No other contracts, locks, public exports,
catalog.json, descriptors, index/authority/lifetime source or original tests change.
All 14 real descriptors remain null/unimplemented/pending, production connectivity
false and discovery empty. Real store adapters, task-native recovery, authority,
source lineage and G1 runtime qualification remain separate dependencies.
