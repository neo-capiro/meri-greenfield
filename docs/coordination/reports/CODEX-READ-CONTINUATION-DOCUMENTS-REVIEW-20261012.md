# Independent client-document source review — 2026-10-12

Reviewer gateway_reviewer, isolated `review/meri-client-documents-20261012`, base `e94865529c5a1e97c79893527895f0b4b73be35f`. Read AGENTS, implementation standards and `CODEX-READ-CONTINUATION-20261012.md`. Only the new independent test, this report and `read-continuation-20261012/documents-review/**` are owned. Author gateway_author owns source repairs; root owns canonical registration/integration. No recursive delegation or runtime, service, native, SQL, provider, cloud, package, frontend or customer action.

## Criteria frozen before candidate

1. Trace exact pinned registration, actual list/read result projections, document-input/cursor helper, extraction/readability DTOs and current visibility/wall owners at Capiro `fd8765ec01d292013758606204f2c9d886cd31c1`; compare observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. Record hashes and derived field/policy findings only. No copied/imported/executed private implementation. A missing named result DTO is not itself a blocker.
2. Use the existing canonical inert JSON admission, schema/hash/subject primitives and private family pattern. No public contract/dependency/migration/state store or live adapter. Model client/document/query/cursor selectors are not authority; require explicit current trusted identity/context to the extent supported by the allocated contract and report missing gateway consumption honestly.
3. Preserve list/read modes, declared defaults and bounds, unsupported/coercing/injected-field refusal, ordered listing and filename filtering versus content query semantics. Preserve nullable versus omitted metadata, extraction status, disclosure, truncation and coverage distinctions. No empty/denied/unreadable result becomes source-wide absence or complete evidence.
4. Independently test content/query/client/document-bound continuation, section identity/content hashes, character offsets and end ranges using UTF-16 code units where the producer does. Check Unicode and split-surrogate boundaries, section advancement and row provenance, query match/no-match behavior, original request lineage and next-action consistency. Distinguish opaque source-issued cursors from authenticated current source authority.
5. Exercise positive nonempty list/read projections and meaningful substitutions in record identity, content/provenance/coverage/readability, stale cursors, malformed hashes and wrong client/query/section. Opaque extraction metadata remains bounded untrusted data, never a new proof object or permission. Unsupported/pending fields refuse rather than being silently manufactured.
6. Reject getters, proxies, hidden/symbol/exotic/cyclic/oversized input before effects; preserve original inputs and existing resolver snapshot ownership. Standalone pure shape/correlation validation cannot prove source freshness, client wall, extraction fidelity, provider entitlement, complete history, delivery or acceptance.
7. Freeze controls and tested source identities, preserve raw failures and rerun exact author repairs without weakening assertions. Audit original source/public/locks/catalog/tests and schema pins. Use the existing subreaper capture and verify owned physical exit. Return explicit ACCEPT_SOURCE/HOLD with exact refs, check counts, cleanup and source/runtime limits. Source connectivity remains unavailable; the approved memory administrator exception is unchanged.

Initial traced owners: tool registration and `readClientDocuments` projection in `meri-tools.service.ts`; `DocumentReadInput`, internal cursor and extracted-document projection in `meri-document-read.helpers.ts`; readability declarations in `attachment-pdf-vision.ts`; corresponding helper tests. Candidate API and detailed reference trace pending.

## Exact source decision

**ACCEPT_SOURCE** for source freeze `6e37343f7289ed8374b722d638f5d6e467f9808a`, tree `12d8f588011843693a18fa9d4f5a2e9a51f55b32`. Author evidence head `751ece0f3b8aa024174f46beff415daca60a102f` changes no source. Acceptance covers the private client-document family, not canonical registration, current policy, live extraction or runtime qualification. Root owns the missing binding/subject gateway consumer and unavailable descriptor integration.

Criteria and five initial source identities were frozen at `d853759c9b523da4028d87915bd462a0926d8cdc`; initial independent controls at `f63a2c549f82570341fc2c1c04b68daa715efd83`; query failures and exact draft identities at `8812bf569437858fe469cfd049305c6470e2492f`; added boundary controls and repaired draft at `39aa34ffc9eb95406617df5c5032c41210005ab5`. All review-only commits must be preserved in order. Review merges are not review-only commits.

| Accepted source | SHA256 |
| --- | --- |
| `client-documents.schema.json`, 21288 bytes | `71dd53119af2c0226372916e3645765687e8653da2f48b60d55c1a7a75c05247` |
| `client-documents-validation.mjs`, 12683 bytes | `a545d51cda2e8d430ebb66f739524f55fc243ac87a923ea96dc140bab50c10e9` |

The factory reuses canonical inert admission and subject/hash validation. It normalizes one selected client into list/read variants and correlates a new Meri `{binding,subject,data}` envelope. Supplying that envelope is not authorization. The source has no adapter, source request, provider call, mutation, cursor signer or alternate permission engine.

## Findings, failures and exact checks

The first 20 independent controls passed against the draft. Before their first execution, the independent fixture was corrected to use the actual `document:` read-cursor prefix, and an optional source-root selector was added for the isolated author worktree. No assertion was removed. Capture Git-head/diff fields describe the review worktree; separately retained tested-source hashes identify the prefreeze author files. The optional selector is unnecessary after the exact author is merged.

Two added query controls exposed actual draft acceptance gaps: a reported match could lack the literal query in its returned text, and a matched partial page could omit its evidence record. The 24-control run retained **22 PASS /2 FAIL** and stable source hashes before/after execution. The author added a matched-result guard requiring a record and a case-insensitive literal match. Both original negative controls remain unchanged.

That guard is a deliberate stricter truth boundary. The legacy helper searches lowercased text, then applies the index to original UTF-16 text. Lowercasing some Unicode characters expands their length, so the legacy projection can misplace an excerpt while still reporting a match. The new contract refuses that misleading result; this review does not claim the producer universally supplied the stronger relation or that Capiro was repaired/executed.

Five additional controls exercise list continuation, no-match disclosure, JSON-escaped text limits, astral-character splitting and partial OCR. Repaired draft **29/29 PASS**. Exact committed-source replay passes **56/56**: unchanged independent 29 plus author 27. Coverage includes positive list/read/unreadable/no-match/partial OCR cases, required/null/default grammar, full context and record lineage, UTF-16 offsets, cursor identity/content/query/section hashes, complete-section digest, projection counts/order, readiness, source limits and hostile JSON refusal.

The exact 6,500-character limit is for `JSON.stringify(textSlice).length`, not the entire result envelope; earlier progress wording suggesting an envelope limit is superseded by this trace and executable tests. Query/document/cursor text-selector limits use JavaScript UTF-16 length explicitly. JSON Schema code-point limits alone do not enforce them. A continuation may split a surrogate pair because the source pages UTF-16 code units; the corresponding positive control preserves section-hash lineage. No normalization deletes content to manufacture completeness.

The read-only reference/source audit passes **62/62** after correcting an audit matcher. Its first failure expected a nonblank ternary condition where the producer uses the inverse blank condition with an empty-array branch. Initial audit source and raw failure remain in `audit-source-initial.py` and `source-audit.*`; corrected `audit-source.py` tests the actual equivalent relationship. No production code or independent assertion changed for that audit correction. An optional TypeScript-package discovery returned MODULE_NOT_FOUND; no package was installed and the audit uses existing Python/Git tooling.

The author additionally retains its original **23/24** excerpt-bound failure and **24/24** repair: unqueried text had incorrectly received the 240-character query allowance. The final source applies that allowance only when a query exists. This reviewer independently checks the repaired unqueried limit. Author original source snapshots and all failed raw receipts remain in its evidence lane.

Exact commands, from the repository root:

```sh
python3 docs/qualification/candidates/read-continuation-20261012/documents-review/capture-reaped.py exact-freeze node --test packages/contracts/test/retrieval-client-documents-independent.test.mjs packages/contracts/test/retrieval-client-documents.test.mjs
python3 docs/qualification/candidates/read-continuation-20261012/documents-review/capture-reaped.py source-audit-corrected python3 -I -B -S docs/qualification/candidates/read-continuation-20261012/documents-review/audit-source.py /workspace/capirov2 docs/qualification/candidates/read-continuation-20261012/documents-author/source-references.json
```

Labels are write-once; subsequent runs need new labels. These commands exercise synthetic contracts or immutable local source metadata only.

## Reference trace and required authority

All 12 referenced files are independently verified by Git blob, bytes and SHA256 at `fd8765ec01d292013758606204f2c9d886cd31c1`; each remains unchanged at observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. The audit records only reference identities and derived checks. It does not import or execute private source, and raw evidence contains no private source bodies.

Registration and the actual tool projection establish list/read selection. List searches filenames, uses ordered identity continuation and returns metadata rather than document text. Its cursor does not cryptographically bind query, client, snapshot or grant. First-page completeness and terminal pagination are distinct; resumed listings cannot claim a complete original enumeration merely because the final cursor is null.

The helper's cursor/input/extracted-document declarations establish the closed read cursor and section/range/hash relationships. The cursor is unsigned correlation data. It neither authorizes the actor nor authenticates current source bytes. Full returned section text permits checking its reported section hash; partial text and zero-record results do not expose the unseen section needed to authenticate that hash. Original-byte contentHash remains a reported value until the trusted source owner checks actual bytes.

AttachmentTextSection, DocumentReadability and ReadinessVerdict establish source/section kinds, optional paired spreadsheet rows, exact readability fields and all nine blocked-reason codes. Readability, section metadata and returned ranges must agree. Partial OCR stays incomplete; an unreadable section stops automatic traversal and retains an explicit gap. No-match applies only to the selected searched section. Complete extracted text does not prove visual/diagram coverage, source authenticity or global absence. Opaque extraction metadata remains inert reported JSON; nested approval or completeness text gains no authority.

The source policy chain separately checks current client visibility/walls, parent/client/viewer access, nonsuperseded file version and attachment readiness. Reference tests describe malware refusal, authorized server byte hashes/scan disclosure, cancellation around byte download/extraction, blank sections versus whole-file index, tenant credential/cache isolation and partial/malformed OCR output. These tests were inspected as references, not executed. A usable attachment with a scan disclosure is not automatically a clean-scanned attachment.

The actual extraction owner can invoke OpenAI PDF transcription and record extraction outcomes. The list owner can internally obtain download/preview URLs even though this projection omits them. Pure contract acceptance performs none of those effects and grants no permission for them. A future adapter needs explicit effect admission and current-authority/release qualification. Current scope, actor, tenant, wall, version, freshness, provider entitlement and byte authenticity cannot be inferred from a shape-valid wrapper.

## Preservation and cleanup

The exact source commit preserves **5,267/5,267 original tracked files** from the allocated base. Only the new schema, validator, focused author test and outline are added. Existing schemas/validators, original tests, loader/catalog, public contracts, locks, 139-capability inventory, proxy/runtime/native scripts, worker, infrastructure and frontend remain unchanged. This lane does not yet change the 20 mapped/76 selected-unmapped ledger or 21 unavailable typed operations. The approved memory administrator exception remains unchanged.

Reviewer groups 146559 (first 20), 146962 (retained two failures), 148271 (repaired draft), 148414 (exact 56), 149440 (audit failure) and 149718 (corrected 62) are absent in their subreaper receipts. None required timeout, kill or orphan cleanup. No other owner's process was touched. Original author cleanup receipts remain separate.

Actual source/byte reads, extraction, current authorization, provider/model calls, state writes, native/runtime services, database, cloud and customer access are **UNRUN**. No installs or external package acquisition occurred. Source connectivity remains unavailable; G1 stays OPEN and G2–G7 unentered. Canonical integration and live gateway binding/subject consumption require separate acceptance.
