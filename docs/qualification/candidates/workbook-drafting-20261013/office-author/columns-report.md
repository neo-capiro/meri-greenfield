# Workbook column sizing source repair

Exact source: 07d9db0b988a8ff3f04ee3acc21951e5967dea81. Only canonical apps/artifacts/python/office.py changed relative to accepted Office packet7c051be4. No original test, contract, migration, chart/image insertion anchor, or accepted office-transform byte changed. The new private helper has no caller configuration or authority surface.

The reproduced problem is visible in columns-before/create-page-1.png: Workstream runs into Hours and Documentation is clipped despite the correct $2,050.00 total. Three frozen author controls failed before repair: actual create and revise PDF labels, plus absent explicit column sizing. Full generated/recalculated XLSX, PDFs, PNGs and inspections were retained before assertions; there is no overwritten visual baseline.

The generator now estimates each used column using installed XlsxWriter3.2.9 cell_autofit_width, chooses a12..48 character-unit width and applies it in both XlsxWriter creation and openpyxl revision. Headers/literal lines, numeric text and a conservative number-format allowance contribute. Formula source text does not masquerade as a display value; a fixed numeric-result allowance supplies room without evaluating formulas. Revisions split prior grouped column dimensions and recompute sizes, so new longer labels gain space and shorter values may reduce it. Existing chart/image cell anchors remain unchanged. XlsxWriter serializes48 as48.7109375 because of its pixel padding; openpyxl serializes48 directly. See the upstream [public estimator documentation](https://xlsxwriter.readthedocs.io/utility.html#cell-autofit-width). No library/dependency change occurred.

Checks at the exact source:

- Frozen author tests3/3 PASS,46.865seconds; before repair0/3 retained. Actual create/revise XLSX→recalculation→PDF→PyMuPDF, complete labels, currency totals2050/2300, formula expressions, literal `=1+1`, number formats, maximum width and revised-width shrink/growth.
- Original artifact-execution tests34/34 PASS,6.042seconds, no skips/cancellations. Includes actual Word/XLSX/charts and all original assertions.
- Viewed actual create/revise page1 PNGs: full Workstream, Documentation and Documentation review; Hours/rate/cost remain separate and all amounts readable. The long-cap test is deliberately not a universal visual claim.
-11,613 original tree entries:11,612 byte/object-exact; only office.py differs. Prior accepted transformer/evidence/tests are exact.
-37 recorded owned process groups freshly absent; each test-owned workspace removed. One borrowed node_modules symlink was removed; donor untouched. No installed dependencies or lingering processes.

Approximate bounded sizing does not implement Excel formatting, text wrapping, formula evaluation or arbitrary-font/unicode layout. Content wider than48 may remain clipped. The local renderer evidence does not qualify a native worker, sandbox, production rendering path or deployment; all native qualification flags remain false. Parent owns the separate complete HTTP workbook flow and independent reviewer owns acceptance.

Commit order after7c051:59c218cb outline;5d1e7b68 frozen author controls;71375cf8 preserved baseline;07d9db0b source. This packet follows without further source edits. columns-audit.json records preservation and fresh cleanup; columns-manifest.json lists exact packet members and source/test bytes. A transient image-view transport error was preserved in columns-tooling-note.json and succeeded on retry; no test/source repair was attributed to it.
