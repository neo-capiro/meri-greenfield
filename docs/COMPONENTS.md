# Component adoption and qualification register

Updated 9 October 2026. Contract/CDK dependencies are locked. Worker final797da3a(code577e8f0) passed separate real Hermes review and owner15+81checks; source8785118 built image7327. Baseline3 passed five mechanical probes but failed Chromium namespace creation. Proxy1ba863b is accepted offline only; Temporal d96168b is accepted design/offline only; UI3c836ee/19checks awaits separate review. No application component set or G1 is accepted. Recipe-time pins/notices are in apps/worker/qualification/component-pins.json; build/runtime reports are authoritative for later observations. No current Capiro package is imported.

| Subsystem | Package and exact candidate | Registry license | Status |
| --- | --- | --- | --- |
| Schema validation | ajv 8.20.0; ajv-formats 3.0.1 | MIT | installed, npm lock integrity; 10 boundary tests pass |
| Canonical JSON hashing | canonicalize 5.1.0 | Apache-2.0 | installed, npm lock integrity; approval-hash tests pass |
| Agent harness | @anthropic-ai/claude-agent-sdk 0.3.295 | SEE LICENSE IN README.md | inspect bundled runtime and commercial terms; qualify official SessionStore/configuration |
| Runtime CLI reference | SDK-bundled CLI 2.1.295 / platform package0.3.295 | SEE LICENSE IN README.md | build/baseline measured exact version and pinned binary hash; no actual query/proxy/recovery acceptance |
| UI transport | @ai-sdk/react4.0.140 with exact ai7.0.137 | Apache-2.0 | actual mock writer/transport/externalChat fixtures19+typecheck; separate exact review pending; no React mount/real auth or second model loop |
| UI components | ai-elements 1.9.0 | Apache-2.0 | inspect official installation workflow and component compatibility |
| UI framework | next 16.4.0; react 19.3.0 | MIT | qualify combined UI dependency compatibility |
| Browser | @playwright/mcp 0.0.83 with exact playwright/playwright-core 1.64.0-alpha-1790635538000 | Apache-2.0 | Chromium1247/155.0.8059.12 hashes/helper modes verified; Fargate namespace EPERM; D005 new isolated browser-host qualification approved, not yet run |
| Durable execution | Temporal server1.32.1 / TypeScript packages1.24.0 | MIT | d96168b design/offline accepted: exact platform/schema/auth/topology, typecheck22checks; actual service/persistence/replay/HA unrun |
| Trusted model proxy | LiteLLM1.104.2 | OSS MIT; Enterprise separately licensed | final1ba863b/29checks offline reference accepted; image/service/auth/durable budget/count binding/retry/SDK wire unqualified |
| Identity | @clerk/backend 3.23.1 | MIT | new authoritative identity bridge, current membership checks |
| Storage client | @aws-sdk/client-s3 3.1148.0 | Apache-2.0 | service-side scoped storage APIs |
| Infrastructure | aws-cdk-lib 2.273.0; aws-cdk 2.1145.0; constructs 10.8.1 | Apache-2.0 | installed, root lock integrity; bootstrapless qualification synthesis; 6 static boundary checks; new Build stack CREATE_COMPLETE |
| Word | python-docx 1.2.0 | MIT | candidate; original skills, file/render tests required |
| Spreadsheets | XlsxWriter 3.2.9; openpyxl 3.1.5 | BSD-2-Clause; MIT | candidate; supported formulas/references/recalc/edit fidelity required |
| Presentations | pptxgenjs 4.0.1 | MIT | candidate; native open/render/revision checks required |
| PDF | pdfjs-dist 6.4.299; pypdf 6.20.0 | Apache-2.0; BSD-3-Clause | preview/extraction candidates; object authorization required |
| Evaluations | promptfoo 0.124.1 | MIT | candidate; freeze benchmark/rubric before grading |
| Observability | @opentelemetry/api 1.9.1 | Apache-2.0 | candidate; pin matching SDK/exporters after integration choice |
| Development worker | installed Hermes 0.20.0 (2026.8.3) | not bundled in production | actual H00 edit/explicit resume/commit accepted at a398b9ea after independent Hermes review + Codex 15-test rerun; scope/cleanup findings retained |

Current worker: node24.21.0-bookworm-slim indexsha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20; signed Debian snapshot20261009T000000Z; measured Node24.21.0/Python3.11.2/LibreOffice7.4.7.2 and all34direct OS pins. Build55c89c64 from8785118 produced ECRsha256:7327f04575b09a633730b0ffe4b5fdeeeffe151a5c0db6dc027cc6edb8960d75. Scan2CRITICAL/13HIGH/23MEDIUM/7LOW/3UNDEFINED remains unresolved (GnuTLS CVE-2026-95210 and TIFF CVE-2026-52490 critical). Baseline3 admitted one closed-network synthetic task only. Prior imagef669 with12CRITICAL/64HIGH is superseded but its history remains preserved. See W02-01-BUILD-3 and W02-FARGATE-BASELINE-3 reports. Original skills/templates, product PostgreSQL and proxy/Temporal runtime remain unqualified; registry labels are not a complete license audit.

Independent exact-tarball inspection confirmed SDK 0.3.295 declares bundled Claude Code 2.1.295 and platform binaries at 0.3.295. SessionStore is best-effort: append failures can emit mirror_error and drop batches; it cannot be combined with persistSession:false or enableFileCheckpointing:true. Use separate broker-verified workspace snapshots and fail closed if expected remote state is missing. The pinned SDK supports explicit settingSources:[] and settings.autoMemoryEnabled:false; do not rely on omitted settings defaults.

The exact MCP dependency differs from stable Playwright1.64.0. Require explicit MCP --sandbox/chromiumSandbox:true and measured browser/renderer evidence. Baseline3 now supplies live Fargate namespace failure evidence despite correct helper mode/name/hash; it does not prove all Chromium configurations universally impossible on Fargate. D005 authorizes a dedicated new host with controllable prerequisites, preserving actual sandbox and app/control Fargate placement.

Official references: [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview), [secure deployment](https://code.claude.com/docs/en/agent-sdk/secure-deployment), [AI Elements](https://elements.ai-sdk.dev/), [Playwright MCP](https://github.com/microsoft/playwright-mcp), [Temporal self-hosting](https://docs.temporal.io/self-hosted-guide), [Fargate task constraints](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html). License/package metadata was independently queried with `npm view` and PyPI JSON; use package tarball/wheel hashes and retained notices in the candidate manifest.

SDK npm integrity observed: `sha512-GaLZbMAqyT4ZCtDQYq2p26bjpqqRfoobVxCK+Ao283I12sGyw2ttMvjdCXclS9VKhs+/IIu8/AtjqyrX73FZ/g==`. This does not qualify the bundled executable or execution image.
