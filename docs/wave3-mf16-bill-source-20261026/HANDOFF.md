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

# MF16 source handoff — 26 October 2026

## 1. Outcome and accepted scope

A trusted sequential `read_bill_text@0.2.0` result now records a durable `source.native-bill-text` event before returning its text. The current product reader can open the saved exact page after run completion/reload without model dispatch, prompt replay, execution credentials or readmission. Query excerpts, other families, usage/media and answer-to-citation mapping are excluded. A source read alone makes no answer claim.

## 2. Ownership and source binding

Integration is the sole author. Root owns independent review and merge; Release alone owns PostgreSQL, actual package/image creation and deployment. Repository `neo-capiro/meri-greenfield`, checkout `C:/dev/wave3-meri-integration-20261026`, branch `codex/wave3-mf16-bill-source-20261026`, target `main`. Exact base is `0d128fe18c91530ab67de8f729b769c6e4b64e55`, tree `5cacccd0535e815456b9e5f7205facc5e49c3903`. The final commit/tree and PR are recorded in the published PR body and Integration's `outputs/W3-MF16-SOURCE-CANDIDATE.json` after this handoff is committed. Existing Recovery/WS10/Onboard evidence and all other lane checkouts remain preserved. No frontend path is edited; Root's lifecycle_trace/a3_scope receiving leases remain disjoint.

## 3. Producer, persistence and current reader

Native Control validates the actual binding, operation, normalized arguments, result hash, execution hash, scopes and policy, then projects only Core bill/version/revision/provider/lineage/content hash/text hash and page range/hash. The saved event contains no source text, URL, bearer or invented authorization decision. Deterministic identity binds immutable run binding plus delivery; the existing append transaction serializes exact replay and rejects changed eligible input/result. Exact replay retains the first saved event timestamp. Terminal/held runs remain fenced. Lost commit acknowledgement and HTTP cancellation during publication retain `SOURCE_PUBLICATION_UNKNOWN`; the client and SDK tool guidance preserve it without automatic redispatch. Query/other-family skips add no further currentness observation. Core's existing unavailable result remains an explicit `UNAVAILABLE` and never creates a reference.

`POST /api/conversations/source-read` accepts only schema version, conversationId, runId and referenceId. The existing history transaction verifies ownership, scopes, stored event/run hashes and sequence. Current product bearer/Core access rereads the exact page; the existing history release fence repeats membership/currentness and retention before serialization. First-page requests contain exact bill/version and no cursor. Continuations use the existing positive-offset tuple. Changed revision/hash/page refuses409; missing/non-source reference404; denied access403; unavailable source503. Errors release no text/link. Unsafe or oversized normalized URLs become null/inert; text retains Core UTF-16 offsets and page/document coverage.

## 4. Public contracts and transport

Contracts is `0.1.15`, UI stream `0.1.5` with exact contracts peer. New `conversation-sources` public bytes/types/schema export and `meri.native-bill-text-source/1` representation are additive. The full frozen `meri.schema.json` remains 50043 bytes / SHA256 `e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b`. Old SourceEvidence/root/browser validation remains strict and unchanged. Current conversation/history receivers explicitly admit the native variant; Node and browser agree. AI SDK transport JavaScript is unchanged; its public TypeScript event union now includes the native event. Generated lifecycle/input/initial-input changes are provenance metadata only, required by their changed conversation artifact input.

Old conversation/history receivers reject the new event. Coordinate updated consumer artifacts with the producer rollout. Do not deploy this producer ahead of those consumers. The frontend viewer waits for accepted source and actual artifacts, then m3_scope's Figma3.4 finding/unsupported-reference design.

## 5. Checks actually executed

Node24.22.1, TypeScript5.9.3, Ajv8.20.0, ajv-formats3.0.1, esbuild0.28.2, json-schema-to-typescript16.0.0, canonicalize5.1.0; exact version receipt in CHECKS.json. Focused suite initially58/59: its one failure was a new test incorrectly expecting HTTP200 for the unchanged Core unavailable behavior. The corrected native composition file passes11/11 (including that correction and a new query-skip case). Thus60 distinct focused cases pass across bounded runs, not one fresh aggregate run. Source/public receiver follow-up8/8 passes after final error-map freezing/URL bounding; it includes Node/browser agreement and the actual AI SDK data part. Seven selected legacy receiver cases pass. Public source/conversation/history types and UI stream types pass. All six affected generators passed --check before the final semantic regeneration; final generated bytes are produced by the same generators and the final receipt checks them again. PG fixture parses, but has not been executed.

Earlier actual candidate composition66/66 passed. Existing store14/14 passed. A broader history/product mount/product HTTP check yielded118/120; the two settings failures are retained below. No broad all-family census, package installation, npm pack, image build, database or provider operation was performed. Commands, exit codes, hashes and bounded logs are in CHECKS.json and the external evidence directory it names.

## 6. Failures, limitations and baseline comparison

Two unchanged settings HTTP assertions fail (`theme` response and expected SETTINGS_FIELD_INVALID versus actual SETTINGS_DOCUMENT_INVALID). Both reproduce using the exact base product-access/http.mjs loaded in the same environment; settings implementation/tests are unchanged. This is a bounded base-owner comparison, not a claim to have rerun the entire untouched checkout. The first comparison attempt failed because a Windows --import argument was a filesystem path instead of a file URL; both attempts are retained. The public history type check initially rejected assignment of the new union to legacy UIEvent; its test now explicitly narrows native versus legacy and passes. Initial missing dependency imports were resolved by reusing existing resources. No failing assertion was skipped or weakened. Native PG, packaged-consumer qualification, deployed authentication and frontend visuals remain unrun here.

## 7. Resources and cleanup

All linked dependency targets are existing resources; no donor was modified. Owned links reuse the Recovery generators/AI SDK, runtime TypeScript/AWS cache, existing root Ajv/pg and window-resolution/worker caches. A borrowed S3 package3.1141.0 only satisfies module loading in unchanged mount tests; no S3 client operation was performed, and this is not artifact-storage qualification. Automatic review rejected removal of an owned dependency junction; it was preserved under `node_modules-generator-resource` and a complete owned link directory was created beside it. The backup is locally excluded from Git. No process, listener, database, container, cloud resource or private credential was allocated. Existing local caches and services remain preserved.

## 8. Changed owners and deletion audit

Cohesive source projection/capture, current Core transport and source HTTP modules reuse existing operation contracts, append/history/product access/retention owners. Shared changes are the explicit native event union, runtime composition, closed read failure transport/guidance and public generated types. No migration, schema table, ledger, content cache, authority service, model loop, feature flag or broad dispatcher is added. No replaced executable owner becomes unused; legacy representation remains deliberate compatibility. Remaining old UIEvent validation is appropriate for queued/status/cancel/completion and runner publication. Runner publication still permits only run.status/message.delta. The scratch baseline loader is outside the repository and no temporary diagnostics are committed.

## 9. Next action and acceptance state

READY FOR REVIEW. Root assigns an independent review of the exact published head/tree. Release runs the one bounded ordinary-role PG16 fixture described in PG-GATE.md, creates actual contracts0.1.15/UI stream0.1.5 artifacts once after acceptance, and records their source binding. Consumer integration then uses those artifacts and Figma3.4. Current authenticated source opening, revocation, completed-run reload, native persistence and deployed compatibility remain explicit gates. Root alone merges; Integration performed no merge or deployment. No A2/M2 or other retained capability is declared complete.
