# Intent result-release repair candidate

Base `eca78d458acb46cbfd54a94cf870841d999ef6b1`; parent finding: PREPARED replay returned content before current authorization, while worker admission checked tenant rather than current client/resource scopes. **HOLD for canonical adapter acceptance/composition.**

`apps/control/intents/result-release.mjs` owns only current release admission. The control mount requires a trusted canonical `resultRelease.check` owner before listing or preparing. It captures original authority scopes/expiry before the preparer, journals that ceiling with immutable PREPARED result custody, and checks fresh current authority after settlement and on every replay. Release binds the exact result/request hashes and current RunBinding. Scope resource IDs and policy revisions must belong to both original and current authority. Original grant expiry and command proposal expiry never extend. Refused release preserves custody and never calls the preparer again. Legacy outcomes missing the original ceiling are withheld.

Worker `prepared.mjs` independently intersects command/schedule/document result scopes with the validated scopes passed by `runtime.mjs` through `server.mjs`; it also checks command proposal expiry. Original result identity survives a resume. The helper remains outside the command executor; artifact filing/executor ownership was preserved.

Exact local owner protocol and pending decision: [DOT-BUDGET-PLANNER-PORTS-20261016.md](../proposals/DOT-BUDGET-PLANNER-PORTS-20261016.md), IR-1. No canonical authorization adapter is fabricated by this candidate. The existing command metadata `read`/`read_release` owner must remain canonical; resumed results need current authority for the original immutable output. No frozen contract, migration, SDK loop or approval/execution behavior was changed.

Synthetic controls in `docs/qualification/candidates/dot-budget-planner-20261016/`:

- Replay-check ablation: **0/3 pass, 3/3 fail** (revoked client, original expiry, missing original authority).
- Original worker prepared-result admission: **0/1 pass, 1/1 fail** (revoked resource/policy scope).
- Repaired control-flow suite: **13/13 pass**, covering fresh/replayed release, resume, revocation during preparation, immutable custody, missing owner and malformed/expired receipts.
- These controls explicitly mock schema/hash/preparer dependency seams. They execute the actual mount, journal, release helper and worker result admission over scripted authority/preparer ports. They are not canonical policy, SDK, database or live evidence. Exact bytes were restored after each negative control.

Normal dependency-backed control intents and SDK/MCP worker suites, canonical release adapter integration and typechecking are **UNRUN** because no exact dependency installation/heavy slot is available. Existing fixtures were updated to supply visibly synthetic release owners; those fixture updates are not production authorization. Existing inventory globs include the new test. Changed h proof rows: **none**; h and historical manifests are preserved, source proof 5/5.
