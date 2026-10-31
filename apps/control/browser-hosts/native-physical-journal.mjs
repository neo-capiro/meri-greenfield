/** Same-row /2 physical evidence storage rules. No SDK calls or database ownership here. */
import {canonicalJson,canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {nativeObserverDeadline,nativeObserverLaunchRequest,NATIVE_DECLARATION_V2} from '../../../packages/contracts/native-observer.mjs';
export const PHYSICAL_COLUMNS=Object.freeze({context:32768,resources:262144,dispatch:16384,
 dispatch_result:16384,observations:524288,result:65536});
export const COMPLETION_BYTES=8192,FENCE_BYTES=4096,MAX_EVENTS=256;
export const physicalRefused=()=>{throw Object.assign(Error('NATIVE_PHYSICAL_REFUSED'),{code:'NATIVE_PHYSICAL_REFUSED'});};
const fail=physicalRefused,uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(v);
export const physicalBytes=v=>Buffer.byteLength(canonicalJson(v),'utf8');
export function physicalTriplet(name,value){
 if(!Object.hasOwn(PHYSICAL_COLUMNS,name))fail();
 if(value===null)return [null,null,null];
 const canonical=canonicalJson(value);
 if(Buffer.byteLength(canonical,'utf8')>PHYSICAL_COLUMNS[name])fail();
 return [value,hash(value),canonical];
}
export function readPhysicalSlots(row){
 const result={};
 for(const name of Object.keys(PHYSICAL_COLUMNS)){
  const prefix=`native_physical_${name}`,json=row[`${prefix}_json`],sha=row[`${prefix}_sha256`],text=row[`${prefix}_canonical`];
  // Undefined means missing schema/column, not an empty valid slot.
  if(json===undefined||sha===undefined||text===undefined)fail();
  if(json===null){if(sha!==null||text!==null)fail();result[name]=null;continue;}
  const expected=physicalTriplet(name,json);
  if(sha!==expected[1]||text!==expected[2])fail();result[name]=structuredClone(json);
 }
 return result;
}
export function initialPhysicalContexts({allocation,binding,declaration}){
 if(declaration.schema!==NATIVE_DECLARATION_V2)fail();
 const w=declaration.watchdog,L=allocation.leaseDeadlineMs;
 if(w.leaseDeadlineMs!==L||w.cleanupCeilingMs!==nativeObserverDeadline(L))fail();
 const managed={phase:'managed',hostId:allocation.hostId,generation:allocation.generation,
  allocationSha256:hash(allocation),originalBindingSha256:hash(binding),declarationSha256:hash(declaration),
  provisionToken:declaration.token,accountId:declaration.accountId,region:declaration.region,
  leaseDeadlineMs:L,cleanupCeilingMs:w.cleanupCeilingMs,startedAtMs:L,deadlineMs:w.cleanupCeilingMs,
  launchRequestSha256:hash(nativeObserverLaunchRequest({allocation,declaration})),
  authority:{kind:'prearmed-graph',executionArn:w.executionArn,stateMachineVersionArn:w.stateMachineVersionArn,
   definitionSha256:w.definitionSha256,inputSha256:w.inputSha256}};
 return {schema:'meri-native-physical-contexts/2',ordinary:null,managed};
}
export function beginOrdinaryPhysical(context,requestId,now){
 if(!uuid(requestId))fail();if(context.ordinary!==null)return context;
 return {...context,ordinary:{...context.managed,phase:'ordinary',startedAtMs:now,deadlineMs:nativeObserverDeadline(now),
  authority:{kind:'control-original',requestId}}};
}
export function emptyPhysicalJournal(){return {schema:'meri-native-physical-journal/2',entries:[],closedForFullTeardown:null};}
export function assertPhysicalRequest(raw,{phase,stage}){
 if(!['ordinary','managed'].includes(phase))fail();
 const api=raw?.api;
 const keys={GetCallerIdentity:['api'],DescribeInstances:raw?.kind==='discovery'?
  ['api','kind','provisionToken','nextToken','maxResults','scanId','pageIndex']:['api','kind','instanceId'],
  DescribeVolumes:['api','volumeId'],DescribeNetworkInterfaces:['api','networkInterfaceId'],
  TerminateInstances:['api','instanceId','dispatchId'],DescribeExecution:['api','executionArn'],
  GetExecutionHistory:['api','executionArn','nextToken','maxResults','reverseOrder','includeExecutionData']}[api];
 if(!keys)fail();const r=own(data(raw),keys);
 const allowed={authentication:['GetCallerIdentity'],discovery:['DescribeInstances'],
  capture:['DescribeInstances','DescribeVolumes','DescribeNetworkInterfaces'],
  absence:['DescribeInstances','DescribeVolumes','DescribeNetworkInterfaces'],
  termination:phase==='ordinary'?['TerminateInstances']:[],
  provenance:phase==='managed'?['DescribeExecution','GetExecutionHistory']:[]}[stage];
 if(!allowed?.includes(api))fail();
 if(api==='DescribeInstances'&&r.kind!==(stage==='discovery'?'discovery':'exact'))fail();
 for(const [key,prefix] of [['instanceId','i'],['volumeId','vol'],['networkInterfaceId','eni']])
  if(r[key]!==undefined&&!new RegExp(`^${prefix}-(?:[0-9a-f]{8}|[0-9a-f]{17})$`,'u').test(r[key]))fail();
 if(r.nextToken!==undefined&&r.nextToken!==null&&(typeof r.nextToken!=='string'||!r.nextToken||Buffer.byteLength(r.nextToken)>2048))fail();
 if(stage==='discovery'&&(!uuid(r.scanId)||!Number.isInteger(r.pageIndex)||r.pageIndex<0||r.pageIndex>=20||
  r.maxResults!==100||!/^[0-9a-f]{64}$/u.test(r.provisionToken)))fail();
 if(api==='GetExecutionHistory'&&(r.maxResults!==100||r.reverseOrder!==false||r.includeExecutionData!==true))fail();
 if(stage==='provenance'&&(typeof r.executionArn!=='string'||r.executionArn.length>2048||!r.executionArn.startsWith('arn:aws:states:')))fail();
 if(api==='TerminateInstances'&&!uuid(r.dispatchId))fail();
 if(physicalBytes(r)>4096)fail();return r;
}
export function reservePhysicalEvent(journal,raw,{context,now,callDeadlineMs,resources=null,dispatch=null,phaseDeadlines={}}){
 const p=own(data(raw),['phase','stage','sessionId','operationId','request']);
 if(!uuid(p.sessionId)||!uuid(p.operationId)||p.phase!==context.phase||journal.closedForFullTeardown!==null||
  !Number.isSafeInteger(now)||!Number.isSafeInteger(callDeadlineMs)||now>=callDeadlineMs||callDeadlineMs>context.deadlineMs)fail();
 const request=assertPhysicalRequest(p.request,p);
 const prior=journal.entries.find(x=>x.operationId===p.operationId);
 if(prior){if(hash({phase:prior.phase,stage:prior.stage,sessionId:prior.sessionId,operationId:prior.operationId,request:prior.request})!==hash({...p,request}))fail();
  return {journal,event:prior,created:false};}
 if(['absence','termination'].includes(p.stage)&&resources===null)fail();
 if(p.stage==='termination'&&(dispatch===null||dispatch.dispatchId!==request.dispatchId||dispatch.instanceId!==request.instanceId))fail();
 if(p.stage==='provenance'&&request.executionArn!==context.authority.executionArn)fail();
 if(p.stage==='discovery'&&request.provisionToken!==context.provisionToken)fail();
 if(p.stage!=='authentication'){
  const auth=journal.entries.find(e=>e.sessionId===p.sessionId&&e.request.api==='GetCallerIdentity'&&e.completion?.outcome==='success');
  if(!auth||auth.phase!==p.phase||auth.completion.facts.accountId!==context.accountId||auth.completion.completedAtMs>now)fail();
 }
 if(resources!==null){
  if(request.instanceId!==undefined&&request.instanceId!==resources.instanceId)fail();
  if(request.volumeId!==undefined&&request.volumeId!==resources.rootVolumeId)fail();
  if(request.networkInterfaceId!==undefined&&!resources.networkInterfaceIds.includes(request.networkInterfaceId))fail();
 }
 const pending=journal.entries.filter(e=>e.completion===null);
 // A timeout/abandonment does not prove the client transport settled. Conservatively hold its permit
 // through the original phase deadline; the other phase never inherits a renewed window.
 const active=journal.entries.filter(e=>(e.completion===null||['transport-unknown','abandoned'].includes(e.completion.outcome))&&
  now<(phaseDeadlines[e.phase]??(e.phase===context.phase?context.deadlineMs:Infinity)));
 if(p.stage!=='termination'&&active.filter(e=>e.stage!=='termination').length>=4)fail();
 if(p.stage==='termination'&&journal.entries.some(e=>e.stage==='termination'))fail();
 const event={sequence:journal.entries.length+1,...p,request,startedAtMs:now,callDeadlineMs,completion:null};
 const next={...journal,entries:[...journal.entries,event]};
 const bytes=physicalBytes(journal),delta=physicalBytes(next)-bytes;
 const outstanding=pending.reduce((n,e)=>n+Math.max(0,COMPLETION_BYTES-physicalBytes(e.completion)),0);
 if(next.entries.length>MAX_EVENTS||bytes+outstanding+delta+COMPLETION_BYTES-4+FENCE_BYTES>PHYSICAL_COLUMNS.observations)fail();
 return {journal:next,event,created:true};
}
export function completePhysicalEvent(journal,operationId,raw,{now,validateFacts}){
 const c=own(data(raw),['completedAtMs','outcome','requestId','httpStatusCode','errorCode','facts']);
 const index=journal.entries.findIndex(e=>e.operationId===operationId);if(index<0)fail();
 const event=journal.entries[index];
 if(event.completion!==null){if(hash(event.completion)!==hash(c))fail();return journal;}
 if(!Number.isSafeInteger(c.completedAtMs)||c.completedAtMs<event.startedAtMs||c.completedAtMs>now||
  !['success','service-error','transport-unknown','invalid-response','abandoned'].includes(c.outcome))fail();
 if(c.requestId!==null&&(typeof c.requestId!=='string'||! /^[A-Za-z0-9-]{8,128}$/u.test(c.requestId)))fail();
 if(c.httpStatusCode!==null&&(!Number.isInteger(c.httpStatusCode)||c.httpStatusCode<100||c.httpStatusCode>599))fail();
 if(c.errorCode!==null&&(typeof c.errorCode!=='string'||!c.errorCode||c.errorCode.length>128))fail();
 if(c.outcome==='success'&&(c.requestId===null||c.httpStatusCode!==200||c.errorCode!==null||c.completedAtMs>event.callDeadlineMs))fail();
 if(c.outcome==='service-error'&&(c.requestId===null||c.httpStatusCode===null||c.errorCode===null||c.facts!==null))fail();
 if(['abandoned','transport-unknown'].includes(c.outcome)&&c.facts!==null)fail();
 if(c.outcome==='abandoned'&&(now<event.callDeadlineMs||c.requestId!==null||c.httpStatusCode!==null||c.errorCode!==null))fail();
 if(c.outcome==='success'||c.outcome==='invalid-response'){
  if(typeof validateFacts!=='function')fail();validateFacts(event,c);
 }
 if(physicalBytes(c)>COMPLETION_BYTES)fail();
 const entries=[...journal.entries];entries[index]={...event,completion:c};
 const next={...journal,entries};physicalTriplet('observations',next);return next;
}
/** Completion order alone cannot establish terminal -> absence causality. */
export function requireCausalAbsence(journal,{terminalId,eventIds,deadlineMs}){
 const terminal=journal.entries.find(e=>e.operationId===terminalId);
 if(!terminal||terminal.completion?.outcome!=='success'||terminal.completion.facts?.state!=='terminated')fail();
 let after=terminal.completion.completedAtMs;
 if(eventIds.length<2||new Set(eventIds).size!==eventIds.length)fail();
 for(const id of eventIds){const e=journal.entries.find(x=>x.operationId===id),c=e?.completion;
  if(!c||e.stage!=='absence'||e.startedAtMs<=after||c.completedAtMs>deadlineMs||c.completedAtMs>e.callDeadlineMs)fail();
  after=c.completedAtMs;
 }
 return true;
}
