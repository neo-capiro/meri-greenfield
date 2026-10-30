# Office fidelity qualification (SCRUM-241)

Narrow acceptance checks for the two PPTX embedded-chart-workbook losses and the
XLSX equivalent-currency-format case. They exist because the previous corpus
checks only counted `ppt/embeddings/*.xlsx` parts and compared cached values, and
both are blind to the actual damage: the retained pre-fix saves drop the workbook
part, the chart `externalData` element and its package relationship while the
cached values stay identical, and the exported series formulas degrade to
LibreOffice-internal names (`label 0`, `categories`, `0`).

Nothing here builds an image, starts CODE, touches the retained corpus, saved
artifacts, reports, keys or certificates, or writes outside the caller's output
directory.

## Checkers

### `chart-workbook-fidelity.py`

Resolves the real package graph and compares data, not counts:

```
ppt/slides/slideN.xml
  --ppt/slides/_rels/slideN.xml.rels--> chart part
    --ppt/charts/_rels/chartN.xml.rels--> package target (embedded .xlsx)
      --> cells, formulas and shared strings of that workbook
```

* Charts are matched by **slide part plus document order of the chart
  relationships**, never by chart part name and never by cached values. Saving
  renumbers the parts (`chart2`/`chart3` become `chart1`/`chart2` in pptx-04)
  and keeps identical caches, so neither name nor cache identifies the data.
* Series formulas must still be sheet ranges; internal names fail.
* Workbook cells and formulas must equal the original exactly, unless
  `--expect-edit Sheet1!B2=9` names the cell the intentional editor edit changed,
  in which case every other cell must still match the original.
* `[Content_Types].xml` must carry the spreadsheet override for the workbook part
  and the relationship type must be the OOXML `package` relationship.

```
python chart-workbook-fidelity.py --original <in.pptx> --saved <out.pptx> \
  [--expect-edit Sheet1!B2=9] [--json report.json]
```

### `currency-semantics-check.py`

Keeps the raw strict difference visible (`strictRawFormatEqual`) and adds a
semantic equivalence proof:

* resolves each cell's effective format through `s` -> `cellXfs` -> `numFmts`,
* canonicalises escapes, quoted literals and `[$SYM-LOC]`, so `$#,##0.00` and
  `\$#,##0.00` are the same format,
* renders the actual value through the format on both sides,
* rejects changed currency symbol, precision, grouping, sign section, literal
  text, numeric value or formula.

```
python currency-semantics-check.py --original <in.xlsx> --saved <out.xlsx> \
  [--cell B5] [--json report.json]
python currency-semantics-check.py --self-test
```

`--self-test` is the rejection control: it runs the real retained format pair
plus mutated currency, precision, grouping and value variants and fails if any
material change would be accepted.

## Cases

`cases.json` pins the three affected corpus inputs by SHA-256 and the chart slots
each one must resolve. The pinned corpus, the retained pre-fix saves and the
existing CODE/WOPI/Core fixture live outside this repository (see the dated
handback); these checks read them read-only.

## Running the offline gate

```
sh run-offline-checks.sh <corpus-inputs-dir> <saved-artifacts-dir> <output-dir> [fixed|prefix]
```

* `fixed` (default) is the acceptance gate for saved artifacts from the fixed
  candidate: the chart workbooks must be preserved.
* `prefix` is the sensitivity control over the retained pre-fix saves: the chart
  checks **must** reject them.

Use absolute paths, and `PYTHON=` to select the interpreter. Both checkers are
pure standard library.

## Native flows

`native-chart-flows.mjs` drives the existing qualification host through
open, no-edit Save, reopen, unrelated title edit, intentional chart-data edit and
reopen again, writing each stage's exact saved bytes and screenshots to its own
output directory, then runs the offline checkers on those bytes. A stage whose
editor control is unavailable is reported `NOT RUN`, never passed.

It requires a running host that serves `/fresh/<case>`, `/state`, `/saved/<case>`
and `/verify/<case>`, which is the existing CODE/WOPI/Core fixture. Those flows
have not been executed yet: they need the fixed native candidate, which is built
and deployed by the release owner, not here.

## Boundary

These checks are qualification only. A green offline run on a candidate's saved
bytes is not acceptance of the deployed editor; authenticated open/edit/Save and
the deployed chart behavior remain required.
