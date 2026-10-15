# Corrected frontend review: 78b1c126

Reviewed 15 October 2026, read-only GitHub inspection plus isolated cloud source probes. Fable remains the implementation owner. No product edits, installs, browser activation, deployment or user-computer access occurred.

## Decision

**ACCEPT the bounded source corrections to the earlier frontend HOLD.** No blocking source defect was found in this correction delta. **Independent desktop/SSR execution qualification remains pending (HOLD for that evidence gate only).** The host-local receipt and reported pass totals have not been independently inspected; their unavailability is not a source defect. This is not acceptance of all Meri product integration, live services, native artifacts, browser sandboxing or release gates.

- Exact candidate: [`78b1c12691541a32aa82039d2518b91a5e780ce5`](https://github.com/neo-capiro/capiro-frontend/commit/78b1c12691541a32aa82039d2518b91a5e780ce5), tree `0dc355ce7f81bb43b20202dd44facbefd004e988`.
- The branch `meri/figma-34-ui` resolved to that candidate during review. Merge parents: `9b4de0583d5300183a2582fcc70350b3114200cd` and `2697c8254da3da92eff1cc09e859872dfa9a6aa5`.
- [Comparison from the HOLD pin](https://github.com/neo-capiro/capiro-frontend/compare/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b...78b1c12691541a32aa82039d2518b91a5e780ce5): six commits ahead, zero behind, 14 changed files. No shared Settings implementation/spec, package manifest, dependency lock or SSR harness change is in this delta.

## Corrections verified in source

### 1. Canonical tree keyboard/ARIA model is implemented

The [canonical FileTree](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/packages/ui/src/ai-elements/file-tree.tsx#L52-L219) now filters hidden descendants, maintains a roving tab stop, resets entry to selection, handles Up/Down/Home/End, expands or enters with Right, collapses or returns to parent with Left, and prevents Space's default scrolling while activating. It respects a caller-prevented event and Alt/Ctrl/Meta modifiers. [Folder treeitems](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/packages/ui/src/ai-elements/file-tree.tsx#L307-L358) expose expanded and selected states, remove the inner buttons from sequential tab order, and retain the ARIA group. [Files](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/packages/ui/src/ai-elements/file-tree.tsx#L389-L411) expose selected state with the same roving tab stop.

The [Meri caller](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/apps/web/src/features/meri/screens/artifacts/WorkspaceFileTree.tsx#L23-L49) preserves file-only selection: folder activation toggles expansion without replacing the selected file. The redundant caller-level selected attribute was removed because the canonical component now owns it.

The [new light/dark tree cases](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/apps/web/test/browser/meri-file-tree-keyboard.spec.ts#L13-L158) assert one tab stop, selection, visible focus, navigation boundaries, open/closed folder traversal, hidden-child removal, Enter/Space activation, Tab/Shift+Tab return, pointer selection and pointer collapse. An additional independent probe executed these exact source handlers against a synthetic DOM model: **22/22 checks passed**. This probe is source-behavior evidence, not a browser, React lifecycle or screen-reader run. Nested/externally controlled expansion changes are not established by the committed workspace fixture cases.

### 2. Adopted desktop component cases are present

Three new spec files add **20 cases: ten scenarios in both light and dark at 1440×1040**:

- [Disclosures](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/apps/web/test/browser/meri-adopted-disclosures.spec.ts#L13-L146): Tool, Task, Plan and Queue, including keyboard disclosure state and focus, independent specialist disclosure, heading/list structure and navigation.
- [Other Elements](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/apps/web/test/browser/meri-adopted-elements.spec.ts#L13-L280): Confirmation, Checkpoint, Sources, Artifact, Attachments and WebPreview, including names, explained disabled controls, keyboard links, evidence selection/focus, attachment removal, sandboxed static preview, refresh/width/fullscreen handling.
- FileTree as above. These cover all eleven newly adopted AI Elements through their actual Meri fixture compositions; the five shadcn dependencies are exercised through those compositions, not independently as every possible public API variant.

The [shared helper](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/apps/web/test/browser/meri-fixture-screen-helpers.ts#L15-L49) sets the desktop size/theme and checks overflow, document/session/foreign-request isolation and page errors. Its [axe helper](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/apps/web/test/accessibility.ts#L4-L24) runs full default rules and requires zero violations, attaching the raw result.

Coverage qualification: axe runs at each explicit `finish()` state, not after every later transition. For example, the Confirmation case audits before visiting receipts; Attachments audits before removal; WebPreview audits before fullscreen. Axe `incomplete` results are retained in attachments, not automatically rejected by this helper. Do not generalize “95 passed” to every screen/state having a clean manual accessibility audit. Inspect the attached results before broader claims.

### 3. Ordinary `/meri/files` regression coverage is restored alongside fixtures

The [restored test](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/apps/web/test/browser/acceptance-meri-theme.spec.ts#L80-L157) starts at ordinary `/meri`, asserts the disconnected conversation state and absence of the fixture composer, navigates to ordinary Files, then checks theme, Modules navigation, Back/Forward, preference changes, overflow, axe and isolation. The separate [fixture test remains](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/apps/web/test/browser/acceptance-meri-theme.spec.ts#L159-L222). The ordinary route is no longer replaced by fixture-only assertions.

The correction also [adds a proper Sources level-2 heading](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/apps/web/src/features/meri/screens/sources/EvidenceSourcesScreen.tsx#L105-L116) and [adjusts muted notice text on toned backgrounds](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/apps/web/src/features/meri/ui/meri-ui.module.css#L164-L177). This review did not independently measure rendered contrast.

## Independent provenance and regression checks

All 67 files in the exact-pin UI/qualification inventory were materialized with their original bytes. Executed in the cloud review copy using Node v24.19.0:

1. Canonical `verifyPromotedSources()`: **passed**, including inverse import/adaptation reconstruction for 17 originals and 16 additions.
2. Canonical `sourceRecords()` and `generate-pins.mjs --check`: **passed**, complete 67-file source inventory; generated comparison 15,370 bytes.
3. Existing `apps/web/test/settings-access.test.mjs`: **4/4 passed**, covering customer/HQ visibility, billing grants, safe hosted destinations and bulk-review eligibility.
4. Extracted exact-source tree event probe: **22/22 passed**, synthetic topology only.

The original 17 provenance records remain unchanged from a0b58a2b. Among addition records only FileTree changed. Its recorded Fable owner notice and exact edits inverse-check successfully against the pinned upstream identity. Current FileTree is **12,557 bytes**, SHA-256 `4c1601e0558e9ab3b64262b5f58e3a28eceff06aef726fed977ebd488b20f45e`; [current provenance](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/packages/ui/provenance.json#L573-L666) agrees. Public component export declarations are preserved.

The 95/95 desktop cases across 12 specs, 52 units, full typecheck and architecture passes are **owner-reported, not independently rerun here**. My 4/4 Settings result is a separate narrow run. No full checkout/dependency/runtime preparation was established for a browser or full workspace run. GitHub returned no PR-triggered workflow runs and no status entries for this commit; this does not prove that external CI is absent.

## SSR evidence gate and remaining handoff

The canonical SSR test source is unchanged and still declares **18 tests**. A real receipt is required for the [identity/drift negative case](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/packages/qualification-elements/qualification.test.mjs#L212-L240), plus actual deterministic rendering and hostile-text escaping. No evidence here establishes that those cases failed at the new pin; their reported **18/18 success** simply remains unverified.

Supplied receipt location (Fable host only): `/tmp/claude-0/-home-user-meri-greenfield/bee73297-c6ec-58ce-ba3c-205a70d00699/scratchpad/esbuild-tool/ssr-final-78b1c126/receipt.json`.

Supplied expected SHA-256: `1d7b867567ce988514762f39dec396432f101e5bbcf562fa3aa8be28138b31e6`. That path is absent from this cloud review filesystem. The digest has not been independently recomputed.

Smallest useful portable evidence handoff:

- The unchanged receipt bytes and its three bound outputs: `fixture.cjs`, `fixture.cjs.LEGAL.txt`, `metafile.json`; preparation process/log evidence and exact 18-test result with command/environment and source commit.
- The 95-case Playwright JSON report, exact invocation/spec/filter list, attached axe results and relevant traces/screenshots, plus 52-unit/typecheck/architecture logs anchored to the same clean source pin.
- For complete independent receipt verification, the actual bound installed dependency bytes and matching Node/platform/architecture are required by [verifySSRReceipt](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/packages/qualification-elements/ssr-build.mjs#L46-L79). A receipt alone, a digest string or successful artifact preparation is not an 18-test pass. Independent reproduction also needs the verified official esbuild 0.28.2 tool package and root-lock dependencies; do not rewrite the receipt or pins for convenience.

## Non-blocking documentation and wider scope

The historical [adoption table's FileTree row](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/docs/meri-figma-34-20261015/ELEMENTS-ADOPTION.md#L24) still gives 7,937 bytes and the old hash; [its adaptation section](https://github.com/neo-capiro/capiro-frontend/blob/78b1c12691541a32aa82039d2518b91a5e780ce5/docs/meri-figma-34-20261015/ELEMENTS-ADOPTION.md#L67-L78) describes only the older optional-prop fix. The qualification README also still says fifteen cases. These should be updated or explicitly labeled historical by the owner, but are not grounds to retain a source HOLD when current canonical provenance and inventory pass.

Shared Settings and its tests are unchanged in this correction delta. The inherited fixture/unpersisted-preference and full product integration limitations in the [comprehensive audit](https://github.com/neo-capiro/meri-greenfield/tree/82a015083f1965851ffddbc05d4f181bb90ecac2/docs/coordination/audits/meri-comprehensive-20261015) remain separate. Mobile was not independently qualified and remains deferred. Source acceptance here does not clear those broader gates.
