# Agent 4: design reconciliation and cross-module context (read for design rules) (verbatim from the Meri master closeout plan)

#### MG-03 — Reconcile the exact original Figma nodes and every visible control to live acceptance

**Priority:** P1 full-UI completeness; aliases W06/W09 and original design criteria. **Root cause:** The 258fixture-route census and659control-site index prove source coverage, not that the original85frames/29overlays/60states/15component families/11walkthroughs were correctly implemented or explicitly staged. Actual current design revision/node mapping was not retrieved in this audit.

**Bounded work:** Existing `docs/UI-SPEC.md`, `docs/UI-COVERAGE.md`, `docs/design/meri/`, frontend existing components/routes and Playwright suites. At authorized implementation discovery, pin actual Figma revision/capture/frame IDs/reference screenshots; map each original and revised node to route/component/stable control ID, transition, public API/event or local-only behavior, actor/scope/exact-version rules, states and tests. Record discrepancies and explicit original-scope decisions, not silently remove frames. Reuse AI Elements/shadcn and approved shells; no screenshot-based app or new UI QA platform.

**Acceptance:**100% original accepted frames/overlays/states/controls accounted; full-completion queue includes deferred phone/tablet designs, not a fake mobile PASS. All11walkthroughs become real fixture-backed interaction paths plus applicable composed flows. Fix1440desktop/390phone and discovered tablet references/fonts/clock/dynamic content; keyboard/focus/return/scroll/contrast/reduced-motion/long-content tests pass, no critical overlaps or missing action. Three mode buttons preserve authorized context or truthful disabled target. Backend proof remains required separately; no visual mock closes a workflow ticket.

---

#### MF-19 — Unify cross-module context and completion links (P1/P2, shared contract)

- **Root cause / evidence:** Client-scoped home links exist but PF Ask/Create and Workspace/Mail object handoffs require richer canonical context; action outcomes do not uniformly link canonical records.
- **Bounded files/owner:** One canonical context DTO/route helper owned with PF-02/03, WS-22–24, ST-28 and ML-06; Meri entry parser, composer starter and receipt link components.
- **Implementation:** Carry only canonical IDs and user-approved draft/context through links or validated bootstrap; re-read source under current identity, show selected client/object/evidence and permit explicit scope correction. Preserve exact mail sender/thread/connection via ML contract, not a freeform prompt. Link completed task/file/research results to original canonical object. Back/forward/client switch must retire stale pending context and not resubmit.
- **Dependencies / exclusions:** PF-02/03, WS22–24/tasks, ST-28, ML05/06 and relevant MM/MT contracts. Do not duplicate those projects or embed sensitive source text in URLs.
- **Acceptance:** Portfolio client→Meri→task/file→canonical detail roundtrip survives reload; invalid/foreign/stale IDs fail closed; mail actions retain exact reviewed connection/thread; new client selection cannot dispatch prior client proposal; no auto-send merely by opening a deep link.
