# Fable lane report: da-artifact-internals (15 October 2026)

- Lane: `da-artifact-internals`. Branch `fable/a4-artifact-internals-20261015`, base `ba40647c5b6f1f81773869e41ce82c099d64d505` (audited shared candidate).
- Audit: `docs/coordination/audits/meri-comprehensive-20261015/data-artifacts-report.md` on `origin/dot/meri-comprehensive-audit-20261015`, findings DA-2 and DA-3.
- Commits: `73a9ca04` (DA-2), `2e805616` (DA-3), plus this report. Not pushed. Waiting for dot's review.
- Nothing deployed, no cloud, credential, migration, model or provider action, no lockfile or contract edits, and no system packages installed.

## Implementation outline

| Responsibility | Owner | Change |
|---|---|---|
| Choosing a generator for each format, including the PDF route that renders a fresh DOCX and then converts it | `apps/artifacts/local-executor.mjs` | A PDF request that carries a base now fails with `ARTIFACT_REVISION_UNSUPPORTED`. This happens before any temp directory, interpreter or converter is used. |
| Python generator dispatch | `apps/artifacts/python/entry.py` | Second guard: the run fails with `BaseFormatMismatch` if a retained base's recorded format differs from the generation format, or if a non-TXT base is not a ZIP package. The check runs before any parser opens the bytes. |
| Slide geometry | new `apps/artifacts/slide-layout.mjs` | Pure, deterministic layout calculated in integer EMUs. It does not import PptxGenJS and does no I/O. |
| PptxGenJS rendering | `apps/artifacts/presentation.mjs` | Only applies the boxes from `layoutSlide`. |

Dependency direction: `presentation.mjs` imports `slide-layout.mjs`, and `slide-layout.mjs` imports nothing. There are no cycles and no public contract changes. The service, the version store, the canonical schemas and the application format admission are unchanged. PDF is still rejected by `format-admission.mjs` and is not newly admitted.

## DA-2: closed

A PDF revision used to send the retained PDF bytes to python-docx, which failed with `BadZipFile`. The PDF route renders a fresh DOCX intermediate and does not keep it, and no PDF revision owner exists. So a PDF revision is now refused with a closed code instead of being sent to the wrong parser. I chose refusal because both repair routes need a decision from dot (see proposals below).

Tests are in `apps/artifacts/test/pdf-revision-dispatch.test.mjs`. They use a structurally complete PDF 1.4 file (exact xref offsets, checked in the first test) and a converter port that is labelled synthetic.
- Executor test: a spy records every interpreter launch. A PDF revision causes 0 launches and 0 converter calls, and leaves the temp root empty. Positive control: creating a PDF still runs one DOCX build, and the converter receives a ZIP (DOCX) intermediate.
- Python entry test: both a PDF base and a PDF mislabelled as DOCX fail with `BaseFormatMismatch`, not `BadZipFile`, and no output is written. Positive control: a genuine DOCX base still revises.
- Service test: create, then download/inspect, then revise, then replay the same revision. Both revise attempts give the same closed refusal with no generator launch and no object write. Budget settlements are completed, failed, failed. The parent bytes stay exactly the same.
- Opt-in real LibreOffice variant: skipped unless `MERI_ARTIFACT_SOFFICE` is set.

Before and after:
- At the base: 1 pass, 3 fail, 1 skip. The failures reproduce the audit: `ARTIFACT_PROCESS_FAILED` with inner `BadZipFile`.
- After the fix: 4 pass, 0 fail, 1 skip.
- Reverting only the executor fix fails the executor and service tests. Reverting only the entry guard fails the entry test.

## DA-3: closed

`layoutSlide` gives each element on a slide (bullets, table, chart, image, in that order) its own cell in the content area: 0.5in side and bottom margins, starting 1.2in from the top, below a 0.3–1.0in title band, with a 0.3in gap between cells.

| Elements on the slide | Layout |
|---|---|
| 1 | One full cell |
| 2 | Two columns |
| 3 | A full-height left column and a right column split into two rows |
| 4 | A 2x2 grid |

- Tables get explicit equal column widths and row heights capped at 0.45in, and the frame equals the grid exactly. The font is sized to the row height, from 6 to 14pt.
- Images are fitted inside their cell without being enlarged, cropped or distorted, and are centred.
- Title font steps from 26 down to 14pt and bullet font from 18 down to 8pt by estimated wrapped lines. Both have shrink-on-overflow set (`normAutofit`).
- An empty `bullets` array draws nothing.

Tests are in `apps/artifacts/test/presentation-layout.test.mjs`. They run real PptxGenJS 4.0.1 through the executor and read geometry back from the generated OOXML: `p:sp`, `p:graphicFrame` and `p:pic` positions and sizes, `a:gridCol` widths, `a:tr` heights and `p:sldSz`. They cover:
- all 16 combinations of the four elements, with notes on some slides
- dense and extreme fixtures: a 200-character title, 30 long bullets, a 30x12 table, a 100-category by 10-series chart, and 12x12in, 12x0.5in and 0.5x12in images

They assert:
- each element is drawn exactly once
- every element lies inside the slide
- no two elements overlap
- table grid and row sums stay within the table frame
- images are not cropped, keep their aspect ratio within 1%, and are never enlarged
- geometry is identical across two generations

Before and after:
- At the base: 0 of 2 pass, failing with "slide 7 (table + chart): table overlaps chart" and the image aspect check.
- After the fix: 2 of 2 pass.
- Reverting `presentation.mjs` fails both again.

## Other checks run (Node 24.21.0, focused per file)

- I ran every `apps/artifacts/test/*.test.mjs` file and `apps/artifacts/independent/*.test.mjs` at the base and after DA-2. Pass/fail counts were the same for every pre-existing file. The failures that exist here, at the base too, come from the host:
  - `/opt/codex/.../node/node_modules/pptxgenjs` is missing, so `artifact-execution` and `artifact-adapters-independent` fail at import.
  - There is no explicit Postgres or source root, which affects the postgres and replay suites.
  - `matplotlib` is missing.
- To exercise the existing deck tests, I ran temporary copies of `artifact-execution` and `artifact-adapters-independent` with the PptxGenJS path pointed at `apps/worker/qualification/node_modules`, then deleted the copies.
  - Before and after DA-3 the results were the same: 32 of 34 and 9 of 9.
  - The 2 failures (Word chart, analysis chart) are caused by the missing `matplotlib` at both points.
  - The existing multi-slide deck tests pass with the new layout.
- `python3 apps/artifacts/test/test_word_revision.py`: OK.
- Local LibreOffice 24.2.7.2 render (local evidence only, not native qualification): I converted a 17-slide deck (the 16 combinations plus a dense slide) to PDF and looked at the rasterised pages. No frames overlapped and nothing was clipped at the slide edges. The rendered files are kept outside Git.

## Unrun or blocked checks

- Native open and render in PowerPoint: UNRUN, not available here. Text fit for arbitrarily long strings is not proven by OOXML geometry. Bullet and title shrink is a hint to the renderer, and a native renderer can grow table rows when cell text wraps past the row height. The dense 30x12 table in a quarter cell is the clearest case.
- The opt-in real LibreOffice PDF create path, run with `MERI_ARTIFACT_SOFFICE=/usr/bin/soffice`, fails deterministically on this host (3 of 3 runs) with `ARTIFACT_CLEANUP_FAILED`.
  - The conversion itself exits 0.
  - The failure is that `process.mjs` reports the process group still present (`groupAbsent:false`) immediately after the group kill.
  - It happens during create, before the DA-2 change matters. It is outside this lane and needs a separate host or process-supervision investigation. No soffice process was left behind.
- I did not run real S3, Postgres, a renderer sandbox, the product image or the held-out benchmark.

## Proposals for dot

1. PDF revision route. Choose one before admitting PDF:
   - (a) Keep and bind the DOCX intermediate and its spec with each PDF version. This changes the version or inspection contract.
   - (b) Define a PDF revision as a full re-render of the revised typed spec from the default template, with exact-parent lineage. Every PDF in a lineage already comes from a fresh default-template DOCX.

   Until then, `ARTIFACT_REVISION_UNSUPPORTED` is the closed answer.
2. Dense slide content: either accept layout plus native-render qualification, or add contract-level density limits for combined elements (for example a maximum number of table rows when sharing a slide). Any limit would be a contract proposal, not an edit.
3. The Codex-host absolute paths in the existing artifact tests could accept `MERI_PPTXGENJS` and `MERI_DOCUMENT_PYTHON`, as the new tests do. This would be a separately scoped test-only change.

## Residual risks

- Text-fit sizes are heuristic estimates (average glyph width of 0.55em), not measured glyph metrics.
- The 2x2 layout gives a table only a quarter of the content area.
- The audit's other findings (DA-1, DA-4) and the missing routes or previews are not part of this lane.
