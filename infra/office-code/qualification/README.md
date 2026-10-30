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
* each traversed relationship edge is internal: an edge marked
  `TargetMode="External"` on the slide -> chart or chart -> workbook step is a
  failure, not an embedded part of this package;
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
are removed, and only when the unwrapped characters are provably literals —
punctuation, space or a currency sign. A wholly quoted format
(`"$#,##0.00"`) is a constant string, and escaping a letter (`\m`) turns a date
token into a literal, so both are refused rather than called equivalent.
Escaping a control character (`*`, `_`, `[`, `]`, `?`, digits, separators, `%`,
`@`, `;`) is never called equivalent. Fill (`*x`) and spacing (`_x`) directives,
brackets, digits, separators, percent, date tokens and section separators must
match exactly. There is no format renderer, so no unsupported syntax is silently
dropped.

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

Stage order per invocation: open -> no-edit Save -> reopen -> unrelated title
edit + Save -> intentional chart-data edit + Save -> reopen -> canonical Core
verify.

**One invocation = one manifest identity and its own original.** The case
document, the `--identity`, the manifest entry and the original file must agree:
the original's file name must equal the manifest `filename` and its SHA-256 must
equal the manifest hash, checked before any navigation. The two affected
documents are therefore two invocations, and pptx-04 keeps its own two slots
(B2=9 and B2=11). Mixed case definitions are refused.

They speak only the routes the retained public host
(`work/code-native/host-font-corpus.mjs`) actually serves:

| route | use |
| --- | --- |
| `GET /fresh/<label>` | initial open only; resets the document |
| `GET /qualify/<label>` | reopen the existing saved identity |
| `POST /renew/<label>` | refresh editor claims before reopening |
| `GET /state` | observed save sequence |
| `GET /saved/<label>` | the saved bytes |
| `POST /verify/<label>` | canonical persistence evidence |

A label is a corpus manifest id with one of the host's supported suffixes
(`-renew`, `-revoke`, `-expire`, `-restart`, `-lostack`); that is the complete
routable set, so isolation comes from a separate host root, not from invented
route identifiers. Anything else is refused as unroutable.

`--editor` is required and supplies the browser work: `preflight()`,
`navigate(routePath)` (opening/relaunching and awaiting readiness) and `save()`
(the editor's own Save). Save must advance the host's observed sequence;
reopen renews claims and qualifies the saved label, never `/fresh`, and **both
reopens** must keep the bytes and the save sequence unchanged.

Editor controls are resolved in an explicit **preflight** before any work: a
control reported unavailable there makes its stage `NOT RUN` without being
invoked. Once an effectful edit or save method has been called, any error —
including `ControlUnavailable` after a partial edit — is `FAIL`, and the partial
stage evidence stays in `stages.json`. `NOT RUN` makes the run `INCOMPLETE` with
exit 3, never 0.

`materializeRunRoot()` copies the public harness layout into a new root. A new
root alone is not isolation: the public fixtures import their runtime modules by
absolute `file:///.../wave6-capabilities-runtime/...` path and
`core-native-port.mjs` spawns the retained bridge. So it requires an operator
`runtimeRoot` and an isolated `coreBridge` (`{script, nodeExecutable}`), copies
the public modules, and rewrites **only those import/spawn paths in the copy**.
The host then sits at the root it resolves `./cert.pem`, `./corpus/...` and its
sibling modules from, and `run-root.json` records the runtime, bridge,
adaptations and the real output paths (`<root>/font-corpus/saved` in postgres
mode, `<root>/corpus/saved` otherwise).

Everything is validated before anything is written: resolved/real paths for
fixture, runtime, run root, bridge and PKI; overlap and alias refusal; known
public module selection only; manifest `filename` must be a plain file name;
every selected input must match its manifest hash; every absolute runtime import
must resolve under the operator runtime; and fresh operator certificate/key
paths must be outside the retained fixture. Retained TLS is never read or
reused, and the copied modules are never executed by these tests.

The canonical verify body is correlated with the observed artifact: `id`,
`sha256`, byte length and save `sequence` must match what the flow actually
saved and reopened, in addition to the retained boolean evidence.

The editor driver itself (Playwright selectors for the title placeholder and the
chart data table, scoped to the intended chart slot and cell) is not committed:
those controls are unverified until they run against the fixed candidate, so the
flow reports `NOT RUN` rather than guessing. That is why no native stage is
claimed here.

```
# one identity per invocation; repeat for pptx-03
node native-chart-flows.mjs --origin <isolated host origin> --identity pptx-04 \
  --manifest <run-root>/corpus/manifest.json --cases cases.json \
  --original <run-root>/corpus/inputs/pptx-04.pptx --out <dir> \
  --checker chart-workbook-fidelity.py --editor <driver module> \
  [--selectors <file> --playwright <module>] [--python python]
```

The case file supplies the chart slots and edits for that identity; the original
must be that identity's manifest fixture, and nothing else is run.

## `test-flows.mjs`

Inert tests for the orchestration and the adapter against a route-accurate
in-memory host serving the same paths, with no socket, browser or CODE process:
single-identity/native-hash binding and mixed-identity refusal, `/fresh` only on
open, `/renew` + `/qualify` on reopen, observed save sequence, byte **and**
sequence stability on both reopens, verify correlated by id/sha256/bytes/sequence,
preflight-unavailable NOT RUN versus partial-edit FAIL, and run-root
materialization over real public harness source text (pass
`--public-fixture <code-native dir>`) that rebinds the copied absolute runtime
imports and the copied Core bridge, validating everything before writing and
refusing overlaps, aliases, retained PKI, traversal, hash mismatches, missing
runtime modules and reused roots.

```
node test-flows.mjs [--scratch <dir>] [--public-fixture <code-native dir>]
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
