# Meri kickoff status

Updated 9 October 2026, America/New_York. Owner: Codex integration.

## Current outcome

Both supplied plans were read. The independent private repository and two new isolated AWS qualification stacks exist. Frozen contracts and bounded Hermes delegation are accepted. The refreshed worker built, and baseline3 is **STOPPED exit1:5/6 probes passed, Chromium sandbox failed**. No active Fargate task, application service, source connection or cutover exists. Current Meri and Capiro remain untouched.

The pinned Chromium/dropALL Fargate configuration reaches verified helper namespace creation and fails with EPERM. The user explicitly approved qualifying a NEW dedicated isolated browser host, with app/control staying on Fargate (D005). Host prerequisite discovery and bounded design are next; no host has launched, no sandbox relaxation is authorized and no gate is promoted. See reports/W02-FARGATE-BASELINE-3.md.

## Human decisions and discovery

Private repository neo-capiro/meri-greenfield; checkout C:\dev\main\meri-greenfield-kickoff-20261009; main integration branch. New resources only in account967807252336/us-east-1, with fresh exact STS before mutations. Eventual Capiro access uses newly written trusted gateway connectors; existing code, RLS-bypassing roles and provider secrets are not reused by workers. Tooling-phase notification was delivered. Production cutover remains unauthorized.

Bedrock supersedes the brief Anthropic-key choice. US-only us.anthropic.claude-sonnet-4-6 may route east1/east2/west2; app resources stay east1. Synthetic data and **$10 aggregate paid-model-test cap** remain binding. One free owner CountTokens call returned31. **Paid Bedrock inference spend $0**; no InvokeModel/Converse, proxy role or existing provider secret retrieval.

Windows11/PowerShell; Node24.19/npm11.17/Git2.55/AWS CLI2.36.8, GitHub neo-capiro. Local Linux Docker daemon unavailable; new CodeBuild builds immutable images. capiro-dev resolves to arn:aws:iam::967807252336:user/capirocli; default has no credentials. Installed Hermes0.20.0 uses its existing default profile, bounded CLI fallback, explicit bases/deadlines/session IDs and Windows Job cleanup. No active qualified dispatcher, global setting changes or automatic retries. Worktrees/ordinary credential stripping are not an OS sandbox.

Read-only Capiro snapshot fd8765ec01d292013758606204f2c9d886cd31c1:139 capabilities(104reads/35writes),22datasets;96 provisional/43 deferred/zero accepted parity. Preserve the existing checkout and untracked files. Current app/app-dev share live ingress, and DB roles bypass RLS. Clerk/local actor bridge, client-wall grants, governed-memory lifecycle and mailbox/meeting ownership require distinct checks. No private rows/secret values retrieved. See docs/SOURCE-INVENTORY.md.

## Gates and accepted preparation

**G0 OPEN for live-source scope/identity/principal decisions. G1 IN PROGRESS with failed browser baseline. G2-G7 NOT RUN. W03 and dependent live work remain queued.** Independent G1 preparation may overlap without promoting dependencies.

- Contracts0.1.0 frozen at7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3, tag contracts/v0.1.0:28 strict definitions/10 boundary checks. Authoritative LF schema SHA256 e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b; CRLF hash correction made no protocol change.
- H00 accepted a398b9ea after separate real Hermes review and independent owner15 checks. Historical scope/cleanup findings remain preserved.
- Worker797da3a(code577e8f0) accepted for one build/probe only after separate real Hermes code/document reviews and owner15root/81nested checks. Source8785118 built image7327. Earlier rejected reviews/findings remain preserved.
- Proxy1ba863b(code7aeffa9) accepted **offline only**, separate real Hermes review and owner adversarial checks;29nested. Live service/auth/count-request binding/durable holds/native budget/retry/SDK wire remain unqualified. See W02-02-OFFLINE-ACCEPTANCE.
- Temporal d96168b accepted **design/offline only**, reviewer20261009_175809_821a18 and owner post-integration15root/typecheck/22nested,43 prohibited configurations. Prior e67/0f rejected; owner thin changes separately attributed. No real Temporal runtime/HA/recovery. See W02-03-TEMPORAL-ACCEPTANCE.
- UI3c836ee(code7d094e1) accepted offline after separate real Hermes exact review20261009_180714_1c878e and owner post-integration15root/typecheck/19nested plus composed adversarial checks. No React mount/browser storage/authenticated network path.

## Actual AWS state

MeriGreenfield-QualificationBuild CREATE_COMPLETE; MeriGreenfield-QualificationRuntime UPDATE_COMPLETE. New VPC10.80/16, no NAT/IGW/peering/source route. Worker role empty; execution role only new ECR/log/KMS. Private endpoints plus fail-closed DNS permit six exact AWS names with redirected-name inspection and wildcard NXDOMAIN block. No service/scheduler.

Build55c89c64 from8785118 produced sha256:7327f04575b09a633730b0ffe4b5fdeeeffe151a5c0db6dc027cc6edb8960d75. Scan **2CRITICAL/13HIGH/23MEDIUM/7LOW/3UNDEFINED**, unresolved; probe-only, not application/security accepted. Ten targeted old critical findings were removed without implying a security waiver or reachability conclusion.

Baseline1 stopped before startup; exact DNS repair retained redirection inspection. Baseline2 stopped with browser/Office failures. Baseline3 task4a9c2d40 stopped21:58:08.400Z before22:08:36Z deadline. Identity/mounts, read-only root, static SDK, bounded DNS/direct-IP/private-endpoint controls and mechanical Office generation/recalc/render passed. Browser namespace EPERM remains. Native/PDF/PNG bytes were not exported for visual review. Failed attempts/raw evidence preserved.

## Remaining work

Finish UI review and new browser-host qualification, and continue independent G1 SDK/proxy wire capture, inert config/skills/session/file recovery and bounded artifact export/visual inspection. No paid dispatch until authenticated request binding and aggregate cap controls pass review. See docs/qualification/G1-REMAINING-WORK.md; full production Temporal HA is later, accepted design belongs G1.

Live-source identity/restricted principal/capability scope/tenant features remain unresolved. Agree numeric revocation, retention/legal hold/backup expiry, human artifact rubric and measured task/tenant caps before their later gates. No invented production RPO/RTO/performance result. No migration IDs. Cutover requires completed tests and explicit owner authorization.
