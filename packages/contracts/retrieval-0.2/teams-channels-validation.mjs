import {createHash} from 'node:crypto';
import {snapshotOperationData} from './operation-contracts.mjs';
export const TEAMS_OPERATION_IDS=Object.freeze(['list_teams_channels','get_teams_channel_messages']);
const fail=()=>{throw new Error('Invalid Teams channel read');};
const resource=(id,input)=>`/teams/${input.teamId}/channels${id==='get_teams_channel_messages'?`/${encodeURIComponent(input.channelId)}/messages`:''}`;
function continuation(id,input,value){
 if(value===undefined||value===null)return;
 let url;try{url=new URL(value);}catch{fail();}
 if(url.origin!=='https://graph.microsoft.com'||url.username||url.password||url.hash||
  decodeURIComponent(url.pathname)!==decodeURIComponent('/v1.0'+resource(id,input))||!url.searchParams.has('$skiptoken')||
  [...url.searchParams.keys()].some(key=>!['$skiptoken','$top','$select'].includes(key)||url.searchParams.getAll(key).length!==1)||
  url.searchParams.has('$top')&&(id!=='get_teams_channel_messages'||url.searchParams.get('$top')!=='50')||
  url.searchParams.has('$select')&&(id!=='list_teams_channels'||url.searchParams.get('$select')!=='id,displayName,description,membershipType'))fail();
}
export function createTeamsChannelValidators({validateShape}){
 const definition=(id,output=false)=>{
  if(!TEAMS_OPERATION_IDS.includes(id))fail();
  return `Teams${id==='list_teams_channels'?'Channels':'Messages'}${output?'Output':'Request'}`;
 };
 function normalizeInput(id,value){
  const input=snapshotOperationData(value);validateShape(definition(id),input);continuation(id,input,input.continuation);
  return {input,metadata:{scope:'actor_owned_connection',absenceEvidence:false}};
 }
 function assertOutput(id,value,request){
  const {input}=normalizeInput(id,request),page=snapshotOperationData(value);validateShape(definition(id,true),page);
  if(page.operation!==id||Buffer.byteLength(JSON.stringify(page))>1048576)fail();
  if(page.kind==='unavailable'){
   if(page.requiredPermission!==(id==='list_teams_channels'?'Channel.ReadBasic.All':'ChannelMessage.Read.All'))fail();
   if(page.reason==='client_scope_unavailable'&&!input.clientId)fail();
   return page;
  }
  if(input.clientId||page.connectionId!==input.connectionId||page.teamId!==input.teamId||
    page.channelId!==(input.channelId??null)||page.incomplete!==(page.omittedItems>0))fail();
  continuation(id,input,page.nextContinuation);
  const seen=new Set();
  for(const item of page.items){
   if(seen.has(item.id)||item.id!==item.data.id||item.source.resource!==resource(id,input)+'/'+encodeURIComponent(item.id)||
    item.source.revision!==(id==='get_teams_channel_messages'?item.data.etag:null)||
    item.source.contentSha256!==createHash('sha256').update(JSON.stringify(item.data)).digest('hex'))fail();
   seen.add(item.id);
  }
  return page;
 }
 return Object.freeze({normalizeInput,assertOutput});
}
