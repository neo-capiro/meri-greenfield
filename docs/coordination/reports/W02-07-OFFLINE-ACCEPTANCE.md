# Office export preparation acceptance

Codex accepts exact candidate `8eacd0f3eda4de8c15262973ab1eddc7207cdc2e` for offline preparation and later individually admitted qualification. It contains real Hermes repair3 `e82923dc5b1057e79acc99e28d3d9f5b0553773a` and explicitly attributed Codex corrections. Earlier rejected candidates and their reviewer reports remain preserved; they establish no acceptance.

Separate actual Hermes reviewer `20261009_200325_a4a525` returned report-only commit `0fcac0a29a32ba818656e778227b68557115f273` against the exact candidate. The launcher observed two remaining descendants after the reviewer parent exited, terminated them, and confirmed the process tree empty and both evidence readers complete. Its status is `descendants-terminated-unreviewed`, not clean parent-only exit. Codex inspected the report, exact scope and source after containment. No reviewer source edit or cloud action occurred.

The owner personally reran 55 candidate tests and the reviewer's fresh baseline-derived harness: valid encoder/decoder positive; 42 encoder, 6 child-result and 11 decoder mutations all rejected with reasons. Earlier owner replay also accepted the already-captured real baseline3 payload and rejected 20 payload / 6 decoder mutations. This is evidence of validation behavior using captured facts and synthetic bytes, not a new native Office run.

The integration adds exactly the three probe/test source files and the implementation report. Source hashes remain:

| File | SHA256 |
| --- | --- |
| office-export.mjs | 78a3526f0e7ea738f675433a5289c49552011cef7267a2c9057827fb42ab5156 |
| office-reconstruct.mjs | 133d8c5adbfae930aa5e59d7d633e73482994106382cebef35b065d059303205 |
| office-export.test.mjs | da1087cd155c64a85a5d9dd818db275688f6e8610719d665007a8649e3423dde |

Post-integration owner checks: root 15 passed; Office 55 passed; staged whitespace clean. The first root Office invocation failed to load the SDK because the nested dependency directory was absent. After verifying byte-identical nested lockfiles, the owner created an ignored local junction to the already installed new SDK qualification dependencies and reran successfully. No dependency install or lock change was used. The reviewer separately disclosed its unused-SDK ESM stub in a dependency-free review checkout. Neither setup is runtime qualification evidence.

Retained facts match the original probe, including a genuinely blank initial XLSX cached value, numeric recalculated 6, exact structure/member observations and the actual `recalc.file` path. Unsafe ancestor paths fail before work; only definite process-group absence and child close establish cleanup. Input/output bounds and full chunk/hash/end checks remain intact.

Native export, complete CloudWatch delivery/reconstruction, inspection of the real eleven files and four PNG pages, visual QA, image security, Fargate admission and G1 remain open. Process-group checks are not OS isolation and filesystem snapshots cannot prove globally atomic traversal. The native task must use the final reviewed image, explicit `EntryPoint:[node]`, Office command and blocking awslogs; prior-image evidence does not transfer automatically. No current Meri/Capiro change, source access, paid model dispatch or cutover is authorized by this acceptance.
