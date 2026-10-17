# Meri consolidated backlog and integration report

Owner: Fable (integration owner and the **only** AWS shipping owner). dot owns Core/backend, shared and non-Meri frontend, cleanup, cross-service deployment coordination and the final live E2E. Coordination happens in GitHub PR comments, mainly meri-greenfield PR #121.

**Status vocabulary** (one per row, never inferred from source existence or unit tests):
- `source` — code exists on a branch; focused tests may pass.
- `integrated` — received on the integration branch with the combined focused set passing.
- `qualified` — runs in the real image or native environment (installed packages, Linux, real PG, real SDK) with evidence.
- `deployed` — running in capiro-dev under an approved change.
- `live-verified` — exercised end to end by a real authenticated user, with evidence.

Integration branch: `fable/meri-first-chat-receiving-20261017` (PR #133), on root `59856683` (seal `c7af4ed6`). Each lane works on its own branch or worktree and records its state in `docs/shipping/20261017/lanes/<lane>.md` on its branch: owner, branch, exact commit, remaining tasks, dependencies, tests, acceptance criteria and status. The integration owner receives lanes into PR #133 after review.

## Lanes

| # | Lane | Owner (session) | Base / pins to receive | Status (17 Oct) | Key dependency |
|---|---|---|---|---|---|
| 1 | First shipment: images, deploy readiness, authenticated chat, saved history, second turn, Stop, task cleanup | Fable (this session) | PR #133 | Node runtime image **qualified** (`6617b236…`, build `398713a3`); proxy images B3 in progress; change set source; nothing deployed | Neo's stage approvals; dot: Core activation, listener map (backend PR78), frontend image |
| 2 | Read-tool families and skills: real adapters, authorization, installation/discovery, live qualification | lane-2 session | PR125 `69688364` accepted; PR132 `bba4ef68` HOLD_TESTS; Core PR52 `51c15744`, PR59 `59efe08f`, PR68 `8d6733c3` | source (69 complete / 3 partial / 10 absent of 82; installed/qualified/live 0) | Core read handlers (dot); denied scope-ledger payload stays unpublished |
| 3 | Conversation write intents: proposals, approvals, execution, durable results | lane-3 session | root `59856683` plus write-intent sources (to inventory) | to inventory | Core write contracts (dot) |
| 4 | Conversation lifecycle: history, paging, reconnect, pause/resume, recovery, continuation | lane-4 session | root `59856683` (conversations 0001–0017) | source, partial | none for source; lane 1 for live |
| 5 | Memory, tasks, settings, schedules, budget and model grants | lane-5 session | PR131 `2a247510` HOLD; PR128 `6f315108` accepted (774/774); C occurrence `5aa13719` | source HOLD; routine flow 0/2 (HTTP 502 SCHEDULE_TOOL_FAILED) | Core memory parser `87e140a0` unpublished (denied push); preference PG retry denied |
| 6 | Documents and artifacts: generation, revision, previews, downloads, qualified rendering | lane-6 session | root `59856683` (`apps/artifacts`, document tools) | to inventory | artifact schema migrations (central IDs) |
| 7 | Objective → Strategy → Planner, server-owned execution surviving browser close | lane-7 session | PR129 `047526c7` REVIEWED_HOLD; PR127 `d1512708`; PR123 `b2f0a5d7`; Core PR64 `806a0939`, PR66 `49f328eb`, PR61 `eef7cd1b`; Planner backend PR54 | source, incomplete | Objective Ed25519 issuer; Core producers (dot) |
| 8 | Browser and Bash: sandbox readiness, destination enforcement, approvals, runtime qualification | lane-8 session | root `59856683` (worker sandbox, gateway) | to inventory | Linux runtime qualification (image gate) |
| 9 | Post-shipment: browser takeover, authenticated website workflows, Office editor, device/browser bridge | lane-9 session | to inventory | preparation | owner decisions awaiting Neo, preserved |

## Rules for every lane

- Inspect existing source before building anything new. No duplicate implementations; remove dead code only when it is verified dead.
- Separate branch or worktree per lane, with clear file ownership. Shared files (frontend shared modules, backend contracts, migration IDs, lockfiles, infra, `packages/contracts`) are changed only after a coordination comment to dot on PR #121, naming the exact commit, files, proposed change and required response.
- **No AWS writes, paid builds, live SQL, credential creation or listener/DNS changes** from lane sessions. Those belong to the AWS shipping owner (lane 1) under recorded approvals. Read-only AWS inspection is fine.
- Never retry or indirectly publish denied payloads (the scope ledger blob `28865e43…`, Core memory parser `87e140a0`, the preference PG retry). Do not bypass access denials.
- Run focused tests while editing; run the broader suite once on a coherent candidate. Fix failures; do not rerun unchanged deterministic failures.
- Report capabilities, blockers and owner decisions in the lane file and a PR comment; the integration owner consolidates them here.

## Integration log

| Time (UTC) | Event |
|---|---|
| 17 Oct 07:16 | Final Codex seal `c7af4ed6` received; root `59856683` verified (PASS_SOURCE_OBJECTS_ONLY) |
| 17 Oct ~08:30 | Gate 1 receiving `cd1e58ad`: runtime 99/1 skip, owner 99, issuer 112, product Python 154/2 skip |
| 17 Oct 10:51 | Node runtime image qualified (build `398713a3`, digest `6617b236…`, zero findings) |
| 17 Oct 11:11 | Proxy B1 `23210a45` FAILED (smoke HOME; receipt read-back 403), both fixed in `839fb16d` |
| 17 Oct 11:50 | Proxy B2 `8724a1fb` FAILED (LiteLLM native callbacks), fixed in `f9b43fd9`, real smoke passes locally |
| 17 Oct ~12:00 | Proxy B3 `2741f56a` started |
