# Wave 6 advanced capability preparation (item 15)

Source-only work, 28 October 2026. This map follows the user's A1–A5 and A7 requirements and item 15 preparation boundary. A6 is skipped pending user requirements. No deployment, image/application build, paid provider call, independent review or live acceptance is included. A completed preparation row does not mean the entire capability is delivered.

Use existing feature owners and the Claude SDK harness. Reuse public contracts, canonical services and adopted shared UI components; keep route handlers thin. Extract shared components for repeated behavior only. Do not add parallel authority, persistence or orchestration frameworks.

## A1 — execution isolation

**Owner and current behavior.** Core owns current tenant/member/client/wall authority. Meri control's `apps/runtime/agentcore-execution.mjs` owns durable invocation and reconciliation; `agentcore-http.mjs` pins a runtime environment to tenant, actor, conversation and runtime session, serializes invocations and refuses stale writer fences. `agentcore-workspace.mjs` owns the private Linux workspace. `apps/worker/conversation/capabilities/{workspace-tools,subagents,bash-sandbox}.mjs` configures the pinned SDK's resolved-path file permissions, foreground role/tool narrowing and sandbox-only Bash. Browser activation remains held in `browser/activation.mjs`; failure never contributes an unrestricted tool.

**Requirements and dependencies.** Preserve current access checks on admission and protected operations, cancellation/expiry fences, immutable conversation identity and exact retained SDK/artifact restoration. File reads/writes must reject traversal, symlink and out-of-root access. The SDK and non-root Linux Runtime environment enforce filesystem/process isolation; the controlled egress owner enforces network limits. Child assignments already retain role, input digest, goal revision and tool narrowing. Per-assignment file selection is not implemented by the shared conversation workspace and remains a gap, not an implied guarantee.

**Source disposition.** Existing owners implement the bounded runtime/tool policy; no replacement isolation architecture is warranted. Focused checks and their precise results are recorded below. Native Linux sandbox, actual SDK symlink denial, cross-session orphan cleanup and restart isolation require later isolated native qualification; Windows fixture checks cannot establish them.

**Finite next slice.** Through the existing child-assignment and SDK permission owners, define and implement explicit selected-file delegation for a single read-only research child, with traversal/symlink, revoked access, cancellation and restart cases. First verify what the pinned SDK can enforce rather than creating a competing file gateway. File selection must narrow the conversation's authority. Full A1 acceptance also requires legitimate work, cross-user/tenant/conversation denial and absence of accessible orphaned processes/files/browser state after interruption.

**Decisions.** No new execution architecture or unrestricted browser/Bash fallback is approved. Exact selected-file delegation behavior needs a bounded implementation contract; no public contract change is made by this preparation row.

**Checks (28 October, Node 24.22.1, Windows).** `agentcore-execution.test.mjs`: 6 passed. `execution-sessions.test.mjs`: 1 passed. Initial attempts at capability/Bash and HTTP composition checks stopped at missing local dependency imports; these are setup failures, not passing behavioral tests. Native checks remain not run.

## A2 — browser takeover

**Owner and behavior.** Existing `apps/worker/conversation/browser/session/{fence,input,confidentiality,destruction,activation}.mjs` owns the prepared control fence, input validation, confidential-content filter and cleanup contract. The browser host must enforce them at one execution point. Control owns current authority and short-lived single-use viewer tickets; the frontend owns the eventual viewer and explicit connecting/agent/pausing/human/reconnecting/expired/ended presentation. These are not mounted live merely because the pure state machines exist.

**Source correction.** Settlement now checks the drain deadline before accepting a result even without an intervening poll. Completed request IDs remain consumed across takeover/return, so an acknowledgement loss cannot redispatch a completed effect. Unknown effects remain fenced and require reconciliation/reset; no late success creates a lease.

**Dependencies and decisions.** The browser gate, native host/egress qualification, session-owner placement, authenticated relay, current Core checks, confidential sign-in/MFA filter and server-side invalidation remain prerequisites. Credentials must never enter chat, agent observations or logs. Returning control requires fresh authority and a filtered snapshot. Cleanup must expose completed versus unknown. Retained state must remain conversation-bound and single-controller even across disconnect/reconnect/revocation. Existing historical Q-X references are evidence lineage, not authorization to activate.

**Acceptance and finite next slice.** Integrate the existing fence and privacy filter with a synthetic local browser-session owner and single-use viewer ticket path; demonstrate no overlapping input, no confidential frame leakage, no replay, expiry/revocation and accurate destruction outcome before any real website. Then connect shared frontend controls to those authoritative states. This batch does not claim that integration or live acceptance.

**Checks.** 24 passed, 0 failed/skipped across `fence.test.mjs`, `input-activation.test.mjs`, `confidentiality.test.mjs`, including both new counterexamples. Pure source fixtures only; native browser, relay, UI and real identity-provider acceptance not run. Activation remains held.

## Remaining preparation

A3 authenticated sites, A4 device/browser bridge, A5 federal drafting and A7 Collabora/WOPI preparation are processed individually after these rows. A6 graph/buyer/funding work is explicitly skipped. No unprocessed row is complete.

## A4 — user-device/browser bridge

**Disposition and owners.** Requirements preparation only. The existing cloud browser (`apps/worker/conversation/browser/{server,runtime,workspace}.mjs`) does not accept an extension, remote CDP endpoint, local browser profile or device credential. It cannot establish device identity or consent. No demonstrated device-pairing receiver exists in this source lane. Reuse Core account authority, control conversation/run lifecycle, browser approval/receipt boundaries and the existing upload/artifact custody owner when a transport is selected; do not create another agent loop or general device connector.

**Required behavior.** Pair a specifically supported device/browser to the current account with explicit consent. Show connected, active, paused, disconnected, expired and revoked states. Each operation binds user, tenant, device, conversation, selected tab/file/destination and exact input digest. Pairing grants no filesystem/profile/credential access. Explicit selected-data upload consent and consequential-action approval are separate. Pause/revoke and account switch stop admission immediately. An interrupted effect is resolved from its original receipt; reconnection never replays a spent or uncertain request. Selection changes invalidate old operation authority.

**Dependencies and pending decisions.** Supported platforms, first operations, adopted transport/extension, distribution/update/licensing, managed-device policy and retention remain user decisions. Public device/session/request/receipt contracts and any persistence migration require coordinated ownership before editing. A3 is a dependency only for named website actions, not for a selected-file transfer. No pairing request or device connection is made by preparation.

**Finite next slice.** After the platform/transport decision, deliver pairing plus one explicitly selected read-only tab or file operation, pause/revoke, account-switch invalidation and durable outcome readback. Keep action execution on the selected device and reuse shared connection-state UI primitives. Add no broad filesystem, clipboard, cookie or credential capability.

**Acceptance.** Positive selected-resource transfer; other user/tenant/device/tab and stolen/expired pairing denial; selected hash/path and symlink denial; disconnect-before/after effect and lost acknowledgement recovery; pause/revoke/account-switch denial; no hidden credential/profile content; accurate unresolved state. Source inspection only for this row; no bridge exists to test and no live/device acceptance is claimed.

## A3 — authenticated website workflows

**Owner and behavior.** `browser/site-workflows/manifest.mjs` owns credential-free workflow manifests, policy narrowing and enablement preparation. `browser/{permissions,approval-binding,downloads}.mjs` owns exact interaction approvals and download custody. Session/fence/confidentiality/destruction owners from A2 retain authentication only for the authorized conversation and stop after expiry, logout or revocation. The approved registry is empty; no site/task has been approved or enabled.

**Source correction.** Approval now binds the entire manifest hash as well as site/task/version. Changing task, origins, downloads, privacy selectors or retention under an old version label cannot inherit approval. Empty or malformed activation evidence is refused. No public DTO, registry entry or activation flag was added.

**Dependencies and decisions.** User must name first sites/tasks, permitted actions and redirects, site terms and retention limits. The existing eight-hour ceiling is a source constraint, not current approval of a site's retention policy. Takeover sign-in, confidential input exclusion, private session custody, reviewed exact consequential target/data, consumed/expired approval refusal and unknown-action reconciliation precede exposure. Downloads must enter existing artifact handling with source/version provenance. Material site/sign-in changes require renewed qualification.

**Finite next slice and acceptance.** Once named, add one complete credential-free manifest with reviewed terms and exact digest, then qualify sign-in, reuse only within the same conversation, logout/expiry/revocation, target/data-bound approval and timeout readback using that site's actual workflow. No credential collection in chat, cross-conversation session inheritance or blind replay. Until then maintain the empty registry and explicit unavailable state.

**Checks.** Six manifest/policy tests passed, including changed-content approval refusal and malformed activation evidence. Synthetic sites only. Real site, browser, sign-in and terms acceptance not run. A1 dependency follow-up also passed all 11 HTTP/session-isolation cases; capability/Bash imports still require local package setup and native SDK/filesystem proof remains unrun.
