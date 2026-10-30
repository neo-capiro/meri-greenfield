# Office fidelity qualification (SCRUM-241)

Acceptance checks for the two PPTX embedded-chart-workbook losses and the XLSX
equivalent-currency-format case. They exist because counting `ppt/embeddings/*.xlsx`
parts and comparing cached values is blind to the real damage: the retained
pre-fix saves drop the workbook part, the chart `externalData` element and its
package relationship while the cached values stay byte-identical, and the
exported series formulas degrade to LibreOffice-internal names (`label 0`,
`categories`, `0`).

Nothing here builds an image, starts CODE, a host or a browser, or writes to the
corpus, the retained saves, reports, keys or certificates. Every input path is an
explicit argument; there are no default hosts, identities or outputs.

## `chart-workbook-fidelity.py`

Chart identity starts at the document: each slide's actual `c:chart` nodes, in
slide document order, resolved through that slide's relationship table by `r:id`.
A relationship record no slide references is not a displayed chart, and the order
of records inside the relationship part is not identity. The slot is
`(slide part, ordinal of the c:chart node)`, so chart part renumbering and
relationship reordering cannot change the mapping.

Per slot it resolves chart part -> `c:externalData` -> chart relationship ->
package target -> embedded workbook, then requires:

* every series role (name, category, value) that referenced a range still does,
  with a non-empty formula;
* that range resolves to a sheet and cells that exist in the connected workbook;
* the chart cache equals the values those cells hold (stale cache and a wrong
  chart-to-workbook association both fail);
* without an expected edit, cells, formulas, series ranges and caches equal the
  original;
* with `--expect-edit '<slide>#<ordinal>:<Sheet>!<Cell>=<value>'`, the edited cell
  holds that value, the chart cache reflects it, and every other cell and every
  other chart stay unchanged.

```
python chart-workbook-fidelity.py --original <in.pptx> --saved <out.pptx> \
  [--expect-edit 'ppt/slides/slide1.xml#0:Sheet1!B2=9'] [--json report.json]
```

## `currency-semantics-check.py`

Equivalence is narrow and conservative: only escapes (`\X`) and quoted literals
are removed, and only when escaping is provably literal. Escaping a control
character (`*`, `_`, `[`, `]`, `?`, digits, separators, `%`, `@`, `;`) is never
called equivalent. Fill (`*x`) and spacing (`_x`) directives, brackets, digits,
separators, percent, date tokens and section separators must match exactly. There
is no format renderer, so no unsupported syntax is silently dropped.

The strict raw-format difference is always reported separately
(`strictRawFormatEqual`), and cell values and formulas are compared exactly.

```
python currency-semantics-check.py --original <in.xlsx> --saved <out.xlsx> \
  [--cell B5] [--json report.json]
python currency-semantics-check.py --self-test
```

## `test-controls.py`

Durable controls that build real ZIP packages from the retained originals in a
scratch directory and run the actual checkers over them, including: disconnected
slide `r:id`, removed formulas, nonexistent range, reordered relationship table
(must stay valid), orphan relationship record (must not count as a chart),
renumbered chart parts, wrong chart-to-workbook association, coherent single-chart
edit, stale cache, cache-only change, the two distinct pptx-04 edits (B2=9 and
B2=11), a missing second edit, edit bound to the wrong slot, a disturbed unedited
chart, the retained pre-fix save, and the currency material-change vectors.

```
python test-controls.py --corpus <corpus inputs> [--saved-dir <retained saves>] [--scratch <dir>]
```

Exit 0 only if every control behaves; 2 if the corpus was not supplied (never a
silent pass).

## `native-chart-flows.mjs` and `isolation-adapter.mjs`

Stage order per case: open -> no-edit Save -> reopen of that saved identity ->
unrelated title edit + Save -> intentional chart-data edit + Save -> reopen and
re-check of the post-reopen bytes -> canonical Core `/verify` body.

Two retained-fixture facts are handled explicitly:

* `GET /fresh/<id>` creates a new document on every call, so reopen must address
  the saved identity instead. The flow hashes the bytes before and after reopen
  and fails the stage if they changed.
* the retained host resolves its output relative to its own script URL
  (`font-corpus/saved/<id>`, `continuous-native-results.json`,
  `continuous-recovery-private.json`), so a caller-side `--out` does not isolate
  host writes. `materializeRunRoot()` copies the retained host and its modules
  into a new run root whose `run-root.json` records the isolated output paths and
  the copied inputs' hashes; the retained tree is not modified.

Every origin, identity, module and output path is an explicit argument and there
is no default host. Run-scoped identities that match the retained corpus pattern
(`pptx-04`, `pptx-03-restart`, ...) are refused. A missing editor control is
`NOT RUN`; any error after an edit or save has begun is `FAIL`; and any `NOT RUN`
makes the whole run `INCOMPLETE` with exit code 3, never 0. Stage results are
written to `stages.json` after every stage, including on failure.

The editor driver (Playwright selectors for the title placeholder and the chart
data table, scoped to the intended chart slot and cell) is not committed: those
controls are unverified until they run against the fixed candidate, so the flow
reports `NOT RUN` rather than guessing. That is why no native stage is claimed
here.

```
node native-chart-flows.mjs --origin <isolated host origin> --identity <run id> \
  --original <pptx> --out <dir> --cases <cases.json> --checker <checker path> \
  [--editor <module> --selectors <file> --playwright <module>] [--python python]
```

## `test-flows.mjs`

Inert tests for the orchestration and the adapter, with no host, port, browser or
CODE process: reopen that re-seeds fails, a missing editor control is NOT RUN and
the run is INCOMPLETE/non-zero, a save error after the edit is FAIL, the `/verify`
body is inspected rather than the status, stage results persist on failure,
unsafe origins and retained identities are refused, and run-root materialization
keeps host writes away from the retained tree.

```
node test-flows.mjs [--scratch <dir>]
```

## Running the gate

```
sh run-offline-checks.sh <corpus-inputs-dir> <saved-artifacts-dir> <output-dir> [fixed|prefix]
```

`fixed` requires the chart workbooks to be preserved; `prefix` requires the chart
checks to reject the retained pre-fix saves. Both modes also run the control
suites. Use absolute paths and `PYTHON=`/`NODE=` to select interpreters.

## Boundary

These are qualification checks. A green offline run on a candidate's saved bytes
is not acceptance of a deployed editor; the authenticated open/edit/Save and the
deployed chart behaviour remain required, and the ARM64 build, scan and
deployment stay with the release owner.
