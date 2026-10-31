/** Canonical writer over an explicit transactional SQL transport fixture. Not PostgreSQL/grant qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativePhysicalOwner} from './native-physical-owner.mjs';
import {readNativePhysicalRow} from './native-physical-state.mjs';
import {observerFixture,uuid,instanceId,volumeId,eniId} from '../../runtime/test/native-observer-fixture.mjs';
import {normalizeNativeObserverResponse as normalize} from '../../runtime/native-observer-wire.mjs';
import {physicalTriplet} from './native-physical-journal.mjs';
async function store(){
 const fixture=await observerFixture();let row=structuredClone(fixture.row),time=2000,commitLoss=false,backup;
 const pool={async connect(){return {async query(sql,args=[]){
  if(sql==='BEGIN'){backup=structuredClone(row);return {rows:[]};}
  if(sql==='ROLLBACK'){row=backup;return {rows:[]};}
  if(sql==='COMMIT'){if(commitLoss){commitLoss=false;throw Error('ACK lost after commit');}return {rows:[]};}
  if(sql.startsWith('SET LOCAL'))return {rows:[]};
  if(sql.includes('AS now_ms'))return {rows:[{now_ms:String(time)}]};
  if(sql.startsWith('SELECT *'))return {rows:[structuredClone(row)]};
  if(sql.startsWith('UPDATE meri_host_control.host_allocations SET native_physical_')){
   for(const match of sql.matchAll(/(native_physical_[a-z0-9_]+)=\$(\d+)/gu))row[match[1]]=structuredClone(args[Number(match[2])-1]);
   return {rows:[],rowCount:1};
  }
  if(sql.startsWith('UPDATE meri_host_control.host_allocations SET observed_instance_json')){
   row.observed_instance_json=structuredClone(args[2]);return {rows:[],rowCount:1};}
  throw Error(`Unexpected SQL: ${sql}`);
 },release(){}};}};
 const newOwner=()=>createNativePhysicalOwner({pool,now:()=>time,requestDeadlineMs:()=>50000,ownerProcessId:uuid(900)});
 const owner=newOwner(),key=fixture.key;let n=100;
 async function operation(api,stage,request,raw=fixture.responses[api],error=false,phase='ordinary'){
  readNativePhysicalRow(row,key);
  const r=await owner.reserveNativePhysicalOperation({key,phase,stage,sessionId:uuid(phase==='ordinary'?10:12),operationId:uuid(n++),request:{api,...request}});
  time+=10;const c=normalize(raw,{row,event:r.event,completedAtMs:time,error});
  await owner.completeNativePhysicalOperation({key,operationId:r.event.operationId,completion:c});time+=10;
  return r.event.operationId;
 }
 async function capture(phase='ordinary',discovery=false){
  if(phase==='ordinary')await owner.beginNativeOrdinaryPhysical({key,requestId:uuid(11)});
  const call=(api,stage,request,raw)=>operation(api,stage,request,raw??fixture.responses[api],false,phase);
  await call('GetCallerIdentity','authentication',{});
  const scanId=discovery?uuid(22):null;
  if(discovery)await call('DescribeInstances','discovery',{kind:'discovery',provisionToken:fixture.declaration.token,
   nextToken:null,maxResults:100,scanId,pageIndex:0});
  const ids=[await call('DescribeInstances','capture',{kind:'exact',instanceId}),
   await call('DescribeVolumes','capture',{volumeId}),await call('DescribeNetworkInterfaces','capture',{networkInterfaceId:eniId})];
  await owner.sealNativePhysicalResources({key,phase,preObservationEventIds:ids,discoveryScanId:scanId});
  return ids;
 }
 return {fixture,owner,key,newOwner,capture,operation,clock:v=>{time=v;},loseCommit:()=>{commitLoss=true;},row:()=>row};
}
test('writer retains canonical resources and issues exactly one process-local termination permit across ACK loss and restart',async()=>{
 const s=await store();await s.capture();s.loseCommit();
 const args={key:s.key,dispatchId:uuid(30),sessionId:uuid(10),ownerProcessId:uuid(900)};
 const claim=await s.owner.claimNativeOrdinaryPhysicalDispatch(args);assert.equal(claim.created,true);
 let calls=0;await claim.sendOnce(async()=>{calls++;});await assert.rejects(()=>claim.sendOnce(async()=>{calls++;}));
 const duplicate=await s.owner.claimNativeOrdinaryPhysicalDispatch(args);assert.strictEqual(duplicate,claim);
 const restart=await s.newOwner().claimNativeOrdinaryPhysicalDispatch(args);assert.equal(restart.created,false);assert.equal(restart.sendOnce,null);
 assert.equal(calls,1);
 const saved=await s.owner.readNativePhysicalState({key:s.key});assert.equal(saved.resources.ordinary.rootVolumeId,volumeId);
 assert.equal(saved.context.ordinary.deadlineMs,27000);assert.equal(saved.context.managed.deadlineMs,86000);
});

test('resource sealing and canonical readback reject capture evidence from the other phase in both directions',async()=>{
 for(const phase of ['ordinary','managed']){
  const s=await store(),ids=await s.capture(phase),other=phase==='ordinary'?'managed':'ordinary';
  if(other==='ordinary')await s.owner.beginNativeOrdinaryPhysical({key:s.key,requestId:uuid(13)});
  await assert.rejects(()=>s.owner.sealNativePhysicalResources({key:s.key,phase:other,preObservationEventIds:ids,discoveryScanId:null}));
  const resources=structuredClone(s.row().native_physical_resources_json);resources[other]=resources[phase];resources[phase]=null;
  const [json,sha,canonical]=physicalTriplet('resources',resources);Object.assign(s.row(),{
   native_physical_resources_json:json,native_physical_resources_sha256:sha,native_physical_resources_canonical:canonical});
  await assert.rejects(()=>s.owner.readNativePhysicalState({key:s.key}));
 }
});

test('authentication cannot be borrowed across phases and completed M discovery can precede a bound O capture',async()=>{
 const s=await store();s.row().observed_instance_json=null;await s.capture('managed',true);
 assert.equal(s.row().observed_instance_json.instanceId,instanceId);
 await s.owner.beginNativeOrdinaryPhysical({key:s.key,requestId:uuid(13)});
 await assert.rejects(()=>s.owner.reserveNativePhysicalOperation({key:s.key,phase:'ordinary',stage:'capture',sessionId:uuid(12),operationId:uuid(299),
  request:{api:'DescribeInstances',kind:'exact',instanceId}}));
 await s.capture('ordinary');const state=await s.owner.readNativePhysicalState({key:s.key});
 assert.ok(state.resources.managed.discovery);assert.equal(state.resources.ordinary.discovery,null);
});

test('incomplete discovery cannot authorize unbound capture or be dropped when another phase later binds the instance',async()=>{
 const s=await store();s.row().observed_instance_json=null;
 await s.owner.beginNativeOrdinaryPhysical({key:s.key,requestId:uuid(11)});await s.operation('GetCallerIdentity','authentication',{});
 await s.operation('DescribeInstances','discovery',{kind:'discovery',provisionToken:s.fixture.declaration.token,nextToken:null,
  maxResults:100,scanId:uuid(21),pageIndex:0},{...s.fixture.responses.DescribeInstances,NextToken:'incomplete-page-token'});
 await assert.rejects(()=>s.operation('DescribeInstances','capture',{kind:'exact',instanceId}));
 await s.capture('managed',true);
 const ids=[await s.operation('DescribeInstances','capture',{kind:'exact',instanceId}),await s.operation('DescribeVolumes','capture',{volumeId}),
  await s.operation('DescribeNetworkInterfaces','capture',{networkInterfaceId:eniId})];
 await assert.rejects(()=>s.owner.sealNativePhysicalResources({key:s.key,phase:'ordinary',preObservationEventIds:ids,discoveryScanId:null}));
});
test('reserved rows and unbound capture IDs cannot reserve privileged calls; readback rejects changed identity and canonical bytes',async()=>{
 const s=await store();s.row().state='reserved';await assert.rejects(()=>s.owner.beginNativeOrdinaryPhysical({key:s.key,requestId:uuid(1)}));
 s.row().state='dispatching';await s.owner.beginNativeOrdinaryPhysical({key:s.key,requestId:uuid(1)});
 await s.operation('GetCallerIdentity','authentication',{});
 await assert.rejects(()=>s.operation('DescribeInstances','capture',{kind:'exact',instanceId:'i-11111111'}));
 await assert.rejects(()=>s.owner.readNativePhysicalState({key:{...s.key,originalBindingSha256:'0'.repeat(64)}}));
 s.row().native_physical_context_canonical+=' ';await assert.rejects(()=>s.owner.readNativePhysicalState({key:s.key}));
});
test('ordinary verification derives exact causal absence from journal; pending termination prevents early finalization',async()=>{
 const s=await store();await s.capture();
 const claim=await s.owner.claimNativeOrdinaryPhysicalDispatch({key:s.key,dispatchId:uuid(30),sessionId:uuid(10),ownerProcessId:uuid(900)});
 const terminalRaw=structuredClone(s.fixture.responses.DescribeInstances);terminalRaw.Reservations[0].Instances[0].State={Name:'terminated',Code:48};
 s.clock(2300);const terminal=await s.operation('DescribeInstances','absence',{kind:'exact',instanceId},terminalRaw);
 const absences=[];
 for(const [api,request,code] of [['DescribeVolumes',{volumeId},'InvalidVolume.NotFound'],
  ['DescribeNetworkInterfaces',{networkInterfaceId:eniId},'InvalidNetworkInterfaceID.NotFound']]){
  for(let n=0;n<2;n++)absences.push(await s.operation(api,'absence',request,
   Object.assign(Error('missing'),{name:code,$metadata:{requestId:`actual-absence-${api}-${n}`,httpStatusCode:400}}),true));
 }
 const args={key:s.key,phase:'ordinary',status:'verified-absent',reason:null,evidenceEventIds:[terminal,...absences]};
 await assert.rejects(()=>s.owner.finalizeNativePhysicalPhase(args));
 const completion=normalize(s.fixture.responses.TerminateInstances,{row:s.row(),event:claim.event,completedAtMs:2200});
 await s.owner.completeNativePhysicalOperation({key:s.key,operationId:claim.event.operationId,completion});
 const result=await s.owner.finalizeNativePhysicalPhase(args);assert.equal(result.status,'verified-absent');
 assert.equal((await s.owner.readNativePhysicalState({key:s.key})).result.ordinary.status,'verified-absent');
 await assert.rejects(()=>s.operation('DescribeInstances','absence',{kind:'exact',instanceId},terminalRaw));
});
