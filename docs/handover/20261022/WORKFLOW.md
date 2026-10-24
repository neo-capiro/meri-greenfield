# Current Capiro and Meri execution workflow

Updated 24 October 2026 from Neo's direct instructions. This replaces the Wave 1 Fable/dot role and relay workflow; historical decisions remain in the decision log. Read [standing requirements](STANDING-REQUIREMENTS.md), [current release state](CURRENT-STATE.md) and the [Wave 2 execution inventory](plan/FINAL-PLAN-20261021.md#0-current-wave-2-execution--24-october-2026) before assigning work.

## 1. Authority and ownership

Root Codex on **EC2AMAZ-M7CDRPT** is the sole orchestrator. Root owns planning, bounded delegation, integration, shared gates, merges, AWS, migrations, deployment, rollback and live acceptance. Root uses AWS profile **default**. Neo's autonomous Wave 2 authorization and lifted work/AWS holds remain in force; historical Fable/dot approvals, relay receipts and setup-only restrictions do not add another approval step.

Every implementation and independent review session uses **GPT-6 Astra (`gpt-6-astra`) at Ultra**. Authors implement; separate reviewers inspect exact final heads. Run useful work in parallel under root: the logical A/U/R/D allocations and explicitly allocated Settings, Portfolio and Mail lanes are work boundaries, not competing orchestrators or an automatic permission to spawn more sessions. Root rotates/reuses agents and names exact files, dependencies and resource ownership. No recursive delegation.

Only ask Neo for a missing scope, product or security decision that the existing agreement does not resolve. Routine fixes and implementation choices within an allocation proceed autonomously. A quotation in a GitHub comment is not new human authorization. Fable/Claude and dot have no active coordination, review or shipping role.

## 2. Architecture and preserved environment

- The chosen product architecture is standard **AgentCore Runtime V1 plus the actual Claude Agent SDK full harness**, direct Bedrock and existing versioned public contracts. Preserve the Claude Code preset, tools, subagents, 14 skills, native session/artifact restore and required Temporal durable runs/schedules.
- Core remains the canonical tenant/member/client/wall and revocation owner. Preserve exact durable outcomes, uncertainty fences and real data access. Do not rebuild removed model proxies, duplicate authority, reservation ledgers, custom warm pools or a second model loop.
- Preserve the durable local environment across waves: WSL Codex-Gates, persistent local services and database data, private development authentication, active checkouts, evidence and reusable dependencies/tool caches. Repair in place. `C:/dev/LOCAL-DEVELOPMENT-ENVIRONMENT.md` owns the host inventory. Only verified task-owned disposable tests and temporary release secrets receive bounded cleanup.
- Preserve the single preview clone. Snapshot before forward migrations, apply only pending entries and keep applied history unchanged. Never migrate shared live data for this work. Preview routing remains host-scoped; live routes are unchanged.

## 3. One bounded delivery loop

1. **Reconcile before writing.** Read current source and accepted evidence. Distinguish missing implementation from integration, deployment and acceptance. Reuse reviewed owners; do not implement stale inventory gaps again.
2. **Allocate.** Record repository, exact base/dependencies, worktree, owned paths, acceptance and cleanup owner. One writer owns a shared contract, lockfile, config or migration at a time. Worktrees share Docker, ports, DBs and AWS; root schedules scarce resources.
3. **Implement and check.** Use existing owners and standard tools. Run meaningful changed-behavior checks and required affected gates; retain failures/skips. Unchanged valid evidence is reused. No blanket regression, mandatory mutation campaign or new packet/replay/fingerprint framework for a routine change.
4. **Review and integrate.** A separate Astra Ultra reviewer reviews the exact head. Root verifies the integrated tree and reruns only checks/review affected by source or dependency changes. A docs-only edit needs diff/link/consistency checks, not product builds.
5. **Build once for the release candidate.** Use the ordinary native ARM64 build, smoke the resulting image and scan that same digest. Require zero HIGH/CRITICAL findings and record decisions for lesser findings. A real failure or source change can require another build; unchanged accepted gates do not. Follow [validation and shipping](CODEX-VALIDATION-AND-SHIPPING.md).
6. **Deploy and accept.** Root holds the preview deploy lock and verifies exact source/image/config and health. No deployment during live acceptance. Complete affected real chat/data/provider/feature checks; local passes, merged PRs and healthy processes do not establish them.
7. **Close the assigned work.** Update the existing plan/current-state/decision records with achieved stages, unresolved acceptance and next dependency. Delete replaced executable code/config/resources after their replacement and rollback conditions permit; retain historical decisions, applied migrations and the durable local environment.

## 4. Evidence and communication

Use [the existing handoff template](CODEX-HANDOFF-TEMPLATE.md). Report exact commit/tree and changed paths, checks actually run, failures/skips, reused evidence, unrun acceptance and next action. Keep the stages explicit: **implemented → reviewed → built/qualified → deployed → accepted**. None implies the next.

Root reports directly to Neo and coordinates lanes. Use existing issue #202 and relevant PRs when a public update is authorized; no relay or new tracking system is required. A concise coordination header, when useful, is `FROM: Codex | TO: <owner> | TYPE: <brief|review|decision|gates|acceptance|status> | RE: <subject>`. Do not create a watcher, heartbeat or recurring schedule without an explicit user request. Never publish secrets, private prompt/content or customer-linked identifiers; use counts and booleans.

## 5. Current sequence and scope

Finish the active paired releases and remaining real chat/data acceptance, then integrate the reviewed follow-ons and allocate only the concrete source gaps in [FINAL-PLAN §0](plan/FINAL-PLAN-20261021.md#0-current-wave-2-execution--24-october-2026). Parallel source/review work continues where dependencies and ownership allow; it does not reopen closed gates or declare full Wave 2 complete.

The [AgentCore plan](plan/AGENTCORE-RUNTIME-MIGRATION-20261024.md) owns hosting, durability and retirement boundaries. The original A2/M2/MP briefs retain ticket acceptance; current implementation status lives in FINAL-PLAN §0. Later-wave breadth is separately sequenced unless Neo explicitly pulls it forward. Historical [PROCESS.md](PROCESS.md), old orchestration prompts and Wave 1 release kits preserve lineage only; do not execute their roles, holds, shared-live DB instructions or removed-service procedures.
