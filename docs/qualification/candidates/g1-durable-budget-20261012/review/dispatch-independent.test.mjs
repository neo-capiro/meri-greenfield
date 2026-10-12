// Scripted SQL control-flow evidence only. This is not PostgreSQL durability.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = process.env.MERI_BUDGET_REPO;
const load = name => import(pathToFileURL(`${root}/${name}`));
const { createDurableToolDispatch } = await load('apps/gateway/budget/durable-tool-dispatch.mjs');
const { fixture, NOW, limits, uuid, requestJson } = await load('apps/gateway/test/fixtures.mjs');
const { canonicalSha256 } = await load('packages/contracts/validate.mjs');

function harness({ charge = 10, runCap = 100, globalCap = 100, runtimeSeconds = 10, scheduleMs = 10000 } = {}) {
 const f = fixture(); const policy = 'a'.repeat(64);
 f.claims.policyRevision = policy; f.claims.scopes[0].policyRevision = policy; f.subject.policyRevision = policy;
 const allocation = { run: Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k => [k,f.binding[k]])),
  manifestSha256:'b'.repeat(64),catalogSha256:'c'.repeat(64),budgets:{maxTurns:5,maxToolCalls:5,maxRecoveryAttempts:0,maxRuntimeSeconds:runtimeSeconds,maxCostMicroUSD:runCap,maxOutputBytes:65536},
  schedule:{revision:'d'.repeat(64),expiresAt:new Date(NOW+scheduleMs).toISOString(),operations:[{operation:f.descriptor.operation,chargeMicrousd:charge}]} };
 allocation.manifest={contractVersion:'0.2.0',skillId:'quick_skill.relationship_brief',skillVersion:'1.0.0',prose:{id:'urn:meri:independent:budget',sha256:'a'.repeat(64)},requiredSources:[{sourceId:'synthetic-source',authority:'authoritative',purpose:'enumeration'}],allowedOperations:[f.descriptor.operation],subjectKinds:['personal'],windowBases:['unbounded'],completion:{requireAllSources:true,allowDisclosedPartial:true,negativeClaims:'complete-covered-only',rubric:[{id:'proof',requirement:'Independent budget fixture',evidenceRequired:true}]},approval:{mutations:'separate-immutable-proposal',autoCreateTasks:false},budgets:allocation.budgets,versionPolicy:{existingRuns:'pin-immutable',resume:'exact-or-explicit-migration',fork:'preserve-unless-explicit-reselection'}};
 allocation.manifestSha256=canonicalSha256(allocation.manifest);
 const credential='synthetic-opaque';
 const i={invocationId:'independent-call',grantId:uuid('8'),binding:f.binding,qualificationBinding:{runId:f.binding.runId,attempt:1,workerArn:'arn:aws:ecs:us-east-1:967807252336:task/synthetic/'+ 'a'.repeat(32),fence:1,policyRevision:policy},capabilitySha256:createHash('sha256').update(credential).digest('hex'),allocationSha256:canonicalSha256(allocation)};
 const q=i.qualificationBinding;
 let state={budget:{id:1,cap_micro_usd:String(globalCap),consumed_micro_usd:'0',quarantined:false},run:{run_id:q.runId,attempt:1,worker_arn:q.workerArn,fence:1,policy_revision:policy},grant:{run_id:q.runId,attempt:1,worker_arn:q.workerArn,fence:1,policy_revision:policy,grant_id:i.grantId,state:'ACTIVE',capability_sha256:i.capabilitySha256,expires_at:new Date(NOW+10000)},allocation:null,grantBinding:null,reservations:new Map(),model:[]};
 let chain=Promise.resolve(); let unknownCommit=false; let clock=NOW; let parkInsert; let inserted; let parkSettlement; let settlementReached; let parkAllocation; let allocationReached;
 const queries=[];const releases=[];
 const rowsFor=s=>[...s.model,...[...s.reservations.values()].map(r=>({kind:'tool',slot:r.invocation_id,run_id:r.run_id,grant_id:r.grant_id,state:r.state,hold_micro_usd:r.hold_micro_usd,consumed_micro_usd:r.charged_micro_usd??'0'}))];
 const pool={async connect(){let local;let unlock;return {
  async query(sql,p=[]){queries.push(sql);const rows=v=>({rows:v,rowCount:v.length});
   if(sql==='BEGIN'||sql.startsWith('SET LOCAL'))return rows([]);
   if(sql.includes('budget WHERE id=1 FOR UPDATE')){const previous=chain;chain=new Promise(r=>{unlock=r;});await previous;local=structuredClone(state);return rows([local.budget]);}
   if(sql.includes('clock_timestamp() AS now'))return rows([{now:new Date(clock)}]);
   if(sql==='ROLLBACK'){local=undefined;return rows([]);}
   if(sql==='COMMIT'){if(local)state=local;local=undefined;if(unknownCommit){unknownCommit=false;throw Error('lost ack');}return rows([]);}
   if(sql.startsWith('SELECT * FROM meri_qualification.runs'))return rows([local.run]);
   if(sql.startsWith('SELECT * FROM meri_qualification.grants'))return rows([local.grant]);
   if(sql.startsWith('SELECT * FROM meri_qualification.tool_run_allocations')){allocationReached?.();if(parkAllocation)await parkAllocation;return rows(local.allocation?[local.allocation]:[]);}
   if(sql.startsWith('INSERT INTO meri_qualification.tool_run_allocations')){local.allocation={run_id:p[0],allocation_sha256:p[1],allocation:p[2],max_tool_calls:String(p[3]),max_cost_micro_usd:String(p[4]),started_at:new Date(clock)};return rows([]);}
   if(sql.startsWith('SELECT * FROM meri_qualification.tool_grant_bindings'))return rows(local.grantBinding?[local.grantBinding]:[]);
   if(sql.startsWith('INSERT INTO meri_qualification.tool_grant_bindings')){local.grantBinding={grant_id:p[0],run_id:p[1],facts:p[2]};return rows([]);}
   if(sql.startsWith('SELECT * FROM meri_qualification.tool_reservations'))return rows(local.reservations.has(p[0])?[local.reservations.get(p[0])]:[]);
   if(sql.startsWith('SELECT 1 FROM meri_qualification.budget_liabilities'))return rows(rowsFor(local).filter(r=>r.grant_id===p[0]&&r.state==='UNKNOWN').map(()=>({one:1})));
   if(sql.includes(' AS run_total')){const all=rowsFor(local);return rows([{held:String(all.filter(r=>r.state==='UNKNOWN').reduce((s,r)=>s+BigInt(r.hold_micro_usd),0n)),run_total:String(all.filter(r=>r.run_id===p[0]).reduce((s,r)=>s+BigInt(r.state==='UNKNOWN'?r.hold_micro_usd:r.consumed_micro_usd),0n))}]);}
   if(sql.startsWith('SELECT count(*) AS calls'))return rows([{calls:String([...local.reservations.values()].filter(r=>r.run_id===p[0]).length)}]);
   if(sql.startsWith('INSERT INTO meri_qualification.tool_reservations')){local.reservations.set(p[0],{invocation_id:p[0],reservation_id:p[1],grant_id:p[2],run_id:p[3],facts:p[4],operation:p[5],arguments_sha256:p[6],hold_micro_usd:String(p[7]),max_output_bytes:String(p[8]),state:'UNKNOWN'});inserted?.();if(parkInsert)await parkInsert;return rows([]);}
   if(sql.startsWith('UPDATE meri_qualification.budget SET consumed_micro_usd=consumed_micro_usd+')){local.budget.consumed_micro_usd=String(BigInt(local.budget.consumed_micro_usd)+BigInt(p[0]));return rows([]);}
   if(sql.startsWith('UPDATE meri_qualification.tool_reservations SET state=\'SETTLED\'')){const row=local.reservations.get(p[0]);row.state='SETTLED';row.charged_micro_usd=row.hold_micro_usd;row.output_bytes=p[1];settlementReached?.();if(parkSettlement)await parkSettlement;return rows([]);}
   throw Error('unsupported independent scripted SQL:'+sql);
  },release(error){releases.push(error);unlock?.();}
 };}};
 let id=7;
 const create=changes=>createDurableToolDispatch({pool,allocationJson:JSON.stringify(allocation),catalog:{entry:()=>f.entry,discoverable:()=>[f.entry]},authority:f.authority,limits,now:()=>f.state.now,newId:()=>uuid(String(id)),sourceEnabled:true,...changes});
 const call=(g=create(),inv=i)=>g.execute(requestJson,credential,JSON.stringify(inv));
 return {f,i,allocation,pool,create,call,queries,releases,state:()=>state,newReservation(){id=9;},loseCommit(){unknownCommit=true;},setClock(t){clock=t;},async install(){await create().bindTrustedGrant(JSON.stringify(i));},park(){let resume;parkInsert=new Promise(r=>{resume=r;});const reached=new Promise(r=>{inserted=r;});return {resume,reached};},parkSettlement(){let resume;parkSettlement=new Promise(r=>{resume=r;});const reached=new Promise(r=>{settlementReached=r;});return {resume,reached};},parkAllocation(){let resume;parkAllocation=new Promise(r=>{resume=r;});const reached=new Promise(r=>{allocationReached=r;});return {resume,reached};}};
}

test('actual dispatcher consumes concrete SQL reservation and settlement once',async()=>{const h=harness();await h.install();await h.call();assert.equal(h.f.calls.filter(x=>x==='handler').length,1);assert.equal(h.state().budget.consumed_micro_usd,'10');assert.equal(h.state().reservations.get(h.i.invocationId).state,'SETTLED');});
test('fresh adapter and reservation identity cannot replay settled invocation',async()=>{const h=harness();await h.install();await h.call();h.newReservation();await assert.rejects(h.call(),/BUDGET_UNCERTAIN/);assert.equal(h.f.calls.filter(x=>x==='handler').length,1);assert.equal(h.state().budget.consumed_micro_usd,'10');assert.equal(h.state().reservations.size,1);});
test('parallel same invocation has one handler and one debit',async()=>{const h=harness();await h.install();const r=await Promise.allSettled([h.call(),h.call()]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(h.f.calls.filter(x=>x==='handler').length,1);assert.equal(h.state().budget.consumed_micro_usd,'10');});
test('lost reserve COMMIT acknowledgement retains UNKNOWN and suppresses effect',async()=>{const h=harness();await h.install();h.loseCommit();await assert.rejects(h.call(),/BUDGET_UNCERTAIN/);assert.equal(h.f.calls.includes('handler'),false);assert.equal(h.state().reservations.get(h.i.invocationId).state,'UNKNOWN');assert.equal(h.state().budget.consumed_micro_usd,'0');h.newReservation();await assert.rejects(h.call());assert.equal(h.state().reservations.size,1);});
test('mixed model/tool holds enforce global exact bound without counting settled twice',async()=>{for(const charge of [10,11]){const h=harness({charge,runCap:1000});h.f.claims.budgets.maxCostMicrousd=1000;await h.install();h.state().budget.consumed_micro_usd='20';h.state().model=[{kind:'model',slot:'old',run_id:uuid('9'),grant_id:uuid('9'),state:'SETTLED',hold_micro_usd:'20',consumed_micro_usd:'20'},{kind:'model',slot:'pending',run_id:uuid('9'),grant_id:uuid('9'),state:'UNKNOWN',hold_micro_usd:'70',consumed_micro_usd:'0'}];if(charge===10){await h.call();assert.equal(h.state().budget.consumed_micro_usd,'30');}else{await assert.rejects(h.call());assert.equal(h.f.calls.includes('handler'),false);}}});
test('installed run cap includes settled and unknown model liability',async()=>{for(const charge of [5,6]){const h=harness({charge,runCap:50,globalCap:1000});await h.install();h.state().budget.consumed_micro_usd='20';h.state().model=[{kind:'model',slot:'old',run_id:h.i.binding.runId,grant_id:uuid('9'),state:'SETTLED',hold_micro_usd:'20',consumed_micro_usd:'20'},{kind:'model',slot:'pending',run_id:h.i.binding.runId,grant_id:uuid('9'),state:'UNKNOWN',hold_micro_usd:'25',consumed_micro_usd:'0'}];if(charge===5)await h.call();else{await assert.rejects(h.call());assert.equal(h.f.calls.includes('handler'),false);}}});
test('database revocation/expiry/stale fence blocks actual effect despite fresh synthetic gateway claims',async()=>{for(const mode of ['revoked','expired','stale']){const h=harness();await h.install();if(mode==='revoked')h.state().grant.state='REVOKED';if(mode==='expired')h.setClock(NOW+10000);if(mode==='stale')h.state().run.fence=2;await assert.rejects(h.call());assert.equal(h.f.calls.includes('handler'),false);assert.equal(h.state().reservations.size,0);}});
test('trusted binding substitution cannot mutate admitted allocation',async()=>{const h=harness();await h.install();const other=structuredClone(h.i);other.binding.actorId='foreign';await assert.rejects(h.call(h.create(),other));assert.equal(h.f.calls.includes('handler'),false);assert.equal(h.state().reservations.size,0);});
test('late reserve after deadline keeps hold and never starts handler',async()=>{const h=harness();await h.install();const parked=h.park();const result=h.call(h.create({limits:{...limits,maxRequestMs:20,maxCleanupMs:20}}));await parked.reached;await assert.rejects(result,/BUDGET_UNCERTAIN|DEADLINE/);parked.resume();await new Promise(r=>setTimeout(r,10));assert.equal(h.state().reservations.get(h.i.invocationId).state,'UNKNOWN');assert.equal(h.f.calls.includes('handler'),false);});
test('default composition stays disabled before any SQL or handler',async()=>{const h=harness();const before=h.queries.length;await assert.rejects(h.call(h.create({sourceEnabled:false})),/UNAVAILABLE/);assert.equal(h.queries.length,before);assert.equal(h.f.calls.includes('handler'),false);});

for(const phase of ['handler','settlement'])test(`installed manifest runtime bounds parked ${phase} before longer authority deadline`,async()=>{
 const h=harness({runtimeSeconds:1});await h.install();h.state().allocation.started_at=new Date(NOW-990);
 let release;let timer;let reached;
 if(phase==='handler')h.f.entry.execute=()=>new Promise(resolve=>{release=()=>resolve(JSON.stringify(h.f.output));});
 else {const parked=h.parkSettlement();release=parked.resume;reached=parked.reached;}
 const outcome=h.call(h.create({limits:{...limits,maxCleanupMs:20}}));outcome.catch(()=>{});
 try {
  if(reached)await reached;
  await assert.rejects(Promise.race([outcome,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('budget runtime failed to bound parked '+phase)),100);})]),/^GatewayDenied: (DEADLINE|BUDGET_UNCERTAIN)$/);
  assert.equal(h.state().budget.consumed_micro_usd,'0');assert.equal(h.state().reservations.get(h.i.invocationId).state,'UNKNOWN');
 } finally {clearTimeout(timer);release?.();await outcome.catch(()=>{});await new Promise(r=>setImmediate(r));}
});

test('manifest body/hash, exact budgets and allowed operation are required before SQL',()=>{
 for(const modify of [a=>a.manifestSha256='f'.repeat(64),a=>a.budgets={...a.budgets,maxToolCalls:99},a=>{a.manifest.allowedOperations=[{id:'other.operation',version:'0.2.0'}];a.manifestSha256=canonicalSha256(a.manifest);}]){
  const h=harness();modify(h.allocation);assert.throws(h.create);assert.equal(h.queries.length,0);
 }
});

for(const expiry of ['grant','schedule'])test(`known ${expiry} expiry bounds a parked tool before longer authority deadline`,async()=>{
 const h=harness({scheduleMs:expiry==='schedule'?10:10000});await h.install();
 if(expiry==='grant')h.state().grant.expires_at=new Date(NOW+10);
 let release;let timer;h.f.entry.execute=()=>new Promise(resolve=>{release=()=>resolve(JSON.stringify(h.f.output));});
 const outcome=h.call(h.create({limits:{...limits,maxCleanupMs:20}}));outcome.catch(()=>{});
 try{await assert.rejects(Promise.race([outcome,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('known '+expiry+' expiry failed to bound parked handler')),100);})]),/^GatewayDenied: (DEADLINE|BUDGET_UNCERTAIN)$/);assert.equal(h.state().reservations.get(h.i.invocationId).state,'UNKNOWN');}
 finally{clearTimeout(timer);release?.();await outcome.catch(()=>{});await new Promise(r=>setImmediate(r));}
});

test('validated grant deadline is published before a later allocation read can park',async()=>{
 const h=harness();await h.install();h.state().grant.expires_at=new Date(NOW+10);const p=h.parkAllocation();let timer;
 const outcome=h.call(h.create({limits:{...limits,maxCleanupMs:20}}));outcome.catch(()=>{});
 try{await p.reached;await assert.rejects(Promise.race([outcome,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('validated grant deadline was parked before publication')),100);})]),/^GatewayDenied: (DEADLINE|BUDGET_UNCERTAIN)$/);}
 finally{clearTimeout(timer);p.resume();await outcome.catch(()=>{});await new Promise(r=>setTimeout(r,10));}
 assert.equal(h.f.calls.includes('handler'),false);assert.equal(h.state().reservations.size,0);
});

test('canonical durable entry is inert, unavailable for every catalog operation, and refuses activation override',async()=>{
 const {createDurableSourceDisabledGateway}=await load('apps/gateway/index.mjs');
 const catalog=(await import(pathToFileURL(`${root}/packages/contracts/retrieval-0.2/catalog.json`),{with:{type:'json'}})).default;
 const h=harness();h.allocation.catalogSha256=canonicalSha256(catalog);h.i.allocationSha256=canonicalSha256(h.allocation);let poolCalls=0;
 const options={authorityPorts:h.f.ports,pool:{async connect(){poolCalls++;throw Error('must not connect');}},allocationJson:JSON.stringify(h.allocation),limits,now:()=>NOW,newId:()=>uuid('7')};
 const gateway=createDurableSourceDisabledGateway(options);assert.equal(gateway.sourceEnabled,false);assert.deepEqual(await gateway.discover(),[]);
 for(const entry of catalog.operations)await assert.rejects(gateway.execute(JSON.stringify({operation:entry.operation,arguments:{}}),'synthetic-opaque',JSON.stringify(h.i)),/UNAVAILABLE/);
 assert.equal(poolCalls,0);assert.deepEqual(h.f.calls,[]);assert.throws(()=>createDurableSourceDisabledGateway({...options,sourceEnabled:true}),/GATEWAY_CONFIGURATION/);
 const wrong={...h.allocation,catalogSha256:'f'.repeat(64)};assert.throws(()=>createDurableSourceDisabledGateway({...options,allocationJson:JSON.stringify(wrong)}));
});
