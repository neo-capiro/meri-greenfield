## 1. Claude handles the harness

The quality bar is Claude's own. Answer quality comes from the whole harness, not only the model: its system prompt, built-in tools, subagents, skills, context management and compaction, and session handling.

- Run `@anthropic-ai/claude-agent-sdk` with its **full harness** and the Claude Code system-prompt preset, plus a short Capiro/Meri append. Don't replace the preset with our own prose.
- Do not rebuild what the SDK or AWS already does: model calls, retries, streaming, the tool loop, context management and compaction, session resume/fork, per-run turn and spend limits, AWS credentials.
- The real Claude SDK calls Bedrock directly using its narrowly scoped AgentCore runtime IAM role. Preserve the full preset, native tools, subagents and all 14 skills.
- Capiro data reaches Claude as **tools** (rule 4), not as a custom retrieval layer around the model.

Spec and plan: `phases/wave2/WAVE2-00-CLAUDE-NATIVE-HARNESS-SPEC.md`. It is **Wave 2 item 0**, and it comes before every other item that touches the runner, the proxy or authority.

## 2. Simple, standard architecture

```text
browser -> control (current access, conversation/run ownership, durable events)
        -> AgentCore Runtime V1 (isolated conversation session; actual Claude SDK) -> Bedrock
                                      -> tool gateway -> Core
control -> existing durable SDK SessionStore and artifact owners
control -> Temporal for required durable runs, schedules and background work
```

- **Core is the gatekeeper for Capiro data.** Tenant, member, client and wall rules remain server-side in Core. Check current access at admission and actual tool/data/artifact access; revocation must also prevent use of previously loaded privileged context. Do not duplicate policy in the harness.
- Reuse one isolated environment only for the same immutable tenant/actor/conversation and approved General/client scope. Serialize turns; stop idle compute and restore exact SDK transcripts and artifacts from their durable owners. A Runtime session ID is not authorization or durable storage.
- Keep the SDK's per-run turn/spend limits and one canonical tenant cap/usage owner. Preserve required durable runs, schedules, consent, outcomes and uncertain-write fences; neither SDK Task tools nor a warm process replaces Temporal durability.
- **No custom warm pool, per-turn ECS task requirement, model proxy, duplicated per-hop authority, credential-minting service or spend-reservation ledger.** Use standard Runtime V1; no V2 snapshot machinery or second SDK implementation.
- Before adding a mechanism, identify the standard feature or existing owner it uses. Before deleting a wrapper, prove the retained lower-layer behavior with meaningful positive/negative tests. Do not remove canonical authorization, idempotency or durable outcomes as “extra security.”

## 3. Leave no dead code behind

A change is not done until what it replaced is gone.

1. **Delete in the same PR** everything the change makes unused: code, tests, fixtures, docs, config keys, env vars, feature flags, IAM statements, ALB rules, secrets, task definitions, CloudFormation resources, kit steps, alarms and metric filters. Applied database migrations are history: never edit them. Drop tables only through a separately reviewed forward migration after a snapshot; this hosting migration does not itself authorize schema/data removal.
2. **Temporary diagnostics come out before merge** of the fix they were added for. A log line stays only as named product telemetry that someone reads.
3. **No code behind a flag nothing turns on.** The "source-complete, activation-held" status is retired for code we don't intend to ship. Dark features need an owner and a date, or they are deleted.
4. **No** commented-out code, `legacy` or `_old` copies, compatibility shims for removed things, or "superseded" stubs.
5. **Show proof in the PR:** list the identifiers, files and resources deleted, with a search proving no executable/active caller remains; label immutable historical references, and explain any drop in test count.
6. **Old plan tickets for removed mechanisms are closed as superseded**, not implemented and left dormant. See `source-of-truth/SUPERSEDED-BY-ITEM-0.md`.
7. **Reuse before write.** Use SDK, AWS and library features first. Custom code needs one line saying what the standard option couldn't do.

## 4. Capiro data must keep working

- Capiro data is served to Claude as tools. Core remains the source: today's read families call Core at `/api/clio/tools/<operation>`, and the new tools call the same endpoints.
- Tools are hosted by **control** (the existing tool gateway) so the runner never holds the Core service secret (`x-internal-service-secret`). The runner gets only a short-lived per-run token for control, scoped to tenant, user, client, conversation and run.
- Reuse the existing read handlers under `apps/gateway/sources/*` and their typed schemas. Delete the authority, relay and measurement wrappers around them.
- Parity: every read family that works today must be reachable as a tool with the same results and the same permission outcomes. A parity checklist is part of the item 0 spec.
- Negative tests are mandatory: another tenant's data, another client's data, and walled data must not be retrievable, through chat or through tools. A General chat reads across the clients the user can already see, with each client's wall enforced per result (FINAL-PLAN decision 2).
- The original read-only first cut is historical. Neo subsequently authorized preview client-record writes and autonomous Wave 2 completion. Activate accepted writes through their existing authenticated domain/intent owners and receipts, with the actual route/configuration and effect semantics verified. This does not authorize the assistant to send external mail without the user's specific send instruction.

# MF16 recorded usage reader — 26 October 2026

## 1. Outcome and bounded scope

Added authenticated read-only POST `/api/conversations/usage` for an exact owned conversation/run. One bounded route/receiver search found only private accounting reads and internal routine lineage consumers, so this adds the missing public seam rather than a second accounting owner. Completed runs remain readable after owner reconstruction. No frontend, accounting writer, SDK, cap, schema or migration behavior changes.

## 2. Source and ownership

Owned branch `codex/wave3-mf16-usage-read-20261026`, checkout `C:/dev/wave3-mf16-usage-integration-20261026`, authored from reviewed273 head8807d8b786aabef9d656d0568785c6c0c25e0769/tree27737305c4150f27503177eacd49abca76fa1ef6. Before publication compose merged main592f332cdbd394414459f1401f98316af17e3221, whose identical tree and parents were fetched and verified. The original273checkout is preserved. Root reports native bill-source gate5/5 accepted and273merged; that gate does not claim to execute this new reader. Root independently reviews/merges; Release owns native/package/build/cloud operations.

## 3. Facts and truthful limits

The projection reads the existing content-free immutable accounting record. It preserves missing recording versus recorded unavailable versus recorded zero. `usage.runDelta` retains the stored run SDK estimate and original model counters. `usage.cumulative` retains cumulative pipeline totals and separate per-model SDK estimates with original SDK/CLI/provider/cache-write TTL/price revision and model provider/cost basis. There is no price calculation or invented per-model run cost. Money is USD; tokens/cache counts and web-search request counts retain their original units. Provider-billed USD is explicitly null. Missing counters are not replaced with zero.

At most32models and128native hook outcomes, with131072-byte public response cap,4096-byte request cap and safe integer counters/durations. Partial/omitted audit coverage and unknown duration are explicit. Even with omitted0, coverage is only recorded hooks. Completed/failed refers to tool execution, never confirmed external effect. Model/tool names remain bounded inert text, never links or commands. Native toolUseId is dropped: no join to UI tool.call requestId, sources or another row is claimed. SDK session, parent-run, tenant/actor/policy IDs, accounting input hash/charge, arguments, outputs, prompts and free-text errors are not released.

## 4. Existing authority and persistence owners

A narrow history usageContext reads canonical owned conversation/run identity while excluding sdk_usage columns. It reuses rowRun integrity/scopes decoding. Current Core access and retention checks precede `postgres-store.readUsage`; that unchanged owner validates the immutable binding and stored usage hash. History.recheckRelease then brackets final native membership, current Core metadata/conversation access, retention and synchronous response serialization. Completed, General and selected-client cases use the same owners. No new reservation, prompt, resume, source read, write or transaction behavior; no new native gate was executed. Existing accounting persistence evidence is reused, not rerun or relabeled as new reader proof.

## 5. Public distribution

Additive versioned `@capiro/meri-contracts/conversation-usage` and `/schema` exports use schema `meri.conversation-usage/1`; generated browser bytes validate closed shapes, exact admitted request identity, units/model correlations, bounds and immutable results. Frozen legacy events, bill-source schema/receivers and AI SDK transport are unchanged. History and task-command metadata alone refresh their changed owner source hashes; their receiver JS/types/schemas stay unchanged.

Unbuilt contracts0.1.15 and ui-stream0.1.5, exact contracts peer0.1.15, remain one pending cohort. Final source trees are recorded in the external publication packet, not inferred from273package trees. Release must produce and qualify one coherent pair of actual archives after acceptance; frontend adopts those actual archives through its existing Figma components. No pack/build/install occurred.

## 6. Focused verification and retained failures

17distinct cases pass across bounded runs: projection5/5 in the initial run, final authenticated HTTP7/7 and final actual public receiver5/5. Covers completed read/reload without writes, no-record/null/zero, multi-model cumulative versus run delta, unknown pricing, partial hooks/duration, private-field removal, malformed records, wrong tenant/actor/client/selector, final membership identity changes/revocation, Core refusal/Trash, retention before/after storage, mismatched run rows, real product router mount, browser bounds/correlations/units and frozen schema bytes. Public TypeScript check passed. Usage/history/task-command generator --check and whitespace checks passed. No broad parity or provider test campaign.

Initial17-case run passed16; one new test attempted to mutate a deliberately frozen result. Cloning the test input corrected it; no production behavior changed. That failure and all bounded reruns remain in CHECKS.json/raw logs. A worktree read started while checkout was still completing and found one not-yet-materialized file; creation was awaited before implementation. No functional evidence derives from that partial read. No claims of native or deployed acceptance for this reader.

## 7. Resources and cleanup

No service, DB, cloud resource, package install or provider call was created. The isolated checkout uses owned links to existing273qualified dependency resources (root/runtime/worker/artifact/window-resolution, Zod and individual contract generator libraries). Donors and the original273checkout remain untouched; no cleanup/delete/reset. Node24.22.1, TypeScript5.9.3, Ajv8.20.0, formats3.0.1, esbuild0.28.2, json-schema-to-typescript16.0.0, canonicalize5.1.0.

## 8. Changed owners and deletion proof

New cohesive usage-read projection/HTTP and conversation-usage schema/receiver/generator/tests; narrow history context and runtime mount splices; public export/README and generated metadata. This is additive to a verified missing public read, so no former public route or worker/accounting code is replaced and no tests are removed. Exact source proof confirms16protected owner/artifact/lock paths unchanged, including activity/native hooks/private usage/accounting/store, product bearer owner/history release, frozen schema, bill-source producer/read/receiver and ui-stream/package/root locks. No duplicated price table, ledger or per-tool/source correlation exists.

## 9. Next action and acceptance state

Ready for independent exact-head source review. Root owns merge; Release holds final archives until both accepted source slices form the coherent cohort, then records actual package hashes/trees/peer bindings and owns any required native/image/deployment qualification. Frontend remains separately allocated after actual artifact qualification. FE187/188 accepted composition work is disjoint and queued; no overlap with this Meri checkout.
