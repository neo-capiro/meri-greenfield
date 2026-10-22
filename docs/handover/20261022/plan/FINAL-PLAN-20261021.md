# Capiro and Meri Final Plan

**Date:** 21 October 2026.
**Roles:** Neo's agents build everything. Fable plans each phase, reviews it, merges it and deploys it; Fable's sessions write no product code. Neo decides scope.

This plan puts everything left into a sequence of deployed phases. It merges three sources:

- *Capiro Portfolio, Workspace, Settings and Mail Wiring Closeout Plan* (112 items: X, PF, WS, ST, ML).
- *Capiro Meri Wiring Closeout Plan* (107 items: MG, MB, MO, MF, MR, MT, MM, MX).
- Fable's open work: chat fixes, consolidation, the speed phases, and **client-optional chat**.

The two closeout plans stay the detailed specs: each ticket there already has its evidence, work and acceptance. This plan sets the order, grouping, owner and deployment. **Every ticket appears in exactly one phase**; the index is in section 9.

## 1. Rules

1. **One theme per release.** Each phase ships as its own deploy and is checked live before the next one on the same service.
2. **Features stay off until proven.**
   - A new capability stays off until its phase's live checks pass.
   - A feature's UI flag and backend flag turn on together.
   - One flag per release.
3. **Reuse what exists.** No new frameworks, senders, storage platforms or second implementations. Missing pieces are added at the boundary the closeout plans name.
4. **Measure before building anything heavy.** Expensive designs are built only if telemetry after the cheaper steps shows they're needed (section 7).
5. **Every release passes the whole-flow chat check:**
   - turn 1, then turn 2 straight after;
   - a page reload;
   - reopening after the deploy;
   - a conversation left idle for 20 minutes.

   Each of today's turn-2 bugs slipped past a narrower test.
6. **Change-controlled areas need Neo's yes at phase start:** Core auth, tenant context and sessions; Clerk; Microsoft and Google OAuth and token storage.

## 2. How each phase runs

| Step | Who | Output |
|---|---|---|
| Brief | Fable | One brief per phase, written one phase ahead: scope (ticket IDs), files, flags and acceptance. It points to the closeout-plan tickets for detail. |
| Build | Neo's agent | Draft PRs on GitHub, listing tests run and not run. No AWS and no merges. |
| Validate | Fable | Targeted independent review, plus a security review for phases that change authority (A1, M2, M4, M6, M8). The repos' gates: unit and composed tests, real PostgreSQL where touched, and the Meri image gate. Target: one day. |
| Deploy | Fable | Merge. Take a database snapshot before any migration. Deploy the backend first, then Meri, then the frontend. |
| Accept | Fable | Run the phase's live checks, turn its flag on only after they pass, and update the status table. |

While a phase is being validated and deployed, its agent starts the next phase in its lane.

## 3. Where we are today

| Area | State |
|---|---|
| Meri chat (preview) | **Two-turn chat works** (candidate 11, greenfield `main` `bce70776`): turn 2 recalls turn 1, and a reload keeps history. About 195 s to first text. |
| Meri blocker | A conversation whose first turn isn't sent within 15 minutes is stuck forever. The fix (C12, migration 0020) is being finished. |
| Meri consolidation | PR197 (reads, writes, documents and memory source, all off) is nearly merge-ready and replaces PR189–192. |
| Core consolidation | `backend-import` `8d9958f7` (PR96, PR97, PR101–104, P6-Core) is **merged, not deployed**. Preview still runs an older Core. |
| Frontend | `main` `24316f91` (preview line plus PR102, PR114, PR115) is **merged, not deployed**. |
| Speed work | P0 telemetry is live. P1 (agent 1) is in progress. P2 PR-A (#196, `c703e9f3`) is revised and awaiting validation. |
| Environments | Restricted preview only (read-only Core). No ordinary staging environment yet. os.capiro.ai still runs capirov2. |

## 4. Lanes: who can work at the same time

| Lane | Agent | Owns | Must not edit |
|---|---|---|---|
| **R · Runtime core** | Agent 1 | greenfield `apps/control`, `apps/worker`, `apps/runtime`, including `cli.mjs`, `config.mjs`, `product-ports`, `activity.mjs` and `action-host/session` | proxy and owner, gateway tools, frontend |
| **D · Domain and proxy** | Agent 2 | greenfield `apps/proxy`, `apps/gateway`, tool catalog, memory, artifacts, contracts package | Lane R's files (it asks Lane R for seams) |
| **U · Meri UI and Core-for-Meri** | Agent 4 | capiro-frontend `features/meri/**` and `shared/meri-*`; capiro-backend Meri bootstrap and application-authority | Portfolio, Workspace, Settings and Mail code |
| **A · App** | Agent 3 | capiro-frontend Portfolio, Workspace, Settings and Mail; capiro-backend clients, objectives, BD, workspace, settings and engagement/mail | Meri code |
| **Ops** | Fable | Briefs, reviews, merges, migrations, environments, releases, status table. Sole owner of shared files: frontend registry and config, migration numbering, deploy templates, generated contracts. | — |

**Four agents, one per lane** (Neo's decision 4).

## 5. The phases

### Phase 0 · Baseline (agents 1 and 2 build, Fable ships; about one week)

**Goal:** everything already built is live, and the stuck-conversation bug is fixed.

**Agents build:**
- **Agent 2:** fix PR197's last red test (the declared-slice state in the read-scope ledger, O120), then update `AGENTS.md` to this ownership: agents build, Fable reviews and ships, dot is out.
- **Agent 1:** C12, so unstarted conversations recover (migration 0020), continuing E's handover branch. [MR-07]

**Fable ships:**
- Merge PR197 and release it with every feature off. [MX-02, MT-02, MM-08 source]
- Release C12, with a snapshot before migration 0020.
- Deploy the consolidated Core to preview: 11 Core migrations, applied after a snapshot. Then deploy frontend `main`. [MF-08 regression check]
- Add the session-refusal alarm metric, and start the status table: what's live, what's off, and where. [MX-01]
- **Housekeeping:**
  - close the PRs that PR197 and PR194 supersede;
  - merge or close the stale-browser-spec and proxy-diagnostics branches;
  - record migration numbers: C12 owns 0020, and PR178 must renumber if it is ever adopted [MX-04];
  - WSL disk compaction and a reboot.

**Done when (on preview):**
- E01–E04, E08 and E09 pass, and E11 passes by test;
- a conversation left idle for 20 minutes still works;
- a conversation opened before the Phase 0 deploys still works after them.

### Speed track (lanes R and D)

| Phase | Scope | Done when |
|---|---|---|
| **S1** · P1 + P2 PR-A | P1 budget table (agent 1). P2 PR-A owner/proxy proof reuse (#196). Dashboards from P0 telemetry [MX-08]. | No behaviour change. Owner exchanges ≤ 13 per model request. A partner restart re-pairs within 30 s (E39). Telemetry stays truthful (E41). |
| **S2** · P2 PR-B + authority-lite | P2 PR-B (exchange collapse). **Authority-lite**, which replaces ADR P3: Meri control uses Core's combined current-authority receipt and its bounded Clerk cache (P6-Core, deployed in Phase 0) instead of separate identity, membership and context calls. Write intents use the run's own session instead of minting one per intent, which M4 needs. | Core calls per turn ≤ 30 (from about 151). Core time ≤ 3 s per turn. A revoked user loses access within 30 s. |
| **S3** · Warm runner pool | ADR P5 with the approved settings: minimum 2, maximum 10, 10-minute idle timeout, one conversation per runner, never bound twice [MX-06, MX-09]. | Target: first text within 15 s at the median (from about 195 s). Pool depth and retirement alarms are in place. |
| **S4** · Only if S3 misses its target | The full signed authority lease (ADR P3), Stop without the task router (ADR P4), or an in-process path for plain chat like os.capiro.ai's. Neo picks. | Target met. |

### Meri track

| Phase | Lanes | Scope | Needs | Done when |
|---|---|---|---|---|
| **M1** · Reliable chat | R + U | **Lifecycle:** MR-01, MR-02, MR-06, MR-08, MR-09; pause, resume and fork across a deploy (E12); the whole-flow chat check built into every release [MX-13]. **UI:** MF-01, MF-02 (including heartbeat and send acknowledgement), MF-06, MF-07, MF-10, and the pinned frontend acceptance matrix MF-21. **Also** the open review follow-ups from candidates 9–11. | Phase 0 | E01–E12 and E40 on preview |
| **M2** · General or client chat | R + U | **Client-optional chat** (details below). New conversation, conversation list, switching and history (MF-09). Automatic client context MG-05. Selected skill and scope kept MG-02. "Ask Meri about this client" PF-02. Cross-module context MF-19 (context part). | M1, and Neo's decision on reads across clients | E06, E45 (context part), and the client-optional checks below |
| **M3** · Read tools on | D + U | MT-01, MT-04 to MT-09, MT-16, MO-14, MO-15, MG-06. Citations and evidence UI MF-16. Re-register the reads per O118. Bind each enabled capability to its dependencies [MX-03]. | Phase 0. Reads in General chats need M2. | E18–E20, E31, E44, and each family's positive, negative and paging cases. `reads` turned on. |
| **MP** · Model choice: Claude API alongside Bedrock | D + U | **Two model paths:** Bedrock (today's) and the Claude API. Any current Claude model and reasoning level is selectable: a default in Settings, plus a per-conversation picker. The API key lives in AWS Secrets Manager. Both paths get the same budgets, usage records, telemetry and Stop behaviour. | S1 | The whole-flow chat check passes on both paths; switching model or provider mid-conversation works; usage is recorded per provider |
| **M4** · Actions and approvals on | D + U | task.create MT-10, task.update MT-11, Research Portfolio actions MO-05, LegiWatch watches MO-06, prospect, client and note changes MO-08. Approval UI MF-03, MF-04, MF-05, MF-12, MF-13. | S2, and A0 (writes need staging) | E13–E17 in staging. `intents` and the approvals UI turned on together. |
| **M5** · Documents, files and research outputs | D + U + A | MM-09 to MM-19, MB-04. UI MF-14, MF-15, MF-19 (completion links). Portfolio PF-03, PF-23. Workspace WS-22, WS-23, WS-24. | M4 | E26–E31 and E45. All six formats open natively. `artifacts` turned on. |
| **M6** · Memory and preferences | D + U + A | MM-01 to MM-07, MR-05. Settings ST-07 to ST-13, ST-18. UI MF-17. Migrations intents/0002 and memory/0002. | M4 and A0 | E23–E25 and E36. `memory` and the memory-review UI turned on together. |
| **M7** · Routines, Cowork and skills | R + D + U | MR-03, MR-04, MR-10, MB-05, MT-12, MT-13 (all 14 skills), MO-01, MO-02, MO-10. Runs and routines UI MF-11, MF-18. Settings ST-15, ST-16, ST-17. | M4, M5 | E32–E35 |
| **M8** · Advanced capabilities, each its own release | R + D + U | Browser, Bash and user devices: MT-14, MB-01, MB-02, MB-03, each with its own isolation qualification (E37, E38). Federal drafting workbench MO-03. Graph, buyer and funding MO-07. Office editing MM-20. | M7 | Each capability's own checks |

### Client-optional chat (in M2)

**Today:** every Meri conversation belongs to one client, and preview admits a single client. On os.capiro.ai, users can ask anything with no client selected, or pick one.

**M2 matches that with one rule:** a conversation is either **General** or **bound to one client**, decided when it is created.

- **Core:** the conversation bootstrap accepts "no client". The current-authority receipt supports a clientless conversation, designed properly this time; an earlier ad-hoc version was removed from PR102. This work is change-controlled.
- **Meri control:** the initial binding, context and tool scopes accept a clientless conversation. A tool that needs a client asks the user to start a client chat instead of guessing.
- **Reads in a General chat:** across the clients the user can already see, with each client's wall enforced per result (Neo's decision 2).
- **Actions in a General chat:** whichever is simpler to build safely. Either they run under the user's own per-client permissions, or they require a client chat. **No new authorization machinery for this.**
- **Memory:** a General chat uses personal and firm memory only, never a client's.
- **UI:** "General" appears in the client selector, and the New conversation button works.
- **Checks:**
  - a General chat answers a general question;
  - it never returns another client's walled data;
  - a client chat cannot see another client;
  - switching between conversations keeps each one's history.

### App track (lane A)

| Phase | Scope | Needs | Done when |
|---|---|---|---|
| **A0** · Ordinary staging environment (Fable + lane A). **Deferred** (Neo's decision 1). Until it exists, A1–A5 and M4–M7 are built, reviewed and merged, but their live checks wait for staging. | X-01, X-02, X-03, X-05, X-06; PF-01, PF-21, PF-24, WS-01, ST-26, ML-01. One ordinary (not restricted-preview) environment on capiro-dev with Core, Strategy, Workspace, Onboard, Engagement and Meri, plus a test tenant and test provider apps. | Neo approves it | Every service answers at its correct path on the exact images. Existing flows smoke-tested. |
| **A1** · Safety fixes | ST-01, ST-02, WS-02, WS-03, WS-04, PF-10, PF-11, PF-12, PF-22, ML-02, ML-03, ML-07, ML-08, ML-09, ML-10, X-04; ST-24 (security-sensitive writes) | Build can start now; live checks need A0 | Direct-API negative tests pass. Deployed to staging. Nothing new switched on. |
| **A2** · Finish screens that already have a backend | Settings ST-03 to ST-06, ST-19, ST-20, ST-24 (remaining forms), ST-25, ST-27, ST-28. Portfolio PF-07, PF-09, PF-13, PF-14, PF-16, PF-18. Mail status and sync ML-11 to ML-18, ML-26. | A1 | Every Settings, Portfolio and mail-read row in the closeout matrices is accepted in staging or explicitly held |
| **A3** · Workspace complete | WS-05 to WS-21: documents, Hill Day, newsletters, templates. System mail ML-24. | A1 | Every Workspace row accepted in staging or held |
| **A4** · Sending mail, including from Meri | ML-04, ML-05, ML-06, ML-19, ML-20, ML-21, ML-22, ML-23, ML-25; ST-14; Timeline reply PF-25; Meri send and reply MO-04, MT-03 (lane D part) | A1 and M4 | Send, reply and forward work on Microsoft and Gmail test mailboxes, with durable receipts. No resend after an unknown outcome (E21, E22). |
| **A5** · New product features | PF-04, PF-05, PF-06, PF-08, PF-15, PF-17, PF-19, PF-20, X-07, WS-25, ST-21, ST-22, ST-23, ST-29 | A2 | Each starts from a one-page contract that Fable writes and Neo approves, then ships like any other phase |

### Launch track (Fable)

| Phase | Scope | Done when |
|---|---|---|
| **L1** · Launch qualification | One release packet [MX-04, MX-05, MX-07, MX-10, MX-11, MX-12, MX-14]. Disable and restore MO-09. Reliability corpus MG-01. Figma reconciliation MG-03. Optional Decisions/JEV MG-04. Keyboard and mobile MF-20. Register of original features and exclusions MT-15. Model default MO-13 (an SDK upgrade first needs the transcript-recap handover from O103). Production stacks kept separate from preview. The data path for os.capiro.ai. **A parity list of what users rely on in today's os.capiro.ai.** Alarm email routing. | Packet reviewed, E42 and E43 pass, and Neo signs off the scope |
| **L2** · Internal tenant | Capiro's own tenant moves to the new production stack | One clean week |
| **L3** · First 3 customer tenants | Moves once the parity list is met | Two clean weeks |
| **L4** · All tenants; retire the old runtime | MO-11, MO-12, ML-23 cutover; capirov2 Meri retired | Old paths removed |

**Recommended launch line:**
- **Internal tenant (L2)** after Phase 0, S1–S3, M1–M5 and A0–A4.
- **Customers (L3)** once the parity list is met, which likely includes M6 (memory).
- **After launch:** M7, M8 and A5 continue.

## 6. Running in parallel

The weeks are rough. Fable will re-estimate after Wave 1, once the agents' pace is known.

| Wave | Agent 1 · lane R | Agent 2 · lane D | Agent 4 · lane U | Agent 3 · lane A | Fable ships |
|---|---|---|---|---|---|
| 1 (weeks 1–2) | Finish P1, then C12, then M1 runtime | PR197 last test, `AGENTS.md`, P2 fixes, then PR-B | M1 screens | A1 safety fixes | Phase 0; S1 (P1 + P2 PR-A) |
| 2 (weeks 3–4) | Finish M1, then S2 authority-lite | P2 PR-B, then MP (Claude API path) | M2 screens and Core (General chat, New conversation) | A2 | M1, A1 |
| 3 (weeks 5–7) | M2 runtime, then S3 warm pool | M3 read tools | M3 screens | A3 | S2, MP, M2, M3, A2; production data-path question to Neo |
| 4 (weeks 8–10) | Finish S3, then M7 groundwork | M4 actions and approvals | M4 screens | A4 (with agent 2 for Meri mail) | S3, M4, A3 |
| 5 (weeks 11–13) | M7 routines and skills | M5 documents and files | M5 and M7 screens | A5 | M5, A4, M7, then L1 |
| 6 (weeks 14–16) | M8 | M6 memory and preferences | M6 screens | A5 | M6, then **L2 internal tenant** |
| 7 (weeks 17+) | M8 | M8 | M8 screens | A5 | L3 first customers, then L4 |

**Staging (A0) is deferred.** A1–A3 merge and ship as far as the restricted preview allows. Live checks for actions (M4 onward) and the app's write features need staging, so Fable will raise decision 1 again at the start of Wave 3.

- **Can always run together:** lanes R, D, U and A, because they edit different files.
- **Must never overlap:**
  - two changes to the same runtime-core file (lane R works through them one at a time);
  - two releases to the same environment (Fable runs deploys one at a time);
  - migrations (Fable numbers and orders them).

## 7. What was simplified, and when to revisit

| Before | Now | Revisit if |
|---|---|---|
| ADR P3: signed authority leases with key rotation (2–2.5 weeks) | Authority-lite in S2, using the Core receipt and Clerk cache that are already merged | After S3, Core and Clerk time still exceeds 20% of a turn, or revocation misses 30 s |
| ADR P4: Stop without the task router (1–1.5 weeks) | Only its two-turn and Stop test suite, in M1 | Stop or cleanup latency causes visible problems |
| ADR P6 browser work as a separate phase | Folded into M1 (MF-02) | Not applicable |
| Test tiers T0–T7 and operator gates O0–O7 | The five-step phase loop in section 2, plus each phase's live checks | Not applicable |
| Separate acceptance registries | One status table (MX-01) and the index below | Not applicable |
| More environments | Preview (read path), one staging, then production | Not applicable |
| Full mutation campaigns on every PR | Targeted reviews; full campaigns only where authority changes | A phase ships a defect that a campaign would have caught |

## 8. Decisions (Neo, 21 October 2026)

| # | Decision | Neo's answer |
|---|---|---|
| 1 | Create the ordinary staging environment | **Not yet.** A0 is deferred. Live checks for A1–A5 and M4–M7 wait for it; builds and reviews continue. |
| 2 | General chats read across the clients a user can see | **Yes**, walls enforced per result. Keep it simple: if letting actions span clients is easier, that's fine. No new authorization machinery. |
| 3 | Change-controlled work (Core auth and sessions, OAuth and token storage) | **Approved for all phases.** |
| 4 | Number of agents | **Four**, one per lane. |
| 5 | Launch line | **As recommended:** internal tenant at L2, customers after parity. |
| 6 | Production data path for os.capiro.ai | **Fable raises it when Wave 3 starts.** |
| 7 | Mail scope | **As recommended:** provider-native reply and forward now; drafts later. |
| 8 | A5 product contracts | **As recommended:** a one-page contract each. |
| 9 | Models | Keep the current Claude model on Bedrock, **and add the Claude API as a second code path, with every model and reasoning level selectable** (new phase MP). SDK upgrades still need the recap handover first. |
| 10 | capirov2 comparison | **Deferred.** |
| 11 | Workspace approvals (A1 WS-03) | **Removed** (21 Oct, 22:50 UTC). No approval workflow in Workspace, and no dead code left. Stored approval data stays untouched until an approved drop migration. Sharing, wall and ownership protections stay. Meri, release and Portfolio artifact approvals are unaffected (O143). |
| 12 | New-stack database | **A copy-on-write clone** of the shared Aurora DB for preview Core; the live DB is never migrated by this programme. Data diverges from live from the clone date (O135, O140). |

## 9. Index: every item and its phase

### App closeout plan (112 items)

- **X:** X-01 A0 · X-02 A0 · X-03 A0 · X-04 A1 · X-05 A0 · X-06 A0 · X-07 A5
- **PF:** PF-01 A0 · PF-02 M2 · PF-03 M5 · PF-04 A5 · PF-05 A5 · PF-06 A5 · PF-07 A2 · PF-08 A5 · PF-09 A2 · PF-10 A1 · PF-11 A1 · PF-12 A1 · PF-13 A2 · PF-14 A2 · PF-15 A5 · PF-16 A2 · PF-17 A5 · PF-18 A2 · PF-19 A5 · PF-20 A5 · PF-21 A0 · PF-22 A1 · PF-23 M5 · PF-24 A0 · PF-25 A4
- **WS:** WS-01 A0 · WS-02 A1 · WS-03 A1 · WS-04 A1 · WS-05 to WS-21 A3 · WS-22 M5 · WS-23 M5 · WS-24 M5 · WS-25 A5
- **ST:** ST-01 A1 · ST-02 A1 · ST-03 A2 · ST-04 A2 · ST-05 A2 · ST-06 A2 · ST-07 M6 · ST-08 M6 · ST-09 M6 · ST-10 M6 · ST-11 M6 · ST-12 M6 · ST-13 M6 · ST-14 A4 · ST-15 M7 · ST-16 M7 · ST-17 M7 · ST-18 M6 · ST-19 A2 · ST-20 A2 · ST-21 A5 · ST-22 A5 · ST-23 A5 · ST-24 A1 and A2 · ST-25 A2 · ST-26 A0 · ST-27 A2 · ST-28 A2 · ST-29 A5
- **ML:** ML-01 A0 · ML-02 A1 · ML-03 A1 · ML-04 A4 · ML-05 A4 · ML-06 A4 · ML-07 A1 · ML-08 A1 · ML-09 A1 · ML-10 A1 · ML-11 to ML-18 A2 · ML-19 A4 · ML-20 A4 · ML-21 A4 · ML-22 A4 · ML-23 A4 and L4 · ML-24 A3 · ML-25 A4 · ML-26 A2

### Meri closeout plan (107 items)

- **MG:** MG-01 L1 · MG-02 M2 · MG-03 L1 · MG-04 L1 · MG-05 M2 · MG-06 M3
- **MB:** MB-01 M8 · MB-02 M8 · MB-03 M8 · MB-04 M5 · MB-05 M7
- **MO:** MO-01 M7 · MO-02 M7 · MO-03 M8 · MO-04 A4 · MO-05 M4 · MO-06 M4 · MO-07 M8 · MO-08 M4 · MO-09 L1 · MO-10 M7 · MO-11 L4 · MO-12 L4 · MO-13 L1 · MO-14 M3 · MO-15 M3
- **MF:** MF-01 M1 · MF-02 M1 · MF-03 M4 · MF-04 M4 · MF-05 M4 · MF-06 M1 · MF-07 M1 · MF-08 Phase 0 · MF-09 M2 · MF-10 M1 · MF-11 M7 · MF-12 M4 · MF-13 M4 · MF-14 M5 · MF-15 M5 · MF-16 M3 · MF-17 M6 · MF-18 M7 (browser parts M8) · MF-19 M2 and M5 · MF-20 L1 · MF-21 M1
- **MR:** MR-01 M1 · MR-02 M1 · MR-03 M7 · MR-04 M7 · MR-05 M6 · MR-06 M1 · MR-07 Phase 0 · MR-08 M1 · MR-09 M1 · MR-10 M7
- **MT:** MT-01 M3 · MT-02 Phase 0 · MT-03 A4 · MT-04 to MT-09 M3 · MT-10 M4 · MT-11 M4 · MT-12 M7 · MT-13 M7 · MT-14 M8 · MT-15 L1 · MT-16 M3
- **MM:** MM-01 to MM-07 M6 · MM-08 Phase 0 (source) and M5 (on) · MM-09 to MM-19 M5 · MM-20 M8
- **MX:** MX-01 Phase 0 · MX-02 Phase 0 · MX-03 M3, then every flag · MX-04 Phase 0 and L1 · MX-05 L1 · MX-06 S3 · MX-07 L1 · MX-08 S1 · MX-09 S1–S3 · MX-10 L1 · MX-11 L1 · MX-12 L1 · MX-13 M1 · MX-14 L1

### Meri integrated scenarios (E01–E45)

E01–E04 Phase 0 · E05–E12 M1 (E08, E09 also in Phase 0) · E13–E17 M4 · E18–E20 M3 · E21–E22 A4 · E23–E25 M6 · E26–E31 M5 · E32–E35 M7 · E36 M6 · E37–E38 M8 · E39 S1 · E40 M1 · E41 S1 · E42–E43 L1 · E44 M3 · E45 M2 and M5

### Fable's open items

- **Phase 0:**
  - C12 (unstarted conversations); PR197 merge; consolidated Core and frontend deploys;
  - session-refusal alarm metric;
  - PR and branch housekeeping, `AGENTS.md`, migration register, disk and reboot.
- **M1:**
  - candidate 9–11 review follow-ups: PostgreSQL fixtures, the `running` assertion, the openssl fixture, the ledger load failure, B's four C11 notes;
  - the whole-flow release check;
  - pause, resume and fork across a deploy;
  - ADR P6 browser work.
- **M2:** client-optional chat; New conversation.
- **MP:** Claude API path alongside Bedrock (decision 9).
- **M3:** read re-registration (O118).
- **Speed:**
  - ADR P1 and P2: S1–S2;
  - ADR P3: S2 (lite), or S4 if needed;
  - ADR P4: tests in M1, design in S4 if needed;
  - ADR P5: S3.
- **L1:**
  - transcript-recap handover before any SDK upgrade (O103);
  - alarm email routing.
- **S4 decision:** the capirov2 comparison, on hold.
