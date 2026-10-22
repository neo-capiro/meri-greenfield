---
name: meri-specialist-model-list-review-2026-09-28
description: "Neo wants Meri as orchestrator + specialist sub-agents; reviewed a Codex model/dataset shortlist — verdict, provenance constraint (NDAA §1532, BAAI Entity List), Bedrock CMI limits"
metadata:
  node_type: memory
  type: project
  originSessionId: 6ceffbf3-3967-41e0-bbd0-82182a24a832
  modified: 2026-09-29T01:58:35.295Z
---

2026-09-28: Neo asked whether a Codex-generated list (DianJin-R1, TAT-LLM, Llama-Fin-8b, Recon, GELATO, Granite 4.0 H Small, Phi-4-reasoning-plus, Docling, PaddleOCR-VL, BGE-M3, Tax-Calculator/OG-USA, CBO force tool; plus Qwen3.8-27B, Qwen3.6-35B-A3B, Saul-7B, LegalMind, Fin-R1) is good for Meri specialists. Neo's own plan `Downloads/03-Meri-Specialist-Models-and-Fine-Tuning.md` (§8.3–8.5 register: SaulLM-54B, Granite 4.2-8b, Qwen3.8-27B, Nemotron-Parse, etc.) already covers most of it.

My verdict: data-source + method halves good; model half weak (corporate/Chinese-finance fine-tunes, weightless recipes, hobbyist adapter, HF "policy" = robotics noise). Meri runs `gpt-6-astra` (OpenAI) for fast/standard/deep; its failures are grounding (23/26 JEV findings) and ~132 tools with no per-turn selection → orchestrator's near-term win is tool partitioning on the current model (plan arm B), not new weights. Top missing dataset: J-book embedded XML ([[jbook-pdf-embedded-comptroller-xml]]); also GAO approps decisions/Red Book (0 hits on main), bill↔`CboCostEstimate` pairs (already synced).

Provenance facts verified: FY2026 NDAA §1532 bars DoD + contractors from DeepSeek/High-Flyer AI in contract performance, "covered AI company" includes entities domiciled in covered nations; BAAI (BGE) on BIS Entity List since 2025-03-25. Bedrock Custom Model Import: Llama/Mistral/Mixtral/Qwen2–Qwen3(CausalLM/MoE only)/gpt-oss(us-east-1, InvokeModel only), transformers 4.51.3, <128K context.

**Why:** customers are defense contractors; PRC-origin models (Qwen, DianJin, Fin-R1, BGE, PaddleOCR) in the serving path need counsel review. **How to apply:** in any Meri model-selection work, flag provenance and check CMI architecture support before planning managed serving. Related: [[meri-quality-plan-review-2026-09-27]].
