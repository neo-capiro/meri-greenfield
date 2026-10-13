# Independent artifact review: ACCEPT_ARTIFACT

Reviewed implementation: `7d1024d11e439393de3171a95892b7b0d402c78c`, tree `b74485b502192284644497d5a8b5849b258fe8f1`. This acceptance covers local synthetic artifact behavior and visual/content checks at that exact pin. It does not establish native runtime acceptance, production activation, authentic congressional source access, or completion of the remaining whole-plan requirements.

The reviewer worked in `/workspace/meri-n209-artifact-review`, branch `codex/n209-artifact-review-20261013`, and changed only this evidence directory. Implementation, tests, public contracts, other evidence and native database pins were untouched. AGENTS.md, implementation standards, the N-209 task brief, product README, original SKILL.md/manifest, catalog and canonical artifact/HTTP/fixture owners were read directly. No `.agents/skills` were present. No dependency install, model call, DB operation, private source, credential access, cloud operation or publication occurred in this review.

## Actual editable artifacts and immutable lineage

The independent Python verifier used default installed python3 3.12.14, python-docx 1.2.0 and PyMuPDF 1.26.6. It opened both retained DOCX files directly, compared every one of their 43 editable paragraphs against the complete typed prepared request, changed and saved the title in memory, and successfully reopened the edited document. Retained file bytes stayed unchanged. There are actual Word text runs, title/heading styles, no body drawings used as text substitutes, and no document-protection flag. Original and revision retain identical styles.xml and section properties.

It reconstructed original typed inputs independently from factual records and proposed paragraphs, checked canonical input/read/manifest/catalog/base/provenance hashes, and parsed visible provenance from the actual DOCX body. The revision preserves the original artifact ID, names an exact distinct parent version, and binds the parent's DOCX SHA256, full request/spec SHA256 and provenance SHA256. Original proposed text survives in the original and is replaced by the revised proposal only in the revision.

| Supplied artifact | Bytes | Pages | SHA256 |
| --- | ---: | ---: | --- |
| original.docx | 38,702 | 4 rendered | `569fe1bb22e5d7ed28c4a58b29c873d86790accbb53d322ca1917f7c9218d10d` |
| revision.docx | 38,887 | 4 rendered | `22190d30028c27f7c41a7c4672f3c9407d31dc11bbcf411f321efcf708170f97` |
| original-preview.pdf | 49,413 | 4 | `d70b341cb3a4300019361442b15671e7fcc284701f995be763d1ef89e9961554` |
| revision-preview.pdf | 49,925 | 4 | `8ab252aa07d943236e8161413ba153851dcad7e665013cc643745b72212ac006` |

Supplied original version: `3c48a239-947e-4252-a3ce-b5762146c46f`; revision: `bb1d81a6-7e85-410d-a61e-a4881a8e0a59`. Recomputed exact parent spec SHA256: `94808fe6f594c0f3ab386d7563db9ad64b966ca69e51569412fa4c0fea1cfd5e`; original provenance SHA256: `74d2fe965e74b441759c8c3dad62e2f4d7ccb0af8cdb16d36030cf36637210ef`.

## Decisive passages, boundaries and visible disclosure

Actual DOCX text includes Congress 119, session 2, bill `119-hr-4242`, bill version `ih`, FY 2027, budget stage `authorized`, UTC as-of, facts, proposed language, citation locators and the coverage/verification appendix. No legislative/budget context conversion was found.

For every cited bound passage the independent verifier compared UTF-16 selected source text, exact UTF-8 passage SHA256, full source-text SHA256, record/source IDs and versions, citation UUID, authorization decision UUID, timestamps and exact tenant/client/policy-revision scopes against the full decisive-read envelopes and evidence. It also recomputed source-selector hashes and all six subject applied-filter hashes, checked the run binding, matched SourceEvidence to each version, and compared actual DOCX paragraphs against those records. These are synthetic decisions/read receipts, not independent evidence of live source authenticity.

F1 is an exact byte-bound authorization-only excerpt; its URL is visibly labeled `locator URL (not verification)`. F2 remains `unverified-claim` despite citations, and visibly discloses potentially conflicting cited passages. Both cited passages appear verbatim in the appendix. F3 is `missing-evidence`; its citation remains `missing-or-version-mismatch`, and the unavailable program-elements source discloses unknown freshness/coverage, no verified appropriation or amount, and no negative assertion. Proposed language is explicitly a draft for human review. Hash correspondence is never treated as verification of the free-form funding claim, enacted/current truth, or corpus completeness.

The original `quick_skill.bill_watch` version 1.0.0 prose and manifest were opened directly. Recomputed pins match each DOCX's actual visible provenance:

- Manifest canonical SHA256: `15eb005afa184bc3773b76d97acdc4605da126a1fc73fd7f7609683a7be48065`.
- Prose exact-byte SHA256: `ab862a82247b4bef264f71298d7e4cfa68540d96f48c5e9d2871e769620d1f55`.
- Catalog canonical SHA256: `27db172a756ba1f5b58eb90a843779b5022e581203b0deca728ca278e8dfe968`.

The recipe is one bill-watch artifact output and leaves Claude Agent SDK/Temporal/governance and production source availability gates with their canonical owners.

## All pages independently inspected

The reviewer opened every supplied PNG with `view_image` at original resolution: original pages 1–4 and revision pages 1–4. The independent verifier independently opened each PDF, counted every page, re-rendered every page at 1.25 scale, and confirmed exact PNG byte equality and recorded page hashes/dimensions. All DOCX body characters survive PDF extraction after removing whitespace; every text span's bounding box lies inside its page.

Page 1 contains title/context/facts/citations/proposal and the start of coverage; page 2 contains remaining coverage and F1 binding; page 3 contains F2 disclosure, both passages/hashes/scopes, F3 and the start of provenance; page 4 completes provenance. Every page was readable, with no missing text, clipping, overlapping lines or edge truncation. The long provenance JSON continues onto a sparse page 4, especially in the original. This is a minor pagination/usability note, not a missing-content defect or a reason to alter the frozen renderer. `visual-review.json` records exact image hashes and observations.

The independent observed flow generated two additional DOCX/PDF versions. Both were independently reopened and verified using the same full assertions, and all eight additional PNG pages were opened with `view_image`; they have the same complete readable layout. Total review: four actual DOCX, four PDFs, sixteen individually opened PNG pages.

## HTTP behavior and physical cleanup

One fresh observation reused the production compiler, unchanged real loopback HTTP routes and canonical immutable artifact owners over the existing explicitly synthetic fixture. `observed-lifecycle.json` records all 22 response statuses, hashes and sizes, selected safe headers and error outcomes; it retains no credential values. Existing installed dependencies were resolved through a review-only loader, with no dependency installation or lock changes.

- Full create and exact-base full revision returned 200. All four observed successful inspections, including base reads and reconstructed graph reads, returned `currentBytesVerified: true`.
- The initial original download and original download after revision/reconstruction are byte-identical; the revision download has its own exact object hash. All three downloads returned no-store/nosniff and the correct DOCX MIME type and attachment filename.
- Forged request context, substituted draft text and wrong immutable base each returned 400 `INVALID_REQUEST / NOT_DISPATCHED`; no extra generation occurred.
- The separate store rejected the foreign session with 403 `SESSION_REFUSED / NOT_DISPATCHED`; its own session could not read the other store's version (502 `DOCUMENT_REFUSED / READ_UNAVAILABLE`) and had no generation or consumed budget.
- After explicit revocation, both versions' inspect/download and revision returned 403 `SESSION_REFUSED / NOT_DISPATCHED`; preparation rejected. Generations stayed at two.
- A replayed revision returned 502 `ARTIFACT_BUDGET_RESERVATION_UNKNOWN / UNKNOWN`, with no additional generation; the synthetic ledger retained two SETTLED reservations, zero UNKNOWN reservations and consumed `20` micro-USD synthetic accounting. This proves bounded refusal/no duplicate generation in this scenario, not successful replay reconciliation or end-to-end durable idempotency.

Physical observations after finally cleanup: all eight generation/inspection/render leader `/proc` paths were absent; `/proc` contained no members of their recorded groups; both distinct fixture directories existed before close with only `store`, then were absent; the ephemeral loopback port had no TCP/TCP6 LISTEN entry; server status was closed, not listening, zero active sockets. The bounded capture also observed its owned group absent, no remaining owned children, no cleanup kills, no timeouts, and no reaped orphan descendants. Existing final-flow historical cleanup receipts were examined; the fresh observation supplies direct physical evidence without claiming historical unrecorded storage/listener coordinates can be reconstructed.

## Checks, failures and remaining gates

All three captured checks passed at the frozen source pin with zero implementation diff: supplied artifact verification (0.417 seconds), observed local flow (3.785 seconds), observed artifact verification (0.366 seconds). Capture bounds are 180 seconds, existing render-copy authority is 90 seconds, and HTTP/source authority remains the original 25-second fixture authority. The loader emitted an ordinary Node experimental-loader warning, retained verbatim; it was not a test failure. No independent test failed and no result was omitted. Existing author/first-flow failures and diagnostics were read and remain untouched, including the historical UNKNOWN reservation and source-read receipt mismatch. Exploratory attempts to read nonexistent `scripts/local-research-brief/flow.mjs` and `packages/contracts/retrieval-0.2/artifact*` were corrected to their canonical locations before any check.

All generated artifacts/receipts explicitly keep `nativeQualified: false`; local renders are retained inspection copies and do not qualify previews persisted by a production service. Live source authenticity/currentness, private source attachment approval, SDK selection and durable checkpoint execution, production preview completion, native PostgreSQL preservation acceptance and actual deployment remain separate gates. Source/compiler review is owned independently. No all-51-requirements completion claim is warranted.

Decision: **ACCEPT_ARTIFACT for editable DOCX content, exact source/recipe/base binding, immutable original preservation, full local render/visual coverage and the exercised synthetic lifecycle controls at the reviewed pin. Native/runtime acceptance remains HOLD.**
