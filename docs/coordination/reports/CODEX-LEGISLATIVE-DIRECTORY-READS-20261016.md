# Legislative directory read implementation

Task-owned base: `caa7810ff19c09c8f7ea1c2524c025f36f99ccd6` (PR98, verified remotely and locally).
Branch/worktree: `codex/meri-general-reads-civic-20261016`, task-4/meri-general-reads.
Release source and candidates are read-only. Work uses a sparse checkout, shared Git objects and borrowed dependencies; no install or archive. Initial free disk: approximately 1.7 GB.

## Implementation outline

- Add the cohesive `legislative-directory` source adapter for `get_committee_roster` and `list_members`. The adapter owns two fixed POST routes, original flat requests, bounded HTTP and unchanged frozen receiving checks. Federal and state roster projections remain distinct; no new directory/query engine.
- Reuse canonical contract normalization and `retainedCall` admission, retained HTTP transport, native CONTROL credential/current-context owner, gateway current tenant/user authorization, measured installation, durable budget and final release checks. Context is empty; model selectors establish no authority.
- Compose the family in the gateway and the existing `meri_reads` family list. Extend only the existing finite native-family selection seams. No runtime startup, central contract, lockfile, infrastructure, migration or deployment changes.
- Fresh native identity/membership, task/run/allocation/operation grants and both native credentials remain owned by existing CONTROL services. Missing inputs refuse; registration and source measurement confer no availability.
- Verify exact serialized request/response, jurisdiction and state refusal, incomplete Senate notes, no inferred federal districts, leadership/identifier lineage, corruption/limits/cancellation, tenant/user drift, operation grants, installation, durable settlement/UNKNOWN behavior and MCP reachability. Tests use synthetic HTTP/SQL and in-memory MCP; no live Core, database or provider execution. Focused commands use Node 24, bounded heap and execution timeout.
- Refresh only the generated current-source exposure ledger. Keep research portfolio, portfolio changes and Florida budget project reads present and exposed; all qualification/live gates remain open. Preserve historical scope evidence and all 43 owner exclusions.
- Obtain independent OpenAI/Codex source review before a source-only draft PR under standing publication approval. Planned implementation/review window: 75 minutes; external actions limited to repository reads and reviewed branch/draft publication.

## Source evidence

Core producer map: `neo-capiro/capiro-backend@384325afaaf7ad34aeb9ff9b2f183d667ee17343`, `docs/retained-read-producer-mapping-20261016/federal-producers.json`, reviewed SHA-256 `61e2dccc226548abe41ab6103c054fccb87f198386a601f19cbf1f1bc46b2ce5`, operations 15/16.
Actual producer inspected at `b525032222515d636b0dae2d46e40c7c3d8b5528`, `apps/api/src/meri/meri-tools.service.ts`, lines 5680-6105. Existing authenticated native tool transport is `POST /api/clio/tools/:name`; current user plus internal service secret are both required. The original raw request is sent so Core performs normalization once.

Historical published read pin `b8f8339ce5c8899a9f023e6646cc143f775551b9` was verified through the supported GitHub commit API. It is not a local object and is not the task base. `c68bcca48971608bf5e72e6eedcb5cd75fc77ea0` is absent locally and GitHub returned 422/no commit; it is not relied on. No applicable `.agents/skills` directory exists in the task/source ancestry; repository AGENTS.md and implementation standards were read.

Baseline source reconciliation (actual generator, independently read): 31 general operations, 19 worker families, 29 of 82 selected source reads implemented/exposed, 53 missing across 29 families; live zero. The checked-in exposure snapshot predates already-present source and incorrectly reports 23 operations/61 missing. Full historical ledger regeneration retains its preexisting reference-classification HOLD; this task uses the supported exposure-only refresh.

## Result and module boundaries

Implemented `apps/gateway/sources/legislative-directory/handler.mjs`, composed in the existing family integration and worker `meri_reads` registry. It uses exact native routes, original flat JSON, bounded retained transport and the frozen contract. Its federal/state projections, selection refusal, incomplete Senate warning, nullable source fields and lack of inferred federal district are preserved. No dead implementation was found or removed.

Existing CONTROL task/current-run/allocation and native identity/membership owners remain canonical. The family adds only finite eligibility entries in those owners and the result carrier/release seams. The new family requires exact operation grants, same current tenant/user principal, current source authorization, genuine native bearer and service secret. No additional contracts or dependencies were introduced.

Generated current exposure now records 33 operations / 20 worker families, 31 selected source reads implemented and exposed, 51 missing across 28 families, live zero. The change from the stale checked-in 23/61 also includes 8 operations already present in the base; this increment implements only the two directory operations. All historical capability rows, exclusions, proposal gates and qualification evidence are preserved. Research portfolio, portfolio changes and Florida budget project remain implemented and exposed through their existing path.

## Verification and remaining gates

Runtime: Node **24.19.0**, `--max-old-space-size=256`, `--test-concurrency=1`, per-test timeout 20 or 30 seconds. Dependencies are read-only junctions to existing installs; no install or lockfile change. Existing worker qualification dependencies supply SDK 0.3.295, MCP SDK 1.32.1 and **Zod 4.6.5**. Worker source requests Zod 4.6.7; exact pinned dependency qualification is therefore still open.

Commands and complete successful/failed output are retained under [legislative-directory-20261016](legislative-directory-20261016/).

| Check | Result |
| --- | --- |
| New source adapter, native owner family wiring, initial MCP file | 72 passed; worker file initially failed to resolve Zod |
| New MCP/schema/installation cases after borrowing existing worker dependencies | 6/6 passed |
| Gateway family/registration/retained regressions, native credential owner/disclosure wiring, unchanged directory contract and independent receiving tests, source exposure/drift | 362/362 passed |
| Worker family/schema/retained admission/availability/native/disclosure regression files | 66 passed; unrelated exclusion file initially failed for sparse window-resolution dependency |
| Exclusion guard after resolving sparse source and borrowing existing window/UI dependencies | 6/7 passed; existing Windows `WORKSPACE_ROOT_REFUSED` refusal in unchanged workspace-tools source |
| Current exposure regeneration/drift; `git diff --check` | passed |

The failed exclusion setup attempts (missing window-resolution, Temporal polyfill, then AI SDK) remain visible. Each was rerun only after adding the missing sparse source or borrowing its existing dependencies. The final workspace-root refusal is not weakened or repaired in this read-family task. The unchanged guard rejects native Windows roots before its aggregate SDK-surface assertion; the six other exclusion checks and source-exposure 43-exclusion guard pass. No native Core, PostgreSQL, SDK model query, provider or cloud gate was exercised.

Independent OpenAI/Codex reviewer `/root/read_family_audit` recorded **ACCEPT_SOURCE, no blocking findings** after source review plus independent adapter 22/22, mounted new-family owner/dispatch 16/16 and whitespace checks; reviewer also inspected the 6/6 MCP artifact. Final ledger/report completion is separately read back before publication. This accepts source only.

Remaining: current authentic installation/discovery and per-call native grants/credentials; exact pinned dependencies; actual Core HTTP/receiving and database/source qualification; physical/live deployment gates. The two original skills declaring directory operations remain unadmitted; general exposure does not admit them. Source implementation and exposure do not establish qualification or live acceptance.

External actions are limited to repository source reads and reviewed branch/draft publication. No AWS changes, credentials, SQL/migrations, activation, provider calls or deployment occurred. The release checkout stayed clean. The local app could not resolve coordinator thread `01a0ff18-26cd-7609-beba-87726d0300c6` for an interim status message; delivery was denied by `thread not found`. Final platform handoff remains the coordination channel.
