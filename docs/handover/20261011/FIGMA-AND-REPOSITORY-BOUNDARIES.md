# Current UI reference and repository boundaries

The human reconfirmed these destinations on 11 October 2026:

| Responsibility | Repository |
| --- | --- |
| All frontend code, shared shell and Meri/Portfolio/Modules presentation | `neo-capiro/capiro-frontend` |
| Meri backend, public contracts, trusted control and runtime | `neo-capiro/meri-greenfield` |
| Existing Portfolio and Modules backend services | `neo-capiro/capirov2` |

The authoritative UI reference is
[Capiro UI Redesign, page 411:40601](https://www.figma.com/design/Zc2dEN5aLU47dVdsewDmiJ/Capiro-3.0-%E2%80%94-UI-Redesign?node-id=411-40601).
The node is a page named “Prototype — Capiro 3.1,” not a screen. A read-only
Figma inspection resolved its descendants, then obtained high-fidelity
Home and recovery context with screenshots. No Figma or frontend edits
were made. Figma observations do not have an immutable revision identifier.

| Design surface | Exact node |
| --- | --- |
| Meri section | `599:136957` |
| Complete standalone mockup | `439:81406` |
| Home | `442:81437` |
| Checkpoint and verified restore | `443:84112` |
| Interrupted run and fork | `443:84534` |
| Run/recovery state board | `450:88532` |
| Approval/permission state board | `450:89113` |
| Conversation/memory lifecycle | `450:90240` |
| Plate document drafting | `532:122225` |
| Newer tooling inventory | `712:139842` |
| Native tool design handoff inventory | `727:144068` |

## Frontend ownership

Public frontend main was inspected at
`02c02d95bdf3949662b9123f425271c6491ffdab`. This is source inspection,
not a new build, browser render or visual acceptance.

- Thin Next routes/layout: `apps/web/src/app`.
- One shared ProductShell/Header/Sidebar/DesignIcon owner:
  `apps/web/src/shared/shell`.
- Meri feature presentation: `apps/web/src/features/meri`.
- Adopted AI Elements/shadcn primitives: `packages/ui`.
- Guarded upstream AI SDK transport, React facade and projection:
  `packages/meri-client`.
- Backend public contract/stream tarballs: `vendor`; never import backend
  private SDK evidence or a backend checkout into the browser.
- `apps/portfolio-web` is transferred source awaiting shared-app
  consolidation, not a second permanent shared-shell implementation.

The Home design uses a 64px shared header and 232px Meri sidebar, Geist
typography and the existing neutral tokens. The mode switch is compact and
icon-only: Meri, Portfolio and Modules require semantic accessible labels
and current-section navigation. Reuse the existing Header descriptors;
do not duplicate the shell. Existing Portfolio/Modules destinations remain
disabled until verified integration; prototype links alone do not enable
them. This continuation creates no Portfolio or Modules screens.

Current Home reference drift: Figma includes an upper-right Meri wordmark
and calls the sidebar item “Routines”; inspected source lacks that wordmark
and uses “Schedules.” Historical Home acceptance covers an earlier captured
reference. Follow-up UI work must inspect the actual frame, download its
required assets through the Figma workflow, reuse existing components and
verify the rendered result before claiming current visual acceptance.

## Recovery states must come from verified backend facts

The design's checkpoint view asserts session/files restored, verified
workspace files and reconciled completed-action receipts. The current G1
fixture cannot support those product claims. An SDK interrupt acknowledgement
must not become a verified paused checkpoint, and a stream finish, HTTP
success or reconnect must not become a completed run.

Keep connection state separate from authoritative durable run state. Reuse
the existing ConversationProjection, whose completion depends on a
`run.status` event. Resume/fork require a current authorization check and
verified checkpoint capability. Browser tenant/client/conversation selection
is a hint, not authority. Partial outputs may remain readable when permitted;
workspace-not-persisted and restore-failed states disable resume. Reconcile
completed external effects and immutable artifact versions before retry.

Publish deliberately versioned browser-safe recovery contracts from the
backend when qualified. Do not expose observer signing keys, raw process
evidence, private fixture records or S3 credentials. Keep all frontend code
in the frontend repository and all authorization in trusted backends.

## Scope visible in the mockup

The inspected standalone inventory includes Home/cited answers/scope/history;
research progress, parallel activity, runs, steer/stop and recovery/fork;
workspace, Word/PDF/spreadsheet/presentation/web/code/analysis previews,
versions and revisions; uploads, extraction, filing and exact downloads;
evidence, coverage, freshness and memory provenance/proposals; approvals
and reviewed task/filing actions; browser activity, sign-in and connection
states; Routines; dark/tablet/mobile layouts; lifecycle/error/permission
boards and confirmation overlays.

The newer tooling section adds workflow setup and mobile equivalents,
commitments/deliverables, source coverage/access, artifact verification,
reproducible analysis, funding/market/budget/relationship/client changes,
government watches, memory conflict and exact task/source receipts. Its
“139 exact registry records” frame is a design inventory, not verified
runtime coverage. Full accepted deployment scope remains unchanged.
