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

# MF16 native bill-text source — implementation outline

Base Meri0d128fe18c91530ab67de8f729b769c6e4b64e55/tree5cacccd0535e815456b9e5f7205facc5e49c3903. Isolated branch codex/wave3-mf16-bill-source-20261026. Root allocates the versioned public source/reader contract, trusted native capture and current authenticated product readback. All merged Recovery inputs remain preserved.

Decision: add an explicit versioned native bill-text event/reference, separate from SourceEvidence. Keep the entire frozen meri.schema.json byte-identical, including SourceEvidence and its required authorizationDecisionId. Native proof is the actual execution/current-policy observation plus operation/version, deliveryId, immutable binding, request/result hashes and exact Core bill/version/revision/content and text hashes/page range. No invented authorization-decision UUID, capability, model claim mapping or source URL in the saved reference. Initially call it a saved source/read. Only successful sequential read_bill_text@0.2.0 pages qualify.

Canonical owners: reads-owner validates the native response after final currentness, then invokes a trusted, composed capture hook. An adjacent bill-text source module validates the existing typed Core result and projects the bounded reference. The existing conversation appendEvent transaction remains the only durable event writer. Deterministic event identity is bound to conversation/run/delivery; changed eligible input/result under that identity refuses. A narrowly scoped native-source append preserves its first recorded timestamp on exact replay. Commit acknowledgement loss reports an explicit unknown publication outcome; it never invents successful receipt or retries an effect.

Current reader: a separate named POST product route accepts only conversation/run/reference identity, loads the event through the existing owned conversation/history transaction, uses the current authenticated native bearer and existing Core service secret to reread /api/clio/tools/read_bill_text, and validates exact saved revision/content/text/page identity. First page uses exact bill/version without a fabricated offset-zero cursor; continuation uses the canonical cursor owner. Fresh membership/currentness and the existing retention serving fence bracket final response serialization. Completed runs require no execution credential, model call, prompt replay or readmission. Core denial, missing/stale reference, retention and unavailable Core withhold excerpt/link. Source-controlled unsafe URLs become inert/null. Offsets retain Core JavaScript UTF-16 semantics and page versus document coverage.

Public package: add the minimal versioned source-reader schema, byte receiver, deliberate public export and generated browser/types/schema artifacts. Existing conversation event/history receivers must recognize the explicit new native variant while retaining old validation. Generators own generated bytes; no repack/install/image/DB/cloud/provider operation is allocated. Dependency resources may be reused read-only from the qualified Recovery generator install, with owned local links and no donor writes.

Verification: focused contract positive/negative fixture; actual composer→typed Core→trusted publication; duplicate delivery and changed result; lost COMMIT acknowledgement and durable replay; completed-run reader through actual product/history release owner; foreign tenant/actor/conversation, revoked/changed currentness, stale revision/hash/range, Unicode boundaries, unavailable Core and malformed URLs. Add a bounded PostgreSQL fixture for changed append replay/lookup semantics; Release alone executes it. Reuse accepted unrelated suites. Preserve raw failures/skips and exact source hashes in the final source handoff.

Frontend waits for independent producer review and actual archive; m3_scope owns Figma3.4 audit/unsupported provenance design. No other read families, usage/tool-detail, hearing media or answer-to-citation claims are included. Additive native schema, explicit current conversation/history unions, AI SDK stream type union and authenticated source-read adapter are necessary integration seams; avoid shared dispatcher changes and new ledgers/caches/authority.
