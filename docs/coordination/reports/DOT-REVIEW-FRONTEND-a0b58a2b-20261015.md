# Frontend desktop qualification review — 15 October 2026

Central coordinator decision: **HOLD desktop qualification** at [`a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b`](https://github.com/neo-capiro/capiro-frontend/commit/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b), tree `f9e9b62c4571bd1c42a6182f99ec2cdc3abbd660`. The coordinator reports that all **16 adopted provenance checks passed**. Mobile is deferred. These provenance passes do not close desktop accessibility or SSR qualification.

Fable owns Meri implementation. This lane performs documentation and read-only independent source/prerequisite checks; it makes no UI, package, pin, contract or runtime change. The earlier full frontend review message sent at 18:22 was not received here; this record transcribes the subsequently supplied central verdict and exact source checks. It does not invent additional diagnostic outcomes or a broader frontend acceptance decision.

**Immutable scope:** the frontend branch subsequently advanced to `9b4de0583d5300183a2582fcc70350b3114200cd`. This record's decision describes only `a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b`; it assigns no verdict to the successor. A separate lane owns that delta review. The [exact one-commit comparison](https://github.com/neo-capiro/capiro-frontend/compare/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b...9b4de0583d5300183a2582fcc70350b3114200cd) changes only `apps/web/src/features/meri/home.module.css` and `apps/web/test/browser/meri-files-navigation.spec.ts`, so it changes neither canonical SSR source package, its qualification sources/pins nor the root lock. No SSR preparation or receipt production has begun at either pin. The qualification owner must select the intended immutable target before any future execution; the old-pin recipe below is unexecuted review guidance, not a direction to produce an obsolete receipt.

## File-tree expansion and keyboard behavior

[The canonical folder component](https://github.com/neo-capiro/capiro-frontend/blob/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b/packages/ui/src/ai-elements/file-tree.tsx#L175-L181) renders a focusable `role="treeitem"` without `aria-expanded` on that element; `open={isExpanded}` is on the Collapsible wrapper. Separate expander and selection buttons appear at [lines 188–215](https://github.com/neo-capiro/capiro-frontend/blob/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b/packages/ui/src/ai-elements/file-tree.tsx#L188-L215). The folder has no own keyboard handler. This does not mean native buttons have no keyboard behavior; it means that behavior alone does not complete the tree's keyboard/focus model.

[The file handler](https://github.com/neo-capiro/capiro-frontend/blob/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b/packages/ui/src/ai-elements/file-tree.tsx#L257-L280) handles Enter and Space and gives each file treeitem `tabIndex=0`. The [desktop caller](https://github.com/neo-capiro/capiro-frontend/blob/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b/apps/web/src/features/meri/screens/artifacts/WorkspaceFileTree.tsx#L25-L55) supplies the tree label, default expansion and file selection state, without repairing folder expanded-state semantics or the tree keyboard model.

Required correction: implement and verify the intended tree keyboard/focus behavior and expanded-state semantics through the canonical component/caller owners, preserving selection, expansion, public exports and recorded upstream adaptation provenance. Add focused desktop accessibility regressions and actual keyboard interaction evidence before claiming qualification. Source inspection does not prove rendered accessibility-tree behavior. No browser, keyboard interaction, screen-reader or desktop qualification was executed in this lane.

## Evidence distinctions

- The **16 adopted provenance checks** are the coordinator's reported passes. They are not sixteen keyboard/browser tests and were not rerun by this documentation lane.
- The separate qualification-elements file declares **18 tests**; the reported run remains **15 passed / 3 failed**, with the three genuine-receipt-dependent cases unresolved.
- The source has sixteen recorded Meri Figma 3.4 additions and seventeen originally adopted sources; inventory counts do not establish desktop interaction acceptance.
- Mobile remains deferred. This record does not create a mobile implementation or qualification task.
- The [SSR fixture](https://github.com/neo-capiro/capiro-frontend/blob/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b/packages/qualification-elements/fixture.tsx#L1-L8) renders Conversation, Message and PromptInput, not FileTree. A successful SSR run cannot close the file-tree keyboard finding.

## Additional source-only documentation discrepancy

The [adoption document's file-tree row](https://github.com/neo-capiro/capiro-frontend/blob/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b/docs/meri-figma-34-20261015/ELEMENTS-ADOPTION.md#L24) still names the earlier 7,937-byte promoted file and SHA-256 `c762916cd5f0640ad23e1d27745c5a40c0080e49086fb57592d755d71ab0d857`. The actual pinned canonical file, Git blob `62dca3a2b834e3bcb1308b13567e0d8d6e98e2c1`, hashes to `bdae1b53adad89002cf7e9581090644dda87013a072123ac703d6ace1139b29b`; this source hash was independently recomputed for this record. The [current provenance entry](https://github.com/neo-capiro/capiro-frontend/blob/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b/packages/ui/provenance.json#L573-L601) records later owner adaptations. Reconcile that documentation through its owner without replacing the current source/provenance identity with the older row. This is a source-qualified documentation discrepancy, not a new diagnostic run or a claim that the 16 reported provenance checks failed.

## Frontend SSR: preparation only, execution not yet admitted

The exact producer is [`packages/qualification-elements/ssr-build.mjs`](https://github.com/neo-capiro/capiro-frontend/blob/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b/packages/qualification-elements/ssr-build.mjs#L82), Git blob `76c263bebc91cbf4f2a0e0f9dd46d347a443c55a`:

```powershell
# Future owner recipe after prerequisite admission; not executed by this record.
node packages/qualification-elements/ssr-build.mjs VERIFIED_TOOL_ROOT NEW_OUTPUT_ROOT
```

It runs verified esbuild twice, verifies recorded inputs/outputs and prints `receiptPath` and `expectedSha256` (plus bundle/input/dependency counts). Preparation compiles; it does not evaluate components. A successful producer does not establish a passed test suite.

Prerequisites from the pinned [package instructions](https://github.com/neo-capiro/capiro-frontend/blob/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b/packages/qualification-elements/README.md), [root package](https://github.com/neo-capiro/capiro-frontend/blob/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b/package.json) and [toolchain pins](https://github.com/neo-capiro/capiro-frontend/blob/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b/packages/qualification-elements/toolchain-pins.json):

- Dedicated trusted checkout at the exact frontend commit, with unchanged canonical `packages/ui`, qualification sources, promotion metadata, original upstream pins/adaptations and notices.
- Node 24.x and npm 11.9.0; dependencies prepared from the root workspace lock with lifecycle scripts disabled. Historical qualification locks remain unchanged. The 367-package resolver/license inventory and actual dependency bytes must match.
- A separately verified external tool root with `win32-x64/` or `linux-x64/` containing official esbuild 0.28.2 `metadata.json`, `archive.tgz`, `package.json` and executable, matching every pinned byte count, SHA-256 and archive SHA-512 integrity. An ordinary installed binary alone is insufficient.
- A nonexistent writable output directory with an existing parent, outside both canonical source packages. Inputs/tools remain stable during preparation.
- Receipt consumption with the identical Node version, platform and architecture, plus writable external evidence/temp locations. Negative tests create source copies and a dependency junction.

The Windows executable pin is 11,694,592 bytes, SHA-256 `c7bee37877d0aa6a046e52783fa0a2cf1a9ce5579d68bb3083bda99d4bff18ef`. Existing local sufficiency is **not established**: the bounded task-4 inspection found no exact frontend checkout or verified tool root, and default npm metadata was 11.17.0 rather than 11.9.0. Nearby readable source copies were older; their HEAD was not established. After the host restart, read-only checks reconfirmed Node v24.19.0 and default npm 11.17.0; the allocation checkout was safely reconciled to its exact published commit without changing any product source. No prerequisite installation or qualification was performed.

After the owner establishes those prerequisites and the coordinator admits execution, the minimal sequence from that exact checkout is:

```powershell
# Verified Node/npm executables must be the admitted versions, not unverified ambient tools.
npm run pins:check --workspace @capiro/qualification-elements
npm run typecheck --workspace @capiro/qualification-elements
node packages/qualification-elements/ssr-build.mjs VERIFIED_TOOL_ROOT NEW_OUTPUT_ROOT

$env:MERI_ELEMENTS_SSR_RECEIPT = 'EXACT_PRINTED_receiptPath'
$env:MERI_ELEMENTS_SSR_RECEIPT_SHA256 = 'EXACT_PRINTED_expectedSha256'
$env:MERI_ELEMENTS_SSR_CAPTURE_ROOT = 'NEW_EXTERNAL_CAPTURE_ROOT' # optional
npm test --workspace @capiro/qualification-elements
```

The pinned [test source](https://github.com/neo-capiro/capiro-frontend/blob/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b/packages/qualification-elements/qualification.test.mjs), blob `05806536ccc9a938d3186290aa3efddb23f72d01`, declares 18 tests. Its three receipt-dependent cases are at [line 212](https://github.com/neo-capiro/capiro-frontend/blob/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b/packages/qualification-elements/qualification.test.mjs#L212) (receipt identity/drift negatives), [line 418](https://github.com/neo-capiro/capiro-frontend/blob/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b/packages/qualification-elements/qualification.test.mjs#L418) (deterministic actual component SSR) and [line 435](https://github.com/neo-capiro/capiro-frontend/blob/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b/packages/qualification-elements/qualification.test.mjs#L435) (hostile-text escaping). README's older fifteen-case wording does not change that count. The reported result remains 15 passed / 3 failed, not 18 accepted.

Do not fabricate a receipt, regenerate pins to hide drift, edit UI/source, weaken provenance, run a production build or activate a service/browser. A future successful run proves bounded offline provenance/SSR only; browser hydration, styling/accessibility, live authorization/transport, native integration, G1 and deployment remain separate.

## Handoff and execution boundary

Fable must return the reviewed desktop corrections and the exact receipt-bound qualification evidence through the existing frontend owner. The minimal SSR recipe above remains unexecuted pending prerequisite preparation and coordinator admission. Existing read-only Git/Node tools support inspection; the current exact-checkout/dependency/toolchain prerequisites have not been established as sufficient for execution.

No production source changes, package installation, generated pin updates, synthetic receipt, production build, browser/service activation, credentials, AWS or model/provider calls are authorized or performed by this record. A future successful offline SSR run does not prove browser hydration, styling, accessibility, native integration, live authority, G1 or deployment acceptance.
