/** Synthetic retained run rows. The postgres test executes the same read owner against actual PG16. */
import {binding,scopes,versions,id} from '../../test/store-fixture.mjs';
import {hash} from '../../boundary.mjs';
import {savedUsage,payload} from '../../usage-read/test/fixture.mjs';
export {id,binding,scopes};
export const principal={tenantId:binding.tenantId,actorId:binding.actorId,role:'standard_user',permissions:[],clientIds:[scopes[0].resourceId],membershipRevision:'membership-one'};
export const request={schemaVersion:'meri.run-index/1',scope:{kind:'all'},status:'all',cursor:null,limit:2};
export function row(n,{state='completed',usage='recorded',general=false,at='2026-10-27T12:00:00.000Z'}={}){
 const b={...binding,conversationId:id(100+n),runId:id(200+n)},runScopes=general?[{tenantId:b.tenantId,kind:'private-user',resourceId:b.actorId,policyRevision:'policy1'}]:scopes;
 const conversation={conversationId:b.conversationId,owner:{tenantId:b.tenantId,actorId:b.actorId},scopes:runScopes,policyRevision:'policy1',createdAt:at},run={binding:b,scopes:runScopes,state,createdAt:at,policyRevision:'policy1',versions};
 const submission={requestId:id(300+n),prompt:'PRIVATE SYNTHETIC PROMPT',skill:null,window:null};
 const event={contractVersion:'0.1.0',eventId:id(400+n),binding:b,sequence:4,createdAt:at,type:'run.status',data:{state,reasonCode:null},scopes:runScopes};
 const record=usage==='absent'?null:savedUsage(payload({unavailable:usage==='unavailable',zero:usage==='zero'}));
 return {conversation_row:{tenant_id:b.tenantId,conversation_id:b.conversationId,owner_actor_id:b.actorId,projection:conversation,projection_sha256:hash(conversation)},
  run_row:{tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,request_id:submission.requestId,request:submission,request_sha256:hash(submission),projection:run,projection_sha256:hash(run),last_sequence:4,sdk_usage:record,sdk_usage_sha256:record===null?null:hash(record)},
  status_row:{tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,event_id:event.eventId,event,sequence:4,event_sha256:hash(event)}};
}
