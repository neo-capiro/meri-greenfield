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

## Caller join (owed, not landed)

The installed identity is selectable today, but this recipe is not yet connected to the shared selected
execution path. The exact two-span delta is recorded in `work/hermes-implementation/report-native-bridge/`:
the control-service compiler branch and the worker-side SDK output dispatch/format. Those spans are owned by
the selected-runtime owner and are applied on its release, not here.
