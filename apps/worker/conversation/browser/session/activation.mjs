/** Live browser takeover activation gate. HELD. Takeover is a required feature that follows the initial live version
 * (owner decision 6, Q-X0 and Q-X1, FABLE-OWNER-DECISIONS-20261015.md). Like the browser gate (`../activation.mjs`), it
 * opens only by a reviewed source change that records evidence for every requirement below; no runtime argument,
 * environment variable or policy field opens it. It can never open while the browser activation itself is held. */
import {activationOpen as browserActivationOpen,BROWSER_ACTIVATION} from '../activation.mjs';
export const TAKEOVER_REQUIREMENTS=Object.freeze([
 'browser-activation: the browser activation gate (../activation.mjs) is open with recorded D005 host evidence',
 'placement: the owner approved the takeover session owner placement on the D005 browser host (Q-X2, awaiting Neo)',
 'session-owner: the browser session owner serves Playwright MCP 0.0.83 through createConnection and enforces the S1 fence (fence.mjs), the S2 filter (confidentiality.mjs) and S3 destruction (destruction.mjs) at its single execution point, with the D005 non-root browser and renderer sandbox evidence re-run on that launch path',
 'relay-path-separation: the browser network namespace cannot reach the session owner socket or the worker to control channel (measured)',
 'live-session-relay: the control-domain relay routes frames and input only for current leases, with single-use viewer tickets of 60 s or less bound to tenant, actor, conversation, run and session owner instance',
 'lifecycle: takeover.begin/takeover.end are pause-family lifecycle controls (contract by dot); L1, L2 and L4 lifecycle holds closed so resume retires the paused attempt exactly',
 'withdrawal: S4 withdrawal generations are served for platform feature, tenant enablement, membership and conversation scopes, with the 30 s propagation and staleness bounds measured end to end (Q-X7)',
 'frontend: the viewer, lease controls and every drain, UNKNOWN, reset, reconnecting and paused state exist in capiro-frontend on main',
 'evidence: S1 tests 1-8, S2 tests 1-5 and 7, S3 tests 1-6 and the takeover acceptance tests (design 3.6) pass on the D005 host',
]);
export const TAKEOVER_ACTIVATION=Object.freeze({state:'held',reason:'TAKEOVER_UNQUALIFIED',evidence:null,requirements:TAKEOVER_REQUIREMENTS});
/** True only for an open record with an evidence reference over exactly these requirements, and only while the browser
 * gate is open too. The shipped record is held. */
export function takeoverActivationOpen(record=TAKEOVER_ACTIVATION,browser=BROWSER_ACTIVATION){
 return browserActivationOpen(browser)&&record?.state==='open'&&typeof record.evidence==='string'&&/^[A-Za-z0-9._/-]{1,200}$/u.test(record.evidence)&&record.requirements===TAKEOVER_REQUIREMENTS;
}
