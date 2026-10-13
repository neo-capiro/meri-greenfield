import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createQualificationApplication} from '../application.mjs';
import {createApplicationFixture} from '../application.fixture.mjs';
import {receiveActionResponse} from '../../../../packages/contracts/dist/action-application.mjs';

// Optional immutable preimage replay: only local Git source, with original relative
// imports resolved to this exact dependency tree. Never substitute owner factories.
let factory=createQualificationApplication;
if(process.env.MERI_APPLICATION_PREIMAGE){
 assert.equal(process.env.MERI_APPLICATION_PREIMAGE,'be2840a3');
 const source=execFileSync('git',['show','be2840a3:apps/control/qualified-application/application.mjs'],{encoding:'utf8'});
 const base=new URL('../application.mjs',import.meta.url);
 const linked=source.replace(/from '(\.[^']+)'/g,(_,path)=>`from '${new URL(path,base).href}'`);
 factory=(await import('data:text/javascript;base64,'+Buffer.from(linked).toString('base64'))).createQualificationApplication;
}
async function setup(t){const f=await createApplicationFixture(),owners=[];t.after(async()=>{owners.forEach(o=>o.close());await f.close();});return {...f,makeConfiguration:c=>{const o=factory(c);owners.push(o);return o;},own:o=>{owners.push(o);return o;}};}
const request=(route,credential,body)=>new Request('https://qualification.invalid/api/action-followthrough/'+route,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)});
async function receive(o,route,credential,body){const response=await o.app.handle(request(route,credential,body));return {response,value:await receiveActionResponse(route,response.status,await response.text())};}
test('complete constructor defers all schema/child/source work and rejects pre-activation HTTP',async t=>{
 const f=await setup(t),o=f.makeConfiguration(f.configuration());assert.equal(f.statements.length,0);await assert.rejects(f.child.readState(),{code:'ENOENT'});assert.equal((await o.app.handle(request('query','forged',{request:{clientId:f.s.clientId}}))).status,503);assert.equal(f.statements.length,0);assert.equal(f.stats().sourceReads,0);o.close();assert.equal(o.status().state,'CLOSED');
});
test('configuration data is immutable across delayed schema and activation',async t=>{
 const f=await setup(t),c=f.configuration(),o=f.makeConfiguration(c),original=c.hostConfiguration.admission.grantFactsJsons.slice();
 c.hostConfiguration.admission.grantFactsJsons.splice(0,2,'{}','{}');c.lifecycleConfiguration.connection.port=1;c.lifecycleConfiguration.worker.probeKind='invalid';c.lifecycleConfiguration.limits.maxFrameBytes=1;
 const receipt=await o.initialize({prepareSchema:true});assert.equal(receipt.worker.status,'ACTIVE');assert.deepEqual(receipt.worker.grantIds,original.map(x=>JSON.parse(x).grantId));assert.equal(o.status().lifecycle.ownedChildren,0);assert.equal(f.sql.metadata.rows.size,0);
});
test('host configuration getters cannot run during assembly preflight',async t=>{
 const f=await setup(t),c=f.configuration();let touches=0;Object.defineProperty(c.hostConfiguration,'admission',{get(){touches++;throw Error('secret');},enumerable:true});assert.throws(()=>f.makeConfiguration(c));assert.equal(touches,0);assert.equal(f.statements.length,0);await assert.rejects(f.child.readState());
});
test('complete activation read HTTP uses retained canonical state and revoked grant blocks fresh session without another effect',async t=>{
 const f=await setup(t),o=f.makeConfiguration(f.configuration()),receipt=await o.initialize({prepareSchema:true}),credential=await f.issue(o);
 const result=await receive(o,'query',credential,{request:{limit:20}});assert.equal(result.response.status,200);assert.equal(result.value.classification,'recommendations');assert.equal(result.value.acceptedTasks,false);assert.equal(f.stats().sourceReads,1);assert.equal(f.sql.h.state().reservations.size,1);assert.equal(f.sql.h.state().budget.consumed_micro_usd,'10');
 const before=await f.child.readState();await o.revoke();assert.deepEqual(Object.values((await f.child.readState()).grants).map(x=>x.state),['REVOKED','REVOKED']);await assert.rejects(f.issue(o));assert.equal(f.stats().sourceReads,1);
 const next=f.makeConfiguration(f.configuration({fixture:receipt.fixture}));await assert.rejects(next.reconstruct());assert.equal(next.status().state,'UNKNOWN');assert.deepEqual((await f.child.readState()).run,before.run);assert.equal(f.sql.h.state().bindings.size,2);assert.equal(next.status().lifecycle.ownedChildren,0);
});
test('complete reconstruction reobserves worker but never creates new grants/allocation/proposal',async t=>{
 const f=await setup(t),first=f.makeConfiguration(f.configuration()),receipt=await first.initialize({prepareSchema:true}),old=await readFile(f.child.sqlStatePath,'utf8'),allocation=structuredClone(f.sql.h.state().allocation),bindings=f.sql.h.state().bindings.size;first.close();
 const second=f.makeConfiguration(f.configuration({fixture:receipt.fixture})),r=await second.reconstruct();assert.equal(r.reconstruction,true);assert.equal(await readFile(f.child.sqlStatePath,'utf8'),old);assert.deepEqual(f.sql.h.state().allocation,allocation);assert.equal(f.sql.h.state().bindings.size,bindings);assert.equal(f.sql.metadata.rows.size,0);assert.equal(f.stats().taskEffects,0);await assert.rejects(second.initialize({prepareSchema:true}));
});
test('stopped worker during reconstruction never resets retained ledger or grants',async t=>{
 const f=await setup(t),first=f.makeConfiguration(f.configuration()),r=await first.initialize({prepareSchema:true}),before=await readFile(f.child.sqlStatePath,'utf8');first.close();f.worker.task.Containers[0].LastStatus='STOPPED';const second=f.makeConfiguration(f.configuration({fixture:r.fixture}));await assert.rejects(second.reconstruct());assert.equal(await readFile(f.child.sqlStatePath,'utf8'),before);assert.equal(f.sql.h.state().bindings.size,2);assert.equal(f.stats().sourceReads,0);
});
test('schema commit acknowledgement loss cannot reach child or retry initialization',async t=>{
 const f=await setup(t),c=f.configuration(),pool=c.hostConfiguration.admission.pool;
 const failPool={...pool,async connect(){const client=await pool.connect();return {async query(sql,...args){const r=await client.query(sql,...args);if((typeof sql==='string'?sql:sql.text)==='COMMIT')throw Error('SECRET COMMIT ACK');return r;},release:e=>client.release(e)};}};
 for(const name of ['admission','lookup','metadata'])c.hostConfiguration[name].pool=failPool;c.hostConfiguration.command.journalPool=failPool;c.hostConfiguration.command.budgetPool=failPool;
 const o=f.makeConfiguration(c);await assert.rejects(o.initialize({prepareSchema:true}),e=>e.outcome==='UNKNOWN');assert.equal(o.status().state,'UNKNOWN');await assert.rejects(f.child.readState());const count=f.statements.length;await assert.rejects(o.initialize({prepareSchema:true}));assert.equal(f.statements.length,count);assert.equal(f.stats().taskEffects,0);
});
test('close during parked worker read aborts activation and preserves pending grants without source effects',async t=>{
 const f=await setup(t);let entered,release;const arrived=new Promise(r=>entered=r),gate=new Promise(r=>release=r),original=f.worker.reads.describeTasks;f.worker.reads.describeTasks=async(...args)=>{entered();await gate;return original(...args);};
 const o=f.makeConfiguration(f.configuration());const pending=o.initialize({prepareSchema:true});await arrived;o.close();await assert.rejects(pending);release();await new Promise(r=>setTimeout(r,10));assert.equal(o.status().state,'CLOSED');assert.deepEqual(Object.values((await f.child.readState()).grants).map(x=>x.state),['PENDING','PENDING']);assert.equal(f.sql.h.state().bindings.size,0);assert.equal(f.stats().sourceReads,0);assert.equal(o.status().lifecycle.ownedChildren,0);
});
test('HTTP caller-selected client cannot establish authority or spend the admitted read grant',async t=>{
 const f=await setup(t),o=f.makeConfiguration(f.configuration());await o.initialize({prepareSchema:true});const credential=await f.issue(o),r=await receive(o,'query',credential,{request:{clientId:f.s.clientId}});assert.equal(r.response.status,502);assert.equal(r.value.error.outcome,'UNKNOWN');assert.equal(f.stats().sourceReads,0);assert.equal(f.sql.h.state().reservations.size,0);assert.equal(f.sql.h.state().budget.consumed_micro_usd,'0');
});
