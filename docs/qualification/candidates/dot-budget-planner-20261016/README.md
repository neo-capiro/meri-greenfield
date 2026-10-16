# Source-only synthetic controls

Run from the repository root with Node 24 and Python 3.11:

```powershell
./docs/qualification/candidates/dot-budget-planner-20261016/run-controls.ps1
```

`-Help` describes the bounded runner and exit codes. It runs one process at a time, disables Node test process isolation, caps Node heap at 128 MiB, samples working set, stops at 256 MiB or 30 seconds and kills only its owned process tree. Negative controls temporarily replace owned source and restore exact bytes in `finally`. Do not run concurrently with source edits to those same paths.

`controls.json` records argv, outcomes, sampled memory, deadlines and source-restoration hashes. Positive controls total **82 passing cases**: memory 16, intent 13, Python proxy 23, tenant 17, model grant 8, static source proof 5. Negative controls total **12 expected failures**: memory 5, intent replay 3, worker scope 1, product schema 2, UNKNOWN accounting 1. These are separate before/after controls, not 94 passing product tests.

Memory/intent tests use `dependency-seams.mjs`: SHA-256 of JSON bytes replaces canonical JSON, schema validators are stubbed and preparer dependencies expose only their operation constants. That isolates the actual replay/release code under current resource limits. **Canonical JSON, schemas, canonical policy adapters, SDK/CLI, Core, PostgreSQL, TLS/peer observation, Temporal and live provider behavior are unqualified.** Other tests use built-ins and explicitly scripted ports. No service is started and no model/provider/DB call is made.

`setup-attempt-1` preserves a setup failure (relative `--import` path omitted `./`). It is not behavioral evidence. `preliminary-controls` preserves the earlier successful controls with Node's default child-process isolation; the final runner changes to one process to match the shipping allocation. The separate uncounted async ingress attempt was interrupted after producing no output; it remains UNRUN rather than reported green.
