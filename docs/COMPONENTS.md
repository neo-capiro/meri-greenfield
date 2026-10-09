# Component adoption and qualification register

Prepared 9 October 2026. Exact versions below were read from upstream npm/PyPI registry metadata during discovery. Only the contract development dependencies are installed and lockfile-pinned. Other versions are qualification candidates; no assembled runtime, binary image digest or compatibility is accepted. Recheck package contents/license notices and retain exact hashes/digests in the W02 result before G1. No current Capiro package is imported.

| Subsystem | Package and exact candidate | Registry license | Status |
| --- | --- | --- | --- |
| Schema validation | ajv 8.20.0; ajv-formats 3.0.1 | MIT | installed, npm lock integrity; 10 boundary tests pass |
| Canonical JSON hashing | canonicalize 5.1.0 | Apache-2.0 | installed, npm lock integrity; approval-hash tests pass |
| Agent harness | @anthropic-ai/claude-agent-sdk 0.3.295 | SEE LICENSE IN README.md | inspect bundled runtime and commercial terms; qualify official SessionStore/configuration |
| Runtime CLI reference | @anthropic-ai/claude-code 2.1.295 | SEE LICENSE IN README.md | discover actual SDK bundled CLI; do not assume separately installed versions match |
| UI transport | ai 7.0.137 | Apache-2.0 | UI transport only; no second model loop |
| UI components | ai-elements 1.9.0 | Apache-2.0 | inspect official installation workflow and component compatibility |
| UI framework | next 16.4.0; react 19.3.0 | MIT | qualify combined UI dependency compatibility |
| Browser | @playwright/mcp 0.0.83 with exact playwright/playwright-core 1.64.0-alpha-1790635538000 | Apache-2.0 | selected MCP qualification candidate; matched Chromium revision 1247, version 155.0.8059.12; static package inspection only |
| Durable execution | @temporalio/worker 1.24.0 | MIT | pin compatible TypeScript packages and production server/image separately |
| Identity | @clerk/backend 3.23.1 | MIT | new authoritative identity bridge, current membership checks |
| Storage client | @aws-sdk/client-s3 3.1148.0 | Apache-2.0 | service-side scoped storage APIs |
| Infrastructure | aws-cdk-lib 2.273.0 | Apache-2.0 | pin compatible CDK CLI/constructs and new bootstrap role; no deployment yet |
| Word | python-docx 1.2.0 | MIT | candidate; original skills, file/render tests required |
| Spreadsheets | XlsxWriter 3.2.9; openpyxl 3.1.5 | BSD-2-Clause; MIT | candidate; supported formulas/references/recalc/edit fidelity required |
| Presentations | pptxgenjs 4.0.1 | MIT | candidate; native open/render/revision checks required |
| PDF | pdfjs-dist 6.4.299; pypdf 6.20.0 | Apache-2.0; BSD-3-Clause | preview/extraction candidates; object authorization required |
| Evaluations | promptfoo 0.124.1 | MIT | candidate; freeze benchmark/rubric before grading |
| Observability | @opentelemetry/api 1.9.1 | Apache-2.0 | candidate; pin matching SDK/exporters after integration choice |
| Development worker | installed Hermes 0.20.0 (2026.8.3) | not bundled in production | discovered executable/help/profiles/doctor; actual edit/resume/commit not yet run |

Still unpinned: Linux base image and digest, LibreOffice and fonts/templates, PostgreSQL, Temporal server, CDK CLI/constructs, optional OCR. Record upstream license texts/notices and content hashes before bundling. Registry license labels are not a complete license audit.

Independent exact-tarball inspection confirmed SDK 0.3.295 declares bundled Claude Code 2.1.295 and platform binaries at 0.3.295. SessionStore is best-effort: append failures can emit mirror_error and drop batches; it cannot be combined with persistSession:false or enableFileCheckpointing:true. Use separate broker-verified workspace snapshots and fail closed if expected remote state is missing. The pinned SDK supports explicit settingSources:[] and settings.autoMemoryEnabled:false; do not rely on omitted settings defaults.

The exact MCP Playwright dependency differs from stable Playwright 1.64.0. This Linux browser launcher defaults to sandbox disabled for bundled Chromium channels unless explicitly overridden. Require MCP --sandbox or chromiumSandbox:true, inspect effective flags and chrome://sandbox, and never treat omitted --no-sandbox as evidence. Fargate cannot adopt Playwright's custom-seccomp Docker example unchanged. These are static qualification risks, not live Fargate failure evidence.

Official references: [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview), [secure deployment](https://code.claude.com/docs/en/agent-sdk/secure-deployment), [AI Elements](https://elements.ai-sdk.dev/), [Playwright MCP](https://github.com/microsoft/playwright-mcp), [Temporal self-hosting](https://docs.temporal.io/self-hosted-guide), [Fargate task constraints](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html). License/package metadata was independently queried with `npm view` and PyPI JSON; use package tarball/wheel hashes and retained notices in the candidate manifest.

SDK npm integrity observed: `sha512-GaLZbMAqyT4ZCtDQYq2p26bjpqqRfoobVxCK+Ao283I12sGyw2ttMvjdCXclS9VKhs+/IIu8/AtjqyrX73FZ/g==`. This does not qualify the bundled executable or execution image.
