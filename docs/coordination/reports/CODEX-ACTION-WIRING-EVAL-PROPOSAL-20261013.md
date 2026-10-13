# Six-request pilot and pinned frontend handoff

2026-10-13. Proposal only; zero provider/model/native/database calls, no spending or frontend edits. Base `f3127d742b6b4ec556b00dba939d35e5622a9ad1`. The packet's `pilot-proposal.json` contains six literal reviewable prompt templates, expected source/action outcomes, limits and owner prerequisites. These templates are generated examples, not six received real requests. Current real corpus remains zero. Human-authored requests on approved synthetic data can test real-model routing without customer information; this is not a customer-quality benchmark.

## Decision requested after owner preflight

Propose **six serial sessions, at most eighteen model requests total, and a new $0.75 USD inference-token ceiling**. Use the existing source-selected Bedrock US profile `us.anthropic.claude-sonnet-4-6` through `bedrock-runtime.us-east-1.amazonaws.com`, with Claude Agent SDK `0.3.295` as the sole model loop. `meri-sonnet-qualification` is a local alias, never sufficient model identity. No model/provider change is proposed. The previous exploratory Haiku calculation is retained as superseded metadata.

The current proxy source explicitly selects this route in `apps/proxy/qualification/proxy-config.json:4` and `runtime/bedrock_body.py:12`. Its small qualification envelope limits output to256, input to8192 and defaults to `local_echo`; it rejects cache/thinking fields. This proposal stays below it at **8,000 total input and256 output tokens per provider request**, including system/tools/history/results and all billable generated tokens. Action-tool compatibility and exact SDK serialization still require the native/proxy owner's qualified binding; this packet neither edits that guard nor claims current account access.

Official pricing read on2026-10-13 lists Sonnet4.6 at $3/$15 per million input/output tokens and identifies the model/version. Anthropic documents fixed dateless IDs starting at4.6 and a10% geographic-endpoint premium. These are public reference rates, not verified account charges. [Sonnet4.6](https://platform.claude.com/docs/en/models/sonnet-4-6/overview), [version identity](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions), [pricing](https://platform.claude.com/docs/en/about-claude/pricing).

| Calculation | Input/output assumptions | USD |
| --- | --- | ---: |
| Estimated pilot | 12 calls ×4,000 input/128 output; $3.30/$16.50 MTok | 0.183744 |
| Full permitted token liability | 18 calls ×8,000 input/256 output; same admitted rates | 0.551232 |
| Proposed independent inference ceiling | Rounded bounded authorization, not spend already granted | 0.75 |

The actual account rate table must be independently read, frozen and no greater than $3.30/$16.50 MTok before approval/execution. The [official AWS pricing page](https://aws.amazon.com/bedrock/pricing/) did not render the relevant numeric rows in this research, so no AWS/account quote is asserted. Cache must remain disabled; no discounts, free credits or cache savings are assumed. An SDK budget hint alone is insufficient: the trusted existing proxy must reserve the full possible cost before each send and count all attempts, failed/cancelled billables and unresolved liabilities. Eighteen includes every auxiliary/setup billable request; retries, fallbacks, subagents, server search/code tools, compaction calls and paid judges are forbidden. If unexpected model calls or charge classes cannot be excluded, stop before spending and re-price.

Historical $10 allowance remainder is unknown and is not reused. The proposed $0.75 is pre-tax inference only. No new compute, storage, network resources, credentials or launch spend is authorized. The infrastructure owner must confirm an already admitted host and its existing cost authority; any incremental non-token charge requires a separate exact cap. Price/availability must be refreshed at execution time; no silent substitution if the model/profile changes.

## Data, gold and outcomes

Use one approved synthetic snapshot under fresh host-bound synthetic identities; no customer/private data, source fetching, mail or third-party mutation. Public data is unnecessary for this smallest pilot. A future public-data addition needs exact approved content/license/asOf hashes. Six prompt templates in the packet cover: selected-client recommendations; pagination; stale-source absence; ambiguous identity; revoked read grant; and an edited draft prepared for approval. The sixth stops before execute. This pilot therefore does not qualify actual task creation or approval delivery.

Before the run, two humans freeze actual request text, origin groups, case IDs, exact source/config/SDK/image/manifest identities and semantic gold: allowed records, source revisions/asOf, coverage/count meanings, denied canary IDs, explicit edits and correct pending/refusal/clarification outcomes. Prompt authorship/provenance must be authenticated outside hashes. Gold stays out of SDK/runner inputs. Independent humans adjudicate blinded against frozen gold, with owner resolution of disagreements. No paid model judge. Proposed pilot success is6/6 correct expected outcomes and100% required frozen facts with zero unsupported facts, unauthorized disclosure/effects, false absence or invented approval. This is a deliberately small readiness check; do not calculate a release quality claim from it.

Retain every requested case in denominator accounting: returned/denied/failed/missing/skipped/ineligible. Record exact provider request IDs/usage, current authority callbacks, canonical request/result hashes, public UIEvent identities, actual recommendation/resultReference and draft/proposal outcomes. `tool.completed` does not mean run or task completion. Separate exact bytes from semantic gold; fresh run IDs/timestamps are not content errors, while source/asOf/version/scope changes are. The existing `evals/task-lookup/execution/execute.mjs` performs typed preselected replay only; it cannot produce original prompt-routing or correct-evidence observations. The SDK owner must capture the actual original-mode run. Existing scorer clarification has no success contract, so P04 remains explicitly human-adjudicated/missing automated contract rather than a fabricated pass.

Keep original60 real tasks/90% completion/95% checked correctness and100 adversarial isolation cases, plus75 real seeds→200 grouped cases, unchanged. No template or synthetic replay increments those received-real denominators. Retain ordinary-answer8s, warm lookup15s, UIack2s and concurrency/fresh-worker gates as distinct cohorts; report raw pilot timing only. G0 historical acceptance is preserved; this proposal closes no G1/runtime or RG gate.

Per session120s; whole pilot900s, concurrency1, at most2MiB sanitized evidence. Before execution, bind those limits to the existing qualified SDK/proxy/capture owner. Any authority/pin/rate/limit mismatch, unauthorized result, uncertain provider/store/budget outcome, timeout/cancellation or output overflow stops new calls. No retry or assumed refund. Revoke only pilot-scoped authority, cancel via supported SDK interface, await and verify owned process/stream termination, retain uncertain liabilities and absence/cleanup evidence. Do not kill another owner's processes or delete shared data. Missing case/cleanup evidence is a failure or unresolved outcome, never success. These are required admission and cleanup behaviors, not claims that a paid launcher exists.

## Frozen frontend findings and exact owner handoff

Read-only supported GitHub contents/file reads at `neo-capiro/capiro-frontend@7c87678730538958ace9762f824dc3e588bf445b` (PR16 supplied by parent). No default-head or shipping-candidate freshness inferred. Six exact file blob identities and line anchors are in `frontend-reference-identities.json`; no private source bodies are retained. The stale local frontend checkout was not treated as authority.

| Existing pinned seam | Finding and next integration action |
| --- | --- |
| `packages/meri-client/README.md:3` and `src/guarded-transport.ts:225` | `createMeriChat` requires an explicit approved API, authenticated fetch and canonical UIEvent validator. It uses AI SDK stream frames and `view.subscribe`, with guarded projection/resume. Preserve this for streaming; the four action JSON routes are a separate request/response adapter. No guessed `/api/chat` default. |
| `packages/meri-client/src/client-facade.tsx:28` | External chat/useMeriChat is a subscription; detach is not durable cancellation. No second SDK loop or automatic submit/retry. |
| `apps/web/src/features/meri/workspace/workspace-view.ts:100` | Already projects `tool.started` / `tool.completed` and result references by run/attempt. Feed only canonical accepted events; add a separate currently authorized action-result view for the returned recommendation page. Never infer accepted tasks from the reference. |
| `.../RunActivityPanel.tsx:30` and `:124` | Shows references; Stop/Steer/Resume/Fork/Approve/Download remain disabled. Wire only the newly admitted operations; do not enable unrelated controls or invent an approve endpoint. |
| `.../MeriRunWorkspace.tsx:10` | Explicit disconnected/sample component with local draft state. Frontend owner must add live-session/container wiring after exact API/client-validation agreement; this component is not evidence of live source delivery. |

Root source outline `563a814b87b0a629d7358cf7d936e6a611615ac4` and parent-confirmed route contract specify the new unactivated adapter:

| Method/route | Exact body | Frontend behavior |
| --- | --- | --- |
| POST `/api/action-followthrough/query` | `{request}` | Render currently authorized retained observation/actions and coverage; store immutable lookup/result references. |
| POST `/api/action-followthrough/draft` | `{selection,edits?}` | User explicitly selects one returned recommendation and reviews edits; render draft, no accepted-task claim. |
| POST `/api/action-followthrough/prepare` | `{draft}` | Render immutable proposal/pending approval. Preparation is not approval or task creation. |
| POST `/api/action-followthrough/execute` | `{proposal}` | Only after separately established current approval; server resolves execution capability/credential. No model/browser approval authority. This pilot excludes execute. |

Success is canonical direct JSON; errors are `{error:{code,outcome}}`. Opaque bearer is resolved freshly server-side; the trusted session separately supplies `lookupCredential` and fresh `checkedAtMs`, never reuses that browser bearer as a tool capability; never supply tenant/actor/run/capability/approval as authoritative body/hints. Preserve UNKNOWN and known-stored-but-not-released outcomes; no auto-resubmit after timeout. Browser UIEvent validation remains public0.1; frontend must use a deliberately supported action-request/result client boundary supplied by the backend owner, not import private0.2 server modules or mirror schemas. The root must provide exact accepted API/source freeze, browser-safe validation/export plan, authenticated endpoint/session binding, and one wire fixture per success/denied/pending/unknown outcome before frontend implementation. The local runner path `scripts/local-followthrough/cli.mjs --run` was parent-reported as forthcoming; no execution claimed here.

Parent relay only: send this metadata handoff to the frontend owner with the PR16 pin and final backend API freeze. This lane sent no external message and modified no frontend source/shipping candidate. Shipping/native/SDK/image owners retain their separate qualifications. Source application work can continue while the six human prompts, price/permission and native bindings are gathered.

## Checks and deliverables

`verify.py` independently recalculates Decimal costs/call totals, verifies all six literal prompts and mandatory holds, validates exact frontend pins, hashes all local governing/source references and checks every baseline blob unchanged. Only report/packet files are added. `verification.json` records the actual result; `manifest.json` binds the small packet and report. No product tests or paid/native/frontend flows were run because this is metadata-only work.
