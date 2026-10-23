# Item 0 SDK spike: evidence and disposition

23 October 2026. Codex orchestrator; independent final-answer review by a separate Astra Ultra lane. This report is an experiment result, not a product release or full Wave 2 acceptance.

**Disposition: ADJUST, with GO for continued full-native-SDK implementation.** Direct Bedrock, native tools, subagents and restored-session continuity worked in the bounded experiment. The five-question Claude.ai comparison supports this direction but does not establish equal quality or production readiness. Apply the short grounding adjustments below and replay the affected questions before closing the quality gate. Nothing from the experiment PR merges as product code.

## Reproducible experiment

- Original source: `f4aa9d250b7ab00261560a54abd58703251da303`, under `spikes/item0-sdk/` in experiment PR228. Native task-tool replay: `5d6bc28ea5cc516f2b1f81e8bdb23421c4090f8d` in the same unmerged PR.
- Claude Agent SDK `0.3.295`, bundled Claude Code `2.1.295`; Bedrock `us.anthropic.claude-sonnet-4-6`; Node `24.22.1`, ARM64, non-root runner.
- Full `claude_code` system/tool preset plus a short Meri append; original skills loaded as a native plugin. Fourteen skill identities were discovered. One native verification subagent and one synthetic HTTP MCP tool were configured.
- Each original question ran in a fresh isolated Fargate task. The resume and fork tasks restored the original seed's SDK SessionStore. Bounds were twelve turns, one USD SDK estimate per question, 4,096 output tokens per model request, a 120-second abort and 180-second outer deadline. No Core, customer data, database or external mutation tools were used; Bash was unavailable.
- The synthetic fixture contains two fictional clients, six labelled evidence records and an explicit 23 October as-of date. The MCP tool returns exactly the fixture file. The five original prompts are preserved in the original source, not replaced by the later task-tool replay prompt.

| Question | Observed behavior | First text / elapsed |
|---|---|---|
| Meeting brief | Native fixture MCP, file reads and saved brief; unavailable TodoWrite disclosed | 2.805 s / 25.316 s |
| Same-conversation follow-up | Restored session remembers the rehearsal phrase without reading a saved answer | 3.382 s / 7.010 s |
| Alternative branch | New fork session remembers the phrase; original stored session unchanged | 2.646 s / 7.275 s |
| Cross-client evidence comparison | Fixture MCP and real native verification subagent used | 2.653 s / 22.695 s |
| Public research | GAO WebFetch succeeds; Bedrock WebSearch unavailable and disclosed | 6.974 s / 15.285 s |

All five original tasks exited successfully; mirrored-session errors were zero. The completion tail after the last text was 48–86 ms. These are SDK experiment timings, not browser-visible product timings or Core/AWS/database call-budget acceptance.

The five incremental SDK cost estimates total **USD 0.32507460**. Resume/fork result totals are cumulative; the original seed baseline was subtracted. These are SDK estimates, not AWS invoices or total infrastructure costs.

The separate native task replay proves `TaskCreate → in_progress → Write → completed → TaskGet/TaskList`. The SDK runner exited zero, but the wrapper's report upload failed and exited 74. Retained transcript/session evidence establishes the lifecycle and SDK cost-state estimate of USD 0.15075015; the missing original report and exact first-text timing must not be reconstructed or claimed. Native task files are separate from chat transcripts and still need scoped production persistence in the continuity step.

## Claude.ai comparison and independent review

The five original questions were run in Claude.ai with Sonnet 4.6 displayed at Low effort. Synthetic fixture contents were supplied inline with a disclosure instruction for tools unavailable in that interface. Follow-up used the same conversation. The hypothetical question used the product's edited-message branch from the original answer; both branches remained available and the original was restored.

This is a comparison of answers under different harnesses, not a controlled parity test: the SDK used its default effort and Claude Code preset, while Claude.ai has its own system prompt and settings. The original Meri skill, fixture MCP and verification subagent were not installed in Claude.ai. Browser response timings were not measured. Private chat links and account history are excluded from this public report.

The independent reviewer inspected only final answers, exact inputs, captured metadata and visible web-tool evidence. Scale: 0 deficient, 1 mixed, 2 strong; dash means not applicable. Columns are grounding, uncertainty, actionability/relevance, organization and continuity.

| Question | SDK G/U/A/O/C | Claude.ai G/U/A/O/C |
|---|---|---|
| Brief | 2 / 2 / 1 / 2 / — | 2 / 2 / 2 / 2 / — |
| Follow-up | 1 / 1 / 1 / 2 / 2 | 1 / 1 / 2 / 2 / 2 |
| Fork | 1 / 1 / 1 / 2 / 2 | 1 / 1 / 1 / 2 / 2 |
| Comparison | 1 / 1 / 2 / 2 / — | 1 / 1 / 2 / 2 / — |
| Web | 1 / 2 / 2 / 2 / — | 1 / 1 / 2 / 2 / — |

No aggregate winner or statistical equivalence follows from this small, differently configured sample.

Substantive findings:

1. The SDK comparison calls an earlier promise and a later completed tracker entry a contradiction. They are temporally compatible; the gap is missing corroboration. Its urgency ranking is otherwise supported by the supplied dates.
2. The SDK hypothetical invents an overdue reply and a draft deadline tied to the hearing. Claude.ai likewise calls the next day's draft deadline past due. Preserve the supplied as-of date and distinguish source deadlines from proposed action deadlines.
3. The SDK follow-up correctly names the draft owner, then overstates that all owners are unverified. Claude.ai repeatedly substitutes unassigned for unknown in the sample. Preserve the distinction.
4. Claude.ai labels a verification-subagent report without observed delegation. The SDK actually invoked its configured subagent. Do not claim tool or subagent provenance from a heading alone.
5. Both public-research answers overgeneralize beyond the requested distinction between a GAO report and enacted legislation. Keep the answer within accessed evidence and avoid universal claims about all legal decisions or obligations. Claude.ai visibly performed web search and GAO fetch; the SDK honestly disclosed its unavailable search.

The short Meri append/input context should reinforce these evidence distinctions; it must not become a custom validation loop or replacement system prompt. Replay the same bounded questions after adjustment. Preserve both earlier answers and new evidence rather than overwriting the failures.

## Production implications and remaining acceptance

- Keep the full native SDK and direct task-IAM Bedrock path. Native tools, skills and subagents are demonstrated; no replacement loop is justified.
- SessionStore restore, resume and fork work in the experiment. Production persistence, tenant/conversation isolation, reload while streaming, Stop, continuation after deployment and Stop across deployment remain required.
- Bedrock's unavailable built-in search needs honest capability presentation and the existing qualified public-search tool path. MP must verify the Claude API path separately; this experiment does not prove provider-switch compatibility.
- The native task lifecycle does not establish durable tenant scheduling. Temporal remains the existing durable run/schedule owner.
- Core tool parity, authorized-client General reads, per-result walls, live isolation negatives and call/latency budgets remain unverified by synthetic fixture MCP.
- Experimental images have unresolved high-severity findings and are not release candidates. New product images need their own exact-source review, ARM64 build, scan, runtime gates and deployed acceptance.

All six experiment tasks stopped. Temporary task definitions were made inactive and experiment security group/task role were removed; evidence and existing execution/project resources were retained. No product service or database was changed by this spike.

Local evidence is retained by the orchestrator under `work/item0-spike-aws/`: original per-question reports, `replay-task-tools/`, cleanup receipts and `claude-ai-comparison/` exact final answers, prompts, screenshots and limitations. Raw SessionStore data and hidden reasoning are not published. The production runtime integration, all A2/M2 scope and final Wave 2 acceptance remain open.
