---
name: project-meri-provider-hop-sweep
description: "10-20 provider-hop sweep of Meri candidate 5 (4797f7da): real Bedrock stream can't settle (padding \"p\", Sonnet 4.6 fields), CountTokens != billed (465 vs 448) quarantines global budget, CLI title request; fixes on fable/adj-provider-sweep-20261020"
metadata:
  node_type: memory
  type: project
  originSessionId: e35d055c-d39f-4143-9898-f05e23e7a60d
  modified: 2026-10-20T17:14:53.360Z
---

Sweep of proxy → LiteLLM → Bedrock for candidate 5 (`4797f7da`, proxy image 57e79f73, node image 5b3017a3), 2026-10-20.
Fixes on `fable/adj-provider-sweep-20261020` (`a3f5b74c` settlement, `d4ed3a8f` CLI traffic), pushed, NOT merged; report
`C:\dev\fable\adj-reports\adj-a-SWEEP-PROVIDER.md`.

Real facts (recorded, not stub):
- Bedrock InvokeModelWithResponseStream chunk envelopes are `{"bytes","p"}` (random padding 5-47 chars). Sonnet 4.6 events add
  `container:null`, `stop_details:null`, usage `cache_creation{ephemeral_5m/1h:0}`, `service_tier:"standard"`, delta usage repeats `input_tokens`.
- Bedrock CountTokens (FM id) counted 465 where the same bytes billed 448 — never assume equality; settlement must allow billed ≤ counted.
  Old equality made `product-model-settlement.mjs` quarantine the single global budget row.
- CLI 2.1.295 without `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` sends HEAD /api/hello + a concurrent session-title request
  (output_config json_schema) per first turn; the proxy refuses both after owner admission.
- Network (NAT, no bedrock VPC endpoint), IAM (simulated), model access, quotas: all OK.

**Why:** the offline SDK/proxy qualification stubbed Bedrock frames and CountTokens and set the nonessential-traffic flag, so none
of this was ever exercised; no live chat had reached Bedrock.
**How to apply:** for any proxy/settlement change, replay the real stream (`scratchpad/sweep/main-response.eventstream` method:
capture real CLI in node image → LiteLLM in proxy image with injected recording httpx handler → one real Bedrock call → replay
through `_native_chunk` + `NativeStreamUsage`). Related: [[project-meri-proxy-403-owner-grant-and-exchange-budget]], [[reference-meri-proxy-python-test-env]].
