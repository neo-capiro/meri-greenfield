# W02-21 JS organization — distinct actual Hermes review (review-1)

STATUS: **PASS — OFFLINE SOURCE / ORGANIZATION REVIEW ONLY**. This is not acceptance;
root independently owns acceptance. Legacy JS classifier remains UNQUALIFIED,
`sourceManifestCoverage=false`, flat-three runtime assembly incomplete, **NO-BUILD / NO-HOST**.

- Reviewer session: `20261010_070952_111c98` — distinct actual Hermes reviewer, NOT the author
  (`20261010_061922_2eb136`) and NOT the integration/acceptance owner. No resume.
- Exact review target: `c4fbce05a75128a89e805b5603472f95d559f387` (direct child of `c77a07504c6630f7866d6beb9046732520ee667d`).
- Worktree: `C:/dev/main/meri-greenfield-worktrees/w02-browser-js-organization-review-1`; branch `review/w02-browser-js-organization-1`.
- Sole tracked write: this report. No source fix, baseline regeneration, dependency install, push or amend.
- Budget: 30 turns / 1200 s; skeleton committed at turn 3; final 8 turns reserved.

## 0. Input pins (independently verified)

| Input | Bytes | SHA256 | Result |
| --- | ---: | --- | --- |
| `.task-inputs/W02-21-review-1/ALLOCATION-v2.md` | 19236 | `3bf0ef02354323e4bf1ecbed302cd5b3a10997d8e55a66a772baba6b16d4208a` | MATCH |
| `.task-inputs/W02-21-review-1/manifest.json` | 77703 | `e94ac665cc8495c41721f33217eeabe78a473f7eafde31c9dc80d7b16abfbd5b` | MATCH |
| `.task-inputs/W02-21-review-1/runtime-readback.json` | 2770 | `cf9ceef90392ea172cc348671ab7d8e04d7abaf1892d782a7e5237c2f3bdd95f` | MATCH |

Reviewer pin readback (`reviewer-tools/pins.py`, static, no candidate import): `HEAD == c4fbce05…`
and `ok=true, errors=[]`; all **24/24** current source records matched by worktree bytes+SHA256,
by source copy, and by raw Git c4 blob (`hash-object --no-filters` == `rev-parse c4:<path>`);
all **36/36** immutable input copies matched; original input manifest
`512ae000d750b6292348d3ea1b415301191aa63d3a122b83b7b833cabc2f63d2` matched; `node_modules`
Junction resolved exactly to `C:/dev/main/meri-greenfield-kickoff-20261009/node_modules`.
All 8 production files matched their frozen pins (e.g. app `7ed1409f…`/909, config `78bedcdb…`/3710,
legacy-classifier `06837cf6…`/6064, asset-sources `f7a0a4f4…`/1632, asset-loader `52879e0f…`/9577,
user-data `aecbfbd3…`/1577, stack `dc156f9f…`/6680, cli `18b47bf5…`/1178), final test
`6178e038…`/27065 and author report `fbaf0f57…`/12943. Pins re-verified pre and post every check
(no drift; see envelopes).

## 1. Full-read scope

Read in full: the eight production files (`app.mjs`, `js/{config,legacy-classifier,asset-sources,
asset-loader,user-data,stack,cli}.mjs`), the final focused test `js-organization.test.mjs`, the author
report `docs/coordination/reports/W02-21-JS-ORGANIZATION.md`, original `reference-app.mjs` (509 lines),
frozen `declarations-29.json`, `api-and-routing.json`, `loader-text.json`, `source-and-canonical.json`,
`baseline-source-review.md`, both COMPLETE immutable templates `original-baseline-2/template-01.json`
(16688 B) and `template-02.json` (16684 B), the unchanged canonical `security.test.mjs` (529 lines,
sufficient to understand its bounded fake actions), and frozen supplements
`FINAL-AUTHOR-EVIDENCE-AUDIT.md` and `owner-static-1.json`. Read-only throughout.

## 2. Declaration / loader / API / graph / template findings

Reviewer-owned static readback (`reviewer-tools/static_readback.py`, raw bytes only, no candidate
import) — `ok=true, errors=[]`:

- **29 declaration spans**: **28 `RAW_DECLARATION_EXACT`** (each extracted at its frozen original
  byte offset/length/hash from `reference-app.mjs`, then found **exactly once** at its assigned
  destination) **+ 1 approved exception** `readSibling`. The exception is exactly
  `const readSibling = (name) => readFileSync(new URL(name, new URL('../', import.meta.url)));`
  (91 B / `165a4dd2253e8fe5783f01956d57d174115f8664949636981500a13c62e896a4`) present exactly once in
  `js/asset-sources.mjs`; the original 75 B / `e67cad20…` text is absent. No other body/default/
  config/algorithm change. Destination counts config 9, legacy-classifier 10, asset-sources 3,
  asset-loader 2, user-data 2, stack 2, cli 1 = 29.
- **4 whole-loader spans** byte-exact and present exactly once in `js/asset-loader.mjs`:
  `fullUserData` 8967/`01953fde…`, `verifierDeclaration` 1227/`c9081c49…`, `delimiterDeclarations`
  182/`43e6c56c…`, `wholeContiguousLoaderReturn` 7302/`9c3e59a8…`. No shell edit, minifier or
  fragmentation; interpolation/order preserved.
- **15 direct public reexports**: entry `app.mjs` reexports all 15 names, each defining declaration
  present exactly once in its target module (config 7 constants + 2 validators, asset-sources
  `sha256`, asset-loader `shellQuote`, user-data `buildUserData`/`buildUserDataPayload`,
  legacy-classifier `classifyHostEvidence`, stack `BrowserQualificationStack`). Entry **defines 0**
  exported declarations and **exports no `main`**. Direct-execution guard present exactly once
  (87 B / `3cd31d8b…`).
- **Exact acyclic import graph** (missing and extra edges checked, not subset containment):
  `config=[]`, `legacy-classifier=[]`, `asset-sources=[config]`, `asset-loader=[config,asset-sources]`,
  `user-data=[config,asset-sources,asset-loader]`, `stack=[config,user-data]`, `cli=[config,stack]`,
  `app=[config,legacy-classifier,asset-sources,asset-loader,user-data,stack,cli]` — exact match.
- **Both complete templates** pinned: `template-01.json` 16688/`fa7cac08…`, `template-02.json`
  16684/`41e26b02…` (author-report pins reproduced). Complete-field review of `template-01` covered
  Description, Metadata (UserData metadata, raw/compressed payload bytes+sha, 3 source records,
  `nativeCloudInitExecution`), Parameters (AllowedPattern/AllowedValues/Default/Description), 11
  Resources with logical IDs, KMS key policy + `EncryptionContext`, IAM role/policy `kms:ViaService`,
  SG egress/ingress, instance MetadataOptions/BlockDeviceMappings/DependsOn arrays, tags, and 6
  Outputs; no field deleted/sorted/normalized. `template-02` differs only in the run UUID / synthetic
  digest tuple. The candidate's own `deepStrictEqual` comparison of full synthesized templates to
  these files is an author/owner check, not reviewer execution (§3 limits).

## 3. Reviewer checks — exactly three bounded children

Common setup: pinned `C:/Program Files/nodejs/node.exe` (v24.19.0), verified Python 3.12.14
`…codex-primary-runtime/dependencies/python/python.exe -B` as the reviewed stdlib wrapper
(`reviewer-tools/run_child.py`), child-only PATH prefixed
`C:/Program Files/nodejs;C:/Program Files/Git/bin;`, `MERI_TEST_PYTHON` set to that Python,
`NODE_OPTIONS`/`NODE_PATH`/`PYTHONPATH`/`PYTHONHOME` and provider/AWS credential variables removed
(names recorded, values never printed), stdin `DEVNULL`, exclusive `xb`/`x` capture in a NEW result
dir, external **direct-child** timeout, binary stdout/stderr preserved before post-pin validation.

1. **focused10** — `node --test infra/browser-qualification/js-organization.test.mjs`, cwd = worktree
   root, external 120 s. Result: **exit 0**, elapsed 3.219 s, stdout 3860 B /
   `6598317d50e5b6b537664339c778d8efa8576ca1fd82845122de64e6a175899a`, stderr 0 B / `e3b0c442…`.
   **10 tests / 10 pass / 0 fail** (duration 3098.3296 ms). Fresh intrinsic namespace created:
   `.task-inputs/W02-21-author-checks/focused-out-210c70b7-3fb8-499b-a526-8eb8260f2244/` (absent
   before). Six CDK warnings appear in **stdout** (unused `QualificationAssetsImage`, pinned AZ and
   pinned AMI × 2 tuples) despite empty stderr — consistent with the frozen author evidence.
2. **canonical14** — `node --test infra/browser-qualification/security.test.mjs`, same cwd, external
   120 s. Result: **exit 0**, elapsed 16.859 s, stdout 1389 B /
   `0d69b96cb937eb1279506a0f6330149ea2921292bf42bf272069a3b3cb111895`, stderr 0 B / `e3b0c442…`.
   **14 tests / 14 pass / 0 fail** (duration 16775.9973 ms). Fresh namespaces created:
   `.task-inputs/observer-audit/tmp-f0ecc222-ac52-4ca5-93a2-da4b65027735/` and
   `cdk.out/browser-qualification/` (both absent before). Unchanged canonical suite only; no
   Linux/host/browser/Docker/cloud/native qualification.
3. **own-control** — ONE independently written finite own-literal composed control
   (`reviewer-tools/own-control.mjs`), run under Node with a fresh nondefault cwd
   (`results/own-cwd`), external 30 s, only after both suites succeeded. Result: **exit 0**, elapsed
   0.344 s, stdout 1031 B / `1df5ab275619c20cc6a083290bca68ddf89c88d8b3518418735ae2a950af9bb5`,
   stderr empty. **26/26 checks pass.** Facts: imports only the pinned production entry + defining
   modules; direct alias identity for `buildUserData`/`buildUserDataPayload`/`classifyHostEvidence`/
   `sha256`/`shellQuote`/`BrowserQualificationStack`/`PINS`; own descriptor set + `finally` restoration;
   independently fresh root/raw/compressed/metadata/sources allocations; mutation of one result does
   not leak to a peer or a later result; fixed source metadata matches the immutable pins
   (`bootstrap.sh` 13121/`205f1d22…`, `host-evidence.py` 49064/`b9325f77…`, seccomp 17188/`e62f4c3e…`);
   NEW independent UUID `9f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f` and synthetic same-repo digest
   `…@sha256:` + `3`×64; literal original error precedence (`UUID_ERR` before `DISTINCT_ERR`).
   No third template synthesized; no classifier/oracle algorithm replayed. It is ONE composed
   control, not universal new coverage.

All three envelopes record `pre_pins_ok=true`, `post_pins_ok=true`, `source_drift_detected=false`.
Raw captures and envelopes are preserved under
`.task-inputs/W02-21-review-1/results/{focused10,canonical14,own-control}/`.

## 4. Attribution and preserved limits

- **Actual author** (session `20261010_061922_2eb136`): original 30-turn/1200 s run closed with **no
  report skeleton and no commit**; a wrong-path setup failure; one focused run **9 PASS / 1 FAIL**
  (test primitive-semantics defect at the `Object.isFrozen(PINNED_IMAGE)` line — source not changed);
  Python **3.14.7** was used for original source-helper work and must not be conflated with the
  later qualified **3.12.14** continuation. Corrected continuation: 18 turns/900 s, closed
  `2026-10-10T10:45:43.023438Z`, exit 0. New `reconcile-1.py` was ADDED after the 86-file snapshot,
  not an old scratch overwrite. Author focused stdout 3803 B / `2eafc3fd…` (10/10), canonical
  1392 B / `1050daf2…` (14/14), both stderr empty. **Author envelopes lack** complete
  external-supervision/argv/environment/prepost-pin/cleanup proof; the author substring/subset/regex
  helper is weaker than the owner's static proof. Import-inertness fixture is limited marker/exit/
  scratch observation, not all IO/signals/process/network.
- **Codex owner**: independent owner worktree ran focused10 and canonical14 ONCE each
  (`10:56:59–10:57:22Z`), external 120 s/direct-child, 60 pre/post rows stable; frozen
  `owner-checks-manifest.json` `99462e62…` and `owner-results-verification-1.json` `7ccfc6f5…` are a
  root DATA reconciliation, **not reviewer execution**. Owner static proof (`owner-static-1.json`,
  `f7312bfc…`, helper `preflight.py` `708e4173…`) supplies exact counts/residual-binding/guard/exact-
  acyclic-graph checks; it is not a JS parser or universal behavior proof. **Owner focused10/canonical14
  PASS and root DATA verification are separate from this reviewer execution.**
- **Canonical internal counts** are 23 direct Codex + 23 embedded DUPLICATE + 33 owner + 7 W17 newCases
  + 5 integrity; the duplicate execution is NOT distinct W21 JS coverage and must not be summed into it.
- **Reviewer limits**: this PASS covers only an offline source/organization/offline-behavior review of
  the exact c4 candidate against frozen maps, the original reference, and the two complete original
  templates. It does not establish guest/cloud/host compatibility, native browser/renderer sandbox,
  durability, Fargate placement, W20/JS combined compatibility, or the complete full-14-asset
  pre-import protocol/packaging (later owner gates). Direct-child timeout does not prove descendant
  cleanup; whole-session supervisor closure is separate. The own-control is one finite composed
  observation, not universal equivalence.

## 5. Verdict and gates

**PASS** for this offline source/organization review only. Source review findings are finite and
positive: 29 spans preserved (28 exact + the single approved `readSibling` anchor), four loader spans
exact, 15 direct aliases intact, defaults/config/shallow-freeze and ordinary mutable payload semantics
preserved, exact acyclic graph, small composition-only entry, and complete template/payload
preservation. Root independently owns acceptance.

Unchanged gates: legacy JS classifier **UNQUALIFIED**; `sourceManifestCoverage=false`; flat-three
runtime asset assembly **incomplete**; **NO-BUILD / NO-HOST**; future W20 combined compatibility and
full-14-asset packaging gates. **49 findings / 22 severe OPEN**; **Office DEFERRED**; native/browser/
security/G1 **OPEN**; **paid Bedrock zero**; no cutover, no current Meri/Capiro change, source
connectivity disabled. Reviewer owns no acceptance, deployment, resource mutation or waiver.
