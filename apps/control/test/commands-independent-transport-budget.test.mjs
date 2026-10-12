import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,id,NOW,nextTurn} from './commands-independent-fixture.mjs';
import {createCommandAuthority} from '../../gateway/index.mjs';

for(const [name,response] of [
 ['wrong status',()=>new Response('{}',{status:403,headers:{'content-type':'application/json'}})],
 ['HTML',()=>new Response('{}',{headers:{'content-type':'text/html'}})],
 ['compressed',()=>new Response('{}',{headers:{'content-type':'application/json','content-encoding':'gzip'}})],
 ['oversized length',()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'65537'}})],
 ['wrong length',()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'1'}})],
 ['broken UTF8',()=>new Response(new Uint8Array([0xff]),{headers:{'content-type':'application/json'}})],
 ['broken JSON',()=>new Response('{',{headers:{'content-type':'application/json'}})],
 ['oversized streamed data',()=>new Response('x'.repeat(65537),{headers:{'content-type':'application/json'}})]
])test(`actual HTTP ${name} response retains unknown command effect and no success`,async()=>{
 const f=fixture();f.state.hooks.http=response;await assert.rejects(f.make().execute(f.value,'synthetic'),/OUTCOME_UNKNOWN/);assert.equal(f.state.effects,1);assert.equal(f.state.sqlRows[0].state,'UNKNOWN');assert.equal(f.calls.includes('complete'),false);assert.equal(f.calls.includes('settle'),false);
});
for(const [name,mutate] of [
 ['foreign binding',c=>c.binding={...c.binding,writerFence:99}],['expired',c=>c.expiresAtMs=NOW],['fractional expiry',c=>c.expiresAtMs=NOW+0.5],['header injection',c=>c.bearerToken='bad\r\nheader'],['extra identity header',c=>c.actorId='other']
])test(`credential broker ${name} refuses before journal/source`,async()=>{
 const f=fixture();f.state.hooks.credentials=()=>{const c={binding:f.execution.executorBinding,bearerToken:'synthetic',serviceSecret:'synthetic',expiresAtMs:NOW+1000};mutate(c);return c;};await assert.rejects(f.make().execute(f.value,'synthetic'));assert.equal(f.calls.includes('insert'),false);assert.equal(f.state.effects,0);
});
test('attachment broker must bind exact immutable version and unique native ID',async()=>{
 for(const bad of ['version','destination','extra']){
  const f=fixture('artifact.file');f.state.hooks.attachments=()=>{const fact={binding:f.execution.executorBinding,destination:f.context.destination,expiresAtMs:NOW+1000,objects:[{object:structuredClone(f.command.attachments[0]),attachmentId:id(25)}]};if(bad==='version')fact.objects[0].object.versionId='substituted';if(bad==='destination')fact.destination={...fact.destination,clientId:id(90)};if(bad==='extra')fact.objects.push(structuredClone(fact.objects[0]));return fact;};await assert.rejects(f.make().execute(f.value,'synthetic'));assert.equal(f.state.effects,0);assert.equal(f.calls.includes('insert'),false);
 }
});
test('native per-file IDs bind source observations to exact selected immutable objects',async()=>{
 const f=fixture('artifact.file');f.state.hooks.http=()=>{const r=f.result();r.files[0].attachmentId=id(99);return new Response(JSON.stringify(r),{headers:{'content-type':'application/json'}});};await assert.rejects(f.make().execute(f.value,'synthetic'),/OUTCOME_UNKNOWN/);assert.equal(f.state.sqlRows[0].state,'UNKNOWN');
});
test('source tokens are private one-use references and refuse executor substitution',async()=>{
 const f=fixture(),authority=await createCommandAuthority({authorityPorts:f.ports,now:()=>NOW,maxFactBytes:65536}).check({credential:'synthetic',descriptor:f.descriptor,input:f.command,signal:new AbortController().signal,limitDeadline:()=>{}});
 const prepare=()=>f.source.prepare({command:f.command,context:f.context,authority,deadlineMs:NOW+1000,signal:new AbortController().signal});
 const token=await prepare();await assert.rejects(f.source.execute({...token},{authority,signal:new AbortController().signal}),/PREPARATION_REFUSED/);
 await f.source.execute(token,{authority,signal:new AbortController().signal});await assert.rejects(f.source.execute(token,{authority,signal:new AbortController().signal}),/PREPARATION_REFUSED/);assert.equal(f.state.effects,1);
 const next=await prepare();await assert.rejects(f.source.execute(next,{authority:{...authority,binding:{...authority.binding,workerId:id(99)}},signal:new AbortController().signal}),/IDENTITY_REFUSED/);assert.equal(f.state.effects,1);
});
test('budget reserve and settle are on actual execution path around source effect',async()=>{
 const f=fixture();await f.make().execute(f.value,'synthetic');assert.ok(f.calls.indexOf('reserve')<f.calls.indexOf('http'));assert.ok(f.calls.indexOf('http')<f.calls.indexOf('settle'));assert.ok(f.calls.indexOf('settle')<f.calls.indexOf('complete'));assert.equal(f.calls.includes('uncertain'),false);
});
for(const stage of ['reserve','settle'])test(`wrong ${stage} acknowledgement never releases success and retains liability`,async()=>{
 const f=fixture();f.state.hooks[stage]=()=>JSON.stringify({reservationId:id(99),decision:stage==='reserve'?'reserved':'settled'});await assert.rejects(f.make().execute(f.value,'synthetic'),/OUTCOME_UNKNOWN/);assert.equal(f.calls.includes('uncertain'),true);assert.equal(f.state.effects,stage==='reserve'?0:1);assert.equal(f.state.sqlRows[0].state,'UNKNOWN');
});
test('freshly reduced capability output ceiling refuses before accounting success',async()=>{
 const f=fixture();f.state.hooks.http=()=>{f.state.maxOutputBytes=16;};await assert.rejects(f.make().execute(f.value,'synthetic'),/OUTCOME_UNKNOWN/);assert.equal(f.calls.includes('settle'),false);assert.equal(f.calls.includes('uncertain'),true);assert.equal(f.state.sqlRows[0].state,'UNKNOWN');
});
test('expiry while settlement is parked cannot start receipt transaction or release output',async()=>{
 const f=fixture(),entered=Promise.withResolvers(),parked=Promise.withResolvers();f.state.hooks.http=()=>{f.state.authorityDeadline=NOW+25;};f.state.hooks.settle=()=>{entered.resolve();return parked.promise;};
 const pending=f.make().execute(f.value,'synthetic');await entered.promise;await assert.rejects(pending,/OUTCOME_UNKNOWN/);assert.equal(f.calls.includes('complete'),false);parked.resolve(JSON.stringify({reservationId:id(30),decision:'settled'}));await nextTurn();assert.equal(f.calls.includes('complete'),false);
});
test('revocation after accounting succeeds preserves accounting and forbids success receipt',async()=>{
 const f=fixture();f.state.hooks.settle=()=>{f.state.revoked=true;};await assert.rejects(f.make().execute(f.value,'synthetic'),/OUTCOME_UNKNOWN/);assert.equal(f.calls.includes('uncertain'),false);assert.equal(f.calls.includes('complete'),false);assert.equal(f.state.sqlRows[0].state,'UNKNOWN');
});
