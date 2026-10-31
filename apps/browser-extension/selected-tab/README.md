# One selected tab

31 October 2026 source slice for the user's selected A4 scope. Chromium Manifest
V3, Chrome 120 or newer. This is the extension producer and receiving contract;
the Capiro current-conversation/upload consumer is integrated in source. Isolated
unpacked Chromium qualification passed on 29 October. The native document-token
fix was published in contracts0.1.36 and pinned by Frontend343/344; Frontend345
qualified the synthetic composer handoff. No store submission or authenticated
deployment acceptance is established by those checks. See [DISTRIBUTION.md](DISTRIBUTION.md)
for the package, activation dependencies and bounded acceptance cases.

## User flow and authority

The current Capiro chat opens a native external port. The extension accepts only
the top frame of the exact preview origin already named in the repository's
release handoff, `https://portfolio-preview.app.capiro.ai`. Other extensions and
other web origins have no connection permission. The sender's browser-assigned
tab and document identity bind the recipient, and one port owns the connection.
The user confirms the displayed account/chat in the extension popup. Those labels
are presentation, not authorization: the native Capiro conversation/upload owner
must bind and recheck the actual account, tenant, client and conversation.

The user then invokes the extension on one source tab, captures rendered text,
previews it, and chooses **Share and attach**. Only `activeTab` and `scripting`
permissions are requested. The injected function runs in the isolated world of
the top frame and reads rendered text; it does not operate the page. Forms,
editable controls, hidden content, scripts, subframes and shadow roots are not
read. URL query/fragment are removed, credential URLs are refused. Cookies,
storage, clipboard, profile, filesystem, debugger and CDP capabilities are absent.
Visible page text may itself contain private information; consent covers the
exact preview, title and sanitized source address.

The canonical `meri.selected-tab/1` receiver fixes the original UTF-8 bytes,
including title/source headers and verified SHA-256. The app must receive it
through the versioned public package, match its current session binding and
device/pairing identity, enforce expiry/one-use selection, and pass that exact
original once to the existing upload owner. Pairing itself never grants data or
upload authority. The extension has no network endpoint or durable effect ledger.

## Lifetime and outcomes

Pairing lasts at most ten minutes in service-worker memory. It stores no account
credential, cookie, device secret or persistent pairing. Worker restart requires
new consent. The browser may stop its worker; an open port is not promised to
keep it alive. Capture lasts at most one minute and is limited to 20,000 visited
nodes, one second of traversal, 131,072 text characters and 256 KiB UTF-8 text.
Oversize or timed-out pages fail without a partial share.

Pause, revoke, expiry and recipient navigation/disconnect discard pending text.
Changing source tab, navigating (including within the same origin), or closing
that tab invalidates capture. Before capture acceptance and Share, the extension
checks the selected tab, full private URL and browser-assigned document ID again.
Epoch checks discard late asynchronous results. Pausing requires another explicit
popup confirmation to resume; changing account/chat requires a new pairing.
Popup Pause and Disconnect remain effective during an outstanding capture. Older
settled attachment status messages cannot revoke a newer selection or resolve its
unknown outcome; the bridge retains only a bounded set of correlation IDs.

Share spends the selection before crossing the port. A lost acknowledgement is
shown as unresolved, and no capture/share replay occurs. The app's existing upload
receipt and status readback decide stored, refused or unknown; receipt checking
can update the displayed outcome later. Disconnect cannot undo an upload already
dispatched. The Capiro consumer must stop admission on account/session change,
retain its canonical uncertain-upload recovery, and never auto-submit a chat turn.
Worker restart discards consent and never replays a share. Full application-page
reload recovery of an attachment not yet submitted in a chat remains a separate
upload-owner gap: the current composer attempt ledger is memory-only. Do not
equate a fresh extension connection with reconciliation of that old attempt.

## Source preparation and checks

`packages/contracts/generate-selected-tab.mjs` generates the receiving module,
types and source metadata. `prepare-source.mjs` copies that generated receiver
verbatim to `contract.mjs`; `--check` verifies parity. The extension source is
ordinary modules and static popup assets. The manifest has no wildcard hosts,
content scripts, externally exposed resources or network connection permission.
Production origins, extension identity/distribution and managed-device policy
remain deployment decisions; changing the target requires an explicit manifest
change, matching app configuration and native acceptance.

Run from the repository root:

```sh
node packages/contracts/generate-selected-tab.mjs --check
node apps/browser-extension/selected-tab/prepare-source.mjs --check
node --experimental-vm-modules --test packages/contracts/test/selected-tab-application.test.mjs packages/contracts/test/selected-tab-distribution.test.mjs apps/browser-extension/selected-tab/test/bridge.test.mjs apps/browser-extension/selected-tab/test/background.test.mjs
node --test apps/browser-extension/selected-tab/test/capture.browser.test.mjs
```

The DOM test uses the installed Playwright runtime; `SELECTED_TAB_PLAYWRIGHT_MODULE`
can name its existing module URL and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select
an installed Chrome. It serves synthetic content on loopback and closes the test
browser/server.

The native test loads the actual unpacked extension in a fresh persistent
Chromium profile and invokes its toolbar action through the native Extensions
debug protocol. Run it with the same Playwright module setting:

```sh
node --test apps/browser-extension/selected-tab/test/native.browser.test.mjs
```

Chromium149.0.7827.55 and Playwright1.61.1 passed native external-port pairing,
unlisted-origin refusal, denied read before the toolbar grant, explicit consent,
filtered preview, one consumed share, uncertain-outcome capture blocking,
navigation erasure and actual service-worker stop/restart with new consent.
The popup preview was visually checked. Eighteen contract/bridge checks also pass.
The recipient and outcome responses are synthetic; authenticated upload and
durable application recovery still require end-to-end acceptance.

Native qualification exposed two corrected assumptions: browser document tokens
can be32hex characters and must be preserved exactly, and popup focus must not
replace the last ordinary browser window when selecting its active tab. Neither
change broadens the manifest permissions. A fresh profile and result/screenshot
are retained under `SELECTED_TAB_NATIVE_WORKDIR` (the system temp folder by
default); test browsers are closed on success or failure. Public generated
distribution parity must be checked after the package owner regenerates it.

References: [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab),
[external connections](https://developer.chrome.com/docs/extensions/reference/manifest/externally-connectable),
[scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting).
