# Federal drafting workbench — scope decisions and refusal reasons (1 November 2026)

Handoff item M34. This record states what the source implements for the close criteria (official source import with hash and location → replace/insert/delete → operative, consolidated and redline → review → export and history, with any revision invalidating a prior approval) and resolves the advanced-format scope explicitly. Owners: compiler and custody `apps/artifacts/federal-drafting`, routes `apps/control/document-application/federal-workbench.mjs`, public contract `packages/contracts/federal-workbench` (1.3.0).

## Decisions

| Area | Decision | Where |
|---|---|---|
| Official import | Exact five-pin Core read, retained as an immutable TXT envelope with the text SHA-256, source locator, publisher and version; re-read against Core on every later use. | `source-custody.mjs`, `federal-import` |
| XML / USLM | **Supported** for retained USLM extractions through the workbench: section identity from declared `identifier` attributes, exact markup edits inside identified elements, result re-read as one well-formed document. Not supported: USLM XSD/DTD validity, decoded text-run anchoring, node replacement/renumbering, DOCTYPE sources, non-USLM XML/HTML, the frozen SDK tool (`prepare_federal_draft` stays flat). Each unsupported case is an explicit refusal below. | `uslm-source.mjs`, `native-source.mjs` |
| Hierarchical amendments | Supported: declared nested scopes (`federal-scoped-text/2`, `federal-uslm-xml/1`) with ancestor paths; an ancestor edit that consumes or crosses a descendant invalidates that identity. Official plain-text imports stay one flat scope. | `scoped-application.mjs` |
| Overlapping amendments | Supported: repeated edits of one scope, parent-then-child and child-then-parent edits, bound by exact intermediate hashes and explicit dependency closure. | `engine.mjs`, `test/redline.test.mjs` |
| Whole-section repeal | Supported: delete of the section's exact text (flat) or of the element span through its parent (nested/USLM); one delete segment. | `test/redline.test.mjs`, `test/uslm.test.mjs` |
| Whole-source repeal | **Refused explicitly** (`DRAFT_WHOLE_SOURCE_REPEAL_UNSUPPORTED`): a proposed repeal of the whole instrument is not a text amendment and has no exact consolidated text. No empty document or placeholder bytes. | `engine.mjs` |
| Redline | Deterministic typed segments (unchanged/delete/insert), adjacent same-kind segments merged, byte- and hash-stable across runs and request key order; original and consolidated text reconstruct from the segments. | `engine.mjs` |
| Review approval | Store rule in `review-record.mjs`: approval is an immutable child version of the approved review bound to that revision hash; any revision is unapproved by construction; a stale approval is an invalid record. | `federal-approve`, `federal-load`, `federal-history` |
| Export | TXT operative/consolidated/redline (exact bytes) and a DOCX dossier through the canonical Word owner. Every export title carries the revision hash; the operative text, redline and dossier carry the source SHA-256 and citation; responses carry source artifact pins, revision hash and the approval relied on. | `federal-publish`, `dossier.mjs` |
| History | `federal-history` pages the immutable review chain with each version's revision hash, source pins and approval state. | `federal-history` |

## Refusal reasons the UI can label

All compiler refusals are released with status 422, `code` as below and `operationId` (the refused operation, or null). The public receiver validates the shape (`FederalError`).

| Code | Meaning | Suggested label |
|---|---|---|
| `DRAFT_SOURCE_FORMAT_UNSUPPORTED` | A plain-text baseline begins with markup, or a USLM baseline is not markup; the SDK tool received markup. | Source format not supported for this path |
| `DRAFT_USLM_NAMESPACE_UNSUPPORTED` | XML whose root is not in a USLM namespace (for example HTML). | Not a USLM document |
| `DRAFT_XML_DOCTYPE_UNSUPPORTED` | The XML declares a DOCTYPE; external definitions are never resolved. | DOCTYPE not supported |
| `DRAFT_XML_ENCODING_UNSUPPORTED` | The XML declaration names a non-UTF-8 encoding. | Non-UTF-8 XML not supported |
| `DRAFT_XML_MALFORMED` | The source is not one well-formed XML document. | Malformed XML source |
| `DRAFT_USLM_IDENTIFIER_INVALID` / `DRAFT_USLM_IDENTIFIER_DUPLICATE` | An `identifier` cannot become a scope id, or repeats. | Unusable section identifier |
| `DRAFT_USLM_SCOPE_LIMIT` | More than 1024 identified elements. | Document too large to identify |
| `DRAFT_USLM_SCOPES_MISMATCH` | A retained envelope declares scopes the markup does not carry. | Source scopes do not match the XML |
| `DRAFT_XML_RESULT_MALFORMED` | An edit would leave the document not well-formed (for example a bare `<` or `&`, or a changed root). | Edit breaks the XML document |
| `DRAFT_WHOLE_SOURCE_REPEAL_UNSUPPORTED` | The operations leave no consolidated text or remove the root element. | Whole-source repeal is not an amendment |
| `DRAFT_TARGET_MISSING` / `DRAFT_TARGET_AMBIGUOUS` | The exact anchor is absent, or occurs more than once, in the scope. | Text not found / text not unique |
| `DRAFT_ANCESTOR_CHANGED` | The expected scope hash does not match the current intermediate text. | Scope changed since the operation was prepared |
| `DRAFT_DEPENDENCY_REQUIRED` / `DRAFT_DEPENDENCY_INVALID` | A prior change of this text is not in the dependency closure, or a dependency is unknown. | Operation order not declared |
| `DRAFT_SCOPE_INVALIDATED` / `DRAFT_SCOPE_UNKNOWN` | The target or an ancestor was consumed by an earlier edit, or does not exist. | Section no longer exists in this draft |
| `DRAFT_NO_CHANGE` | A replace equals its anchor, or the result equals the source. | No change |
| `DRAFT_OPERATION_INVALID` / `DRAFT_SELECTION_INVALID` / `DRAFT_SOURCE_INVALID` / `DRAFT_SCOPE_INVALID` / `DRAFT_SCOPE_MISMATCH` / `DRAFT_SOURCE_MISMATCH` | Shape, bound or hash failures of the operation, selection or source. | Invalid draft input |
| `DRAFT_OUTPUT_LIMIT` / `DRAFT_OUTPUT_UNEXPORTABLE` | An output exceeds the compiler or artifact contract (the DOCX dossier has its own Word bound). | Output too large to export |
| `DRAFT_SOURCE_CHANGED` / `DRAFT_SOURCE_FORMAT` | The retained source artifact hash changed or is not a federal envelope. | Source artifact changed |
| `DRAFT_REVIEW_CHANGED` (409) | The saved review no longer recompiles to the named revision, or a cited review carries another revision. | Review changed; reload |
| `DRAFT_REVIEW_INVALID` (422) | The retained record is malformed or its approval names another revision or parent. | Review record invalid |
| `DRAFT_REVIEW_ALREADY_APPROVED` (409) | The version is already an approval. | Already approved |
| `DRAFT_SOURCE_STALE` (409) | Core no longer serves the exact official selection. | Official source changed |
| `UNAVAILABLE` (503) | No current Core reader for official sources. | Official source reader unavailable |

## Remains live-only

- The real official source fetch and currency (Core serves retained extracted text and hashes; this repository never fetches a publisher).
- Whether a given retained extraction is USLM XML or plain text (determined by the retained evidence at import).
- The DOCX renderer image for the dossier; the request is exact, the bytes are the renderer's.
- Frontend admission of `federal-approve`, `federal-history`, `reviewVersionId` and the `docx` output (the proxy forwards a fixed route list), and the package version/pin update.
- Live acceptance, Office/legal fidelity and independent review.
