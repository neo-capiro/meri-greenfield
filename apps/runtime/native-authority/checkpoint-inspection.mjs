/** Current trusted control identity inspects retained proofs, independent of task leases. */
import {randomUUID} from 'node:crypto';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createNativeIdentityContext} from './identity-context.mjs';
import {verifyCheckpointReadback} from './checkpoint-readback.mjs';
const fault=()=>Error('NATIVE_CHECKPOINT_INSPECTION_REFUSED'),refuse=()=>{throw fault();};
export function createNativeCheckpointInspection(configuration){
 const c=own(configuration,['store','objects','identity','limits'],['enabled','now']),i=own(c.identity,['origin','credential','commandContext','fetchImpl']),context=data(i.commandContext),l=data(own(c.limits,['maxRequestMs','maxFactBytes'])),now=c.now??Date.now,enabled=c.enabled??false;
 own(context,['binding','clientResolution']);validateShape('RunBinding',context.binding);const binding=context.binding,readRun=storageMethod(c.store,'read'),readCheckpoint=storageMethod(c.store.lifecycle,'readCheckpoint'),objects={get:storageMethod(c.objects,'get')};
 if(typeof now!=='function'||typeof enabled!=='boolean'||typeof i.credential!=='string'||!/^\S{1,8192}$/u.test(i.credential)||!Number.isSafeInteger(l.maxRequestMs)||l.maxRequestMs<1||l.maxRequestMs>30000||!Number.isSafeInteger(l.maxFactBytes)||l.maxFactBytes<1||l.maxFactBytes>131072)refuse();
 return Object.freeze({async read(value){const raw=own(value,['binding','scopes','versions','checkpointId','expectedSha256'],['signal']),{signal,...rest}=raw,input=data(rest);nativeSignal(signal);
  if(!enabled||hash(input.binding)!==hash(binding)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(input.checkpointId)||!/^[a-f0-9]{64}$/u.test(input.expectedSha256))refuse();validateShape('RuntimeVersions',input.versions);
  let deadlineMs=now()+l.maxRequestMs,pinned,proofHash;const life=createOperationLifetime({now,signal,deadlineMs,errorFactory:fault});
  async function row(){const value=await life.run(()=>readRun(binding,{},life.check));life.check();if(hash(value.run.binding)!==hash(binding)||hash(value.run.scopes)!==hash(input.scopes)||hash(value.run.versions)!==hash(input.versions))refuse();return value;}
  const currentOwner={async currentRun(request,{signal}){if(hash(request)!==hash(binding))refuse();const saved=await row();if(signal.aborted)refuse();return JSON.stringify({binding,policyRevision:saved.run.policyRevision,deadlineMs,checkedAtMs:now()});}};
  let authority;try{authority=createNativeIdentityContext({origin:i.origin,commandContext:context,fetchImpl:i.fetchImpl,currentOwner,now,limits:l,enabled});}catch(error){life.close();throw error;}
  async function fresh(){const identity=await life.run(signal=>authority.verifyIdentity({credential:i.credential,signal,deadlineMs}));deadlineMs=Math.min(deadlineMs,identity.expiresAtMs);life.limitDeadline(deadlineMs);
   const resolved=await life.run(signal=>authority.resolveContext({identityCredential:i.credential,identity,identitySha256:hash(identity),hints:{conversationId:binding.conversationId,runId:binding.runId,clientId:context.clientResolution.clientId},signal,deadlineMs}));
   const current=data({principal:identity.principal,identityRevision:identity.identityRevision,binding:resolved.binding,scopes:resolved.scopes,selectedClientId:resolved.selectedClientId,contextRevision:resolved.contextRevision});
   if(hash(current.binding)!==hash(binding)||hash(current.scopes)!==hash(input.scopes)||current.selectedClientId!==context.clientResolution.clientId||pinned&&hash(current)!==hash(pinned))refuse();pinned??=current;deadlineMs=Math.min(deadlineMs,resolved.expiresAtMs);life.limitDeadline(deadlineMs);await row();life.check();return current;
  }
  async function proof(){await fresh();const loaded=await life.run(()=>readCheckpoint({binding,scopes:pinned.scopes,selectedClientId:pinned.selectedClientId,checkpointId:input.checkpointId},life.check)),p=data(own(loaded.proof,['checkpoint','checkpointSha256','sourceRequestSha256','contextSha256','resumeSessionAt','readReceiptId'])),saved=await row();
   if(p.checkpoint.checkpointId!==input.checkpointId||p.checkpointSha256!==input.expectedSha256||p.sourceRequestSha256!==hash(saved.request)||p.contextSha256!==hash({window:saved.request.window,skill:saved.request.skill,scopes:pinned.scopes})||hash(p.checkpoint.scopes)!==hash(pinned.scopes))refuse();if(proofHash&&proofHash!==hash(p))refuse();proofHash??=hash(p);await fresh();return p;
  }
  try{const retained=await proof();await verifyCheckpointReadback({proof:retained,binding,versions:input.versions,objects,life,revalidate:fresh});await proof();await fresh();life.check();return {...retained,readReceiptId:randomUUID()};}
  finally{life.close();}
 }});
}
