# Fable lane report: s4-pdf-revision (15 October 2026)

- Lane: PDF revision as a real capability (audit DA-2 follow-through; dot's PACKAGE2-ARTIFACTS-REVIEW at `a5dccb19`: "ACCEPT wrong-parser prevention only; HOLD PDF revision capability").
- Branch `fable/s4-pdf-revision-20261015`, base `28f76264` (package two latest). Not pushed. Waiting for dot's review.
- Nothing deployed. No cloud, credential, migration, model or provider action. No lockfile, contract or schema edits, and no edits under `apps/artifacts/structure`.

## Outline

| Responsibility | Owner | Change |
|---|---|---|
| PDF generation route | `apps/artifacts/local-executor.mjs` | A PDF revision is now a full re-render of the complete revised typed spec from the default template, through the same DOCX to PDF route as creation. The generator receives `base: null`. A PDF revision over a base recorded as another format is refused with `ARTIFACT_REVISION_FORMAT` before any workspace or process is created. |
| Lineage, CAS, authority, budget, replay | `service.mjs`, `postgres-service.mjs`, version stores | Unchanged. The service still reads and hash-verifies the exact parent and commits a new immutable version with `parentVersionId` set to that parent under expected-parent CAS. This is the XLSX full-replacement precedent. |
| Wrong-parser guard | `apps/artifacts/python/entry.py` | Unchanged (`BaseFormatMismatch`). |
| Owned process supervision | `apps/artifacts/process.mjs` | Waits a bounded time for the process group to drain after the single group kill (see "Host issue" below). |
| DA-1/DA-4 retention and DA-3 slide layout | | Untouched. |

Contract check: no frozen contract, schema, version-store or inspection change is needed.
- The revise command already carries the full canonical `WordRequest` (`format: 'pdf'` is allowed by the frozen schema).
- `ArtifactService.generate` requires the same operation and format as the retained spec and keeps that complete spec as the new version's `spec`.
- The PDF `ArtifactInspection` details remain the closed `{conversionCompleted, renderInspection:'pending', sourceDocxSha256}`. A revised PDF uses the same shape. Its lineage is carried by the version's `parentVersionId`.
- A `revisionMethod` marker, like XLSX's, would need a schema change, so none was added (optional proposal below).

Why the full re-render is lossless: every PDF in a lineage already comes from a fresh default-template DOCX built only from its typed spec, and that intermediate was never retained. So a parent PDF contains nothing that its spec and the default template cannot reproduce. Reading the parent's PDF bytes would add nothing, and it is what caused the DA-2 bug.

## Findings closed

- **DA-2 (HOLD on PDF revision capability).** PDF revision now produces a revised PDF:
  - It is a new immutable version with the exact parent, the same artifact and new object bytes.
  - The parent's bytes are untouched and re-verified.
  - The wrong-parser guard is kept at two levels: the executor never forwards PDF bytes, and `entry.py` still refuses them.
- **Host issue (the opt-in real LibreOffice path failed 3 of 3 with `ARTIFACT_CLEANUP_FAILED`).** This was a supervision race and is fixed (below).

## Host issue: why the group looked present

I ran a probe with soffice spawned exactly as `process.mjs` does and read `/proc` for the members of the owned process group:
- During startup, `soffice.bin` starts short-lived `gpgconf`, `gpg` and `gpgsm` helpers.
- At leader close, those helpers had all exited. Every remaining member was state `Z` (zombie) with ppid 1.
- This host's PID 1 (`process_api --firecracker-init`) reaped them 0.9–1.8 s later (4 probe runs).
- A zombie is still a process-group member, so the old immediate `kill(-pgid, 0)` succeeded and reported `groupAbsent:false`.
- No live process remained. This is a race in the absence check, not a genuine leftover process.

Fix: after the single group `SIGKILL`, the code polls for absence with signal 0 (never re-signalling) for at most 5 s.
- A group still present at that bound remains `ARTIFACT_CLEANUP_FAILED` with `groupAbsent:false`.
- A non-ESRCH error still sets `ARTIFACT_CLEANUP_FAILED`.
- The receipt shape is unchanged.
- Absence is never assumed.

## Tests

Default suite. The converter is a synthetic port (`apps/artifacts/test/pdf-fixtures.mjs`): it accepts only a structurally valid DOCX, reads its `w:t` text and returns a complete PDF 1.4 file with that text. The DOCX generator is real.

`apps/artifacts/test/pdf-revision-dispatch.test.mjs` (rewritten):
- **Executor test.** A PDF revision does exactly one DOCX build. The spy-captured generator stdin shows `base: null`, the request is the revised spec with `format: 'docx'`, and the parent's PDF base64 does not appear anywhere in it. The converter receives a valid DOCX that contains only the revised text. The output passes `structureCheck(…, 'pdf')`, has the closed inspection shape (validated by the canonical validators), and the temp root is empty. Two further checks:
  - A wrong-format base is refused with `ARTIFACT_REVISION_FORMAT` and 0 launches.
  - PDF bytes sent to the DOCX owner through the executor still fail with `BaseFormatMismatch`.
- **Python entry test.** Kept: PDF and mislabelled-PDF bases fail with `BaseFormatMismatch`, and a genuine DOCX base still revises.
- **ArtifactService test** (create → download/inspect → revise → download/inspect both):
  - exact parent and same artifact
  - the retained spec is the complete revised spec
  - parent bytes are unchanged
  - text read back from each PDF matches its own spec
  - settlements are completed, completed
  - **stale parent:** refused with `ARTIFACT_EFFECT_UNKNOWN`, cause `ARTIFACT_STALE_PARENT`, `versionCommitted:false`, and no version record
  - **no authority:** `ARTIFACT_AUTHORITY` with no launch, object write or reservation
- **Opt-in real LibreOffice variant** of the same flow: text is read back with pypdf.

`apps/control/document-application/test/pdf-lineage.test.mjs` (new). This test goes through the owners that `index.mjs` dispatches to: the durable `PostgresArtifactService` (scripted canonical ledger, real local immutable store) for writes and `ArtifactService` for reads.
- create, revise, inspect and download, with exact parent and the parent unchanged
- 2 charges settled, 20 micro-USD consumed
- **Replay of the revision delivery:** a deep-equal version and inspection, with 0 extra generator launches, object writes or charges
- the same delivery with a different request is refused and starts nothing
- **Stale parent:** refused (`ARTIFACT_STALE_PARENT` under `ARTIFACT_EFFECT_UNKNOWN`), no version, and both versions unchanged
- **Revoked authority:** refused with no launch or write
- an opt-in real LibreOffice variant
- the HTTP application still refuses PDF (400 `INVALID_REQUEST`/`NOT_DISPATCHED`, 0 generations)

`apps/artifacts/test/artifact-process-group-drain.test.mjs` (new). It uses a fixed Python fixture that leaves an exited member in the owned group. That member's parent has moved to another session with `setsid` and reaps it 0.6 s later.
- The group is now reported absent.
- Negative control: when the reaper holds the zombie past the bound, the result is still `ARTIFACT_CLEANUP_FAILED`.

Reverted-fix proofs, each run by temporarily reverting only the named change:
- **Executor change reverted:** the executor, ArtifactService and durable tests fail with `ARTIFACT_REVISION_UNSUPPORTED` (the durable test with `ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN`, whose cause is `ARTIFACT_REVISION_UNSUPPORTED`). That is 3 failing; the python, fixture and admission tests still pass.
- **Executor forwarding the parent as base** (the original DA-2 shape): the executor and service tests fail with `ARTIFACT_PROCESS_FAILED` from `BaseFormatMismatch`.
- **`process.mjs` reverted:** the drain test fails with `ARTIFACT_CLEANUP_FAILED groupAbsent=false`, and the negative control still passes.

Page-tree check: the coordinator's stricter validator is on `fable/s4-pdf-page-tree-20261015` (`da0ce98f`, re-signed as `b6dc012c` with identical content). Against it, the fixture PDF, synthetic create and revise, and real-soffice create and revise are all `{valid:true}`. With that branch's `pdf.mjs` and `refusal.mjs` temporarily copied in (then restored), my two PDF test files passed 7 of 7, including both real LibreOffice variants.

## Suite results (Node 24.21.0, per file, base `28f76264` vs this branch)

The full run covered `apps/artifacts/{test,independent,structure/test,storage/test}`, every `apps/control/document-application` test, `apps/runtime/artifacts/test` and `source-proof.test.mjs`.

**Same at base and after:**
- all storage, structure, independent, postgres and runtime files
- `application`, `workbook-application`, `research-brief`, `retention`
- `source-proof` (5 of 5; no hashed row changed)

**Improved by the `process.mjs` fix** (each failed at base with `ARTIFACT_CLEANUP_FAILED`, `groupAbsent:false`, soffice exit 0):

| Test file | Base | After |
|---|---|---|
| `office-recalc` | 5 pass, 2 fail | 7 of 7 |
| `office-recalc-independent` | 5 pass, 2 fail | 7 of 7 |
| `office-columns` | 1 pass, 2 fail | 3 of 3 |
| `workbook-columns-independent` | 2 pass, 2 fail | 4 of 4 |
| `commitments-audit/document` | 0 pass, 1 fail | 1 of 1 |
| `commitments-audit/tracking-native` | 5 pass, 1 fail | 6 of 6 |
| `mail-history/document` | 0 pass, 1 fail | 1 of 1 |
| `relationship-brief/document` | 1 pass, 1 fail | 2 of 2 |
| `selected-output/lifecycle` | 0 pass, 2 fail | 2 of 2 |

**New files:**
- `pdf-revision-dispatch`: 4 pass, 1 skip (opt-in); the real variant passed 3 of 3 runs separately
- `pdf-lineage`: 2 pass, 1 skip; the real variant passed 2 of 2 runs
- `artifact-process-group-drain`: 2 of 2

**Unchanged host failures:**
- `artifact-execution` and `artifact-adapters-independent` fail at import because of the hard-coded `/opt/codex` PptxGenJS path. With temporary copies pointed at `apps/worker/qualification/node_modules/pptxgenjs`, the results were 32 pass, 2 fail and 9 of 9 at both base and after. The 2 failures are caused by missing `matplotlib`.
- `local/local.test.mjs`: 1 pass, 1 fail at both base and after (the same `ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN` Word flow).
- `python3 apps/artifacts/test/test_word_revision.py`: OK.

**Rerun disclosure:** the first after-branch pass had transient failures in seven `apps/artifacts/test` files, and the disk was at 98% (1.1 GB free) on this shared host. Rerun individually, all of them passed: `artifact-process-independent` 6 of 6, `document-replay` 33 of 33, and the office and PDF files with the counts above.

## Admission: proposed, not made

`apps/control/document-application/format-admission.mjs` is a repository-owned source switch, not a frozen contract. I still left PDF unadmitted, for these reasons:
- Its README states that "PDF … not admitted" and that "no new renderer is introduced".
- The product composition binds no renderer. `createFixedRuntimeArtifactExecutor(configuration)` passes caller configuration through, and nothing in `apps/runtime` supplies an `officeTransformer`. Admitting PDF now would expose a route that reserves budget and then fails with `ARTIFACT_RENDERER_UNAVAILABLE`.
- Binding a qualified LibreOffice image and renderer sandbox is a placement decision with its own gate, outside this lane.

Exact proposal once a qualified renderer is bound:
- In `format-admission.mjs`: `formats:id==='create_word'?['docx','txt','pdf']:['xlsx']`.
- The runtime document composition passes `officeTransformer: createLibreOfficeTransformer({executable:<qualified soffice>, tempRoot})` to `createFixedRuntimeArtifactExecutor`.
- `application.test.mjs` replaces its "reject PDF before generation" case with an HTTP create/revise/inspect/download/replay PDF test, and `pdf-lineage.test.mjs`'s refusal case flips to that.
- The README and OUTLINE format lists are updated.

Remaining after that:
- Preview publication: `previewStatus` stays `pending` for every format, and no preview owner exists for any format.
- Native open and render qualification.
- The renderer sandbox.

## Unrun

- Native PDF open and render qualification, the renderer sandbox, and the product image: UNRUN. Local LibreOffice 24.2 with pypdf text read-back is local evidence only.
- Real PostgreSQL and S3: UNRUN. The durable test uses the scripted canonical ledger and the local store.
- The product HTTP PDF route: not admitted (above).

## Proposals for dot

1. Accept route 1(b) as the defined PDF revision semantics: a full typed-spec re-render from the default template, with exact-parent lineage.
2. Optional contract proposal (not needed for correctness): add `revisionMethod: {const: 'default-template full re-render'}` to the PDF `ArtifactInspection` details, so that a revised PDF's inspection says how it was made, as XLSX's does.
3. Approve the admission change above together with the renderer binding.

## Residual risks

- The 5 s drain bound depends on the host reaping exited members within it. On a host whose PID 1 never reaps, cleanup fails closed as `ARTIFACT_CLEANUP_FAILED`, which is correct.
- `GROUP_POLL_MS` polling adds up to about 2 s per soffice call on this host.
- Text extraction from real PDFs depends on LibreOffice and pypdf behaviour. The default suite does not.
