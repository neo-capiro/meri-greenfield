# W02-17 collector extraction handoff

**Offline source candidate, owner-completed; independent actual review pending. INCOMPLETE RUNTIME ASSEMBLY / sourceManifestCoverage=false / NO-BUILD / NO-HOST.** This report is not a deployment or G1 acceptance.

## Attribution and allocation

Base `32401bca6104c7a1c6c877d48a7a5dc0d94e9362`, branch `task/w02-browser-collector-modules`. The adopted brief has SHA256 `da179b388d154453ac1decfab5fcd179ea13f1b264ff58d8cac9e72401ca2528`. Its exact 12 paths are the nine source/test files below, `component-pins.json`, the browser README and this report. App, bootstrap, profiles, support recipes, controllers, contracts and lockfiles are unchanged.

Actual Hermes session `20261010_030543_04ba88` produced two capped partials with no commit. Initial invocation: 07:05:40.852101–07:20:06.065318 UTC, 30-turn/1,800-second bound, PID12080, exit0. Explicit continuation: 07:32:20.334856–07:39:22.871622 UTC, 20-turn/900-second bound, PID41988, exit0. Both confirmed empty process trees/readers/cleanup and preserved captures; exit0 did not constitute acceptance. The integration owner then repaired the test boundary and completed these handoff files. The resulting ordinary commit is an owner completion, not an authored Hermes commit or separate review.

Closed-partial preservation manifests: initial `abc8c07ccb456040d6ead3cf462bcb1dc8da3ccf1d0d6338ee0a34bc7cc4424a` (60 files), continuation `d32a4693490d3cc0268a09c27f73c9013f69089a31f0504adf0c6035af1a3fb9` (124 files). They retain source, patches, scratch checks and process evidence before owner edits. Private captures remain outside Git.

## Focused source structure

Configuration, bounded evidence IO, pure classification, collection and callback polling now live in six cohesive package files. Explicit acyclic imports retain definition-time defaults. `collection.py` owns one `_CANCEL` and one `_EXE_HASH_CACHE`; the entry aliases those same objects. Entry bytecode suppression precedes package import. No production forwarding wrappers, source rewriting or dynamic package loader was introduced.

The immutable reference entry SHA256 is `cf27ce1d1c5cf0c45ba2a1fc2a6cf6d48bd0506728202645ecb4d4f68411679f`; canonical 39-body map SHA256 is `ca0739e1504be61e819789af646dbad0950b6e67e141016a94969dba0ba65ea7`. All 39 definitions occur once at the allocated boundaries and retain raw source segments. The 24 deferred functions are not rewritten in this phase. Full final-commit source preflight and independent review remain separate owner checks.

| Source | Bytes | SHA256 |
| --- | ---: | --- |
| `infra/browser-qualification/host-evidence.py` | 49064 | `b9325f77a2528c3370f1a719eda909b3303826fcb028eb5b008ed12eba78b5dc` |
| `infra/browser-qualification/module-regressions.py` | 12281 | `000d62ac0f36a077b1539592c8da8ab6c33cb16887efe786f8784a633dd4a708` |
| `infra/browser-qualification/security.test.mjs` | 40891 | `27c85cf8a612259a0476c043ddbeee27921f03baecb558382df34f8df557f899` |
| `infra/browser-qualification/host_evidence/__init__.py` | 432 | `d1f277344c9e72675e21e7c288dde1e0225c8c5e9eeb69ad700f353671dfb184` |
| `infra/browser-qualification/host_evidence/config.py` | 2033 | `32d74d6c8cc10f0ed744231f2d8edd09a96742057adb5d3f5db5e7c8ce202d59` |
| `infra/browser-qualification/host_evidence/evidence_io.py` | 703 | `918b894be309999f061ad0e1cfae25a43e2a6dedb599958b5de18fe5442f76ce` |
| `infra/browser-qualification/host_evidence/classification.py` | 16753 | `a9b05cc2caed38c8d4b74a9cac816fe5fd189f31d48a1f4e707272d37190c17a` |
| `infra/browser-qualification/host_evidence/collection.py` | 19858 | `bbcd697aaca5cbcaadaae052629d82ceb02c3cd36512057780984b648411dbce` |
| `infra/browser-qualification/host_evidence/poll.py` | 4284 | `8868ff3145083848b7524a4e91914ddfb122075c63ce462df4afc61ebaa9d336` |

## Harness repairs and retained failure history

The first invocation attempted an invalid test path, then ran the already-extracted partial rather than a clean baseline. Its eventual canonical result was 13/14 with undefined `p` in case9. Earlier standalone green summaries did not establish complete coverage: an embedded assertion was dropped, the collection fake targeted an entry alias, and fixed result paths could overwrite evidence.

Continuation repaired the undefined variable, restored the embedded failure assertion, retained full in-memory groups, and corrected fake routing. Its first canonical run failed on historical summary keys, the second passed 14/14, then comment cleanup removed the unchanged oracle's historical source boundary. Its last runs failed (owner replay group was empty), and its unverified marker-adaptation patch was not accepted.

Owner completion removed that unverified adapter and restored the one historical comment boundary before deferred browser capture. Original oracle assertions and comparisons remain. Owner strengthened exact collection `_read` call/argument assertions with an unused entry alias, made the module inventory a literal six-file allowlist, and gave each canonical invocation a fresh UUID directory. Full child stdout/stderr are exclusively captured before assertions. These are test/handoff repairs; the six extracted bodies and all deferred functions remain unchanged.

Immutable inputs are unchanged: codex oracle `d1900a591a6b43b92f194223b2be1838e2d3e15eb4454d78b7e23b02140275e2` (10,615 bytes); owner oracle `383360dd17127cae2df73c25cb5b963e0c0e283a29022701573509231661c528` (8,842 bytes); deferred baseline `cbfd952e97936dcf5a1538ff769e4a897308d55482417fb5055860c45b27f471` (36,537 bytes). Fixture adaptation changes import setup, effective collector patch routing and exact output-capture anchors only; oracle inputs remain read-only. Local fixture/source reads and production imports occur. Host process/kernel/network/command behavior is faked; these tests do not prove universal import IO absence.

## Owner completion verification

One justified post-repair canonical replay on Node24.19.0/Windows with installed Python3.12.14, bytecode suppression/UTF-8 and process-local Git Bash: `node --test infra/browser-qualification/security.test.mjs`, 07:47:07.922587–07:47:21.514838 UTC, exit0, **14 passed / 0 failed**. Complete stdout SHA256 `de9b3221dd29e5c474800534ca1e46be228cbfc0437fe8da2a13e81eb771d14f`; stderr empty. Relevant `node --check` and `git diff --check` also exited0, finishing 07:47:21.623978 UTC. Nine source/test files were stable before/after. No redundant standalone replay followed the canonical harness invocation.

Full replay facts SHA256 `efc68950dfc9494ece5146d1af37ed21f4be3e8d89276e277218b59635b9b84e`: 23 direct codex, 23 embedded codex, 33 owner, seven new module and five harness-integrity evaluations all passed. The embedded23 duplicate direct codex coverage; the historical distinct case count is56, not79. This is not 91 unique tests or native evidence. Owner completion manifest SHA256 `cbccea55a692b8aeee7f6210b4c713e1357e15c73ef7a1eb57980738d003b76f` retains commands, times, captures, source hashes and fresh fixture directory.

## Remaining gates

The entry is still49,064 bytes with deferred browser/admission/export/CLI responsibilities. Later focused Python and JavaScript extraction plus a separately reviewed complete pre-import asset manifest/loader/support packaging are mandatory. The unchanged flat-three source binding cannot assemble this package; the source inventory explicitly records coverage=false. Python3.9 grammar is not actual guest3.9/API qualification. No host, container, network, AWS, provider, source, paid inference, build or deployment was executed for this task. The 49 image findings including22 CRITICAL/HIGH remain OPEN, Office remains DEFERRED, Bedrock paid usage remains0/$10 and G1 remains OPEN. Current Meri/Capiro and cutover are untouched. A distinct actual Hermes review and independent owner acceptance of the exact commit must precede source integration.
