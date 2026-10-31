/** Same-row native pre-effect ownership on the EXISTING host_allocations key. Shape/state only: no provider,
 * SSM or issuer work happens in these transactions. Caller/authority checks are supplied by the canonical owner. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {transact} from '../product-persistence/transaction.mjs';
import {assertNativeHostAllocation,assertHostRunBindingPin,assertD005HostIdentityShape} from
 '../../../packages/contracts/native-lifecycle.mjs';
import {privateAddress} from '../../../packages/contracts/native-tls-kernel.mjs';
import {NATIVE_DECLARATION_V2,NATIVE_OBSERVER_TAG_POLICY,assertNativeObserver,assertNativeObserverPlacement,assertNativeObserverInput} from '../../../packages/contracts/native-observer.mjs';
import {initialPhysicalContexts,physicalTriplet} from './native-physical-journal.mjs';
import {nativeBootstrapOperationId,assertNativeBootstrapSpec,assertNativeBootstrapRequest,
 assertNativeBootstrapObservation} from '../../../packages/contracts/native-bootstrap.mjs';

const HEX64=/^[0-9a-f]{64}$/u,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
 INSTANCE=/^i-(?:[0-9a-f]{8}|[0-9a-f]{17})$/u;
const fail=()=>{throw Object.assign(Error('BROWSER_HOST_ALLOCATION_REFUSED'),{code:'BROWSER_HOST_ALLOCATION_REFUSED'});};
const empty=()=>{throw Object.assign(Error('BROWSER_HOST_ALLOCATION_UNKNOWN'),{code:'BROWSER_HOST_ALLOCATION_UNKNOWN'});};
const PURPOSE='native-processing',STEPS=['prepare','install'];

export const NATIVE_RESERVATION_SQL=Object.freeze({
 reserveObserver:`INSERT INTO meri_host_control.host_allocations(host_id,generation,tenant_id,conversation_id,allocation_json,
  allocation_sha256,original_binding_json,owner_instance_id,declaration_json,declaration_sha256,lease_deadline_ms,
  credential_revision,state,native_physical_context_json,native_physical_context_sha256,native_physical_context_canonical)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1,'reserved',$12,$13,$14)
  ON CONFLICT(host_id,generation) DO NOTHING`,
 reserve:`INSERT INTO meri_host_control.host_allocations(host_id,generation,tenant_id,conversation_id,allocation_json,
  allocation_sha256,original_binding_json,owner_instance_id,declaration_json,declaration_sha256,lease_deadline_ms,
  credential_revision,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1,'reserved')
  ON CONFLICT(host_id,generation) DO NOTHING`,
 claimDispatch:`UPDATE meri_host_control.host_allocations SET state='dispatching',dispatch_started_at_ms=$4
  WHERE host_id=$1 AND generation=$2 AND state='reserved' AND declaration_sha256=$3`,
 setPrepare:`UPDATE meri_host_control.host_allocations SET bootstrap_prepare_json=$3 WHERE host_id=$1 AND generation=$2`,
 setInstall:`UPDATE meri_host_control.host_allocations SET bootstrap_install_json=$3 WHERE host_id=$1 AND generation=$2`,
 recordInstance:`UPDATE meri_host_control.host_allocations SET observed_instance_json=$3
  WHERE host_id=$1 AND generation=$2 AND declaration_sha256=$4 AND observed_instance_json IS NULL`,
 recordInstanceAddress:`UPDATE meri_host_control.host_allocations
  SET observed_instance_json=jsonb_build_object('instanceId',$3,'privateIp',$4)
  WHERE host_id=$1 AND generation=$2 AND declaration_sha256=$5 AND state IN ('dispatching','unknown')
   AND observed_instance_json->>'instanceId'=$3 AND observed_instance_json->'privateIp'='null'::jsonb`,
 refuse:`UPDATE meri_host_control.host_allocations SET state='refused'
  WHERE host_id=$1 AND generation=$2 AND state='reserved' AND bootstrap_prepare_json IS NULL`,
 admitNative:`UPDATE meri_host_control.host_allocations SET host_identity_json=$3,host_identity_sha256=$4,
  endpoint_json=$5,record_sha256=$6,client_cert_sha256=$7,client_dns_name=$8,client_cert_not_after_ms=$9,
  server_cert_not_after_ms=$10,state='active'
  WHERE host_id=$1 AND generation=$2 AND state IN ('dispatching','unknown') AND declaration_sha256=$11`,
 bootstrap:`UPDATE meri_host_control.host_allocations SET `,
});

export function assertNativeWatchdogIntent(raw){
 let w;try{w=own(data(raw),['schema','executionName','executionArn','stateMachineVersionArn','definitionSha256',
  'qualificationEvidenceSha256','t0Ms','deadlineMs','leaseDeadlineMs','cleanupCeilingMs','inputSha256','input']);}catch{fail();}
 if(w.schema!=='meri-native-watchdog-intent/1'||typeof w.executionName!=='string'||
  !/^[0-9a-f-]{36}-g[1-9][0-9]{0,5}$/u.test(w.executionName)||typeof w.executionArn!=='string'||
  !/^arn:aws:states:us-east-1:[0-9]{12}:execution:[A-Za-z0-9_-]{1,80}:[A-Za-z0-9_-]{1,80}$/u.test(w.executionArn)||
  typeof w.stateMachineVersionArn!=='string'||
  !/^arn:aws:states:us-east-1:[0-9]{12}:stateMachine:[A-Za-z0-9_-]{1,80}:[1-9][0-9]*$/u.test(w.stateMachineVersionArn)||
  !HEX64.test(w.definitionSha256)||!HEX64.test(w.qualificationEvidenceSha256)||
  !Number.isSafeInteger(w.t0Ms)||w.t0Ms<1||!Number.isSafeInteger(w.deadlineMs)||w.deadlineMs<=w.t0Ms||
  !Number.isSafeInteger(w.leaseDeadlineMs)||w.leaseDeadlineMs<w.t0Ms||w.leaseDeadlineMs>w.deadlineMs||
  !Number.isSafeInteger(w.cleanupCeilingMs)||w.cleanupCeilingMs!==w.deadlineMs||
  !HEX64.test(w.inputSha256)||w.input===null||typeof w.input!=='object'||Array.isArray(w.input))fail();
 const i=w.input;
 if(!['meri-native-watchdog-input/1','meri-native-watchdog-input/2'].includes(i.schema)||i.hostId===undefined||i.generation===undefined||
  i.executionName!==w.executionName||i.originalT0Ms!==w.t0Ms||i.deadlineMs!==w.deadlineMs||
  i.leaseDeadlineMs!==w.leaseDeadlineMs||i.cleanupCeilingMs!==w.cleanupCeilingMs||
  hash(i)!==w.inputSha256||Buffer.byteLength(JSON.stringify(w),'utf8')>8192)fail();
 if(i.schema==='meri-native-watchdog-input/2'){
  assertNativeObserverInput(i);
 }
 return Object.freeze({...w,input:Object.freeze({...i})});
}

export function assertNativeDeclaration(raw){
 let d;try{d=own(data(raw),['schema','imageDigest','sourceCommit','bootstrapSha256','accountId','region',
  'placement','launch','token','tags','leaseDeadlineMs'],['nativeHelperSha256','maxLifetimeMs','bootstrapSpec','watchdog','physicalObserver','launchTagPolicy']);}catch{fail();}
 const v2=d.schema===NATIVE_DECLARATION_V2;
 if((!v2&&d.schema!=='meri-native-provisioning-declaration/1')||!/^sha256:[0-9a-f]{64}$/u.test(d.imageDigest)||
  !/^[0-9a-f]{40}$/u.test(d.sourceCommit)||!HEX64.test(d.bootstrapSha256)||
  (d.nativeHelperSha256!==undefined&&!HEX64.test(d.nativeHelperSha256))||
  typeof d.accountId!=='string'||!/^[0-9]{12}$/u.test(d.accountId)||d.region!=='us-east-1'||
  !HEX64.test(d.token)||!Number.isSafeInteger(d.leaseDeadlineMs)||d.leaseDeadlineMs<1||
  (d.maxLifetimeMs!==undefined&&(!Number.isSafeInteger(d.maxLifetimeMs)||d.maxLifetimeMs<60000)))fail();
 if(d.bootstrapSpec===undefined)fail();
 const bootstrapSpec=assertNativeBootstrapSpec(d.bootstrapSpec);
 if(d.watchdog!==undefined)d.watchdog=assertNativeWatchdogIntent(d.watchdog);
 if(v2){
  assertNativeObserver(d.physicalObserver,d);assertNativeObserverPlacement(d.placement,d.launch);
  if(d.launchTagPolicy!==NATIVE_OBSERVER_TAG_POLICY||d.watchdog?.input.schema!=='meri-native-watchdog-input/2'||
   hash(d.watchdog.input.physicalObserver)!==hash(d.physicalObserver)||
   hash(d.watchdog.input.placement)!==hash(d.placement)||hash(d.watchdog.input.launch)!==hash(d.launch)||
   d.watchdog.leaseDeadlineMs!==d.leaseDeadlineMs)fail();
  const i=d.watchdog.input;
  for(const [ik,dk] of [['provisionToken','token'],['accountId','accountId'],['region','region'],['imageDigest','imageDigest'],
   ['sourceCommit','sourceCommit'],['bootstrapSha256','bootstrapSha256'],['nativeHelperSha256','nativeHelperSha256']])
   if(i[ik]!==d[dk])fail();
  if(i.controlPolicySha256!==bootstrapSpec.control.policySha256||
   !d.watchdog.executionArn.includes(`:${d.accountId}:execution:`)||
   !d.watchdog.stateMachineVersionArn.includes(`:${d.accountId}:stateMachine:`)||
   d.watchdog.executionArn.split(':').at(-1)!==i.executionName)fail();
 }else if(d.physicalObserver!==undefined||d.launchTagPolicy!==undefined||d.watchdog?.input.schema==='meri-native-watchdog-input/2')fail();
 let p,l;try{p=own(data(d.placement),['availabilityZone','subnetId','securityGroupIds','iamInstanceProfile',...(v2?['vpcId']:[])]);
  l=own(data(d.launch),['ImageId','InstanceType','SubnetId','SecurityGroupIds','IamInstanceProfile']);}catch{fail();}
 if(typeof p.availabilityZone!=='string'||!/^[a-z]{2}-[a-z]+-1[a-z]$/u.test(p.availabilityZone)||
  !/^subnet-[0-9a-f]{8,17}$/u.test(p.subnetId)||!Array.isArray(p.securityGroupIds)||p.securityGroupIds.length===0||
  p.securityGroupIds.some(id=>!/^sg-[0-9a-f]{8,17}$/u.test(id))||typeof p.iamInstanceProfile!=='string'||!p.iamInstanceProfile||
  typeof l.ImageId!=='string'||!/^ami-[0-9a-f]{8,17}$/u.test(l.ImageId)||typeof l.InstanceType!=='string'||
  !Array.isArray(l.SecurityGroupIds)||typeof l.IamInstanceProfile!=='object'||l.IamInstanceProfile===null||
  Object.keys(l.IamInstanceProfile).length!==1||!['Name','Arn'].includes(Object.keys(l.IamInstanceProfile)[0]))fail();
 if(d.tags===null||typeof d.tags!=='object'||Array.isArray(d.tags)||
  Object.entries(d.tags).some(([k,v])=>typeof k!=='string'||k===''||typeof v!=='string'))fail();
 // Placement and launch are the SAME intent, not two independent option bags.
 if(l.SubnetId!==p.subnetId||JSON.stringify([...l.SecurityGroupIds].sort())!==JSON.stringify([...p.securityGroupIds].sort())||
  l.IamInstanceProfile.Name!==p.iamInstanceProfile||d.tags.MeriProvisionToken!==d.token)fail();
 const bound=Buffer.byteLength(JSON.stringify(d),'utf8');
 if(bound>16384)fail();
 return Object.freeze({...d,placement:Object.freeze({...p,securityGroupIds:Object.freeze([...p.securityGroupIds])}),
  launch:Object.freeze({...l,SecurityGroupIds:Object.freeze([...l.SecurityGroupIds]),IamInstanceProfile:Object.freeze({...l.IamInstanceProfile})}),
  tags:Object.freeze({...d.tags}),bootstrapSpec});
}


/** ONE authority contract: the callback runs on the CALLER'S transaction and returns at least
 * {currentUntilMs}, optionally the same allocation/binding. Missing, refused, stale or mismatched answers
 * grant nothing. No effect is dispatched in this function. */
export async function requireCurrentNativeAuthority(fn,client,{allocation,binding,signal,now=Date.now}){
 if(typeof fn!=='function')fail();
 if(typeof now!=='function')fail();
 const value=own(data(await fn(client,{allocation,binding,originalBinding:binding,signal,
  leaseDeadlineMs:allocation.leaseDeadlineMs})),['currentUntilMs','allocation','binding']);
 if(hash(value.allocation)!==hash(allocation))fail();
 if(hash(value.binding)!==hash(binding))fail();
 if(!Number.isSafeInteger(value.currentUntilMs)||value.currentUntilMs<=now()||
  value.currentUntilMs>allocation.leaseDeadlineMs||now()>=allocation.leaseDeadlineMs)fail();
 return value;
}

function rowReservation(row){
 const allocation=assertNativeHostAllocation(row.allocation_json);
 const originalBinding=assertHostRunBindingPin(allocation,row.original_binding_json);
 if(allocation.hostMode!==PURPOSE||row.declaration_sha256!==hash(row.declaration_json))fail();
 const declaration=assertNativeDeclaration(row.declaration_json);
 assertNativeObserverAllocationJoin(allocation,declaration);
 const observed=row.observed_instance_json===null||row.observed_instance_json===undefined?null:
  own(data(row.observed_instance_json),['instanceId','privateIp']);
 if(observed!==null&&(typeof observed.instanceId!=='string'||!INSTANCE.test(observed.instanceId)||
  (observed.privateIp!==null&&typeof observed.privateIp!=='string')))fail();
 const snapshot={step:null};
 const op=step=>{const v=row[`bootstrap_${step}_json`];if(v===null||v===undefined)return null;
  const o=own(data(v),['step','dispatchId','requestSha256','request','state','commandId','observation']);
  if(o.step!==step||!HEX64.test(o.dispatchId)||!HEX64.test(o.requestSha256)||
   !['reserved','dispatching','unknown','succeeded','failed'].includes(o.state))fail();return o;};
 return Object.freeze({allocation,originalBinding,ownerInstanceId:row.owner_instance_id,
  declaration,declarationSha256:row.declaration_sha256,state:row.state,observedInstance:observed===null?null:Object.freeze(observed),
  bootstrap:Object.freeze({prepare:op('prepare'),install:op('install')})});
}

export function assertNativeObserverAllocationJoin(allocation,declaration){
 if(declaration.schema!==NATIVE_DECLARATION_V2)return;
 const i=declaration.watchdog.input;
 if(i.hostId!==allocation.hostId||i.generation!==allocation.generation||i.allocationSha256!==hash(allocation)||
  i.imageDigest!==allocation.imageDigest||i.leaseDeadlineMs!==allocation.leaseDeadlineMs||allocation.hostMode!==PURPOSE)fail();
}

/** Require the canonical successful prepare+install bootstrap custody before native activation. */
export function assertNativeBootstrapAdmission({row,record}){
 const reservation=rowReservation(row);
 const op=step=>step==='prepare'?row.bootstrap_prepare_json:row.bootstrap_install_json;
 const prepare=op('prepare'),install=op('install');
 if(prepare===null||prepare===undefined||install===null||install===undefined )fail();
 const p=own(data(prepare),['step','dispatchId','requestSha256','request','state','commandId','observation']);
 const i=own(data(install),['step','dispatchId','requestSha256','request','state','commandId','observation']);
 if(p.step!=='prepare'||i.step!=='install'||p.state!=='succeeded'||i.state!=='succeeded'||
  p.commandId===null||p.observation===null||i.commandId===null||i.observation===null )fail();
 if(hash(p.request)!==p.requestSha256||hash(i.request)!==i.requestSha256||
  typeof p.commandId!=='string'||!p.commandId||p.commandId.length>256||
  typeof i.commandId!=='string'||!i.commandId||i.commandId.length>256)fail();
 const preq=assertNativeBootstrapRequest(p.request,{reservation,step:'prepare'});
 const pObs=assertNativeBootstrapObservation(p.observation,{request:preq});
 const ireq=assertNativeBootstrapRequest(i.request,{reservation,step:'install'});
 const iObs=assertNativeBootstrapObservation(i.observation,{request:ireq,prepareObservation:pObs});
 if(pObs.requestSha256!==p.requestSha256||iObs.requestSha256!==i.requestSha256||
  preq.payload.operationId!==p.dispatchId||ireq.payload.operationId!==i.dispatchId||
  pObs.operationId!==p.dispatchId||iObs.operationId!==i.dispatchId||
  p.dispatchId!==nativeBootstrapOperationId({hostId:reservation.allocation.hostId,
   generation:reservation.allocation.generation,step:'prepare'})||
  i.dispatchId!==nativeBootstrapOperationId({hostId:reservation.allocation.hostId,
   generation:reservation.allocation.generation,step:'install'})||
  ireq.payload.prepareOperationId!==p.dispatchId||
  ireq.payload.prepareRequestSha256!==p.requestSha256||
  ireq.payload.prepareObservationSha256!==hash(p.observation)||
  iObs.prepareOperationId!==p.dispatchId||iObs.prepareRequestSha256!==p.requestSha256||
  iObs.prepareObservationSha256!==hash(p.observation))fail();
 if(iObs.scope.endpoint.address!==record.endpoint.address||iObs.scope.endpoint.port!==record.endpoint.port||
  iObs.scope.endpoint.serverName!==record.endpoint.serverName||
  iObs.scope.endpoint.port!==reservation.declaration.bootstrapSpec.hostEndpoint.port||
  iObs.scope.endpoint.serverName!==reservation.declaration.bootstrapSpec.hostEndpoint.serverName)fail();
 if(pObs.bootId!==iObs.bootId||iObs.bootId!==record.hostIdentity.bootId||
  iObs.hostCertificateSha256!==record.hostCertificate.fingerprintSha256||
  iObs.serverCertificateSha256!==record.endpoint.serverFingerprintSha256||
  iObs.scope.instanceId!==record.hostIdentity.instanceId||
  iObs.scope.ownerInstanceId!==record.ownerInstanceId||
  iObs.scope.declarationSha256!==reservation.declarationSha256 )fail();
 return Object.freeze({prepare:p,install:i,prepareObservation:pObs,installObservation:iObs});
}

export function createNativeReservationOwner({pool,now=Date.now,readCurrentAuthority}={}){
 const authorityRequired=()=>{if(typeof readCurrentAuthority!=='function')fail();};
 const check=signal=>()=>{if(signal?.aborted)fail();};
 const tx=(signal,work,guard={until:null})=>transact(pool,async client=>{
  const iso=(await client.query('SHOW transaction_isolation')).rows?.[0]?.transaction_isolation;
  if(iso!=='read committed')fail();
  return work(client);
 },{check:()=>{if(signal?.aborted)fail();
   if(guard.until!==null&&now()>=guard.until)fail();
   if(guard.minRemainingMs!==undefined&&guard.leaseDeadlineMs-now()<guard.minRemainingMs)fail();},
 unavailable:'BROWSER_HOST_ALLOCATION_REFUSED',uncertain:'BROWSER_HOST_ALLOCATION_UNKNOWN'});
 async function locked(client,hostId,generation){
  const r=(await client.query('SELECT * FROM meri_host_control.host_allocations WHERE host_id=$1 AND generation=$2 FOR UPDATE',
   [hostId,generation])).rows;
  if(!Array.isArray(r)||r.length!==1)fail();return r[0];
 }
 async function conflicts(client,tenantId,conversationId){
  return (await client.query('SELECT * FROM meri_host_control.host_allocations WHERE tenant_id=$1 AND conversation_id=$2 '+
   "AND state<>'terminated' AND state<>'refused' FOR UPDATE",[tenantId,conversationId])).rows;
 }
 async function writeOp(client,step,hostId,generation,op){
  await client.query(step==='prepare'?NATIVE_RESERVATION_SQL.setPrepare:NATIVE_RESERVATION_SQL.setInstall,
   [hostId,generation,op]);
 }
 async function getOp(row,step){return step==='prepare'?row.bootstrap_prepare_json:row.bootstrap_install_json;}

 return Object.freeze({
  async reserveNativeHost(raw){
   const {allocation:rawAllocation,originalBinding:rawBinding,ownerInstanceId,declaration:rawDeclaration,signal}=
    own(raw,['allocation','originalBinding','ownerInstanceId','declaration'],['signal']);
   nativeSignal(signal);
   const allocation=assertNativeHostAllocation(rawAllocation),binding=assertHostRunBindingPin(allocation,rawBinding);
   if(typeof ownerInstanceId!=='string'||!UUID.test(ownerInstanceId))fail();
   const declaration=assertNativeDeclaration(rawDeclaration),sha=hash(declaration);
   assertNativeObserverAllocationJoin(allocation,declaration);
   const guard={until:null};
   if(allocation.imageDigest!==declaration.imageDigest||allocation.leaseDeadlineMs!==declaration.leaseDeadlineMs)fail();
   if(!Number.isSafeInteger(allocation.leaseDeadlineMs)||allocation.leaseDeadlineMs<=now())fail();
   return tx(signal,async client=>{
    await client.query('SELECT meri_host_control.lock_conversation_admission($1,$2)',[binding.tenantId,binding.conversationId]);
    authorityRequired();const authority=await requireCurrentNativeAuthority(readCurrentAuthority,client,{allocation,binding,signal,now});
    guard.until=Math.min(allocation.leaseDeadlineMs,authority.currentUntilMs);
    // Any existing exact key is authoritative even when it no longer appears in the nonterminal conflict scan
    // (refused/terminated tombstones). It is returned only for an exact immutable replay; never reinserted.
    const exactRows=(await client.query('SELECT * FROM meri_host_control.host_allocations WHERE host_id=$1 AND generation=$2 FOR UPDATE',
     [allocation.hostId,allocation.generation])).rows;
    if(exactRows.length===1){
     const row=exactRows[0];
     if(row.declaration_sha256!==sha||hash(row.declaration_json)!==sha||hash(row.allocation_json)!==hash(allocation)||
      hash(row.original_binding_json)!==hash(binding)||row.owner_instance_id!==ownerInstanceId||
      row.allocation_json?.imageDigest!==declaration.imageDigest||
      Number(row.allocation_json?.leaseDeadlineMs)!==allocation.leaseDeadlineMs)fail();
     if(row.state==='terminated'||row.state==='refused')fail();
     return rowReservation(row);
    }
    const rows=await conflicts(client,binding.tenantId,binding.conversationId);
    for(const row of rows){
     const purpose=row.allocation_json?.hostMode??'legacy';
     if(row.host_id===allocation.hostId&&Number(row.generation)===allocation.generation){
      if(row.declaration_sha256!==sha||hash(row.declaration_json)!==sha||hash(row.allocation_json)!==hash(allocation)||
       hash(row.original_binding_json)!==hash(binding)||row.owner_instance_id!==ownerInstanceId)fail();
      continue;
     }
     if(purpose==='legacy'||purpose===PURPOSE)fail();
    }
    const observer=declaration.schema===NATIVE_DECLARATION_V2;
    const physical=observer?physicalTriplet('context',initialPhysicalContexts({allocation,binding,declaration})):[];
    await client.query(observer?NATIVE_RESERVATION_SQL.reserveObserver:NATIVE_RESERVATION_SQL.reserve,
     [allocation.hostId,allocation.generation,binding.tenantId,binding.conversationId,allocation,hash(allocation),binding,
      ownerInstanceId,declaration,sha,allocation.leaseDeadlineMs,...physical]);
    return rowReservation(await locked(client,allocation.hostId,allocation.generation));
   },guard);
  },
  async claimNativeHostDispatch(raw){
   const {hostId,generation,declarationSha256,signal}=own(raw,['hostId','generation','declarationSha256'],['signal']);
   nativeSignal(signal);if(!UUID.test(hostId)||!Number.isSafeInteger(generation)||generation<1||!HEX64.test(declarationSha256))fail();
   const guard={until:null};
   return tx(signal,async client=>{
    authorityRequired();
    const head=(await client.query('SELECT * FROM meri_host_control.host_allocations WHERE host_id=$1 AND generation=$2',
     [hostId,generation])).rows;
    if(head.length!==1)fail();
    await client.query('SELECT meri_host_control.lock_conversation_admission($1,$2)',
     [head[0].tenant_id,head[0].conversation_id]);
    const row=await locked(client,hostId,generation);
    if(row.declaration_sha256!==declarationSha256)fail();
    const authority=await requireCurrentNativeAuthority(readCurrentAuthority,client,{allocation:assertNativeHostAllocation(row.allocation_json),
     binding:assertHostRunBindingPin(row.allocation_json,row.original_binding_json),signal,now});
    guard.until=Math.min(row.allocation_json.leaseDeadlineMs,authority.currentUntilMs);
    if(row.state==='reserved'){
     await client.query(NATIVE_RESERVATION_SQL.claimDispatch,[hostId,generation,declarationSha256,now()]);
     const fresh=await locked(client,hostId,generation);
     if(fresh.state!=='dispatching')empty();
     return Object.freeze({disposition:'send-once',reservation:rowReservation(fresh)});
    }
    if(row.declaration_sha256!==declarationSha256)fail();
    if(['dispatching','unknown','active','revoked','quarantined'].includes(row.state))
     return Object.freeze({disposition:'reconcile',reservation:rowReservation(row)});
    fail();
   },guard);
  },
  async recordNativeHostInstance(raw){
   const {hostId,generation,declarationSha256,instanceId,privateIp,signal}=
    own(raw,['hostId','generation','declarationSha256','instanceId','privateIp'],['signal']);
   nativeSignal(signal);
   if(!UUID.test(hostId)||!Number.isSafeInteger(generation)||!HEX64.test(declarationSha256)||!INSTANCE.test(instanceId))fail();
   if(privateIp!==null)try{privateAddress(privateIp);}catch{fail();}
   return tx(signal,async client=>{
    const row=await locked(client,hostId,generation);
    if(row.declaration_sha256!==declarationSha256)fail();
    if(row.state!=='dispatching'&&row.state!=='unknown')fail();
    if(row.observed_instance_json!==null&&row.observed_instance_json!==undefined){
     const o=own(data(row.observed_instance_json),['instanceId','privateIp']);
     if(o.instanceId!==instanceId)fail();
     if(o.privateIp===privateIp){return rowReservation(await locked(client,hostId,generation));}
     if(o.privateIp!==null||privateIp===null)fail();
     await client.query(NATIVE_RESERVATION_SQL.recordInstanceAddress,[hostId,generation,instanceId,privateIp,declarationSha256]);
    }else await client.query(NATIVE_RESERVATION_SQL.recordInstance,[hostId,generation,{instanceId,privateIp},declarationSha256]);
    return rowReservation(await locked(client,hostId,generation));
   });
  },
  async readNativeReservation(raw){
   const {hostId,generation,signal}=own(raw,['hostId','generation'],['signal']);nativeSignal(signal);
   if(!UUID.test(hostId)||!Number.isSafeInteger(generation)||generation<1)fail();
   return tx(signal,async client=>{
    const rows=(await client.query('SELECT * FROM meri_host_control.host_allocations WHERE host_id=$1 AND generation=$2 '+
     "AND allocation_json->>'hostMode'='native-processing'",[hostId,generation])).rows;
    if(rows.length===0)return null;if(rows.length!==1)fail();return rowReservation(rows[0]);
   });
  },
  async refuseNativeReservation(raw){
   const {hostId,generation,signal}=own(raw,['hostId','generation'],['signal']);nativeSignal(signal);
   return tx(signal,async client=>{
    const row=await locked(client,hostId,generation);
    if(row.state!=='reserved'||row.bootstrap_prepare_json!==null||row.bootstrap_install_json!==null)fail();
    if(row.observed_instance_json!==null&&row.observed_instance_json!==undefined)fail();
    await client.query(NATIVE_RESERVATION_SQL.refuse,[hostId,generation]);
    return rowReservation(await locked(client,hostId,generation));
   });
  },
  async reserveBootstrapOperation(raw){
   const {hostId,generation,step,request:rawRequest,signal}=own(raw,['hostId','generation','step','request'],['signal']);
   nativeSignal(signal);if(!STEPS.includes(step))fail();
   const guard={until:null};
   return tx(signal,async client=>{
    const head=(await client.query('SELECT * FROM meri_host_control.host_allocations WHERE host_id=$1 AND generation=$2',
     [hostId,generation])).rows;
    if(head.length!==1)fail();
    await client.query('SELECT meri_host_control.lock_conversation_admission($1,$2)',
     [head[0].tenant_id,head[0].conversation_id]);
    const row=await locked(client,hostId,generation);const res=rowReservation(row);
    if(!['dispatching','unknown','active'].includes(res.state))fail();
    authorityRequired();
    const authority=await requireCurrentNativeAuthority(readCurrentAuthority,client,
     {allocation:res.allocation,binding:res.originalBinding,signal,now});
    guard.until=Math.min(res.allocation.leaseDeadlineMs,authority.currentUntilMs);
    if(res.observedInstance===null)fail();
    const joined=assertNativeBootstrapRequest(rawRequest,{reservation:res,step});
    if(joined.scope.instanceId!==res.observedInstance.instanceId)fail();
    const request=joined.request,dispatchId=nativeBootstrapOperationId({hostId,generation,step}),requestSha256=hash(request);
    const existing=await getOp(row,step);
    if(existing!==null){const o=own(data(existing),['step','dispatchId','requestSha256','request','state','commandId','observation']);
     if(o.dispatchId!==dispatchId||o.requestSha256!==requestSha256||hash(o.request)!==hash(request))fail();return Object.freeze(o);}
    if(step==='install'){
     const p=res.bootstrap.prepare;
     if(p===null||p.state!=='succeeded'||p.observation===null) fail();
     const q=joined.payload;
     if(q.prepareOperationId!==p.dispatchId||q.prepareRequestSha256!==p.requestSha256||
      q.prepareObservationSha256!==hash(p.observation)||q.bootId!==p.observation.bootId||
      q.scope.instanceId!==p.observation.scope.instanceId||hash(q.scope)!==hash(p.observation.scope)||
      hash(q.bootstrapSpec)!==hash(res.declaration.bootstrapSpec)) fail();
    }
    const op=Object.freeze({step,dispatchId,requestSha256,request,state:'reserved',commandId:null,observation:null});
    await writeOp(client,step,hostId,generation,op);return op;
   },guard);
  },
  async claimBootstrapDispatch(raw){
   const {hostId,generation,step,requestSha256,signal}=own(raw,['hostId','generation','step','requestSha256'],['signal']);
   nativeSignal(signal);if(!STEPS.includes(step))fail();
   const guard={until:null};
   return tx(signal,async client=>{
    const head=(await client.query('SELECT * FROM meri_host_control.host_allocations WHERE host_id=$1 AND generation=$2',
     [hostId,generation])).rows;
    if(head.length!==1)fail();
    await client.query('SELECT meri_host_control.lock_conversation_admission($1,$2)',
     [head[0].tenant_id,head[0].conversation_id]);
    const row=await locked(client,hostId,generation);const res=rowReservation(row);
    if(res.allocation.leaseDeadlineMs-now()<30000)fail();
    authorityRequired();
    const authority=await requireCurrentNativeAuthority(readCurrentAuthority,client,
     {allocation:res.allocation,binding:res.originalBinding,signal,now});
    guard.until=Math.min(res.allocation.leaseDeadlineMs,authority.currentUntilMs);
    guard.minRemainingMs=30000;guard.leaseDeadlineMs=res.allocation.leaseDeadlineMs;
    const existing=await getOp(row,step);
    if(existing===null)fail();const o=own(data(existing),['step','dispatchId','requestSha256','request','state','commandId','observation']);
    if(o.requestSha256!==requestSha256)fail();
    if(o.state==='reserved'){const next=Object.freeze({...o,state:'dispatching'});
     await writeOp(client,step,hostId,generation,next);
     return Object.freeze({disposition:'send-once',operation:next});}
    return Object.freeze({disposition:'reconcile',operation:Object.freeze(o)});
   },guard);
  },
  async recordBootstrapCommand(raw){
   const {hostId,generation,step,dispatchId,requestSha256,commandId,signal}=
    own(raw,['hostId','generation','step','dispatchId','requestSha256','commandId'],['signal']);
   nativeSignal(signal);if(!STEPS.includes(step))fail();
   return tx(signal,async client=>{
    const row=await locked(client,hostId,generation);const existing=await getOp(row,step);
    if(existing===null)fail();const o=own(data(existing),['step','dispatchId','requestSha256','request','state','commandId','observation']);
    if(o.dispatchId!==dispatchId||o.requestSha256!==requestSha256||typeof commandId!=='string'||!commandId) fail();
    if(o.commandId!==null){if(o.commandId!==commandId)fail();return Object.freeze(o);}
    if(!['dispatching','unknown'].includes(o.state)) fail();
    const next=Object.freeze({...o,commandId});await writeOp(client,step,hostId,generation,next);return next;
   });
  },
  async readBootstrapOperation(raw){
   const {hostId,generation,step,signal}=own(raw,['hostId','generation','step'],['signal']);nativeSignal(signal);
   if(!STEPS.includes(step))fail();
   return tx(signal,async client=>{const row=await locked(client,hostId,generation);return getOp(row,step);});
  },
  async recordBootstrapObservation(raw){
   const {hostId,generation,step,dispatchId,requestSha256,commandId,observation:rawObservation,signal}=
    own(raw,['hostId','generation','step','dispatchId','requestSha256','commandId','observation'],['signal']);
   nativeSignal(signal);if(!STEPS.includes(step))fail();
   return tx(signal,async client=>{
    const row=await locked(client,hostId,generation);const existing=await getOp(row,step);
    if(existing===null)fail();const o=own(data(existing),['step','dispatchId','requestSha256','request','state','commandId','observation']);
    if(o.dispatchId!==dispatchId||o.requestSha256!==requestSha256||o.commandId!==commandId) fail();
    const prepare=step==='install'?row.bootstrap_prepare_json:undefined;
    const prepareObservation=step==='install'?prepare?.observation:undefined;
    const observation=assertNativeBootstrapObservation(rawObservation,{request:o.request,
     ...(step==='install'?{prepareObservation}:{})});
    if(o.observation!==null){if(hash(o.observation)!==hash(observation))fail();return Object.freeze(o);}
    if(o.commandId===null||o.commandId===undefined)fail();
    if(!['dispatching','unknown'].includes(o.state)) fail();
    const next=Object.freeze({...o,state:'succeeded',observation});await writeOp(client,step,hostId,generation,next);return next;
   });
  },

 });
}
