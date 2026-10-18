/** Synthetic dispatch boundary: a verified memory receipt must remain live through final release. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createToolDispatch} from '../dispatch/tool-dispatch.mjs';
import {createClientKnowledgeFixture,NOW,uuid} from '../sources/client-knowledge/test/fixtures.mjs';

const invocationId='synthetic_memory_call_1';
const expiryMs=NOW+1000;
const request=operation=>JSON.stringify({operation,arguments:{query:'  approved allocation  '}});

function scene() {
  const f=createClientKnowledgeFixture('search_memory'),events=[];
  let observedCall;
  const authority={
    async identify(){events.push('identify');return {claims:f.claims,run:{deadlineMs:f.authority.deadlineMs}};},
    async check(){events.push('check');return f.authority;},
  };
  const budget={
    async reserve({reservationId}){events.push('reserve');return JSON.stringify({reservationId,decision:'reserved'});},
    async settle({reservationId}){events.push('settle');return JSON.stringify({reservationId,decision:'settled'});},
    async markUncertain(){events.push('uncertain');},
  };
  const entry={descriptor:f.contract.descriptor,contract:f.contract,async execute(call){
    events.push('handler');observedCall=call;call.limitReleaseDeadline(expiryMs);
    return JSON.stringify({binding:call.authority.binding,subject:call.authority.subject,
      operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page(call.input)});
  }};
  const create=changes=>createToolDispatch({catalog:{entry:()=>entry,discoverable:()=>[entry]},authority,budget,
    limits:{maxRequestBytes:65536,maxResponseBytes:1048576,maxRequestMs:2000,maxCleanupMs:100},
    now:()=>f.state.now,newId:()=>uuid('9'),sourceEnabled:true,invocationId,...changes});
  const run=changes=>create(changes).execute(request(f.operation),'synthetic');
  return {f,events,authority,budget,entry,create,run,get call(){return observedCall;}};
}

test('search memory requires a trusted invocation before authority or budget effects',async()=>{
  const s=scene();await assert.rejects(s.run({invocationId:undefined}),/UNAVAILABLE/);
  assert.deepEqual(s.events,[]);
});

test('search memory carries invocation and validated receipt expiry without changing the public result',async()=>{
  const s=scene(),output=JSON.parse(await s.run());
  assert.equal(s.call.invocationId,invocationId);
  assert.equal(typeof s.call.limitReleaseDeadline,'function');
  assert.deepEqual(output.result,s.f.page(s.call.input));
  assert.equal(s.events.filter(event=>event==='check').length,5);
  assert.equal(s.events.filter(event=>event==='settle').length,1);
  assert.equal(s.events.includes('uncertain'),false);
});

test('search memory cannot release without exactly one receipt expiry',async()=>{
  for(const invalid of ['missing','duplicate','expired','beyond-dispatch']){
    const s=scene(),original=s.entry.execute;
    s.entry.execute=async call=>{
      if(invalid==='missing')return JSON.stringify({binding:call.authority.binding,subject:call.authority.subject,
        operation:s.f.operation,argumentsSha256:call.argumentsSha256,result:s.f.page(call.input)});
      if(invalid==='duplicate'){call.limitReleaseDeadline(expiryMs);call.limitReleaseDeadline(expiryMs);}
      if(invalid==='expired')call.limitReleaseDeadline(NOW);
      if(invalid==='beyond-dispatch')call.limitReleaseDeadline(NOW+2001);
      return original(call);
    };
    await assert.rejects(s.run(),/INVALID_RESULT/);
    assert.equal(s.events.includes('settle'),false,invalid);
    assert.equal(s.events.filter(event=>event==='uncertain').length,1,invalid);
  }
});

test('eligibility expiry during settlement blocks final release',async()=>{
  const s=scene();s.budget.settle=async({reservationId})=>{
    s.events.push('settle');s.f.state.now=expiryMs;
    return JSON.stringify({reservationId,decision:'settled'});
  };
  await assert.rejects(s.run(),/DEADLINE/);
  assert.equal(s.events.filter(event=>event==='check').length,4);
  assert.equal(s.events.includes('uncertain'),true);
});

test('eligibility expiry after settlement blocks the final authority check',async()=>{
  const s=scene(),check=s.authority.check;
  s.authority.check=async(...args)=>{
    const result=await check(...args);
    if(s.events.filter(event=>event==='check').length===5)s.f.state.now=expiryMs;
    return result;
  };
  await assert.rejects(s.run(),/DEADLINE/);
  assert.equal(s.events.filter(event=>event==='settle').length,1);
  assert.equal(s.events.filter(event=>event==='check').length,5);
  assert.equal(s.events.includes('uncertain'),false);
});
