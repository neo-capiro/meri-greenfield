# Client document contract author outline

Base `e94865529c5a1e97c79893527895f0b4b73be35f`; only allocated new schema,
validator, focused test, author report and this evidence lane. Root owns loader,
registry and catalog. Use canonical snapshotOperationData, injected validateShape,
assertSubject and canonicalSha256; no new compiler or authorization engine.

Factory createClientDocumentsValidators exports normalizeClientDocumentsInput
and assertClientDocumentsResult. Context is exactly canonical binding + subject;
the subject is one selected client and raw clientId is required to match it.
ClientDocumentsInput / ClientDocumentsSelection / ClientDocumentsResult describe
list and read modes. A new Meri {binding,subject,data} wrapper carries either
unchanged list projection or read-page projection; it is not a legacy field or
proof of current access. Selection normalizes defaults and explicitly retains
cursor, decoded read cursor binding and listAfter. Closed read cursor contents
correlate document/client/content/query/section/offset and optional section hash;
unsigned cursor data is not authority or a source authenticity proof.

Validate UTF-16 ranges and returned text lengths, record/reference/hash
correlation, serialized text ceiling, progress, list coverage, no-match and
unreadable-page distinctions, optional row provenance, declared readability,
extraction truncation and metadata. Never recreate extraction/search/provider
implementation. Metadata remains bounded inert JSON where the source declares
unknown JSON. Full-section hashes can be recomputed from returned text; partial
section hashes cannot establish unseen text truth.

Frozen extraction owner checks current parent/viewer access, current version,
readiness and client walls; it can also write extraction outcomes and invoke
OpenAI for PDF visual fallback. This pure contract executes none of those
operations, and read-only user intent does not authorize them. Both source
adapter side-effect admission and current policy require later qualification.
Descriptors stay unavailable/null/pending, source connectivity false.

Record immutable projection/type/policy/test hashes at fd8765ec and disclose
drift against observed 4be13b0b without copying private source. Use test-only Ajv
until root integration; meaningful list/read/hostile/continuation/truth controls.
Capture with the supplied subreaper, retain failures and verify owned exit.
