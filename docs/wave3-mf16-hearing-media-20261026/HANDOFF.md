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

MF16 hearing media source handoff — 26 October 2026

Base: cc8a6d9fce95e235fee15c1c6a524a611fba3912. Branch: codex/w3-mf16-hearing-media-20261026. This is a separate media follow-up; it is excluded from the frozen 720741c5 rollout. FE212 is merged; no viewer changes are included here.

Implementation: the existing /api/conversations/source-read owner accepts the additive meri.hearing-media-read/1 family. It resolves the saved hearing event, preserves admission/currentness/retention and final-release checks, and reads the fixed Core /api/clio/conversations/hearing-media route with the current bearer and existing service identity. The request contains only conversation/run/reference plus null (manifest) or epochId/positionMs (playback). Saved event metadata, model context, transport and source hashes remain unchanged. The closed public receiver checks exact saved identity/hash, hearing, epoch/time coverage, unique epochs, safe HTTPS playback URLs and content-free errors. A URL never comes from stored source prose or caller input.

Core dependency: the sibling capiro-backend branch of the same name adds the narrow exact-record/media projection through the existing Intel PublicHearingAudioAccessService manifest/playback owner. No recording activation, database migration, provider request or signing-policy copy.

Validation (Node 24.22.1, source only): 3 new media receiver tests plus 3 affected hearing receiver tests PASS; 4 new media router tests plus 5 affected hearing and 8 bill router tests PASS, 23 total, zero skips. The router tests use the real runtime product mount, synthetic store/identity/HTTP fixtures, current-read Core transport and final release fences. Test-only receiver schema compilation writes no distribution. Existing packaged worker imports resolve through Release's actual cc8a6d9f public contracts/ui-stream consumer; third-party tools use retained installations. Syntax and diff checks PASS. Initial sparse-checkout, dependency-resolution and hook errors occurred before behavior and are retained beside final logs.

Evidence: C:/Users/Administrator/Documents/Codex/2026-10-25/wave2-visible-runtime/outputs/w3-mf16-hearing-media. meri-sparse-import-failure.log contains the six passing receiver cases as well as initial HTTP import failures; meri-http-tests.log contains 17 final passing HTTP cases. No package build, install, packing, DB or cloud action occurred. No generated dist is authored in this PR.

Package requirement for Release: build the updated @capiro/meri-contracts package from this exact reviewed head using its existing generator/package pipeline. The existing public export @capiro/meri-contracts/conversation-sources gains HEARING_MEDIA_READ_SCHEMA, receiveHearingMediaRequest, receiveHearingMediaResponse, HearingMediaReadRequest, HearingMediaReadResponse and AdmittedHearingMediaRequest. No new export path, UI-stream behavior or client SDK behavior is required. Integration owns artifact-manifest/lock adoption. Package version/physical archive identity belongs to Release, not this source branch.

Frontend continuation: use @vidstack/react 1.15.7 and media-chrome 4.19.4 (both MIT; registry metadata checked 26 October). Integration owns exact dependency/lock adoption; Runtime will author the player through the current application-read owner. Source-level recorded ranges are not citation timestamp mappings. Captions stay unavailable unless an owner supplies them. Dispose current media on expiry and source/view/identity replacement. Independent source review, Release generation, installed receiver/browser checks and authenticated live acceptance remain outstanding.
