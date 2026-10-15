/** Browser activation gate (dot review HOLD on p1c @e0f94fe, 15 Oct 2026). The product default is on (policy.mjs), but
 * no browser server, tool, hook or download port is contributed while this gate is held. Playwright MCP
 * `--allowed-origins`/`--blocked-origins` and the in-process URL gate are not a network boundary: they do not see
 * redirects, sub-resource requests, DNS answers or rebinding. The gate opens only by a reviewed source change that
 * records accepted evidence for every requirement below on the approved isolated browser host (D005); there is no
 * runtime argument, environment variable or policy field that opens it. The recorded product direction that the
 * capability be enabled by default (DOT-REVIEW-FABLE-P1C-e0f94fe0-20261015.md, 18:39 UTC) explicitly does not authorize
 * live activation or credentials and does not waive host or egress qualification.
 *
 * The effective destination allowlist is MANDATORY at egress (dot corrected browser review H3, 15 Oct 2026): blocking
 * non-public addresses alone would still let an allowlisted public origin redirect to, or load from, an unlisted
 * public origin. `egress.mjs` is the executable reference decision the host control must reproduce, and
 * `egress-control.mjs` is the run-bound component the host proxy runs. ACTIVATION-CHECKLIST.md lists every
 * measurement, egress and non-egress, that the opening change must cite. */
export const EGRESS_REQUIREMENTS=Object.freeze([
 'deny-non-public-destinations: the host egress path denies every destination address in 0.0.0.0/8, 10/8, 100.64/10, 127/8, 169.254/16 (including 169.254.169.254 and 169.254.170.2), 172.16/12, 192.0.0/24, 192.0.2/24, 192.88.99/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, 224/4, 240/4, and every IPv6 address outside 2000::/3 or inside 2001::/23, 2001:db8::/32, 2002::/16, 3fff::/20 and 5f00::/16 (covers ::1, fc00::/7 including fd00:ec2::254, fe80::/10, ff00::/8, ::ffff:0:0/96 and 64:ff9b::/96)',
 'enforce-on-resolved-address: the decision is made on the address actually connected to, after DNS resolution, for every connection the browser makes (navigations, redirects, sub-resources, WebSocket, fetch/XHR, downloads), so a public name resolving to a denied address is refused',
 'dns-rebinding: DNS answers containing denied addresses are refused or the connection to them is refused even after an earlier public answer for the same name; DNS is served only by the controlled resolver',
 'effective-origin-allowlist: for every connection the browser makes (each navigation and every redirect hop, sub-resources, fetch/XHR, WebSocket with ws/wss mapped to http/https, downloads) the egress path permits only an origin on the effective platform-maximum ∧ tenant ∧ role allowlist resolved for this conversation run (resolveBrowserPolicy), bound to that run and revoked with it, in addition to the non-public and resolved-address rules; refused: an allowlisted public origin redirecting to an unlisted public origin, an unlisted sub-resource or WebSocket origin, and an origin the platform approves but the tenant or role narrowed away; an empty effective list admits no destination; the decision matches egressDecision (egress.mjs)',
 'redirects: every redirect hop is subject to the same effective-allowlist and destination-address checks as the first request',
 'web-ports-only: outbound destinations are limited to TCP 80 and 443 (plus the controlled resolver); no UDP/QUIC egress except the resolver, unless separately qualified',
 'no-proxy-bypass: no direct route that bypasses the egress control; host instance metadata and container credential endpoints are unreachable from the browser user',
 'proxy-route: the browser is launched with --proxy-server set to the host egress control and no --proxy-bypass, so loopback is proxied too; the control admits each request through createEgressControl (egress-control.mjs) under this run\'s grant, whose policySha256 equals the fragment\'s effective policy digest, connects only to the checked address it returns, and refuses every request once the grant is revoked or expired',
 'connection-coalescing: no unlisted origin reaches the network over a connection or tunnel opened for an allowlisted origin (HTTP/2 or HTTP/3 connection coalescing, ORIGIN frames, Alt-Svc, connection reuse after redirect)',
 'per-conversation-host: the browser host or task is never reused across conversations or tenants and is destroyed with verified cleanup',
 'evidence: measured negative probes from the real non-root sandboxed browser for each denied class, a redirect to a denied address, a rebinding name, an allowlisted-to-unlisted public redirect, an unlisted public sub-resource, an unlisted public WebSocket and a platform-approved origin narrowed away by tenant or role, a proxied-loopback probe, a coalescing probe (an unlisted name sharing an allowlisted origin\'s address and certificate), a WebRTC/QUIC UDP probe and a request after grant revocation, plus a positive allowlisted-origin probe, recorded on the approved host',
]);
export const BROWSER_ACTIVATION=Object.freeze({state:'held',reason:'BROWSER_EGRESS_UNQUALIFIED',evidence:null,requirements:EGRESS_REQUIREMENTS});
/** True only when the gate is open with a recorded evidence reference. Kept a pure function of the record so tests can
 * prove that the shipped record is held and that a record without evidence never opens. */
/** @param {{state:string,evidence:string|null,requirements:readonly string[]}} [record] */
export function activationOpen(record=BROWSER_ACTIVATION){
 return record?.state==='open'&&typeof record.evidence==='string'&&/^[A-Za-z0-9._/-]{1,200}$/u.test(record.evidence)&&record.requirements===EGRESS_REQUIREMENTS;
}
