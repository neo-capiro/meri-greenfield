/** Validate normalized SDK facts and derive evidence from retained journal entries, never caller claims. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {physicalRefused as fail,requireCausalAbsence} from './native-physical-journal.mjs';
import {privateAddress} from '../../../packages/contracts/native-tls-kernel.mjs';
import {assertNativeHistoryFacts} from './native-physical-history.mjs';
import {validateNativePhysicalEvidence} from '../../../packages/contracts/native-physical-absence.mjs';
const states={pending:0,running:16,'shutting-down':32,terminated:48,stopping:64,stopped:80};
const id=(kind,x)=>typeof x==='string'&&new RegExp(`^${kind}-(?:[0-9a-f]{8}|[0-9a-f]{17})$`,'u').test(x);
const same=(a,b)=>{if(hash(a)!==hash(b))fail();};
const ids=(a,kind,max=16)=>{if(!Array.isArray(a)||a.length>max||new Set(a).size!==a.length||a.some(x=>!id(kind,x)))fail();return a;};
const finite=x=>Number.isSafeInteger(x)&&x>=0;
function tags(value,row){
 const t=own(data(value),['Project','MeriHostId','MeriGeneration','MeriAllocationSha256']);
 same(t,{Project:'meri-greenfield',MeriHostId:row.host_id,MeriGeneration:String(row.generation),MeriAllocationSha256:row.allocation_sha256});
}
function attachment(a,{instanceId,network=false}={}){
 const v=own(data(a),network?['instanceId','attachmentId','deviceIndex','deleteOnTermination']:['instanceId','volumeId','device','deleteOnTermination']);
 if(!id('i',v.instanceId)||v.instanceId!==instanceId||v.deleteOnTermination!==true)fail();
 if(network){if(!/^eni-attach-[0-9a-f]{8,17}$/u.test(v.attachmentId)||!finite(v.deviceIndex)||v.deviceIndex>15)fail();}
 else if(!id('vol',v.volumeId)||v.device!=='/dev/xvda')fail();return v;
}
export function assertPhysicalFacts(event,completion,row){
 const d=row.declaration_json,a=row.allocation_json,f=completion.facts,r=event.request;
 if(completion.outcome==='invalid-response'){
  const v=own(data(f),['reason','knownInstanceIds','knownVolumeIds','knownEniIds','observedCount','overflow']);
  if(!['malformed-wire','identity-mismatch','metadata-missing','resource-drift','bounds-exceeded'].includes(v.reason)||
   !finite(v.observedCount)||typeof v.overflow!=='boolean')fail();ids(v.knownInstanceIds,'i');ids(v.knownVolumeIds,'vol');ids(v.knownEniIds,'eni');return;
 }
 if(r.api==='GetCallerIdentity'){
  const v=own(data(f),['accountId','arn','userId']);
  if(v.accountId!==d.accountId||typeof v.arn!=='string'||v.arn.length>2048||
   !new RegExp(`^arn:aws:(?:iam|sts)::${d.accountId}:(?:user/|role/|assumed-role/)[^\\s]+$`,'u').test(v.arn)||
   typeof v.userId!=='string'||!v.userId||v.userId.length>256)fail();return;
 }
 if(r.api==='DescribeInstances'&&r.kind==='discovery'){
  const v=own(data(f),['scanId','pageIndex','nextToken','matches','conflicts','observedCount','overflow','complete']);
  if(v.scanId!==r.scanId||v.pageIndex!==r.pageIndex||!Array.isArray(v.matches)||!Array.isArray(v.conflicts)||
   v.matches.length+v.conflicts.length>16||!finite(v.observedCount)||typeof v.overflow!=='boolean'||typeof v.complete!=='boolean'||
   (v.nextToken!==null&&(typeof v.nextToken!=='string'||!v.nextToken||Buffer.byteLength(v.nextToken)>2048))||
   (v.complete&&(v.nextToken!==null||v.overflow||v.conflicts.length)))fail();
  for(const raw of v.matches){const m=own(data(raw),['instanceId','ownerAccountId','allocationSha256','provisionToken','placementSha256','rootVolumeId','networkInterfaceIds']);
   if(!id('i',m.instanceId)||m.ownerAccountId!==d.accountId||m.allocationSha256!==hash(a)||m.provisionToken!==d.token||
    m.placementSha256!==hash(d.placement)||(m.rootVolumeId!==null&&!id('vol',m.rootVolumeId)))fail();ids(m.networkInterfaceIds,'eni');}
  for(const raw of v.conflicts){const c=own(data(raw),['instanceId','reason']);if(!id('i',c.instanceId)||
   !['foreign-owner','intent-mismatch','resource-drift','invalid-shape','bounds-exceeded'].includes(c.reason))fail();}return;
 }
 if(r.api==='DescribeInstances'&&event.stage==='absence'&&f?.state==='terminated'){
  const v=own(data(f),['instanceId','ownerAccountId','state','stateCode']);
  if(v.instanceId!==r.instanceId||v.ownerAccountId!==d.accountId||v.stateCode!==48)fail();return;
 }
 if(r.api==='DescribeInstances'){
  const v=own(data(f),['instanceId','ownerAccountId','state','stateCode','amiId','vpcId','subnetId','rootDeviceName','rootDeviceType',
   'publicIpPresent','publicDnsPresent','blockDeviceMappingCount','privateIp','tags','root','networkInterfaces']);
  if(v.instanceId!==r.instanceId||v.ownerAccountId!==d.accountId||v.amiId!==d.launch.ImageId||v.vpcId!==d.placement.vpcId||
   v.subnetId!==d.placement.subnetId||states[v.state]!==v.stateCode||v.rootDeviceName!=='/dev/xvda'||v.rootDeviceType!=='ebs'||
   v.publicIpPresent!==false||v.publicDnsPresent!==false||v.blockDeviceMappingCount!==1||
   (v.privateIp!==null&&privateAddress(v.privateIp)!==v.privateIp))fail();
  tags(v.tags,row);const root=own(data(v.root),['volumeId','deleteOnTermination']);if(!id('vol',root.volumeId)||root.deleteOnTermination!==true)fail();
  if(!Array.isArray(v.networkInterfaces)||v.networkInterfaces.length<1||v.networkInterfaces.length>16)fail();
  ids(v.networkInterfaces.map(x=>x.id),'eni');
  for(const raw of v.networkInterfaces){const n=own(data(raw),['id','ownerAccountId','vpcId','subnetId','securityGroupIds','publicAssociationPresent','attachment']);
   same(n.securityGroupIds,d.placement.securityGroupIds);
   if(n.ownerAccountId!==d.accountId||n.vpcId!==d.placement.vpcId||n.subnetId!==d.placement.subnetId||n.publicAssociationPresent!==false)fail();
   const at=own(data(n.attachment),['attachmentId','deviceIndex','deleteOnTermination']);
   attachment({...at,instanceId:v.instanceId},{instanceId:v.instanceId,network:true});
   if(v.networkInterfaces.length===1&&at.deviceIndex!==0)fail();}return;
 }
 if(r.api==='DescribeVolumes'){
  if(event.stage==='absence'&&f?.state==='deleted'){
   const v=own(data(f),['volumeId','state']);if(v.volumeId!==r.volumeId)fail();return;}
  const v=own(data(f),['volumeId','ownerAccountId','state','encrypted','tags','attachment']);
  if(v.volumeId!==r.volumeId||v.ownerAccountId!==d.accountId||v.state!=='in-use'||v.encrypted!==true)fail();tags(v.tags,row);
  attachment(v.attachment,{instanceId:v.attachment?.instanceId});if(v.attachment.volumeId!==v.volumeId)fail();return;
 }
 if(r.api==='DescribeNetworkInterfaces'){
  const v=own(data(f),['id','ownerAccountId','vpcId','subnetId','securityGroupIds','publicAssociationPresent','attachment']);
  if(v.id!==r.networkInterfaceId||v.ownerAccountId!==d.accountId||v.vpcId!==d.placement.vpcId||v.subnetId!==d.placement.subnetId||v.publicAssociationPresent!==false)fail();
  same(v.securityGroupIds,d.placement.securityGroupIds);attachment(v.attachment,{instanceId:v.attachment?.instanceId,network:true});return;
 }
 if(r.api==='TerminateInstances'){
  const v=own(data(f),['instanceId','currentState','currentStateCode']);if(v.instanceId!==r.instanceId||
   !['shutting-down','terminated'].includes(v.currentState)||states[v.currentState]!==v.currentStateCode)fail();return;
 }
 if(event.stage==='provenance'){assertNativeHistoryFacts(event,completion,row);return;}
 // Managed history has its own exact mapping validator; never accept arbitrary object facts here.
 fail();
}
function successful(j,id,row){const e=j.entries.find(x=>x.operationId===id);
 if(!e||e.completion?.outcome!=='success'||e.completion.completedAtMs>e.callDeadlineMs)fail();assertPhysicalFacts(e,e.completion,row);return e;}
export function physicalDiscoveryChain({journal,row,phase,scanId,instanceId,beforeMs}){
 const pages=journal.entries.filter(e=>e.stage==='discovery'&&e.request.scanId===scanId).sort((a,b)=>a.request.pageIndex-b.request.pageIndex);
 if(!pages.length||pages.length>20)fail();let token=null;const owned=new Set();
 pages.forEach((e,index)=>{successful(journal,e.operationId,row);const f=e.completion.facts;
  if(e.phase!==phase||e.request.pageIndex!==index||e.request.nextToken!==token||f.overflow||f.conflicts.length||e.completion.completedAtMs>beforeMs)fail();
  for(const m of f.matches)owned.add(m.instanceId);token=f.nextToken;
  if(index<pages.length-1&&token===null)fail();});
 if(token!==null||pages.at(-1).completion.facts.complete!==true||owned.size!==1||!owned.has(instanceId))fail();
 return {scanId,pageEventIds:pages.map(e=>e.operationId)};
}
export function sealPhysicalResources({journal,row,phase,eventIds,discoveryScanId}){
 if(!['ordinary','managed'].includes(phase))fail();
 if(!Array.isArray(eventIds)||new Set(eventIds).size!==eventIds.length||eventIds.length<3||eventIds.length>18)fail();
 const events=eventIds.map(id=>successful(journal,id,row));if(events.some(e=>e.stage!=='capture'||e.phase!==phase))fail();
 const instance=events.filter(e=>e.request.api==='DescribeInstances');if(instance.length!==1)fail();
 const i=instance[0].completion.facts,volumes=events.filter(e=>e.request.api==='DescribeVolumes'),
  enis=events.filter(e=>e.request.api==='DescribeNetworkInterfaces');
 if(volumes.length!==1||volumes[0].completion.facts.volumeId!==i.root.volumeId||
  volumes[0].completion.facts.attachment.instanceId!==i.instanceId||enis.length!==i.networkInterfaces.length)fail();
 for(const n of i.networkInterfaces){const e=enis.find(e=>e.request.networkInterfaceId===n.id);
  if(!e||e.completion.facts.attachment.instanceId!==i.instanceId||e.completion.facts.attachment.attachmentId!==n.attachment.attachmentId)fail();}
 let discovery=null;
 if(discoveryScanId!==null){
  discovery=physicalDiscoveryChain({journal,row,phase,scanId:discoveryScanId,instanceId:i.instanceId,beforeMs:instance[0].startedAtMs});
 }else if(row.observed_instance_json?.instanceId!==i.instanceId||
  journal.entries.some(e=>e.phase===phase&&e.stage==='discovery'&&e.startedAtMs<=instance[0].startedAtMs))fail();
 if(row.observed_instance_json&&row.observed_instance_json.instanceId!==i.instanceId)fail();
 if(row.host_identity_json&&row.host_identity_json.instanceId!==i.instanceId)fail();
 return {instanceId:i.instanceId,rootVolumeId:i.root.volumeId,networkInterfaceIds:i.networkInterfaces.map(n=>n.id).sort(),
  preObservationEventIds:[...eventIds],completedAtMs:Math.max(...events.map(e=>e.completion.completedAtMs)),discovery};
}
export function derivePhysicalEvidence({journal,row,resources,context,dispatchAtMs,terminalId,absenceIds}){
 const terminal=successful(journal,terminalId,row),t=terminal.completion;
 if(terminal.stage!=='absence'||t.facts.instanceId!==resources.instanceId||t.facts.state!=='terminated'||
  terminal.phase!==context.phase||terminal.startedAtMs<dispatchAtMs||terminal.startedAtMs<context.startedAtMs||
  resources.completedAtMs>dispatchAtMs||t.completedAtMs>context.deadlineMs)fail();
 const expected=[['volume',resources.rootVolumeId],...resources.networkInterfaceIds.map(id=>['network-interface',id])];
 const results=expected.map(([kind,id])=>{
  const keys=absenceIds.filter(key=>{const e=journal.entries.find(x=>x.operationId===key);return e?.request[kind==='volume'?'volumeId':'networkInterfaceId']===id;});
  requireCausalAbsence(journal,{terminalId,eventIds:keys,deadlineMs:context.deadlineMs});
  return {kind,id,observations:keys.map(key=>{const e=journal.entries.find(x=>x.operationId===key),c=e.completion;
   const code=kind==='volume'?'InvalidVolume.NotFound':'InvalidNetworkInterfaceID.NotFound';
   if(e.phase!==context.phase||e.request.api!==(kind==='volume'?'DescribeVolumes':'DescribeNetworkInterfaces'))fail();
   const absent=c.outcome==='service-error'&&c.errorCode===code&&c.httpStatusCode===400&&c.requestId!==null;
   const deleted=kind==='volume'&&c.outcome==='success'&&c.httpStatusCode===200&&c.requestId!==null&&c.facts?.state==='deleted'&&c.facts.volumeId===id;
   if(deleted)assertPhysicalFacts(e,c,row);
   if(!absent&&!deleted)fail();return {operationId:key,resourceId:id,absent:true,atMs:c.completedAtMs,
    requestId:c.requestId,httpStatusCode:c.httpStatusCode,...(absent?{errorCode:code}:{volumeState:'deleted'})};})};});
 if(results.reduce((n,r)=>n+r.observations.length,0)!==absenceIds.length)fail();
 return {terminalId,resources:results,evidenceEventIds:[terminalId,...absenceIds]};
}
/** Compatibility projection for the existing genuine guest/full-teardown receipt owner. */
export function projectOrdinaryPhysicalEvidence({row,state,nowMs}){
 const journal=state.observations,result=state.result?.ordinary,resources=state.resources?.ordinary,context=state.context.ordinary;
 if(result?.status!=='verified-absent'||!resources||!context)fail();
 const derived=derivePhysicalEvidence({journal,row,resources,context,dispatchAtMs:state.dispatch.ordinary.claimedAtMs,
  terminalId:result.evidenceEventIds[0],absenceIds:result.evidenceEventIds.slice(1)});
 const events=resources.preObservationEventIds.map(id=>successful(journal,id,row));
 const instance=events.find(e=>e.request.api==='DescribeInstances'),volume=events.find(e=>e.request.api==='DescribeVolumes'),
  nics=events.filter(e=>e.request.api==='DescribeNetworkInterfaces'),terminal=successful(journal,derived.terminalId,row);
 const all=[...events,terminal,...result.evidenceEventIds.slice(1).map(id=>journal.entries.find(e=>e.operationId===id))];
 let caller=null;
 for(const e of all){
  const auth=journal.entries.find(a=>a.sessionId===e.sessionId&&a.request.api==='GetCallerIdentity'&&a.completion?.outcome==='success');
  if(!auth)fail();if(caller===null)caller=auth.completion.facts;else same(caller,auth.completion.facts);
 }
 const meta=e=>({requestId:e.completion.requestId,httpStatusCode:e.completion.httpStatusCode});
 const i=instance.completion.facts;
 const evidence={schema:'meri-native-correlated-absence/1',protocolVersion:1,accountId:context.accountId,region:context.region,
  caller:{...caller,region:context.region},instanceId:resources.instanceId,rootVolumeId:resources.rootVolumeId,
  networkInterfaceIds:resources.networkInterfaceIds,operationDeadlineMs:context.deadlineMs,
  preObservation:{schema:'meri-native-preobservation/1',accountId:context.accountId,region:context.region,
   instanceId:resources.instanceId,rootVolumeId:resources.rootVolumeId,rootVolumeDeleteOnTermination:true,
   ...meta(instance),atMs:resources.completedAtMs,
   attachments:i.networkInterfaces.map(n=>({id:n.id,...n.attachment})),
   volume:{volumeId:resources.rootVolumeId,state:'in-use',deleteOnTermination:true,attachmentInstanceId:resources.instanceId,...meta(volume)},
   networkInterfaces:nics.map(e=>({id:e.request.networkInterfaceId,attachmentInstanceId:resources.instanceId,deleteOnTermination:true,...meta(e)}))},
  terminalObservation:{instanceId:resources.instanceId,state:'terminated',...meta(terminal),atMs:terminal.completion.completedAtMs},
  resources:derived.resources.map(r=>({...r,observations:r.observations.map(({operationId,...fact})=>fact)}))};
 validateNativePhysicalEvidence(evidence,{nowMs,instanceId:resources.instanceId,deadlineMs:context.deadlineMs});return evidence;
}
