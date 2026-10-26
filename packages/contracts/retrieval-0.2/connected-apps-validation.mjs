import {createHash} from 'node:crypto';
import {snapshotOperationData} from './operation-contracts.mjs';

export const CONNECTED_APP_OPERATION_IDS=Object.freeze(['list_connected_app_reads','read_connected_app']);
const fail=()=>{throw new Error('Invalid connected-app read contract');};
export function createConnectedAppValidators({validateShape}){
 const definition=(id,output=false)=>{
  if(!CONNECTED_APP_OPERATION_IDS.includes(id))fail();
  return `ConnectedApps${id==='list_connected_app_reads'?'List':'Read'}${output?'Output':'Request'}`;
 };
 function normalizeInput(id,raw){
  const input=snapshotOperationData(raw);validateShape(definition(id),input);
  if(Buffer.byteLength(JSON.stringify(input))>32768)fail();
  const visit=value=>{
   if(typeof value==='string'&&/(?:https?|file|data):\/\//i.test(value))fail();
   if(!value||typeof value!=='object')return;
   for(const [key,child] of Object.entries(value)){
    if(['__proto__','constructor','prototype'].includes(key)||/^(?:endpoint|base_?url|server_?url|auth(?:orization)?|headers?|access_?token|api_?key|credentials?)$/i.test(key))fail();
    visit(child);
   }
  };visit(input);
  return {input,metadata:{scope:'connection_permissions',absenceEvidence:false}};
 }
 function assertOutput(id,raw,request){
  const {input}=normalizeInput(id,request),page=snapshotOperationData(raw);validateShape(definition(id,true),page);
  if(Buffer.byteLength(JSON.stringify(page))>1700000||page.operation!==id||page.clientId!==input.clientId)fail();
  if(id==='list_connected_app_reads'){
   const keys=new Set();
   if((page.capabilities.length>0)!==(page.status==='ok'))fail();
   for(const item of page.capabilities){
    const key=`${item.connectionId}:${item.tool}`;
    if(keys.has(key)||item.inputSchema.type!=='object'||Buffer.byteLength(JSON.stringify(item.inputSchema))>16384||
      createHash('sha256').update(JSON.stringify(item.inputSchema)).digest('hex')!==item.schemaHash)fail();
    keys.add(key);
   }
  }else{
   for(const key of ['connectionId','provider','tool','schemaHash'])if(page[key]!==input[key])fail();
   if(Buffer.byteLength(JSON.stringify(page.providerResult))>131072)fail();
   if(page.status==='ok'&&(page.reason!==null||page.providerResult===null)||
     page.status==='partial'&&(page.reason!=='provider_result_exceeds_safe_json_boundary'||page.providerResult!==null)||
     page.status==='unavailable'&&!['current_read_schema_unavailable','provider_reported_error','provider_result_unavailable'].includes(page.reason))fail();
   if(page.reason==='current_read_schema_unavailable'&&(page.content!==null||page.providerResult!==null))fail();
   if(page.reason==='provider_result_unavailable'&&page.providerResult!==null)fail();
   if(['disconnected','permission_required'].includes(page.status)&&
     (page.reason!==(page.status==='disconnected'?'connection_disconnected':'connection_permission_required')||
      page.content!==null||page.providerResult!==null))fail();
  }
  return page;
 }
 return Object.freeze({normalizeInput,assertOutput});
}
