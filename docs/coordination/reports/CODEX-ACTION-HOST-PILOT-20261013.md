# Pilot provenance audit and revised call accounting

2026-10-13; exact Meri base `f8e3507307640ee6b4904782cfb20f2b05e5e7b0`. **Zero currently qualified human-authored cases were established by this audit.** Existing benchmark scenarios and gold are useful inputs, but their human origin, current approved access and source snapshots are separate requirements. This does not claim that no human requests exist in other owners' systems. This local source slice performs no SQL/native/provider checks and publishes no native evidence. Source implementation continues independently.

The previous proposal at `0efe1ad65d91823964cc2b4fdd8ab76da6b34931` remains unchanged. The new `revised-pilot.json` preserves its six literal prompt templates and gold outlines as generated examples, then corrects auxiliary operation accounting. There is no spending approval, paid launcher activation, credential creation or account availability assertion.

## What already exists

`meri-inventory.json` covers all21 current files under `evals/` and the three current path-name corpus candidates. It records exact base/blob/SHA256/size, with no case-count inflation from test functions or mutated fixtures. `capiro-provenance.json` pins27 named legacy references at `fd8765ec01d292013758606204f2c9d886cd31c1`, paired against `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`; all27 blobs are unchanged. Private prompt/source bodies are not copied into this packet.

| Pinned source | Count and labels | Qualification/access consequence |
| --- | --- | --- |
| Meri `evals/retrieval-r2/manifest.json:4` | `realRequestsReceived:0`, empty case IDs, no source snapshot/split/results | Authoritative current received-real count remains0. |
| Meri `evals/task-lookup/test/fixtures.mjs` | One synthetic seed; `test/result-fixture.mjs` and `execution/test/fixtures.mjs` derive synthetic result/gold from test owners | Source/control tests, not imported real prompts. Tests that set `kind:'real'` are provenance-negative controls. |
| Meri `evals/task-lookup/test/eval-independent.test.mjs:152` | Dynamically generates200 synthetic cases with100/50/50 splits | Tests denominator machinery; never200 real requests. Canonical `corpus.mjs:31` keeps qualifiedRealRequests0. |
| Meri `evals/qualification/hermes-session.fixture.json` | Explicit synthetic delegation/workspace/approval fixture | Not a human task corpus or actual approval. |
| Capiro `evals/meri/live-75-case-spec.md` and `simple/original-cases.mjs` |75 spec rows and75 matching structured IDs01–75; exact labels/line locators and row hashes retained | Seeded staging scenarios; concrete expected facts, required/forbidden sources, operations, terminal conditions and five-dimension human rubric. Human-rubric instructions do not establish prompt authorship. |
| Capiro `docs/meri/implementation/01-Meri-Foundation-and-Reliability.md:1429` | AppendixF preserves the75; source metadata says supplied files | Document supply/adoption establishes a scenario contract, not proof of each prompt's genuine human origin. No origin attestation located. |
| Capiro `evals/meri/suite-contract.json` |26 offline cases:11core/6government-affairs/5plan/2sequence/2calibration | README/CONTRACT explicitly identify synthetic mechanism and grader calibration, not real model/source/memory validation. |
| Capiro `evals/meri/simple/capiro-internal-cases.mjs` plus `program-tasks.mjs` |75 distinct adapted IDs including six program tasks; LIVE/TEST/PENDING/USER modes | Some adaptations refer to private internal records and scoped test writes. Mode labels are not human provenance or current read/write permission. No private data reuse authorized here. |
| Capiro `evals/meri/commitments-deliverables-extension.md` | Seven IDsCD-01–CD-07 | Separate scenario contracts, not added to75 or treated as current human-request evidence. |
| Capiro `apps/api-strategy/eval/goldens/**/*.json` |14 golden files | README:84–91 explicitly says synthetic, without real-dogfood review/Neo signoff. No transfer as expert-approved gold. |
| Capiro `.session5-live/frozen-corpus.json` | Eight public-document extraction entries | An extraction corpus, not eight human assistant requests. Some source references are local files; current source bytes/access/license/admission must be supplied separately. |

Legacy `original-cases.mjs` points to AppendixF and fixture version `meri-live-v1-2026-09-26.1`. Its introducing Git history and structured gold are preserved metadata; a Git author identity is not proof of human prompt authorship. No legacy runner, source adapter or private implementation was executed/imported. Historical capture receipts were not imported as current authority. This is a bounded audit of the named legacy benchmark owners, not a universal search of all private customer histories.

## Minimal human input; technical preparation remains ours

Parent can ask: **“Please send six short requests in your own words for the synthetic action demo, or identify exact existing benchmark case IDs with their human author/origin/date. Confirm that we may use synthetic data only.”** Existing IDs are reusable only if the attestation is true; approving generated examples does not turn them into human-authored requests. There is no need for the user to create hashes, UUIDs, fixtures, permission claims or gold JSON.

The evaluation owner then maps each prompt to the implemented action scope, prepares the synthetic records and semantic gold, assigns groups/splits, obtains independent human adjudication and freezes exact source/config/SDK/runtime identities. Broader legacy memory/mail/artifact scenarios cannot be silently narrowed to the action slice. Authenticity and data permission must be established outside self-signed metadata. Current real-request count stays0 until actual approved inputs arrive. A genuine human prompt over synthetic data tests real-model behavior, not customer-quality performance.

Keep six scenarios from the previous pilot as review aids: authorized recommendations; partial enumeration; stale-source absence; ambiguous identity; revoked read; and select/edit/draft/prepare without execute. Preparation is not approval or accepted task creation. Gold stays out of execution; original SDK observations remain distinct from the existing typed preselected replay. Missing/failed/skipped/ineligible cases stay in the denominator. P04's textual clarification needs human adjudication; no invented typed clarification receipt.

## Exact source-selected model and dated pricing

The source route is unchanged: Amazon Bedrock `us-east-1`, profile `us.anthropic.claude-sonnet-4-6`, native model `anthropic.claude-sonnet-4-6`, via `bedrock/invoke/us.anthropic.claude-sonnet-4-6`. `meri-sonnet-qualification` is only the local alias. `apps/proxy/qualification/proxy-config.json`, `runtime/bedrock_body.py` and `docs/COMPONENTS.md` are hash-pinned in `local-references.json`. Claude Agent SDK0.3.295 remains the sole model loop. No model upgrade, alternate provider, local model loop or proxy guard change is proposed.

The existing qualification body guard has8,192 input/256 output maxima and a default local_echo allowlist. Proposed requests stay at8,000 input/256 output, no cache/thinking fields, retries, fallbacks, subagents, paid judges or server tools. Actual action-tool serialization/allowlist and qualified runtime/proxy admission remain owner prerequisites; implemented local API/session wiring is not mislabeled as missing source work.

Official documentation refreshed2026-10-13 identifies Sonnet4.6 and public $3/$15 per million input/output. A10% geographic premium gives proposed maximum admitted rates $3.30/$16.50 MTok. AWS's model card confirms this US profile and us-east-1 endpoint; its price link does not establish this account's tariff. [Anthropic model](https://platform.claude.com/docs/en/models/sonnet-4-6/overview), [pricing](https://platform.claude.com/docs/en/about-claude/pricing), [AWS model/profile](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-6.html).

| Revised proposal | Exact bound |
| --- | --- |
| Human prompts / sessions / concurrency |6 /6 /1 |
| Inference attempts | At most3 per session,18 total; includes failed/cancelled/uncertain and all auxiliary model calls |
| CountTokens attempts | At most18, one exact-body count before each admitted inference; failures consume slots |
| Total provider HTTP operations | **36 maximum:18 inference +18 CountTokens**; no additional setup/retries outside the ceilings |
| Input/output totals |144,000 /4,608 tokens; all system/tools/history/results and generated tokens included |
| Estimated inference |12×(4,000×3.30 +128×16.50)/1,000,000 = **$0.183744** |
| Maximum inference liability at admitted rates |18×(8,000×3.30 +256×16.50)/1,000,000 = **$0.551232** |
| Separate proposed inference approval ceiling | **$0.75 USD**, unapproved; historical$10 remainder unknown and not reused |

The additional operation class follows actual `AwsNativeCounter.count` and `BedrockSendGuard.before_send`, not speculative SDK behavior. The [official CountTokens API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_CountTokens.html) confirms the separate count request, but its retrieved reference does not establish a zero fee. Exact count-operation charge treatment and all other non-token costs must be frozen before any authorization/execution; no unverified free-counting or all-in cost claim. The [AWS pricing page](https://aws.amazon.com/bedrock/pricing/) still did not expose the relevant numeric account/model row. Preflight must verify effective rates≤the proposed ceiling and include every charge class in a complete authorization. This lane performed no CountTokens, inference or account API call.

Preserving the old literal18-total-HTTP ceiling instead would allow at most9 paired inferences. Six one-inference sessions leave only three additional pairs; six ordinary two-inference lookup/answer sessions need24 HTTP operations. That alternative therefore changes feasibility and must not be represented as equivalent or implemented by dropping cases. The revised36-operation proposal grants no new authority by itself.

Per session120s, whole pilot900s, retained sanitized evidence≤2MiB. Current-authority/pin/rate mismatch, unknown effect/liability, cancellation, timeout or overflow stops new calls. No retries or assumed refunds. Qualified owners must reserve maximum liability before sending, retain failed/uncertain usage, revoke only pilot-scoped authority, settle/record outstanding state and verify owned process/stream cleanup without touching others. Additional infrastructure/credential creation is not authorized. Exact runtime admission remains required; no claim is made about whether other owners have already run native work.

Original 60 real tasks/90% completion/95% correctness, 100 adversarial isolation cases with the original 100% isolation requirement and75→200 reliability cases remain unchanged. The six-request pilot cannot qualify their rates or p95/load gates. Historical G0 acceptance is unchanged; no runtime gate is closed by this metadata packet.

## Verification

`verify.py` rechecks all21 Meri eval identities,27 paired private reference hashes without printing their bodies,75↔75 IDs/row count,26/14/7/8 source counts, zero qualified-real status, source/SDK route pins, exact Decimal arithmetic,36-operation accounting and all original Meri tree entries. It also verifies every previous pilot packet file unchanged. Checks are source/metadata only. `verification.json` and `manifest.json` retain results; no product/runtime suite rerun is claimed.
