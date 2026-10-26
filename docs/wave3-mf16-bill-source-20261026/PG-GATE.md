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

# Release gate: native bill-source persistence

Use Release's existing isolated PostgreSQL16 process. Integration has not executed this fixture. No migration is added by MF16.

1. Allocate one disposable database named `meri_mf16_source_<suffix>` and an ordinary LOGIN role `meri_mf16_app_<suffix>` with NOSUPERUSER, NOINHERIT, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS; no role memberships or owned application tables. Preserve shared databases/services. Provision and apply the current canonical conversation/settings dependencies through Release's existing harness; provisioner and tested role remain separate.
2. The test uses the exported synthetic binding in `apps/control/conversations/sources/test/fixture.mjs`. Seed that tenant's ordinary model-policy cap in `meri_settings.tenant_settings` using the existing Release fixture convention, including the current sdk_max_turns/sdk_max_budget_micro_usd columns. The tested role needs schema USAGE, SELECT/INSERT/UPDATE on conversations/runs/events, SELECT on next_runs, and the existing policy-read columns on tenant_settings. No DDL, DELETE, ownership or administrative grant is needed by this test. Use current canonical migrations; do not manufacture a shadow schema.
3. Set `MERI_BILL_SOURCE_TEST_HOST` to the allocated `/tmp/...` socket or `127.0.0.1`, `MERI_BILL_SOURCE_TEST_PORT` to the allocated non-default test port, and the two exact `MERI_BILL_SOURCE_TEST_DATABASE` / `MERI_BILL_SOURCE_TEST_USER` values. Keep any PGPASSWORD in private process environment; never print it. Missing allocation is a failure, not a skip.
4. Run `node --test --test-concurrency=1 apps/control/conversations/sources/test/source-pg.test.mjs` against the accepted source. The fixture checks PG16/ordinary-role facts, exact concurrent publication, reconstruction, changed delivery/scope refusal, lost real COMMIT acknowledgement, completed transcript/source round trip, foreign selectors and terminal fencing. It has a30-second test bound, three connections, five-second connection/query caps and existing transaction lock bounds.
5. Record source commit/tree, command/Node/pg versions, all subtest results and preserved failures. The fixture only closes its pool; Release owns disposal of its allocated database/role. Do not reset a shared target or repeatedly run against its populated fixed synthetic identities. An actual test failure needs diagnosis, not a skip or automatic reset.

The separate current-access/retention/HTTP controls are synthetic and already covered locally; this gate proves real persistence semantics only. Image/package/deployed acceptance remains separate.
