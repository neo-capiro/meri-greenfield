/** Actual schedule/store/history/membership composition over the existing scripted SQL and Temporal boundaries. No server,
 * credentials, connection or provider execution. This proves source wiring and isolation, never live durability/policy. */
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {harness,createIntent,occurrence,NOW,projection} from './scheduled-dispatch-harness.mjs';
import {id} from '../../conversations/test/store-fixture.mjs';
import {snapshotOccurrence,occurrenceIdentity} from '../scheduled-occurrence.mjs';
import {createMembershipGate} from '../../product-access/membership.mjs';
import {createConversationHistoryService} from '../../conversations/history/service.mjs';
import {createConversationHistoryApplication} from '../../conversations/history/http.mjs';
import {createScheduledConversationCurrentness,SCHEDULED_MERI_INBOX_DESTINATION} from '../scheduled-conversation-currentness.mjs';
import {createScheduledConversationReceipts} from '../scheduled-conversation-receipt.mjs';

export async function scheduledConversationFixture({dispatch=true,destinationId=SCHEDULED_MERI_INBOX_DESTINATION}={}){
 const h=harness(),p=projection({destinationId,scopes:[{tenantId:'tenant-a',kind:'client',resourceId:id(91),policyRevision:'policy-a'}]}),o=occurrence({projection:p});
 const originalConnect=h.schedules.pool.connect,state={memberReads:0,nativeReads:0,coreReads:0,originReads:0,denied:false,retained:true,coreDenied:false,originHook:null,membershipHook:null,readHook:null};
 h.schedules.pool.connect=async()=>{const c=await originalConnect();return {...c,async query(sql,args){
  if(sql.startsWith('SELECT tenant_id,generation,occurrence_key')){
   if(h.schedules.state.failNext&&sql.startsWith(h.schedules.state.failNext)){h.schedules.state.failNext=null;throw Error('synthetic store failure');}
   state.originReads++;await state.originHook?.();
   const rows=[...h.schedules.state.occurrences.values()].filter(r=>r.tenant_id===args[0]&&(sql.includes("effect->'binding'")?r.effect.binding.conversationId===args[1]:r.schedule_id===args[1]&&r.state==='OPEN'));
   return {rows:structuredClone(rows.slice(0,2))};
  }return c.query(sql,args);
 }};};
 const originalConversationConnect=h.conversations.pool.connect;
 h.conversations.pool.connect=async()=>{const c=await originalConversationConnect();return {...c,async query(sql,args){
  if(sql.startsWith('SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND owner_actor_id=$2'))return {rows:[...h.conversations.state.conversations.values()]
   .filter(r=>r.tenant_id===args[0]&&r.owner_actor_id===args[1]&&r.projection.scopes.every(s=>s.kind!=='client'||args[2].includes(s.resourceId)))
   .sort((a,b)=>b.projection.createdAt.localeCompare(a.projection.createdAt)||b.conversation_id.localeCompare(a.conversation_id))
   .filter(r=>args[3]===null||r.projection.createdAt<args[3]||r.projection.createdAt===args[3]&&r.conversation_id<args[4]).slice(0,args[5])};
  if(sql.startsWith('SELECT e.*')){
   const rows=[];for(const r of h.conversations.state.runs.values())if(r.tenant_id===args[0]&&r.conversation_id===args[1])for(const e of h.conversations.state.events.get([r.tenant_id,r.conversation_id,r.run_id].join(':'))??[])
    rows.push({...e,tenant_id:r.tenant_id,conversation_id:r.conversation_id,run_id:r.run_id,global:r.sequence_base+e.sequence});
   return {rows:rows.sort((a,b)=>a.global-b.global).filter(e=>e.global>args[2]).slice(0,args[3])};
  }
  if(sql.startsWith('SELECT * FROM meri_conversations.runs')&&state.readHook)await state.readHook();
  return c.query(sql,args);
 }};};
 await h.acknowledge({...createIntent(),projection:p});
 const identity=occurrenceIdentity(snapshotOccurrence(o));
 if(dispatch)await h.scheduled.dispatch({occurrence:o});
 const member={...p.owner,status:'active',role:'member',permissions:[],clientIds:[id(91)],membershipRevision:'m1'};
 const gate=createMembershipGate({now:()=>NOW,limits:{maxRequestMs:2000,maxFactBytes:65536},
  async verifyToken({credential}){state.nativeReads++;if(credential!=='native')throw Error('synthetic native refusal');return {...p.owner,checkedAtMs:NOW,expiresAtMs:NOW+30000};},
  async readMembership(){state.memberReads++;await state.membershipHook?.();return {...member,status:state.denied?'removed':member.status,checkedAtMs:NOW,expiresAtMs:NOW+30000};}});
 const principal=(await gate.admit({credential:'native',deadlineMs:NOW+30000})).principal;
 const core={async assertCurrent(){state.coreReads++;if(state.coreDenied)throw Error('synthetic Core refusal');}};
 const currentness=createScheduledConversationCurrentness({scheduleOwner:h.scheduleOwner,gate,core,now:()=>NOW});
 const retention={async assertServable(){if(!state.retained)throw Object.assign(Error('suppressed'),{code:'RETENTION_SUPPRESSED'});}};
 const receipts=createScheduledConversationReceipts({scheduleOwner:h.scheduleOwner,store:h.store,currentness,retention,now:()=>NOW});
 const history=createConversationHistoryApplication({service:createConversationHistoryService({store:h.store,gate,retention}),gate,currentness,now:()=>NOW,limits:{maxRequestMs:2000,maxRequestBytes:131072,maxResponseBytes:2097152}});
 const call={credential:'native',principal,conversationId:identity.binding.conversationId,scopes:p.scopes,deadlineMs:NOW+2000};
 let eventId=100;
 async function publish(type,data){return h.store.append(identity.binding,{eventId:id(eventId++),createdAt:new Date(NOW).toISOString(),type,data},()=>{},p.scopes);}
 const post=async(route,body)=>history.handle(new Request(`https://meri.invalid/api/conversations/${route}`,{method:'POST',headers:{authorization:'Bearer native','content-type':'application/json'},body:JSON.stringify(body)}));
 function storedOrigin(){return h.schedules.state.occurrences.get(`${p.owner.tenantId}:${identity.occurrenceKey}`);}
 return {...h,state,p,o,identity,gate,member,principal,core,currentness,retention,receipts,call,publish,post,storedOrigin,hash};
}
