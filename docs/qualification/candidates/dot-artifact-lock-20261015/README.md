# Artifact wheel closure — independent source candidate

Pinned parent: `3532541665c62940cd83d98503b3d1d4a0ae718b`. Local branch `dot/artifact-lock-closure`; no publication/build authorization. Status: ACCEPT_SOURCE for the dependency-lock slice; Linux native/artifact checks and security/license/image admission remain HOLD. This is a local-only candidate.

Implementation outline: the qualification worker's existing `requirements.lock.txt` remains the canonical Python installation input. Preserve seven exact pins, add the reviewed fourteen-wheel closure and wheel-only selection. Update `component-pins.json` to describe the current closure without transferring historical seven-wheel byte verification or image acceptance to the additions. Record official per-wheel metadata, target markers and provenance in this candidate's dependency inventory. Keep app behavior, executor interfaces and placement unchanged. Verify constraints and source/proof hashes locally; use a separately approved isolated CPython3.13 Linux environment for native imports and actual artifact regressions. No Windows-heavy runs, image operations, migrations, providers or cloud resources.

Exclusive changed existing paths: `apps/worker/qualification/requirements.lock.txt`, `apps/worker/qualification/component-pins.json`. New evidence paths are confined to this candidate directory. Root owns lock/pins/inventory/review; independent reviewer owns `LINUX-VALIDATION.md` only. Historical candidate inventories remain immutable.

## Result and boundaries

The worker candidate now has21 exact CPython3.13/Linuxx86_64-compatible wheel entries. Seven existing versions, hashes and component rows remain unchanged. The14 additions preserve Pillow-backed asset validation for TXT/PPTX, DOCX charts, XLSX generation/revision and typed analysis ZIP capabilities. pandas2.2.3, NumPy2.3.5 and Matplotlib3.10.8 retain the repository's recorded source-test baseline; Pillow12.3.0 and remaining previously unpinned transitive versions are explicit new source candidates. See `wheel-inventory.json` for exact filenames, URLs, wheel/metadata hashes, target markers and dependency edges.

The fixed artifact executor remains caller-local with explicit absolute Python/Node/PptxGenJS/temp paths. This lock describes the qualification worker `/opt/meri-venv`; it does not bind that executor to a deployment or move it into the minimal Node root or separate browser host. Missing trusted deployment binding remains fail-closed. Existing PptxGenJS4.0.1, LibreOffice, Poppler, fonts, rendering resources, deadlines, cancellation and cleanup remain required where invoked. No artifact implementation, model orchestration, authority or placement contract changes.

No wheel bytes were acquired for this slice. Official PyPI JSON/Simple API and PEP658 metadata establish identities, advertised hashes and constraints. The old seven-wheel downloaded-byte evidence remains explicitly seven-only. New compiled wheels may bundle parsers, codecs, font/render libraries or BLAS/runtime libraries; license notices, native ABI/imports, SBOM and full vulnerability review remain required. Base/runtime findings remain HOLD independently; no image acceptance transfers.

## Verification actually performed

| Check | Result |
| --- | --- |
| Exact preserved pins |7 unchanged version/hash lines and component rows |
| Official metadata provenance |21 wheel URLs/SHA256 and21 PEP658 hashes match official index |
| Conventional CPython3.13/Linuxx86_64 wheel tags, Requires-Python and active dependency graph |21 compatible wheels,18 active edges satisfied |
| Qualification input proof |2 changed paths with parent/current hashes; inventory hash bound in `source-proof.json` |
| Existing runtime source proof |All45 rows unchanged from353; existing5 proof tests PASS |
| Independent read-only review |ACCEPT_SOURCE; pins/closure/provenance/proof/placement independently reproduced |
| Worker context/source-pin filesystem regressions |19 PASS,2 Windows fixture errors: hardlink access denied and symlink privilege unavailable |
| SDK fixture source-pin check |FAIL, reproduced unchanged at parent353: inherited stale `packages/contracts/validate.mjs` record |
| Diff whitespace |PASS |
| Native imports and actual artifact generation |NOT RUN; approved isolated Linux environment required; exact runbook alongside |

The first filesystem-test attempt failed during fixture setup because sandbox default Temp denied child creation; rerun used a task-owned temporary directory. The rerun retained both Windows link-creation failures and did not weaken assertions. The source-pin check expects hash `c2449fd55300b31bdc1e829b5d918a531f1c4b2c675085a5b4707726ddd36d10` but the parent and candidate both contain `bc72b4cbc240e133742350d3dcc7dcd995a426d9dc85439f1886b49aa41c0605`. Existing `sdkFixturePackaging.records` are preserved exactly; no unrelated receipt regeneration is hidden in this lock slice. Qualification source-pin/build admission remains blocked until its separate owner resolves that inherited discrepancy.

Local checks used existing Windows Node24.19.0 and Python3.11 tooling for metadata/filesystem checks only. They do not qualify target CPython3.13 or Linux-native behavior. No dependency install, target-wheel import, provider, database, AWS, build, image materialization, push or PR ran.

Reproduction commands from checkout:

```sh
node --test --test-isolation=none --test-concurrency=1 scripts/qualification/assembled-image/source-proof.test.mjs
python3 -B -m unittest scripts.qualification.worker_context_test scripts.qualification.worker_source_pins_test
python3 -B scripts/qualification/worker_source_pins.py --check
git diff --check
```

Run the filesystem checks on Linux for the required link semantics. The metadata-verification receipt records the separate offline comparison of all exact official metadata against the source lock/inventory. `LINUX-VALIDATION.md` supplies candidate-environment install/import/behavior commands; its unrun checks are not successes.
