# Meri package 3: feature-design decision review

Reviewed 15 October 2026. Read-only review; no implementation, account, purchase, vendor contact, permission change or deployment.

## Exact sources and authorization boundary

- Integrated package: [`81e20025b7a805ac28a44f2044df87b0ebab905b`](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/reports/FABLE-REPAIR-PACKAGE-3-20261015.md).
- Design branch resolved to [`c827406a7a7a261996bfdea3625218f715c6f544`](https://github.com/neo-capiro/meri-greenfield/blob/c827406a7a7a261996bfdea3625218f715c6f544/docs/coordination/proposals/FABLE-FIRST-SHIPMENT-FEATURES-DESIGN-20261015.md). The same design is present in package 3, with identical Git blob `f4c9be9b345d0920dc21f5209f206e2e6e096002`.
- The [Fable owner-decision record](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/reports/FABLE-OWNER-DECISIONS-20261015.md) relays an earlier decision to include all four features in the first shipment. The design itself explicitly awaits owner approval. Repository prose is evidence of what Fable recorded, not fresh authorization to approve designs, spending, device permissions or placements. The recommendations below require the user's decision where indicated.
- Package 3 remains HOLD. This review does not independently rerun its reported tests or close source, live, security or deployment gates.

## Recommended answers to the five decisions

### 1. Four features and build order

Recommend the proposed dependency order: finish usable conversation, tools, artifacts and existing safety prerequisites; then exclusive browser takeover; then one named authenticated-site workflow. Evaluate Office editing on a separate parallel track. Leave the own-browser bridge last because it introduces the largest new trust boundary.

Keep the first versions narrow: owner-only takeover with one driver, no recording, no clipboard/device-file synchronization; one editor per DOCX/XLSX/PPTX session, immutable saves, PDF preview only; user-performed sign-in each conversation; desktop only. Reuse the existing browser, lifecycle, approval, artifact and Temporal owners rather than adding a second orchestration system.

The user must confirm whether all four are release-blocking first-shipment requirements. Calling the editor optional or moving it later would amend Fable's recorded scope, not simply accept its design. Fable estimates 30–47 engineer-weeks excluding prerequisite HOLD work, procurement and cloud actions; this is an author estimate, not a validated delivery date. [Design §§0, 6.6–6.9](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/proposals/FABLE-FIRST-SHIPMENT-FEATURES-DESIGN-20261015.md#66-recommended-build-order)

### 2. Collabora and subscription budget

Recommend Collabora-through-WOPI as the evaluation candidate. Do not approve a production purchase yet. First establish round-trip fidelity, deployment fit and a written commercial quote covering Meri's embedded/multi-tenant use, eligible users, support, branding, billing term, renewal/cancellation conditions, taxes and any minimum commitment. Add hosting and concurrency costs before requesting a bounded spending approval. No numeric budget is inferred.

Collabora's official FAQ distinguishes the supported subscription edition from CODE, a rolling development edition without SLA/LTS that the vendor does not recommend for production. The source is MPL-2.0, but an open-source license is not a verified commercial offer for this specific deployment. [Official FAQ](https://www.collaboraonline.com/faqs/), [source license](https://raw.githubusercontent.com/CollaboraOnline/online/master/COPYING).

Correct the design's pricing rationale: its blanket assertion that CODE is limited to 10 documents/20 connections is outdated. Collabora's September 2026 clarification says default CODE has no such limit; those limits apply in Home Mode. This does not establish suitability or support for production. [Collabora clarification](https://forum.collaboraonline.com/t/does-collabora-code-26-04-2-4-have-any-user-or-concurrent-connection-limits/5023).

The public subscription page advertises standard tiers, but it does not establish Meri's actual SaaS/integration price. No vendor contact or purchase was performed. [Subscriptions](https://www.collaboraonline.com/subscriptions/).

### 3. Own-browser bridge outside Meri's network controls

Recommend only an explicitly opt-in, separate user-device trust tier, with read-only default, selected tabs and selected approved public sites, visible connection state, and immediate local disconnect. No other tabs, browser profiles, local files, cookie export, background attachment or arbitrary CDP access. Interactions require separate enablement and existing per-action approval. Model-visible snapshots can contain sensitive signed-in data even when the tool is described as read-only.

The user must explicitly accept that redirects, subresources and network traffic on their own browser are outside Meri's infrastructure egress boundary. Do not describe software navigation filtering as equivalent protection. Installation, persistent pairing and browser permissions remain separate user decisions; this review grants none.

A design conflict needs correction: the bridge is advertised as supporting VPN-only intranets, but the proposed reuse of public-only URL validation refuses private-network destinations. Keep private-network access out of the initial design unless the user deliberately approves a separately reviewed boundary. Prove that the filtered CDP/Playwright integration actually enforces read-only behavior; allowing internal evaluation by the Playwright session is not itself that proof. [Design §§2.1–2.6](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/proposals/FABLE-FIRST-SHIPMENT-FEATURES-DESIGN-20261015.md#2-feature-1-devicebrowser-bridge)

### 4. First authenticated sites and workflows

The source does not name actual first sites. Ask the user for one or two website + exact task combinations, starting with retrieval or export rather than submission, payment or account administration. Outlook/SharePoint retrieval can be a suggestion if it matches their needs; prefer an existing connector/API, and use browser automation only for a concrete missing capability. Do not count connector work as browser-workflow acceptance.

Recommend C1: the user signs in through exclusive takeover; session state stays in the isolated conversation profile and is removed on disconnect/close. No cross-conversation session vault or service-account credential store in this first version. Each selected site needs its actual origins and identity-provider redirects, terms review, tenant/role controls and live qualification. [Design §§5.1–5.10](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/proposals/FABLE-FIRST-SHIPMENT-FEATURES-DESIGN-20261015.md#5-feature-4-authenticated-third-party-website-workflows)

### 5. Placements

Recommend these logical homes, subject to explicit placement approval:

- Schedule dispatch: control-domain managed Temporal worker on a dedicated queue, reusing the schedule authority and approved-instruction owners. Keep Temporal as the sole scheduler and keep database credentials out of the disposable conversation runtime. This may be a separately supervised worker process/service; it need not become a new scheduler product.
- Live/bridge relay: a bounded control-domain transport, reusing existing identity/authority, with separate tickets, rate/backpressure limits and no payload persistence. Do not build a generic remote-device gateway.
- Takeover session owner: the existing isolated browser-host boundary, using the same Playwright integration. Requalify the changed launch path and relay separation.
- Editor: disposable, single-session containers with short-lived single-document WOPI access and the existing artifact owner. Prefer existing approved hosting if it meets the real editor's sandbox constraints; create a new host class only if measurement requires it. No shared cross-tenant warm state, and no custom editor fleet beyond the required lifecycle.

Placement approval is not deployment, spending, migration or credential approval. The schedule source is composed but unregistered; it still lacks production current-authority and approved-instruction ports. [Schedule placement P-L6-2/P-L6-3](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/proposals/FABLE-L6-SCHEDULES-PROPOSALS-20261015.md), [feature placements §§6.2–6.5](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/proposals/FABLE-FIRST-SHIPMENT-FEATURES-DESIGN-20261015.md#62-dedicated-isolated-browser-host-d005).

## Small but necessary corrections before design acceptance

1. **Takeover exclusivity:** deny new agent calls and drain/fence existing ones before granting the user's lease. Merely pausing subsequent tool calls leaves a race with an already-running interaction. On lost stream or timeout stay paused; hand-back requires explicit resume and a fresh safe snapshot.
2. **Login confidentiality:** suspend model-bound snapshots/screenshots and redact inputs throughout takeover, including OTP and other non-password credential fields. Password masking alone does not support the claim that credentials cannot reach the model. The host still handles session cookies; say the model and logs do not receive credentials rather than claiming the whole system has no credential custody.
3. **Disconnect correctness:** the design only calls clearCookies plus optional logout. Clear or destroy all relevant authenticated state, including local storage, IndexedDB and session tokens, and prevent subsequent in-flight actions. Prefer a clear context/profile lifecycle over a new credential manager. Test actual invalidation; cookie deletion alone is insufficient.
4. **Editor saves:** define autosave, explicit save, CAS conflicts and immutable version creation coherently. A WOPI session must remain usable across successive saves; a native validation gate must not silently discard the user's draft. Preserve pending bytes for recovery without publishing them until checks pass.
5. **Security policy changes:** a pinned site-manifest version must not delay urgent disable/revocation until the next run. Keep the current authority/withdrawal check effective during an active run, consistent with the proposed revocation target.

These are design-review findings, not demonstrated live exploits. A small qualification spike for the pinned Playwright session/relay and WOPI lifecycle would resolve the major technical uncertainties before broad implementation, but any new-component work still needs the design approval required by the repository.

## What can proceed and what needs a user decision

Within already-authorized repair/review work: finish existing chat/tool/artifact and safety defects; review contracts; prepare synthetic acceptance cases; verify official vendor information; refine these designs. Do not reinterpret that work as approval to build the four new components.

User decisions still needed: release scope, bounded design/placement acceptance, bridge trust tier and device access, named first sites/workflows, and eventual vendor budget/terms. New cloud resources, paid commitments, credential persistence, extension permissions and live activation remain separate consequential steps. Nothing here opens a gate.
