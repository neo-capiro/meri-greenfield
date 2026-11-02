/** Browser activation gate (dot review HOLD on p1c @e0f94fe, 15 Oct 2026). The product default is on (policy.mjs), but
 * no browser server, tool, hook or download port is contributed while this gate is held. Playwright MCP
 * `--allowed-origins`/`--blocked-origins` and the in-process URL gate are not a network boundary: they do not see
 * redirects, sub-resource requests, DNS answers or rebinding.
 *
 * The gate is a CONTROL configuration value (`browserActivation`, config.mjs), rendered from the deployment inputs
 * (`features.browserActivation`, infra/product-preview/first-chat/render-material.mjs). Absent or `{state:'held'}` is
 * the held record below. An open record must cite the evidence record measured on the approved isolated browser host
 * (D005) for every requirement below and pin the exact requirement list it was measured against; the renderer reads that
 * file from the source root and refuses a record whose SHA-256 does not match, then attaches its verification receipt,
 * without which control refuses the open record. A source change to
 * `EGRESS_REQUIREMENTS` changes `EGRESS_REQUIREMENTS_SHA256`, so every previously rendered open record refuses at
 * render and at startup until the evidence is re-recorded. Control is the single owner: its host currentness answers
 * `browserAdmitted:false` while held (apps/control/browser-hosts/currentness.mjs), which refuses every host-side
 * browser operation (host/control/postgres-store.mjs, browser-host-run-facts.mjs), and the AgentCore runtime mounts the
 * browser port only when control's admission settings say `browser.enabled` (agentcore-candidate.mjs,
 * agentcore-query.mjs). No runtime argument, environment variable, tenant setting or policy field opens it. The
 * recorded product direction that the capability be enabled by default (DOT-REVIEW-FABLE-P1C-e0f94fe0-20261015.md,
 * 18:39 UTC) explicitly does not authorize live activation or credentials and does not waive host or egress
 * qualification.
 *
 * The effective destination allowlist is MANDATORY at egress (dot corrected browser review H3, 15 Oct 2026): blocking
 * non-public addresses alone would still let an allowlisted public origin redirect to, or load from, an unlisted
 * public origin. `egress.mjs` is the executable reference decision the host control must reproduce, and
 * `egress-control.mjs` is the run-bound component the host proxy runs. ACTIVATION-CHECKLIST.md lists every
 * measurement, egress and non-egress, that the evidence record must cite. */
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
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
/** Digest of the exact requirement list an open record must have been measured against. */
export const EGRESS_REQUIREMENTS_SHA256=canonicalSha256(EGRESS_REQUIREMENTS);
/** The record an absent or `{state:'held'}` configuration compiles to; also what every malformed record is refused as. */
export const HELD_BROWSER_ACTIVATION=Object.freeze({state:'held',reason:'BROWSER_EGRESS_UNQUALIFIED',evidence:null});
const EVIDENCE=/^[A-Za-z0-9._/-]{1,200}$/u,HEX64=/^[a-f0-9]{64}$/u,COMMIT=/^[0-9a-f]{40}$/u;
/** Schema of the receipt the renderer attaches after it has read the evidence file and matched its SHA-256. */
export const BROWSER_ACTIVATION_RENDER_VERIFICATION='meri-browser-activation-render-verification/1';
const fail=()=>{throw Object.assign(new Error('BROWSER_ACTIVATION_CONFIGURATION'),{code:'BROWSER_ACTIVATION_CONFIGURATION'});};
const held=v=>{if(v.state==='held'){if(Object.keys(v).length!==1)fail();return HELD_BROWSER_ACTIVATION;}return null;};
const openFields=v=>{
 if(v.state!=='open'||typeof v.evidence!=='string'||!EVIDENCE.test(v.evidence)||v.evidence.includes('..')||
  !HEX64.test(v.evidenceSha256)||v.requirementsSha256!==EGRESS_REQUIREMENTS_SHA256)fail();
 return {state:'open',evidence:v.evidence,evidenceSha256:v.evidenceSha256,requirementsSha256:v.requirementsSha256};
};
/** The DEPLOYMENT-INPUT record (`features.browserActivation`). `undefined` and `{state:'held'}` are the held record. An
 * open record is exactly `{state:'open',evidence,evidenceSha256,requirementsSha256}`: `evidence` is the repository
 * path of the ACTIVATION-CHECKLIST.md measurement record, `evidenceSha256` the SHA-256 the renderer must find when it
 * reads that file from the source root, and `requirementsSha256` must equal `EGRESS_REQUIREMENTS_SHA256`. Anything
 * else refuses (never "held by accident"), so a typo in a deliberate opening is reported instead of silently keeping
 * the browser off. This function checks shape only; the renderer reads and hashes the file. */
export function compileBrowserActivationInput(raw){
 if(raw===undefined)return HELD_BROWSER_ACTIVATION;
 let v;try{v=own(raw,['state'],['evidence','evidenceSha256','requirementsSha256']);}catch{fail();}
 return held(v)??Object.freeze(openFields(v));
}
/** The CONTROL record (`browserActivation` in control configuration): the input record plus the renderer's
 * verification receipt `renderVerification:{schema,sourceCommit,renderedAtMs,evidenceSha256,requirementsSha256}`, whose
 * digests must restate the record's. Control cannot read the repository; the receipt is a render marker that catches a
 * record the renderer never saw, not a cryptographic binding. The real binding is operational: the control
 * configuration is only ever produced by the renderer from reviewed inputs by the release executor, and anyone who can
 * edit the published control configuration already controls the deployment. */
export function compileBrowserActivation(raw){
 if(raw===undefined)return HELD_BROWSER_ACTIVATION;
 let v;try{v=own(raw,['state'],['evidence','evidenceSha256','requirementsSha256','renderVerification']);}catch{fail();}
 const h=held(v);if(h)return h;
 const open=openFields(v);let r;try{r=own(v.renderVerification,['schema','sourceCommit','renderedAtMs','evidenceSha256','requirementsSha256']);}catch{fail();}
 if(r.schema!==BROWSER_ACTIVATION_RENDER_VERIFICATION||!COMMIT.test(r.sourceCommit)||!Number.isSafeInteger(r.renderedAtMs)||r.renderedAtMs<1||
  r.evidenceSha256!==open.evidenceSha256||r.requirementsSha256!==open.requirementsSha256)fail();
 return Object.freeze({...open,renderVerification:Object.freeze({schema:r.schema,sourceCommit:r.sourceCommit,renderedAtMs:r.renderedAtMs,evidenceSha256:r.evidenceSha256,requirementsSha256:r.requirementsSha256})});
}
/** True only for a compiled, render-verified open record of the exact current requirements. Pure, so tests prove
 * that a record without evidence, without the renderer's receipt or measured against other requirements never opens. */
export function activationOpen(record){
 return record?.state==='open'&&typeof record.evidence==='string'&&EVIDENCE.test(record.evidence)&&record.requirementsSha256===EGRESS_REQUIREMENTS_SHA256&&
  record.renderVerification?.schema===BROWSER_ACTIVATION_RENDER_VERIFICATION;
}
