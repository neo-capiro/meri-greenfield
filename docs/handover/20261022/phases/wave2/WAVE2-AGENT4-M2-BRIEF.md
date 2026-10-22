# Wave 2 · Agent 4 · M2: General or client chat (DRAFT: send only after Wave 1 closes; Neo's rule, fresh "agent 4 v{next}" session)

**From:** Fable. **Lane:** U (Meri screens plus Core-for-Meri). **Repository:** neo-capiro/capiro-frontend plus neo-capiro/capiro-backend (Core bootstrap). Branch from the current default branch head at send time.
**How we work:** you build; dot's reviewers review; Fable gates, merges and ships. Draft PRs only; no merges, no AWS; list tests run and not run; mutation-check every new test. Read `WORKFLOW.md` (meri-greenfield `docs/handover/20261022/`).

## Sources of truth
The two master closeout plans (20261021), `STANDING-RULES.md`, and the tickets below, verbatim. Implement each ticket's bounded work and meet its acceptance exactly. If anything conflicts or is left open, ask on #202; don't decide.

## Plan row (FINAL-PLAN §5)
| **M2** · General or client chat | R + U | **Client-optional chat** (details below). New conversation, conversation list, switching and history (MF-09). Automatic client context MG-05. Selected skill and scope kept MG-02. "Ask Meri about this client" PF-02. Cross-module context MF-19 (context part). | M1, and Neo's decision on reads across clients | E06, E45 (context part), and the client-optional checks below |

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



## Neo's decision 2
General chats read across the clients a user can see, with walls enforced per result. Keep it simple: if letting actions span clients is easier, that's fine. No new authorization machinery.

## UI libraries for this phase (FINAL-PLAN §10, Neo 2026-10-22)

- AI Elements: Conversation, Message, PromptInput, Suggestion (masters `337:34389`, `337:34390`, `340:34888`)
- cmdk: Meri search and command palette (01.05 `1064:144529`, 01.05A `3034:37943`), conversation switching (MF-09)
- Motion: Artifact workspace panel (`358:35394`), workspace rail (`350:35446`), history filter menus. **No Figma motion spec yet:** agent 4 adds durations, easing and enter/exit to 06 · Shared UI patterns (`1103:280888`) before building. Honour Reduced motion (09.01)
- Animate UI: Animated icon button (`1103:280937`) for send, stop, copy and regenerate
- Sonner: Copied, Conversation deleted overlays ("Capiro 3.4 / Library patterns / Sonner …"), shown only after the receipt
- Fonts: Geist Sans and Geist Mono; Newsreader only where Figma uses it
- Rules: Figma first, pinned versions and licenses, one library per pattern, lazy-load heavy libraries, receipts decide success (§10.4).

## Tickets (verbatim)
#### MF-09 — Add conversation management only after its public contract (P1 core history; P2 optional destructive actions)

- **Root cause / evidence:** Recent list/transcript/new conversation exist; search/title/rename/archive/delete/restore are fixture-only, and public history family offers no such mutations.
- **Bounded files/owner:** New `shared/meri-conversations/management-*` receiver/proxy only after published contract; `ConversationRecents`, history/management screens and ordinary routes. Backend conversation owner owns schema/mutations.
- **Implementation:** Decide title ownership/autotitle versus user title; search scope/index; archive versus retention deletion; recovery/trash and active-run semantics. Publish owner-scoped paginated searchable summary and revision/idempotency-protected mutations. Then mount real history/search/palette and management actions with loading/empty/denied/error/uncertain/reload states. Preserve conversation/client/run routing and clear removed records from all lists.
- **Dependencies / exclusions:** MR/backend owner contract; ST-18 deletion/retention; PF/ST28 context. Do not use fixture state as durable truth or relabel archive as deletion.
- **Acceptance:** Rename/archive/restore survives reload and another tab; search/filter/pagination respects wall/client/actor; conflicting revision safely refreshes; delete requires chosen recovery semantics and explicit confirmation, active run policy enforced server-side, uncertainty reconciles same request.

#### MG-05 — Deliver automatic canonical client context to ordinary chat

**Priority:** P1 full everyday-client requirement; alias Forward B1 and R02/R04/R08. **Root cause:** A callable get_client_context tool and client-scoped navigation do not prove ordinary chat receives canonical facts automatically. Existing audit establishes the read tool, not the complete automatic context path. Treat implementation presence as to-be-reconciled, not presumed absent.

**Bounded owner/files:** Current Core canonical client/profile/engagement read owner and its existing authorized adapter; Meri current conversation input/context assembly and selected/native read path; no imported old Context Plane, recursive public-tool call or new profile store. Reuse current schema/receipt provenance and caches only if actor+tenant+client+relevant revision keyed. MT provides exact canonical reader paths; MM01/17 preserve memory/provenance.

**Work:** Assemble a compact, task-appropriate authorized context packet before ordinary model work: identity/exact identifiers; capabilities/mission; objectives/active matters; constraints/exclusions; footprint/people; open commitments and critical approved decisions/corrections. Proposed2–4Ktoken budget is a measured start, not an immutable cap or mandatory full history fetch. Include source IDs/revisions/as-of/count-or-sample semantics and explicit gaps. Resolve selected versus explicit other client/portfolio/external subject server-side; do not let selection hijack the user's question. Separate canonical facts, approved shared memory, user preferences and ephemeral conversation. Current instruction overrides stylistic defaults, not source truth.

**Acceptance:** Rich/sparse profiles, paraphrases, selected-client switch, explicit other subject, same-name ambiguity, approved correction in new thread and denied wall sections. Critical seeded identity/constraints/corrections are correct or clearly conflicted/unavailable; six profile sections available without model choosing a tool. Source/permission changes invalidate context before release. Measure actual token/call/latency effect; no full database dump or stale-client leak. Links to MF19 context handoff and MG01 corpus, not a replacement for them.

#### MG-02 — Preserve selected skill, scope and normalized window across every UI lifecycle path

**Priority:** P1 original-scope consumer; aliases R03/R07/R08, REL04, RG02/RG06/RG12. **Root cause:** Real chat input contracts/journals already carry some selected metadata, but no complete ordinary launcher consumer/receipt demonstrates every original skill/version/window through all lifecycle actions. MF18 generic template work is insufficient without these explicit tests.

**Bounded files:** Existing frontend composer/launcher/setup components, `shared/meri-conversations` initial-input/query/turn journals and new lifecycle adapter from MF10; existing Meri `packages/contracts` skill/window schemas, `control/conversations/skills/admission.mjs`, `worker/conversation/skills/selected-runtime.mjs` and current manifests owned by MT13. No parallel skill registry.

**Work:** Expose14 named launcher identities and exact available versions with disabled reasons until qualified. Submit stable skill ID/version plus typed scope/window, not just expanded prompt text. Server resolves entity and exact timestamps/timezone/week/FY/version, pins immutable manifest and returns displayable normalized receipt. Preserve receipt through reload/reconnect/steer/resume/fork or require an explicit reviewed version/goal change; do not silently pick latest. Handle selected client versus named other subject, mixed/portfolio domains, chosen dates conflicting with text, unavailable sources and current grant loss. Ordinary free chat must not become a comprehensive skill by keyword.

**Acceptance:** Every14skill workflow tests exact identity/window at submit, steering, lost-response recovery, reload, reconnect, resume and fork; mismatched manifest/hash/version rejected; source families cannot be dropped by memory keyword or single-family routing. DST/week/FY/version edge fixtures pass100%; prompts remain draft until explicit send; no capability widening. MT13 owns installed runtime and MM15 owns output, not this consumer.

#### MF-19 — Unify cross-module context and completion links (P1/P2, shared contract)

- **Root cause / evidence:** Client-scoped home links exist but PF Ask/Create and Workspace/Mail object handoffs require richer canonical context; action outcomes do not uniformly link canonical records.
- **Bounded files/owner:** One canonical context DTO/route helper owned with PF-02/03, WS-22–24, ST-28 and ML-06; Meri entry parser, composer starter and receipt link components.
- **Implementation:** Carry only canonical IDs and user-approved draft/context through links or validated bootstrap; re-read source under current identity, show selected client/object/evidence and permit explicit scope correction. Preserve exact mail sender/thread/connection via ML contract, not a freeform prompt. Link completed task/file/research results to original canonical object. Back/forward/client switch must retire stale pending context and not resubmit.
- **Dependencies / exclusions:** PF-02/03, WS22–24/tasks, ST-28, ML05/06 and relevant MM/MT contracts. Do not duplicate those projects or embed sensitive source text in URLs.
- **Acceptance:** Portfolio client→Meri→task/file→canonical detail roundtrip survives reload; invalid/foreign/stale IDs fail closed; mail actions retain exact reviewed connection/thread; new client selection cannot dispatch prior client proposal; no auto-send merely by opening a deep link.

#### PF-02 · P1 · “Ask Meri about this client” has no canonical context handoff

**Evidence:** [ClientMeriActions.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/ClientMeriActions.tsx#L40). The disabled dropdown has no request/receiver, whereas independent Meri entry exists elsewhere.

**Root cause:** No allocated Portfolio-to-Meri context/bootstrap contract for the currently authorized client.

**Bounded work:** Add a typed navigation/command handshake carrying canonical client ID, active client scope, actor/tenant epoch and a reviewed initial intent. Reuse the existing Meri bootstrap/session authority instead of inventing a parallel conversation endpoint. Receiver must resolve fresh client authority, return/retain canonical conversation/run/request IDs, reject changed/archived scope, and keep any unsent prompt separate from dispatch. UI becomes enabled only from an explicit capability receipt. Do not pass confidential profile content through arbitrary URL parameters.

**Dependencies:** Meri public contract/source owner and first-chat/runtime admission; shared selected-client gate.

**Acceptance:** Clicking from two different clients cannot cross-bind history; revoked/archived client refuses without starting a run; reload/uncertain ACK recovers the same request rather than creating another conversation; source context is visible to the user before meaningful generation. Native fixture plus actual authorized service receipt required.