import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../../../gateway/sources/bill-text/test/fixture.mjs';
import {binding as original,versions,id} from '../../test/store-fixture.mjs';
import {projectBillTextSource,billTextReferenceId} from '../bill-text.mjs';
export const binding={...original,tenantId:id(70),actorId:id(71)},scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:id(5),policyRevision:'policy1'}];
export const at='2026-10-26T05:00:00.000Z',operation={id:'read_bill_text',version:'0.2.0'},check=()=>{};
export async function seedStore(store,selectedScopes=scopes){
 const scopes=selectedScopes;
 const run={binding,state:'queued',scopes,createdAt:at,policyRevision:'policy1',versions},request={requestId:id(6),prompt:'Synthetic test',skill:null,window:null},conversation={conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes,createdAt:at,policyRevision:'policy1'},event={contractVersion:'0.1.0',eventId:id(7),binding,sequence:1,createdAt:at,scopes,type:'run.status',data:{state:'queued',reasonCode:null}};
 await store.accept({run,request,conversation,event},check);
 await store.append(binding,status(8,'starting'),check);await store.append(binding,status(9,'running'),check);
 return {run,request,conversation,event};
}
export const status=(n,state)=>({eventId:id(n),createdAt:at,type:'run.status',data:{state,reasonCode:null}});
export function proof({args={billId:'H.R. 1'},deliveryId='synthetic-source',total=12,mutate,selectedScopes=scopes}={}){
 const scopes=selectedScopes;
 const source=billTextCase();source.state.total=total;
 const normalized=resolveOperationContract(operation).normalizeInput(args,{defaultCongress:119}),result=JSON.parse(JSON.stringify(source.native(normalized.input)));mutate?.(result);
 const request={schemaVersion:'meri-native-general-reads/1',binding,operation,arguments:args,deliveryId,installationId:'synthetic',executionCatalogSha256:'c'.repeat(64)};
 const envelope={binding,subject:{tenantId:binding.tenantId,actorId:binding.actorId,scopes,policyRevision:'policy1'},operation,argumentsSha256:normalized.argumentsSha256,result};
 const response={inputSha256:hash(request),resultSha256:hash(envelope),resultJson:JSON.stringify(envelope),executionSha256:'e'.repeat(64),policyRevision:'policy1'};
 const data=projectBillTextSource({request,response,scopes,defaultCongress:119}),event=data===null?null:{contractVersion:'0.1.0',eventId:billTextReferenceId(binding,deliveryId),binding,sequence:4,createdAt:at,scopes,type:'source.native-bill-text',data};
 return {request,response,result,event,source};
}
