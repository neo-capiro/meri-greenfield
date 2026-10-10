# Meri kickoff status

Updated 9 October 2026, America/New_York. Owner: Codex integration.

## Current outcome

Both supplied plans were read. The independent private repository and two new isolated AWS qualification stacks exist. Frozen contracts and bounded Hermes delegation are accepted. The refreshed worker built, and baseline3 is **STOPPED exit1:5/6 probes passed, Chromium sandbox failed**. No active Fargate task, application service, source connection or cutover exists. Current Meri and Capiro remain untouched.

The pinned Chromium/dropALL Fargate configuration reaches verified helper namespace creation and fails with EPERM. The user explicitly approved qualifying a NEW dedicated isolated browser host, with app/control staying on Fargate (D005). Host preparation is undergoing bounded repair after independent rejection of its initial partial draft; no host has launched, no sandbox relaxation is authorized and no gate is promoted. See reports/W02-FARGATE-BASELINE-3.md and reports/W02-05-06-PARTIAL-REVIEW.md.

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

SDK repair4 74e5d0b closed cleanly; independent61+14 replay passed. Codex owner corrections3b8eabf and85ca1ef close stdio/output/strictness/privacy gaps; the latter adds8checks and updates final attribution/hashes. Parent73owned+14adversarial replays pass; owner81worker+15root also passed. Separate actual Hermes review5 report8689125 is preserved; review6 is active against exact85ca1ef. Native run NOT RUN. Office8eacd0f is accepted OFFLINE and integrated atb53b8e5 after separate actual reviewer20261009_200325_a4a525 report0fcac0a. Launcher contained2remaining review descendants and confirmed cleanup. Owner post-integration55+15 and reviewer59-mutation replay pass; prior real-baseline positive/20payload+6decoder replay also passes. See W02-07-OFFLINE-ACCEPTANCE. Actual export/reconstruction/visual QA remain unrun. Earlier reviewer PASS ef9edee remains historical and does not override rejection of d10424b.

Browser observer4863878 was rejected after16/23 independent failures. Codex owner be1e7a7 closes those cases,40author+23independent+33additional+15root passed, with one earlier conservative Windows fake-file identity failure disclosed. D006 replaces oversized embedded support files with a same-new-repository immutable support image. Owner app4fd85f7 preserves11resources and uses bounded never-started asset extraction; final LF-source synthetic synthesis passed. Real Hermes bootstrap/export repair4 closed cleanly but returned partial code/no commit. Independent checks found an invalid shell builtin wait invocation, short observer timeout and further run-record/export false positives; owner completion is in progress. App and collector/classifier/polling stay frozen read-only. Controller21c87bc remains accepted offline after separate actual review+28/11/20fakes. Support-build helper/buildspec project-drift correction7c49214 passed owner16methods and syntax checks; fresh live project configuration matched the reviewed snapshot. Preparation only: no support archive/upload/build/digest or host launch.

Image security refresh first40turn checkpoint returned partial/no commit, clean process cleanup. Real completion2 is active against owner inventoryc769e4c with those two files read-only. Inventory20tests pass with explicitly pinned Python3.12, but independent four-case audit found alias/directory/ancestor races and mandatory-output false success; acceptance is blocked pending correction after writer closure. See W02-08-INVENTORY-INDEPENDENT-AUDIT and D007. No candidate build or admission. Current7327 findings remain unresolved with no waiver. See W02-05-SDK-OWNER-STDIO-CORRECTION, W02-06-OBSERVER-OWNER-CORRECTION and W02-IMAGE-SECURITY-DISPOSITION-PREP. Separate exact-commit reviews and owner acceptance precede each build/run. Then continue inert config/skills/session/file recovery and trusted-proxy/Bedrock qualification. Paid inference spend remains$0; no paid dispatch before authenticated request binding and durable aggregate$10 controls. See docs/qualification/G1-REMAINING-WORK.md; production Temporal HA is later, accepted design belongs G1.

Live-source identity/restricted principal/capability scope/tenant features remain unresolved. Agree numeric revocation, retention/legal hold/backup expiry, human artifact rubric and measured task/tenant caps before their later gates. No invented production RPO/RTO/performance result. No migration IDs. Cutover requires completed tests and explicit owner authorization.

Independent G1 UI source-adoption task W02-09 is active in a real bounded Hermes session, based on8e65b96. It pins the selected AI Elements1.9.0 source commit, support components, nested dependency lock and notices in a new qualification package; no current UI transport edits or product/browser deployment. Separate exact review and owner acceptance are still required. Official tag resolution isbc871264341cf54a7ea1fee36d951688ed2a1ff7; moving CLI/registry defaults are not accepted pins.
