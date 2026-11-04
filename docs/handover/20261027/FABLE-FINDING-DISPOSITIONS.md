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

# Fable finding dispositions — 27 October 2026

**Current authority — user-requested stopping point:** the existing Wave 5 orchestrator `01a17d3b-4cf1-7f21-a8ac-f0aa7cd0380d` now coordinates and finishes the remaining Wave 4 work. Existing Release chat `01a17ae6` remains the sole shared target operator; Hermes Agent app/CLI remains the independent review and acceptance owner. The old Wave 4 root stops product and release work at reviewed source integration. Follow the [Wave 4 to Wave 5 takeover](WAVE4-TO-WAVE5-TAKEOVER.md) for the exact remaining sequence and owner references. Earlier root/Fable assignments below are retained history, not a second active orchestration lane.

This is the canonical summary of the returned scan and recorded author/Hermes evidence. It is documentation-only, not another review or a live acceptance verdict. The detailed root packet is `work/fable-closeout-20261027/FINAL-FABLE-FINDING-DISPOSITIONS.txt`; this summary advances its cutoff to the final source reviews below.

## Count and evidence boundaries

The original [return](FABLE-WAVE4-BUGFIX-HANDOFF.md) contains **33 numbered findings**: seven sharing, four SQL, four actions, four mail, three runtime and eleven Research Portfolio D1–D11. The eleven D findings are already inside33. SH/SQ/AC/MA/RT are the stable author aliases for the corresponding numbered lists in sections5.2–5.6; D1–D11 are the original literal IDs. Fable's native UI prose was unnumbered: it names twelve atomic controls when combined phrases are separated, plus saved-draft Open under MX-02. Its grouped eleven-row handoff table is a useful grouping, not an additional verified defect count.

**Source-reviewed does not mean deployed or accepted.** The full source union, including the final DI-07/S15/S14 read projections, is now reviewed and merged. Meri’s image is built but not deployed. All final-cohort live claims await Release/Hermes receipts; historical 16H has no complete row PASS. Wave 5 now coordinates these remaining obligations; reuse accepted unchanged evidence.

## Exact source and evidence keys

| Key | Exact implementation / retained evidence |
| --- | --- |
| Core-SH | `3dcc8e4248f5a622421200303daa5ecccc4a5113`; client authority, lock/crypto and source admission. |
| Core-RP | `97d9aa727fe126b4d13777ed2086cea60587cab1`; lifecycle/replay/notes/bookmarks/management classification. |
| Core-AC | `04f4ff0d1dcfa18a53a52179419465f9771e0286`; known pre-effect watch refusals. |
| Core-mail | `374a34f6c90fdf7e8ceb793acb2c7993d2fabd12`; folder/message provenance. |
| Core-draft | `5d5a672807f74feec23383583d6cbf0b0dca2471`; canonical saved-draft read/version lineage. Unicode alignment `f7b3c44011196c4228a4a1dc45ae5083c48aadc9`; qualified context occurrence `39e0837eac3f2349b84de96c456664ea43bf27a9`. |
| SQL | `17ef30ba5a6ae34ed51eb089768aff0855dd07ab`, integrated as `fba7ed5d12ad97a6aac3fad8fa42fd27684a2a7c`. |
| Meri-fix / proof | `2f425244c133aa776a82d071a3faeedb351b4756` / `9959d4cf853a30ceb896e180d0c4d032e79b2259`. Merged PR296 `337e54b3ad92bd80eb65eefc72b4245c4f9ff50d`, reviewed tree unchanged. |
| FE-native / evidence-mail | `dbc617dd28bd85ddf76ab7ea312bdb887ccaa3ca` / `b24bd23a35fc68033a8371c9ecc14376628e14c6`. |
| FE-import / comparison | `f31390b372d624d20532d751ef401fbc37aa303e` / `a23e83adea6253db35b939d148b8eb8623b51cf4`. |
| FE-bulk / members / lane | `52d2f3e02fad52b214804a637bd76d8b27a78659` / `4397c3abfd3cd367eccc36eb50fd44245ddf7ac9` / `4482db9f369b78760fb3558720fe9d3015190df7`. |
| Final source | Core merge `8d77e225fe3c16c891190654efeea8050978aaf8` = reviewed `b49f010174de9a2dfaa598f327caf62761138283` / tree `360fe212a3ef699ecb2e5cf7359671ede3d4cf32`; FE merge `d96087ae977465ccaec8e25f728e2a80acb1ebd4` = reviewed `77987943e56c876e4810a320a8209e61bfa340ef` / tree `330e0f1a672a8d0322bad9613624ae9d86495b04` (functional `cbf9d5bc78b8817ca5f91adee870cbe5dceec53c`). Source/architecture and affected author gates PASS. |

Evidence below uses root-workspace-relative paths:

- **B-H:** `work/hermes-review/fable-core-closeout/REVIEW.txt` — source PASS,110 independent affected checks. **B-H2:** `fable-core-final/REVIEW.txt` — qualified-occurrence/Unicode source PASS,58 independent checks. **B-edge:** `fable-core-edge-final/REVIEW.txt` — final routes and pure reviewed integration PASS. Narrow watch/ingress PASS is `fable-core-ingress-watch/REVIEW.txt`.
- **M-H:** `work/hermes-review/fable-meri-closeout/REVIEW.txt` explicitly passes the original behavior fixes but requested a separate schema correction. **M-H2:** `fable-meri-correction/REVIEW.txt` passes that correction with approval/read fences unchanged. **Packages:** `fable-package-binding/LATEST-RESULT.txt` passes exact archive/catalog/immutable14-skill binding.
- **F-H:** `work/hermes-review/fable-frontend-source/LATEST-RESULT.txt` verifies the original typed paths and named fixes, with later corrected ingress/mail findings. **F-H2:** `fable-frontend-followon/REVIEW.txt` passes the bounded follow-on and20 fingerprints. **F-final:** `fable-frontend-final/REVIEW.txt` passes the remaining member/bulk/Changes/recovery/navigation delta and ten final fingerprints. These source reviews did not run independent browser/live acceptance.
- **SQL-H/native:** `work/hermes-review/fable-sql-closeout/{REVIEW.txt,NATIVE-RESULT.txt}` — source adjudication and finite isolated PostgreSQL16.15 timestamp-format proof.
- **Author evidence:** `work/fable-closeout-20261027/CORE-AUTHOR-DISPOSITION-374a34f6c.txt`, `FRONTEND-MEMBERS-AUTHOR-HANDOFF.txt`, `FRONTEND-RETRY-GUARD-AUTHOR-ADDENDUM.txt`, `FINAL-FRONTEND-AUTHOR-GATES.txt`, frontend `docs/handover/20261027/FRONTEND-FABLE-CLOSEOUT.md`, and [Meri author report](MERI-FABLE-CLOSEOUT.md). Final FE author TypeScript, delta lint/format and fixed registry5/5 pass. No repeated broad/browser/build campaign was added.

## All 33 original findings

| ID / original location | Recorded disposition and exact owner | Remaining boundary |
| --- | --- | --- |
| SH1 /5.2#1 | Core-SH checks conversation-selected client before publish and inside revoke lookup; B-H source PASS. | Final live two-client/Meri flow pending. |
| SH2 /5.2#2 | Core-SH rechecks current wall on ordinary revoke; explicit authorized tenant-admin override stays separate; B-H PASS. | Live wall/revoke pending. |
| SH3 /5.2#3 | **Not a defect:** FR-16.33 requires locked links to hide content even from previously unlocked viewers; B-H/root decision. | Temporary lock is not revoke/expiry; live15-minute behavior pending. |
| SH4 /5.2#4 | Core-SH uses shared tenant/portfolio read locks, exclusive per-link PIN counters and async scrypt; B-H source PASS. | Mitigated, not a scale proof. Real PostgreSQL concurrency remains unrun; local address throttle remains process-local defense-in-depth. |
| SH5 /5.2#5 | Core-SH authenticated `lockedUntil` plus FE-native self-expiring display; B-H/F-H explicitly verify. | Public DTO unchanged; final live display pending. |
| SH6 /5.2#6 | FE-native ignores modifier and descendant-control keys; F-H verified-clean, author mounted check. | Independent keyboard/visual acceptance pending. |
| SH7 /5.2#7 | FE-native shared delete/focus owner selects adjacent widget or canvas; F-H verified-clean. | Live assistive-technology/focus acceptance pending. |
| SQ1 /5.3#1 | **Not a defect:** accepted authored-query grain contract exposes dedup warnings/CTE pattern; SQL-H adjudication. No compiler inference engine or blanket join rewrite. | Correct-parent target-data query still required. |
| SQ2 /5.3#2 | Meri-fix denies injected private `readSource` before dispatch; M-H behavior/source PASS. M-H2 closes unrelated schema issue. | Final native private-data path pending. |
| SQ3 /5.3#3 | SQL preserves six-digit UTC text before driver conversion; SQL-H source PASS and native literal probe PASS. | Actual physical type/stored-UTC assumptions and deployed query path remain distinct. |
| SQ4 /5.3#4 | SQL maps42P08/42P18 to sanitized INVALID_QUERY in both owners; SQL-H PASS. | Live malformed-query path pending. |
| AC1 /5.4#1 | Meri-fix preserves effect:none versus UNKNOWN for legislative approvals; M-H independently ran5 legislative tests. | Real owner failure injection pending. |
| AC2 /5.4#2 | Core-AC validates before claim and only proven local not-applied failures become terminal; B-H PASS. | Lost ACK remains unknown; no provider/delivery activation implied. |
| AC3 /5.4#3 | Meri-fix expired replay reads durable completion without a new decision/effect; current identity/scope fences first. M-H approval11/11. | Final runtime crossing pending. |
| AC4 /5.4#4 | Meri-fix shares certainty mapping across LegiWatch/client/business/watch; M-H verified, LegiWatch11/11. | No blanket live-domain acceptance. |
| MA1 /5.5#1 | FE-native visible editable escaped quote; FE-evidence-mail bounds headers/whole excerpt. F-H escaping and F-H2 correction verified. | Exact reviewed body/provider subject rules retained; no hidden append or external send. |
| MA2 /5.5#2 | FE-native compares granted/requested scope sets and exposes missing/reconnect reasons; author regression recorded in reviewed batch. | No separately named independent MA2 test or live reconnect/grant claim. |
| MA3 /5.5#3 | FE-native actual To label; FE-evidence-mail safely guards missing recipient. F-H2 marks addressed. | Existing receiver already rejects empty non-forward To; UI guard is robustness. Live Reply-To send pending. |
| MA4 /5.5#4 | Core-mail returns stored folder/internetMessageId without raw metadata; B-H source/spec PASS. | Historical/provider data completeness pending. |
| RT1 /5.6#1 | Meri-fix retention finally survives throwing skill/session cleanup; M-H source PASS, author10 runner cases. | Final runtime lifecycle acceptance pending. |
| RT2 /5.6#2 | Meri-fix exclusive temporary allocation removes1000-slot failure; M-H source PASS, author Linux rollover. | No pruning/TTL added: retained evidence is deliberate policy, not a claimed disk-quota or post-revocation erasure fix. |
| RT3 /5.6#3 | Meri-fix terminal reason owns timeout classification; historical Core failures remain counters. M-H telemetry9/9. | Production metric behavior pending. |
| D1 /5.7 | Core-RP filters events against all currently denied clients, including unlinked ones; B-H PASS. | Live unlink/wall matrix pending. |
| D2 /5.7 | Core-RP one note transaction owner with actor/content/review/revision replay and archive/access checks; native history GET; B-H PASS. | Real lost-ACK/concurrent notes pending. |
| D3 /5.7 | Core-RP editor for output effects, viewer reads/downloads retained, archived effects refused; B-H PASS. | Actual output/File/object-store and role crossings pending. |
| D4 /5.7 | Core-RP blocks unresolvedInput/disposition inclusion bypass; explicit resolution remains. B-H PASS; FE-members native resolution F-final PASS. | Live populated resolution/races pending. |
| D5 /5.7 | Core-RP refuses new archived snapshots; exact authorized receipt replay stays read-only; B-H PASS. | Live archive/replay pending. |
| D6 /5.7 | Core-RP resume establishes quiet baseline and invalidates old lease fence; B-H PASS. | Two-user/live no-flood delivery pending; delivery remains separately controlled. |
| D7 /5.7 | Core-RP validates canonical bookmark targets, serializes keys, actor/content replay and archive; personal IDs excluded from shared events; B-H PASS. | Undefined `other` targets intentionally unsupported; live personal isolation/concurrency pending. |
| D8 /5.7 | Core-RP canonical classifier plus Meri-fix15 pure management reads before journal; writes/persisted preview retain confirmation. B-H/M-H PASS; Meri-proof/M-H2 closes canonical-advertisement fallback. | Enabled-catalog/live UI/tool parity pending. |
| D9 /5.7 | Core-RP validates tour/mode/member disposition before DB; B-H PASS. | Live malformed-input path pending. |
| D10 /5.7 | FE-native disables archived settings/snapshot/review effects, preserves restore/allowed comments; F-H explicitly verifies, F-final retains gates. | Final live archived controls pending. |
| D11 /5.7 | Core-RP actor/content-bound snapshot/output replay, serialized first writes, inaccessible review404; B-H PASS. | Real transaction races/revocation remain unrun; qualification correction is a separate addendum. |

## Native gaps and recovered screens

All originally unnumbered native controls are implemented at FE-native through existing Core operations: rules, imports/worksheet, operations, output lifecycle, CSV download, Client Files save/Open, bookmarks, review notes, assignment, watch conversion, fit refresh and five-step tour. MX-02 saved-draft Open/edit uses real `artifactId`, Core-draft's authorized read and the existing immutable version writer. It does not manufacture a Workspace document or job identity. F-H verifies native route/DTO/authority; author mounted checks establish local behavior only.

Follow-on source-approved work includes exact contribution/source-basis drilldown and selected supporting/opposing evidence (FE-evidence-mail); compensation-preview same-key recovery (FE-import); saved comparison workbench (FE-comparison); typed member discovery/resolution/bulk and same-scope parent retention (FE-members); per-row review outcomes and retained uncertain request (FE-bulk); URL-owned review lanes (FE-lane); S09–S15 native Research/Coverage/evidence and user-selected S10 Changes composition at the final freeze. Unknown requests are retained in-view, not across browser restart; actual errors or identity changes clear old display. Inputs are blocked during retained pending rereads, including portalled mutations.

Fable's absent `ResearchPortfolioAnalyticsPanel` name was not a missing-route verdict: the actual `ResearchAnalytics` owner was extended with contribution/evidence controls. Source presence does not establish qualified corpus totals, exact stored bytes, compensation correctness or live accessibility.

Finite configuration evidence: Hermes session `20261027_162332_09851d`, `work/hermes-review/final-release-configuration/REVIEW.txt`, SHA256 `8b2e831509a5322791b63ec34063387d49d3b8471e9e3b2e053d11c5c8039f60`, PASS for the frozen Core four-appends/IAM and preserved-edge candidates. It verifies 63/63 input bindings and structural preservation; IAM simulations remain hypothetical. Existing versioned TemplateURL transport is required. Historical object-version context, final image/flag/material composition, target apply/readback and live acceptance are not claimed by that review.

## Required amendment and release boundary

**DI-07/S15 and S14 source complete:** exact existing-data locators, before/after/correction impact and governed Coverage readback are implemented, independently reviewed and merged at the final pins above. Canonical read owners and current authorization are retained. No database/schema/migration/package change, new corpus, graph store, provider command or requalification service was introduced. Missing bytes/locators/denominators remain explicit unavailable states. Wave 5 now coordinates deployment, actual corpus gaps and Hermes acceptance.

Meri337e ARM64 image SHA256 `7eabf413c51ce089d860b1426836cb1904e665e2483c10c5bf2d12a4e672734b` was built once, native runtime probes passed and scan completed with zero findings. **Not deployed.** Final Core/frontend builds/serving state, activated RP registry, installed catalog0.2.23 receipt, effective flags/routes, compatible rollback and Hermes acceptance require actual Release receipts. Earlier migrations remain successful immutable history; none is introduced by this amendment or replayed to refresh proof.

Release has separately verified zero subscriptions/backlog across19 active tenants through the current-membership/RLS boundary. The existing internal-watch flag may be prepared for final Core only if a fresh preflight still shows zero; this is not activation of external email/providers or a claim the flag is already enabled. Wave5 source/package work continues independently, with metadata `98e8a53a` published/checks PASS and the next M5 contracts0.1.22 producer exclusively allocated by root. Immutable Wave4 package/catalog bytes remain unchanged; no unreviewed Wave5 merge/deployment is authorized.

The four original root decisions are settled: use70 recovered rows/full16/MO-05 despite missing historical definitions; full section16 is recovered; FR-16.36 uses qualified public-source admission rather than a private ACL; pure management reads bypass effect approval while persisted previews/writes do not. Q07 stays skipped. The [remaining requirements/evidence](RESEARCH-PORTFOLIO-REQUIREMENTS.md#current-uncovered-behavior-and-evidence) and [historical plus pending release receipt](WAVE-4-HANDOFF.md#2-deployed-components-database-and-recovery) remain authoritative. No Wave4 completion, final-cohort deployment or live acceptance is declared by this document.
