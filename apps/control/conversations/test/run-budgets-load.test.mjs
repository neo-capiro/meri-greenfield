/** The run's admitted allocation budgets reach the loaded execution record (`runBudgets`) through the optional read-only port, for the
 * worker's early read ledger only. Absent port or no installed allocation: no field. Malformed answers refuse the load. */
import test from 'node:test';import assert from 'node:assert/strict';
import {applicationFixture,binding} from './application-fixture.mjs';
async function loaded(answer){
 const calls=[],f=await applicationFixture({initialInput:true,serviceOptions:answer===undefined?{}:{runBudgets:{async read(input){calls.push(input.binding);return typeof answer==='function'?answer():answer;}}}});
 await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});
 return {f,calls,load:()=>f.runOwner.load({binding})};
}
test('admitted budgets ride the execution record; the port is asked for exactly the run binding',async()=>{
 const x=await loaded({maxToolCalls:40,maxOutputBytes:4194304,maxAggregateOutputBytes:33554432});
 try{const saved=await x.load();assert.deepEqual(saved.runBudgets,{maxToolCalls:40,maxOutputBytes:4194304,maxAggregateOutputBytes:33554432});assert.deepEqual(x.calls,[binding]);}
 finally{x.f.close();}
 const skill=await loaded({maxToolCalls:2,maxOutputBytes:262144});
 try{assert.deepEqual((await skill.load()).runBudgets,{maxToolCalls:2,maxOutputBytes:262144});}finally{skill.f.close();}
});
test('no port, or no installed allocation yet, means no runBudgets field (the ledger keeps its defaults)',async()=>{
 for(const answer of [undefined,null]){const x=await loaded(answer);try{assert.equal(Object.hasOwn(await x.load(),'runBudgets'),false);}finally{x.f.close();}}
});
test('malformed budgets refuse the load rather than guessing a bound',async()=>{
 for(const bad of [{maxToolCalls:0,maxOutputBytes:1},{maxToolCalls:1},{maxToolCalls:1,maxOutputBytes:1,extra:1},{maxToolCalls:1,maxOutputBytes:2048,maxAggregateOutputBytes:1024},{maxToolCalls:1.5,maxOutputBytes:1}]){
  const x=await loaded(bad);try{await assert.rejects(x.load(),/RUN_BUDGETS_REFUSED/,JSON.stringify(bad));}finally{x.f.close();}
 }
});
