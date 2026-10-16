/** Secret-free sibling to worker authorization. Reads only existing admission/entry facts. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {NATIVE_READS_SCHEMA_VERSION as schemaVersion,nativeReadOperations,assertNativeReadConfiguration,nativeReadConfigurationSha256,assertNativeReadTaskAssertion,nativeReadFault} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {parseAdmittedGrantSet} from '../../gateway/budget/admitted-run-binding.mjs';
import {matchesCapability} from './task-verifier.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
const same=(a,b)=>hash(a)===hash(b),deny=()=>{throw nativeReadFault('ACCESS_DENIED');};
export function createReadTaskVerifier(configuration){
 const c=own(configuration,['allocationJson','grantFactsJsons','grantId','currentOwner','readCurrentEntry','taskArn','issuanceFactsSha256','runRequestSha256','scopes','approvedReads','expiresAtMs'],['enabled','now','maxRequestMs','signal']);nativeSignal(c.signal);
 const {allocation,facts}=parseAdmittedGrantSet(c),grant=facts.find(f=>f.grantId===c.grantId),config=assertNativeReadConfiguration(c.approvedReads),scopes=data(c.scopes),now=c.now??Date.now,enabled=c.enabled??false,maxRequestMs=c.maxRequestMs??3000;
 if(!grant||c.taskArn!==grant.qualificationBinding.workerArn||typeof c.readCurrentEntry!=='function'||types.isProxy(c.readCurrentEntry)||typeof now!=='function'||typeof enabled!=='boolean'||!Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<=now()||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3000)throw nativeReadFault('CONFIGURATION');
 const current=storageMethod(c.currentOwner,'currentTaskRun'),readEntry=c.readCurrentEntry,binding=grant.binding,policyRevision=grant.qualificationBinding.policyRevision,allocationSha256=hash(allocation),readConfigurationSha256=nativeReadConfigurationSha256(config);
 const base={schemaVersion,binding,runRequestSha256:c.runRequestSha256,grantId:grant.grantId,taskArn:c.taskArn,issuanceFactsSha256:c.issuanceFactsSha256,allocationSha256,scopes,policyRevision};
 // Validate trusted configuration through the same closed receiving schema before any IO.
 assertNativeReadTaskAssertion({...base,operation:nativeReadOperations[0],inputSha256:'0'.repeat(64),authorizationDecisionId:'0'.repeat(64),checkedAtMs:now(),expiresAtMs:c.expiresAtMs},{binding,operation:nativeReadOperations[0],inputSha256:'0'.repeat(64),started:0,now});
 async function verify(raw){let life;try{
  if(!enabled||!config.enabled)throw nativeReadFault('UNAVAILABLE');if(c.signal?.aborted)deny();
  const v=own(raw,['capability','binding','operation','inputSha256'],['signal','deadlineMs']);nativeSignal(v.signal);const requested=data(v.binding);validateShape('RunBinding',requested);
  if(!same(requested,binding)||!nativeReadOperations.includes(v.operation)||typeof v.inputSha256!=='string'||!/^[a-f0-9]{64}$/u.test(v.inputSha256)||!matchesCapability(v.capability,grant.capabilitySha256)||v.deadlineMs!==undefined&&!Number.isSafeInteger(v.deadlineMs))deny();
  const started=now(),operationCutoff=Math.min(v.deadlineMs??started+(v.operation.endsWith('/execute')?config.maxExecuteMs:3000),started+(v.operation.endsWith('/execute')?config.maxExecuteMs:3000));let expiresAtMs=Math.min(c.expiresAtMs,operationCutoff);
  life=createOperationLifetime({now,deadlineMs:Math.min(started+maxRequestMs,expiresAtMs),signal:c.signal||v.signal?AbortSignal.any([c.signal,v.signal].filter(Boolean)):undefined,errorFactory:()=>nativeReadFault('ACCESS_DENIED')});
  const limit=expiry=>{if(!Number.isSafeInteger(expiry)||expiry<=now())deny();expiresAtMs=Math.min(expiresAtMs,expiry);life.limitDeadline(expiresAtMs);};
  async function observe(){const began=now(),text=await life.run(signal=>current(binding,{signal}));if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>131072)deny();const row=data(JSON.parse(text));own(row,['binding','policyRevision','deadlineMs','checkedAtMs']);if(!same(row.binding,binding)||row.policyRevision!==policyRevision||!Number.isSafeInteger(row.checkedAtMs)||row.checkedAtMs<began||row.checkedAtMs>now())deny();limit(row.deadlineMs);
   const entryBegan=now(),entry=data(await life.run(signal=>readEntry({binding,signal,deadlineMs:expiresAtMs})));
   own(entry,['binding','runRequestSha256','grantId','taskArn','issuanceFactsSha256','allocationSha256','scopes','policyRevision','readConfigurationSha256','checkedAtMs','expiresAtMs']);
   const expected={...base};delete expected.schemaVersion;for(const [key,value] of Object.entries(expected))if(!same(entry[key],value))deny();
   if(entry.readConfigurationSha256!==readConfigurationSha256||!Number.isSafeInteger(entry.checkedAtMs)||entry.checkedAtMs<entryBegan||entry.checkedAtMs>now())deny();limit(entry.expiresAtMs);
  }
  await observe();await observe();life.check();const checkedAtMs=now();
  return assertNativeReadTaskAssertion({...base,operation:v.operation,inputSha256:v.inputSha256,authorizationDecisionId:hash({...base,operation:v.operation,inputSha256:v.inputSha256,readConfigurationSha256,checkedAtMs,expiresAtMs}),checkedAtMs,expiresAtMs},{binding,operation:v.operation,inputSha256:v.inputSha256,started,now});
 }catch{throw nativeReadFault(!enabled||!config.enabled?'UNAVAILABLE':'ACCESS_DENIED');}finally{life?.close();}}
 return Object.freeze({verify});
}
