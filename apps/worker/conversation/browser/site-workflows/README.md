# Selected authenticated site workflows

Core owns enabled manifests and immutable revisions. The native run request stores
only `siteWorkflow: {siteId, workflowId, version, manifestSha256}`. Allocation,
submission replay, input receipts and conversation history preserve that exact
selection. The browser or model cannot submit a manifest, credentials, policy or
preapproved tool decisions through this field.

The runner reads `runner/site-workflow-resolve` with its existing run binding.
Control loads its own persisted request, checks the current run/session before and
after Core answers, and calls the fixed Core runtime/read route. The native bearer
and service secret remain control-side. The response is bounded strict JSON;
disabled configuration, changed identity/version/hash, expired or rotated native
credentials, cancellation and transport failures release no manifest.

Browser preparation validates the current manifest and narrows the existing
policy. PreToolUse and canUseTool re-read current Core configuration, including
after an awaited interaction approval. Download publication rechecks immediately
before calling the existing artifact owner. These checks add no approval ledger,
credential store or alternate artifact writer. Failed preparation uses the
existing browser lifecycle cleanup; unknown cleanup remains unknown.

The unused static approval registry was removed. Core configuration cannot open
the browser, takeover or site-workflow activation gates. They remain held. The
production runner has no qualified browser-host composition, so a selected
workflow fails before runtime/model preparation instead of silently running as
an ordinary chat. Tests of open fragments use existing synthetic host fixtures.

This is source preparation. User choices for initial sites/tasks/actions/retention
are deferred until the end of preparation. Native sign-in/takeover, S2 credential
confidentiality, profile reuse across turns, inactivity expiry through the actual
session destruction owner, withdrawal propagation, and each named site's live
acceptance remain required. The TTL validator alone does not establish physical
session expiry. No application/image build, deployment, provider call, independent
review, extension install or site activation is part of this change.
