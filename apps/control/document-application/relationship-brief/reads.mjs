import {types} from 'node:util';
import {artifactValidators as v,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {asset,same,fail} from './input.mjs';
const stable=s=>{const {authorizationDecisionId,...value}=s;return value;};
export function createReads({readSource,context,selected,defaultCongress,now,life,limits}){
 const receipts=[],issues=[],timeline=[];let calls=0,bytes=0;const attempted=new Set();
 async function read(id,request,previousPage){
  life.check();const operation=asset.manifest.allowedOperations.find(x=>x.id===id);if(!operation)fail('RELATIONSHIP_OPERATION');const contract=resolveOperationContract(operation),source=contract.descriptor.sourceRequirements[0];attempted.add(id);
  if(calls>=limits.maxCalls){issues.push({sourceId:source.sourceId,operation:id,reason:'CALL_CAP',request});return null;}
  const normalizationContext=id==='resolve_entity'?{defaultCongress}:id==='find_contacts'||id.startsWith('meeting.')||id==='read_monday_client_boards'?{}:id==='read_client_documents'?{binding:context.binding,subject:selected.subject}:id==='search_memory'?{tenantId:context.binding.tenantId,userId:context.binding.actorId}:id==='query_tasks'?{nowMs:now(),actorId:context.binding.actorId}:id==='query_action_items'?{actorId:context.binding.actorId}:{nowMs:now(),...(previousPage?{previousPage}:{})};
  const normalized=contract.normalizeInput(request,normalizationContext);calls++;let value;
  try{value=await life.run(signal=>readSource({...v.snapshot({operation,request,normalizationContext,binding:context.binding,subject:selected.subject,window:selected.window,deadlineMs:life.deadlineMs??context.deadlineMs}),signal}));}catch(error){if(error===life.signal.reason)throw error;const fields=error&&typeof error==='object'&&!types.isProxy(error)?Object.getOwnPropertyDescriptors(error):{},code=fields.code?.value??fields.message?.value;if(['UNAVAILABLE','SOURCE_UNAVAILABLE','TIMEOUT'].includes(code)){issues.push({sourceId:source.sourceId,operation:id,reason:code,request});return null;}fail('RELATIONSHIP_SOURCE_AUTHORITY');}
  life.check();const raw=v.snapshot(value);bytes+=Buffer.byteLength(JSON.stringify(raw));if(bytes>limits.maxSourceBytes)fail('RELATIONSHIP_SOURCE_BYTES');let page=raw;
  if(Object.hasOwn(raw,'result')){own(raw,['binding','subject','operation','argumentsSha256','result']);if(!same(raw.operation,operation)||raw.argumentsSha256!==normalized.argumentsSha256)fail('RELATIONSHIP_READ_BINDING');page=raw.result;}
  if(!same(raw.binding,context.binding)||!same(stable(raw.subject),stable(selected.subject)))fail('RELATIONSHIP_READ_BINDING');
  contract.assertOutput(page,{request,...normalizationContext});if(page.binding&&(!same(page.binding,context.binding)||!same(stable(page.subject),stable(selected.subject))))fail('RELATIONSHIP_READ_BINDING');
  if(page.window&&!same(page.window,selected.window)&&page.window.basis!=='unbounded')fail('RELATIONSHIP_READ_BINDING');if(page.sources&&page.sources.some(s=>!contract.descriptor.sourceRequirements.some(r=>r.sourceId===s.sourceId&&r.authority===s.authority)))fail('RELATIONSHIP_READ_SOURCE');
  receipts.push({operation,request:v.snapshot(request),normalizationContext:v.snapshot(normalizationContext),result:raw,resultSha256:v.hash(raw),observedAt:new Date(now()).toISOString()});return page;
 }
 function remaining(sourceId,operation,reason,selector){issues.push({sourceId,operation,reason,selector});}
 return {read,remaining,receipts,issues,timeline,attempted,stats:()=>({calls,bytes,limits})};
}
