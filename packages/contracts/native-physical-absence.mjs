/** Canonical native correlated-absence evidence. One validator is used by the EC2 producer and the saved-receipt consumer.
 * This is an operational protocol: a positive exact terminal instance read followed by bounded, separated exact-ID
 * resource absences. It never upgrades a denial, unknown, foreign id, partial set or future observation. */
const fail=()=>{throw Object.assign(Error('NATIVE_PHYSICAL_EVIDENCE_REFUSED'),{code:'NATIVE_PHYSICAL_EVIDENCE_REFUSED'});};
const REGION=/^[a-z]{2}-[a-z]+-[0-9]$/u,ACCOUNT=/^[0-9]{12}$/u;
const INSTANCE=/^i-[0-9a-f]{8}(?:[0-9a-f]{9})?$/u,VOLUME=/^vol-[0-9a-f]{8}(?:[0-9a-f]{9})?$/u,
 ENI=/^eni-[0-9a-f]{8}(?:[0-9a-f]{9})?$/u;
const ARN=/^arn:aws:(?:iam|sts)::([0-9]{12}):(?:user\/|role\/|assumed-role\/)[^\s]+$/u;
const SHA=/^[0-9a-f]{64}$/u;
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const meta=v=>v!==null&&typeof v.requestId==='string'&&v.requestId.length>0&&v.requestId.length<=128&&
 Number.isSafeInteger(v.httpStatusCode)&&v.httpStatusCode>=200&&v.httpStatusCode<=499;

export const NATIVE_PHYSICAL_OPERATION_MS=25000;
export const NATIVE_PHYSICAL_PROTOCOL_VERSION=1;
export const NATIVE_PHYSICAL_SCHEMA='meri-native-correlated-absence/1';

export function validateNativePhysicalEvidence(value,{nowMs,instanceId,startedAtMs,accountId,region,rootVolumeId,
 networkInterfaceIds,deadlineMs}={}){
 if(!isObject(value)||value.schema!==NATIVE_PHYSICAL_SCHEMA||value.protocolVersion!==1) fail();
 if(typeof value.accountId!=='string'||!ACCOUNT.test(value.accountId)||typeof value.region!=='string'||
  !REGION.test(value.region)||!isObject(value.caller)||value.caller.accountId!==value.accountId||
  value.caller.region!==value.region||typeof value.caller.arn!=='string'||!ARN.test(value.caller.arn)||
  (ARN.exec(value.caller.arn)?.[1])!==value.accountId||typeof value.caller.userId!=='string'||
  value.caller.userId.length===0||value.caller.userId.length>256) fail();
 if(typeof value.instanceId!=='string'||!INSTANCE.test(value.instanceId)||
  (instanceId!==undefined&&value.instanceId!==instanceId)||(accountId!==undefined&&value.accountId!==accountId)||
  (region!==undefined&&value.region!==region)||(rootVolumeId!==undefined&&value.rootVolumeId!==rootVolumeId)) fail();
 const pre=value.preObservation;
 if(!isObject(pre)||pre.schema!=='meri-native-preobservation/1'||pre.accountId!==value.accountId||
  pre.region!==value.region||pre.instanceId!==value.instanceId||typeof pre.rootVolumeId!=='string'||
  !VOLUME.test(pre.rootVolumeId)||pre.rootVolumeDeleteOnTermination!==true||!meta(pre)||
  pre.httpStatusCode!==200||!Number.isSafeInteger(pre.atMs)) fail();
 const terminal=value.terminalObservation;
 if(!isObject(terminal)||terminal.instanceId!==value.instanceId||terminal.state!=='terminated'||
  !meta(terminal)||terminal.httpStatusCode!==200||!Number.isSafeInteger(terminal.atMs)||
  terminal.atMs<pre.atMs||(startedAtMs!==undefined&&terminal.atMs<startedAtMs)||
  (nowMs!==undefined&&terminal.atMs>nowMs)||terminal.atMs>value.operationDeadlineMs||
  (deadlineMs!==undefined&&terminal.atMs>deadlineMs)) fail();
 if(!Array.isArray(value.networkInterfaceIds)||value.networkInterfaceIds.length<1||
  value.networkInterfaceIds.length>16||new Set(value.networkInterfaceIds).size!==value.networkInterfaceIds.length||
  !value.networkInterfaceIds.every(id=>typeof id==='string'&&ENI.test(id))||
  (networkInterfaceIds!==undefined&&value.networkInterfaceIds.length!==networkInterfaceIds.length)||
  (networkInterfaceIds!==undefined&&!value.networkInterfaceIds.every(id=>networkInterfaceIds.includes(id)))) fail();
 if(!isObject(pre.attachments)&&!Array.isArray(pre.attachments)) fail();
 if(!Array.isArray(pre.attachments)||pre.attachments.length!==value.networkInterfaceIds.length||
  new Set(pre.attachments.map(a=>a?.id)).size!==value.networkInterfaceIds.length||
  !value.networkInterfaceIds.every(id=>pre.attachments.some(a=>a?.id===id))) fail();
 for(const a of pre.attachments){
  if(!isObject(a)||!value.networkInterfaceIds.includes(a.id)||a.deleteOnTermination!==true||
   typeof a.attachmentId!=='string'||!/^eni-attach-[0-9a-f]{8,17}$/u.test(a.attachmentId)||
   !Number.isSafeInteger(a.deviceIndex)||a.deviceIndex<0||a.deviceIndex>15) fail();
 }
 const pv=pre.volume,pe=pre.networkInterfaces;
 if(!isObject(pv)||pv.volumeId!==pre.rootVolumeId||pv.state!=='in-use'||pv.deleteOnTermination!==true||
  pv.attachmentInstanceId!==value.instanceId||!meta(pv)||pv.httpStatusCode!==200) fail();
 if(!Array.isArray(pe)||pe.length!==value.networkInterfaceIds.length||new Set(pe.map(x=>x?.id)).size!==pe.length||
  !value.networkInterfaceIds.every(id=>pe.some(x=>x.id===id))||!pe.every(x=>isObject(x)&&
   x.attachmentInstanceId===value.instanceId&&x.deleteOnTermination===true&&meta(x)&&x.httpStatusCode===200)) fail();
 if(!Number.isSafeInteger(value.operationDeadlineMs)||value.operationDeadlineMs<pre.atMs||
  (deadlineMs!==undefined&&value.operationDeadlineMs!==deadlineMs)) fail();
 if(!Array.isArray(value.resources)||value.resources.length!==1+value.networkInterfaceIds.length) fail();
 const volume=value.resources.find(r=>r?.kind==='volume'),enis=value.resources.filter(r=>r?.kind==='network-interface');
 if(!isObject(volume)||volume.id!==pre.rootVolumeId||!VOLUME.test(volume.id)) fail();
 if(enis.length!==value.networkInterfaceIds.length||new Set(enis.map(r=>r?.id)).size!==enis.length||
  !value.networkInterfaceIds.every(id=>enis.some(r=>r.id===id))) fail();
 const check=(resource,expectedCode,allowDeleted)=>{
  if(!isObject(resource)||!Array.isArray(resource.observations)||resource.observations.length<2) fail();
  let prior=terminal.atMs;
  for(const o of resource.observations){
   const notFound=o?.errorCode===expectedCode&&o?.httpStatusCode===400;
   const deleted=allowDeleted&&o?.errorCode===undefined&&o?.volumeState==='deleted'&&o?.httpStatusCode===200;
   if(!isObject(o)||o.absent!==true||o.resourceId!==resource.id||!(notFound||deleted)||!meta(o)||
    !Number.isSafeInteger(o.atMs)||o.atMs<=prior||(nowMs!==undefined&&o.atMs>nowMs)||
    o.atMs>value.operationDeadlineMs||(deadlineMs!==undefined&&o.atMs>deadlineMs)) fail();
   prior=o.atMs;
  }
 };
 check(volume,'InvalidVolume.NotFound',true);
 for(const eni of enis)check(eni,'InvalidNetworkInterfaceID.NotFound',false);
 return true;
}
