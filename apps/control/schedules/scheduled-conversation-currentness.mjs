/** Native read permission for the original owner's deterministic Meri inbox item. Positive immutable occurrence custody selects
 * this path; absent custody delegates to the existing Core conversation owner. This authorizes no execution or unattended grant. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {ProductError,asProductError} from '../product-access/errors.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {snapshotScheduledJobSelection} from './scheduled-job-lineage.mjs';

export const SCHEDULED_MERI_INBOX_DESTINATION='meri-inbox';
const fail=()=>{throw new ProductError('CONVERSATION_UNAVAILABLE');},same=(a,b)=>hash(a)===hash(b);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;

/** Validate the existing read-facet's complete custody, including a rehashed but foreign effect. Also used by the receipt reader. */
export function snapshotScheduledConversationOrigin(raw,{principal,conversationId,scopes}){
 const r=data(own(raw,['occurrenceKey','scheduleId','occurrence','effect','effectSha256','state']));
 const {occurrence,effect,identity}=snapshotScheduledJobSelection({occurrence:r.occurrence,effect:r.effect}),p=occurrence.projection;
 if(!['OPEN','DISPATCHED','REFUSED'].includes(r.state)||r.effectSha256!==hash(effect)||r.occurrenceKey!==identity.occurrenceKey||r.scheduleId!==p.scheduleId||
  p.destinationId!==SCHEDULED_MERI_INBOX_DESTINATION||!same(p.owner,{tenantId:principal.tenantId,actorId:principal.actorId})||
  effect.binding.conversationId!==conversationId||!same(p.scopes,scopes)||!Array.isArray(principal.clientIds)||
  !scopes.some(s=>s.kind==='client')||scopes.some(s=>s.tenantId!==principal.tenantId||s.kind==='client'&&!principal.clientIds.includes(s.resourceId)))fail();
 return r;
}

export function createScheduledConversationCurrentness(configuration){
 let c,read,recheck,core;
 try{
  c=own(configuration,['scheduleOwner','gate','core','now'],['maxRequestMs']);
  read=storageMethod(c.scheduleOwner,'readOccurrenceForConversation');recheck=storageMethod(c.gate,'recheck');core=storageMethod(c.core,'assertCurrent');
  c.maxRequestMs??=10000;
  if(typeof c.now!=='function'||!Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>30000)fail();
 }catch{throw new ProductError('PRODUCT_CONFIGURATION');}
 return Object.freeze({async assertCurrent(value){
  let life;
  try{
   const call=own(value,['credential','principal','conversationId','scopes','deadlineMs'],['signal']);nativeSignal(call.signal);
   const principal=data(own(call.principal,['tenantId','actorId','clientIds'],['role','permissions','membershipRevision'])),scopes=data(call.scopes);
   validateShape('Identity',{tenantId:principal.tenantId,actorId:principal.actorId});
   if(typeof call.credential!=='string'||!call.credential||call.credential.length>8192||typeof call.conversationId!=='string'||!uuid.test(call.conversationId)||!Array.isArray(scopes)||!scopes.length||scopes.length>100||!Number.isSafeInteger(call.deadlineMs))fail();
   scopes.forEach(s=>validateShape('Scope',s));
   const deadlineMs=Math.min(call.deadlineMs,c.now()+c.maxRequestMs),native={credential:call.credential,principal,deadlineMs};
   life=createOperationLifetime({now:c.now,deadlineMs,signal:call.signal,errorFactory:code=>new ProductError(code)});
   const member=async()=>{const result=await life.run(signal=>recheck({...native,signal}));if(!same(result,principal))fail();};
   const origin=()=>life.run(()=>read({tenantId:principal.tenantId,conversationId:call.conversationId},life.check));
   await member();const first=await origin();
   if(first===null)await life.run(signal=>core({...call,principal,scopes,signal,deadlineMs}));
   else snapshotScheduledConversationOrigin(first,{principal,conversationId:call.conversationId,scopes});
   await member();const last=await origin();
   if(!same(first,last))fail();
   if(last!==null)snapshotScheduledConversationOrigin(last,{principal,conversationId:call.conversationId,scopes});
   life.check();
  }catch(error){throw asProductError(error,'CONVERSATION_UNAVAILABLE');}finally{life?.close();}
 }});
}
