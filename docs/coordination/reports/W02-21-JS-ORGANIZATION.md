# W02-21 JS organization — source-only closeout report

**STATUS: PARTIAL SOURCE HANDOFF / UNACCEPTED — SOURCE ONLY — NO-BUILD / NO-HOST**
**sourceManifestCoverage = false — flat-three runtime assembly incomplete**

This report is the factual record of the W02-21 browser-qualification JavaScript
reorganization. It is authored evidence, not acceptance. A session exit, a green
test, or this report never grants a deployment gate. Legacy JS
`classifyHostEvidence` remains UNQUALIFIED; Python is authoritative. Separate
exact-commit review and independent owner verification remain mandatory.

## 1. Session / cap history (preserved, unmodified)

- Author session `20261010_061922_2eb136`, PID 42192, invocation
  `db550eff-06a8-46e2-9c1b-5555d741b61e`.
- Original bound 30 turns / 1200 seconds; closed 2026-10-10T10:26:54.904831Z,
  exit 0, **no commit**.
- The required report skeleton was **missed** in the original session (not written
  by turn 3 or before closure); the report was absent at the closed partial.
- Initial wrong-path setup invocation failed to locate the focused test (setup
  failure, not a defect):
  `.task-inputs/W02-21-author-checks/evidence/focused-setup-wrongpath.stdout.raw`
  0 bytes SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`;
  `...stderr.raw` 82 bytes SHA256
  `c35b05781311886f27a4f370d72bd7dc4a58920d11c608a3dacf8f3b2daff434`.
- First (only) original focused run: 10 cases, **9 PASS / 1 FAIL**, exit 1,
  duration 4942.8651 ms. `focused.stdout.raw` 4773 bytes SHA256
  `f1b3eb2c247f5654383b26cf8d308d9c4a3488b3277aed8e74b55b3c113c1080`;
  `focused.stderr.raw` 0 bytes SHA256 `e3b0c442…`. Failure at test line 115:
  `Object.isFrozen(app.PINNED_IMAGE)` was actually `true` while the authored
  expectation was `false` (a test primitive-semantics defect; source was not
  changed to satisfy the false expectation).
- Those original captures remain immutable and were not rewritten.
- Prior ad-hoc module identity/payload/classifier smokes, a path-form correction
  and source-helper corrections are author historical activity only — not extra
  unique test coverage and not independent owner evidence. PATH Python 3.14.7
  was used for source-helper work in the original session; the qualified 3.12.14
  path was not used there, and the old per-command bounded envelopes are not
  independently established by narrative.

## 2. Continuation scope and the three test-only repairs

Only two tracked paths were edited in this continuation: the focused test and
this report. The eight production files were READ ONLY at the closed-partial
hashes (verified byte-exact below). Exact three repairs, no new cases:

1. Line 115 now asserts `Object.isFrozen(app.PINNED_IMAGE) === true` and explains
   that `Object.isFrozen` returns true for a string primitive; `PINNED_IMAGE`
   stays the original `PINS.image` value binding and no `Object.freeze` or new
   immutable object is introduced. The identity, arity, default, descriptor and
   four shallow-freeze checks are retained.
2. In the two-tuple synthesized-template case, after parsing the complete actual
   template `t`, a direct `assert.deepStrictEqual(t, JSON.parse(readFileSync(
   join(BASELINE_DIR, \`template-${label}.json\`), 'utf8')), ...)` was added for
   each of labels 01/02. No sort/delete/normalization/regeneration; the existing
   targeted field and payload-relationship assertions are retained.
3. Each `__w0221Tag` marker check saves the original own descriptor/absence and
   restores that exact state in `finally`, even on assertion failure; no wrapper,
   replacement or generic monkeypatch framework was added.

Bound: 18 turns / 900 seconds; report skeleton first; final six turns reserved.
No delegation, background process, retry, push or amend.

## 3. Immutable inputs and reconciliation (source/data only)

Reconciliation ran fresh this continuation (qualified Python 3.12.14, `-B`); it
does not rely on the earlier author verifier. Result: `ok=true`, `errors=[]`.

- `manifest-v2.json` SHA256
  `512ae000d750b6292348d3ea1b415301191aa63d3a122b83b7b833cabc2f63d2`; all
  **36/36** records matched byte length and SHA256 against WORKTREE_ROOT.
- Original baseline manifest SHA256
  `d2e6a0a05d306ed1737441dce1d07f991c2dd26f703aa0f9d0553dbcd123b1e1`.
- Read-only source rows: **14/14** matched (the fifteenth row, `app.mjs`, is the
  allocated owned change, verified against its frozen production pin instead).
- Declaration spans: **29 unique**, each appearing exactly once in its allocated
  destination — **28 `RAW_DECLARATION_EXACT` + 1 `ONE_EXACT_URL_BASE_ARGUMENT_ONLY`**
  (the 91-byte `readSibling` parent-anchor exception
  `165a4dd2253e8fe5783f01956d57d174115f8664949636981500a13c62e896a4`).
- Contiguous loader spans present inside `fullUserData`:
  - `fullUserData` 8967 / `01953fded070146470d56caf6f5f4063ff23c9f64b70464ef324df2b7b23fc35`
  - verifier 1227 / `c9081c49485d4626d48ee3424e53c9839cb1ab634e635bd9dd8b445eac12f5fd`
  - delimiter 182 / `43e6c56c3c5381737d6cd920da1b1cec999d6c5977cee181b1fba3325bac7fa1`
  - whole contiguous loader return 7302 / `9c3e59a8fe4d6a3d9e45b943eb86faf534363376a036aae9a59c965660823f7a`
- Entry: exactly 15 direct reexports; exact direct-execution guard; defines
  nothing; exposes no `main`.
- Three separate internal export clauses: `exactSources`, `fullUserData`, `main`.
- Allowed acyclic graph confirmed:
  `config:[]`, `legacy-classifier:[]`, `asset-sources:[config]`,
  `asset-loader:[config,asset-sources]`,
  `user-data:[config,asset-sources,asset-loader]`,
  `stack:[config,user-data]`, `cli:[config,stack]`,
  `app:[config,legacy-classifier,asset-sources,asset-loader,user-data,stack,cli]`.
- External binding origins preserved: `asset-sources` ← `readFileSync`
  (`node:fs`), `createHash` (`node:crypto`); `user-data` ← `gzipSync`
  (`node:zlib`); entry ← `pathToFileURL` (`node:url`); `stack`/`cli` ←
  `aws-cdk-lib`. Text-span/edge reconciliation is source/data evidence, not a JS
  AST or runtime proof.

## 4. Frozen module boundaries and final nine code/test hashes

Entry `infra/browser-qualification/app.mjs` (909 bytes) composes seven ordinary
modules under `infra/browser-qualification/js/`:

| Path | Bytes | SHA256 (frozen after repairs) |
| --- | ---: | --- |
| infra/browser-qualification/app.mjs | 909 | 7ed1409f6f536bff34bf52dce870da522f8aef38b6d8c9aa0fb5634217721f20 |
| infra/browser-qualification/js/config.mjs | 3710 | 78bedcdb059a1a43f17f149593e4fa05fb117f091102255425d870f0c485705a |
| infra/browser-qualification/js/legacy-classifier.mjs | 6064 | 06837cf61b2054571918a7b81b8b79e4b8c5909ef8a4aedf8008c725691ffede |
| infra/browser-qualification/js/asset-sources.mjs | 1632 | f7a0a4f44a696b0a1f1ebcb1942be5709bab4c6d4dc905c5e6bda3e3b88fe619 |
| infra/browser-qualification/js/asset-loader.mjs | 9577 | 52879e0fa04bc44d75a74000a0e3a0b310a6092d7f377c5571685bb5791e153d |
| infra/browser-qualification/js/user-data.mjs | 1577 | aecbfbd373b9adb815ce32f7a5958859b6e82326533a6f5c201c5affc5cf7888 |
| infra/browser-qualification/js/stack.mjs | 6680 | dc156f9f740e1ec07c17d81e569124213b9c5a1971d96a7c0ec694559df4c1b7 |
| infra/browser-qualification/js/cli.mjs | 1178 | 18b47bf597f9cf1d683feca39bb43f4cfc45aa6975d53e8243965f91563864c5 |
| infra/browser-qualification/js-organization.test.mjs | (see §7) | 6178e038e7d14572be5e07d39f76be2be99cb529b6464061d1b5c1754a0668ea |

The eight production rows equal the closed-partial pins exactly, before and after
both checks.

## 5. Focused suite — corrected replay (command 1 of 2)

- Command: `C:/Program Files/nodejs/node.exe --test infra/browser-qualification/js-organization.test.mjs`
- cwd: exact worktree root; child-only PATH prefixed with `C:/Program Files/nodejs`
  and `C:/Program Files/Git/bin`; child-only `MERI_TEST_PYTHON` = qualified
  Python 3.12.14; Node 24.19.0.
- External whole-process timeout 120 s. Envelope: start
  `2026-10-10T10:43:42.680Z`, end `2026-10-10T10:43:46.769Z`, elapsed 4 s,
  **exit 0**.
- stdout 3803 bytes SHA256
  `2eafc3fd0178cbc44df4ace9282430b292f810e65164b122453e306254424f07`;
  stderr 0 bytes SHA256 `e3b0c442…`.
- Result: **10 tests / 10 PASS / 0 FAIL** (duration 3533.4853 ms). Cases:
  1. entry is a small composition surface: exactly fifteen direct bindings, no main export, no definitions
  2. defining-module/entry identity, arity, defaults and shallow freeze are preserved
  3. mutable callable aliases are visible through the defining module and entry
  4. all module imports are inert (bounded observation: marker output, clean exit, no scratch synthesis/output additions)
  5. fixed-tuple loader/payload outputs match the adopted original baseline bytes and metadata
  6. payload returns ordinary fresh allocations with exact Buffer/base64/mutation relationships
  7. invalid inputs refuse with the exact original errors and precedence
  8. cwd-independent sibling reads (loader bytes identical from an unrelated cwd)
  9. legacy classifier default/null/malformed outcomes are the original unqualified ones
  10. synthesized stack reproduces the exact pinned template identities for both fixed tuples
- The 28 fixed refusals include the exact original messages and precedence, e.g.
  both-invalid → UUID error first, `worker-image` → distinct-digest error, and the
  malformed-process `TypeError: Cannot read properties of null (reading 'pid')`.
- Full authoritative template comparison: the complete synthesized template for
  tuple 01 deep-equals `template-01.json` (16688 bytes SHA256
  `fa7cac086ced0e697a59cf202ac55e4d25fe87a3503509868241e48b1c71c46f`) and for
  tuple 02 deep-equals `template-02.json` (16684 bytes SHA256
  `41e26b02d1b2248ae281d4da19a23e10ca1fba61450aca9c9b486f82d935e077`),
  including metadata/UserData, parameters, IAM policies/conditions, resources,
  tags, outputs and arrays. No normalization.

## 6. Canonical suite — first run in this task (command 2 of 2)

- Command: `C:/Program Files/nodejs/node.exe --test infra/browser-qualification/security.test.mjs`
- Unchanged canonical suite; same cwd, adapter env and 120 s bound.
  `cdk.out/browser-qualification` was confirmed absent before the run.
- Envelope: start `2026-10-10T10:44:02.661Z`, end `2026-10-10T10:44:18.364Z`,
  elapsed 16 s, **exit 0**.
- stdout 1392 bytes SHA256
  `1050daf215e0de721a1546c93faa098e794b1a831deb6f9e3d5c8fb4db573499`;
  stderr 0 bytes SHA256 `e3b0c442…`.
- Result: **14 tests / 14 PASS / 0 FAIL** (duration 15120.6221 ms), including
  `synthesized browser-host stack has the exact pinned identities` and
  `codex and owner observer replays remain truthful (module-aware)`.
- Oracle/replay facts remain separate and are NOT new independent JS behavioral
  coverage: directCodex **23**, embeddedCodex **23 (DUPLICATE of direct)**,
  owner **33**, as reported by the unchanged module-aware harness. No raw oracle
  or `module-regressions.py` run was repeated standalone.
- `reconcile-before` and `reconcile-after` both `ok=true`; the frozen nine
  code/test hashes were byte-stable across the run (`final9-before` ==
  `final9-after`).

## 7. Evidence paths, capture limits and cleanup

- New evidence (fresh, exclusive): `.task-inputs/W02-21-author-checks/evidence/continuation1/`
  holding `focused.{stdout,stderr}.raw`, `focused.envelope.json`,
  `canonical.{stdout,stderr}.raw`, `canonical.envelope.json`,
  `final9-before.txt`, `final9-after.txt`, `reconcile-before.json`,
  `reconcile-after.json`.
- Original captures under `.task-inputs/W02-21-author-checks/evidence/` are
  unchanged.
- Bounded-observation limits:
  - The import-inertness child observes marker output, clean exit and no scratch
    synthesis/output additions. It does NOT instrument all asset reads, signals,
    process or network operations; static source inspection supports no explicit
    import-time application action while module loading itself performs reads.
  - Windows direct-process timeout does not by itself prove descendant-tree
    cleanup. No descendant-cleanup instrumentation is claimed.
  - Focused/canonical results are offline evidence, not guest/cloud/host
    compatibility, native sandbox proof or a deployment gate.
- Both child processes exited 0 with empty stderr; no reader/writer processes
  from this continuation remain open. Ignored canonical outputs
  (`cdk.out/browser-qualification/`, `.task-inputs/observer-audit/tmp-<uuid>/`)
  were produced by the unchanged suite only.

## 8. Deferred gates (unchanged)

Legacy JS classifier UNQUALIFIED. `sourceManifestCoverage=false`, flat-three
runtime assembly incomplete, NO-BUILD / NO-HOST. W20/JS combined compatibility
and the complete 14-asset pre-import protocol/packaging remain future separate
owner allocations. All 49 findings / 22 severe OPEN; Office DEFERRED;
native/browser/security/G1 OPEN; paid Bedrock zero; current Meri/Capiro untouched
and source connectivity disabled. No acceptance is conferred by these author
checks.
