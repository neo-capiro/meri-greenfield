# Package three: bounded artifact/PDF revision review

15 October 2026, 22:14 UTC. Read-only source review and isolated local tests. No implementation, provider/cloud calls, live database, migrations, deployment, or blocked P2b probes. PDF structural/page-tree review belongs to the separate reviewer.

## Pins and disposition

Integrated candidate: [81e20025b7a805ac28a44f2044df87b0ebab905b](https://github.com/neo-capiro/meri-greenfield/commit/81e20025b7a805ac28a44f2044df87b0ebab905b), observed branch `fable/repair-package-3-20261015`. PDF lane [cab18e6acba310fd58cb88abf03e43978a7f0ecc](https://github.com/neo-capiro/meri-greenfield/commit/cab18e6acba310fd58cb88abf03e43978a7f0ecc) is included; its PDF revision source/tests are unchanged in the integrated candidate. Reviewed the [package report](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/reports/FABLE-REPAIR-PACKAGE-3-20261015.md) and [PDF lane report](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/reports/FABLE-S4-PDF-REVISION-20261015.md).

| Scope | Verdict |
| --- | --- |
| DA-2 wrong-parser prevention | **ACCEPT retained.** PDF parent bytes are never sent to the DOCX generator; existing Python format guards remain. |
| DA-2 PDF revision implementation | **ACCEPT bounded source implementation** for complete typed-spec/default-template re-render with exact-parent lineage. It now produces a revised PDF through an injected converter, rather than returning unsupported. |
| Required product PDF revision and native qualification | **HOLD.** Product PDF admission remains closed; no qualified renderer binding or renderer sandbox is supplied. This is still required work, not approval to defer/remove PDF revision. |
| DA-1 retention subject/preflight/uncertainty repair | **Preserve prior source ACCEPT.** No relevant source changes since package two. |
| DA-4 uncertain retention-lease retirement | **Preserve prior source ACCEPT.** No relevant source changes since package two. |
| DA-3 deterministic PPTX frame-overlap repair | **Preserve prior source ACCEPT.** Layout/presentation source unchanged; native text fit/rendering limits remain. |

The [package-two-to-three compare](https://github.com/neo-capiro/meri-greenfield/compare/69040f9b4ab2d239bec1a057354d578d2bf24b1e...81e20025b7a805ac28a44f2044df87b0ebab905b) establishes package two as an ancestor (41 commits ahead, zero behind), with no changes to retention, presentation/slide-layout, Python entry, artifact service, PostgreSQL artifact service, recovery, version-store or contract files. Acceptance remains candidate/source-level; this does not establish integration into main or deployment.

## PDF generation and lineage

[local-executor.mjs L13–23](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/artifacts/local-executor.mjs#L13-L23) rejects a PDF revision whose recorded base format differs, requires a converter, sets PDF generation base to null, and changes the generation request to DOCX. Both create and revise therefore build a fresh DOCX from the complete supplied spec. The retained PDF is not parsed or used as an editable template.

[L30–37](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/artifacts/local-executor.mjs#L30-L37) verifies the DOCX intermediate hash/inspection and converter receipt input/output hashes. The output inspection explicitly remains nativeOpened=false, rendered=false, recalculated=false and renderInspection=pending; it records sourceDocxSha256. These are provenance/integrity claims, not native quality claims.

The unchanged [service.mjs L59–75](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/artifacts/service.mjs#L59-L75) still resolves the exact retained base, requires identical operation and format, checks retention/current authority and verifies the parent's bytes before generation. [L78–89](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/artifacts/service.mjs#L78-L89) verifies object write/readback, commits the complete revised spec under expected-parent CAS, preserves artifactId and records exact parentVersionId. A stale parent may already have generated/written an object before CAS rejects; tests correctly expect ARTIFACT_EFFECT_UNKNOWN with versionCommitted=false, not a zero-effect refusal.

Durable replay continues through the unchanged [postgres-service.mjs L107–124](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/artifacts/postgres-service.mjs#L107-L124). [recovery.mjs L14–40](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/artifacts/recovery.mjs#L14-L40) binds request, complete spec, exact parent, context/evidence, immutable result and bytes before returning the existing version. Idempotency means reusing that committed version, not promising a byte-identical fresh renderer run.

The lane's “lossless” wording should be read narrowly as full replacement of generated typed content. It does not establish arbitrary existing-PDF editing, preservation of unmodelled styling, identical output under renderer/font/template changes, or visual fidelity.

## Meaningful tests and independently executed evidence

1. Executed `node --test apps/artifacts/test/pdf-revision-dispatch.test.mjs apps/artifacts/test/artifact-process-group-drain.test.mjs`: **6 passed, 0 failed, 1 skipped**, exit 0.
   - Real Python DOCX generation and genuine DOCX revision positive control.
   - Spy captures exact generator stdin: revised spec, base:null and no encoded parent PDF.
   - Valid DOCX intermediate, revised-only text, structurally valid synthetic PDF and canonical closed inspection validation.
   - Real local immutable store: create, inspect/download, revise, exact-parent/same-artifact/new-version, retained complete spec, unchanged parent bytes, stale-parent refusal, and current-authority refusal.
   - Wrong-format/mislabelled PDF parser guards.
   - Bounded process-group drain: delayed zombie reaping succeeds; a group present beyond five seconds still fails closed.

2. Executed two reviewer-owned supplemental tests against the same source and canonical validators: **2 passed, 0 failed, 0 skipped**, exit 0.
   - Both PDF→DOCX and DOCX→PDF revisions reject with ARTIFACT_REVISION_FORMAT before another generator launch, object put or settlement.
   - PDF create and revise with no renderer reject ARTIFACT_RENDERER_UNAVAILABLE before workspace allocation/interpreter launch.

Evidence: `/tmp/meri-p3-data-review/pdf-tests-1.tap`, `format-transition-results.tap`, and the clearly marked `apps/artifacts/test/review-format-transitions.test.mjs` in that isolated review tree. No production source or repository test was edited.

The integrated report's **22 passed / 2 native skips is author-reported**, not this review's independent count. The default converter [pdf-fixtures.mjs](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/artifacts/test/pdf-fixtures.mjs) extracts DOCX text and synthesizes PDF; it is not LibreOffice or native rendering.

I source-reviewed the new [durable lineage tests L35–78](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/control/document-application/test/pdf-lineage.test.mjs#L35-L78): exact-parent create/revise, two charges, duplicate-delivery replay with no extra generation/write/charge, changed-intent refusal, stale-parent/no-version, revoked-authority refusal, and HTTP admission denial. They use the real canonical owners/local store over a scripted ledger. **I did not independently run this separate file**, because its partial-source closure pulls the broad gateway/catalog/schema set; the bounded review did not expand into rebuilding that tree. The author reports 2 passing default tests and 1 native skip. Those assertions are meaningful regression coverage, but not independent live-PostgreSQL qualification.

Environment: Node 24.19.0 and existing Python/dependencies reused without installation. The native LibreOffice variant was skipped because MERI_ARTIFACT_SOFFICE was not configured. Author-reported real-LibreOffice 8/8 remains local evidence only. No native PDF/Office opening/render QA, qualified image, renderer sandbox, real database, S3, full-suite run or baseline-revert run was performed here.

## Required closure before product acceptance

[format-admission.mjs L14–18](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/control/document-application/format-admission.mjs#L14-L18) still permits only docx/txt for create_word and xlsx for create_excel. The executor's presence check for officeTransformer is **not a qualified-renderer admission gate**. Product PDF is presently blocked altogether.

Required follow-through: bind and qualify the real renderer/image/sandbox; admit PDF through the actual document application; execute full HTTP create/revise/inspect/download/replay with current authority, lineage, budgets and native output checks; retain honest pending preview/native flags until their owners qualify them. The [lane's concrete admission proposal and unrun list](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/reports/FABLE-S4-PDF-REVISION-20261015.md#L123-L145) correctly leave this open.

Cleanup checked: no owned PDF revision/lineage temporary directories or generator processes from this review tree remained. Only fetched source, the supplemental test and test/report evidence are retained. No denied action occurred; blocked P2b work was untouched.

