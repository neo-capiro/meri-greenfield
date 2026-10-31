/** Canonical Control observer. Managed entry has no access to the ordinary dispatch path. */
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {createPostgresHostAllocationWriter} from '../control/browser-hosts/postgres-allocations.mjs';
import {transact} from '../control/product-persistence/transaction.mjs';
import {PHYSICAL_LOCK} from '../control/browser-hosts/native-physical-owner.mjs';
import {readNativePhysicalRow} from '../control/browser-hosts/native-physical-state.mjs';
import {deriveNativeManagedProvenance} from '../control/browser-hosts/native-physical-history.mjs';
import {projectOrdinaryPhysicalEvidence} from '../control/browser-hosts/native-physical-evidence.mjs';
import {createNativeObserverSession} from './native-observer-sdk.mjs';
import {normalizeNativeObserverResponse} from './native-observer-wire.mjs';
import {observerHttpBody} from './native-observer-http.mjs';
import {HOST_PHYSICAL_ABSENCE_SCHEMA} from '../worker/conversation/host/teardown.mjs';
const fail=()=>{throw Object.assign(Error('HOST_PHYSICAL_UNKNOWN'),{code:'HOST_PHYSICAL_UNKNOWN'});};
const keyFor=row=>({hostId:row.host_id,generation:Number(row.generation),originalBindingSha256:hash(row.original_binding_json),declarationSha256:row.declaration_sha256});
/** Only call with state validated by the canonical row reader. This projection performs no writes. */
export function retainedNativePhysicalOutcome({allocation,binding,declaration,state,nowMs}){
 const phase=name=>{
  const context=state.context[name];if(context===null)return null;
  const result=state.result?.[name]??null,resources=state.resources?.[name]??null;
  return {disposition:result?.status==='verified-absent'?'verified-absent':result||nowMs>=context.deadlineMs?'unknown':'pending',
   deadlineMs:context.deadlineMs,contextSha256:hash(context),resourcesSha256:resources?hash(resources):null,
   resultSha256:result?hash(result):null,reason:result?result.reason:(nowMs>=context.deadlineMs?'deadline':null)};
 };
 return {schema:'meri-native-retained-physical/2',allocationSha256:hash(allocation),bindingSha256:hash(binding),
  declarationSha256:hash(declaration),ordinary:phase('ordinary'),managed:phase('managed')};
}
function sdkInput(r){
 switch(r.api){
  case 'GetCallerIdentity':return {};
  case 'DescribeInstances':return r.kind==='exact'?{InstanceIds:[r.instanceId]}:
   {Filters:[{Name:'tag:MeriProvisionToken',Values:[r.provisionToken]}],MaxResults:r.maxResults,...(r.nextToken===null?{}:{NextToken:r.nextToken})};
  case 'DescribeVolumes':return {VolumeIds:[r.volumeId]};
  case 'DescribeNetworkInterfaces':return {NetworkInterfaceIds:[r.networkInterfaceId]};
  case 'TerminateInstances':return {InstanceIds:[r.instanceId]};
  case 'DescribeExecution':return {executionArn:r.executionArn};
  case 'GetExecutionHistory':return {executionArn:r.executionArn,maxResults:100,reverseOrder:false,includeExecutionData:true,
   ...(r.nextToken===null?{}:{nextToken:r.nextToken})};
  default:fail();
 }
}
export function createNativeObserverRuntime({pool,now=Date.now,createSession=createNativeObserverSession,requestMs=3000,sleep=pause,expected=null}={}){
 const scope=new AsyncLocalStorage(),ownerProcessId=randomUUID(),clients=new Set();let closed=false;
 const writer=createPostgresHostAllocationWriter({pool,now,physicalOwnerProcessId:ownerProcessId,
  physicalRequestDeadlineMs:()=>scope.getStore()?.deadlineMs??null});
 async function read(hostId,generation){
  return transact(pool,async client=>{const rows=(await client.query(PHYSICAL_LOCK,[hostId,generation])).rows;
   if(rows?.length!==1)fail();const row=rows[0],key=keyFor(row),state=readNativePhysicalRow(row,key);assertPlacement(row);return {row,key,state};
  },{unavailable:'NATIVE_PHYSICAL_REFUSED',uncertain:'NATIVE_PHYSICAL_COMMIT_UNKNOWN'});
 }
 function assertPlacement(row){
  if(expected===null)return;
  const d=row.declaration_json;
  if(hash(expected)!==hash({accountId:d.accountId,region:d.region,amiId:d.launch.ImageId,vpcId:d.placement.vpcId,
   subnetId:d.placement.subnetId,securityGroupId:d.placement.securityGroupIds.length===1?d.placement.securityGroupIds[0]:null,
   rootDeviceName:'/dev/xvda'}))fail();
 }
 function session(row,key,phase,deadlineMs,signal){
  const sessionId=randomUUID();let sdk=null;
  async function send(event){
   let raw,error=false;
   try{
    if(closed||now()>=event.callDeadlineMs)fail();signal?.throwIfAborted();
    if(sdk===null){
     if(event.stage!=='authentication')fail();
     sdk=await createSession({accountId:row.declaration_json.accountId,region:row.declaration_json.region,
      deadlineMs,now,signal});if(closed){sdk.close();fail();}clients.add(sdk);
    }
    raw=await sdk.send({api:event.request.api,input:sdkInput(event.request),callDeadlineMs:event.callDeadlineMs,signal});
   }catch(e){raw=e;error=true;}
   const completion=normalizeNativeObserverResponse(raw,{event,row,completedAtMs:now(),error});
   await writer.completeNativePhysicalOperation({key,operationId:event.operationId,completion});return {...event,completion};
  }
  async function call(stage,request){
   if(closed||now()>=deadlineMs)fail();signal?.throwIfAborted();
   const r=await writer.reserveNativePhysicalOperation({key,phase,stage,sessionId,operationId:randomUUID(),request,signal});
   if(!r.created)fail();return send(r.event);
  }
  return {sessionId,call,send,close(){sdk?.close();if(sdk)clients.delete(sdk);},async authenticate(){
   const result=await call('authentication',{api:'GetCallerIdentity'});if(result.completion.outcome!=='success')fail();
  }};
 }
 async function capture(row,key,phase,port){
  let state=await writer.readNativePhysicalState({key});if(state.resources?.[phase])return state.resources[phase];
  let instanceId=row.observed_instance_json?.instanceId,scanId=null;
  if(!instanceId){
   scanId=randomUUID();let nextToken=null;const matches=new Set();let complete=false;
   for(let pageIndex=0;pageIndex<20;pageIndex++){
    const event=await port.call('discovery',{api:'DescribeInstances',kind:'discovery',provisionToken:row.declaration_json.token,
     nextToken,maxResults:100,scanId,pageIndex});const c=event.completion;
    if(c.outcome!=='success'||c.facts.overflow||c.facts.conflicts.length)fail();
    for(const m of c.facts.matches)matches.add(m.instanceId);
    if(matches.size>1)fail();nextToken=c.facts.nextToken;if(nextToken===null){complete=c.facts.complete;break;}
   }
   if(!complete||matches.size!==1)fail();instanceId=[...matches][0];
  }
  const i=await port.call('capture',{api:'DescribeInstances',kind:'exact',instanceId});if(i.completion.outcome!=='success')fail();
  const facts=i.completion.facts,ids=[i.operationId];
  const root=await port.call('capture',{api:'DescribeVolumes',volumeId:facts.root.volumeId});if(root.completion.outcome!=='success')fail();ids.push(root.operationId);
  for(const nic of facts.networkInterfaces){const e=await port.call('capture',{api:'DescribeNetworkInterfaces',networkInterfaceId:nic.id});
   if(e.completion.outcome!=='success')fail();ids.push(e.operationId);}
  return writer.sealNativePhysicalResources({key,phase,preObservationEventIds:ids,discoveryScanId:scanId});
 }
 async function after(at,deadlineMs,signal){
  if(now()<=at)await sleep(at-now()+1,undefined,{signal});if(now()>=deadlineMs)fail();
 }
 async function finalizeExpired(key,phase){
  const state=await writer.readNativePhysicalState({key});
  if(!['terminated','refused'].includes(state.state)&&state.context[phase]&&!state.result?.[phase]&&now()>=state.context[phase].deadlineMs)
   await writer.finalizeNativePhysicalPhase({key,phase,status:'unknown-final',reason:'deadline',evidenceEventIds:[]});
 }
 async function drainPending(key,phase,deadlineMs,signal){
  for(;;){
   signal?.throwIfAborted();if(!Number.isSafeInteger(deadlineMs)||now()>=deadlineMs)fail();
   const state=await writer.readNativePhysicalState({key,signal}),pending=state.observations.entries.filter(e=>e.completion===null&&(phase===null||e.phase===phase));
   if(pending.length===0)return;
   for(const e of pending)if(now()>=e.callDeadlineMs)await writer.completeNativePhysicalOperation({key,operationId:e.operationId,
    completion:{completedAtMs:now(),outcome:'abandoned',requestId:null,httpStatusCode:null,errorCode:null,facts:null},signal});
   const next=Math.min(...pending.map(e=>e.callDeadlineMs));if(next>now())await sleep(Math.min(50,next-now(),deadlineMs-now()),undefined,{signal});
  }
 }
 async function observe(row,key,phase,resources,port,deadlineMs,signal){
  let terminal=null;
  for(let round=0;round<3;round++){
   const e=await port.call('absence',{api:'DescribeInstances',kind:'exact',instanceId:resources.instanceId});
   if(e.completion.outcome==='success'&&e.completion.facts.state==='terminated'){terminal=e;break;}
   await after(now()+100,deadlineMs,signal);
  }
  if(terminal===null)fail();const ids=[terminal.operationId];
  for(const request of [{api:'DescribeVolumes',volumeId:resources.rootVolumeId},
   ...resources.networkInterfaceIds.map(networkInterfaceId=>({api:'DescribeNetworkInterfaces',networkInterfaceId}))]){
   let prior=terminal.completion.completedAtMs;
   for(let n=0;n<2;n++){
    await after(prior,deadlineMs,signal);const e=await port.call('absence',request);ids.push(e.operationId);prior=e.completion.completedAtMs;
   }
  }
  if(phase==='managed'){
   const arn=row.declaration_json.watchdog.executionArn;
   const d=await port.call('provenance',{api:'DescribeExecution',executionArn:arn});if(d.completion.outcome!=='success')fail();
   let nextToken=null;
   for(let page=0;page<5;page++){
    const e=await port.call('provenance',{api:'GetExecutionHistory',executionArn:arn,nextToken,maxResults:100,reverseOrder:false,includeExecutionData:true});
    if(e.completion.outcome!=='success')fail();nextToken=e.completion.facts.nextToken;if(nextToken===null)break;
   }
   if(nextToken!==null)fail();const state=await writer.readNativePhysicalState({key});
   const provenance=deriveNativeManagedProvenance({journal:state.observations,row,sessionId:port.sessionId}),w=row.declaration_json.watchdog;
   await writer.recordNativeManagedPhysicalProvenance({key,provenance:{executionArn:w.executionArn,stateMachineVersionArn:w.stateMachineVersionArn,
    inputSha256:w.inputSha256,definitionSha256:w.definitionSha256,events:provenance.events}});
  }
  await drainPending(key,phase,deadlineMs,signal);
  return writer.finalizeNativePhysicalPhase({key,phase,status:'verified-absent',reason:null,evidenceEventIds:ids});
 }
 function ordinaryPort(row){
  assertPlacement(row);
  const key=keyFor(row);let pending,port,resources,deadlineMs;
  const contextRequest=request=>{
   if(hash(request.allocation)!==hash(row.allocation_json)||hash(request.binding)!==hash(row.original_binding_json)||
    hash(request.hostIdentity)!==hash(row.host_identity_json))fail();
  };
  return Object.freeze({
   destroy(request,{signal}={}){
    contextRequest(request);
    return pending??=(async()=>{
     const requestEnd=now()+requestMs;
     const retained=await writer.readNativePhysicalState({key,signal});
     if(retained.result?.ordinary?.status==='verified-absent'){
      resources=retained.resources.ordinary;deadlineMs=retained.context.ordinary.deadlineMs;
      return {requested:true,instanceId:resources.instanceId,rootVolumeId:resources.rootVolumeId,networkInterfaceIds:resources.networkInterfaceIds};
     }
     const original=await writer.beginNativeOrdinaryPhysical({key,requestId:randomUUID(),signal});
     deadlineMs=Math.min(original.deadlineMs,requestEnd);
     return scope.run({deadlineMs},async()=>{
      if(now()>=original.deadlineMs)fail();port=session(row,key,'ordinary',deadlineMs,signal);
      try{
       await port.authenticate();resources=await capture(row,key,'ordinary',port);
       const claim=await writer.claimNativeOrdinaryPhysicalDispatch({key,dispatchId:randomUUID(),ownerProcessId,sessionId:port.sessionId,signal});
       if(claim.sendOnce!==null){const event=await claim.sendOnce(port.send);
        await writer.recordNativeOrdinaryPhysicalDispatchResult({key,dispatchId:claim.claim.dispatchId,eventId:event.operationId});}
       else {
        // A persisted claim never recreates a send permit. A restart may recover its completed
        // acknowledgement or continue read-only absence while the original call is unresolved.
        const retained=await writer.readNativePhysicalState({key}),event=retained.observations.entries.find(e=>e.operationId===claim.claim.dispatchId);
        if(event?.completion&&!retained.dispatch_result?.ordinary)
         await writer.recordNativeOrdinaryPhysicalDispatchResult({key,dispatchId:claim.claim.dispatchId,eventId:event.operationId});
       }
       return {requested:true,instanceId:resources.instanceId,rootVolumeId:resources.rootVolumeId,networkInterfaceIds:resources.networkInterfaceIds};
      }finally{port.close();await finalizeExpired(key,'ordinary');}
     });
    })();
   },
   async observeAbsent(request,{signal}={}){
    contextRequest(request);await pending;if(!resources||hash(request.resources)!==hash({instanceId:resources.instanceId,
     rootVolumeId:resources.rootVolumeId,networkInterfaceIds:resources.networkInterfaceIds}))fail();
    return scope.run({deadlineMs},async()=>{
     try{
      const state=await writer.readNativePhysicalState({key});
      if(state.result?.ordinary?.status!=='verified-absent'){
       port=session(row,key,'ordinary',deadlineMs,signal);await port.authenticate();
       await observe(row,key,'ordinary',resources,port,deadlineMs,signal);
      }
      const retained=await writer.readNativePhysicalState({key}),evidence=projectOrdinaryPhysicalEvidence({row,state:retained,nowMs:now()});
      return {schema:HOST_PHYSICAL_ABSENCE_SCHEMA,allocationSha256:hash(row.allocation_json),bindingSha256:hash(row.original_binding_json),
       hostIdentitySha256:hash(row.host_identity_json),instanceId:resources.instanceId,rootVolumeId:resources.rootVolumeId,
       networkInterfaceIds:resources.networkInterfaceIds,observedAtMs:now(),instanceState:'terminated',rootVolumeAbsent:true,networkInterfacesAbsent:true,evidence};
     }finally{port?.close();await finalizeExpired(key,'ordinary');}
    });
   },
  });
 }
 async function managed(raw,{signal,deadlineMs}={}){
  const body=observerHttpBody(raw);if(closed||now()>=body.expiresAtMs)fail();
  const {row,key,state}=await read(body.hostId,body.generation),w=row.declaration_json.watchdog;
  if(body.allocationSha256!==row.allocation_sha256||body.provisionToken!==row.declaration_json.token||
   body.executionArn!==w.executionArn||body.originalInputSha256!==w.inputSha256||
   body.bridgeFunctionVersionArn!==row.declaration_json.physicalObserver.bridgeFunctionVersionArn||
   body.expiresAtMs>w.cleanupCeilingMs||now()>=body.expiresAtMs)fail();
  const end=Math.min(body.expiresAtMs,deadlineMs??body.expiresAtMs,w.cleanupCeilingMs);
  if(body.mode!=='read-result'&&!state.result?.managed&&state.observations.closedForFullTeardown===null&&row.state!=='terminated'){
   await scope.run({deadlineMs:end},async()=>{
    const port=session(row,key,'managed',end,signal);
    try{await port.authenticate();
     const resources=body.mode==='prepare'?await capture(row,key,'managed',port):state.resources?.managed;
     if(body.mode==='observe'){if(!resources)fail();await observe(row,key,'managed',resources,port,end,signal);}
    }finally{port.close();await finalizeExpired(key,'managed');}
   });
  }
  const retained=await writer.readNativePhysicalState({key}),result=retained.result?.managed??null;
  return {disposition:result?.status==='verified-absent'?'verified-absent':result?'unknown':'pending',
   hostId:body.hostId,generation:body.generation,deadlineMs:w.cleanupCeilingMs,contextSha256:hash(retained.context.managed),
   resourcesSha256:retained.resources?.managed?hash(retained.resources.managed):null,resultSha256:result?hash(result):null,reason:result?.reason??null};
 }
 async function drainFullTeardown({key,receipt,signal,deadlineMs}){
  await writer.prepareNativeFullTeardown({key,receipt,signal});
  // No transaction is held while waiting; never shorten an existing operation's original deadline.
  await drainPending(key,null,deadlineMs,signal);
 }
 return Object.freeze({writer,read,ordinaryPort,observeIntent:managed,drainFullTeardown,
  close(){closed=true;for(const sdk of clients)sdk.close();clients.clear();}});
}
