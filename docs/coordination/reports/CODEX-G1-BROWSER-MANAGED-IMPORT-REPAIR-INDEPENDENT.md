# Codex independent managed-executor import repair review

**PASS for the narrow SOURCE repair; no operational or runtime admission.** Reviewed closed report-only candidate `fe706f2e690841f97fff8a47d945212077f77732` from dedicated reviewer base `fa00d587ddf7793457fde7191a24bfdef3b8a631`. The previous candidate 29777d9 and independent HOLD `ec829f2f6fa29ba421b6f142334a8272c6ae44cb` remain immutable. This review finds the identified ordinary-import bypass corrected; it does not relabel the old candidate.

I authored the earlier independent finding and parts of inherited history/reader preparation, but did not author this loader repair. I read the repaired entry/binding, exact diffs, author report, all nine new control bodies, adapted eight/two control diffs, supervisors and raw outcomes. No candidate import, executable control replay, native subprocess, Node, AWS, operational main or network action occurred. Reviewer stdlib source/AST/DATA/hash work and finite read-only Git commands are the only executions.

## Why the import boundary is now closed

`managed_executor._load_binding()` reads the fixed binding path into `raw` once, checks the literal binding SHA, and passes **that same `raw` object** to `compile(..., dont_inherit=True)` and `exec` in a privately created `ModuleType`. It does not call a Python source/bytecode/extension loader, resolve an import spec, publish the private module in `sys.modules`, accept a caller loader/path, or insert PACK in `sys.path`. Consequently, an adjacent package/native extension/pycache cannot substitute for the verified binding. The prior PACK-root stdlib-shadow route is also removed: the binding's stdlib imports do not search PACK under the required isolated fresh-child invocation.

The entry refuses the thirteen fixed candidate/domain/private names and all their dotted submodule variants if already present in `sys.modules`. Help and invalid arguments return/refuse before binding loading. The private binding itself is the small, literal-hash trusted bootstrap; the full 1020-record closure is checked by `m.check` before SOURCE10 domain code is imported. This distinction matters: the claim is not that no Python code executes before closure validation. Trusted entry/bootstrap/stdlib bytes execute first and remain externally pinned invocation prerequisites.

SOURCE10 still has an exact twelve-entry directory inventory, followed by protected raw file/runtime/origin/stage validation before its directory is added and `wire_binding` imported. This refuses additional pycache/package/native/stdlib files in that domain directory. The repair does not attempt a universal defense against a compromised interpreter, installed import hooks, preloaded malicious stdlib or filesystem changes after checks. The future owner supervisor must invoke the exact fresh Python3.12.14 `-I -B -S`, nonoptimized, with verified entry/bootstrap/runtime and replacement environment. No such operational supervisor is supplied or admitted here.

The only binding changes are its fixed new PACK literal and the explicit original source-owner root used to interpret byte-identical `source-origin.json`. That root is source-defined, not caller input. The rest of the binding is exact after those two substitutions. The main function's first argument checks and all statements after the bootstrap replacement are AST-identical to the rejected candidate. No admission callback, role/caller check, action/request, originalC900 margin, global consume key, cleanup/error or operation ordering changed.

## Exact DATA/source verification

| Record | Bytes | SHA256 |
| --- | ---: | --- |
| Author report | 9476 | c2f9c4463729ccaef663d809e6ab1e3050e62be26da93f4a987845170bf62036 |
| Author FINAL-MANIFEST | 290481 | 4ebbfe9b7921101c3682ca0ed311d62e412c478d4e01f574dcc4315d027186f8 |
| Repaired executor closure | 387421 | 59efbbe76318d8560cffe9e8367da34cc5d248cd2ef1e5eeec2cf320da8fb71d |
| managed_executor.py | 6082 | f04ab6d5313a08019b6960b7e159ae6b231009e659a869be7994e1cbafa05dc8 |
| managed_binding.py | 9487 | b971dc09fe8aceff7ef08f8fa571a1fe794e6e84f5d28ff1b71ad14eeaef3875 |
| managed_bridge.mjs, unchanged | 2401 | aa7223d8a23fe09f66bd45454e29dc30a6728a828d868045e2e33d6579736f32 |

All 1102 unique author-seal records were independently rehashed before and after preservation. All 1020 executor closure records and 969 runtime names were retained. The twelve SOURCE10 files, eight JS dependencies, managed bridge, synthetic recipe, predecessor inventory, source-origin and runtime inventory are byte-identical to the earlier reviewed pack. The same 27 historical predecessor references are reused; no fresh service captures or rewritten historical ACKs were produced. Original closure `c43419bc18c6099357f28f542126da7dc81f52a112fb3dabccf371e6c75d27de` and SOURCE10 closure `aaa9ad75a4e56f6fddca152129b05da9b08baf0e1fafac63921d0a410774598f` are unchanged.

Current author Git is clean exact fe706f2, with only the new author report added. Raw HEAD/parent/status/name-status/binary-diff stdout and stderr were preserved. The reviewer copied 62 sealed files within the new evidence pack, plus seal/postcommit/report/raw Git anchors; external runtime and historical files remain measured references. This is trusted local DATA readback, not hostile-filesystem or historical kernel proof. Preliminary read commands used two nonexistent guessed filenames; those lookup failures were retained in the tool transcript and caused no candidate execution.

## Controls and evidence qualifications

No author control was rerun. The original bootstrap run is retained as **7PASS/1FAIL/1ERROR**, exit1, 0.844seconds: rapidly changed adjacency made the test's PathFinder observations stale. Corrected test source adds exactly three `importlib.invalidate_caches()` calls; production source is unchanged between the two runs. The corrected nine groups are **9/9PASS**, exit0, 0.844seconds. They cover a valid-timestamp/size hostile cache, ordinary-search package/extension witnesses, a fresh stdlib-shadow import outside PACK, all thirteen preload names/dotted variants, hash drift, safe help/refusal, single raw binding read, and actual full closure loading before domain import.

The adapted original eight executor groups are **8/8PASS**, exit0, 1.750seconds. Their entire `Checks` class AST and assertions match the original. The two composed entry groups are **2/2PASS**, exit0, 2.312seconds; their class AST matches after removing the one explicit test-only private-loader injection. This extra patch is required because those tests deliberately preload domain modules, which production now refuses. Their other mocks, synthetic paths and consume/order/UNKNOWN assertions remain. They do not establish a real composed current-role/service path.

Help exited0 and missing arguments exited2, each within its ten-second envelope. All six envelopes retain binary streams and equal full pre/post records. For the initial failed bootstrap envelope, old active control paths correctly resolve to the preserved version-one files and hashes; comparing those historical rows to the later corrected active files would be false drift. The author 60second direct-child supervisors and postbuffer PIPE capture do not prove process-tree cleanup or a live byte cap. Audit hooks are API controls, not OS isolation, and are installed after known inert entry/control imports. The reviewer independently checked the reported source/AST relationships and raw counts; observed author passes remain author evidence, not new reviewer runtime passes.

The three-module organization remains coherent: thin fixed executor/bootstrap, protected binding/admission/bridge preparation, and thin canonical JS decoding entry. No generic loader framework, duplicate authority or second workflow was introduced.

## Remaining operational boundary

The corrected source still cannot be invoked operationally from this report. Root must separately admit an exact external 600second process-tree supervisor, current IAM/KMS/cost/caller/role authority, a genuine complete managed history recipe and its immutable graph/version/input/name/source bindings, originalT0/C and exact fresh owner freeze/admission. No actual managed history, original clock or operational owner inputs exist in this pack. SOURCE9 local mutations remain unadmitted; old consumed records cannot be reset or reused.

Raw errors, capture-only status, cleanupUNKNOWN and physicalAbsence/runtime false remain. Actual EC2 TestState wire/error profiles, physical absence, managed survival, real host/browser sandbox, all security findings and G1 remain OPEN. This source PASS authorizes no cloud action or security waiver.

Reviewer evidence: `.task-inputs/managed-import-repair-review-1`; DATA verification: `data/verification.json`. Review CLOSED; root owns integration and any future operational admission.
