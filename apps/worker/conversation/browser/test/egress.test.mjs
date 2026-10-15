import test from 'node:test';import assert from 'node:assert/strict';
import {EGRESS_REQUIREMENTS,BROWSER_ACTIVATION,activationOpen} from '../activation.mjs';
import {egressDecision,egressRedirectChain,EGRESS_CONNECTION_KINDS} from '../egress.mjs';
import {validateBrowserPolicy,DEFAULT_BROWSER_POLICY} from '../policy.mjs';
import {resolveBrowserPolicy} from '../resolution.mjs';
import {enabledPolicy,APPROVED} from './fixtures.mjs';
/** Source-level only (dot corrected browser review H3): these fix the decisions the egress control must make; they are
 * not a measured browser or network result. */
const requirement=id=>EGRESS_REQUIREMENTS.find(r=>r.startsWith(`${id}:`));
test('H3: the activation record makes the effective origin allowlist mandatory for every connection kind and hop',()=>{
 const allowlist=requirement('effective-origin-allowlist');assert.ok(allowlist,'mandatory requirement present');
 for(const term of ['every redirect hop','sub-resources','fetch/XHR','WebSocket','downloads','platform-maximum ∧ tenant ∧ role','in addition to the non-public and resolved-address rules','allowlisted public origin redirecting to an unlisted public origin','narrowed away','egressDecision'])assert.ok(allowlist.includes(term),term);
 assert.match(requirement('redirects'),/effective-allowlist and destination-address checks/u);
 for(const probe of ['allowlisted-to-unlisted public redirect','unlisted public sub-resource','unlisted public WebSocket','narrowed away by tenant or role'])assert.ok(requirement('evidence').includes(probe),probe);
 assert.equal(activationOpen(BROWSER_ACTIVATION),false,'still held');
 assert.equal(activationOpen({state:'open',evidence:'qualification/browser-egress.json',requirements:EGRESS_REQUIREMENTS.filter(r=>!r.startsWith('effective-origin-allowlist:'))}),false,'a record without the allowlist requirement never opens');
});
test('H3: an allowlisted public origin redirecting to an unlisted public origin is refused at the redirect hop',()=>{
 const p=validateBrowserPolicy(enabledPolicy());
 assert.deepEqual(egressRedirectChain(p,[`${APPROVED[0]}/start`,`${APPROVED[1]}/next`]),{ok:true});
 assert.deepEqual(egressRedirectChain(p,[`${APPROVED[0]}/start`,'https://unlisted.example/landing']),{ok:false,code:'BROWSER_ORIGIN_NOT_ALLOWED',hop:1});
 assert.deepEqual(egressRedirectChain(p,[`${APPROVED[0]}/start`,`${APPROVED[1]}/a`,'https://8.8.8.8/b']),{ok:false,code:'BROWSER_ORIGIN_NOT_ALLOWED',hop:2},'public IP literal not on the list');
 assert.deepEqual(egressRedirectChain(p,[`${APPROVED[0]}/start`,'http://records.example/downgrade']),{ok:false,code:'BROWSER_ORIGIN_NOT_ALLOWED',hop:1},'scheme downgrade is another origin');
 assert.equal(egressRedirectChain(p,[`${APPROVED[0]}/start`,'http://169.254.169.254/latest/meta-data/']).code,'BROWSER_URL_NOT_PUBLIC','non-public protection still applies');
});
test('H3: unlisted sub-resource, fetch, download and WebSocket origins are refused; listed ones pass with http/https origin mapping',()=>{
 const p=validateBrowserPolicy(enabledPolicy());
 for(const kind of ['subresource','fetch','download']){
  assert.equal(egressDecision(p,{kind,url:`${APPROVED[0]}/asset.js`}).ok,true,kind);
  assert.equal(egressDecision(p,{kind,url:'https://cdn.unlisted.example/asset.js'}).code,'BROWSER_ORIGIN_NOT_ALLOWED',kind);
 }
 assert.deepEqual(egressDecision(p,{kind:'websocket',url:'wss://records.example/socket'}),{ok:true,origin:'https://records.example'});
 for(const url of ['wss://unlisted.example/socket','ws://records.example/socket','wss://records.example:8443/socket'])assert.equal(egressDecision(p,{kind:'websocket',url}).code,'BROWSER_ORIGIN_NOT_ALLOWED',url);
 assert.equal(egressDecision(p,{kind:'websocket',url:'wss://127.0.0.1/socket'}).code,'BROWSER_URL_NOT_PUBLIC');
 assert.equal(egressDecision(p,{kind:'websocket',url:'https://records.example/socket'}).code,'BROWSER_URL_SCHEME');
 assert.equal(egressDecision(p,{kind:'subresource',url:'wss://records.example/'}).code,'BROWSER_URL_SCHEME');
 assert.equal(egressDecision(p,{kind:'prefetch',url:`${APPROVED[0]}/`}).code,'BROWSER_EGRESS_KIND');
 assert.deepEqual(EGRESS_CONNECTION_KINDS,['navigation','redirect','subresource','fetch','websocket','download','tunnel']);
});
test('H3: the egress decision uses the effective tenant/role-narrowed list, never the platform-approved maximum',()=>{
 const role=(over={})=>({...DEFAULT_BROWSER_POLICY,allowedOrigins:APPROVED,...over});
 const platform={maximum:role(),defaults:role(),roleCeilings:{member:role(),viewer:role({allowedOrigins:[APPROVED[0]]})}};
 const tenantNarrowed=resolveBrowserPolicy({platform,tenant:{browser:{allowedOrigins:[APPROVED[0],APPROVED[1]]}},role:'member'});
 for(const kind of EGRESS_CONNECTION_KINDS.filter(k=>k!=='websocket'))assert.equal(egressDecision(tenantNarrowed,{kind,url:`${APPROVED[2]}/x`}).code,'BROWSER_ORIGIN_NOT_ALLOWED',`tenant narrowed ${kind}`);
 assert.equal(egressDecision(tenantNarrowed,{kind:'websocket',url:'wss://archive.example/s'}).code,'BROWSER_ORIGIN_NOT_ALLOWED');
 const roleNarrowed=resolveBrowserPolicy({platform,role:'viewer'});
 assert.equal(egressRedirectChain(roleNarrowed,[`${APPROVED[0]}/a`,`${APPROVED[1]}/b`]).hop,1,'role ceiling narrows the redirect target');
 const tenantRole=resolveBrowserPolicy({platform,tenant:{roles:{member:{allowedOrigins:[APPROVED[1]]}}},role:'member'});
 assert.equal(egressDecision(tenantRole,{kind:'navigation',url:`${APPROVED[0]}/`}).code,'BROWSER_ORIGIN_NOT_ALLOWED','tenant role narrowing');
 assert.equal(egressDecision(validateBrowserPolicy(),{kind:'navigation',url:`${APPROVED[0]}/`}).code,'BROWSER_NO_ALLOWED_DESTINATIONS','empty effective list admits nothing');
 assert.equal(egressDecision(resolveBrowserPolicy({platform,tenant:{browser:{enabled:false}},role:'member'}),{kind:'navigation',url:`${APPROVED[0]}/`}).code,'BROWSER_DISABLED');
});
test('the activation checklist names every egress requirement, the proxy route and connection coalescing are required, and the gate stays held',async()=>{
 const {readFile}=await import('node:fs/promises');
 const checklist=await readFile(new URL('../ACTIVATION-CHECKLIST.md',import.meta.url),'utf8');
 for(const id of EGRESS_REQUIREMENTS.map(r=>r.slice(0,r.indexOf(':'))).filter(id=>id!=='evidence'))assert.ok(checklist.includes(`| ${id}`)||checklist.includes(`${id}, `)||checklist.includes(`, ${id} |`),id);
 assert.match(requirement('proxy-route'),/--proxy-server.*no --proxy-bypass.*createEgressControl.*policySha256.*revoked or expired/su);
 assert.match(requirement('connection-coalescing'),/coalescing/u);
 for(const probe of ['proxied-loopback probe','coalescing probe','WebRTC/QUIC UDP probe','request after grant revocation'])assert.ok(requirement('evidence').includes(probe),probe);
 assert.equal(BROWSER_ACTIVATION.state,'held');assert.equal(BROWSER_ACTIVATION.evidence,null);assert.equal(activationOpen(),false);
});
