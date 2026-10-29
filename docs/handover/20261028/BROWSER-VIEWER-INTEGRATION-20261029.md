# Browser viewer integration — 29 October 2026

Source allocation covers canonical takeover lifecycle/currentness, authenticated viewer ticket consumption, displayed-document binding, and D005 context/filter composition. Core remains the authority; existing run controls and session/retention owners remain canonical. Activation is held. No application/image build, deployment, independent review or WSL recovery is part of this source work.

## First bounded slice: displayed document

The existing host session owns native Playwright pages, the S1 lease and S2 model-output filter. Extend that owner with viewport capture for its separate trusted viewer control channel. Native input must name the frame actually returned by this owner, with the same page, lease and viewport. A navigation witness starts before capture and stays attached while the frame is usable; same-URL reload, page close, new capture, hand-back, lease end and destruction invalidate it. Never accept an input-side URL, page selector or claimed screenshot as evidence of the displayed document.

Implement capture and frame lifetime in `browser/session/viewer-frame.mjs`; compose it in the existing session owner and host controls. Reuse native input validation, rate limits, authority checks, operation lifetime, pinned browser and cleanup. User-only image bytes never enter the model MCP channel. Keep the last frame pin only in this process; it is neither a credential nor a persistence/authority ledger. A future authenticated receiver must still bind the viewer to the exact run and consume its ticket through the canonical session owner.

Verify actual native capture plus reload-before-input, navigation-during-capture, wrong page/lease/frame, viewport changes, stale/aborted capture and teardown. Preserve existing model filtering and takeover tests. Focused source tests, pinned Chromium canaries and runtime TypeScript are permitted; native Linux isolation remains unrun because the retained Ubuntu VHDX is locked by the old VM.

Implemented the first slice against main PR391. The session now captures bounded native PNG viewports on its separate control channel and requires the returned frame ID for all native input. Frame state contains no retained image bytes. Replaced all previous input callers in the focused fixtures; no compatibility bypass permits input without a displayed frame.

Author checks: Node24.22.1, 34 affected source checks and three native pinned MCP0.0.83 / Chromium155 cases pass, zero skips. Native coverage includes reload during authority checks and reload before input admission, with zero private input delivered to the stale document and successful input after a fresh capture. Runtime `npm run typecheck` and `git diff --check` pass. Scripted authority/hold/disposal ports remain explicit; this is not authenticated viewer, D005/Linux or production qualification.

## Subsequent integration

Canonical takeover must stop/drain model execution without ordinary pause's unconditional browser destruction. The current run lifecycle and host currentness read must agree on that state before a lease is APPLIED. The authenticated viewer receiver must consume a bounded, single-use ticket and recheck the existing Core/session authority. D005 must preserve its native SDK peer authentication and confinement while routing model output through the host filter; context preparation cannot await an SDK shim that starts only after preparation. These crossings are still open; this first slice is not end-to-end viewer or activation qualification.
