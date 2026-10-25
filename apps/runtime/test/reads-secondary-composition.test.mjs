import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES,secondaryFixture} from './reads-secondary-fixture.mjs';
import {connect} from '../../worker/conversation/reads/test/native-mcp-fixture.mjs';
for(const [family,id] of CASES)for(const personal of [false,true])test(`${id}: actual ${personal?'General':'client'} MCP uses the existing Core producer and closed observation`,async t=>{
 const f=await secondaryFixture(family,id,{personal}),m=await connect(t,f),result=await m.call();
 assert.equal(result.isError,undefined,JSON.stringify(result));assert.equal(JSON.parse(result.content[0].text).result.tool,id);
 assert.equal(f.calls.filter(path=>path===`/api/clio/tools/${id}`).length,1);assert.equal(f.scene.state.contexts.length,1);
 assert.equal(m.runtime.receipts().length,1);
});
for(const mode of ['off','shadow','enforce'])test(`SAM preserves current ${mode} mode with its three calculation clocks`,async()=>{
 const f=await secondaryFixture('sam-opportunities','search_sam_opportunities',{personal:true,evidenceAccuracyMode:mode}),r=await f.execute();
 assert.equal(r.status,200,await r.clone().text());const context=f.scene.state.contexts[0];assert.equal(context.evidenceAccuracyMode,mode);
 assert.deepEqual(Object.keys(context).sort(),['asOf','evidenceAccuracyMode','sourceHealthAsOf','sourceStatusAsOf']);
 assert.equal(f.calls.filter(p=>p.endsWith('/read-mode-observation')).length,1);
});
for(const [family,id] of CASES)test(`${id}: model context injection, Core refusal and current revocation never release data`,async()=>{
 const injected=await secondaryFixture(family,id);assert.notEqual((await injected.execute({...injected.scene.arguments,normalizationContext:{}})).status,200);assert.equal(injected.calls.length,0);
 const denied=await secondaryFixture(family,id);denied.deny();assert.equal((await denied.execute()).status,403);
 const revoked=await secondaryFixture(family,id);revoked.scene.state.afterSource=revoked.revoke;assert.equal((await revoked.execute()).status,403);
 const malformed=await secondaryFixture(family,id);malformed.scene.state.responseFactory=()=>Response.json({unexpected:true});assert.notEqual((await malformed.execute()).status,200);
});
