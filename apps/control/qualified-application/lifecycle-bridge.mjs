/** Fixed owner-only Python bridge. Import/construction never starts a process or connects. */
import {fixtureDescriptor} from './schema-contract.mjs';
import {spawn} from 'node:child_process';
import {isAbsolute,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import protocol from '../../../packages/contracts/qualification-assembly-0.2/protocol.json' with {type:'json'};
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {validateQualificationGrantSet} from '../../gateway/index.mjs';
import {assertQualificationWorkerObserver,consumeQualificationWorkerObservation,validateQualificationWorkerRequest} from '../../../infra/native-enforcement/worker-observer.mjs';
const entry=fileURLToPath(new URL('../../proxy/qualification/assembly/bridge.py',import.meta.url));
const root=fileURLToPath(new URL('../../../',import.meta.url));
const fail=()=>{throw Error('QUALIFICATION_LIFECYCLE_REFUSED');};
const positive=(x,max=Number.MAX_SAFE_INTEGER)=>{if(!Number.isSafeInteger(x)||x<1||x>max)fail();return x;};
const digest=x=>{if(typeof x!=='string'||!/^[0-9a-f]{64}$/.test(x))fail();return x;};
const fixtureInput=fixtureDescriptor;
/** Transport is fixed to one source-owned Python entry. It does not accept a spawn callback. */
function processFrame({pythonExecutable,frame,maxFrameBytes,maxCleanupMs,signal,processes}){
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(Error('QUALIFICATION_LIFECYCLE_UNKNOWN'));return;}
  let child,failed=false,stdout=[],bytes=0,errBytes=0,cleanup;
  const kill=()=>{if(child?.pid)try{process.kill(-child.pid,'SIGKILL');}catch{}};
  const bad=()=>{failed=true;kill();cleanup??=setTimeout(()=>{child?.stdin.destroy();child?.stdout.destroy();child?.stderr.destroy();reject(Error('QUALIFICATION_LIFECYCLE_UNKNOWN'));},maxCleanupMs);};
  const abort=()=>bad();
  try{
   child=spawn(pythonExecutable,['-I','-B',entry,'--stdio'],{cwd:root,env:{PATH:`${dirname(pythonExecutable)}:/usr/bin:/bin`,LANG:'C.UTF-8'},stdio:['pipe','pipe','pipe'],detached:true,shell:false});
   processes.add(child);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)bad();
   child.stdout.on('data',block=>{bytes+=block.length;if(bytes>maxFrameBytes)bad();else stdout.push(block);});
   // Never preserve native stderr: drivers may include connection/credential material.
   child.stderr.on('data',block=>{errBytes+=block.length;bad();});
   child.on('error',bad);child.stdin.on('error',bad);
   child.on('close',(code,termination)=>{
    processes.delete(child);clearTimeout(cleanup);signal.removeEventListener('abort',abort);
    if(failed||code!==0||termination||errBytes||!bytes){reject(Error('QUALIFICATION_LIFECYCLE_UNKNOWN'));return;}
    try{const raw=Buffer.concat(stdout);const text=new TextDecoder('utf-8',{fatal:true}).decode(raw);resolve(data(JSON.parse(text)));}catch{reject(Error('QUALIFICATION_LIFECYCLE_UNKNOWN'));}
   });
   child.stdin.end(frame);
  }catch{bad();if(!child){clearTimeout(cleanup);reject(Error('QUALIFICATION_LIFECYCLE_UNKNOWN'));}}
 });
}
function configurationInput(configuration,allowUnprepared){
 const c=own(configuration,['pythonExecutable','connection','fixture','allocationJson','grantFactsJsons','expiresAtMs','originalDeadlineMs','workerObserver','worker','now','limits']);
 if(typeof c.pythonExecutable!=='string'||!isAbsolute(c.pythonExecutable)||typeof c.now!=='function')fail();
 const original=positive(c.originalDeadlineMs),expiry=positive(c.expiresAtMs),l=data(own(c.limits,['maxRequestMs','maxFrameBytes','maxCleanupMs']));
 positive(l.maxRequestMs,30000);positive(l.maxFrameBytes,protocol.maxFrameBytes);positive(l.maxCleanupMs,5000);
 const fixture=fixtureInput(c.fixture,allowUnprepared),connection=data(own(c.connection,['host','port','dbname','user'],['password','sslmode','sslrootcert']));
 if(expiry>original||expiry<=c.now()||connection.host!==fixture.host||connection.port!==fixture.port||connection.dbname!==fixture.database||connection.user!==fixture.user||Object.entries(connection).some(([k,v])=>k!=='port'&&typeof v!=='string'))fail();
 const {allocation,facts}=validateQualificationGrantSet({allocationJson:c.allocationJson,grantFactsJsons:c.grantFactsJsons});
 if(expiry>Date.parse(allocation.schedule.expiresAt))fail();
 const observer=assertQualificationWorkerObserver(c.workerObserver),worker=data(own(c.worker,['probeKind','attemptStartMs','attemptEndMs']));
 const observed=validateQualificationWorkerRequest(observer,{...worker,qualificationBinding:facts[0].qualificationBinding});
 if(observed.attemptEndMs>c.now())fail();
 const admission=data({fixture,binding:facts[0].binding,qualificationBinding:facts[0].qualificationBinding,allocationSha256:canonicalSha256(allocation),grants:facts.map(f=>({grantId:f.grantId,capabilitySha256:f.capabilitySha256,expiresAtMs:expiry})),originalDeadlineMs:original}),admissionSha256=canonicalSha256(admission);
 return {c,original,expiry,l,fixture,connection,allocation,facts,observer,observed,admission,admissionSha256};
}
export function validateQualificationLifecycleConfiguration(configuration){
 const p=configurationInput(configuration,true);return data({schemaPrepared:p.fixture.schemaSha256!==null,allocationSha256:p.admission.allocationSha256,originalDeadlineMs:p.original});
}
export function createQualificationLifecycleBridge(configuration){
 const {c,original,expiry,l,connection,facts,observer,observed,admission,admissionSha256}=configurationInput(configuration,false);
 const processes=new Set(),pending=new Set();
 let phase='NEW',busy=false,lastEvidence=null;
 function lifetime(options){const o=own(options??{},[],['signal','deadlineMs']);nativeSignal(o.signal);const at=c.now();return {life:createOperationLifetime({deadlineMs:Math.min(original,expiry,at+l.maxRequestMs,o.deadlineMs===undefined?original:positive(o.deadlineMs)),now:c.now,signal:o.signal,errorFactory:()=>Error('QUALIFICATION_LIFECYCLE_UNKNOWN')}),cutoff:Math.min(original,expiry,at+l.maxRequestMs,o.deadlineMs??original)};}
 async function run(kind,options){
  if(busy||phase==='UNKNOWN'||phase==='REVOKED'||kind==='activate'&&phase!=='NEW')fail();
  const {life,cutoff}=lifetime(options);let operationCutoff=cutoff;busy=true;if(kind==='activate')phase='PREPARING';
  const check=()=>{life.check();if(life.signal.aborted)fail();};
  async function call(operation,grantId=null){
   check();const frame=JSON.stringify({schema:protocol.schema,operation,connection,admission,admissionSha256,deadlineMs:operationCutoff,grantId});
   if(Buffer.byteLength(frame)>l.maxFrameBytes)fail();
   const work=processFrame({pythonExecutable:c.pythonExecutable,frame,maxFrameBytes:l.maxFrameBytes,maxCleanupMs:l.maxCleanupMs,signal:life.signal,processes});pending.add(work);work.then(()=>pending.delete(work),()=>pending.delete(work));
   const raw=await life.run(()=>work);check();
   const result=data(own(raw,protocol.receiptFields));
   if(result.schema!==protocol.schema||result.operation!==operation||result.admissionSha256!==admissionSha256||result.grantId!==grantId||result.status!==({prepare:'PREPARED',activate:'ACTIVE',inspect:'ADMITTED',revoke:'REVOKED'})[operation])fail();
  }
  async function observe(){const token=await life.run(()=>observer.observe(observed,{signal:life.signal,deadlineMs:operationCutoff}));check();const receipt=consumeQualificationWorkerObservation(observer,token,observed,{now:c.now,signal:life.signal});operationCutoff=Math.min(operationCutoff,receipt.expiresAtMs);life.limitDeadline(operationCutoff);check();return receipt;}
  try{
   if(kind==='activate'){
    await call('prepare');phase='PENDING';
    for(const f of facts){lastEvidence=await observe();await call('activate',f.grantId);}
    await call('inspect');phase='ACTIVE';
   }else if(kind==='rehydrate'){lastEvidence=await observe();await call('inspect');phase='ACTIVE';}
   else{await call('revoke');phase='REVOKED';}
   check();return data({status:phase,admissionSha256,allocationSha256:admission.allocationSha256,grantIds:facts.map(f=>f.grantId),expiresAtMs:expiry,evidenceKind:lastEvidence?.evidenceKind??null});
  }catch{phase='UNKNOWN';throw Object.assign(Error('QUALIFICATION_LIFECYCLE_UNKNOWN'),{outcome:'UNKNOWN'});}finally{life.close();if(pending.size){let timer;await Promise.race([Promise.allSettled([...pending]),new Promise(resolve=>{timer=setTimeout(resolve,l.maxCleanupMs);})]);clearTimeout(timer);}busy=false;}
 }
 return Object.freeze({activate:options=>run('activate',options),rehydrate:options=>run('rehydrate',options),revoke:options=>run('revoke',options),status:()=>data({phase,busy,admissionSha256,originalDeadlineMs:original,ownedChildren:processes.size,physicalExitObserved:processes.size===0})});
}
