# Six-case unpaid local baseline

Completed actual deterministic local execution of the six accepted pilot templates, through `createLocalActionDemo`, the application Request/Response routes and the public `receiveActionResponse`. Final **6/6 PASS**, **zero approvals and task effects**, **zero model/provider calls**. This validates implemented synthetic route/semantic behavior, not language routing, human-request provenance or model quality.

Base PR45 `658bb5c0f8c47b80904cbc5c7453b3f8c3dba79c`; initial source `1f6beb497589efdd6cf43d524f2037bc2430bb7b`; repaired executable source `d16896b348daa765f3cb069732c9a70e5ffe13b0`; final CLI capture at `07d9de9bdbf76bb11edb59ff7da0022d7648d3a5`. [Runner/API](../../../evals/action-followthrough/local-baseline/README.md), [task outline](../tasks/CODEX-ACTION-PILOT-BASELINE-20261013.md), [final actual receipt](../../qualification/candidates/action-session-20261013/pilot-baseline-author/final-baseline.stdout.bin).

| Case | Actual outcome |
| --- | --- |
| P01 | Query200; Issue/Changed/Matters/Recommend; recommendations, not tasks; tool.started/completed only. |
| P02 | Query200; unknown enumeration/freshness, null sourceAsOf, no negative assertion or absence support despite complete page. |
| P03 | Query/draft200; explicit edited title/no date; no preparation or execution. |
| P04 | Query/draft/prepare200; exact source-bound task.create proposal remains approval_required. |
| P05 | Same host preludes; execute409 COMMAND_APPROVAL_REFUSED / NOT_DISPATCHED; zero effects. |
| P06 | Fresh session revoked before query;401 UNAUTHENTICATED / NOT_DISPATCHED; zero source reads. |

All six use separate demo instances, opaque sessions and stores, with current generated lookup/result/proposal identities. The accepted demo retains its synthetic binding-template IDs across instances; no new native tenant/run namespace is claimed. Five synthetic source reads and two pending metadata rows are expected across the six independent cases. Every acquired session closes and its post-close query is refused401 without added effects. Six rows remain in the denominator on construction, validation, semantic or cleanup failure; no automatic retry. Gold/templates and all existing product/public/frontend files are unchanged.

The new callable is `runLocalPilotBaseline({mode:'synthetic-local',createDemo?})`; the optional factory is only a trusted verification seam. `node evals/action-followthrough/local-baseline/cli.mjs --run` performs the actual run and emits a bounded scrubbed JSON receipt. Import/help/invalid arguments are inert; success0, failure1, invalid2. The CLI resolves its own checkout for the existing fixture. No credential or raw exception text is emitted; final evidence is13,472 bytes. Each case uses the canonical six-second lifetime; all cleanup ports share a separate canonical one-second lifetime. The qualified capture command is bounded240 seconds.

Initial normal CLI6/6 and author6/6 passed. Independent negative controls then exposed three real cleanup gaps at the initial source: diagnostic stats failure prevented close; a parked post-close HTTP handler blocked later cases; a parked post-close body reader did likewise. Reviewer commits93fd907f and245a221e preserve those failures (13/15 plus1/2). `d16896b3` always attempts close independently of diagnostics and bounds close/HTTP/body/public validation through the canonical lifetime. Original assertions remain, with two additive author regressions. Repaired author **8/8**, unchanged independent **17/17**, and final CLI **6/6** pass. No further source defect was reported during independent review; final review packet is separately owned.

[Offline audit](../../qualification/candidates/action-session-20261013/pilot-baseline-author/audit.json) passes37/37, pins all six reused source/gold dependencies, checks the exact receipt hashes and preserves all original entries. Four captured owned process groups are physically absent, without kill or timeout. The only discovery read failure was a guessed top-level action-application module path; the actual accepted public receiver is `packages/contracts/dist/action-application.mjs`. No behavior depended on that failed read.

No installation, SQL engine, native runtime, external provider/model, listener, cloud or frontend action occurs in this lane. It reuses existing scripted source/store fixtures and does not add a shared-pool engine. Paid pilot authorization, real SDK routing, human adjudication and all deployment/runtime gates remain separate. This unpaid baseline does not change the sealed pilot's six-case documentation or its spend status.
