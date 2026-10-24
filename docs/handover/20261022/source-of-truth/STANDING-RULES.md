# Standing rules for all agents

> **Current architecture and authority — 24 October 2026.** Neo approved autonomous completion on **AgentCore Runtime standard V1**, hosting the actual Claude Agent SDK with durable native SessionStore/artifacts and canonical Core permissions. Root is sole orchestrator and shipping owner; A/U/R/D work on exact disjoint allocations with independent review. Follow the [migration and completion plan](../plan/AGENTCORE-RUNTIME-MIGRATION-20261024.md), [standing requirements](../STANDING-REQUIREMENTS.md) and [supersession register](SUPERSEDED-BY-ITEM-0.md).
> Replace per-turn Fargate/custom warm pools, model proxy/budget machinery, duplicate authority chains, custom checkpoints and the Temporal issuer. Retain required Temporal durability, native SDK history, every product outcome, all memory/data and 14 skills. Dated source/evidence is historical; bounded work and acceptance use the current owner. No old hold creates a new permission step, and no failed or unrun gate becomes a pass.

These rules apply to every task. Resolve routine implementation within the current allocation; root resolves shared ownership or scope conflicts. Older dot/Fable role assignments are historical, not a second approval or shipping authority.

## Necessary qualification only — Neo, 24 October 2026

Follow the [delivery lessons in WORKFLOW](../WORKFLOW.md#delivery-lessons-from-24-october-2026): exercise the actual route/configuration and producer/receiver integration early; select checks by changed behavior and risk; reuse unaffected evidence; build each candidate once; diagnose the failing boundary before rebuilding; use ordinary Git/CI evidence; remove approved temporary preview holds through coherent existing routing; and report only demonstrated readiness. Once affected checks and independent review pass, proceed instead of adding gates. Do not introduce another packet, census, fingerprint, replay or approval framework.

The inherited regression matrices below are **coverage inventories, not mandatory full reruns per change**. Strong checks remain appropriate for actual authorization, tenant isolation, irreversible effects, grants, migrations, retention and concurrency changes. A failing or unrun case is never a pass; unrelated cases stay assigned without blocking a limited release they do not affect. Existing user authorization is not reset by a new branch, reviewer or handoff.

## Meri: architecture to preserve and trace requirements

## Architecture to preserve

The approved target architecture is (not a shipping claim):

1. **Frontend:** ordinary Meri routes and typed consumers; server-only user identity and narrow target routing; no browser credentials for internal services.
2. **Control:** authenticated immutable tenant/actor/conversation/scope ownership, serialized input admission, idempotent run/outcome/event/usage records and current Core checks.
3. **Runtime:** actual pinned Claude Agent SDK on AgentCore Runtime V1; one isolated conversation session, idle stop, durable native SessionStore/artifact restore, bounded Stop and full harness. Temporal retains required durable runs, schedules and background work.
4. **Tools:** existing typed gateway to canonical Core/domain owners; current permission checks and durable receipts for effects. No model proxy, spend-reservation or per-hop proof layer.
5. **Core and providers:** canonical identity, live membership/client walls, read and mutation owners; mail/calendar/Portfolio/Workspace remain their existing owners.
6. **Return and recovery:** authorized durable events and native session state → validated DTO → stream/history/reload; permission loss cannot expose previously loaded context. A lower-level success alone does not complete the feature.

### Trace requirements by user-visible flow

| Flow | Complete trace that closure must prove |
|---|---|
| Chat / follow-up | UI conversation/request → authenticated control admission → isolated Runtime V1 session + actual SDK → durable SDK history, events and outcome → live stream, follow-up, paged history and reload |
| Read/search | Prompt/skill → registered typed tool and arguments → current Core tenant/member/client permissions → authoritative source/pagination/time semantics → authorized evidence/citation/UI; recheck access rather than reuse an old permission claim |
| Task create / approval | Typed intent preparation → durable proposal/command/approval tuple → owner decision/recheck → exact Core execution grant → task.create effect → durable receipt (or UNKNOWN) → intent/task/history refresh; no blind redispatch |
| Task update / schedule | UI/tool proposal → accepted domain authority contract → revision/CAS/consent → existing Core/schedule owner → durable effect + idempotency → background firing/cancel/reconcile and user-visible status; missing owners cannot be replaced with a generic bearer |
| Memory | Recall/proposal source scope → producer/candidate → review/correction/approval → canonical Core Memory effect or safe held response → four payload retention/tombstone linkage → current visibility/retrieval/history |
| Document / research deliverable | Selected input and evidence custody → governed preparation/executor → format-valid/native-usable output → immutable version/object/hash/provenance → current inspect/download/preview → Files/message/history and expiry/retention |
| Attachment / filing | Authorized user bytes → upload/read custody with content limits/scan/tenant-client binding → read/analysis/generation selection → explicit filing intent and Workspace destination → durable receipt/access/reload; ordinary chat text is not attachment support |
| Browser / Bash | Accepted capability+scope and explicit effect authority → canonical isolated host/egress owner → bounded execution+network filesystem policy → result provenance → cleanup/absence proof and current output release. Unmounted host source is not active browser support |
| Cross-module entry | Portfolio/Workspace/Settings selected entity → canonical Meri context contract, not name guessing → real supported action/receipt → receiving module refresh; existing PF/WS/ST/ML owners remain |

---

## Meri: canonical owner map and collision rule

#### 2. Canonical owner map and file-ownership constraints

| Boundary | Canonical owner / implementation unit | Other lanes consume, do not duplicate |
|---|---|---|
| Main + PR197 successor review | Existing Meri receiver; MX-02 | All new Meri source starts from one reconciled candidate; #189/190/191/192 donor work not reapplied |
| P1 nested startup/deadline table | **[SUPERSEDED]** Existing active P1 runtime owner; MR references | MX-09 measures results; no second timeout table or ad hoc larger constants |
| P2 proof reuse/replacement | **[SUPERSEDED]** Existing PR196 owner | Currentness/placement collision resolution and security review; PR-B follows existing PR-A gate |
| Public contracts and generated browser receivers | Meri contracts owner with FE receiver | One exact B1/B2/lifecycle DTO; shared generators/package manifest single-owned |
| FE Meri observation/session stores | Frontend Meri owner | Approvals and lifecycle controls reuse the same observer/cache/current identity, not local divergent state machines |
| Action session/current run/context authority | **[RE-SCOPED: keep the action session; drop run-current authority]** Meri runtime/control + Core identity owner | UI cannot choose tenant/actor or turn legacy service credentials into user authority |
| Generic intent preparation/approval/execution receipts | MT command/intent owner | Task.create remains canonical; Memory/filing/schedule commands require their own accepted domain contracts |
| Core task mutation and task reads | Core domain owner with MT adapter | MF consumes; no direct UI/provider mutation bypassing Core grant/idempotency |
| Routines/schedules/background firing | MR schedule lifecycle owner | MT owns conversational preparation/list/decision bridge; MF owns page; one occurrence/consent/cancel journal |
| Planner/objective continuation | Existing Core Planner/Strategy owner | Meri supplies bounded source/reader/run receipts only; do not restore the superseded Meri Planner loop |
| Memory canonical storage/permissions | Core Memory owner + MM custody/retention | Settings owner review and conversation proposals consume one wire/governance contract |
| Memory four-payload tombstone bundle | MM | MX-04 packages migrations/grants; no second Memory purge implementation |
| Global retention suppression/purge/restore | MR retention owner | MM artifacts/Memory register owned classes; runtime holds remain until deletion and proof owners exist |
| Artifact custody/version/current access | MM + existing Workspace artifact bridge | MF Files/document access reuses accepted public receiver; no new storage platform |
| Selected research/output workflow | MM selected-output owner | MR provides generic run/checkpoint/Stop; selected prepare/completion receipt recovery is not fixed by checkpoint continuity alone |
| Mail send safety and OAuth/provider identity | Prior ML-02–10/16 owner, Core/Engagement sender | Meri read composition and proposals are separate. No new SMTP/OAuth stack or direct send fallback |
| Portfolio/Workspace Meri entry | Prior PF-02/03 and WS-22/24 with MF/MT | One selected-client/entity/artifact contract; no label/name-based implicit authority |
| Settings Memory/preferences and account connection | Prior ST-07–14 with MM/MF; provider identity ML owner | Owner review is not all Memory governance; account OAuth status is not Meri execution permission |
| Migration/role/readiness packaging | MX-04 with service owners | Domain tickets define schema; one central order/hash/grant packet |
| Image/material/release/operator qualification | **[RE-SCOPED]** Existing shipping owner, MX-05–14 | Source lanes prepare evidence, do not independently mutate cloud/runtime |

**Collision rule:** a shared source file has one active owner per receiving batch. In particular, serialize changes to `apps/runtime/cli.mjs`, `apps/runtime/config.mjs`, `apps/runtime/product-ports/*`, `apps/control/action-host/session/owner.mjs`, `apps/worker/conversation/activity.mjs`, contract package manifests/generators, FE Meri chat/observer code, and migration/feature renderers. Parallel lanes may own separate modules/tests and submit explicit receiver patches. They may not overwrite one another's branches or guards.

---

## Meri: definition of done

#### 7. Definition of done

For each requested capability, “wired” requires all applicable links:
1. A real mounted UI or discoverable operation, not a fixture-only screen or catalog placeholder.
2. Typed argument/result and versioned public contract, correct bounded errors and unsupported behavior.
3. Canonical current tenant/actor/client checks at admission and actual data/effect access; delegated/approval scope does not widen and revoked context is not released. No duplicate per-hop authority framework.
4. Runtime/startup owner and real downstream service/provider/persistence available for the selected profile.
5. Durable idempotent effect/output receipt, or explicit durable UNKNOWN with read-only reconciliation.
6. Cancellation/Stop/retention/revocation handling at external waits and before output release.
7. Immediate UI refresh plus history/reload/reconnect/restart behavior.
8. Relevant source/native/security/provider/format acceptance at the exact shipped source/image/config/schema.
9. Operational ownership, telemetry, expiry/renewal and tested rollback/recovery.
10. No conflicting duplicate owner, misleading success copy or unreviewed external effect.

A capability can be **source-complete, activation-held**; it cannot be called delivered. An unsupported row can be explicitly excluded from a limited release but remains incomplete in the full-product acceptance registry. Conditional original alternatives require their stated decision evidence; an original product promise is not optional merely because its source is absent. A failure is not closed merely because the same failure exists on the base. A live chat win is preserved without overstating it as full product qualification.

---

## App: consolidated work index and no-duplication rules

## Consolidated work index and no-duplication rules

The domain registers contain **112 indexed closure items: X 7, PF 25, WS 25, ST 29 and ML 26**. These are not 112 independent defects: some are intentional cross-owner pointers, configuration/qualification gates, product decisions or optional unsupported capabilities. Use the canonical owner map below before creating implementation tickets. Coverage comprises 52 Portfolio action-family rows, 47 Workspace action-family rows plus 216 mounted-route entries, all 19 Settings route keys and their nested actions, and the provider/action matrix for Microsoft, Google and related system-mail senders. Counts are different inventory dimensions and must not be added together.

A domain's **P1 release blocker** is mandatory before the affected action activates, even where another domain labels the corresponding security/data-integrity gate P0. This is a scheduling normalization, not a claim of a production incident. Source-confirmed authorization issues and residual risks requiring reproduction remain distinguished in each ticket.

| Shared boundary | Canonical implementation owner / tickets | Referencing scope and duplication rule |
|---|---|---|
| Restricted preview versus ordinary product | X-01; ST-03 owns the concrete archived-roster query defect | PF-01 is a pointer to the same release-profile decision. Use the approved narrow client-record preview write path with canonical online checks. Keep the reserved roster guard, selected-client policy and all unrelated gates. |
| Service mounts, flags, image and migration qualification | X-02–06 | PF-24, WS-01, ST-26 and ML-01 provide domain-specific acceptance, not four competing routing/configuration projects. |
| Draft canonical client identity | WS-04 owns schema/DTO/storage/version/list/backfill; Portfolio owns its consuming adapter | PF-09 is the cross-reference. WS-13 staging fidelity follows the same canonical identity, not a second name-based patch. |
| Meri artifact access/public contracts | WS-23/24 with the existing Meri owner | PF-23 consumes the typed bridge. Receive current FE115/Meri197 only after review; PR192 is donor lineage, not another merge. |
| Meri client/profile/file/generation entry | PF-02/03 and WS-22/24, coordinated by the existing Meri owner | Different entry points may reuse one accepted context/artifact contract. Do not implement competing authority DTOs, renderers or runtime clients. |
| Provider reply and Timeline reply | ML-05 shared sender contract; ML-20 selects/enables the product consumer | PF-25 is the Timeline pointer. ML-06 updates the legacy Meri action consumer of the same provider boundary. Canonical Meri read tools remain read-only. |
| Single-mail send safety | ML-02 transport; ML-03 durable intent; ML-04/09 reconciliation/identity; ML-07 authority | These are separate necessary layers of one send path, not interchangeable fixes. Existing OutreachSendIntent and Meri proposal machinery remain; no fake campaign records or second mail platform. |
| Newsletter staging and dispatch | WS-04/05/13 own basic saved content/client/subject; WS-15/19 own rich stage/consumer; ML-02–07/21/23 own dispatch correctness | Existing Core prepare/test/send remains the sender. Do not build a Workspace SMTP/OAuth sender. |
| Workspace collaborator/reviewer notifications | WS-08/17 own UI and recipient state; ML-24 owns SES/system delivery | Notification email is separate from newsletter campaign delivery. A single authorized test of one does not authorize the other. |
| Prospect drafts, proposals and conversion | PF-17 is the canonical new-proposal ticket: Workspace owns its durable draft/revision contract and Portfolio owns entry/receiving UI. PF-18/19 remain Core BD/Portfolio conversion/brief review; WS-25 preserves current copy/draft invariants | Existing prospect transfer denials stay. An approved transfer manifest is distinct from linking a prospect to a client. |
| Settings/Meri connection status | Mail ML-08/11/12/17/25 owns actual OAuth and mailbox identity | ST-14 either reuses/links that owner or requires a different explicit Meri grant contract; no duplicate OAuth integration. |
| Settings Memory | ST-07–10 shared governance/grants/files/notifications; ST-11 separate owner-review slice | FE115 owner review is not completion of all nine governance tabs. Runtime retention, public DTO and deployment gates remain separate. |
| Mutation receipts and recovery | PF-13, ST-24, WS-05/15/20, ML-03 retain their existing domain owners | Split by enumerated mutation family; reuse existing safe-dialog/receipt patterns. Do not create a new universal command framework to satisfy these parent tickets. |
| Hosted billing/capacity | ST-25 owns Core read + Onboard/Stripe handoff | Portfolio billing and PF-18 conversion use the same capacity/entitlement owner; no duplicate billing writer. |
| Metrics | PF-05/20 own Portfolio facts; X-07 owns seven hub cards | Define each metric's actual source/denominator/time-window and unavailable state. Similar-looking cards do not justify invented common counts. |

---

## App: universal regression matrix

### Universal regression matrix

These describe coverage across the product. Select relevant cases for the changed behavior and reuse unaffected evidence under the necessary-qualification rule above:

| Dimension | Required cases |
|---|---|
| Identity | Signed out; malformed/expired JWT; wrong issuer; absent org; one/multiple memberships; org change; removed/suspended member; role downgrade; account switch while request pending |
| Data scope | Wrong tenant; same tenant wrong owner; client wall/revoked client; archived/deleted client; no selected client; all-permitted scope versus specific client; stale resource association; wrong provider connection |
| Contracts | Required/unknown fields; null/empty; wrong enum/version; mismatched response;204 vs JSON-null/empty body; encoded IDs; malformed cursor; pagination limits; exact public DTO/provenance |
| Concurrency | Double click; overlapping edits; stale revision/CAS; request finishes after navigation; reload after timeout; provider accepted but persistence/read failed; worker claim stolen/expired; repeat callback/webhook |
| UI | Loading/empty/error/unavailable/held are distinct; disabled action explanation; keyboard and accessible labels; direct route/deep link; Back/Forward; cancel with no effect; preserved unsaved draft; truthful counts/status |
| Files | MIME/extension/magic/size mismatch; tenant storage key; quarantine/scan states; expired/revoked link; binary checksum; upload partial completion; export status polling; unsupported format; untrusted HTML/SVG/ZIP contents |
| Providers | Microsoft and Google separately; missing scopes; consent denied; account mismatch; token refresh/revocation;429/Retry-After;5xx; network loss; malformed response; pagination token expiry; no unsafe mutation replay |
| Operations | Exact image/source; service mount and prefix; schema/grants; configured off/on; scheduler owner/lag; callback reachability; rollback without data/receipt loss; logs redact secrets/private content |

---

## App: definition of done

### Definition of done

A supported feature/action is closed only when all relevant layers are proven. An owner-approved unsupported/external disposition resolves scope explicitly; it does not prove implementation. Held/deferred rows remain open, even if the first release is accepted:

- The route/tab/control exists or its deliberate unsupported/external disposition is clearly approved and shown.
- Its handler invokes the correct registered operation or bounded proxy and preserves current actor/client/conversation/revision identity.
- Request and response contracts match the authoritative mounted service; no mock/local placeholder masquerades as durable state.
- Authorization is enforced server-side for tenant, client, owner/collaborator, role and provider connection, including access changes during pending work.
- Persistence/provider effect has a durable, correlated result. Replays, conflicts and unknown outcomes have safe reconciliation semantics.
- UI refresh/readback reflects the real durable outcome without leaking old scope or erasing edits made after the submitted snapshot.
- Required migrations, storage/scanner, config, callback URLs, background jobs and feature flags are qualified on the exact selected deployment, not merely present in source.
- Source, fixture, real DB, deployed and provider-live evidence tiers are labeled separately. Every relevant negative/failure case passes or the feature stays explicitly held.
- Existing architecture/tests/security holds are preserved; no unrelated rewrite or donor duplication was introduced.
- Merge, migration, deployment, provider permission and actual send/share actions have the required separate owner authorization. None is authorized or performed by this plan.

## UI library and font stack (Neo, 22 October 2026)

Build UI with the approved stack in FINAL-PLAN §10: AI Elements, Plate, Schedule-X, React Flow, Kibo UI, ReUI Cascader, coss Origin, coss ui, shadcn/ui, Recharts, Motion, Animate UI, Sonner, cmdk, MapLibre + react-map-gl, Media Chrome + Vidstack, Lucide; fonts Geist Sans, Geist Mono, Newsreader. Use the library assigned to your ticket (Closeout plan Addendum A). Figma first: where a library has no Figma reference, the UI lane adds it before you build it. Pin versions, hashes and licenses, with free tiers only unless Neo approves. One library per pattern, and replace the custom code it supersedes. Lazy-load heavy libraries. Honour Reduced motion. Receipts, not toasts or charts, decide success.
