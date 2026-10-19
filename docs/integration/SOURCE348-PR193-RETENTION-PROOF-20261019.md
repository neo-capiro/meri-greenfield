# PR193 retention-release source proof (2026-10-19)

## Implementation outline recorded before code changes

The exact reviewed source is `5b395d4ce9218b872b21c420dc00a3af31739824`. The proof lane owns only scripts/selectors/tests, this receipt, and its evidence directory. The source owner owns runtime changes; the parent owns the source seal, image build, and receiving handoff. No runtime or deployment interface is changed here.

Reuse the bounded PR193 generator and frozen selector, preserving original/h/i/j/k/l manifests and the superseded l evidence byte-exact. Generate candidate m from immutable Git blobs with l as its predecessor. `apps/runtime/control.mjs` is the sole historical proof row changed from l; preserve its original historical hash and record its exact l predecessor. The cumulative a16-to-successor source delta has eight paths: that historical row plus seven supplemental paths, including the changed worker HTTP boundary and the new excluded retention regression. Keep the original 45-row count and the 50 COPY obligations. Record current, a16-base, and l-predecessor hashes explicitly.

Focused verification will check exact Git source hashes and both delta sets, preserved history, deterministic regeneration, selector binding, missing/drifting copied files, and invalid inputs. No product test rerun, AWS operation, upload, image build, credential action, or commit is allocated to this lane. Candidate m remains source-only HOLD; passing local proof checks does not admit an image or live run.

## Result and exact pins

Candidate `m` is generated and verified at **35,352 bytes**, SHA-256 **`9350fb7a077d42369a5a2dc14f598dd228c67a21de76cd6791465581db6d381c`**. Its `candidateSourceCommit` is exactly `5b395d4ce9218b872b21c420dc00a3af31739824`. Its predecessor is the unchanged candidate l, SHA-256 `81d3edec29a2d720089e3d5ff127732ceed11950c17707ca3f58141644925c45`. Candidate l and source `9acbfe7168eb4e9c1e2c3acb02e2a28d08bbd262` remain explicitly superseded, with their original evidence and rejection marker intact.

The exact final code delta from 9acb contains these three paths:

| Path | Proof placement | Exact 5b SHA-256 |
| --- | --- | --- |
| `apps/runtime/control.mjs` | Existing historical row; copied | `c203cba5586897db8954d9865add0881132b1ce8036a5562651651d44af19b28` |
| `apps/runtime/worker-http.mjs` | Existing supplemental production row; copied | `5354470ab49ec4148ea947989d46f0e979ae7920cea3908529b6acc451105f18` |
| `apps/runtime/test/worker-load-retention.test.mjs` | New supplemental regression row; excluded from COPY | `b980ef34370c7e5a4c022da8ee06228939af9598052f3b4fad918b0d833f5a90` |

Control's original historical hash `904b12d08007bc9803b57f26afbf0e0763cfe80f7cb17aedc581ba77135c4e52` remains recorded. Its immediate predecessor hash is now l's `77bb6239b62e8b217bc9ee187604bd2928d626f664672afc4a8092395a1aa3e0`. The worker row retains its a16 base hash and names l's `666b6c8cedfd33bb7e21cf81f159d8d7ad31045ce6dd77858ef5f6f12d55e80f` as its immediate predecessor. The new 12,254-byte regression explicitly records absence in both a16 and l.

All **45 historical paths** remain mandatory, with **28 changed / 17 unchanged** relative to the original manifest. Exactly one of those paths differs from l. Seven supplemental paths cover the remainder of the complete eight-path a16-to-5b code delta: three production paths and four regressions. Together the manifest binds **52 source paths**. The selector requires **50 COPY paths**, comprising the original 45 plus three supplemental production files and two adjacent session regressions. The load-amplification and new worker-retention regressions remain source-only. No Dockerfile, ignore rule, runtime file, package, contract, or producer was edited by this proof lane.

The load repair `546782fb28f0e496004f6fca790734409ff96969`, cancellation repair `816b5873d693f49d0383c0808d1d2319f246052a`, and superseded combined commit are verified ancestors of 5b. This preserves the original repair commits rather than reconstructing them.

## Checks and evidence

The focused proof run passed **22/22**, with zero failures, cancellations, or skips. Generator `--check` and `git diff --check` passed. The preservation audit verified 21 original/h/i/j/k/l manifest, historical-receipt, and superseded-evidence files byte-for-byte against the previous proof checkout; the runtime diff against exact 5b is empty. Raw outputs, command receipts, output hashes, and the preservation audit are in [source348-pr193-retention-proof-20261019](source348-pr193-retention-proof-20261019/).

```sh
node --test --test-reporter=tap scripts/qualification/assembled-image/source-proof.test.mjs scripts/qualification/assembled-image/frozen-candidate.test.mjs scripts/qualification/assembled-image/generate-pr193-candidate.test.mjs
node scripts/qualification/assembled-image/generate-pr193-candidate.mjs --check
git diff --check
```

The checks verify the full immutable manifest chain; all current and predecessor source hashes; the exact cumulative eight-path and final three-path deltas; ancestor preservation; source/COPY classification; missing and drifting copied bytes; invalid supplemental source, path, hash and count records; generator refusal for unexpected changes; and bounded CLI argument handling. The generator remains the canonical writer and the frozen selector remains the canonical COPY reader. Both are import-safe, with no external services or product initialization. Manual review of the final proof diff found no additional issue. No new sub-agent was launched for this successor.

The source owner's [retention-release receipt](MERI-LOAD-RETENTION-RELEASE-20261019.md) reports independent source approval and **245/245 affected product checks**, including the canonical regression returning **403 with no serialization** when suppression commits during final task verification. This lane read that evidence and did not rerun product tests. The previously retained graph-fixture failures remain historical limitations documented by their owner.

## Qualification boundary

The proof files remain under excluded `scripts/` and `docs/` paths. A later commit containing them changes Git archive identity but does not change the copied runtime source; the parent's build source remains exact **5b**, never a later proof/document commit. The old 9acb seal and l evidence remain superseded and must not be uploaded or built.

This lane performed no Docker COPY execution, Linux gate, image build, scan, launch measurement, AWS operation, upload, credential access, or live acceptance. The parent separately owns the authorized build and its prerequisites. Candidate m stays `CANDIDATE_HOLD_SOURCE_REVIEW`; the local proof pass does not supply image or live admission. The unchanged image gate remains B6/R6/W12 (24 cases), with the separate startup-budget regression requiring additional exact-source Linux evidence.
