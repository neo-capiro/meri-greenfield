# Browser activation checklist

The shipped activation record (`activation.mjs`, `BROWSER_ACTIVATION`) is **held**. No argument, environment variable, policy field or runtime port opens it. It opens only through a reviewed source change that sets `state:'open'` and `evidence` to a record citing a passing measurement for **every** item below. Each measurement is taken on the approved dedicated isolated browser host (D005), from the real non-root sandboxed browser launched by the product configuration (`server.mjs`), at the exact source and image candidate being opened. Source tests, scripted ports and local fixtures do not count as any of these measurements.

The browser capability stays **on by default**. Destinations stay denied by default. Opening the gate does not choose the initial approved destination list, which is still open.

Every item records:

- the probe;
- the expected refusal code or observation;
- the evidence: the control decision log, the destination-side log showing nothing arrived for a refused probe, and a host egress capture where the item says so.

## 0. Preconditions (owner actions, not measurements)

| ID | Precondition |
| --- | --- |
| P1 | D005 host placement approved and the host qualified as its own gate (`docs/qualification/G1-REMAINING-WORK.md`). |
| P2 | `@playwright/mcp` 0.0.83 (with `playwright-core` 1.64.0-alpha-1790635538000 and its Chromium build) added through the lockfile owner. The image is built, scanned (zero HIGH/CRITICAL) and bound to the candidate digest. |
| P3 | The canonical approval owner accepts the `meri-browser-action/1` subject and consumes a decision once (lane report proposal A1). |
| P4 | The artifact owner provides an ingest operation that honours `idempotencyKey` and provenance (lane report proposal A2). |
| P5 | The trusted browser runtime port exists. It covers the policy source (`resolveBrowserPolicy` over platform/tenant/role records), egress `grant`/`revoke` at the host control and `processes.waitForExit` (lane report proposal A3). |
| P6 | The opening change is independently reviewed, and the owner approves it. |

## A. Host isolation and sandbox

| ID | Measurement | Pass |
| --- | --- | --- |
| A1 | uid/gid and capabilities of the Playwright MCP, browser and every renderer/utility process | non-root; no added capabilities; `NoNewPrivs: 1` |
| A2 | Browser and renderer sandbox: process command lines, `/proc/<pid>/status` and namespaces of every renderer | no `--no-sandbox`/`--disable-setuid-sandbox`; renderers seccomp-filtered (`Seccomp: 2`) in their own user/PID/network namespaces as the Chromium Linux sandbox requires |
| A3 | Instance metadata and container credential endpoints from the browser user (`169.254.169.254`, `169.254.170.2`, `fd00:ec2::254`), both through the browser and by raw socket | unreachable |
| A4 | Host or task reuse | a new host/task per conversation; never shared across conversations or tenants |
| A5 | Host destruction after a cleanup reported UNKNOWN | destroyed, with a verified destruction receipt |

## B. Egress (each `EGRESS_REQUIREMENTS` entry)

The host proxy runs `createEgressControl` (`egress-control.mjs`) under the run's grant. The browser reaches it through `--proxy-server`.

| ID | Requirement | Probe | Pass |
| --- | --- | --- | --- |
| B1 | positive | navigate to an allowlisted origin | page loads; control logs `ok` with the pinned address |
| B2 | deny-non-public-destinations | navigation, sub-resource and fetch to one address in each listed IPv4/IPv6 range | refused (`BROWSER_URL_NOT_PUBLIC`); nothing on the wire |
| B3 | enforce-on-resolved-address | allowlisted test name resolving (controlled resolver) to a private address; mixed public+private answer | `BROWSER_EGRESS_ADDRESS` |
| B4 | dns-rebinding | test name answering public then private with TTL 0, loaded repeatedly | second and later admissions refused; no connection to the private address; DNS only through the controlled resolver |
| B5 | effective-origin-allowlist, redirects | allowlisted → unlisted public redirect (301/302/307/308, meta refresh, `location=` script); allowlisted → private redirect | refused at the hop (`BROWSER_ORIGIN_NOT_ALLOWED` / `BROWSER_URL_NOT_PUBLIC`) |
| B6 | effective-origin-allowlist | unlisted public image, script, iframe, `fetch`, XHR, `ws://` and `wss://` WebSocket, download | each refused; the unlisted server logs no request |
| B7 | effective-origin-allowlist | an origin the platform approves but the tenant narrowed away, and one the role ceiling narrowed away; empty effective list | refused; with an empty list nothing external loads |
| B8 | web-ports-only | allowlisted host on a non-web port; outbound UDP (QUIC, raw UDP 53 to a public resolver); WebRTC `RTCPeerConnection` with a public STUN server | refused or nothing leaves the host (egress capture) |
| B9 | no-proxy-bypass | raw TCP from the browser user to a public `IP:443`; Chromium with an injected direct route | no connection |
| B10 | proxy-route | page requests to `http://127.0.0.1:<port>` and `http://localhost/` | reach the proxy (logged) and are refused, never connected directly; no `PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK` in the environment |
| B11 | proxy-route | a grant whose `policySha256` differs from the fragment's; a request after the run's grant is revoked; after expiry | grant refused; `BROWSER_EGRESS_REVOKED` / `BROWSER_EGRESS_EXPIRED` |
| B12 | connection-coalescing | an unlisted name sharing an allowlisted origin's address and certificate (SAN covers both), HTTP/2 and HTTP/3, ORIGIN frame and Alt-Svc offered | no request for the unlisted origin reaches any server |
| B13 | per-conversation-host | as A4 | as A4 |

## C. Pre-execution approval and SDK composition

Run with the pinned SDK 0.3.295 / CLI 2.1.295, real Playwright MCP, and the composed options from `../options.mjs` with `meri_original_reads`, `meri_reads` and `meri_intents` mounted.

| ID | Measurement | Pass |
| --- | --- | --- |
| C1 | Each interaction tool (`INTERACTION_TOOLS`), including when another mount's hook returns `allow` | PreToolUse `ask` reaches the routed `canUseTool`; nothing executes before the canonical owner's consumed approval; hook precedence deny > ask > allow observed |
| C2 | Page reports | Playwright MCP 0.0.83 responses carry `- Page URL:`; the tracker binds the real starting origin; a failing tool delivers PostToolUseFailure |
| C3 | Canonical owner round trip | approver authenticated server-side; the UI shows action, target, data, page origin and expiry; approve/reject/expiry/revocation (30 s propagation, 30 s fail-closed staleness, Q-X7); a second execution with the same proposal or tool-use refused durably across a worker restart |
| C4 | Run abort or cancel while an approval is pending | the callback completes at once; the owner withdraws the request; no late execution |
| C5 | Routing | a permissive decider on another server cannot allow a browser tool; browser decisions never affect other servers' tools |

## D. Run lifecycle and cleanup

| ID | Measurement | Pass |
| --- | --- | --- |
| D1 | Outcomes: completed, failed, cancelled, paused, waiting-for-approval, deadline, worker SIGKILL | Playwright MCP and every Chromium process exit after the query closes; `processes.waitForExit` reports it truthfully (never `exited:true` while one remains) |
| D2 | Profile, HOME and output after each outcome, plus Chromium temporary directories outside the workspace | removed and verified absent; a run's cookies are not visible to the next run |
| D3 | Egress grant after each outcome | revoked; later requests refused (B11) |
| D4 | Cleanup UNKNOWN path | the run fails `SDK_CLEANUP_UNKNOWN`; the host is destroyed (A5) |

## E. Downloads

| ID | Measurement | Pass |
| --- | --- | --- |
| E1 | Real download into `--output-dir`, accepted through `downloads.accept` | one artifact version with provenance and the echoed `idempotencyKey`; a retried attempt of the same run creates none |
| E2 | Download whose source redirects to an unlisted origin; oversize; structurally invalid | refused at egress or by the port before ingest; no artifact |

## F. Status

| ID | Measurement | Pass |
| --- | --- | --- |
| F1 | UI state for enabled with destinations, enabled with none, tenant-disabled and held | the four states are distinct; held is never shown as "turned off by the user" |

## Opening

The opening change:

1. cites the evidence record path in `BROWSER_ACTIVATION.evidence`, with every ID above marked passed;
2. keeps `EGRESS_REQUIREMENTS` as the same array identity;
3. changes no default (capability on, destinations empty).

Any failed or unrun item keeps the gate held.
