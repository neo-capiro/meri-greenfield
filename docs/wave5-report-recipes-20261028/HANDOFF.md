# Wave5 M5 — sourced cited report recipe + retained revision provenance (candidate handoff)

Allocation: `S/work/hermes-m5-report-recipes-20261028`, branch `codex/wave5-hermes-report-recipes-20261028`,
base `557b85db61915ff77748694240342cdb0e77d7d6`. Author/committer `Codex <codex@openai.com>`; no push, PR or merge.

## 1. What shipped

**A. Retained revision provenance (the concrete lead).** `apps/control/intents/document-revision.mjs` no longer
refuses source-backed/asset-bearing parents wholesale; it computes exactly what the immutable parent retains
(`retainedProvenance`: stored evidence re-validated as native source evidence under the canonical
tenant/actor/conversation binding rule and scope subset rule, plus the spec's asset references in document order)
and then:

- refuses a replacement that introduces an asset the parent never had (`UNAVAILABLE`, no effect);
- requires a trusted owner (`preservation`) when the parent retains evidence or assets, and verifies what that
  owner re-presents byte-for-byte (evidence equal to the parent's stored evidence; each preserved asset object
  equal to the parent's object scopes and validated as an `ObjectReference`) before pinning
  `{evidence, assets, evidenceSha256, assetIds, parent:{versionId, objectSha256, specSha256}}`;
- without such an owner an evidence-bearing or asset-bearing parent is still `UNAVAILABLE` with no effect —
  unchanged user-visible behavior, but now precisely determined instead of a blanket guard.

`apps/control/intents/document-preparer.mjs` passes the composed port's optional `writes.preservation` into the
admission and, after the write, re-checks the returned draft's version evidence against the pinned
`evidenceSha256`: a port that re-presented nothing yields `INVALID_RESULT` (effect `unknown`, the draft exists),
never a silent provenance drop. The write call also carries the pin as `preserve`.

**B. Seven-section cited report recipe.** New owner `apps/control/document-application/report-brief/`
(`manifest.json`, `SKILL.md`, `skill.mjs`, `input.mjs`, `compose.mjs`, `binding.mjs`, `README.md`, `test/`) emits
the accepted order — Summary, Scope and as-of, Findings, Conflicting evidence, Recommendations, Limitations,
References — as a `create_word`/`docx` request through the existing document-application seam. It reuses the
congressional brief's kernel (`../research-brief/{input,evidence}.mjs`) for read binding, citation/offset rules,
verification statuses and conflict detection, and adds:

- named conflicts must attach to a finding that is genuinely in conflict (unequal cited passages), once;
- limitation disclosure per read (status, reason code, coverage, continuation) plus the requester's stated limitations;
- an immutable provenance marker (skill pin, subject, as-of, input/reads hashes, retained-evidence hash, parent pins);
- revision support: `readBase` verifies the parent's version id, spec hash, tenant/actor/conversation, scopes,
  mime type and provenance block, refuses a parent whose spec references assets (no retained asset object to
  re-present), may not roll the as-of backwards or change the subject, carries the parent's retained evidence
  into the new context evidence, and refuses a citation identity reused from the parent. `binding.mjs` adds the
  retained-evidence admission, so the canonical artifact owner commits a revised version whose evidence includes
  the earlier-run parent evidence; without that admission the same revision fails `ARTIFACT_EVIDENCE_BINDING`.

## 2. Reserved spans touched (nothing else)

- `apps/control/intents/document-revision.mjs`, `document-preparer.mjs` (+ `test/document-revision.test.mjs`)
- `apps/control/document-application/report-brief/*` (new cohesive owner + tests)
- `docs/wave5-report-recipes-20261028/HANDOFF.md` (this file)
- No change was needed in the reserved `apps/artifacts/service.mjs` read/`revisionSource` span: the retained
  pins are already inside the verified private read (`version.evidence`) and the spec it returns, so an extra
  field would enlarge a private payload without adding a check. Not edited: `packages/*`, catalog/assets,
  generated distributions, locks/manifests, authority/schema/migrations, runtime product composition,
  activity/input/history/public routes, auth, architecture registry, `local/*`, historical receipts.

## 3. Evidence

| Command | Result |
| --- | --- |
| `node --test apps/control/intents/test/document-revision.test.mjs` | 11 pass / 0 fail, exit 0 |
| `node --test apps/control/document-application/report-brief/test/report-brief.test.mjs` | 19 pass / 0 fail, exit 0 |
| `node --test apps/artifacts/test/revision-source.test.mjs` | 3 pass / 0 fail, exit 0 |
| `node --test apps/control/intents/test/legislative-document.test.mjs` | 5 pass / 0 fail, exit 0 |

Node `24.22.1` at `C:/Program Files/nodejs/node.exe`; private junctions to the existing read-only dependency
cache (`S/work/wave5-public-preview-runs-revision-20261027`) plus `@capiro/meri-contracts` → this worktree's
`packages/contracts`; no install, no lockfile/package edit.

Proven behaviors (report-brief suite): seven headings in exact order; both cited passages and the locator URL
(non-verification) in the document; named conflict rendered with both passages; limitation disclosure; canonical
`v.request`/`v.context`/`v.nativeSourceEvidence` acceptance; skill-pin/manifest/prose pin checks; 14 read-result
tamper refusals with a single source dispatch; prepared guard against request/context/base substitution and
binder `ACCESS_DENIED` on substitution; create + revise through `createArtifactService` with the bound options —
new version carries the prepared evidence, `parentVersionId`/`artifactId` correct, original version and spec
byte-identical afterwards, `ARTIFACT_EVIDENCE_BINDING` without the retained admission, `ARTIFACT_EFFECT_UNKNOWN`
and no rewrite when release authority is revoked after execution. Proven behaviors (intents suite): the
no-owner refusal, the preserved-evidence write that keeps the parent's evidence on the new version with exact
parent pins, three tamper refusals with zero writes, a lying port, and preserved-asset object verification.

## 4. Failures and limits (accurate, not fixed here)

- **Native DOCX bytes/inspection NOT RUN on this host.** The canonical native DOCX executor is POSIX-only
  (`apps/artifacts/python/entry.py` imports `resource`) and no Python with `python-docx` exists here (the
  codex-runtime interpreter is pruned; the WSL `Codex-Gates` python3 has no `docx`). The report tests therefore
  validate the exact DOCX document model/spec through the canonical validators and the artifact owner with a
  scripted executor. Real rendering, PDF/pagination, Word-open and visual checks remain the separate
  native/render qualification on the Linux gate.
- **Linux-gate fixtures fail here for environmental reasons** (unmodified files): `document-preparer.test.mjs`,
  `document-preparer-powerpoint.test.mjs`, `analysis-preparer.test.mjs` throw `LOCAL_DOCUMENT_CONFIGURATION`
  because `createLocalDocumentFixture` requires a Windows-absolute `pythonExecutable` while those tests pass the
  WSL `/opt/...` path (`isAbsolute` false on Windows); `research-action/native-tasks/command-proposal-reader/
  memory-tombstone-migration-source/artifact-intents/native-document` tests cannot import `zod` or
  `@modelcontextprotocol/sdk`, which are absent from the shared read-only cache. None of these import paths
  involve the changed behavior.
- No database, provider, model, browser, build, pack or publication action was taken; no synthetic runtime
  qualification or counterfeit grant is claimed.

## 5. Integration needs (coordinator)

1. **Installed public skill pin:** the recipe is a bounded selection over the installed pin
   `quick_skill.bill_watch` `1.0.0` already used by the congressional sourced brief (the suite asserts the
   installed prose/manifest hashes are that recipe's). A dedicated installed long-form report/whitepaper skill
   package remains the coordinator's public-package step if the recipe must own its own installed prose.
2. **Conversational revision write context (out of span):** the generic revise path can only preserve a
   source-backed/asset-bearing parent's provenance if the resolved artifact context (authority/application
   composition) can re-present the retained evidence and asset objects for the write. That interface lives
   outside this allocation — see `NEEDS-COORDINATION.txt`. The compiler/prepared seam already preserves
   evidence end-to-end, and its behavior is proven by the report-brief suite.
3. Independent review of the admission/`preservation` contract and of the report recipe's refusal matrix is
   expected from the coordinator, not claimed here.
