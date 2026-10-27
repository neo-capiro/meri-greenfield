# Retained artifact reads after origin cancellation

## 1. Scope
Fix the demonstrated MF14 gap: cancelling an originating run must not suppress an already published, currently authorized retained document. This is a local source candidate, not deployed acceptance.

## 2. Base and ownership
Separate branch codex/wave5-m5-retained-origin-reads-20261027 from frozen library e1fb06c637ccad93b3b0bbbd8195846b97badf76. Only core-authority.mjs, its existing conversation-binding test and this handoff change. Frozen library, preview, package and frontend review branches remain untouched.

## 3. Authority policy
The explicit retained-read intents are inspect, history, list, download and preview. Each still requires the current session and fresh Core observation, exact stored binding and scopes, plus existing publication, source, retention and release checks downstream. A cancelled run alone is no longer a read denial. No absent or suppressed publication becomes visible.

## 4. Writes and preview
Create, revise and preview-publish require a stored non-cancelled accepted run, including effect/release rechecks. Preview reads existing verified bytes; preview-publish is a durable derived-object write. This distinction was coordinated with the MM10 owner. No renderer, executor, run, session or authority protocol changes.

## 5. Failure witness
Against unchanged e1fb production source, the updated focused test reports 7 pass / 6 fail: five retained-read cases reject cancellation, while no-run preview publication is incorrectly classified as a read. Candidate changes resolve all six. Original witness remains in orchestrator work/wave5-m5-retained-origin-read-baseline.log.

## 6. Checks
Node24.22.1, retained read-only dependency junctions. Focused conversation-binding/history/library/retained-PDF checks:37/37 pass. Existing origin-authority suite:18/18 pass separately. These include completed/failed/cancelled read origins, cancellation before release, current Core revocation, wrong binding/scopes, write denial, denied library pages, missing/current source verification and retention suppression. Diff hygiene passes. Logs: work/wave5-m5-retained-origin-read-focused.log and work/wave5-m5-retained-origin-read-origin-regression.log. An initial command used singular origin.test.mjs (no file); the actual plural origins.test.mjs was subsequently run and its18 results are separate, never inferred from that command.

## 7. Compatibility
No public contracts, generated files, manifests, locks, catalog or physical archives change. This file is not a document generator provenance input. The Core peer and artifact owner's current verification remain intact.

## 8. Limits
Fixtures use synthetic Core transport, process-local session owner and scripted SQL/object ports; no database, browser, renderer, model, build or target action occurred. Broader inherited authority fixture failures were previously reproduced at the frozen baseline and are not claimed green here. Full library consumer and deployment acceptance remain open.

## 9. Next
Independent bounded review and eventual composition with preview/library runtime follow exact candidate pins in the external receipt. No push, merge, pack, publication or deployment is authorized by this handoff.
