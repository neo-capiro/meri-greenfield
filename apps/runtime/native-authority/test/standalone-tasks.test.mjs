import test from 'node:test';
import assert from 'node:assert/strict';
import {standaloneFixture,id} from './standalone-tasks-fixture.mjs';
import {receiveTaskCommandResponse,receiveTaskCommandRequest} from '../../../../packages/contracts/dist/task-command-application.mjs';
const prepared=async f=>{const r=await f.call('prepare',f.raw);assert.equal(r.status,200,await r.clone().text());return (await r.json()).proposal;};
for(const general of [false,true])test(`standalone ${general?'General':'client'} task uses initial custody, exact journal replay and explicit approval`,async()=>{
 const f=standaloneFixture({general}),proposal=await prepared(f);
 assert.equal(f.metadata.rows.size,1);assert.equal(f.sql.state.rows.size,1);assert.equal(f.state.effects,0);assert.equal(f.state.decisions,0);
 const replay=await prepared(f);assert.deepEqual(replay,proposal);assert.equal(f.metadata.rows.size,1);
 assert.notEqual((await f.call('prepare',{...f.raw,arguments:{...f.raw.arguments,title:'Changed'}})).status,200);assert.equal(f.metadata.rows.size,1);
 const response=await f.call('execute',{proposal});assert.equal(response.status,200,await response.clone().text());
 const expected=Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,f.binding[k]]));
 const wire=await receiveTaskCommandResponse('execute',200,await response.text(),{binding:expected,proposal});assert.equal(wire.outcome.execution.kind,'native-task');assert.equal(f.state.effects,1);assert.equal(f.state.decisions,1);
 assert.equal((await f.call('execute',{proposal})).status,200);assert.equal(f.state.effects,1);assert.equal(f.state.decisions,1);
 assert.ok(f.sql.state.queries.every(q=>!q.sql.includes('allocation')));
});
test('prepare public requestId is mandatory and no browser authority fields are accepted',async()=>{
 const f=standaloneFixture();await receiveTaskCommandRequest('prepare',JSON.stringify(f.raw));
 for(const raw of [{arguments:f.raw.arguments},{...f.raw,requestId:'invalid'},{...f.raw,binding:f.binding}])assert.notEqual((await f.call('prepare',raw)).status,200);
 assert.equal(f.sql.state.rows.size,0);assert.equal(f.metadata.rows.size,0);
});
test('retained preparation survives a current run change; fresh started binding, revoked session and changed proposal refuse',async()=>{
 const f=standaloneFixture(),proposal=await prepared(f);f.state.binding={...f.binding,runId:id(91)};
 assert.deepEqual(await prepared(f),proposal);assert.equal(f.metadata.rows.size,1);
 f.state.binding=null;f.state.started=true;assert.notEqual((await f.call('prepare',{...f.raw,requestId:id(71)})).status,200);
 f.state.started=false;const changed=structuredClone(proposal);changed.command.arguments.patch.title='Tampered';assert.notEqual((await f.call('execute',{proposal:changed})).status,200);
 f.state.revoked=true;assert.notEqual((await f.call('execute',{proposal})).status,200);assert.equal(f.state.effects,0);
});
test('uncertain preparation never creates another metadata proposal',async()=>{
 const f=standaloneFixture();f.state.afterMetadata=()=>{f.state.revoked=true;};assert.notEqual((await f.call('prepare',f.raw)).status,200);assert.equal(f.metadata.rows.size,1);
 f.state.afterMetadata=null;f.state.revoked=false;assert.notEqual((await f.call('prepare',f.raw)).status,200);assert.equal(f.metadata.rows.size,1);
});
test('historical result is read before proposal expiry; unknown or unavailable read never authorizes another effect',async()=>{
 const f=standaloneFixture(),proposal=await prepared(f);assert.equal((await f.call('execute',{proposal})).status,200);f.state.now+=61000;
 assert.equal((await f.call('execute',{proposal})).status,200);assert.equal(f.state.effects,1);
 f.state.unknown=true;assert.deepEqual(await (await f.call('execute',{proposal})).json(),{status:'indeterminate',outcome:null});assert.equal(f.state.effects,1);
 f.state.unknown=false;f.state.readDown=true;assert.notEqual((await f.call('execute',{proposal})).status,200);assert.equal(f.state.effects,1);
 const unused=standaloneFixture(),p=await prepared(unused);unused.state.now+=61000;assert.equal((await unused.call('execute',{proposal:p})).status,409);assert.equal(unused.state.effects,0);assert.equal(unused.state.decisions,0);
});
test('response withholding preserves durable custody and execution can recover a lost response',async()=>{
 const f=standaloneFixture({maxResponseBytes:1}),r=await f.call('prepare',f.raw);assert.equal(r.status,413);assert.equal((await r.json()).error.outcome,'RESULT_NOT_RELEASED');assert.equal(f.metadata.rows.size,1);
 const g=standaloneFixture(),proposal=await prepared(g);g.state.afterExecute=()=>{g.state.revoked=true;};assert.notEqual((await g.call('execute',{proposal})).status,200);assert.equal(g.state.effects,1);
 g.state.revoked=false;g.state.afterExecute=null;assert.equal((await g.call('execute',{proposal})).status,200);assert.equal(g.state.effects,1);
});
test('retention final lock encloses response serialization and suppression withholds retained preparation',async()=>{
 let held=0;const f=standaloneFixture({retention:{async assertServable(){},async withRelease(subjects,release,{signal}){held++;assert.equal(subjects.length,1);const response=await release(signal,async()=>{});assert.equal((await response.clone().json()).status,'approval_required');return response;}}});
 await prepared(f);assert.equal(held,1);
 const g=standaloneFixture({retention:{async assertServable(){},async withRelease(subjects,release,{signal}){return release(signal,async()=>{throw Error('suppressed');});}}});
 const answer=await g.call('prepare',g.raw);assert.notEqual(answer.status,200);assert.equal((await answer.json()).error.outcome,'RESULT_NOT_RELEASED');assert.equal(g.metadata.rows.size,1);
});
