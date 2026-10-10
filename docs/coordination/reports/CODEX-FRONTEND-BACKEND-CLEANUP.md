# Backend UI source cleanup

Codex implementation, 10 October 2026. After the integration owner's explicit ROOT GO, this dedicated checkout removes exactly 44 obsolete NEW backend UI qualification files: 12 transport files and 32 Elements files. The accepted offline frontend ownership baseline is [capiro-frontend@bfee546d9b194c5fd5a6e61e5e24dcf288b628f3](https://github.com/neo-capiro/capiro-frontend/tree/bfee546d9b194c5fd5a6e61e5e24dcf288b628f3), already accepted and pushed by the integration owner. This report is an implementation handoff for independent cleanup review; it does not accept its own commit.

The frontend owns the Next app, public `@capiro/ui` presentation, `@capiro/meri-client` browser transport/projection, and the two qualification packages. Backend `packages/contracts` remains the canonical wire distribution; `packages/ui-stream` remains trusted stream production. No behavior, dependency, public contract, authentication or source authority is changed by this deletion. No current Capiro checkout is edited.

The proportional outline was written before changes at `.task-inputs/CODEX-FRONTEND-BACKEND-CLEANUP-1/outline.md`. Its preparation-only wording is historical: ROOT GO subsequently authorized these exact deletions and current documentation edits. Dedicated branch `task/frontend-cleanup-implementation`, worktree `C:/dev/main/meri-greenfield-worktrees/frontend-cleanup-implementation`, pinned backend base `ed09a250ad9b8088c111007d6573ac969017b010`. The earlier clean preparation checkout at `744e9555ae1145ade1cefbf807182a4e1927c648` is preserved separately.

## Canonical destinations and retained history

The immutable original source is [backend@089533104eb567899e79cddf7b400460395e6de0](https://github.com/neo-capiro/meri-greenfield/tree/089533104eb567899e79cddf7b400460395e6de0/apps/ui). The 44-record original preparation map is 68724 bytes, SHA256 `b25fbfd965c860605b689adff0b5d6f797641c1a521cb637aeb5a6a0ccc37ca6`; its raw bytes are retained at `.task-inputs/CODEX-FRONTEND-BACKEND-CLEANUP-1/original-preparation-map.json`. Every deletion target matched this map, the original Git blob and backend base Git blob before deletion. Every absolute target and parent was checked inside the explicit checkout, with reparse/junction refusal; `git rm` received the 44 literal absolute filenames. No recursive removal was used.

36 files have physical frontend destinations, one producer moved to the backend public package, one duplicate DTO file is replaced by generated canonical types, and six obsolete transport metadata files are explicitly retired. All 32 Elements rows are represented: 20 in `packages/ui`, 12 in `packages/qualification-elements`. All 17 adopted upstream files retain the accepted import-only adaptation and original licenses/notices. The mapping is preserved in the frontend [Elements map](https://github.com/neo-capiro/capiro-frontend/blob/bfee546d9b194c5fd5a6e61e5e24dcf288b628f3/packages/qualification-elements/migration-map.json) and [transport map](https://github.com/neo-capiro/capiro-frontend/blob/bfee546d9b194c5fd5a6e61e5e24dcf288b628f3/packages/qualification-transport/transport-migration.json); their prior status text is historical, not a new acceptance decision.

| Removed source under `apps/ui/` | Canonical destination or disposition |
| --- | --- |
| `elements-qualification/.gitignore` | frontend `packages/qualification-elements/.gitignore` |
| `elements-qualification/LICENSE-AI-ELEMENTS` | frontend `packages/ui/LICENSE-AI-ELEMENTS` |
| `elements-qualification/LICENSE-SHADCN` | frontend `packages/ui/LICENSE-SHADCN` |
| `elements-qualification/README.md` | frontend `packages/qualification-elements/README.md` |
| `elements-qualification/THIRD-PARTY-NOTICES.md` | frontend `packages/ui/THIRD-PARTY-NOTICES.md` |
| `elements-qualification/component-pins.json` | frontend `packages/qualification-elements/baseline/component-pins.json` |
| `elements-qualification/fixture.tsx` | frontend `packages/qualification-elements/fixture.tsx` |
| `elements-qualification/package-lock.json` | frontend `packages/qualification-elements/baseline/package-lock.json` |
| `elements-qualification/package.json` | frontend `packages/qualification-elements/package.json` |
| `elements-qualification/qualification.test.mjs` | frontend `packages/qualification-elements/qualification.test.mjs` |
| `elements-qualification/ssr-build.mjs` | frontend `packages/qualification-elements/ssr-build.mjs` |
| `elements-qualification/ssr-runtime.mjs` | frontend `packages/qualification-elements/ssr-runtime.mjs` |
| `elements-qualification/styles.css` | frontend `packages/qualification-elements/styles.css` |
| `elements-qualification/toolchain-pins.json` | frontend `packages/qualification-elements/toolchain-pins.json` |
| `elements-qualification/tsconfig.json` | frontend `packages/qualification-elements/tsconfig.json` |
| `elements-qualification/vendor/ai-elements/conversation.tsx` | frontend `packages/ui/src/ai-elements/conversation.tsx` |
| `elements-qualification/vendor/ai-elements/message.tsx` | frontend `packages/ui/src/ai-elements/message.tsx` |
| `elements-qualification/vendor/ai-elements/prompt-input.tsx` | frontend `packages/ui/src/ai-elements/prompt-input.tsx` |
| `elements-qualification/vendor/shadcn-ui/components/ui/button-group.tsx` | frontend `packages/ui/src/shadcn/button-group.tsx` |
| `elements-qualification/vendor/shadcn-ui/components/ui/button.tsx` | frontend `packages/ui/src/shadcn/button.tsx` |
| `elements-qualification/vendor/shadcn-ui/components/ui/command.tsx` | frontend `packages/ui/src/shadcn/command.tsx` |
| `elements-qualification/vendor/shadcn-ui/components/ui/dialog.tsx` | frontend `packages/ui/src/shadcn/dialog.tsx` |
| `elements-qualification/vendor/shadcn-ui/components/ui/dropdown-menu.tsx` | frontend `packages/ui/src/shadcn/dropdown-menu.tsx` |
| `elements-qualification/vendor/shadcn-ui/components/ui/hover-card.tsx` | frontend `packages/ui/src/shadcn/hover-card.tsx` |
| `elements-qualification/vendor/shadcn-ui/components/ui/input-group.tsx` | frontend `packages/ui/src/shadcn/input-group.tsx` |
| `elements-qualification/vendor/shadcn-ui/components/ui/input.tsx` | frontend `packages/ui/src/shadcn/input.tsx` |
| `elements-qualification/vendor/shadcn-ui/components/ui/select.tsx` | frontend `packages/ui/src/shadcn/select.tsx` |
| `elements-qualification/vendor/shadcn-ui/components/ui/separator.tsx` | frontend `packages/ui/src/shadcn/separator.tsx` |
| `elements-qualification/vendor/shadcn-ui/components/ui/spinner.tsx` | frontend `packages/ui/src/shadcn/spinner.tsx` |
| `elements-qualification/vendor/shadcn-ui/components/ui/textarea.tsx` | frontend `packages/ui/src/shadcn/textarea.tsx` |
| `elements-qualification/vendor/shadcn-ui/components/ui/tooltip.tsx` | frontend `packages/ui/src/shadcn/tooltip.tsx` |
| `elements-qualification/vendor/shadcn-ui/lib/utils.ts` | frontend `packages/ui/src/lib/utils.ts` |
| `qualification/.gitignore` | Retired obsolete transport metadata; original Git blob retained |
| `qualification/README.md` | Retired obsolete transport metadata; original Git blob retained |
| `qualification/client-facade.tsx` | frontend `packages/meri-client/src/client-facade.tsx` |
| `qualification/component-pins.json` | Retired obsolete transport metadata; original Git blob retained |
| `qualification/guarded-transport.ts` | frontend `packages/meri-client/src/guarded-transport.ts` |
| `qualification/package-lock.json` | Retired obsolete transport metadata; original Git blob retained |
| `qualification/package.json` | Retired obsolete transport metadata; original Git blob retained |
| `qualification/producer.ts` | backend `packages/ui-stream/src/producer.ts` |
| `qualification/projection.ts` | frontend `packages/meri-client/src/projection.ts` |
| `qualification/qualification.test.mjs` | frontend `packages/qualification-transport/qualification.test.mjs` |
| `qualification/tsconfig.json` | Retired obsolete transport metadata; original Git blob retained |
| `qualification/types.ts` | backend `packages/contracts/dist/contracts.d.ts` (generated replacement; old DTO retired) |

The dated [UI notice supplement](../../qualification/UI-NOTICE-SUPPLEMENT.md) remains byte-exact. Its original inventory is the [651ec8ce136a9ed3b22f911ea0dac90f33de40c7 Git blob](https://github.com/neo-capiro/meri-greenfield/blob/651ec8ce136a9ed3b22f911ea0dac90f33de40c7/apps/ui/elements-qualification/component-pins.json): 241775 bytes, SHA256 `935f00ddbbb8fde72d9a0288b6f833f87dbb08245d95aaca9f02a18c4c28fd8b`. Its dated relative link resolves in that historical commit; no active executable stub is retained here. This is separate from the [089533104eb567899e79cddf7b400460395e6de0 promotion inventory](https://github.com/neo-capiro/meri-greenfield/blob/089533104eb567899e79cddf7b400460395e6de0/apps/ui/elements-qualification/component-pins.json), 244217 bytes, SHA256 `d7f41d9ae3573698418debb27ea1eef7ffc4e0cf2445bb2c9aa0953acd02b9d1`, preserved in the frontend `packages/qualification-elements/baseline/component-pins.json`. Neither inventory is relabeled as the other.

Backend producer source remains 2188 bytes/SHA256 `2283d4649c0e8b654a8d1466904f74666aee32cf6e219eb84cab36b21c59aabc`; canonical generated declarations remain 4090 bytes/SHA256 `e0366e2f5a668e9e14f09e90c175dce53cbec176125aa98a58c878b44fd74fbd`. The accepted frontend public archive inputs are unchanged: contracts48823 bytes/SHA256 `2f15ade9458cbffe960b7cc36c6fb77cb54cc2a0eca4bc7c0f918b77cfacd4ee` with 11 regular entries, and ui-stream2280 bytes/SHA256 `7ce24acd465dca4c5e90c1c98dba383318aab024dbce5170fa1f1daf3bce83ab` with 6. Their source commits remain `0dc9ce423947fc7814d7f8ad8de2f633c187c6d8` and `12289a434be6f589bbff9c741367b8cfb77f2616` respectively.

## Checks actually performed

This cleanup runs source/DATA checks only; unchanged product suites are not replayed. Python3.12.14 uses `-I -B`, explicit Git/rg paths, hardened Git configuration, bounded direct subprocess calls and binary stdout/stderr retention. No candidate module is imported or executed. Evidence is under `.task-inputs/CODEX-FRONTEND-BACKEND-CLEANUP-1/`.

- `prepare.py`: 44 original/base/current source comparisons, 36 mapped destination comparisons, retained backend producer/generated declarations, both immutable maps and archives; all matched. The pre-GO receipt identity is recorded below. The first column-zero declaration regex observed 0/0 Elements declarations because they are indented. That incomplete observation remains preserved; `elements-declarations-2.json` corrected the DATA inventory to 15/15 with the same names/order (3471 bytes/SHA256 `0bb086907b98a76dc3c5a13985092083f3f01edee97395f4e110ab0614cea18f`).
- `remove-44.py`: explicit removal succeeded, with exactly 44 staged deletions and 44 byte-exact source backups. Its later metadata assertion stopped on exit0 Git warning `could not open directory 'apps/ui/': No such file or directory`, after Git removed the now-empty tracked directories. Original helper/captures remain unchanged and no removal was repeated. Ignored-file inventories were empty before and after; no ignored captures/dependencies were deleted. `removal.json` was never produced.
- `closeout-data.py`: replacement DATA closeout passed, reverified all 44 preserved backups/absent targets and 277 protected current files against raw base Git blobs, including historical reports/plans/notices and canonical source/lock files. Scoped executable-source rg had zero obsolete-root/package callers after deletion (exit1, empty stdout/stderr), versus six matches inside deleted roots and zero external matches before. Both ordinary and staged whitespace checks passed. Receipt `closeout-data-1.json`: 76414 bytes/SHA256 `ba3e0875b8ccac5cd5db8b8d0e8b64ce802e11b131f1af35318c2bf0bd8a1f9d`.
- `final-baseline-readback-2.py`: accepted frontend `bfee546d9b194c5fd5a6e61e5e24dcf288b628f3` HEAD/clean status, all 36 mapped destinations and 4 additional archive/authority records matched their raw Git blobs and current bytes before/after. Both archive entry counts and literal declaration inventories passed: transport19 original plus2 added; Elements15 original/15 moved. Receipt `final-baseline-readback-2.json`: 22100 bytes/SHA256 `6b41edea8a131f8d666f07db416d2854cb0477e72a1f397496956b945b91d350`. The first final-baseline helper stopped before source comparison because it recognized only `capiro-frontend`, while 32 rows use the equivalent repository identity `neo-capiro/capiro-frontend`. The untouched failed helper and captures remain; version2 explicitly accepts both fixed spellings.

The correct pre-GO receipt identity is 46022 bytes/SHA256 `f6fce6f936692cf06d7510fb57d8c5d94a31cf07e5af1920b925623bbd9615da`. Declaration/name inventories are not fresh behavioral proof. Earlier accepted author/reviewer executions establish the 19 preserved transport assertion bodies plus two new controls and 15 Elements cases; attribution and retained failures remain in their frontend reports. Two optional metadata read commands used nonexistent documentation paths in the wrong checkout and returned file-not-found; they changed no source and are not product-check outcomes.

Seven current documentation files receive a current ownership overlay or exact obsolete-clause replacement: README, UI-SPEC, COMPONENTS, UI-COVERAGE, STATUS, QUEUE and G1-REMAINING-WORK. Their remaining UTF8 historical bytes are preserved. Dated qualification reports, plans and the original notice supplement are unchanged; no historical result is promoted into a fresh pass. The old component inventory and pending functional coverage are not rewritten.

## Remaining limits and ownership

Local readback assumes a trusted checkout; it is not a hostile-filesystem or OS-isolation proof. This task does not run installations, typechecks, transport/SSR/product tests, builds, browsers, Figma, providers or AWS. It changes no public package, root lock, backend producer, schema, worker or deployment resource.

The human finalized Figma at18:16; a distinct bounded Home Browse workflows/final visual comparison is in progress and is not implied by source ownership. The focused responsive repair was independently accepted earlier. Live auth/source access, revocation/durable cancellation, Linux behavior, full product coverage, seven low dependency advisories and the unresolved react-remove-scroll-bar2.3.8 full notice remain separately qualified/open. REL02 and the live G1/release gates remain OPEN. Final integration/push and cleanup acceptance belong to the integration owner after independent exact-commit review.
