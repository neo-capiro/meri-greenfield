# Global objective client picker — OBJ-19

## Scope and source

- Isolated checkout `C:/dev/meri-global-objective-261011`, branch `codex/portfolio-global-objective-20261011`; starting commit `6d554e365b39e83cf33a93748add47cca38465c0`.
- Current policy `b32b4803933760dc0a93fffdcd8fba30a89c3aac`; BOOTSTRAP/AGENTS and repository implementation standards read. Ops fetch/ff verified without discarding changes.
- Current Figma `Zc2dEN5aLU47dVdsewDmiJ`, Prototype 3.1, node `411:62481`, dialog `411:62788`. Mandatory design-to-code skill, full component context and screenshot inspected before implementation. Evidence: task outputs `evidence/global-objective-discovery-20261011/figma-picker.png`, `figma-context.json`, `dialog-context.txt` and original audit row.
- Baseline `OBJ-19`: New objective outside client: choose authorized client. The catalog backing exists; selection and draft form state are local. Original audit evidence remains separate and unchanged.

## Implementation boundary

The controlled `GlobalObjectiveClientPicker({open,onOpenChange,onContinue,onCloseAutoFocus?})` owns only client search/selection. Parent continues to `/portfolio/{id}/objectives?new=1`, reusing the existing ObjectiveEditor and its four-field readiness rule. No objective is created or mutated by the picker. No local storage, profile-based drafting, invented client types, additional navigation, or duplicated editor.

The real `GET /api/backend/core/clients` uses canonical `useClients` with tenant/user scoped cache. `useIdentity`, canonical `currentClientWriter`/`assertClientWriter`, public `Client` schema/initials, Radix Dialog and existing tokens are reused. Continue revalidates current actor, fresh idle non-invalidated catalog, and an exact non-archived selected row synchronously before navigation. Cache invalidation, fetch/error, role or actor change block continuation; keyed actor sessions discard prior selection. Destination authorization remains authoritative: catalog metadata is not a memory-wall grant, and this frontend guard does not close server revocation races.

The 560px dialog, 28px client initials, compact rows, footer and dark surface follow the inspected design. Figma says everything else is filled from the client profile, but current ObjectiveEditor starts empty; approved truthful wording is “Choose the client for this objective.” Current screenshot does not establish a new global trigger location. Root owns entry placement review, `?new=objective` composition and shared browser main.

## Verification

Pending focused unit, full type/static and composed browser checks. No dependency installs, build, live API writes or deployment. Synthetic browser intercepts establish local UI behavior only; live tenant/client and auth integration remain separate qualification.
