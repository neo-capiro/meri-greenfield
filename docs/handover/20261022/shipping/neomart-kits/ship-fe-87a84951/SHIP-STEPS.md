# Frontend ship kit for 87a84951

- **Commit:** capiro-frontend `87a8495138f0af5303bc93397438238c6cc5081b` (fix(meri): align history filter menus to verified Figma composition), branch `HEAD`, tree `28f4a76cbdebc9eebeb2ecb011a35a00645a2726`.
- **Baseline:** serving `4e2c770fc6f888df4035ee2029bbf7f68a14f09d` on `capiro-portfolio-preview:21`, image `967807252336.dkr.ecr.us-east-1.amazonaws.com/capiro/portfolio-preview@sha256:8fc64defdc67c052d3eb31a7081194decf8bcedf3abb0166490ee2c3961d819b`.
- **Stack:** `Capiro-Portfolio-Preview-Service`. The change set is `fable-fe-pr121-gate-87a84951` and the rollback change set is `fable-fe-rollback-r21-87a84951`.

Each step is one command: `bash <step>.sh`, which runs `node kit.mjs <step>`. It prints a PLAN line, then refuses with exit 2 on any wrong state or existing output.
A mutating step runs only through its `.sh`, which adds `--execute`; `node kit.mjs <mutating step>` alone does nothing and exits 2.
Exit 3 means the outcome is uncertain: read back before rerunning. Outputs go to `out/`, the baseline to `readback/`, and the dry run to `dry/`.

| Step | Kind | Who | Gate |
| --- | --- | --- | --- |
| `00-preflight` | read only | me now; operator again right before 03 | Live stack, template, parameters, service 1/1/0 on the baseline, one healthy target, rollback image + scan, no change set, no active build, tag absent |
| `01-source-archive` | local | me now | `git archive` ZIP + the commit's `scripts/verify-preview-archive.py` (every member equals its Git blob, `source-commit.txt` appended) |
| `02-dry` | local + read only | me now | Buildspec pins vs the commit (tests, scripts, Dockerfile and patch digests), parameter diff ImageUri-only, template unchanged, expected task definition, `validate-template` |
| `02b-rehearse` | local (WSL2 + Docker, ~25 min) | optional; me before handing over | The buildspec itself, every install/build command in order on the extracted archive, ECR login/push/describe skipped: catches a failing suite, a stale pin or an unresolvable `apk` pin before a CodeBuild job is spent |
| `03-source-put` | **MUTATING** (S3 new version) | operator | Full-object SHA-256 + SSE-S3 confirmed by an exact-version HEAD; writes the start-build request pinned to that version |
| `04-image-build` | **MUTATING** (one CodeBuild job) | operator | No active build; ECR tag absent (tags are immutable); 60 min, queue 10, no retry |
| `05-image-readback` | read only (waits) | operator | SUCCEEDED; "Container smoke passed" in the log; ECR digest; **scan COMPLETE with 0 findings**; writes the candidate parameters |
| `06-changeset` | **MUTATING** (create only) | operator | Live state still the baseline; exactly Modify PreviewTaskDefinition (ImageUri only) + Modify PreviewService (TaskDefinition only) |
| `07-rollout` | **MUTATING** (execute) | operator | UPDATE_COMPLETE; service 1/1/0 on the new revision with the candidate image; its task >= 120 s and the only healthy target; "Ready in" logged; public /healthz 200 (if reachable) |
| `08-verify` | read only | operator | New revision = baseline revision except the image; parameters = candidate file; outputs unchanged |
| `R1-rollback-to-21` | **MUTATING** (only when needed) | operator | In progress: cancel-update-stack. Rolled back already: verify. Completed: a change set with the recorded rev-21 parameters (registers rev-21 content again; capiro-portfolio-preview:21 itself is deregistered by CloudFormation once the release completes) |

Unit suites in the buildspec (15): `preview-read-receiving`, `first-chat-intent`, `first-chat-bootstrap`, `meri-first-chat-core`, `meri-first-chat-preview-policy`, `meri-first-chat-route`, `meri-first-chat-host`, `meri-client-selector`, `meri-conversation-host`, `meri-conversation-route`, `meri-conversation-proxy`, `meri-history-proxy`, `meri-preview-route-activation`, `meri-document-proxy`, `preview-backend-containment`.
Browser: `meri-new-conversation.spec.ts` (modules config), the rev-18 grep of 11 cases, and 4 portfolio specs.
