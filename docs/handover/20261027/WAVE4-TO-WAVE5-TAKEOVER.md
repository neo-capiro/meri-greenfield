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

# Wave 4 to Wave 5 takeover - reviewed-source stopping point

27 October 2026, approximately 16:32 UTC. **Wave 4 remains OPEN.** The human requested: "Let's find a stopping point have the wave 5 orchestrator finish your work." Product source is reviewed and merged. Image qualification, final rollout, live/visual acceptance, any resulting fixes and truthful closure now belong to the existing Wave 5 orchestrator. This handoff is not a deployment or acceptance receipt.

## 1. Authority, owners and scope

- Successor orchestrator: **Wave 5**, chat `01a17d3b-4cf1-7f21-a8ac-f0aa7cd0380d`, workspace `C:/Users/Administrator/Documents/Codex/2026-10-27/wave5-orchestrator-20261027`. Coordination/deployment-lock ownership was explicitly transferred in both chats. No further approval from the old root is required for already authorized, reviewed work.
- Sole target operator remains **Release**, chat `01a17ae6-0f6a-73c2-8fe8-3d79c44a3051`, workspace `C:/Users/Administrator/Documents/Codex/2026-10-27/research-sharing-finish-20261027`. Continue this owner and its operations; do not create a duplicate deployment lane.
- **Hermes Agent app/CLI** owns all independent reviews and visual/live acceptance. Codex authors and coordinates. Do not substitute the old Codex chat named Hermes.
- Old root workspace, abbreviated **W** below: `C:/Users/Administrator/Documents/Codex/2026-10-26/wave4-orchestrator-20261026`. All its evidence remains available on this host. Old root is stopping product/release work after publishing this handoff.
- Binding scope: the user-approved recovered 70 Research Portfolio rows, full section 16, MO-05 and remaining in-scope Wave 4 families in `WAVE4-ITEM-INVENTORY.md`. Missing original F01-F42/V4/sections1-15 are provenance, not a fresh blocker. **Q07 semantic remains skipped.** Separate Outreach and future M6/M8/full-Office work are not silently added.
- The user approved Changes' existing owners: Monitored = current client defense watches; Actions = portfolio review queue. Budget/Congressional retain their actual source and filter semantics. Do not reopen this decision.

## 2. Merged source and immutable material

| Component | Merged source | Reviewed source / tree | State at takeover |
| --- | --- | --- | --- |
| Core, backend PR195, base `backend-import` | `8d77e225fe3c16c891190654efeea8050978aaf8` | `b49f010174de9a2dfaa598f327caf62761138283`; identical tree `360fe212a3ef699ecb2e5cf7359671ede3d4cf32` | All finite source reviews PASS; one API build authorized and owned by Release. |
| Frontend PR252, base `main` | `d96087ae977465ccaec8e25f728e2a80acb1ebd4` | `77987943e56c876e4810a320a8209e61bfa340ef`; identical tree `330e0f1a672a8d0322bad9613624ae9d86495b04`; functional source `cbf9d5bc78b8817ca5f91adee870cbe5dceec53c` | Source/package/architecture PASS, final full web typing PASS; image build pending with Release. |
| Meri PR296, base `main` | `337e54b3ad92bd80eb65eefc72b4245c4f9ff50d` | `9959d4cf853a30ceb896e180d0c4d032e79b2259`; identical tree `d631bdf6a3d1b22e6a0a6fa4e30018f49e65f481` | Single ARM64 build and exact-digest scan PASS; not deployed. |

Meri image: `sha256:7eabf413c51ce089d860b1426836cb1904e665e2483c10c5bf2d12a4e672734b`. Reuse it. Release build ID `meri-greenfield-qualification-build:503b054f-d5f7-42d1-b0d0-bf20f2cee291`; exact source/archive/probe/scan receipt is `Release/work/final-wave4-meri-337e54b3/verified-image.json`. Native nonroot/read-only-root/CA/Python/document generation and cleanup probes passed; scan reported zero findings. No repeat build is justified by documentation changes.

Wave 4 material producer is **2f425244c133aa776a82d071a3faeedb351b4756**, distinct from runtime merge337e. Contracts **0.1.21**, archive SHA256 `b93f9b7ed017de6dcb3b3a52b4ff1f06f5933836b69338d4a1a66c6d8e5b79e4`; UI stream **0.1.8**, SHA256 `39451998f9536f17260d393f7c0475d8ec0260f09b55ca50c6b6badbe6319383`; catalog **0.2.23**, canonical SHA256 `1f901f26ec134e1585ff12541c3344fda77da1fb07f599f8d59e9338ecaa6eb6`. Exact package manifest: `W/work/fable-closeout-20261027/meri-2f425244c/package-freeze.json`. Do not repack unchanged artifacts against another source label.

There is **no new schema or migration** in this closeout. The new evidence DTO fields are native-reader projections; internal evidence resolution, frozen sharing payloads and Meri packages remain unchanged. Final architecture gate: 0 errors, 0 blockers, 809 reviewed signals and 18 inherited signals under the existing baseline. No configured GitHub checks/statuses existed at the reviewed PR heads; empty checks were not described as CI PASS.

## 3. Current target and operations to preserve

Authorized target is **portfolio-preview.app.capiro.ai** and the persistent preview clone, never the older production default. Until Release supplies a newer receipt, serving baseline remains Core21, Workspace8, Strategy4, Intel4, Meri control79/worker75/schedule12, AgentCore17 with named preview/default17, and frontend46. Frontend46 source is `d0a5707e`, image `sha256:a655b33ae99649e2bcfc510f8a170afcce766f3f5d1d80ec0d1f6f185c975cb5`; its earlier Overview acceptance remains evidence for that cohort only.

Migration ledger is **700 / 0 unfinished**, with all earlier rows preserved. The final private saved-business migrations already ran. Do not rerun migrations or reset/reclone the database to produce a new receipt. Preserve the existing pre-migration snapshot and rollback definitions.

Release owns the current Core build preparation/submission/collection in `Release/work/final-wave4-core-8d77e225`. Read its live operation record and chat before any submission: an in-progress build is not permission to submit another. Frontend final d960 build is delegated to the same operator. Source/recipe/lock/probe comparison indicated **no additional Workspace/Strategy/Intel build** was needed; only revise that conclusion if actual dependency evidence changes.

Root has not applied the successor images, flags, IAM, material, runtime or edge. A merge/build is not serving. Preserve all current resource/output/environment/secret bindings and record actual new revisions/digests after rollout.

## 4. Remaining rollout, in execution order

1. Collect the existing pinned Core build, run its required probes and exact-digest scan; build frontend d960 once with its existing ARM64 recipe and required checks. Reuse Meri7eab. Keep exact source, tree, image and scan bindings. Do not broaden/repeat unchanged suites.
2. Compose final Core image/configuration from the fresh deployed template, preserving existing resources, outputs, environment and policies. Enable existing `RESEARCH_PORTFOLIO_MERI_TOOLS_ENABLED` with matching final material. Integrate the independently reviewed artifact bucket/prefix and least-privilege version-read/decrypt additions below; no new store or parser/provider initialization.
3. Existing internal watch delivery may be enabled **only if the final fresh read-only inventory still confirms no active subscription backlog**. At16:01, a strict-TLS read-only transaction with verified RLS visibility found 19 active tenants and zero subscriptions. This is not permanent freshness. Preserve reviewed quiet-baseline/lease-fence behavior. Email remains unconfigured; no provider activation or external send. Hermes creates a synthetic subscription through normal UI after deployment; no actor tuple was inferred or fabricated.
4. Apply the preserved preview edge candidate with versioned **TemplateURL** transport; its59,913 bytes exceed inline template-body size. It preserves85 prior resources/14 outputs and adds13 rules, yielding98 resources/14 outputs/87 rules. Keep existing Workspace signing resources and outputs that the old source renderer omits. No blanket prefix or service-only exposure.
5. Install the coherent final Meri catalog/native material through existing owners, preserving all14 original skill trees. Expected selected read set is107, not the old96. Last metadata snapshot had control80 versions/20 labels, worker78/20 and schedule12/13; use existing unpinned-label capacity handling, not raised bounds or discarded accepted reads. Recompute actual bound payload sizes and native installation receipt.
6. Create/observe the actual new AgentCore version READY and bind default/named preview to that version with the coordinated app/worker/schedule deployment. Do not hardcode version17. Deploy frontend final image, verify all affected routes/current authority/material and record the exact healthy cohort.
7. Return exclusive target control to the coordinated Hermes acceptance lanes. No deployment/configuration/DB mutation while their dependent work is active. Final rollout authorization is the human's standing merge/ship instruction and latest takeover; Wave5 now coordinates it, without waiting on the old root.

## 5. Independent reviews and configuration packet

Recent decisive reports under `W/work/hermes-review/`:

- `fable-evidence-coverage-core/REVIEW.txt`: source PASS b49, 64 independent affected tests. Author exact-source typing provenance is separately recorded in `W/work/fable-closeout-20261027/CORE-TYPE-PROVENANCE-b49.txt`; its `@capiro/shared` paths bind this checkout's source, not another linked distribution. Inherited lint tooling was unavailable, not passed.
- `fable-core-edge-final/REVIEW.txt`: final87-rule source/integration PASS96a; earlier watch/ingress `fable-core-ingress-watch/REVIEW.txt` and main/addenda remain reusable.
- `fable-evidence-coverage-frontend/REVIEW.txt` + `APPROVED.json`: consumer and Clear-filters fix PASS cbf; prior whole source/package/architecture evidence is in `fable-frontend-final`, `fable-frontend-followon`, `fable-frontend-source`, `fable-package-binding`. Final integrated full typing log: `W/work/evidence-coverage-consumer-20261027/FINAL-INTEGRATED-TYPESCRIPT.txt`.
- `final-release-configuration/REVIEW.txt`: Hermes session `20261027_162332_09851d`, exit0, PASS, SHA256 `8b2e831509a5322791b63ec34063387d49d3b8471e9e3b2e053d11c5c8039f60`. It verified63/63 frozen inputs, exact four Core appends,14 resources/4 outputs and preserved edge candidate. It did **not** approve an unseen later image/flag/final composition or apply anything.

Configuration entrypoint: `Release/work/coordinated-readiness-96a4-e387/private/extraction-review-01/REVIEW-REQUEST.txt`; manifest `FILES.json` SHA256 `cd5a4b42077e144d904a83e757edadd1d168823d583e9ca7940b24cee845c84e`. Core candidate SHA256 `2c2601eb8468d1105c4a81bc054e1e2da824e63d9d9ecd99e1ec13ee17b190df`; edge candidate SHA256 `88e44e005acc2fe81cfaff5493f6c04a1b709452deebedc2e88e6c8131f35c8f`.

The API currently lacks the artifact binding and read permission. The reviewed addition uses the existing bucket/prefix, `s3:GetObjectVersion` only for that prefix, and exact-key `kms:Decrypt` through regional S3 with the verified bucket-key encryption context. Existing bucket/key policies remain unchanged. Six IAM simulations passed but are hypothetical; historical object-version encryption context and an actual versioned read remain unobserved. Do not broaden IAM speculatively. Preserve private packet/env values; compare them structurally and report safe counts/hashes.

## 6. Hermes acceptance continuation

Use **`W/work/acceptance-readiness-20261027/FINAL-COHORT-CASE-INDEX.txt`** as the current grouped index. It incorporates the new evidence/Coverage fields and piggybacks their checks on the existing native journey. It points to the retained `FINAL-SHARING-CONTINUATION.txt`, `FINAL-SQL-NATIVE-RUNTIME-PROMPT.txt`, `FABLE-CLOSEOUT-ACCEPTANCE-ADDENDUM.txt` and `TWO-LANE-BROWSER-OWNERSHIP-ADDENDUM.txt`. Bind every dispatch to Release's actual final healthy cohort; old operational pins are historical.

All14 section16H rows plus admin/Meri requirements remain accounted for; the earlier attempt had **no fully passed row**. Complete actual publish/open, five wrong PINs/lock, rotation, expiry/revoke/unavailable page, frozen content, client isolation, branding, unlink/archive survival, sharing-off, keyboard designer, canonical source refusal, lost-ack recovery, network/cookie isolation and owner/editor publication. Reuse its supported synthetic fixtures and private PIN; no guessing, logging credentials or sending links externally. Release owns any controlled expired-link fixture; a controlled expiry is not168 hours naturally elapsed.

Existing authenticated Hermes browser/profile is retained under `W/work/hermes-review/auth-readiness/`; `owned-browser-cdp.txt` and the prepared two-lane page-ownership addendum identify it. Prior sharing session is `20261027_040048_29c644`. Confirm actual current session and owned page before use. Do not reset the profile, export cookies/storageState or operate another lane's pages. Keep tenant-admin switch/expiry windows serialized as documented.

Use existing Figma references and actual Playwright screenshots for visual work; capability/auth smoke was already completed and need not be repeated. Inspect images, not merely create screenshots. No Research-specific Figma reference was invented where absent.

**Reuse accepted exact DOCX retrieval/native Word render and native PostgreSQL precision proof.** Do not regenerate/redownload/re-review that DOCX. Piggyback required Meri reads/approval/drafts, native records and SQL crossings on the same small synthetic journeys. All17 MO05 paths need a truthful disposition, not17 redundant model turns. Run focused new or unresolved cases, not a broad campaign of already accepted tests. Source/author evidence is not automatically live PASS.

## 7. Findings, remaining limits and fix discipline

Fable's original table totals **33 findings**, including D1-D11; it is not33 plus11. All original IDs have implementation/review/disposition references in `FABLE-FINDING-DISPOSITIONS.md` and the fuller `W/work/fable-closeout-20261027/FINAL-FABLE-FINDING-DISPOSITIONS.txt`. SH3 required lock behavior and SQ1 authored SQL grain are documented not-a-defect decisions. Actual UI gaps have been implemented against existing owners. Do not revive stale missing-panel claims.

The new native readers expose retained coordinates/offsets, genuine federal before/after sides and tenant-safe recorded Coverage outcomes. They cannot manufacture missing legacy coordinates, an unrecorded general-context predecessor, a universal correction-to-every-portfolio graph, complete corpus denominators, historical source cycles, dated geography or external email delivery. Preserve those exact source/qualification limits and determine their existing owner/disposition; do not claim completeness from a mock, empty UI or unqualified dataset. No new ingestion program, graph, recheck command, store or framework is authorized merely to erase an unavailable label.

For actual acceptance failures: reproduce narrowly, fix the existing owner, have Hermes review the exact correction, then let Release deploy the affected image/configuration only. Avoid unrelated refactoring, repeated broad suites or implementation-mirroring tests. Preserve original failures and corrective evidence. Reopen source/package/gates only when an actual new delta warrants it.

## 8. Worktrees, documents and parallel Wave 5

- Final integration checkouts: `C:/dev/w4-fable-core-closeout-20261027` (reviewedb49), `C:/dev/w4-fable-frontend-closeout-20261027` (reviewed779). Remotes contain the merged commits above; do not reset another checkout or stage ignored/untracked `.qa-*`/Hermes scratch.
- Finite author branches: `C:/dev/w4-evidence-coverage-contracts-20261027` b49 and `C:/dev/w4-evidence-coverage-20261027`4f9. Their source is integrated; no duplicate implementation is needed.
- Canonical documentation continuation: `C:/dev/w4-fable-meri-closeout-20261027`. Its product code remains reviewed9959/merge337e-equivalent; later commits9d7/a1/a058 and the stopping-point update are documentation only. Root publishes them with this takeover file; use the resulting PR/commit in the delivery message, then amend actual release/acceptance facts at final closure. Preserve common four rules, nine-section handoffs, original requirements/source hashes and historical receipts.
- Wave5 already has parallel M5 PDF-reader, M7 existing-session management and MF19 native file-link lanes. M5 metadata98e8a53a passed focused checks; MF19 is PR253. Those candidates are separate from Wave4, not implicitly shipped here.
- Next Wave5 contracts0.1.22/UI-stream0.1.9 are allocated to its coordinated producer after checking no conflicting claim. UI-stream change is required peer/version metadata with runtime/types identity; catalog remains0.2.23 absent an actual new catalog delta. Preserve physical Wave4 archives and serialize package/lock/registry consumers. Do not fold unreviewed Wave5 features into the Wave4 rollout for convenience.

## 9. Immediate successor checklist and completion rule

1. Read this handoff, the latest Release operation record, and the three final source/configuration reviews. Acknowledge ownership in your own working notes; old root is stopping.
2. Continue existing build operations; complete the exact reviewed cohort and final configuration/material composition through Release. Record fresh state and rollback paths. No additional migration is pending.
3. After healthy handback, resume the bounded Hermes acceptance lanes with current pins, owned pages and reused evidence. Close any confirmed bug through the same source-review-release loop.
4. Reconcile every required item to newly observed/reused evidence or a precise remaining dependency. Publish final canonical handoff and update the user in the successor chat. Wave4 is complete only after required rollout and acceptance/dispositions, not because all three PRs are merged.

This is the requested stopping point and ownership transfer. It preserves review/build progress and leaves no duplicate root deployment or browser operation running.
