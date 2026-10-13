# Editable workbook outcome

The existing XlsxWriter/openpyxl owners create and revise a typed XLSX planning workbook through the same `/api/documents/*` routes as Word. The application is bound to the exact canonical `create_excel` descriptor; a Word grant cannot create or read an Excel version. No generator, authorization or accounting owner is replaced.

Run the explicit synthetic local workflow with installed tools and a new evidence directory:

```sh
node scripts/local-workbook/run.mjs --run --python /absolute/python --soffice /absolute/soffice --output /absolute/new-evidence-directory
```

The CLI serves actual loopback HTTP, creates a workbook containing formulas and literal formula-like text, changes the research estimate, reconstructs the application, inspects/downloads both versions, refuses replay and revoked access, and checks separate session/store isolation. It reopens real XLSX files with openpyxl, verifies editable cells/formulas/styles and original immutable hashes, then uses the existing LibreOffice transformer to recalculate local copies. The same installed LibreOffice exports those copies to PDF; PyMuPDF extracts text and renders page PNGs for visual inspection.

The output directory intentionally retains `original.xlsx`, `revision.xlsx`, recalculated copies and PDF/PNG previews. Recalculated and rendered copies are local qualification evidence, not replacement artifact versions or production preview records. Canonical versions remain `draft` with preview `pending`; generation receipts continue to say native qualification is false. Synthetic accounting charges each version once; it does not incur spend. Original formula caches are explicitly unverified until local-copy recalculation. No formula engine or custom renderer is added.

Help and invalid arguments allocate no resources. Execution owns and closes two disposable stores, generation/render temporary directories and one listener, retaining only the requested evidence. Processes carry the original bounded fixture deadline. Existing DOCX workflow and all production availability flags remain unchanged. This does not prove native database, Office interoperability beyond this local fixture, OS sandboxing or G1 runtime admission.
