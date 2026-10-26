import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../gateway/sources/bill-text/test/fixture.mjs';
import {fixture,uuid} from './reads-native-fixture.mjs';
const teamId=uuid('e'),connectionId=uuid('d'),channelId='19:synthetic@thread.tacv2';
function scene(id='get_teams_channel_messages',client=false){
 const f=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),a=f.authority;
 Object.assign(a.subject,{kind:client?'client':'personal',entityType:client?'client':'user',entityIds:[client?uuid('a'):a.binding.actorId],
  scopes:[{tenantId:a.binding.tenantId,kind:client?'client':'private-user',resourceId:client?uuid('a'):a.binding.actorId,policyRevision:a.policyRevision}]});
 const request={connectionId,teamId,...(id==='get_teams_channel_messages'?{channelId}:{}),...(client?{clientId:uuid('a')}:{})};
 const data=id==='list_teams_channels'?{id:channelId,displayName:'Policy channel',description:null,membershipType:'private'}:
  {id:'message-one',subject:null,createdDateTime:'2026-10-26T00:00:00Z',lastModifiedDateTime:null,deletedDateTime:null,
   etag:'revision-1',body:{contentType:'html',content:'<p>Quarterly policy review</p>'}};
 const resource=`/teams/${teamId}/channels${id==='get_teams_channel_messages'?`/${encodeURIComponent(channelId)}/messages`:''}`;
 const page=client?{kind:'unavailable',operation:id,reason:'client_scope_unavailable',requiredPermission:id==='list_teams_channels'?'Channel.ReadBasic.All':'ChannelMessage.Read.All'}:
  {kind:'page',operation:id,connectionId,teamId,channelId:id==='list_teams_channels'?null:channelId,observedAt:new Date(f.now()).toISOString(),
   coverage:id==='list_teams_channels'?'channels':'root_messages_only',attachmentsIncluded:false,repliesIncluded:false,
   items:[{id:data.id,data,source:{resource:resource+'/'+encodeURIComponent(data.id),revision:data.etag??null,
    contentSha256:createHash('sha256').update(JSON.stringify(data)).digest('hex')}}],
   nextContinuation:'https://graph.microsoft.com/v1.0'+resource+'?$skiptoken=opaque-page-2',incomplete:false,omittedItems:0};
 a.decision.operation=`${id}@0.2.0`;a.sourceIds=['teams_channel_reads'];
 const transport={...f.transport,async fetchImpl(url,options){f.wire.push({url,options,body:JSON.parse(options.body)});
  const result=structuredClone(f.state.page??page);f.state.afterSource?.();return Response.json(result);}};
 return {...f,family:'teams-channels',operation,contract,arguments:request,normalizationContext:{},page,transport};
}
for(const id of ['list_teams_channels','get_teams_channel_messages'])test(`${id}: actual General runtime fixed HTTP binding preserves exact page and continuation`,async()=>{
 const s=scene(id),f=await fixture('teams-channels',id,{scene:s}),r=await f.execute();
 assert.equal(r.status,200,await r.clone().text());assert.deepEqual(JSON.parse((await r.json()).resultJson).result,s.page);
 assert.deepEqual(s.wire[0].body,s.arguments);assert.equal(s.wire.length,1);
});
test('selected client stays explicitly unsupported, never silently becomes General',async()=>{
 const s=scene('get_teams_channel_messages',true),f=await fixture('teams-channels',s.operation.id,{scene:s}),r=await f.execute();
 assert.equal(r.status,200,await r.clone().text());assert.equal(JSON.parse((await r.json()).resultJson).result.reason,'client_scope_unavailable');
 const removed={...s.arguments};delete removed.clientId;assert.notEqual((await f.execute(removed)).status,200);assert.equal(s.wire.length,1);
});
test('foreign continuation, connection swap, mutated provenance and fabricated content coverage are refused',()=>{
 const s=scene(),contract=s.contract;
 for(const continuation of ['https://other.invalid/page','https://graph.microsoft.com/v1.0/teams/other/channels?$skiptoken=x',
  s.page.nextContinuation+'&arbitrary=true'])assert.throws(()=>contract.normalizeInput({...s.arguments,continuation}));
 for(const changed of [{connectionId:uuid('f')},{repliesIncluded:true},{attachmentsIncluded:true},{incomplete:true}])
  assert.throws(()=>contract.assertOutput({...s.page,...changed},{request:s.arguments}));
 const page=structuredClone(s.page);page.items[0].data.body.content='changed';assert.throws(()=>contract.assertOutput(page,{request:s.arguments}));
});
test('late current execution denial withholds an otherwise valid Teams page',async()=>{
 const s=scene(),f=await fixture('teams-channels',s.operation.id,{scene:s});s.state.afterSource=f.revoke;
 const r=await f.execute();assert.equal(r.status,403);assert.equal((await r.json()).resultJson,undefined);assert.equal(s.wire.length,1);
});
