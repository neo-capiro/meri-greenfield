/** Connected-app read scenes over the fixed Core HTTP source, plus the recorded provider corpus (M11/M12).
 *
 * Core owns the provider MCP transport, the connection directory and the OAuth lifecycle; Meri receives one
 * canonical page per read. `PROVIDER_EXCHANGES` are recorded JSON-RPC exchanges of the kind Core performs
 * (tools/list, tools/call success, tool-level denial, expired token); `READ_OUTCOMES` and `LIST_OUTCOMES` are
 * the Core pages each connection state yields, as `ConnectedAppReadService` maps them. Tests bind the two so a
 * page can never claim content the recorded exchange did not return. Synthetic data only; no provider, Core,
 * SQL, model or AWS. */
import {createHash} from 'node:crypto';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../sources/bill-text/test/fixture.mjs';
import {uuid} from '../../sources/test/read-fixture.mjs';

const INPUT_SCHEMA=Object.freeze({type:'object',additionalProperties:false,properties:{query:{type:'string'},cursor:{type:'string'}},required:['query']});
/** One approved read-only capability of one personal Slack connection. */
export const CAPABILITY=Object.freeze({connectionId:uuid('d'),provider:'slack',tool:'search_messages',inputSchema:INPUT_SCHEMA,
 schemaHash:createHash('sha256').update(JSON.stringify(INPUT_SCHEMA)).digest('hex')});
const ARGUMENTS=Object.freeze({query:'quarterly',cursor:'page-2'});
const OK_RESULT=Object.freeze({content:[{type:'text',text:'Quarterly plan'}],structuredContent:{messages:[{id:'m2',text:'Quarterly plan'}],next_cursor:'page-3',has_more:true}});
const DENIED_RESULT=Object.freeze({isError:true,content:[{type:'text',text:'missing_scope: channels:history'}]});
/** Recorded provider exchanges (streamable HTTP JSON-RPC 2.0) behind each Core outcome. */
export const PROVIDER_EXCHANGES=Object.freeze({
 tools_list:Object.freeze({request:{jsonrpc:'2.0',id:1,method:'tools/list'},
  response:{jsonrpc:'2.0',id:1,result:{tools:[{name:'search_messages',description:'Search messages',inputSchema:INPUT_SCHEMA},{name:'post_message',description:'Post a message',inputSchema:{type:'object'}}]}}}),
 call_ok:Object.freeze({request:{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'search_messages',arguments:ARGUMENTS}},response:{jsonrpc:'2.0',id:2,result:OK_RESULT}}),
 call_denied:Object.freeze({request:{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'search_messages',arguments:ARGUMENTS}},response:{jsonrpc:'2.0',id:3,result:DENIED_RESULT}}),
 call_expired:Object.freeze({request:{jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'search_messages',arguments:ARGUMENTS}},
  response:{http:401,headers:{'www-authenticate':'Bearer error="invalid_token", error_description="The access token expired"'}}}),
});
/** `read_connected_app` pages by Core connection state: `connection` is the stored `connectionStatus` (or `disabled`),
 * `exchange` the recorded provider exchange that produced it (none when Core refuses before provider I/O), `notice` the
 * model guidance Meri appends. */
export const READ_OUTCOMES=Object.freeze([
 {id:'connected ok',connection:'connected',exchange:'call_ok',status:'ok',reason:null,content:'Untrusted quarterly text',providerResult:OK_RESULT,notice:null},
 {id:'connected provider denial',connection:'connected',exchange:'call_denied',status:'unavailable',reason:'provider_reported_error',content:'Provider reported an error.',providerResult:DENIED_RESULT,notice:null},
 {id:'connected oversized result',connection:'connected',exchange:'call_ok',status:'partial',reason:'provider_result_exceeds_safe_json_boundary',content:'Untrusted quarterly text',providerResult:null,notice:null},
 {id:'connected non-object result',connection:'connected',exchange:'call_ok',status:'unavailable',reason:'provider_result_unavailable',content:'Untrusted quarterly text',providerResult:null,notice:null},
 {id:'needs_reauth (token expired, refresh failed)',connection:'needs_reauth',exchange:'call_expired',status:'permission_required',reason:'connection_permission_required',content:null,providerResult:null,notice:/reconnect/u},
 {id:'disconnected',connection:'disconnected',exchange:null,status:'disconnected',reason:'connection_disconnected',content:null,providerResult:null,notice:/connect it/u},
 {id:'pending authorization',connection:'pending',exchange:null,status:'disconnected',reason:'connection_disconnected',content:null,providerResult:null,notice:/connect it/u},
 {id:'error (zero usable tools or discovery failure)',connection:'error',exchange:null,status:'unavailable',reason:'current_read_schema_unavailable',content:null,providerResult:null,notice:null},
 {id:'disabled row',connection:'disabled',exchange:null,status:'unavailable',reason:'current_read_schema_unavailable',content:null,providerResult:null,notice:null},
].map(Object.freeze));
/** `list_connected_app_reads` pages: the directory the model sees reflects usable authenticated discovery, never inventory. */
export const LIST_OUTCOMES=Object.freeze([
 {id:'one usable connection',status:'ok',managedAvailability:'ok',capabilities:[CAPABILITY],notice:null},
 {id:'usable generic connection, managed app failing',status:'ok',managedAvailability:'partial',capabilities:[CAPABILITY],notice:null},
 {id:'no usable connection',status:'unavailable',managedAvailability:'no_eligible',capabilities:[],notice:/Connected apps/u},
 {id:'registry unavailable',status:'unavailable',managedAvailability:'unavailable',capabilities:[],notice:/Connected apps/u},
].map(Object.freeze));

function listPage({clientId,observedAt},outcome=LIST_OUTCOMES[0]){
 return {operation:'list_connected_app_reads',clientId,observedAt,status:outcome.status,untrusted:true,complete:false,scope:'current_connection_catalog',
  managedAvailability:outcome.managedAvailability,capabilities:structuredClone(outcome.capabilities)};
}
function readPage({clientId,observedAt},outcome=READ_OUTCOMES[0]){
 return {operation:'read_connected_app',clientId,connectionId:CAPABILITY.connectionId,provider:CAPABILITY.provider,tool:CAPABILITY.tool,schemaHash:CAPABILITY.schemaHash,
  observedAt,status:outcome.status,untrusted:true,scope:'connection_permissions',completeness:'provider_page',reason:outcome.reason,content:outcome.content,providerResult:structuredClone(outcome.providerResult)};
}
/** A current-runtime scene for one connected-app read: General or selected-client subject, fixed Core HTTP source. */
export function connectedAppScene(id='read_connected_app',{general=false,outcome,list}={}){
 const f=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),a=f.authority;
 if(general){Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId],
  scopes:[{tenantId:a.binding.tenantId,kind:'private-user',resourceId:a.binding.actorId,policyRevision:a.policyRevision}]});}
 else Object.assign(a.subject,{kind:'client',entityType:'client',entityIds:[uuid('a')],
  scopes:[{tenantId:a.binding.tenantId,kind:'client',resourceId:uuid('a'),policyRevision:a.policyRevision}]});
 const clientId=general?null:a.subject.entityIds[0];
 const request=id==='list_connected_app_reads'?{clientId}:{clientId,connectionId:CAPABILITY.connectionId,
  provider:CAPABILITY.provider,tool:CAPABILITY.tool,schemaHash:CAPABILITY.schemaHash,arguments:{...ARGUMENTS}};
 a.decision.operation=`${id}@0.2.0`;a.sourceIds=['connected_app_reads'];
 const at={clientId,observedAt:new Date(f.now()).toISOString()};
 const page=id==='list_connected_app_reads'?listPage(at,list):readPage(at,outcome);
 const transport={...f.transport,async fetchImpl(url,options){
  f.wire.push({url,options,body:JSON.parse(options.body)});const result=structuredClone(f.state.page??page);
  f.state.afterSource?.();return f.state.responseFactory?f.state.responseFactory(result):Response.json(result);
 }};
 return {...f,family:'connected-apps',operation,contract,arguments:request,normalizationContext:{},page,transport};
}
