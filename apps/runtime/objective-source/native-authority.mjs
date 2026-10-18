/** Fresh Objective read authority composed from the existing native identity /
 * selected-client bridge and canonical accepted-run owner. Fixed source and
 * identity configuration come from trusted control composition, never HTTP data.
 * The returned expiry belongs only to this read. It cannot extend execution,
 * issuance, admitted allocation or model/task leases. Custody enforces those
 * original bounds for active-source; historical reads remain distinct.
 */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertObjectiveReaderShape} from '../../../packages/contracts/objective-reader-2/validate.mjs';
import {readerLimits,readerPurposes} from '../../../packages/contracts/objective-reader-2/schema.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createNativeIdentityContext} from '../native-authority/identity-context.mjs';
import {assertObjectiveAcceptedRun,objectiveActiveStates,objectiveHistoricalStates,objectiveSourceUnavailable} from './projection.mjs';

const refuse=()=>{throw objectiveSourceUnavailable();};
const same=(a,b)=>hash(a)===hash(b);
const sourceOf=value=>{
 const source=data(own(value,['generationJobId','sourceAdmissionSha256','binding']));
 assertObjectiveReaderShape('Selector',{generationJobId:source.generationJobId,sourceAdmissionSha256:source.sourceAdmissionSha256});
 validateShape('RunBinding',source.binding);return source;
};
const statesFor=purpose=>purpose==='active-source'?objectiveActiveStates:purpose==='historical-source'?objectiveHistoricalStates:['completed'];

export function createObjectiveSourceNativeAuthority(configuration={}){
 let enabled=false,source,identity,readRun,now,maxRequestMs,maxFactBytes;
 try{
  const c=own(configuration,[],['source','acceptedRuns','identity','enabled','now','maxRequestMs','maxFactBytes']);
  // A disabled source does not inspect nested bindings or consult any clock/port.
  if(c.enabled===true){
   source=sourceOf(c.source);identity=own(c.identity,['origin','credential','commandContext','fetchImpl']);
   const commandContext=data(own(identity.commandContext,['binding','clientResolution']));
   own(commandContext.clientResolution,['reference','clientId']);
   assertObjectiveReaderShape('Binding',commandContext.binding);
   if(typeof identity.origin!=='string')refuse();const url=new URL(identity.origin);
   if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||
      !same(commandContext.binding,source.binding)||typeof identity.credential!=='string'||!/^\S{1,8192}$/u.test(identity.credential)||
      commandContext.clientResolution.reference!==commandContext.clientResolution.clientId||
      typeof commandContext.clientResolution.clientId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(commandContext.clientResolution.clientId))refuse();
   identity={origin:identity.origin,credential:identity.credential,commandContext,fetchImpl:storageMethod({fetchImpl:identity.fetchImpl},'fetchImpl')};
   readRun=storageMethod(c.acceptedRuns,'read');now=storageMethod({now:c.now??Date.now},'now');
   maxRequestMs=c.maxRequestMs??readerLimits.maxRequestMs;maxFactBytes=c.maxFactBytes??131072;
   if(!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>readerLimits.maxRequestMs||
      !Number.isSafeInteger(maxFactBytes)||maxFactBytes<1||maxFactBytes>131072)refuse();
   enabled=true;
  }
 }catch{enabled=false;}

 async function assertCurrent(value){
  let life;
  try{
   if(!enabled)refuse();
   const v=own(value,['purpose','source'],['signal']);nativeSignal(v.signal);
   if(typeof v.purpose!=='string'||!Object.hasOwn(readerPurposes,v.purpose)||!same(sourceOf(v.source),source))refuse();
   const began=now();if(!Number.isSafeInteger(began)||began<0)refuse();
   let previous=began;
   const clock=()=>{const at=now();if(!Number.isSafeInteger(at)||at<previous)refuse();previous=at;return at;};
   let deadlineMs=began+maxRequestMs,pinnedRun,pinnedNative;
   life=createOperationLifetime({now:clock,signal:v.signal,deadlineMs,errorFactory:objectiveSourceUnavailable});
   const limit=expiry=>{deadlineMs=Math.min(deadlineMs,expiry);life.limitDeadline(deadlineMs);};
   async function row(){
    const raw=data(await life.run(()=>readRun(source.binding,{},life.check)));life.check();
    const saved=assertObjectiveAcceptedRun({run:raw.run,request:raw.request});
    if(Buffer.byteLength(JSON.stringify(saved),'utf8')>maxFactBytes||!same(saved.run.binding,source.binding)||
       !statesFor(v.purpose).includes(saved.run.state)||pinnedRun&&!same(pinnedRun,saved))refuse();
    pinnedRun??=saved;return saved;
   }
   const currentOwner={async currentRun(binding,{signal}){
    if(!same(binding,source.binding))refuse();signal.throwIfAborted();
    const saved=await row();signal.throwIfAborted();
    return JSON.stringify({binding:source.binding,policyRevision:saved.run.policyRevision,deadlineMs,checkedAtMs:clock()});
   }};
   // Construct the actual native bridge per read; concurrent purposes cannot
   // share mutable deadlines, run snapshots or native receipt pins.
   const authority=createNativeIdentityContext({origin:identity.origin,commandContext:identity.commandContext,fetchImpl:identity.fetchImpl,currentOwner,now:clock,
    limits:{maxRequestMs,maxFactBytes},enabled:true});
   async function fresh(){
    const principal=await life.run(signal=>authority.verifyIdentity({credential:identity.credential,signal,deadlineMs}));limit(principal.expiresAtMs);
    const resolved=await life.run(signal=>authority.resolveContext({identityCredential:identity.credential,identity:principal,identitySha256:hash(principal),
     hints:{conversationId:source.binding.conversationId,runId:source.binding.runId,clientId:identity.commandContext.clientResolution.clientId},signal,deadlineMs}));
    limit(resolved.expiresAtMs);const saved=await row();
    const pin=data({principal:principal.principal,identityRevision:principal.identityRevision,binding:resolved.binding,scopes:resolved.scopes,
     selectedClientId:resolved.selectedClientId,contextRevision:resolved.contextRevision});
    if(!same(pin.binding,source.binding)||!same(pin.scopes,saved.run.scopes)||pin.selectedClientId!==identity.commandContext.clientResolution.clientId||
       pinnedNative&&!same(pinnedNative,pin))refuse();
    pinnedNative??=pin;life.check();
   }
   await row();await fresh();await fresh();await row();life.check();
   const checkedAtMs=clock();if(checkedAtMs<began||checkedAtMs>=deadlineMs)refuse();
   return data({binding:source.binding,clientId:pinnedNative.selectedClientId,checkedAtMs,expiresAtMs:deadlineMs});
  }catch{refuse();}finally{life?.close();}
 }
 return Object.freeze({available:()=>enabled,assertCurrent});
}
