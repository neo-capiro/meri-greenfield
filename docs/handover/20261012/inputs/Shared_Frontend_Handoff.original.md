# Shared frontend preview and concurrent-agent guidelines

Recorded 11 October 2026, 19:20 America/New_York. This is the owner's requested\
coordination handoff for the concurrent Portfolio, Meri and Modules frontend\
work. It describes the intended shared deployment and distinguishes that plan\
from the live state that still requires authenticated read-back.

## Deployment decision and current status

**Keep `https://portfolio-preview.app.capiro.ai/` as the shared frontend preview.**\
The name can remain Portfolio-specific while the deployed application contains\
Meri, Portfolio and, when implemented and qualified, Modules. All three product\
frontends belong to `neo-capiro/capiro-frontend` and the canonical Next application\
`apps/web`. They ship together as one reviewed frontend image. Separate feature\
branches are merged into that source; they are not deployed independently on top\
of each other.

| URL                                | Intended behavior                                | Present implementation boundary                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                | Redirect to `/portfolio` on this preview         | `CAPIRO_DEFAULT_PRODUCT=portfolio` is already part of the preview image configuration.                                                                              |
| `/portfolio` and its client routes | Portfolio experience                             | Source implementation is continuing; signed-in acceptance remains open.                                                                                             |
| `/meri`                            | Meri experience in the same frontend application | Current accepted frontend contains a disclosed synthetic fixture; live runtime integration is separately qualified by the Meri owner.                               |
| `/modules` and owned child routes  | Modules experience in the same application       | Planned route family for the Modules owner; do not claim existing screens or enable an empty destination. Agree any additional top-level routes before adding them. |

The previous handover records an existing isolated ECS/Fargate preview service,\
an admitted image and a healthy target. It also records that the exact preview\
DNS alias and Clerk allowed hostname were absent, with no signed-in acceptance.\
The current session's web fetch could not access the hostname; this does not\
independently establish the present AWS or DNS state. Fresh authenticated AWS,\
DNS and Clerk read-back is required before claiming the URL is live.

This session has installed GitHub and AWS CLIs. GitHub publication and AWS\
authentication are still pending. The Portfolio continuation and consolidation\
are currently local on `codex/portfolio-continuation-20261011`; do not assume that\
branch can already be fetched from GitHub. Its documentation checkpoint is\
`ae57104`; additional source batches are still being qualified. The existing\
Meri draft PR #1 is another author's work and must be preserved.

## How the combined application will ship

1. Integrate reviewed frontend changes into one source commit in\
   `neo-capiro/capiro-frontend`. Merge the canonical Portfolio consolidation\
   before resolving dependent paths or shared-component changes. Feature owners\
   retain their own branches and return small, reviewable changes.
2. From the repository root, run the package/type/architecture/lint/unit checks,\
   complete browser suite, Next build and actual standalone production smoke.\
   Review the affected Figma screens and cross-product navigation. Run heavy\
   builds separately from local browser cohorts on the current host.
3. Authenticate AWS and read the existing preview's current caller identity,\
   stack, service/task image, build project, certificate, DNS, secret references\
   and ingress. Preserve actual deployed configuration and capture the current\
   digest for rollback.
4. Archive the exact repository-root commit with `source-commit.txt`, upload it\
   to the existing versioned source object, and run the existing CodeBuild\
   project against that exact object version. Use\
   `apps/web/deployment/portfolio/buildspec.yml`; it runs the shared-root gates,\
   builds `apps/web/Dockerfile`, smokes the image and publishes it to ECR.
5. Admit the exact image digest after its fresh scan and container checks.\
   Prepare and inspect the isolated preview service change set, tell the owner\
   the concrete shipment action, then update that service. The build role itself\
   does not update ECS, DNS or the existing backends.
6. Reuse or finish the exact preview DNS/HTTPS/Clerk hostname configuration if\
   current read-back shows it is missing. Keep the existing narrow authorized\
   preview ingress. Verify ECS steady state, actual task digest, `/healthz`,\
   HTTPS, sign-in, tenant selection and supported product flows.
7. Roll back an image regression by restoring the previously verified frontend\
   digest and configuration in this preview service. Existing production hosts\
   and backend services retain their independent deployment ownership.

The recorded resource names are `Capiro-Portfolio-Preview-Service`, ECS cluster\
and service `capiro-portfolio-preview`, ECR repository `capiro/portfolio-preview`\
and CodeBuild project `capiro-portfolio-preview-build`, in account `967807252336`,\
region `us-east-1`. These are inventory references for fresh reads, not proof of\
current state. A product's frontend merging into the image does not deploy its\
backend or activate an unqualified API.

## Instructions for the Meri and Modules frontend agent

### Work in the canonical repository and application

- Put all frontend changes in `neo-capiro/capiro-frontend`, inside `apps/web` or\
  the existing public frontend packages. Do not create another Next application,\
  frontend repository, Docker image or hostname to merge into this preview.
- Portfolio is owned by the Portfolio continuation. Meri owns its frontend\
  feature area and Modules owns its implemented feature area. Use dedicated\
  branches/worktrees and declare changed files. Preserve draft PR #1 and every\
  other contributor's work.
- Next route files compose views. Put feature presentation, interaction,\
  validation and API contracts in focused owners. Keep dependencies directed\
  toward shared foundations; use another feature's deliberate public interface\
  rather than its private files.
- Read root `AGENTS.md`, `apps/web/AGENTS.md`, `docs/IMPLEMENTATION-STANDARDS.md`\
  and `docs/ARCHITECTURE.md`. The owner waived the agent-ops repository\
  prerequisite for this continuation.

### Share resources where their semantics match

| Responsibility                                   | Canonical owner / rule                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application, routing and build                   | `apps/web`, one root workspace install and lockfile                                                                                                                 |
| Reusable UI primitives                           | `packages/ui` and its public exports; reuse the adopted controls and preserve upstream provenance                                                                   |
| Common header geometry                           | `apps/web/src/shared/shell/HeaderFrame.tsx`, using its explicit slots                                                                                               |
| Meri browser event/transport projection          | `packages/meri-client`, consuming versioned public Meri backend contracts                                                                                           |
| Portfolio domains                                | `apps/web/src/features/portfolio/*`, using deliberate `public.ts` / `*-public.ts` entries                                                                           |
| Existing Portfolio foundations                   | `apps/web/src/shared/portfolio/*`; keep product-specific semantics here until a real cross-product caller justifies promotion                                       |
| Cross-product styling and identity               | Coordinate changes to root layout, theme, session boundary, shared shell and providers; do not install overlapping competing providers or global CSS resets         |
| Shared contract, dependency and deployment edits | One integration owner per change; reconcile consumer requirements before editing shared exports, lockfiles, route configuration, Dockerfile or deployment templates |

Reuse a resource because its behavior and ownership match. A generic button,\
dialog or header is shared; a Portfolio capability writer remains a Portfolio\
owner. When two real products need the same foundation, promote the existing\
implementation through a small reviewed public interface and migrate both\
callers. Do not copy the implementation or build a generic workflow framework\
in anticipation of possible callers.

Avoid god files and arbitrary fragmentation. Review first-party files above\
400 nonblank lines and functions above 80, together with the responsibility\
triggers in the implementation standards. A size threshold calls for a specific\
cohesion review; it is not an automatic split rule or a blanket exception.

### Implement the current Figma designs

Use the relevant product frames in the shared\
[Capiro redesign file](https://www.figma.com/design/Zc2dEN5aLU47dVdsewDmiJ/Capiro-3.0-UI-Redesign?node-id=411-40601).\
Portfolio begins at node `411:40601`; Meri and Modules should use their actual\
frames in that file. Inspect the target and component context before coding,\
reuse existing tokens/assets/components, and compare desktop, phone, theme and\
keyboard behavior. The owner permits authoring a missing component in Figma\
before implementation. Keep unrelated frames and components intact.

Coordinate shared shell and navigation changes with the Portfolio owner. A\
same-document route transition must not leave another product's styles, dialogs,\
queries or selected client state active. Only enable destinations whose routes\
and behavior are implemented and qualified. Fixture content must stay labelled\
as synthetic until live integration is actually verified.

## Existing services, database and institutional knowledge

| Area                                                                      | Backend owner                                                                                                 | How the frontend consumes it                                                                                                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portfolio and Modules business data                                       | `neo-capiro/capirov2` existing Core, Engagement, Strategy, Workspace and Intelligence services, as applicable | Existing typed, authorized service APIs. Portfolio's narrow same-origin adapter is `/api/backend/[service]/[...path]`; preserve its allowlists, deadlines and failure handling. |
| New Meri execution, control and trusted event production                  | `neo-capiro/meri-greenfield`                                                                                  | The Meri owner's versioned public runtime/transport contracts and qualified server endpoint. A frontend package is not an agent-runtime implementation.                         |
| Canonical Capiro identities, clients, records and institutional knowledge | Existing Capiro data and service owners                                                                       | Reuse canonical IDs and authoritative records through the existing service boundary or Meri's explicitly qualified connector.                                                   |
| Meri operational state                                                    | New Meri backend's own runtime stores                                                                         | Conversations, run/control state, checkpoints and runtime artifacts remain distinct from canonical Capiro business records.                                                     |

**Sharing the existing database means sharing its authoritative business records**\
**through their service owners.** It does not give frontend code a database login\
or justify separate copies of clients, permissions, files or institutional\
memory. The browser and the Next frontend must not introduce Prisma/SQL access,\
run source migrations, store provider credentials or implement a competing Core\
API. Backend endpoints validate current tenant, actor, client and object access.

For Portfolio, current configuration uses explicit server-side Core, Strategy,\
Workspace and Intelligence origins. The owner selected\
`TRACKER_BACKEND=intelligence`. The existing preview template does not yet\
declare a live new-Meri runtime origin: the Meri owner must supply and qualify\
its actual endpoint/auth contract before that configuration is added. Do not\
point new Meri at the old runtime merely because a similarly named URL exists.

For Meri, the published integration boundary explicitly keeps canonical Capiro\
data and memory external to the new runtime, accessed through new authorized\
connectors. Its separate operational database does not replace the existing\
Capiro database. If a connector needs database access instead of an existing\
qualified service API, that is a backend integration task requiring a dedicated\
restricted principal, approved tables/views and a narrow network path. Existing\
application credentials and unrestricted worker database access are unsuitable.\
No such source connection is claimed by this frontend deployment.

Institutional knowledge should remain linked to its authoritative client,\
source record, document and approved memory. Meri retrieval must preserve source\
and version references, citations, current permissions, client walls, private\
memory rules and mailbox ownership. Derived text retains the restrictions of\
its contributing sources. A cached result or generated answer cannot become\
canonical institutional memory merely by being displayed; publication uses the\
owning service's actual review/write contract. Incomplete or unavailable sources\
must remain explicit instead of producing invented counts or claims of absence.

At the inspected published Meri revision, the event contract `0.1.0` is the\
accepted public frontend boundary. The retrieval `0.2` foundation remains\
additive and pending qualification; its mail operation is declared unimplemented.\
Do not treat schema files as evidence that source retrieval, memory sharing or a\
live runtime has been activated. The Meri owner must verify any newer accepted\
contract before implementation or shipment.

## Handoff and integration requirements

Return the branch/PR and exact commit, owned paths, any shared-interface changes,\
Figma nodes/assets, actual backend contract/version references, required runtime\
configuration names, checks run, retained failures and unrun live gates. Keep\
secrets out of source, screenshots, logs and handoff text.

The integration owner combines reviewed branches, resolves shared changes,\
verifies all affected products and publishes a single immutable frontend image\
to the existing preview service. No concurrent agent should independently\
overwrite that service with an image missing another product's merged work.\
Frontend preview publication, each backend's deployment, source/knowledge\
activation and signed-in acceptance are separate observable steps.

## Sources and current reference points

- [Local frontend architecture]\(./ARCHITECTURE.md) and\
  [implementation standards]\(./IMPLEMENTATION-STANDARDS.md).
- [Preview deployment procedure]\(../apps/web/deployment/portfolio/README.md),\
  [buildspec]\(../apps/web/deployment/portfolio/buildspec.yml),\
  [service template]\(../apps/web/deployment/portfolio/service.yml) and\
  [current Portfolio continuation]\(./portfolio-31/CONTINUATION-2026-10-11.md).
- [Original preview handover at frontend main](https://github.com/neo-capiro/capiro-frontend/blob/02c02d95bdf3949662b9123f425271c6491ffdab/docs/portfolio-31/handover-2026-10-11/HANDOVER.md).
- [Published Meri ownership](https://github.com/neo-capiro/meri-greenfield/blob/8b123bea4c90794dc2d766814b6ddbdbfe0928bc/README.md),\
  [Capiro integration boundary](https://github.com/neo-capiro/meri-greenfield/blob/8b123bea4c90794dc2d766814b6ddbdbfe0928bc/docs/INTEGRATION-BOUNDARY.md) and\
  [retrieval foundation status](https://github.com/neo-capiro/meri-greenfield/blob/8b123bea4c90794dc2d766814b6ddbdbfe0928bc/docs/RETRIEVAL-CONTRACT.md).

Inspected published references: frontend main\
`02c02d95bdf3949662b9123f425271c6491ffdab`, `capirov2` main\
`4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`, and Meri main\
`8b123bea4c90794dc2d766814b6ddbdbfe0928bc`. The Meri integration document's\
older AWS/source inventory is historical and must be freshly verified before\
source activation. This guide does not establish current live infrastructure\
or relax either backend's authorization model.