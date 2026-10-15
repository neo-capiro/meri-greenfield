/** Browser activation gate (dot review HOLD on p1c @e0f94fe, 15 Oct 2026). The product default is on (policy.mjs), but
 * no browser server, tool, hook or download port is contributed while this gate is held. Playwright MCP
 * `--allowed-origins`/`--blocked-origins` and the in-process URL gate are not a network boundary: they do not see
 * redirects, sub-resource requests, DNS answers or rebinding. The gate opens only by a reviewed source change that
 * records accepted evidence for every requirement below on the approved isolated browser host (D005); there is no
 * runtime argument, environment variable or policy field that opens it. The recorded product direction that the
 * capability be enabled by default (DOT-REVIEW-FABLE-P1C-e0f94fe0-20261015.md, 18:39 UTC) explicitly does not authorize
 * live activation or credentials and does not waive host or egress qualification. */
export const EGRESS_REQUIREMENTS=Object.freeze([
 'deny-non-public-destinations: the host egress path denies every destination address in 0.0.0.0/8, 10/8, 100.64/10, 127/8, 169.254/16 (including 169.254.169.254 and 169.254.170.2), 172.16/12, 192.0.0/24, 192.0.2/24, 192.88.99/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, 224/4, 240/4, and every IPv6 address outside 2000::/3 or inside 2001::/23, 2001:db8::/32, 2002::/16, 3fff::/20 and 5f00::/16 (covers ::1, fc00::/7 including fd00:ec2::254, fe80::/10, ff00::/8, ::ffff:0:0/96 and 64:ff9b::/96)',
 'enforce-on-resolved-address: the decision is made on the address actually connected to, after DNS resolution, for every connection the browser makes (navigations, redirects, sub-resources, WebSocket, fetch/XHR, downloads), so a public name resolving to a denied address is refused',
 'dns-rebinding: DNS answers containing denied addresses are refused or the connection to them is refused even after an earlier public answer for the same name; DNS is served only by the controlled resolver',
 'redirects: every redirect hop is subject to the same destination check as the first request',
 'web-ports-only: outbound destinations are limited to TCP 80 and 443 (plus the controlled resolver); no UDP/QUIC egress except the resolver, unless separately qualified',
 'no-proxy-bypass: no direct route that bypasses the egress control; host instance metadata and container credential endpoints are unreachable from the browser user',
 'per-conversation-host: the browser host or task is never reused across conversations or tenants and is destroyed with verified cleanup',
 'evidence: measured negative probes from the real non-root sandboxed browser for each denied class, a redirect to a denied address and a rebinding name, plus a positive public-origin probe, recorded on the approved host',
]);
export const BROWSER_ACTIVATION=Object.freeze({state:'held',reason:'BROWSER_EGRESS_UNQUALIFIED',evidence:null,requirements:EGRESS_REQUIREMENTS});
/** True only when the gate is open with a recorded evidence reference. Kept a pure function of the record so tests can
 * prove that the shipped record is held and that a record without evidence never opens. */
/** @param {{state:string,evidence:string|null,requirements:readonly string[]}} [record] */
export function activationOpen(record=BROWSER_ACTIVATION){
 return record?.state==='open'&&typeof record.evidence==='string'&&/^[A-Za-z0-9._/-]{1,200}$/u.test(record.evidence)&&record.requirements===EGRESS_REQUIREMENTS;
}
