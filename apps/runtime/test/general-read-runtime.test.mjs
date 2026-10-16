/** Concrete control composition over canonical owners; synthetic native/HTTPS facts and scripted SQL only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlGeneralReadRuntime} from '../general-read-runtime.mjs';
import {retainedCase} from '../../gateway/general-reads/test/retained-cases.mjs';
import {durableFamilyFixture} from '../../gateway/general-reads/test/durable-fixture.mjs';
const IDS=['get_research_portfolio','get_research_portfolio_changes','get_florida_budget_project'];
const unavailable=e=>e.message==='UNAVAILABLE';
function options(f){const {installationOwner,...gateway}=f.gatewayConfiguration;
 return {...gateway,scopes:f.scopes,handlers:f.handlers,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal})};}
for(const id of IDS)test(`synthetic control factory ${id}: measured installation and durable gateway execute once`,async()=>{
 const f=await durableFamilyFixture(retainedCase(id)),port=createControlGeneralReadRuntime(options(f));
 assert.deepEqual(Object.keys(port).sort(),['execute','readAvailability'],'no owner, pool or secret leaves the control-side factory');
 const current=await port.readAvailability();assert.deepEqual(current.installation.operations,[f.operation]);
 const result=JSON.parse(await port.execute({operation:f.operation,arguments:f.arguments,deliveryId:'control-factory'}));
 assert.deepEqual(result.binding,f.binding);assert.equal(f.wire.length,1);assert.equal(f.state.produced.size,1);
 assert.equal([...f.state.reservations.values()][0].state,'SETTLED');
 await assert.rejects(port.execute({operation:f.operation,arguments:f.arguments,deliveryId:'control-factory'}));assert.equal(f.wire.length,1);
});
test('disabled, absent and incomplete control owner configurations stay explicitly unavailable without effects',async()=>{
 const f=await durableFamilyFixture(retainedCase(IDS[0])),c=options(f),before=f.state.connections;
 for(const raw of [undefined,{}, {...c,sourceEnabled:false},...['pool','allocationJson','authority','producerContext','handlers','readCurrentInstallation','discoveryOwner'].map(name=>({...c,[name]:undefined}))]){
  const port=createControlGeneralReadRuntime(raw);await assert.rejects(port.readAvailability(),unavailable);
  await assert.rejects(port.execute({operation:f.operation,arguments:{},deliveryId:'missing-owner'}),unavailable);
 }
 assert.equal(f.state.connections,before);assert.equal(f.wire.length,0);assert.equal(f.state.produced.size,0);
});
test('control construction is inert; native revocation and missing retained context remain closed',async()=>{
 const f=await durableFamilyFixture(retainedCase(IDS[1])),before=f.state.connections;
 let nativeReads=0;const c=options(f),read=c.readCurrentInstallation;
 const port=createControlGeneralReadRuntime({...c,readCurrentInstallation:async args=>{nativeReads++;return read(args);}});
 assert.equal(nativeReads,0);assert.equal(f.state.connections,before);assert.equal(f.wire.length,0);
 f.state.installRevoked=true;await assert.rejects(port.readAvailability(),unavailable);assert.equal(nativeReads,1);
 f.state.installRevoked=false;const absent=createControlGeneralReadRuntime({...c,retainedContextPorts:undefined});
 await assert.rejects(absent.execute({operation:f.operation,arguments:{},deliveryId:'no-retained-authority'}),unavailable);
 assert.equal(f.state.reservations.size,0);assert.equal(f.wire.length,0);
});
test('control factory rejects accessor/proxy authority and never invents native membership receipts',async()=>{
 let reads=0;assert.throws(()=>createControlGeneralReadRuntime({get pool(){reads++;return {};}}));assert.equal(reads,0);
 const f=await durableFamilyFixture(retainedCase(IDS[2])),c=options(f);
 assert.throws(()=>createControlGeneralReadRuntime({...c,producerContext:{get binding(){reads++;return f.binding;}}}));assert.equal(reads,0);
 const membership={tenantId:f.binding.tenantId,actorId:f.binding.actorId,status:'active',permissions:[],clientIds:[]};
 const port=createControlGeneralReadRuntime({...c,async readCurrentInstallation(){return membership;}});
 await assert.rejects(port.readAvailability(),unavailable);assert.equal(f.wire.length,0);
});
