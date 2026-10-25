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

# Wave 2 checkpoint refresh — PROCESS 6.1, 13:52:55 UTC cutoff

FROM: Root | TO: Fresh Wave 2 documentation author | TYPE: brief | RE: bounded in-progress handoff refresh

Repository `neo-capiro/meri-greenfield`; branch `codex/wave2-handoff-20261025-docs`; preserved worktree `wave2-handoff-20261025-docs`. Exact starting head `3fb6a61776e655d882583e4cdd439c619dd735f7`, tree `67143a35fa973491ca09cf89d1e82be70e4ee1ab`; remote branch matches. PR245 base/main `e70dac734ae4efed31ebb3c3bcc5566584a848b5`. Check the worktree and remote again before commit/push; stop on another writer's changes. Only this author writes this checkpoint.

Operational/source evidence cutoff is **2026-10-25 13:52:55 UTC**, superseding the prior 13:11:48 checkpoint only where a dated newer receipt exists. Later Git reads may corroborate existing pins but are timestamped as documentation verification, not operational events at the cutoff. Do not chase ongoing workers. Wave 2 remains IN PROGRESS.

How we work: authors build; a separate xhigh reviewer reviews the exact documentation head; root orchestrates at Ultra and gates merges; helpers use xhigh. Existing Release alone executes AWS, migrations, rollout and rollback. Documentation does not block an independently qualified release. Only direct Neo chat approves scope/security; GitHub comments never approve it. No issue #202 post.

Owned files: `WAVE-2-HANDOFF.md`, this brief and the bounded O249 addition to the canonical decision log. Scratch stays in `wave2-handoff-refresh`. No product files, environment/configuration, tests/builds/containers/browser, customer/provider operations, AWS or merges. Existing draft PR245 is the authorized commit/push destination. Preserve all other checkouts, shared services/data, private authentication and caches.

Sources read: repository/host AGENTS; current standing requirements; PROCESS6.1/6.2/6.3; WORKFLOW; decision register through O248; FINAL-PLAN current execution section; approved Runtime V1 plan; master-plan excerpts and supersession register. Read existing Release, Supporting, Primary, Acceptance, Integration and feature-owner packets; treat source acceptance, image qualification, deployment and functional acceptance as separate states. Private inputs are referenced by name only; public facts use counts/booleans, never customer IDs/UUIDs, secrets or session IDs.

Bounded documentation task: retain the nine handoff sections and full canonical rules; update current Core13/live source/image plus unchanged components/ledgers/snapshot; preserve the Core12 33-row matrix and append Stage A separately; record exact accepted/pending/CHANGES source heads and bases, failed/unrun gates, local composition, two fresh Hermes owners and separate Wave3 work. Ordinary history causation remains unknown. No flags-only release or unqualified source adoption is implied.

Root allocated O249 solely for the documentation choice to freeze this cutoff and separate evidence strata, after confirming no newer reserved number. Record reason and reversal; this is not a Neo product/scope/security decision. Preserve O240–O248 unchanged and leave genuine pending Neo decisions explicit.

Applicable master tickets below are quoted verbatim for their existing evidence/reporting duties only. This documentation allocation does not implement routes, create a new matrix framework, activate a flag or execute an E-scenario. Current rules and explicit author/Release ownership supersede historical planning-only holds, removed proxy mechanisms and old release roles in the quotes. MF21/MX14 are unlisted (unchanged) in the supersession register; any removed-mechanism wording follows item0. Dated PR196/197 mechanism notes after MX14 are historical and excluded from this allocation.

#### MF-21 — Build a pinned composed frontend acceptance and release matrix (P0 activation gate)

- **Root cause / evidence:** Numerous unit/browser tests exist, many use controlled fixtures. No live deployment/provider action or test run occurred in this read-only audit.
- **Bounded files/owner:** Existing `apps/web/tests/meri-*`, `test/browser/meri-*`, route activation/production-data tests, fixture provenance checks; release checklist/receipt artifact.
- **Implementation:** Create matrix per ordinary route and flag with exact FE/Meri/Core pins, contract versions, deployment scope, issuer/audience/native actor mapping, client allowlist, migrations, worker composition, secrets references (not values), positive and negative test receipt IDs. Separate mocked receiver/browser regressions from composed runtime tests and provider-qualified outcomes. Require at least one real authorized main-path refresh/reconnect/Stop/approval/artifact receipt per enabled slice plus required denial/unknown-outcome cases. Keep not-tested/blocked labels explicit.
- **Dependencies / exclusions:** MR/MT/MM release gates and PF-01 ordinary deployment; PR115 merged source versus PR197 reception status. No test automation that mutates production or providers without separate implementation-stage authorization.
- **Acceptance:** Each enabled control traces UI→fixed proxy→versioned public contract→authorized owner→durable receipt→refresh. CI receipts map exact current pins, not stale PR body counts. Disabled/held slices remain disabled; no synthetic data in ordinary routes; rollback leaves uncertain operations reconcilable.

#### MX-14 · Make release scope and operator actions explicit, bounded and reversible
**Priority / type:** P0 release authority; owner decision and separately approved execution.

**Evidence and root cause:** Historical plans distinguish first authenticated chat, integrated preview and desktop full product; source receiver descriptions retain explicit holds. The present user request is planning only. Main/PR merges, source tests, an old shipping instruction or a generated packet do not authorize this task to activate capabilities.

**Bounded work:** Owner chooses the concrete release profile from MX-03 and the accepted definition of done. Root owns Meri/Core/frontend shipping and final integration under Neo's current authorization. Prepare one dated change packet naming source/image/feature/migration/cost/tenant/provider/audience, exact steps/observation windows, stop/rollback conditions, accountable operator and sanitized evidence. Separate low-risk source assembly from native test setup, provider-live calls, migrations/grants, PKI/credentials/OAuth, image publication, stack/service/listener/DNS changes and actual task/mail/notification effects.

**Dependencies:** All affected P0 tickets, selected P1 flow closures, MX-08–13 acceptance.

**Acceptance:** No shipping step proceeds on a generic “all source integrated” claim. Each required action has its own valid authorization and verified outcome; unknown submission is observed before retry. Unsupported/optional/post-launch items remain visibly open rather than counted as wired. Production promotion or replacement of a retained legacy fallback requires an explicit scope decision and rollback proof. No such action occurred in this audit.

## Matching acceptance scenarios — verbatim evidence boundaries

These are retained scenario definitions relevant to the reported deployment, acceptance and corrective-source rows. No scenario is executed or closed by this docs phase. E08/E09 checkpoint/reservation terminology retains only native SDK continuity under item0; E10/E11/E18 follow their re-scoped register entries. E39 and all removed-owner/proxy mechanism qualification are excluded.

| ID | Scenario | Required observable result |
|---|---|---|
| E01 | Authenticated selected-client first chat | One admission/run, real response, durable transcript and correct current actor/client |
| E02 | Reload/new tab after completion | Same messages/citations/artifacts, correct ordering and no prompt redispatch |
| E03 | Double click and lost submit acknowledgment | Same request identity reconciles to one accepted effect/run; no duplicate |
| E04 | Transport disconnect before/after first text | Cursor replay neither drops nor duplicates durable events; browser close does not silently Stop |
| E05 | Session expiry and transient Core503 | Retryable unavailable differs from revoked identity; no unauthorized bytes or false success |
| E06 | Sign-out/tenant/client change with stored draft/intent | Old data/credentials/receipts cannot cross the new identity or client |
| E07 | Stop at queue/load/start/model/tool/output phases | Logical stop fence and physical cleanup/unknown status are distinguishable; no later unauthorized effect |
| E08 | Failed/cancelled turn after completed checkpoint | Next allowed turn uses last valid published checkpoint, not failed partial state |
| E09 | Image-only release after completed turn | Existing conversation and pending reserved successor continue under candidate11-compatible rules |
| E10 | **[RE-SCOPED]** Deploy/rotation while old original is in flight | Historical Stop/retirement can close old work safely; current execution checks are not weakened |
| E11 | **[RE-SCOPED]** SDK/CLI/format incompatibility | Closed refusal before persistent successor acceptance; clear recovery/new-chat choice |
| E12 | Resume/fork/retry/steer/pause | Correct exported contract semantics, exact target, current scope and one receipt; unsupported cases explicitly unavailable |
| E13 | Approval allow/reject/expiry/revoke | Captured decision persists before dispatch; exact command only; stale approval refuses |
| E14 | Approval response lost/reload/paging denial | Read-only reconciliation, no automatic repost, current-access cache invalidation |
| E15 | Approval advances waiting run | Chat observation restarts or rereads immediately; terminal/new output appears without reopening |
| E16 | Task.create commits then visibility revoked | Durable tenant-bound effect recorded once; current result access denied; no duplicate retry |
| E17 | Unsupported task mutation | UI/tool does not imply success; no fallback to raw Core mutation |
| E18 | **[RE-SCOPED]** Read active-set and revoked operation | Only measured admitted operations are discoverable/executable; revoked/missing owner refuses |
| E19 | Research/Florida/Monday/task sources | Actual delegated Core endpoint, correct selected client/pagination/time semantics and cited evidence |
| E20 | FedRAMP/rule/SAM adapter adoption | Existing Core observation fields consumed exactly; absent/not-admitted adapter remains unavailable |
| E21 | Mail list/search/thread | Correct connected account/tenant/client policy, truthful unsupported attachments and no read→send escalation |
| E22 | Mail/task provider mutation uncertainty | Existing provider/command intent owns no-resend/reconciliation; no false receipt |
| E23 | Memory recall after correction/revocation | Current revision/permission, prior content not reused incorrectly, provenance retained |
| E24 | Memory proposal approved/rejected/lost acknowledgment | Correct owner and durable outcome; four payloads retained/tombstoned coherently |
| E25 | New-surface Memory context | No fake conversation/client authority; held path stays503 until accepted contract exists |
| E26 | Attachment upload/read/file | Bytes/hash/MIME/size/scan/current custody tied to exact actor/client; rejected file never appears usable |
| E27 | Artifact generation and publication | Valid content+version+hash+evidence; publish once; current Files/chat access |
| E28 | Six-format inspect/download | DOCX/TXT/XLSX/PPTX/PDF/ZIP exact receiver/MIME; invalid/expired/foreign references refuse |
| E29 | Preview/export/native open | Real renderer/native-reader opens promised format; formulas/layout/citations correct; ZIP not disguised preview |
| E30 | Selected research output restart/lost ack | Durable prepare/completion recover without duplicate file/effect; unpublished state not labelled completed |
| E31 | Research citation contradiction/injection | Current cited evidence supports claim; source text cannot authorize tools/effects or fabricate citations |
| E32 | Routine create/update/stop/list from completed chat | Durable schedule management does not accidentally require an active foreground run; authority remains narrow |
| E33 | Routine overlap/retry/DST/timezone/worker death | Exact occurrence/idempotency/consent, no double fire or silently lost due occurrence |
| E34 | Consent revoked or Stop during routine execution | Current cancellation proof/retirement, durable unknown where required, truthful inbox status |
| E35 | Objective/Planner continuation | Core owns workflow; source/run/reader grants exact; no resurrected legacy loop |
| E36 | Retention suppression→purge→restart/restore | Suppressed data stays inaccessible, class-specific deletion receipts, no restore resurrection |
| E37 | Browser/Bash denied or unqualified | No host/network/process starts; refusal before effect |
| E38 | Approved browser/Bash isolated execution | Current host/egress policy, bounded output, no credential escape, complete cleanup/absence proof |

## Definition of done

Run only proportionate documentation checks: exact canonical prefixes, exactly nine body sections, unchanged original 33 acceptance rows/counts, exact current pins against read-only remote metadata, local Markdown links, unique O-number, privacy patterns and `git diff --check`. Report commands/results/UTC and limits. No new executable product tests; test-count delta 0; mutations N/A; product tests/build/PG/cloud/browser NOT RUN. Commit and push the existing draft branch, verify remote head/tree and clean status, and return exact changed files/base/head/tree and unresolved owners for independent PROCESS6.2 review. No merge or completion notice.
