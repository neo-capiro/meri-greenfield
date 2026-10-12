# Plan alignment and shared frontend coordination

The primary read both newly supplied 9 October plans and the owner's 11 October shared frontend handoff while continuing implementation. The approved first-release scope remains intact. G0 is accepted; G1 remains OPEN and no later deployment gate is accepted by these source changes.

## Read inputs and authority

| Input | Exact identity | Meaning |
| --- | --- | --- |
| Uploaded Codex/Hermes deployment plan | 44,322 bytes; SHA256 `948f5fa6b3d76f1e6df72496f85d7e09d25cc397bc0f8e1efe0ab58fe0eda560` | Original 9 October architecture, phases, UI and release criteria |
| Uploaded Greenfield Agent Plan DOCX | 57,656 bytes; SHA256 `80a96320bde810214127919ddfe14659e3efd44d7ee7f6ae57d51527bc814ad7` | SDK/open-source adoption and full first-release product responsibilities |
| Adopted repository deployment plan R2 | SHA256 `43f9be7c385a1e321dbc9721bd7ff97752031a62e661f7691b78e0a20fd7c388` | 10 October retrieval/catalog/skill/native-discovery and reliability updates; earlier plans continue for unaffected requirements |
| Owner's shared frontend handoff | Supplied 11 October, recorded 19:20 America/New_York | One canonical frontend application/image and Portfolio-first shared integration |

The latest explicit user instructions govern repository placement and the shared preview. Prior approved exceptions include the dedicated isolated browser host after measured Fargate failure. Hermes is unavailable on this runner, so bounded Codex workers provide implementation with independent review; no Hermes session is claimed.

## Requirements retained

The Claude Agent SDK remains the sole production agent loop. AI SDK is UI transport; AI Elements/shadcn and the approved Figma frames supply interface patterns. Playwright supplies browser work and UI verification; Temporal supplies durable workflows, approvals and schedules. New authorized connectors access canonical Capiro business records and Institutional Memory without importing the current agent or placing credentials in workers. Native Word/spreadsheet/slide/PDF generation, inspection, immutable revisions, previews, downloads and governed filing remain required. SDK mirroring does not substitute for verified native transcript/workspace persistence, generation fencing or side-effect reconciliation.

All selected capabilities, agreed data domains, governed memory, 14 proposed named workflow skills, Commitments & Deliverables, source/evidence/freshness/coverage behavior and quantitative release gates remain in the queue. The 75 approved real-request corpus is a later release dependency; it does not block synthetic G1 qualification. No synthetic fixture or schema is represented as an implemented source handler or production capability.

## Shared frontend decision

All product frontend source belongs to `neo-capiro/capiro-frontend/apps/web` and existing public frontend packages. The owner requires one reviewed frontend image at `https://portfolio-preview.app.capiro.ai/`; its root uses `CAPIRO_DEFAULT_PRODUCT=portfolio`. `/portfolio`, `/meri` and qualified Modules routes share that application. Separate feature branches are integrated before building; they are not separate service overwrites. Meri's backend remains `neo-capiro/meri-greenfield`; Portfolio/Modules services remain `neo-capiro/capirov2`.

The current published frontend base `02c02d95bdf3949662b9123f425271c6491ffdab` predates the owner's ongoing local Portfolio `apps/web` consolidation. That newer source, public interfaces and `HeaderFrame` must be published and reviewed before final shared-shell reconciliation. The new Meri Home+cited-answer source has older-base preservation acceptance only. Keep original branches and their raw evidence; do not ship the older candidate as the combined preview. No live new-Meri origin, identity/source connection or signed-in acceptance is assumed.

The recorded preview stack/service/build/ECR names are inventory references, not fresh authenticated deployment facts. Before shipment, the shipper reads the actual caller, stack, service/task digest, build project, TLS/DNS/Clerk/ingress and rollback configuration. No frontend image build/deployment/DNS change or backend activation is performed here. Heavy Next builds and browser cohorts run sequentially on this host.

## Cleanup1 and merge boundary

Fresh [coordination request](https://github.com/neo-capiro/capirov2/pull/2392#issuecomment-6115067919) was posted under the continuation's explicit coordination direction. Observed Cleanup1 head `03d85a40e390f8f52614aab20427a3a9433786bb`, base main `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. A current owner response and final exact path agreement are still pending; the request itself does not invent agreement or accept C1.

Meri claims no `capirov2` source path, public 0.1.0 contract change, Capiro API/auth/CORS/schema/migration/source adapter, shared fixture, identity/grant, SQL, native job/quota or resource cleanup. Read-only references and isolated new-repository source continue. Final affected merge/release waits for the required coordination, source checks and fresh expected heads.

## Current implementation and holds

- Build source membership repair is independently accepted as a partial source prerequisite; fresh runner proposal inspection remains NOT_EXECUTABLE and cannot drive legacy prepare/execute.
- Native checkpoint borrowed-parent boundary has source-only acceptance. Independent review correctly held the optional SessionStore adapter on an accessor-based foreign-project dispatch; a frozen inert-data repair is undergoing a fresh independent review. Original bug proof and tests remain.
- Home+cited-answer route/assets/interactions have independent older-base preservation acceptance. Actual Next build and desktop/mobile behavior/visual checks pass; final Portfolio/HeaderFrame compatibility remains open.
- Current security research retains all 47 old-image findings plus older obligations. A coherent supported patched Trixie set is not established. GnuTLS pending applicability/fix assessment and Poppler are still explicitly vulnerable in refreshed Debian records. No patch/image/risk approval is fabricated.
- A read-only Windows runner fingerprint collector is being implemented to obtain exact runtime/helper/AWS-CLI metadata, with no STS or AWS mutation. Actual Windows acquisition and new execution authority remain separate requirements.

Before any new AWS build, the primary must produce the exact supported source/component/context/runner/action/cost/cleanup packet and the shipper must qualify it. Production release still requires the tested immutable candidate and its explicit G7 authorization. Completing a source wave does not complete the plan.
