/** Read-only occurrence receipt from the canonical conversation store. DISPATCHED names start evidence only. Run state, output
 * events and cursors are actual saved readback; this module publishes nothing and never starts/retries work. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {ProductError,asProductError} from '../product-access/errors.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {snapshotScheduledConversationOrigin} from './scheduled-conversation-currentness.mjs';

const fail=()=>{throw new ProductError('CONVERSATION_UNAVAILABLE');},same=(a,b)=>hash(a)===hash(b);
export function createScheduledConversationReceipts(configuration){
 let c,read,readRun,current,servable;
 try{
  c=own(configuration,['scheduleOwner','store','currentness','now'],['retention','maxRequestMs']);c.maxRequestMs??=10000;
  read=storageMethod(c.scheduleOwner,'readOccurrenceForConversation');readRun=storageMethod(c.store,'readOptional');current=storageMethod(c.currentness,'assertCurrent');
  servable=c.retention===undefined?null:storageMethod(c.retention,'assertServable');
  if(typeof c.now!=='function'||!Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>30000)fail();
 }catch{throw new ProductError('PRODUCT_CONFIGURATION');}
 return Object.freeze({async read(value){
  let life;
  try{
   const raw=own(value,['credential','principal','conversationId','scopes','deadlineMs'],['signal','after','limit']);nativeSignal(raw.signal);
   const {after=0,limit=100,...native}=raw;
   if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(native.deadlineMs))fail();
   native.principal=data(native.principal);native.scopes=data(native.scopes);
   const deadlineMs=Math.min(native.deadlineMs,c.now()+c.maxRequestMs);
   life=createOperationLifetime({now:c.now,deadlineMs,signal:native.signal,errorFactory:code=>new ProductError(code)});
   const authorize=()=>life.run(signal=>current({...native,signal,deadlineMs}));
   const origin=()=>life.run(()=>read({tenantId:native.principal.tenantId,conversationId:native.conversationId},life.check));
   await authorize();const first=await origin();if(first===null)throw new ProductError('CONVERSATION_NOT_FOUND');
   const r=snapshotScheduledConversationOrigin(first,native),b=r.effect.binding;
   if(servable)await life.run(()=>servable({tenantId:b.tenantId,kind:'conversation',subjectId:b.conversationId}));
   const saved=await life.run(()=>readRun(b,{after,limit},life.check));
   if(saved!==null){
    validateShape('Run',saved.run);
    if(!same(saved.run.binding,b)||!same(saved.run.scopes,native.scopes)||saved.request?.requestId!==r.effect.requestId||!Array.isArray(saved.events)||
     !Number.isSafeInteger(saved.lastSequence)||saved.lastSequence<1||!Number.isSafeInteger(saved.nextSequence)||saved.nextSequence<after||saved.nextSequence>saved.lastSequence||typeof saved.hasMore!=='boolean')fail();
    let cursor=after;for(const event of saved.events){validateShape('UIEvent',event);if(!same(event.binding,b)||!same(event.scopes,native.scopes)||event.sequence!==++cursor)fail();}
    if(cursor!==saved.nextSequence||saved.hasMore&&cursor>=saved.lastSequence||!saved.hasMore&&cursor!==saved.lastSequence||
     after===0&&(saved.events[0]?.eventId!==r.effect.eventId||saved.events[0]?.type!=='run.status'||saved.events[0]?.data.state!=='queued'))fail();
   }else if(after!==0||r.state==='DISPATCHED')fail();
   await authorize();const last=await origin();if(!same(first,last))fail();
   if(servable)await life.run(()=>servable({tenantId:b.tenantId,kind:'conversation',subjectId:b.conversationId}));
   life.check();
   return data({occurrenceKey:r.occurrenceKey,scheduleId:r.scheduleId,generation:r.occurrence.generation,dispatchState:r.state,binding:b,requestId:r.effect.requestId,workflowId:r.effect.workflowId,
    admitted:saved!==null,run:saved?.run??null,request:saved?.request??null,events:saved?.events??[],nextSequence:saved?.nextSequence??0,lastSequence:saved?.lastSequence??0,hasMore:saved?.hasMore??false});
  }catch(error){throw asProductError(error,'CONVERSATION_UNAVAILABLE');}finally{life?.close();}
 }});
}
