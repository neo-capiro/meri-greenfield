# Selected-tab distribution and acceptance

This is a reviewable unpacked-source candidate, not an installed or published
extension. No browser or grant changes are performed by packaging these files.

## Exact package

Use the committed `manifest.json`, `background.mjs`, `bridge.mjs`, `capture.mjs`,
`contract.mjs`, `popup.html`, `popup.css`, and `popup.mjs` from this directory, plus
this document and README. Place the manifest at the extracted package root.
Include no test profiles, fixtures, credentials, node_modules or environment files.
The delivery packet supplies the source commit/tree, every file's SHA-256 and the
archive hash. This is a static file copy/archive, not an application build.

Before distribution, check the existing public-contract generator and extension
receiver parity. The manifest stays at its retained candidate version 0.1.0:
there is no established published version or extension signing identity to update.
The distribution owner must assign the next version against actual store history
before an update, rather than treating this archive as an automatically safe update.

## Activation proposal for the existing owners

The unchanged manifest admits only `https://portfolio-preview.app.capiro.ai/*`.
It has only `activeTab` and `scripting`, no host permissions, cookie/storage APIs,
background page scan, content script, debugger, native host or network endpoint.
The popup shares an explicit top-frame text preview with one paired application
document. It cannot capture the recipient application tab.

For a bounded pilot, the designated acceptance owner can install this exact
unpacked directory in an isolated approved Chromium profile after a concrete
browser/install allocation. Record the actual extension ID and package hash.
An unpacked path's ID is not a stable distribution identity. The frontend release
owner must build its existing `NEXT_PUBLIC_MERI_SELECTED_TAB_EXTENSION_ID` setting
with that exact ID; the current UI hides the control when the setting is absent.
The setting is a public identity, never a secret or new authorization grant.
Verify the preview alias actually serves the compatible authenticated app before
using it. No successful activation or existing configured ID is assumed here.

For the user's `app.capiro.ai` rollout, the proposed production package replaces
the preview match with the single exact `https://app.capiro.ai/*` match, after
Root allocates that manifest change. Pair it with one approved stable distribution
ID (private/unlisted store distribution or the organization's existing managed
extension mechanism) and the matching frontend build setting. Preserve the
existing permission list and app/Core authentication. No wildcard or arbitrary
origin setting is proposed. Store enrollment/signing identity, production match,
package version and release configuration are not selected or changed here.

Release owns the frontend build/config/shipment. No native VM/browser-host
provisioning, SQL migration or shared browser grant is needed for this text-only
producer; do not wait for host automation to finish the independent source work.

## Restart boundary requiring the document/upload owner

The extension intentionally stores neither credentials nor durable pairing/text.
An MV3 worker restart or app port loss requires a new pairing and explicit popup
consent, and cannot resend an earlier capture. Same-page unknown upload outcomes
are reconciled by the existing upload receipt/status owner, without another write.

At frontend main a622ef4f8944fc0e03ad1fcdbd1b0c005c1e7312,
`meri-uploads/upload-controller.ts` and `upload-recovery.ts` retain composer items
and exact-attempt receipts in memory. `meri-conversations/port.ts` restores only
already accepted conversation upload references. A page/browser restart before a
selected-tab attachment enters a submitted chat therefore has no demonstrated
durable recovery locator in that composition. This is an implementation dependency,
not a passing restart criterion. The shared document/upload owner must reconcile it.

Concrete proposal: extend that existing owner with a bounded, account/tenant/
conversation-bound attempt reference persisted before dispatch, using its approved
recovery storage. Restore only an unknown/status-read row under fresh canonical
authorization; keep credentials, page text and originals out of extension storage,
never reconstruct or automatically replay the original upload, and preserve
unresolved initiation when no canonical lookup key exists. Confirm the existing
backend request-status lookup before choosing persistence fields. This is not a
second extension upload ledger and is not implemented in this source allocation.

## Bounded acceptance handoff (not executed)

Bind the actual served frontend/Meri revisions, extension ID/version/archive,
browser version/profile owner, signed-in actor/tenant/client/conversation, and a
user-approved source page. Use synthetic harmless page text with credential/form/
hidden/subframe sentinels and a second unselected tab. Never capture a live account
page merely because the user has logged into it. Inspect captured content privately;
retain only hashes/counts and fixture evidence in general handoff records.

1. Before toolbar grant or popup approval: no capture or upload. Wrong origin,
   recipient subframe, second pairing, expired session and cross-conversation
   input must fail closed. Bind a real denial actor only when separately allocated.
2. Capture and preview one source; verify rendered text, title and sanitized URL.
   Query/fragment, form values, hidden text, subframes and the unselected tab must
   be absent. Page text itself may contain private data: preview consent matters.
3. Share exactly once into the bound chat. Compare original UTF-8 bytes, length
   and hash at the real upload owner, then verify scan/extraction/storage status.
   No chat/model turn is implicit. Budget at most two controlled attachment writes
   for the sequential-share case; stop after any unknown effect for readback.
4. After the first stored receipt, capture/share a second fixture and let the app
   republish the first receipt. Connection stays active; the old receipt must not
   resolve the second upload. Lost acknowledgement uses the same status read,
   with zero automatic retry/rewrite. Fault injection requires its own allocation.
5. During capture and before Share, exercise Pause/Disconnect, source-tab switch,
   same-URL navigation, source close, recipient navigation and account/chat change.
   Pending preview disappears and late replies cannot attach it. Resume requires
   fresh consent. No unrelated tab is read and no grant/cookie is copied.
6. After an explicitly allocated worker stop/restart, no consent/text/automatic
   share survives; new pairing is required. Separately test app/browser reload
   after unknown upload once the shared upload-owner recovery gap is fixed. Read
   the original durable receipt under fresh authority; do not create a replacement
   upload to make the recovery test pass. Saved-chat attachment reopening is a
   separate case from an unsent composer attachment.

No test above is claimed as deployed acceptance by local Node or historical
synthetic browser results. Root owns independent source review and merge, Release
owns shipment, and the assigned acceptance owner owns the bounded browser case.
