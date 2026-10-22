# Codex setup on EC2AMAZ-M7CDRPT

Status: setup only. Neo explicitly said to leave Wave 1 as is and not start Wave 2. No polling automation is activated, no briefs are sent, and no release action is authorized by this setup. Await Neo's direct start instruction. This supersedes the pasted takeover instruction to finish open Wave 1 work.

## Sources and local ownership

Pinned transfer: [90c250288647a738df2f8a92dd1db6fb549655f8](https://github.com/neo-capiro/meri-greenfield/tree/90c250288647a738df2f8a92dd1db6fb549655f8/docs/handover/20261022); PR #206 remains separately owned. Do not modify its branch. Use WORKFLOW.md, PROCESS.md, source-of-truth/STANDING-RULES.md, plan/FINAL-PLAN-20261021.md, plan/NEWSTACK-CUTOVER-PLAN.md, phases/wave2/ and decision-log/DECISION-LOG.md through O195 from that commit. Current instruction files in all three setup PRs share that reference.

| Repository | Integration | Setup worktree | Base |
|---|---|---|---|
| meri-greenfield | main | C:/dev/fable/wt-codex-setup-meri-greenfield | 9c7948ac |
| capiro-backend | backend-import | C:/dev/fable/wt-codex-setup-capiro-backend | ca4de503 |
| capiro-frontend | main | C:/dev/fable/wt-codex-setup-capiro-frontend | 87a84951 |

All use codex/setup-agents-md-20261022. Existing Meri/frontend histories and worktrees are preserved; backend was cloned to C:/dev/fable/capiro-backend without checking out its primary tree. Setup owns only instruction files and the new CODEX-* documentation. Existing Meri checkout has two pre-existing modified docs, untouched. No active product task was reassigned.

Codex coordinates and ships; dot relays/reviews; agents 1â€“4 implement; astra 6 verifies live acceptance. Investigator/reviewer subagents may read diagnostics and Codex's own docs/kits, never product-code review or implementation. Writers, if separately authorized, need their own worktree and exact unclaimed paths. Worktrees share AWS, DBs, Docker, ports and immutable ECR tags.

## Host audit: verified, not assumed

| Area | Verified state | Smallest remaining action |
|---|---|---|
| GitHub | gh authenticated as neo-capiro; all three repositories readable | Existing gh is sufficient; no duplicate connector |
| Source | Existing Meri/frontend repositories found under C:/dev; setup worktrees created | Do not switch original worktrees |
| Node | PATH is 22.23.3; Meri/frontend require 24.x | Use a separately installed Node24 toolchain before gates; no global replacement performed |
| Python | 3.14.7; cryptography missing | Isolated Python environment with cryptography >=42 before infra gates |
| Docker/WSL | Docker29.8.1 server OS Windows; WSL not installed | Qualify Linux Docker and Ubuntu24.04 before Linux/PG16 gates |
| AWS | Neo selected default; STS verified account967807252336, arn:aws:iam::967807252336:user/jump-cli | Use explicit --profile default, region us-east-1; secret permissions unverified; adapt hardcoded capiro-dev kit settings before execution |
| Codex | CLI0.161.0; multi_agent and hooks enabled; app tools available | No extra MCP, database connector or suite-per-edit hook needed |
| Instructions/CI | Meri and FE root AGENTS existed; Core had none; no CLAUDE.md or .github/workflows in these checked integration trees | Preserve FE apps/web rules; required exact-head gates remain mandatory; absence of workflow files is not a pass |
| Transfer | New pinned kits, Wave2 briefs and O195 present | Old release kits are evidence; regenerate for this host, do not execute copied per-release folders |

Build/test commands in AGENTS.md are verified against package manifests, not execution-tested here. No dependency installation, test suite, shipping kit, SQL, credential edit or AWS mutation occurred.

Cross-repo boundaries inspected: Meri packages/contracts is canonical; Core apps/api/src/auth/application-authority.controller.ts exposes POST current; frontend server-side shared/meri-* proxies consume authority and transport contracts. Do not invent private-source imports or duplicate DTOs.

## Conflicts and precedence

The direct handover supersedes old Fable-review/dot-excluded instructions and historical re-clone procedures. The copied CODEX-ORCHESTRATION-SETUP.md still says neomart and instructs Codex to finish Wave1; Neo directly superseded both: EC2AMAZ-M7CDRPT, setup only, Fable finishes Wave1. Historical FINAL-PLAN language about starting the next phase during validation, Fable acceptance or Core-before-Meri does not override the current hold, astra verification or coordinated cut-over. Never run any historical reclone.sh. The new kit README confirms frontend87a84951 is live at revision22, while earlier comments stopped at21; this is transferred evidence, not fresh AWS readback. Core ca4de503 is built but not deployed.

The transferred cut-over plan still names Core89fcf2bb and ship-core-89fcf2bb; the newer kit README/user handover pins ca4de503. Preserve both records; the shipping owner must reconcile exact pins/revisions before any future execution. Historical secret-label count16/20 is a snapshot, not a live quota check. The General-chat reads prerequisite in the pasted brief must be reconciled against the refreshed plan and Neo's direct decisions before M2 is sent.

The updated README supersedes the neomart-only PKI restriction: meri/preview/private-pki and meri/preview/core/identity-bearer are in Secrets Manager, account967807252336, us-east-1. IAM needs GetSecretValue and DescribeSecret on both. Neo provisions IAM/credentials; Codex can use the documented owner-only scratch fetch for future authorized releases. No secret values were requested during setup. All release generators hardcode C:/dev/fable paths and external baseline inputs. The alternate local source roots require a reviewed path mapping/regenerated kit before execution.

## Coordinator loop after Neo starts Wave 2

Use the app heartbeat approximately every10 minutes only after the hold is lifted. Read new non-Codex comments on #202 and relevant PR threads plus pushes/new PRs in all three repos. Skip FROM: Codex. Be quiet when unchanged. Record progress in existing #202/PR/DECISION-LOG/CURRENT-STATE; no new ledger. Do not take over Wave1 unless Neo changes that instruction.

First read Fable's WAVE-1-HANDOFF.md after it is published. Exclude WAVE2-AGENT1-S2-BRIEF.md: S2 is already Wave1-owned under O183 and must not be reassigned. Refresh eligible Wave2 drafts' base SHAs and prerequisites, use backend-import for Core and main for frontend (not ambiguous current-default wording), remove already-shipped work, include verbatim tickets/E-scenarios/standing rules, sequencing and exact file exceptions. Ask Neo for scope/security decisions, not ordinary implementation details. Do not start a lane before its prerequisites or start Wave3 early. Neo starts fresh sessions; each receives only its next brief via dot, with receipt.

For authorized shipping, verify current exact head, dot ACCEPT/ship-request and all BLOCKED gates there; re-review/re-gate every new push. Merge cleanly to the named integration branch, fast-forward when gated/target trees match. Scan exact digest with no HIGH/CRITICAL; log other findings. Publish shipped evidence and PROCESS acceptance packet, respecting STOP2/6. At Wave3 raise staging and os.capiro.ai production-data decisions again.

Completion reminder (instruction, no hook installed): report exact head/tree, files, checks and exits, retained failures, evidence, blockers and next action. Hooks are supported, but no hook is necessary for this docs-only setup.
