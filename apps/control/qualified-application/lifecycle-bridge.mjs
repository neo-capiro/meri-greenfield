/** Fixed owner-only Python bridge. Import/construction never starts a process or connects. */
import {spawn} from 'node:child_process';
import {isAbsolute,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import protocol from '../../../packages/contracts/qualification-assembly-0.2/protocol.json' with {type:'json'};
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {validateQualificationGrantSet} from '../../gateway/index.mjs';
import {assertQualificationWorkerObserver,consumeQualificationWorkerObservation} from '../../../infra/native-enforcement/worker-observer.mjs';
const entry=fileURLToPath(new URL('../../proxy/qualification/assembly/bridge.py',import.meta.url));
const root=fileURLToPath(new URL('../../../',import.meta.url));
const fail=()=>{throw Error('QUALIFICATION_LIFECYCLE_REFUSED');};
const positive=(x,max=Number.MAX_SAFE_INTEGER)=>{if(!Number.isSafeInteger(x)||x<1||x>max)fail();return x;};
const digest=x=>{if(typeof x!=='string'||!/^[0-9a-f]{64}$/.test(x))fail();return x;};
function fixtureInput(value){
 const f=data(own(value,['mode','fixtureId','host','port','database','user','systemIdentifier','serverStartTime','serverVersion','schemaSha256']));
 if(f.mode!=='owned-disposable-qualification'||f.host!=='127.0.0.1'||f.database!=='meri_qualification_test'||f.user!=='qualification_owner'||!/^\d{1,20}$/.test(f.systemIdentifier)||!/^\d{6}$/.test(f.serverVersion)||!Number.isSafeInteger(Date.parse(f.serverStartTime))||new Date(f.serverStartTime).toISOString()!==f.serverStartTime||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/).test(f.fixtureId))fail();
 positive(f.port,65535);digest(f.schemaSha256);return f;
}
/** Transport is fixed to one source-owned Python entry. It does not accept a spawn callback. */
function processFrame({pythonExecutable,frame,maxFrameBytes,maxCleanupMs,signal}){
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(Error('QUALIFICATION_LIFECYCLE_UNKNOWN'));return;}
  let child,failed=false,stdout=[],bytes=0,errBytes=0,cleanup;
  const kill=()=>{if(child?.pid)try{process.kill(-child.pid,'SIGKILL');}catch{}};
  const bad=()=>{failed=true;kill();cleanup??=setTimeout(()=>{child?.stdin.destroy();child?.stdout.destroy();child?.stderr.destroy();reject(Error('QUALIFICATION_LIFECYCLE_UNKNOWN'));},maxCleanupMs);};
  const abort=()=>bad();
  try{
   child=spawn(pythonExecutable,['-I','-B',entry,'--stdio'],{cwd:root,env:{PATH:`${dirname(pythonExecutable)}:/usr/bin:/bin`,LANG:'C.UTF-8'},stdio:['pipe','pipe','pipe'],detached:true,shell:false});
   signal.addEventListener('abort',abort,{once:true});if(signal.aborted)bad();
   child.stdout.on('data',block=>{bytes+=block.length;if(bytes>maxFrameBytes)bad();else stdout.push(block);});
   // Never preserve native stderr: drivers may include connection/credential material.
   child.stderr.on('data',block=>{errBytes+=block.length;bad();});
   child.on('error',bad);child.stdin.on('error',bad);
   child.on('close',(code,termination)=>{
    clearTimeout(cleanup);signal.removeEventListener('abort',abort);
    if(failed||code!==0||termination||errBytes||!bytes){reject(Error('QUALIFICATION_LIFECYCLE_UNKNOWN'));return;}
    try{const raw=Buffer.concat(stdout);const text=new TextDecoder('utf-8',{fatal:true}).decode(raw);resolve(data(JSON.parse(text)));}catch{reject(Error('QUALIFICATION_LIFECYCLE_UNKNOWN'));}
   });
   child.stdin.end(frame);
  }catch{bad();if(!child){clearTimeout(cleanup);reject(Error('QUALIFICATION_LIFECYCLE_UNKNOWN'));}}
 });
}
export function createQualificationLifecycleBridge(configuration){
 const c=own(configuration,['pythonExecutable','connection','fixture','allocationJson','grantFactsJsons','expiresAtMs','originalDeadlineMs','workerObserver','worker','now','limits']);
 if(typeof c.pythonExecutable!=='string'||!isAbsolute(c.pythonExecutable)||typeof c.now!=='function')fail();
 const original=positive(c.originalDeadlineMs),expiry=positive(c.expiresAtMs),l=data(own(c.limits,['maxRequestMs','maxFrameBytes','maxCleanupMs']));
 positive(l.maxRequestMs,30000);positive(l.maxFrameBytes,protocol.maxFrameBytes);positive(l.maxCleanupMs,5000);
 const fixture=fixtureInput(c.fixture),connection=data(own(c.connection,['host','port','dbname','user'],['password','sslmode','sslrootcert']));
 if(expiry>original||expiry<=c.now()||connection.host!==fixture.host||connection.port!==fixture.port||connection.dbname!==fixture.database||connection.user!==fixture.user||Object.entries(connection).some(([k,v])=>k!=='port'&&typeof v!=='string'))fail();
 const {allocation,facts}=validateQualificationGrantSet({allocationJson:c.allocationJson,grantFactsJsons:c.grantFactsJsons});
 if(expiry>Date.parse(allocation.schedule.expiresAt))fail();
 const observer=assertQualificationWorkerObserver(c.workerObserver),worker=data(own(c.worker,['probeKind','attemptStartMs','attemptEndMs']));
 const observed=data({...worker,qualificationBinding:facts[0].qualificationBinding});
 const admission=data({fixture,binding:facts[0].binding,qualificationBinding:facts[0].qualificationBinding,allocationSha256:canonicalSha256(allocation),grants:facts.map(f=>({grantId:f.grantId,capabilitySha256:f.capabilitySha256,expiresAtMs:expiry})),originalDeadlineMs:original}),admissionSha256=canonicalSha256(admission);
 let phase='NEW',busy=false,lastEvidence=null;
 function lifetime(options){const o=own(options??{},[],['signal','deadlineMs']);nativeSignal(o.signal);const at=c.now();return {life:createOperationLifetime({deadlineMs:Math.min(original,expiry,at+l.maxRequestMs,o.deadlineMs===undefined?original:positive(o.deadlineMs)),now:c.now,signal:o.signal,errorFactory:()=>Error('QUALIFICATION_LIFECYCLE_UNKNOWN')}),cutoff:Math.min(original,expiry,at+l.maxRequestMs,o.deadlineMs??original)};}
 async function run(kind,options){
  if(busy||phase==='UNKNOWN'||phase==='REVOKED'||kind==='activate'&&phase!=='NEW')fail();
  const {life,cutoff}=lifetime(options);busy=true;if(kind==='activate')phase='PREPARING';
  const check=()=>{life.check();if(life.signal.aborted)fail();};
  async function call(operation,grantId=null){
   check();const frame=JSON.stringify({schema:protocol.schema,operation,connection,admission,admissionSha256,deadlineMs:cutoff,grantId});
   if(Buffer.byteLength(frame)>l.maxFrameBytes)fail();
   const raw=await life.run(()=>processFrame({pythonExecutable:c.pythonExecutable,frame,maxFrameBytes:l.maxFrameBytes,maxCleanupMs:l.maxCleanupMs,signal:life.signal}));check();
   const result=data(own(raw,protocol.receiptFields));
   if(result.schema!==protocol.schema||result.operation!==operation||result.admissionSha256!==admissionSha256||result.grantId!==grantId||result.status!==({prepare:'PREPARED',activate:'ACTIVE',inspect:'ADMITTED',revoke:'REVOKED'})[operation])fail();
  }
  async function observe(){const token=await life.run(()=>observer.observe(observed,{signal:life.signal,deadlineMs:cutoff}));check();return consumeQualificationWorkerObservation(observer,token,observed,{now:c.now,signal:life.signal});}
  try{
   if(kind==='activate'){
    await call('prepare');phase='PENDING';
    for(const f of facts){lastEvidence=await observe();await call('activate',f.grantId);}
    await call('inspect');phase='ACTIVE';
   }else if(kind==='rehydrate'){lastEvidence=await observe();await call('inspect');phase='ACTIVE';}
   else{await call('revoke');phase='REVOKED';}
   check();return data({status:phase,admissionSha256,allocationSha256:admission.allocationSha256,grantIds:facts.map(f=>f.grantId),expiresAtMs:expiry,evidenceKind:lastEvidence?.evidenceKind??null});
  }catch{phase='UNKNOWN';throw Object.assign(Error('QUALIFICATION_LIFECYCLE_UNKNOWN'),{outcome:'UNKNOWN'});}finally{busy=false;life.close();}
 }
 return Object.freeze({activate:options=>run('activate',options),rehydrate:options=>run('rehydrate',options),revoke:options=>run('revoke',options),status:()=>data({phase,busy,admissionSha256,originalDeadlineMs:original})});
}
