# Stored read continuation after PR99

Reviewed remote base: PR99 `81b3df7a0e9016e4dde8bb78418fb9901243ee54`, tree `34571ec3353e6daa74a499a153dc8e9d33bc4de3`. Local parent `7987ec6460fd2cfb8ca4d7a43555aa38e09147ce` has that exact tree; the successor publishes on remote PR99. PR99 branch and release checkout remain untouched. Dedicated sparse worktree: `task-4/meri-stored-next`, branch `codex/meri-general-reads-stored-next-20261016`. Disk checked before creation: approximately 5.8 GB free. No dependency install or heavy archive.

## Exact dependency and platform classification

Recovered Zod 4.6.7 from the existing npm cache without network or shared writes. The 1,141,941-byte tarball matches the committed worker lock integrity `sha512-g8W2D2kU6a8untc053fX1uVBKzM7yqAxW/3zwk83+6RyF2+SKOuV+c0wBDhUwzV1PaGapmZH+rmcUzPf+3CGwg==`. It is extracted only in task-local dependencies. All other packages are borrowed through task-local junctions. Test Node uses `--preserve-symlinks`; worker schema, SDK and MCP package resolutions all select task-local Zod 4.6.7. Their direct pinned versions remain SDK 0.3.295 and MCP SDK 1.32.1. No lockfile or product startup changed.

The original PR99 worker/MCP/family/retained-admission/availability/native/disclosure checks now pass **72/72** with exact Zod 4.6.7. This closes the local Zod mismatch only; it establishes no native/live qualification. Original PR99 failed outcomes remain immutable.

The Windows exclusion failure predates this lane: `assertWorkspaceRoot` in unchanged `apps/worker/conversation/capabilities/workspace-tools.mjs` rejects every backslash using its explicit regex, and the unchanged fixture supplies `realpathSync`'s native Windows path. Those two files and the exclusion test are byte unchanged from PR98 and PR99. The failure is a Linux-oriented workspace permission boundary/platform support limit, not a newly exposed excluded tool or read-family regression. No product path guard or test is weakened here.

## Implementation outline and ownership

Preserve the existing contract, gateway current authorization, CONTROL native identity/credential owner, measured installation, durable budget and single `meri_reads` registry. Add cohesive source adapters for PE references, state legislation, federal legislation, stored intelligence, regulatory dockets and intelligence summary, after verifying each pinned actual producer and unchanged receiving contract.

Root owns shared registry/context/credential eligibility, measured source manifests, ledger and a small retained native-handler composition helper. The helper centralizes the already-established native decision/coherence, fixed-route JSON transport and private carrier mechanics shared by these new stored-read adapters; it creates no query engine, authorization system or orchestration loop. One data-only `native-families.mjs` owns finite-native eligibility for dispatch, credentials and result handling, replacing their repeated lists. Family modules own their exact operation/route sets, any explicit producer bridge and domain receiving behavior. Existing PR99 directory source stays unchanged.

Four bounded OpenAI/Codex authors exclusively own PE-reference, state-legislation, federal-legislation, and the three stored-search family directories and compositions. They do not edit shared files, contracts, startup, infra, locks or migrations, and do not delegate. Root independently verifies returns and obtains independent source review before publishing each increment. Planned implementation/review window: 120 minutes with focused serial Node checks, 256 MiB heap and per-test deadlines, followed by further source increments until concrete external adapter/data dependencies remain.

Federal implicit designations must bind the existing server-owned `defaultCongress` and POST an explicit canonical bill selector, while preserving the original request for receiving validation. Other first-batch families have empty context. Raw flat requests otherwise ensure one native trim/clip/default pass. No source activation, credentials, provider calls, native database execution or live acceptance is implied.

Remaining-family audit continues in parallel. Every residual family must retain a precise source/context/data dependency; no blanket absence of live credentials is used to stop authorized source implementation.

## Verification and disposition

Six families and ten operations are implemented and exposed: PE references (3), federal legislation (2), state legislation (2), stored intelligence (1), regulatory dockets (1), intelligence summary (1). The canonical Congress bridge uses the frozen selected non-null bill ID for native dispatch, including explicit aliases, while all other raw fields and the original request/hash remain unchanged. No duplicate grammar or ambient calendar is introduced.

Current source: **43 operations / 26 worker families**, **41 of 82 selected source reads implemented and exposed**, **41 missing across 22 families**, **live zero**. All historical capability/exclusion rows remain unchanged outside the current-source exposure snapshot. Research portfolio, portfolio changes and Florida project reads remain implemented/exposed on their existing path.

| Check | Outcome |
| --- | --- |
| Exact Zod worker/MCP rerun of PR99 | 72/72 passed |
| Shared helper plus unchanged Windows exclusion guard | Helper 10/10; exclusion guard 6/7, same platform refusal |
| Six source adapters, shared helper, mounted native-owner wiring, all gateway family/registration and new MCP integration | Initial 436/446 passed; ten new MCP gate cases expected an empty policy to return null, while canonical policy correctly rejects empty `readFamilies` |
| Corrected MCP-only rerun | 30/30 passed; tests now assert a valid excluding family returns null and an empty policy rejects |
| Retained gateway, worker family and exposure/drift group | Initial 114/115; old negative fixture used newly implemented `get_bill_status` as its missing adapter |
| Corrected exposure-only rerun | 16/16 passed; fixture explicitly removes adapter and family registration while preserving the same no-manufactured-adapter assertions |
| Staged/source whitespace, unchanged central contracts/locks/infra and clean release checkout | passed |

The initial failed assertions and corrected reruns are retained. No product behavior, policy guard or assertion was weakened. Author checks additionally cover unchanged frozen contracts: PE 61/61, state 73/73, federal 85/85; stored search adapters 32/32. These are reported separately from root verification.

Independent OpenAI/Codex review recorded **ACCEPT_SOURCE, no blocking findings** for the integrated six-family candidate. Reviewer independently ran helper+adapter suites 121/121, new MCP cases 30/30, all ten mounted native-owner operations 40/40, and eight additional federal assertions covering captured Congress 118 in context/credentials, rejection of 119 substitution, missing context refusal and original scope cancellation without native authority I/O. Source manifests include each new adapter/helper and the shared eligibility data; existing native fingerprints also bind the changed eligibility data, so old receipts cannot silently authorize it.

Full successful/failed output and invocation lists are retained in `stored-next-20261016/`. No Core HTTP, provider, SDK model query, database, AWS, credential, migration, startup, infrastructure, lockfile, activation or deployment action occurred. Exact dependency checks do not qualify native/live behavior. Continue source work for the remaining families; use the ongoing audit's concrete mode, clock, name/citation-resolution and source-effect boundaries rather than treating missing live credentials as a source blocker.
