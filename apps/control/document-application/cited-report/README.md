# Cited Report

The installed general long-form cited report: `quick_skill.cited_report` 1.0.0, selected explicitly, producing
one editable seven-section Word report (Summary, Scope and as-of, Findings, Conflicting evidence,
Recommendations, Limitations, References) from the trusted selected subject's own authorized source reads.

It is not Bill Watch and not a copy of it: no bill, session, chamber or fiscal-year subject is required,
invented or aliased, and the congressional report recipe and its pins are untouched.

## Files

- `manifest.json` — this recipe's installed identity at manifest contract version 0.3.0, its declared sources
  and its real allowed operations.
- `SKILL.md` — the installed prose; its bytes are pinned by the manifest and by `packages/skills/assets.json`.
- `input.mjs` — the private typed input: model-supplied narrative plus real read locators, never the subject.
- `sources.mjs` — the general source adapters: the real operation request of each declared source, admission of
  the returned typed result through that source family's own canonical receiver, and the evidence the result
  actually carries.
- `compose.mjs` — the compiler: one decisive typed read per distinct cited locator, seven-section blocks,
  conflict/disclosure semantics, immutable revision provenance.
- `binding.mjs` — recipe correspondence for the artifact options and the retained-evidence admission.
- `skill.mjs` — the immutable identity/prose pins and the operation references of this manifest.
- `test/cited-report.test.mjs` — the recipe's own proofs, driven through the recipe's real read seam.

## Read seam

The trusted selected runtime hands a compiler `readSource({binding,window,subject,operation,request,signal})`,
which returns the operation's canonical typed result. This recipe uses exactly that seam — no envelope, no
second retrieval loop and no authority of its own — and admits each returned result with the receiver the
source family already owns (`assertMailThreadSourcePage`, `assertResearchPortfolioEvidenceOutput`).

## Caller join

The installed identity is dispatched by the shared selected execution path
(`apps/control/conversations/skills/execution.mjs`, `quick_skill.cited_report` 1.0.0), which compiles through this recipe,
retains the prepared report and proposes the immutable document write; `test/cited-report-caller.test.mjs`
exercises that join with the real selected caller.

## Finding status

An `excerpt` finding is `verified` only when its single mail citation is byte-verified AND the finding text is
exactly the passage read; a quote that differs from the stored characters is refused
(`CITED_REPORT_CITATION_UNPROVEN`), never printed as verified. A `claim` finding is model prose: it is `cited`
when every citation is byte-verified and `claimed` otherwise. A portfolio citation records the projection's
own revision, content hash and calculation version beside the locator, and a revision refuses a fresh read
that reuses a retained citation id with different content, record or version.
