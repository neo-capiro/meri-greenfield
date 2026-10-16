# Source-only synthetic controls

Run from the repository root with Node 24 and Python 3.11:

```powershell
./docs/qualification/candidates/dot-budget-planner-20261016/run-controls.ps1
```

`-Help` describes the bounded runner and exit codes. It runs one process at a time, disables Node test process isolation, caps Node heap at 128 MiB, samples working set, stops at 256 MiB or 30 seconds and kills only its owned process tree. Negative controls temporarily replace owned source and restore exact bytes in `finally`. Do not run concurrently with source edits to those same paths.

`controls.json` records argv, outcomes, sampled memory, deadlines and source-restoration hashes. Positive controls total **82 passing cases**: memory 16, intent 13, Python proxy 23, tenant 17, model grant 8, static source proof 5. Negative controls total **12 expected failures**: memory 5, intent replay 3, worker scope 1, product schema 2, UNKNOWN accounting 1. These are separate before/after controls, not 94 passing product tests.

Memory/intent tests use `dependency-seams.mjs`: SHA-256 of JSON bytes replaces canonical JSON, schema validators are stubbed and preparer dependencies expose only their operation constants. That isolates the actual replay/release code under current resource limits. **Canonical JSON, schemas, canonical policy adapters, SDK/CLI, Core, PostgreSQL, TLS/peer observation, Temporal and live provider behavior are unqualified.** Other tests use built-ins and explicitly scripted ports. No service is started and no model/provider/DB call is made.

`setup-attempt-1` preserves a setup failure (relative `--import` path omitted `./`). It is not behavioral evidence. `preliminary-controls` preserves the earlier successful controls with Node's default child-process isolation; the final runner changes to one process to match the shipping allocation. The separate uncounted async ingress attempt was interrupted after producing no output; it remains UNRUN rather than reported green.

## Allocated source follow-up

Application source pin `e05ed76a7c3eedd594c430867356947b403de7ee`, tree `954c5755fb67e0a0245c3d0b2f965f4783e82b76`, includes reserved memory/settings SQL authoring at `95217f888c92b22a53efb154be2d91cb5e4c41aa` and the canonical intent store adapter. Intent SQL remains unauthored on design HOLD; nothing is mounted or executed. The central allocation is `641f298025c4c9f344d9d16f852cb6eb62b21906` on its separate branch, not integrated into this source candidate.

`run-controls.ps1 -Supplemental` runs the new adapter seven cases, existing intent-release 13 cases and static DDL three cases: **23/23 pass**. Source proof passes **5/5** again. `supplemental-controls.json` retains argv and sampling (maximum 49,315,840 bytes). This adds **10 unique checks** to the original 82, for **92 unique passing synthetic/static controls** across the packet; it does not add 28 new checks. The first adapter attempt (9/10) is preserved: its assertion incorrectly expected UNKNOWN from an unreadable claim, and was corrected to canonical `createIntentJournal.begin`'s existing UNAVAILABLE mapping. The release behavior was unchanged. Tests preceded only journal-comment/documentation changes included in the final source pin; their tested executable bytes remain valid. No repeated full suite, typing, compiler, browser, image or database job ran.

The following historical files remain byte-identical to package-four base (verified by an empty Git diff):

| Path | SHA-256 |
| --- | --- |
| `docs/coordination/proposals/FABLE-INTENTS-PROPOSALS-20261016.md` | `2ff708bca99e4426b25fefb7344521e7bcde3af3384febd725498adf4abbc36d` |
| `docs/coordination/proposals/memory-settings-20261016/proposed-memory-settings.sql` | `0b38b7e7f49d167feeeae1627c0fc836290f08112fb7d9f80200a604e686caab0` |
| `apps/gateway/budget/migrations/0002_tenant_budgets.sql` | `651d2573779be28e2be4993ef992d25107d5d51a0e65c5dac6186ab0b9f90da8` |
