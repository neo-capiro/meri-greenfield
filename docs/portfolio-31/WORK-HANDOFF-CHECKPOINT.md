# Client Work native handoffs

Audit WORK-06 uses the current Work header in Figma node411:52106, actions411:52138. The full design context and screenshot were inspected with the design-to-code skill. The source badge, compact Open Strategies button and gradient New strategy button reuse existing tokens and button primitives; this action group contains no static icon assets.

The Portfolio feature reads existing client-scoped strategy projections. Creation stays in the existing application at `/strategies/new?clientId={id}`; the library opens `/strategies?clientId={id}`. No additional strategy editor, creation endpoint, local draft persistence or Meri orchestration was introduced.

## Verified destination contract

Current capirov2 main `fd8765ec01d292013758606204f2c9d886cd31c1`:

- `apps/web/src/vnext/pages/strategies/VNextStrategiesRoutes.tsx` owns `/strategies/new` and preserves the authoritative Strategy Planner feature gate.
- `apps/web/src/vnext/adapters/legacy/useShellClientContext.ts` prefers the `clientId` query over stale persisted global selection.
- `apps/web/src/vnext/pages/strategies/StrategyLibraryVNext.tsx` uses that canonical scope.
- `apps/web/src/vnext/pages/strategies/overlays/NewStrategyOverlay.tsx` initializes its form baseline from the scoped client only when found in its accessible catalog, including late loading. It does not overwrite a user selection. Native destination and API permissions remain authoritative.

The configured existing application URL is validated centrally. Portfolio does not infer this destination from a hostname or bypass its authentication/feature gate. Optional objective lineage and Meri starter staging require separate verified contracts.

Workspace drafts and completed documents continue to open their existing typed artifact destinations. Client assignment based on a legacy display name is withheld when accessible names collide; that limitation requires a stable client-ID Workspace contract.

## Verification boundary

The existing Work browser cases assert exact client-scoped Strategy links, canonical typed Workspace links, collision refusal and absence of a second editor. Desktop and390px dark screenshots exercise the composed Work page. Intercepted synthetic browser checks establish local handoff generation and responsive behavior; signed-in navigation and creation in the designated live application remain unverified. No provider action, strategy creation, build or deployment occurred during this handoff pass.
