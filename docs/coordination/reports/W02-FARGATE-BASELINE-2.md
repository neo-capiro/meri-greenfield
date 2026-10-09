# W02 isolated Fargate baseline 2 — failed qualification, stopped

Owner: Codex. Captured 9 October 2026. This is a bounded synthetic qualification attempt; current Meri and Capiro were not changed or connected.

## Candidate and execution

- Source integration `f4f008f6afaf0517ea64822d008a39823e0b0032`; reviewed worker `4f69d68f78052c6509f8441a02433fd15d87e8cc`.
- Image `sha256:f669d3602892c36c7a829bc3e2747124fa2e1dd5397af193f7b893afdd19b837`, built by CodeBuild `aaec4b57-0bb1-4a80-a464-21d364be6465`.
- Prior scan remains 12 CRITICAL / 64 HIGH. Admission was only this closed-network synthetic probe, with no provider/source/external-content access; no application/security acceptance.
- Task `arn:aws:ecs:us-east-1:967807252336:task/meri-greenfield-qualification/cfcc4a32e3ea45a7be898d322f663411`, one Fargate Linux/amd64 task, platform 1.4.0, definition `meri-greenfield-qualification:1`.
- New private VPC `vpc-06e1941747e798f0a`, worker SG `sg-0c4e15bec7adeed1a`, subnet `subnet-0864c000b771df32c`, public IP disabled. No NAT/Internet gateway/source routes; empty worker IAM role.
- Created 20:56:24Z; image pull completed 20:57:03Z; started 20:57:09Z. Runtime summary 20:57:17Z. Confirmed **STOPPED 20:57:40Z**, `EssentialContainerExited`, container exit **1**, before 21:08:22Z deadline. No active task is required by this attempt.

## DNS repair and actual results

The exact CNAME repair in owner commit `ecc2d5179d29e08c4b9587a54d9a91879ae0480d` was independently reviewed and deployed to the new Runtime stack. Change set `dns-cname-ecc2d51-20261009` modified only AllowedDns, DnsRules and the association's conditional dynamic group-reference dependency. Actual stack status UPDATE_COMPLETE; association/group physical IDs stayed unchanged. Readback confirmed association COMPLETE/priority101, six exact allowed names, CNAME target inspection, default wildcard NXDOMAIN block and fail-open DISABLED. The successful image pull establishes resolution for this attempt, not full network qualification.

Runtime verdict: **4 pass / 2 fail / 0 skipped; G1 remains open**.

| Probe | Actual evidence | Limit |
| --- | --- | --- |
| Identity and writable mounts | UID/GID10001; `/workspace` and `/tmp` create/write/read passed | Only synthetic owned paths |
| Read-only root | Root mount `ro,relatime`; write rejected EROFS | Other mount properties still need diagnostics |
| SDK static | Installed SDK0.3.295/CLI manifest2.1.295 and reference store/options observed | No SDK model query or durable checkpoint acceptance |
| DNS negative/positive controls | example.com and api.anthropic.com ENOTFOUND; private logs endpoint resolved and TCP443 connected | Missing direct-IP negative; no full egress acceptance |
| Chromium sandbox | MCP invoked with `--sandbox`; Chromium fatal `No usable sandbox!` | No surviving browser/renderer or verified Chromium sandbox; do not infer universal Fargate incompatibility |
| Office | Native structure decision passed; required render/recalculation decision failed | Actual recalculated A4 is unavailable because probe collapses failed inspection into null; no retained bytes or visual acceptance |

## Independent diagnosis and next bounded repair

The recipe installs the CFT helper as `chrome_sandbox` (underscore), while upstream Chromium's automatic adjacent helper discovery expects `chrome-sandbox` (hyphen). Root-owned Chrome with non-root UID also restricts the development-sandbox environment fallback. A root-owned alias to the exact pinned helper, plus stat/hash/realpath/mount/kernel diagnostic evidence, must be reviewed and measured under the same UID/read-only-root/dropALL settings before attributing failure to Fargate. The current probe also repeatedly invokes dependent MCP tools after launch failure; the repair must stop that dependent sequence after the first fatal result, while preserving independent probes.

Office `artifacts.mjs` extracts A4 only when the Python check already passed; any wrong value, failed Python command or parse error becomes initialized JS null. Its final payload also omits per-format and child-process evidence. The synthetic XlsxWriter fixture uses default cached zero. [XlsxWriter's official FAQ](https://xlsxwriter.readthedocs.io/faq.html#q-why-do-my-formulas-show-a-zero-result-in-some-non-excel-applications) describes LibreOffice retaining that cache and recommends a blank cached result. The next repair must preserve failed observations/status/stderr, use the documented blank cache without seeding six, and require original inputs, preserved formula and recalculated numeric six. PDF/PNG/native bytes still need retained export and independent visual review.

The separate security recipe refresh remains unbuilt/unaccepted, with evidence repairs in a bounded real Hermes session. A separately reviewed final image is required for another measured attempt. No no-sandbox, extra privileges, security-control relaxation or execution-host switch is authorized. Proxy preparation commit `0575bb4e0a0e96ff03039104545e8bd21663f59c` was independently rejected; its bounded repair is running. No live Bedrock invocation/spend has occurred; approved US-only profile/$10 aggregate limit remains unchanged.

Raw private evidence (ignored Git): `docs/coordination/private-evidence/W02-fargate-baseline-2/{manifest,run-request,run-result,final-task,runtime-logs-final,runtime-summary}.json`; DNS update/readbacks in `W02-runtime-dns-ecc2d51`. Runtime structured summary was reconstructed from all233 CloudWatch events and parsed successfully. Workspace paths in the summary are ephemeral references, not exported artifacts.
