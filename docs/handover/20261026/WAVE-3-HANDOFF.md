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

# Wave 3 handover — Fable implementation and acceptance continuation

**Continuation handover, 26 October 2026, 17:15 UTC. Wave 3 is not complete.** Fable takes over the remaining implementation, shipping and acceptance. Release and Acceptance have stopped at command boundaries; Integration has published its frozen candidate and returned shared write ownership. No new build, deployment, native fixture, generator or acceptance action is active in those lanes. The current source and release facts below include the final transfer receipts.

Neo now explicitly requests a handover for **Fable to finish Wave 3 implementation AND acceptance, then begin Wave 4 planning**. This supersedes the older blanket statement that Fable has no active role. Root is relinquishing new product/release work after this handoff. Preserve one named Release/cloud operator and one shared-contract writer; coordinate a fresh resume from the freeze rather than competing with a prior owner. This continuation is saved under `docs/handover/20261026/WAVE-3-HANDOFF.md` on branch `codex/wave2-handoff-20261025-docs`; the accompanying `WAVE-4-PLAN.md` starts planning only. **Onboarding is explicitly excluded from Wave 3 closeout** and deferred until the rest of the project is live.

**First actions:** (1) ship the already-accepted isolated frontend `0cba013e` for #226/#227; (2) review/merge Meri combined `7a09fe96`, qualify the replacement contracts archive and repaired native feedback; (3) compose accepted frontend #222/#225 and deploy the coherent remaining backend/frontend set; (4) run the focused acceptance in §4, including reading connected email from Meri. The exact release commands and operator caveat are in §9. Onboarding is excluded.

## 0. Continuation receipts — Fable, 26 October 2026 (17:40–19:30 UTC)

**Wave 3 is still not complete.** Fable accepted the transfer and acted as receiving lead, merger and the single cloud operator from its own host (the Release/Integration/Acceptance evidence roots on EC2AMAZ-M7CDRPT were not reachable; every receipt below was produced and read back from AWS/GitHub directly and lives under Fable's session scratchpad `accept/` plus the kits named here). Later sections keep the 17:15 UTC transfer facts; where this section differs, it is newer.

### 0.1 Shipped (live, read back)

| Component | Was | Now | Source | Receipt |
| --- | --- | --- | --- | --- |
| Frontend (step 1) | frontend36 (`eac57c19`) | `capiro-portfolio-preview:37`, 17:52 UTC | isolated `0cba013e` (#224 + #226 + #227) | kit `C:/dev/fable/ship-fe-0cba013e` (S3 version `PNIu8rOaVR8Mr6tvUeCTTYWUgF8LaHj5`, CodeBuild `a7777413`, image `sha256:2a2e2aa7…`, scan 0 findings, change set `fable-fe-w3-preview-224-226-227-0cba013e`, 08-verify VERIFIED) |
| Frontend (step 3) | :37 | **`capiro-portfolio-preview:38`**, 19:08 UTC | `main` **`a9639de2`** = PR233 merge (FE222 + FE225 + replacement contracts archive) on `a5cfde83` (#220/#223/#226 already on main) | kit `C:/dev/fable/ship-fe-a9639de2` (serving 0cba013e's content proven carried by `a5cfde83`/`9131adee`; S3 version `SWh53xDk…`, CodeBuild `d033e49c`, image `sha256:4191aca5…`, scan 0, change set `fable-fe-w3-fe222-225-contracts-a9639de2`, 08-verify VERIFIED, public /healthz 200) |
| Core API | Core17 (`9e8108b9`) | **`capiro-preview-first-chat-core:18`**, 18:07 UTC | `4d88a93f` (Core174/175/176/177/178/179 merged) | Release's verified `inputs/core-4d88a93f….zip` (S3 version `YT2B6T1U…`, 6713/6713 members byte- and blob-verified against the Git tree); project `capiro-preview-first-chat-core-build` repinned (APPROVED_*), build `1c54c3fd`, image `sha256:295ba12f…`, scan 0; new revision = :17 with image + RELEASE_SHA only; both target groups healthy |
| api-strategy | :2 (`8f4d7fb4`) | **`capiro-preview-api-strategy:3`**, 18:19 UTC | `4d88a93f` | Release's verified `inputs/wave3-supporting-4d88a93f….zip` (1878/1878), build `df5f0b54` with the a93bd46e inline recipe, tag `wave2-4d88a93f…-arm64`, scan 0; both target groups healthy |
| Core task role | no Bedrock permission | **`CapiroPreviewMeriTitanEmbeddingInvoke`** (bedrock:InvokeModel on `arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0` only) | — | change set `fable-core-titan-embedding-grant-20261026` on `Capiro-Preview-First-Chat-Core`, one `Add` resource, UPDATE_COMPLETE 18:05 UTC; the reviewed "Titan-only task-role grant" the memory readback needs |
| intel-api | :2 (`310b9413`) | **`capiro-preview-intel-api:3`**, 19:05 UTC | `1d7b54e1` (4d88a93f + ffmpeg pin/probe fixes PR181/PR182) | archive `inputs/wave3-supporting-1d7b54e1….zip` (S3 version `CA8HfM9a…`, 1878 manifest files, SOURCE_GIT_BYTES_PASS), build `cd0805e6`, image `sha256:adf3ac46…`, scan 0; new revision = :2 with image + RELEASE_SHA + GIT_SHA only; both target groups healthy |
| Workspace, Meri (control/worker/schedule/AgentCore) | unchanged | unchanged | — | see 0.3 |

Rollback provenance: frontend37 image `sha256:2a2e2aa7…` and frontend36 `sha256:f7461a57…` (change set with the recorded :37/:36 parameters; CloudFormation deregisters the superseded frontend revisions), Core17 `sha256:a7ea6273…`, api-strategy:2 `sha256:cd69ce4f…`, intel-api:2 `sha256:65187e55…` (UpdateService back to the recorded revision; the plain ECS services keep their old revisions).

### 0.2 Merged source

| Repository | Change | Head |
| --- | --- | --- |
| meri-greenfield | PR280 updated to the combined candidate `7a09fe96` + one provenance fix (`generate-lifecycle.mjs` had not been re-run after the conversation-application regeneration: `Generated drift: conversation-lifecycle.metadata.json`), reviewed and merged | `main` **`4f6dd062`**, tree `77d8c8a6` |
| capiro-backend | PR181: `apps/intel-api/Dockerfile.alpine` ffmpeg pin 8.1.2-r0 → 8.1.3-r0 (Alpine 3.24 aarch64 no longer serves 8.1.2-r0; the 4d88 intel-api build failed in the runtime stage). PR182: `scripts/qualification/alpine-service-probe.cjs` expects ffmpeg/ffprobe 8.1.3. Between them `66c7503d` (ML21 "reject oversized provider payloads before the sending transition", `4b96389c` merge) reached `backend-import` from another author outside this continuation; it is in the tree the intel image was built from but not in that image's file set, and it is NOT in the live Core :18 (`4d88a93f`). | `backend-import` **`1d7b54e1`** |
| capiro-frontend | PR233: FE222 `6d7ad74a` + FE225 `35662e27` composed onto `a5cfde83` (no overlap, clean 3-way) with the replacement contracts archive | `main` **`a9639de2`**, shipped as frontend38 |

Review evidence for PR280's generated part: fresh checkout, root and `packages/contracts` `npm ci`; the catalog pin lets the control suite that imports it load (`feedback.test.mjs` 11/11, `feedback-jsonb.test.mjs` 1/1; on main it stops at `SKILL_CATALOG_PIN`); `generate*.mjs --check` passes for the four refreshed families; contracts `typecheck` clean; `test:public` 647 (one `npm pack` collision flake, 7/7 on rerun).

### 0.3 Prepared, not shipped, or blocked

- **Replacement contracts archive:** `capiro-meri-contracts-0.1.15-4f6dd062-2fa661f28d6b.tgz`, sha256 `2fa661f28d6bffec2d3b197f8d6afc95d53e89504053d5d6a3f9ba1de8d941e1`, 69 members = every `packages/contracts/generate*.mjs` run at tree `77d8c8a6`, then `npm pack` — the d1e1c50b archive's recipe (its regenerated `conversation-sources.d.ts/.mjs` reproduce d1e1c50b byte for byte, `e189e614…`/`5a1cf815…`). A pack of the *tracked* dist (`4fad288e…`) was rejected: it lacks the hearing exports FE222 imports, because the tracked dist on main is stale (see 0.5).
- **Meri image for `4f6dd062`:** NOT BUILT. Meri277 (hearing producer), 278 (feedback), 279 (connected reads) and 280 are all absent from the live `cc8a6d9f` image, so the FE222/FE225 UI paths show their unavailable states until it ships. Prerequisite unchanged: Release's repaired native feedback gate (`feedback-native-owned-v4.test.mjs`) exists only on the Release host and was NOT RUN here. The catalog/package inputs for the image are now on `main`.
- **intel-api: SHIPPED after two source fixes** — `capiro-preview-intel-api:2` (`310b9413`) → **`:3`**, source `backend-import` **`1d7b54e1`** (= `4d88a93f` + PR181 ffmpeg pin 8.1.3-r0 + PR182 probe expectation 8.1.3 + an ML21 mail change `66c7503d` that another author pushed to `backend-import` meanwhile and that touches none of the 1878 supporting-archive paths), build `cd0805e6`, tag `wave2-1d7b54e1…-arm64`, scan 0 findings, new revision = :2 with image + RELEASE_SHA/GIT_SHA only, both target groups healthy. Earlier attempts and their causes: 4d88 `apk` could not select `ffmpeg=8.1.2-r0` (Alpine serves 8.1.3-r0); `5934a362` failed the Dockerfile probe twice — first EACCES on `/qualification/alpine-service-probe.cjs` from a mode-less zip generated here (fixed: archive members carry Git modes), then `ERR_ASSERTION … /^ffmpeg version 8\.1\.2/` from the probe itself (PR182). The archive generator is `accept/core4d88/intel-rebuild.py`; each archive version got its own exact `s3:GetObjectVersion` statement on the build role.
- **Frontend composition (PR233):** typecheck clean, lint 0 errors, 14 affected unit files 342/342, hearing browser spec 6/6, feedback browser spec 10/10 FAIL **identically at FE225's own accepted head** (harness renders the "Session boundary test" shell with the Capiro boundary alert; same class as `routines.spec.ts` on main), `scripts/architecture.mjs` exit 1 on main too (115 blocking size findings → 120 with FE225's five >80-line functions, no `errors`), `scripts/public-packages.mjs` fails on main too (its rule rejects the content-addressed ui-stream file name). Merged (`a9639de2`) and shipped as frontend38 (0.1). Hearing and feedback UI paths are live but their Meri producers are not, so they show unavailable states until the Meri image ships.
- **Build-role policy:** `capiro-codebuild-role` inline `CapiroWave2SupportingSourceAndEvidence` grants `s3:GetObjectVersion` only for exact key + VersionId pairs. Statements added: `ReadExactSupporting4d88SourceVersion` / `WriteExactSupporting4d88BuildEvidence`, and the `5934a362` pair(s) for the intel rebuild. Without them the supporting gate fails `AccessDenied` on GetObject.

### 0.4 Acceptance rows added (live tuple frontend37 / Core18 / strategy3 / Meri cc8a6d9f, Neo's authenticated Chrome)

| Result | Observation | Owner / next |
| --- | --- | --- |
| **PASS** | General stored-mail read: fresh General conversation, one turn asking for the three most recent mailbox messages; completed with three dated rows and the source marked *partial* (counts only here; subjects stay private). The Wave 2 `mail_list_messages ACCESS_DENIED` is not reproduced on this tuple. | closed for this tuple |
| **PASS** | "Prepared actions could not be read right now" is gone: both the General home and the conversation show the intents list ("Meri has not prepared any actions…"). | closed for this tuple |
| **FAIL / UNKNOWN, no replay** | Follow-up turn in the same conversation: after the completed first turn, the next submission ended in "This tab could not safely save or recover the message" and the page flipped to "Conversation access unavailable"; "Check access again" restored the saved history and no second run was started. A new conversation's first turn (personal-memory recall) ended "Delivery is uncertain. Retry sends exactly the same request"; one retry, same result; no duplicate. Browser saw interleaved 503s on `/api/conversations/{transcript,summaries,list,history,intents/list}` and `/api/action-followthrough/session`; prod-ALB control target group recorded 5xx again (5 in the 18:44 UTC minute; overnight floor ≈95–105/hour at ≈290 requests/hour, 1–158/hour after 09:00 UTC). Cause remains in the live control image, which is unchanged by this continuation. | Meri control/Runtime owner; needs the `4f6dd062` Meri image plus control-side request telemetry |
| **NOT RUN (request accepted, still Queued)** | Personal-memory runtime readback: after frontend38 the same conversation shows the request as accepted by control ("Meri — Queued — Meri is working on this request") but it had not left Queued ~25 minutes after submission; no completion, no result, no duplicate. Core178 + the Titan grant are live and unexercised. Stop check: two attempts, the first long turn completed before Stop appeared, the second was held by the save failure. | Meri control/Runtime owner (queued-run progress); retry both when a turn completes on the repaired tuple |
| **NOT RUN** | FE226 held/403/404 retry suppression (needs a failing backend to observe), FE227 prepared-DOCX open (no prepared draft exists in the checked conversations; "No published files or prepared drafts"), hearing viewer and feedback readback (Meri producers not live), saved-bill sequential read. | after the Meri image |
| **Budget** | Claude Sonnet 4.6 (Bedrock Edition) usage October to date $4.34 (fully credited; $0.27 on 26 Oct before this session), far below the $25 project limit; the account's "Amazon Bedrock" $70.65 is qwen/kimi/Titan usage from other agents. Three model turns were started here (one completed). | — |

### 0.5 Findings for owners (not fixed here)

1. **Contracts tracked dist is stale on meri-greenfield `main`.** After the catalog pin repair, `generate-*.mjs --check` fails for conversation-history, -session, -sources, -usage, intents-application, task-command-application and user-preferences-application; `npm run check --prefix packages/contracts` cannot pass on `main`. Regenerating everything is what the physical package does, and the regenerated tree fails the package's own `typecheck` (`test/conversation-history-public-types.ts`: the public history event union lacks `Canonical_NativeHearingSourceEvent`/`NativeBillTextSourceEvent`) and 5–6 `test:public` cases — already true at `d1e1c50b`, i.e. before this continuation. Control runs the tracked (stale) dist while the frontend consumes the regenerated package. Owner: contracts/hearing source owner; fix = regenerate and commit the dist together with the public-type union, then re-pack.
2. **Live control 5xx and lost acknowledgements** (0.4). The `4f6dd062` Meri source (events/observe reduction 257, current-read refresh 256, mechanism retirement 258) is merged but not built; the native feedback gate on the Release host is the only remaining prerequisite named in §3.
3. **Frontend browser harness drift** on `main`: `routines.spec.ts` (5/5), `selected-lifecycle.spec.ts` (10/10) and now `meri-feedback.spec.ts` (10/10) fail on the harness shell before the component mounts. `scripts/architecture.mjs` (115 blocking size findings) and `scripts/public-packages.mjs` (ui-stream name rule) are red on `main`. None of these is run by the committed frontend build recipe.
4. **Alpine pins drift** in `apps/*/Dockerfile.alpine` (ffmpeg today; chromium=155.0.8059.84-r0 in api-strategy is the next candidate). Pin bumps need a fresh supporting archive, policy statement and build.

### 0.6 Next actions (receiving lead, in order)

1. Run the native feedback gate on the final Meri source (Release host, v4 fixture), then build/scan/deploy the Meri image for `4f6dd062` (control/worker/schedule + AgentCore runtime) with `CapiroPreviewMeriContractPackageVersion`/`CapiroPreviewMeriRuntimeSource` refreshed on the frontend stack.
2. Decide with Neo whether the ML21 mail change that reached `backend-import` outside this continuation (`66c7503d`) is reviewed for the next Core image; Core :18 does not contain it.
3. Re-run the §4/0.4 live rows on the complete tuple: follow-up turn, Stop, personal-memory readback, hearing viewer, feedback readback, prepared DOCX.
4. Contracts dist/public-type repair (0.5.1) before the next package; then close Wave 3 with the completion disposition (all nine sections) and start the Wave 4 streams in `WAVE-4-PLAN.md`.

Local evidence roots used below:

| Name | Absolute path |
| --- | --- |
| Root | `C:/Users/Administrator/Documents/Codex/2026-10-26/wave3-orchestrator-20261026` |
| Release | `C:/Users/Administrator/Documents/Codex/2026-10-25/wave2-visible-release` |
| Integration | `C:/Users/Administrator/Documents/Codex/2026-10-25/wave2-visible-integration` |
| Acceptance | `C:/Users/Administrator/Documents/Codex/2026-10-25/wave2-visible-acceptance` |
| Ordinary | `C:/Users/Administrator/Documents/Codex/2026-10-25/wave3-ordinary-atomic-save` |
| IndependentReview | `C:/Users/Administrator/Documents/Codex/2026-10-25/wave3-hermes-independent-review` |
| Canonical plans | `C:/dev/wave2-handoff-20261025-docs/docs/handover/20261022` |
| Prior committed handoff repository | `C:/dev/wave2-handoff-20261025-docs` |

## 1. Stopping point and changes since the last handoff

The latest recorded healthy deployed cohort is Core17 / Workspace6 / Meri Control74–Worker70–Schedule7 / AgentCore11 with named preview11 READY / frontend36. Frontend PR224 is **fully complete for its allocated scope**: merged, shipped and accepted live. PR226 is now **merged**, with both main and isolated preview compositions independently accepted. It is **NOT SHIPPED**. The immediate isolated preview source also includes accepted DOCX227; main226 additionally contains later220/223 and must not be shipped alone against old Core. Release prepared the4106-file preview archive but did not upload/submit/build it. New submissions are held for Fable pickup.

Root records96 accepted merges at the final transfer cutoff. Completed source includes the Workspace/Hill Day/newsletter/library/collaboration/template slices, durable generation/export/save recovery, native source/usage receivers, Teams/approved-connector reads, Watch and feedback producers. Source completion is not full ticket acceptance: the specific remaining live paths and release prerequisites are listed in §4 and §9.

Core178's personal-memory JSON boundary fix and Core179's Tracker/PE correction are merged. Four distinct Core174 Watch cases and Core179 Tracker/PE's four cases now pass on merged Core4d88; Watch's original fixture failure and affected two-case rerun remain separate evidence. Meri280's one-line JSONB feedback fix is independently source-accepted, with one failing actual-driver regression before and3 focused passes after. Integration published the combined source/catalog candidate7a09fe96; generated-delta review remains pending, as do final merge, replacement physical package and repaired native feedback run.

During transfer, Root merged the accepted PR226 and Integration published the already-frozen Meri candidate for portable pickup. No new product implementation, image build, deployment or model call was started. Final source references, generated-candidate publication and stopped operator state were checked.

## 2. Live components, candidate pins, database and snapshots

**Live source pins, not current repository heads:**

| Component | Recorded live revision | Source commit | Source tree | Qualified image digest |
| --- | --- | --- | --- | --- |
| Core API | Core17 | `9e8108b97b22307bd30278ff351f9837b32ca069` | `6abfcc97013288f17b25b56ff4214906e01a7ddc` | `sha256:a7ea6273168d89ce34cd38b6175e8e36efd3ff553ccd5fa65bffba070fc5f1e3` |
| Workspace | Workspace6 | `9e8108b97b22307bd30278ff351f9837b32ca069` | `6abfcc97013288f17b25b56ff4214906e01a7ddc` | `sha256:6169a1aeff2112fd590f76aa6b9420abdbb6413a4b817a4e62458e9c03dbaefa` |
| Meri | Control74 / Worker70 / Schedule7; AgentCore11 / preview11 READY | `cc8a6d9fce95e235fee15c1c6a524a611fba3912` | `4c6a21af0ad8cdb3396bd1837eb0b8d0d83ef6c7` | `sha256:b64236c331c9d1bbafc110f79714c74c2619ed72c2f73d59fccbda523e76cc6e` |
| Frontend | frontend36; desired/running1, matching healthy ALB target | `eac57c192299f1615c7bbd4d55a3656289abe7be` | `d80d515deb148ec3855bcac59d6cbfe6bb59501d` | `sha256:f7461a570e8d3dc5322d15177ebcf401815b16f1c63990e69384a19d21434e72` |

These image receipts are retained under Release `work/release-20261025/{core9e8108b9,workspace9e8108b9,meri-cc8a6d9f,frontend-eac57c19}/verified-image.json`. Their build-time `deployed:false` is historical; Root's later live receipt establishes the deployed revisions. Image smoke/scan alone is not authenticated acceptance. The current cohort reuses qualified Shared88. Do not substitute a new raw repository `dist` tree for the physical package.

**Merged source at the recorded cutoff:**

| Repository / target | Accepted head | Tree |
| --- | --- | --- |
| `neo-capiro/capiro-backend`, backend-import | `4d88a93f75f5b51b2a8caa980d11b27442f0b882` | `9bde4ccf3970a357065847f58347404b5dd2e45c` |
| `neo-capiro/capiro-frontend`, main | `a5cfde83c82e247c6552b8866229b5c3fe3adeb3` | `069427aae2e6da37078b99cc66369dacab8ccae9` |
| `neo-capiro/meri-greenfield`, main | `6ac9775091997d62ffbc381486783e8c1184b1ac` | `54a93960b100012ac81f3588b2893575f221f4de` |

These heads include changes beyond the live cohort. Use the published handoff and remote exact refs before composition; some narrow tracking refs have been stale. Do not reset another owner's checkout.

Latest authoritative live-health paths are Release `work/release-20261025/private/shipmentcc8a6d9f/final/healthy-cohort.json` and `private/shipment-eac57c19/frontend/health-verified.json`; the former's frontend35 is superseded by the latter's frontend36. Reference these private receipts without publishing embedded identifiers. Existing Intel/Strategy task2 baseline digests are in `next-cohort-20261026/later-intel-strategy/summary.json`; new4d88 sources are uploaded but builds and IAM/project deltas are unsubmitted/unapplied. No Workspace rebuild is allocated.

The persistent `capiro-newstack-preview-clone`, existing database services/volumes, authentication configuration and reusable WSL `Codex-Gates` environment must be preserved. Core/Workspace's9e8108 source does not introduce a fresh schema over the previously qualified deployment; Release owns the actual ledger/snapshot receipts. Never infer that all historical migration checksums are reconciled: existing unexplained/CRLF differences were preserved, not waived by disposable native gates. Onboarding's already-dispatched migration completed exit0 before the user's exclusion; its retained snapshot/log and absent postflight/backfill verification are documented in Root `outputs/W3-ONBOARD-DEFERRAL-RECORD.md`. No Onboard rollout or email action occurred, and no further Onboard operation is part of this continuation.

Keep frontend35 and the prior coherent Core16/dd43242–Workspace5/2b6d00cd–Meri73/69/6/0a0869ce–AgentCore10–frontend34/f855ef7d receipts as rollback provenance. Release must verify actual retained references and schema compatibility before any rollback; use the established Release procedure for any required rollback; no cleanup or rollback is needed merely to accept this handover.

## 3. Source integration, open PRs, review and gates

This map identifies implementation and its qualification boundary. PR numbers include original author/evidence lineage as well as merged compositions; an author PR may remain unmerged when its source was composed elsewhere. The exact accepted repository heads above are authoritative. No row implies its entire live ticket has passed.

| Scope | Implemented / merged evidence to reuse | Remaining boundary |
| --- | --- | --- |
| WS08 / ML24 collaborators | FE189; existing collaborator, notification and invitation-email owners; Core152 native7/7 | Current scoped invitation/status/cancel acceptance; no external send authorization |
| WS10 Hill Day jobs | Core143 author source composed/merged through Core147; FE183; native25/25, durable start/reload/retry/cancel with UNKNOWN fences | Deployed exact job lifetime/provider-uncertainty flow, only with an allocated fixture |
| WS11 editing / Directory / meeting facts | FE193/194 first-page/rename, FE197 Directory picker, FE200 facts; Core157/158 preserve current IDs, stale-ID refusal and stored instants | Remaining named live editing paths; held AI refine/regenerate stays with qualified later owner |
| WS12 export | Core150 request-bound retained export bytes, native8/8; FE188 recovery and Figma presentation | Exact lost-ACK/reload/current-access and real PDF/signer acceptance |
| WS13 ordinary/basic save and stage | Core144/native6/6; FE179 atomic consumer/distribution and FE186 staging presentation | Fresh ordinary Save/reopen/full reload PASS; do not reinterpret two earlier UNKNOWN submissions as completed |
| WS14 basic fidelity | FE211; basic design/date/projection and explicit rich conversion | Reuse accepted focused evidence; no full M5 renderer claim |
| WS15 rich create/save/recovery | Core153/native11/11 and154 receiving; FE198, saved preview FE187 | Rich creation/save/reload/preview PASS; preserve exact pending-input/revision recovery and no redispatch |
| WS16 content/library/brand/survey | FE201 sections,206 templates,209 brand/survey,214 controls; actual public receivers Core154/162/163/164 | Saved-section reuse PASS; preserve other recorded source/mounted evidence without declaring every provider or library path live-tested |
| WS17 collaboration | Core156/167 public shapes; FE202 known-ID review and FE213 sharing/comments | Current role/denial/reload and specific mail-status checks as named; O143 removes approval workflow |
| WS18 assets / optional tools | FE203 picker,207 management,217 optional tools; Core165 receivers | Manual editor remains canonical; configured-unavailable tools are not provider successes |
| WS19 Engagement newsletter | Core169 intent/readback, FE192 stage/open and216 deliberate prepare/test/send/status consumer | Preserve prepared/version/current-access binding and uncertainty; no live external send occurred or is authorized here |
| WS20 campaign templates | FE219 paging/history and220 exact-version publication/recovery; Core173 | Later release must pair accepted Core/FE; retain pending request identity and destination-client checks |
| WS21 document Blueprint/theme/brand | Core166 and FE208/218; three native concurrency cases PASS | Distinct from campaign templates; final paired source/live controls, not a publisher-role redesign |
| M2 recovery/context/indexing | FE184 and accepted recovery producer; PF02/MF19, MG05, MG02 fourteen-skill lifecycle and MG06 durability reconciled in existing owners | Do not commission another census or rebuild their owners; qualify only a concrete remaining user path |
| MF16 sources/usage | FE185/196/212; hearing public producer277 and media175; source-bound readback and truthful SDK usage; Runtime's bill trace is closed | Public bill turn had real tool/usage evidence but no native viewer; next is an explicitly allocated sequential read, not a renewed trace. Hearing player222 accepted, not yet integrated/shipped |
| MO14 Watch / native feedback | Core174 and FE223 merged; native Watch4/4. Meri278 merged; FE225 accepted; Meri280 source correction accepted | Watch paired release/live check; feedback correction/catalog/package/native/composition sequence below |
| MO15 connected reads | Core176 Teams and177 approved-connector owner, Meri279 bridge merged; FE205 metadata | Actual content/provider permission availability unqualified; no scope expansion or invented successful adapters |
| ML24 Tracker / PE | Core179 merged; 61 focused passes, affected types0, native4/4 | Release current Core/API-Strategy/Intel images; separate legacy workers remain distinct, no sends/schedule activation |
| User Directory fixes | FE224 complete; FE226 source/Figma ACCEPT | Ship226, then verify only its affected unavailable/retry path; preserve224 live PASS |
| DOCX prepared-file viewing | FE227 merged; nine browser and68 focused unit checks retained | Immediate preview includes it; real saved prepared draft opening still needs live qualification, not a fabricated SDK artifact |

Current frozen successors:

| Candidate | Exact head / tree | Required continuation |
| --- | --- | --- |
| FE226 main composition | Accepted candidate `6825971ece85b86419e9b0be4ad0c98be9aac739`; actual merge `a5cfde83c82e247c6552b8866229b5c3fe3adeb3`, tree `069427aae2e6da37078b99cc66369dacab8ccae9` | Root composition ACCEPT and fresh-fetch merge verified. Main includes later220/223; immediate shipment must use isolated0cba |
| Immediate preview224+226+227 | `0cba013e707c5cf28fa7ceabc9e017ed773db3bd` / `c44e7a2e6d79de386fb12228a7d1a149dac2e5f1` | Published `codex/w3-preview-224-226-227-20261026`, based liveeac57; four226 and nine227 exact postimages, prior registry retained, package inputs unchanged; Release's priority image/shipment |
| Meri280 JSONB fix | `9e5804b2ededf9d2c9a864cbdb73cd5423b29b6a` / `92e20e87239e0d3ef636ded678a4da9164f772f3` | Source ACCEPT, based6ac97750; three paths, no contracts/schema/UI change; integrate only with accepted catalog repair |
| Meri generated catalog repair +280 composition | Published `7a09fe96df16db6db1d4e8e5f0136b35ea65cd1d` / `867c0515bfc8a134f249eece84232312bf21306d`, branch `codex/w3-meri280-integration-20261026`, base6ac | Remote confirmed;14 paths =3 accepted280 source/test +11 generated/index paths. Generated review pending. Parent repairb11c/2bb2 preserves14 skills/15 versions. All12 runtime/type/schema outputs equal the qualifiedd1e archive; six stale tracked outputs now match it, four metadata files change. No new semantic receiver change inferred |
| FE222 hearing player | Author `cc894467456ed7cb0fa0a8caf3c03d4d419ec658` / `ebe74a768edeff521d955239d65b76edac2df3d2`; Integration candidate `6d7ad74a9e529bbb616a2d5f046d00e96ef595b5` / `804c05be7a2460a2c5f41a8a7bb66c4d39a28950` | Independent source/physical-package/Figma ACCEPT. Final composition/package pin after priority226 and replacement archive; candidate is not merged/live |
| FE225 feedback consumer | Open draft at `35662e27bb0cf78b61c578a05cdd2ecdf41457c5`, tree `d260f27a7549e81b22914528f601afec9774816b`; independent ACCEPT | No fresh implementation inferred. Compose after replacement physical package, retaining exact reviewed source |

Use Integration `outputs/W3-FE226-CANDIDATE.json`, `W3-PREVIEW-224-226-227-CANDIDATE.json`, `W3-FE222-CANDIDATE.json`, and `W3-MERI280-CANDIDATE.json`. The full frozen integration pickup is `outputs/W3-INTEGRATION-FABLE-HANDOFF-20261026.md`. Root's `W3-FE226-CORRECTION-REVIEW.md`, `W3-MO14-PR280-INDEPENDENT-REVIEW.md`, `W3-ML24-PR179-INDEPENDENT-REVIEW.md` and exact size-record files preserve review scope. Do not rerun passing suites solely because of mechanical composition; check actual source equality/union and newly changed behavior.

The qualifiedd1e public archive is Release `work/release-20261025/w3-feedback-d1e1c50b/distribution/artifacts/capiro-meri-contracts-0.1.15.tgz`, SHA256 `abff4f22e6d81bcbe8277cb2bd0c61fe90341edd3d67dd152d9e4a6c2f98e4f8`. It supports retained consumer evidence but is not the replacement package. Full raw tracked69-file dist has pre-existing differences and must not be relabeled as that qualified physical artifact. Release owns one canonical generation/pack for the chosen integrated source; Integration then adopts exact immutable pins once.

The frozen catalog correction sets `packages/skills/assets.json.catalogSha256` to `41aed2fc63dc40cafe987ee3059a13b605b7d3796c31f60ed6ca26939954bfcc`; the 15-version/14-skill rows remain exact (row-array SHA256 `d5b5c48d6a1182834bf554703c30f0fbb009641426f99a093c90372bc40390f5`). Retained generator receipts cover `generate-conversations.mjs`, `generate-input.mjs`, `generate-initial-input.mjs` and `generate-document-access.mjs` under `packages/contracts/`. Review the actual eleven-path delta and retained comparisons; do not repeat unchanged generation merely to recreate the receipts. After acceptance, update the existing PR280 to the reviewed combined candidate, merge with the expected head, and verify the actual merged tree before packing.

## 4. Acceptance rows: PASS / FAIL / NOT RUN

| Result | Existing observation / limit | Next owner action |
| --- | --- | --- |
| PASS | PR224 live Senate filtering, page2, keyboard Clear all→Any/page1, two-line cells on frontend36; Figma1064:239919. Source-identical390px capture reused because IAB cannot resize | Closed allocated224 scope; inherited622px shell/table overflow stays documented |
| PASS | Rich newsletter creation, exact save/reload, saved preview and section reuse; ordinary fresh Save/reopen/full reload preserves title, subject, preview, body and client | Reuse; do not replay older uncertain writes |
| UNKNOWN, retained | Two original submissions not joined to terminal outcomes; bounded14:52 investigation closed without root-cause proof | Keep fences/history; no redispatch or invented receipt |
| PASS | Stop→USER_CANCELLED/Ready; successful following turn; personal-memory proposal/approval persists after full reload. Five phaseB submissions are terminal | Reuse within recorded scope; no complete SDK custody/performance claim inferred |
| FAIL, repair merged; live NOT RUN | Runtime personal-memory read ACCESS_DENIED, one Core403 in exact window. Embedding failure had lexical fallback and was not itself proven denial cause; Core178 actual projector regression red then10 affected green | Deploy accepted Core fix and reviewed Titan-only task-role grant, then one specifically allocated readback |
| NOT EVIDENCED | Successful post-fix General stored-mail read. Meri271 merged as d2bb4b25 and verified ancestor of livecc8; stale Microsoft sync does not prove stored mail unreadable | Existing stored-mail read through current Core owner; distinguish result/empty/unavailable/denied/malformed, no send/reply/forward |
| FAIL / NOT RUN | DOCX turn created no SDK-published file. FE227 opens existing Core prepared-draft evidence, not a new artifact claim; actual live open remains unrun | After immediate FE shipment, open the actual prepared result through current authority and verify downloadable bytes |
| PARTIAL / NOT RUN | Public bill read produced actual tool usage but no native source viewer; SDK positive cost is an estimate, not total billed cost; Runtime trace closed | Budget reconciliation and a finite explicit sequential-read allocation, then current-access saved-source view/reload; no renewed trace or automatic model repeat |
| PASS, bounded | Actual Meri image generated one workbook and a four-slide deck; native reader recalculated2050/4100 and visual slides passed, originals retained | No full M5 renderer/preview/runtime custody or benchmark completion claim |
| PASS, native | Core174 four distinct cases: two initial PASS plus two corrected lock/drift checks PASS; Core179 ML244/4 in first native run on merged4d88. No providers, sends or protected DB contact | Reuse; initial Watch missing-tenant-GUC fixture failure and affected rerun remain separate. Release image/deployment checks still required |
| FAIL then source PASS; native NOT RUN | Feedback initial native fixture clock/deadline failure; separate JS-array→JSONB defect proven. Meri280 direct regression red then3 green; existing HTTP suite import-blocked by SKILL_CATALOG_PIN | Accept/integrate catalog repair, correct Release fixture, run the actual native feedback gate once on final source; no HTTP/native pass is implied |
| PASS, source/mounted only | Hearing222 and feedback225 source, physical package and desktop/narrow Figma captures accepted | Final compatible archive/composition/deployment and affected live acceptance |
| CONFIGURED-UNAVAILABLE | Deployed metadata returned five managed apps: HubSpot/Airtable disconnected; Drive/monday/Krisp error | Metadata is not content proof or a global provider census. Teams/Slack/Zoom/Google/etc availability remains per existing MO15 disposition; no credentials/consent/provider mutation inferred |
| NOT RUN / no authorization | Actual external newsletter/collaborator/Tracker/PE sends and schedule activation | Do not execute from this handoff; specific human send instruction remains required |
| NOT RUN / fixture or capability prerequisite | RecipientB unavailable; newsletter staging not run because clientNone/no association control; upload/collaboration disabled in retained acceptance | Preserve these Wave3 obligations. Reconcile exact current owner/config/fixture and implementation gap from the private matrix; do not move them to Wave4 or infer live success from mocks |

Native receipts: Release `work/release-20261025/w3-core174-179-native/native-run/{result.json,ml24.stderr.log,watch.stderr.log}` and `watch-native-v2/{result.json,watch.stderr.log}`. The first result is overall FAILED because two Watch lock/drift checks lacked the fixture tenant GUC (UPDATE0 rows); only those two were rerun. Do not call this a fresh four-case Watch or eight-case combined run. Both owned containers were stopped/removed successfully. Source was unchanged through the fixture correction.

Retained source-gate limitations: Core179 focused61/61 passes; affected types0; whole API typecheck base/head both fail with identical313 diagnostics; lint fails in both because eslint is absent; API build succeeds in both. Meri280 HTTP tests did not execute past the stale catalog import. These are not newly green broad gates. Earlier setup, mutant, restoration and local browser failures remain in their original packets.

Acceptance is STOPPED, no active action; nine browser tabs are retained. Authoritative private matrices are Acceptance `work/w3-acceptance-active-20261026.json` and `work/w3-fixture-prerequisites-20261026.json`; do not publish customer/client/conversation/artifact/memory UUIDs or exact private content. Wave3 used eight Send attempts across four conversations; zero allocated slots remain. The prior16-dollar conservative allocation is NOT actual spend or monthly remainder, and the earlier00:35 smoke is separate. Fable must reconcile the canonical budget before any finite new mail/memory/sequential-bill allocation; do not assume16+6 is safely below the monthly25-dollar limit. SDK20-turn/2-dollar bounds remain. Next non-model checks are226 refusal and retained DOCX inspect/download/native opening, with no new document prompt. Actual DOCX metadata/admitted version is unverified; an empty Files list does not prove prepare failed. Preserve unknown commands in retained tabs19/20 and historicalM1/D1; no replay.

## 5. Decisions and pending Neo decisions

Neo's current continuation request supplies authority to finish the retained Wave3 implementation and acceptance and then plan Wave4. Routine in-scope repairs do not require another permission round. Fable's role transfer is current; historical Fable-inactive and pre-Wave2-completion holds do not cancel this direct instruction. Outgoing Root has stopped new product/release work. Fable assigns one successor shared-contract writer and coordinates the existing single Release operator; do not wait for another Root approval to resume the work already authorized by Neo.

Onboarding is deferred, not cancelled or called complete; resume only after the rest of the project is live. Its earlier migration log is preserved without claiming full postflight. O143 removes the Workspace approval workflow; collaboration roles/invitations/comments remain, and no new approval authority should be introduced. Core remains the gatekeeper, native SDK/RuntimeV1 owners remain canonical, no custom pool/ledger/tool platform is authorized.

PE's accepted policy is best-effort NON-RETRY: a consumed window can omit unattempted remainder after crash; definite failures are not automatically retried; legacy history is fenced. The unchanged LegiWatch boolean/retry policy is outside that guarantee. Preview deployment does not silently update distinct legacy dev workers. Named rails show enabled legacy dev Tracker/Intel and no preview targets, not global inactivity or approved cutover.

No new product/security decision is manufactured here. If remaining acceptance exposes a real scope/security choice rather than an implementation defect, surface that exact decision to Neo. No issue202 post, provider purchase, new OAuth consent, customer fixture fabrication or external send is implied by this handoff.

## 6. Traps for a fresh session

- Implemented, reviewed, merged, packaged, built, deployed and accepted are separate facts. In particular currentmaina5cfde83 is ahead of liveeac57 and includes later220/223; immediate preview0cba intentionally excludes those paired features.
- Use actual immutable package archives. Do not repair package imports by source alias, stubbed public exports or copied private DTOs, or call generated metadata a consumer/runtime qualification.
- Preserve retained request identity and exact input through unknown outcomes. Empty/absent status is not permission to retry a write, regenerate, send again or replace stored output.
- Feedback280's serialization defect and the native clock setup defect are separate. The existing retention refusal remains unavailable502; do not weaken it to make a fixture pass.
- Native deterministic doubles and driver-only JSON parsing are not PostgreSQL RLS/locking/trigger qualification. Conversely, already-passed native cases are not a reason to repeat a broad product suite.
- Mail271 is already in livecc8. Diagnose/read the actual stored-mail owner; do not reimplement the removed mailbox projection checks or infer provider-content success from metadata.
- Preserve exact current actor/tenant/client/revision ownership on all readbacks. Source references, review HTML, signed URLs and Run/Runtime IDs do not grant authority.
- Compare touched UI against actual canonical Figma3.4 Modules file `zGvvF6V6hh7yweoplCdpdE` and retained node contexts/captures. Use the applicable Figma skill before a new design-context read. Do not broaden into redesign or global primitive changes without a demonstrated need.
- Keep sparse worktrees narrow; full docs cones materialize multi-gigabyte historical archives. Use raw Git reads for archived documents. No blanket cleanup, reset, prune or rewriting another owner's checkout.
- Evidence timestamps are scoped. Older acceptance-status/checkpoint text may precede the17:00 Root status; do not restore old source holds from a historical paragraph.
- Acceptance's W3-COMPLETION-QUEUE.md is a05:50/21-merge historical planning document. Do not copy its old implementation tasks/NOT RUN labels as current. Retained Root A3 and M2/M3 briefs define scope, reconciled against96 merges and the private current acceptance matrix. The immediate focused checks do not close every A3 lifecycle/recipient/provider obligation.
- Release's copied seal-core-4d88a93f.py is NOT READY: old build ID, source version and merged172/migration prose remain. Bind to actual new receipts and correct provenance before use; no new Core build ID exists. Reconcile an uncertain submit from saved request/token rather than submitting twice.

## 7. Temporary resources and diagnostics to delete

No additional cleanup is needed for the handover. Preserve the shared development environment, all active source/evidence and private authentication/configuration. Remove only verified task-owned temporary resources after their owner confirms completion and rollback retention.

| Resource / owner | Recorded state and continuation |
| --- | --- |
| Core174/179 isolated native PG containers / Release | First native and corrected Watch receipts both show ownership verified, stop0/remove0; no persistent volume/protected DB. No duplicate cleanup needed |
| Feedback native fixture containers, clients and fault injection / Release | All owned containers/volumes removed at transfer, label checks empty. Earlier failures and correctedv4 fixture retained in `w3-feedback-native-d1e1c50b`; v4 has no allocated runner/resource binding yet and is NOT RUN |
| Figma reviewer local servers/browsers | FE226 corrected reviewer server5256/browser stopped per accepted review; preserve captures and prior failures. Other owners' resources require their final receipt |
| Build/scan/Office workers / Release | No active build/deploy/native execution or exec session at transfer. Core/supporting immutable S3 source uploads are retained; corresponding project/IAM/build updates unsubmitted/unapplied. Frontend archive remains local, not uploaded/submitted |
| Temporary release PKI/material and stale task revisions / Release | Keep owner-only private evidence and active/rollback references; clean only through the existing reference-checked operator procedure after the bounded rollback window |
| Sparse author/integration worktrees and dependency junctions | Retain accepted source/evidence/reusable tools. Catalog candidate and PR280 checkout remain required; no reset, mass archive or donor dependency changes |
| Persistent preview clone, local DB/WSL/caches | Not disposable task resources; retain unchanged |

Temporary diagnostics stay out of product source; this handover adds no product instrumentation. Do not publish private fixture rows, customer-linked identifiers, token/PKI bytes or cloud secret values in the final handoff.

## 8. What is not in this public repository

The local evidence roots above hold captured browser/desktop/narrow images, actual native results, preserved failure logs, source manifests, physical package archives and operator receipts. A committed handoff should retain references and scrubbed summary/hashes; it must not copy private source content/customer data or credentials into Git. Private service/material/fixture bindings remain available only through the established owner, by location name rather than printed secret values.

Key continuation evidence:

- Root `outputs/WAVE3-STATUS.md`, `W3-A3-REMAINING-BRIEFS.md`, `W3-M2-M3-REMAINING-BRIEFS.md`, `W3-ONBOARD-DEFERRAL-RECORD.md`, `W3-OFFICE-SCOPE-DISPOSITION.md`, exact independent reviews and size records.
- Integration `outputs/W3-PREVIEW-224-226-227-HANDOFF.md`, `W3-FE226-INTEGRATION-HANDOFF.md`, `W3-FE222-INTEGRATION-HANDOFF.md`, `W3-MERI-CATALOG-PIN-HANDOFF.md` and adjacent candidate JSONs.
- IndependentReview `outputs/W3-MO14-JSONB-HANDOFF.{md,json}` and `work/mo14-jsonb/{journal-baseline,focused-final,baseline-regression}.log`.
- Ordinary `outputs/W3-ML24-TRACKER-PE-HANDOFF.txt` and `outputs/ml24-tracker-pe-evidence/`; full prior failure/static/build provenance is retained.
- Release `work/release-20261025/w3-core174-179-native/`, `w3-feedback-native-d1e1c50b/`, physical package/build receipts named in §2–4, and actual coherent material/rollback operator state.
- Release `outputs/W3-FABLE-RELEASE-HANDOVER-20261026.txt` is the authoritative final pickup/stop receipt; Acceptance's two private matrices named in §4 carry current remaining cases.
- Acceptance `outputs/W3-DIRECTORY-224-DESKTOP.png`, `W3-B-STOP-CANCELLED.png`, `W3-B-PERSONAL-MEMORY-RELOADED.png`, `W3-B-DOCX-NO-PUBLISHED-FILE.png`, `W3-B-SOURCE-USAGE.png`, `W3-ORDINARY-ROUTEFIX-RELOADED.png`, `W3-NEWSLETTER-SAVED-PREVIEW.png`; do not publish private identities embedded in unsanitized captures.

The standalone Root output directory is not a Git repository. This document and the Wave4 plan are published in the designated handoff repository/branch. Source branches are portable through Git; browser tabs, private fixtures, physical archives and release operators remain on this Windows host. If Fable runs elsewhere, obtain those existing owner materials or access to this host before the dependent step; their absence is not permission to invent receipts or restart uncertain operations.

## 9. Next-wave briefs, bases, ownership and first actions

**Fable first finishes Wave3.** Release and Acceptance are stopped; resume with one named operator and agreed writer ownership. These read-only commands locate the current receipts without changing source or exercising providers:

```powershell
$handoffRoot = 'C:/Users/Administrator/Documents/Codex/2026-10-26/wave3-orchestrator-20261026'
$integrationRoot = 'C:/Users/Administrator/Documents/Codex/2026-10-25/wave2-visible-integration'
$releaseRoot = 'C:/Users/Administrator/Documents/Codex/2026-10-25/wave2-visible-release'
Get-Content -Raw "$handoffRoot/outputs/WAVE-3-HANDOFF.md"
Get-Content -Raw "$handoffRoot/outputs/WAVE3-STATUS.md"
Get-Content -Raw "$releaseRoot/outputs/W3-FABLE-RELEASE-HANDOVER-20261026.txt"
Get-Content -Raw "$integrationRoot/outputs/W3-PREVIEW-224-226-227-CANDIDATE.json"
Get-Content -Raw "$integrationRoot/outputs/W3-MERI-CATALOG-PIN-CANDIDATE.json"
Get-Content -Raw "$releaseRoot/work/release-20261025/w3-core174-179-native/native-run/result.json"
Get-Content -Raw "$releaseRoot/work/release-20261025/w3-core174-179-native/watch-native-v2/result.json"
git -C C:/dev/wave3-frontend-integration-20261026 status --short
git -C C:/dev/w3-meri-catalog-pin-20261026 status --short
git -C C:/dev/w3-mo14-feedback-jsonb-20261026 rev-parse HEAD 'HEAD^{tree}'
```

Inspect actual current remote refs using the established repository tooling before editing; a candidate/ref in this document is not permission to overwrite newer source.

Release's prepared pickup commands are below, **for the single named operator only after Fable accepts the transfer, not during the hold**. These were not executed by this documentation task. Immediate preview source archive SHA256 is `229c6cee5adc26241eb8c1abc61a41246ca3092346f001efd3dadfae48ac7b68`,4106 verified Git files. The prepared frontend source is0cba, not maina5.

```powershell
$releaseEvidence = 'C:/Users/Administrator/Documents/Codex/2026-10-25/wave2-visible-release/work/release-20261025'
python "$releaseEvidence/submit-frontend-0cba013e.py" frontend
python "$releaseEvidence/collect-frontend-0cba013e.py" frontend
# Only after exact-image smoke/scan: inspect and run the prepared image-only shipment recipe.
python "$releaseEvidence/prepare-shipment-0cba013e.py"
# Subsequent source-bound Core/supporting jobs; one submission each, using existing receipts.
python "$releaseEvidence/submit-core-4d88a93f.py"
python "$releaseEvidence/collect-core-4d88a93f.py"
python "$releaseEvidence/submit-supporting4d88a93f.py" api-strategy
python "$releaseEvidence/collect-supporting4d88a93f.py" api-strategy
python "$releaseEvidence/submit-supporting4d88a93f.py" intel-api
python "$releaseEvidence/collect-supporting4d88a93f.py" intel-api
```

The resulting actual changesets/deployments still require the established exact-delta review, Acceptance pause and health/readback protocol. Do not run copied `seal-core-4d88a93f.py` unchanged: first replace its old build/source binding and stale provenance with the actual new receipts. No new Core build ID exists at transfer. For feedback, Release's corrected `w3-feedback-native-d1e1c50b/source/apps/control/retention/test/feedback-native-owned-v4.test.mjs` is prepared but unrun; it removes the old clock, preserves retention502, serializes direct JSONB mutations and allows concurrent appends with pool4. Bind it to the final accepted combined producer and adapt the existing v3 runner once; do not run the old source/import recipe or create a second fixture platform.

| Order / owner | Concrete first action and acceptance |
| --- | --- |
| 1. Fable receiving lead + outgoing Root | Accept the recorded stopped-state transfer, frozen branches and final published handoff commit. Root relinquishes new product/release work; retain one named Release operator and one shared registry/package composer |
| 2. Release + Integration | Ship priority226 immediate frontend0cba, whose composition is already ACCEPT: one image smoke/scan and deploy. Preserve224 and227 exact source/package compatibility. Acceptance checks affected retry/unavailable state and real retained DOCX view; no new document prompt or replay of phaseB prompts |
| 3. Fable/independent review + Integration | Review the generated part of published combined7a09 (280's three source paths already ACCEPT;11 generated/index paths separately pending), merge normal source and establish exact final producer pin. Release performs one replacement package and repaired native feedback gate; preserve old fixture/driver/import failures. Native pass is prerequisite for the later Meri image |
| 4. Integration + Fable review | Compose already-accepted222/225 against the actual replacement archive and current frontend, preserving226/227/current owners. Verify exact source union and final pins; no broad unchanged suite rerun. Finish any concrete delta only |
| 5. Release | Reuse native4+4 to qualify the already merged4d88 Core/API-Strategy/Intel sources and exact reviewed task-role grant; pair later FE/Core/Meri sources, one build per chosen image. Preview rollout does not authorize legacy worker cutover or schedule/send activation |
| 6. Authenticated Acceptance, finite allocation by receiving lead | Close personal-memory runtime readback, successful stored-mail read, actual prepared DOCX opening, saved bill/hearing viewer and feedback receipt readback under current access; then the specifically remaining A3 paths from existing tickets. Record PASS/FAIL/NOT RUN separately; reuse saved outputs and accepted tests, never retry UNKNOWN writes |
| 7. Fable + independent reviewer | Finish any actual implementation defect revealed by those reads in its existing owner, with one writer, focused regression and exact review. Reconcile remaining named A3/M2/M3 acceptance against canonical scope, not an invented provider/platform inventory |
| 8. Fable receiving lead | Only after required Wave3 acceptance, issue the actual completion disposition, update all nine sections, retain unrun/excluded/unknown facts, and commit AND push the completion handoff with exact branch/head/tree. Outgoing Root publishes this continuation handoff now; it is not the later completion disposition |

**Wave4 planning has begun in [WAVE-4-PLAN.md](WAVE-4-PLAN.md)**. Its canonical scope is S3, M4, A4 and bounded M7 groundwork. Plan from canonical `FINAL-PLAN-20261021.md`, `source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md`, `source-of-truth/SUPERSEDED-BY-ITEM-0.md` and the retained Wave3 ticket briefs. Use exact final shipped bases and one bounded owner/interface per slice. Later A4/M4 includes actions/approvals and deliberate mail send/reply/forward obligations; no live send follows merely from planning. Full M5 artifacts/WS22–24, runtime Office render/preview/custody and owner-dependent refine/regenerate remain later, despite the finite workbook/deck output checks. Full M6 memory and M7 routines remain later; the retained Wave2 memory acceptance pair is still a Wave3 carryover and must not be moved out to hide failure. Onboarding remains deferred until everything else is live. Do not resurrect superseded proxy/pool/session/approval mechanisms or treat this handoff as new architecture authorization.

Fable receives an incomplete-work continuation with explicit first actions. Source review,96 merged changes, preserved native passes and healthy current services do not establish full Wave3 completion. Outgoing Root has completed documentation review/publication and relinquishes Wave3 execution to Fable. No further product work will be started by this outgoing run.
