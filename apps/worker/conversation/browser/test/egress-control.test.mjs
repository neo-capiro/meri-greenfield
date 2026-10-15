import test from 'node:test';import assert from 'node:assert/strict';
import {createEgressGrant,createEgressControl,EGRESS_GRANT_SCHEMA} from '../egress-control.mjs';
import {proxyConnection} from '../egress-proxy.mjs';
import {validateBrowserPolicy,DEFAULT_BROWSER_POLICY} from '../policy.mjs';
import {resolveBrowserPolicy} from '../resolution.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {binding,enabledPolicy,APPROVED,clock} from './fixtures.mjs';
/** Scripted controlled resolver: answers per name from `table`, records every lookup. Synthetic documentation and
 * public-looking addresses only; nothing is resolved or connected. */
function resolver(table){
 const lookups=[];
 return {lookups,resolve:async name=>{lookups.push(name);const v=table[name];if(v instanceof Error)throw v;return typeof v==='function'?v():v;}};
}
const PUBLIC={'records.example':['93.184.215.14'],'notices.example':['2606:2800:21f:cb07:6820:80da:af6b:8b2c','93.184.215.15'],'archive.example':['93.184.215.16'],'unlisted.example':['93.184.215.17']};
const control=({policy=enabledPolicy(),table=PUBLIC,expiresAtMs=clock()+60000,now=clock}={})=>{
 const r=resolver(table),grant=createEgressGrant({binding,policy:validateBrowserPolicy(policy),expiresAtMs});
 return {r,grant,c:createEgressControl({grant,resolve:r.resolve,now})};
};
test('the grant binds the run and the digest of its effective policy; a disabled policy or a tampered grant has no control',()=>{
 const p=validateBrowserPolicy(enabledPolicy()),grant=createEgressGrant({binding,policy:p,expiresAtMs:clock()+1});
 assert.equal(grant.schema,EGRESS_GRANT_SCHEMA);assert.deepEqual(grant.binding,binding);assert.equal(grant.policySha256,canonicalSha256(p));assert.ok(Object.isFrozen(grant));
 const refuse=fn=>assert.throws(fn,e=>e.code==='BROWSER_CONFIGURATION');
 refuse(()=>createEgressGrant({binding,policy:{enabled:false},expiresAtMs:1}));refuse(()=>createEgressGrant({binding:{...binding,writerFence:0},policy:p,expiresAtMs:1}));refuse(()=>createEgressGrant({binding,policy:p,expiresAtMs:1.5}));
 const json=JSON.parse(JSON.stringify(grant)),ok={grant:json,resolve:async()=>[],now:clock};
 assert.equal(createEgressControl(ok).policySha256,grant.policySha256,'a serialized grant is accepted by the host');
 refuse(()=>createEgressControl({...ok,grant:{...json,policy:{...json.policy,allowedOrigins:[...APPROVED]}}}));
 refuse(()=>createEgressControl({...ok,grant:{...json,schema:'meri-browser-egress-grant/0'}}));
 refuse(()=>createEgressControl({...ok,grant:{...json,binding:{...json.binding,runId:'x'}}}));
 refuse(()=>createEgressControl({...ok,resolve:undefined}));
});
test('an allowlisted origin is admitted and pinned to the checked address; each hop of a redirect chain is decided anew',async()=>{
 const {c,r}=control();
 assert.deepEqual(await c.admit({kind:'navigation',url:`${APPROVED[0]}/start`}),{ok:true,origin:APPROVED[0],connect:{address:'93.184.215.14',port:443}});
 assert.deepEqual(await c.admit({kind:'redirect',url:`${APPROVED[1]}/next`}),{ok:true,origin:APPROVED[1],connect:{address:'2606:2800:21f:cb07:6820:80da:af6b:8b2c',port:443}});
 assert.deepEqual(await c.admit({kind:'redirect',url:'https://unlisted.example/landing'}),{ok:false,code:'BROWSER_ORIGIN_NOT_ALLOWED'},'allowlisted → unlisted public redirect hop');
 assert.deepEqual(r.lookups,['records.example','notices.example'],'an unlisted origin is refused before any DNS lookup');
});
test('unlisted sub-resource, fetch, download, WebSocket and tunnel origins are refused at the control',async()=>{
 const {c}=control();
 for(const kind of ['subresource','fetch','download'])assert.equal((await c.admit({kind,url:'https://cdn.unlisted.example/a.js'})).code,'BROWSER_ORIGIN_NOT_ALLOWED',kind);
 assert.equal((await c.admit({kind:'websocket',url:'wss://unlisted.example/socket'})).code,'BROWSER_ORIGIN_NOT_ALLOWED');
 assert.equal((await c.admit({kind:'websocket',url:'wss://records.example/socket'})).ok,true);
 assert.equal((await c.admit({kind:'tunnel',url:'https://unlisted.example/'})).code,'BROWSER_ORIGIN_NOT_ALLOWED');
 assert.equal((await c.admit({kind:'prefetch',url:`${APPROVED[0]}/`})).code,'BROWSER_EGRESS_KIND');
});
test('the control enforces the effective tenant/role-narrowed list, not the platform-approved maximum',async()=>{
 const role=(over={})=>({...DEFAULT_BROWSER_POLICY,allowedOrigins:APPROVED,...over});
 const platform={maximum:role(),defaults:role(),roleCeilings:{member:role(),viewer:role({allowedOrigins:[APPROVED[0]]})}};
 const narrowed=[resolveBrowserPolicy({platform,tenant:{browser:{allowedOrigins:[APPROVED[0],APPROVED[1]]}},role:'member'}),resolveBrowserPolicy({platform,role:'viewer'}),resolveBrowserPolicy({platform,tenant:{roles:{member:{allowedOrigins:[APPROVED[0]]}}},role:'member'})];
 for(const [i,policy] of narrowed.entries()){
  const {c}=control({policy});
  assert.equal((await c.admit({kind:'navigation',url:`${APPROVED[0]}/`})).ok,true,`#${i} keeps the selected origin`);
  for(const kind of ['navigation','redirect','subresource','fetch','download','tunnel'])assert.equal((await c.admit({kind,url:`${APPROVED[2]}/x`})).code,'BROWSER_ORIGIN_NOT_ALLOWED',`#${i} ${kind}: platform-approved but narrowed away`);
  assert.equal((await c.admit({kind:'websocket',url:'wss://archive.example/s'})).code,'BROWSER_ORIGIN_NOT_ALLOWED',`#${i} websocket`);
 }
 assert.equal((await control({policy:DEFAULT_BROWSER_POLICY}).c.admit({kind:'navigation',url:`${APPROVED[0]}/`})).code,'BROWSER_NO_ALLOWED_DESTINATIONS','an empty effective list admits nothing');
});
test('resolved-address and rebinding protection: any denied answer refuses the name, every admission resolves afresh',async()=>{
 let answer=['93.184.215.14'];
 const table={...PUBLIC,'records.example':()=>answer,'notices.example':['93.184.215.15','10.0.0.5']};
 const {c,r}=control({table});
 assert.equal((await c.admit({kind:'navigation',url:`${APPROVED[0]}/`})).ok,true,'first answer public');
 for(const denied of [['127.0.0.1'],['169.254.169.254'],['10.1.2.3'],['::1'],['fd00:ec2::254'],['::ffff:10.0.0.1'],['64:ff9b::a00:1'],['93.184.215.14','192.168.1.1']]){
  answer=denied;assert.equal((await c.admit({kind:'subresource',url:`${APPROVED[0]}/x.js`})).code,'BROWSER_EGRESS_ADDRESS',denied.join(','));
 }
 assert.equal((await c.admit({kind:'navigation',url:`${APPROVED[1]}/`})).code,'BROWSER_EGRESS_ADDRESS','a mixed answer refuses the whole name');
 assert.equal(r.lookups.filter(n=>n==='records.example').length,9,'no cached answer is reused');
 for(const bad of [[],null,['not-an-address'],Array(33).fill('93.184.215.14'),new Error('SERVFAIL')]){
  const {c:k}=control({table:{...PUBLIC,'records.example':bad}});
  assert.equal((await k.admit({kind:'navigation',url:`${APPROVED[0]}/`})).code,'BROWSER_EGRESS_DNS',String(bad));
 }
});
test('web ports only, IP literals without DNS, revocation and expiry',async()=>{
 const {c:ports}=control({policy:enabledPolicy({allowedOrigins:['https://records.example:8443','https://93.184.215.20']})});
 assert.equal((await ports.admit({kind:'navigation',url:'https://records.example:8443/'})).code,'BROWSER_EGRESS_PORT','allowlisted origin on a non-web port is still refused at egress');
 assert.deepEqual(await ports.admit({kind:'navigation',url:'https://93.184.215.20/'}),{ok:true,origin:'https://93.184.215.20',connect:{address:'93.184.215.20',port:443}});
 let t=clock();const {c,grant}=control({now:()=>t,expiresAtMs:clock()+10});
 assert.equal((await c.admit({kind:'navigation',url:`${APPROVED[0]}/`})).ok,true);
 t=clock()+10;assert.equal((await c.admit({kind:'navigation',url:`${APPROVED[0]}/`})).code,'BROWSER_EGRESS_EXPIRED');
 t=clock();assert.deepEqual(c.revoke(),{revoked:true,binding:grant.binding,policySha256:grant.policySha256});assert.equal(c.revoke().revoked,true,'idempotent');
 assert.equal((await c.admit({kind:'navigation',url:`${APPROVED[0]}/`})).code,'BROWSER_EGRESS_REVOKED');
 // Revocation while a lookup is pending still refuses the admission.
 let release;const slow=control({table:{...PUBLIC,'records.example':()=>new Promise(r=>{release=()=>r(['93.184.215.14']);})}});
 const pending=slow.c.admit({kind:'navigation',url:`${APPROVED[0]}/`});await new Promise(r=>setImmediate(r));slow.c.revoke();release();
 assert.equal((await pending).code,'BROWSER_EGRESS_REVOKED');
});
test('forward-proxy requests: CONNECT tunnels and absolute-form http are decided by the same rule; anything else is refused',async()=>{
 assert.deepEqual(proxyConnection({method:'CONNECT',target:'records.example:443'}),{kind:'tunnel',url:'https://records.example/'});
 assert.deepEqual(proxyConnection({method:'connect',target:'[2606:2800:21f::1]:80'}),{kind:'tunnel',url:'http://[2606:2800:21f::1]/'});
 assert.deepEqual(proxyConnection({method:'GET',target:'http://records.example/a',headers:{Upgrade:'WebSocket'}}),{kind:'websocket',url:'ws://records.example/a'});
 for(const [request,code] of [[{method:'CONNECT',target:'records.example:8443'},'BROWSER_EGRESS_PORT'],[{method:'CONNECT',target:'records.example:0443'},'BROWSER_EGRESS_PORT'],[{method:'CONNECT',target:'records.example'},'BROWSER_EGRESS_REQUEST'],[{method:'GET',target:'/relative'},'BROWSER_EGRESS_REQUEST'],[{method:'GET',target:'ftp://records.example/'},'BROWSER_EGRESS_REQUEST'],[{},'BROWSER_EGRESS_REQUEST']])
  assert.deepEqual(proxyConnection(request),{code},JSON.stringify(request));
 const {c}=control({policy:enabledPolicy({allowedOrigins:[APPROVED[0],'http://records.example']})});
 assert.equal((await c.admitProxyRequest({method:'CONNECT',target:'records.example:443'})).ok,true);
 assert.equal((await c.admitProxyRequest({method:'CONNECT',target:'unlisted.example:443'})).code,'BROWSER_ORIGIN_NOT_ALLOWED','unlisted tunnel (https, wss or redirect target)');
 assert.equal((await c.admitProxyRequest({method:'CONNECT',target:'10.0.0.1:443'})).code,'BROWSER_URL_NOT_PUBLIC');
 assert.equal((await c.admitProxyRequest({method:'CONNECT',target:'records.example:22'})).code,'BROWSER_EGRESS_PORT');
 assert.equal((await c.admitProxyRequest({method:'GET',target:'http://records.example/x'})).ok,true);
 assert.equal((await c.admitProxyRequest({method:'GET',target:'http://unlisted.example/x'})).code,'BROWSER_ORIGIN_NOT_ALLOWED');
 assert.equal((await c.admitProxyRequest({method:'GET',target:'http://unlisted.example/s',headers:{upgrade:'websocket'}})).code,'BROWSER_ORIGIN_NOT_ALLOWED','unlisted plain WebSocket');
 assert.equal((await c.admitProxyRequest({method:'GET',target:'http://records.example:8080/x'})).code,'BROWSER_ORIGIN_NOT_ALLOWED');
});
