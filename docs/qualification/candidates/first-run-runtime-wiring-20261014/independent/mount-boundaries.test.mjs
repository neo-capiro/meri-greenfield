// Independent startup/compiled-port assertions. No database socket, native service or SDK query.
import test from 'node:test';import assert from 'node:assert/strict';
import {assembleControl} from '../../../../../apps/runtime/control.mjs';
import {binding,scopes,versions,storeFixture} from '../../../../../apps/control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
const now=()=>100000;
const configuration={sourceEnabled:false,limits:{requestMs:100,requestBytes:65536},native:{maxResponseBytes:65536},sessions:{maxSessions:3,maxTtlMs:1000},temporal:{taskQueue:'source-only'},versions};
function input(factory){const f=storeFixture();return {...f,options:{configuration,pool:f.pool,client:{workflow:{async start(){throw Error('No workflow dispatch admitted');},getHandle(){throw Error('No workflow dispatch admitted');}}},native:{call(){throw Error('No native service admitted');}},now,productPortsFactory:factory}};}
class IdentityOwner{
 calls=[];
 async verifyIdentity(){this.calls.push('identity');return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'source-only',checkedAtMs:now(),expiresAtMs:now()+1000};}
 async resolveContext({identity}){this.calls.push('context');return {identitySha256:hash(identity),binding,scopes,selectedClientId:scopes[0].resourceId,contextRevision:'source-only',checkedAtMs:now(),expiresAtMs:now()+1000};}
}
test('factory product ports retain original prototype receivers and methods after capture, without borrowing cleanup',async()=>{
 const owner=new IdentityOwner(),f=input(()=>({identityContext:owner}));let closes=0;f.options.pool.end=()=>{closes++;};
 const assembly=assembleControl(f.options);
 owner.verifyIdentity=()=>{throw Error('late replacement');};owner.resolveContext=()=>{throw Error('late replacement');};
 try{const response=await assembly.application.handle(new Request('https://source-only.invalid/api/action-followthrough/session',{method:'POST',headers:{authorization:'Bearer synthetic-existing-identity','content-type':'application/json'},body:'{}'}));assert.equal(response.status,200);const r=await response.json();assert.equal(r.context.runId,binding.runId);assert.equal(r.context.selectedClientId,scopes[0].resourceId);assert.deepEqual(owner.calls,['identity','context']);assert.equal(f.state.calls.length,0);}finally{assembly.close();}
 assert.equal(closes,0);assert.equal(assembly.sessions.status().closed,true);
});
test('proxy factory results are refused without reflective caller traps or SQL effects',()=>{
 let traps=0;const proxy=new Proxy({identityContext:{}},{getPrototypeOf(){traps++;throw Error('trap');},ownKeys(){traps++;throw Error('trap');}}),f=input(()=>proxy);
 assert.throws(()=>assembleControl(f.options));assert.equal(traps,0);assert.equal(f.state.calls.length,0);
});
test('a first-run mounting factory that accidentally returns nothing cannot silently select unavailable ports',()=>{
 const f=input(()=>undefined);assert.throws(()=>assembleControl(f.options),{code:'PRODUCT_PORTS_CONFIGURATION'});assert.equal(f.state.calls.length,0);
});
