/** Bounded domain reads through the existing gateway, never a model or policy loop. */
import {types} from 'node:util';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {artifactValidators as v,assertSubject,assertWindow,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
export const asset=selectSkill('quick_skill.commitments_audit','1.0.0');
export const same=(a,b)=>v.hash(a)===v.hash(b);
const stableSubject=subject=>{const {authorizationDecisionId,...rest}=subject;return rest;};
export const fail=code=>{throw Object.assign(new Error(code),{code});};
export function input(raw){const i=own(v.snapshot(raw),['skill','title','target','asOf','observations']);
 if(!same(i.skill,asset.pin))fail('COMMITMENTS_SKILL_PIN');
 for(const [value,max]of[[i.title,200],[i.target?.query,200]])if(typeof value!=='string'||!value.trim()||value.length>max||!value.isWellFormed())fail('COMMITMENTS_INPUT');
 own(i.target,['query']);if(typeof i.asOf!=='string'||!Number.isFinite(Date.parse(i.asOf))||new Date(i.asOf).toISOString()!==i.asOf||!Array.isArray(i.observations)||i.observations.length>250)fail('COMMITMENTS_INPUT');
 for(const row of i.observations){own(row,['id','kind','relatedPromiseId','owner','dueDate','passage']);own(row.passage,['sourceId','recordId','recordVersionId','start','end','quote']);
  if(typeof row.id!=='string'||!row.id||row.id.length>128||!['promise','suggestion','tracking','delivery-claim'].includes(row.kind)||
   (['promise','suggestion'].includes(row.kind)?row.relatedPromiseId!==null:typeof row.relatedPromiseId!=='string')||
   row.owner!==null&&(typeof row.owner!=='string'||!row.owner||row.owner.length>256)||
   row.dueDate!==null&&(typeof row.dueDate!=='string'||!/^\d{4}-\d\d-\d\d$/u.test(row.dueDate)||!Number.isFinite(Date.parse(row.dueDate+'T00:00:00.000Z')))||
   !asset.manifest.requiredSources.some(s=>s.sourceId===row.passage.sourceId)||
   ['recordId','recordVersionId','quote'].some(key=>typeof row.passage[key]!=='string'||!row.passage[key]||!row.passage[key].isWellFormed())||
   !Number.isSafeInteger(row.passage.start)||!Number.isSafeInteger(row.passage.end)||row.passage.start<0||row.passage.end<=row.passage.start||row.passage.end-row.passage.start!==row.passage.quote.length)fail('COMMITMENTS_INPUT');}
 return i;}
export function selection(raw,context){const s=own(v.snapshot(raw),['subject','window','mondayBoardIds']);assertSubject(s.subject,context.binding);assertWindow(s.window);
 if(s.subject.kind!=='client'||!same(s.subject.scopes,context.scopes)||!asset.manifest.windowBases.includes(s.window.basis)||!Array.isArray(s.mondayBoardIds)||s.mondayBoardIds.length>100||new Set(s.mondayBoardIds).size!==s.mondayBoardIds.length||s.mondayBoardIds.some(id=>typeof id!=='string'||!id||id.length>256))fail('COMMITMENTS_SELECTION');return s;}
function code(error){if(error&&typeof error==='object'&&!types.isProxy(error)){const d=Object.getOwnPropertyDescriptors(error);return d.code?.value??d.message?.value;}}
export function createCollection({readSource,context,selected,asOf,query,deadlineMs,life,now,limits}){
 const reads=[],gaps=[],capHits=[];let calls=0,bytes=0;
 const normalization=id=>id==='read_client_documents'?{binding:context.binding,subject:selected.subject}:id==='read_monday_client_boards'?{}:
  id==='query_action_items'?{actorId:context.binding.actorId}:id==='query_tasks'?{nowMs:Date.parse(asOf),actorId:context.binding.actorId}:
  ['mail.search_messages','meeting.read_client_meetings','meeting.query_debriefs'].includes(id)?{nowMs:Date.parse(asOf)}:{};
 async function read(id,request,previousPage){life.check();const operation=asset.manifest.allowedOperations.find(ref=>ref.id===id);if(!operation)fail('COMMITMENTS_OPERATION');
  if(calls>=limits.maxCalls){capHits.push({operation:id,kind:'tool-call-cap'});gaps.push({operation:id,reason:'TOOL_CALL_CAP',request});return null;}
  const contract=resolveOperationContract(operation);let normalizationContext={...normalization(id),...(previousPage?{previousPage}:{})};
  const normalized=contract.normalizeInput(request,normalizationContext);calls++;let raw;
  try{raw=v.snapshot(await life.run(signal=>readSource({...v.snapshot({operation,request,binding:context.binding,subject:selected.subject,window:selected.window,
   normalizationContext,deadlineMs}),signal})));}
  catch(error){const c=code(error);if(['UNAVAILABLE','SOURCE_UNAVAILABLE','TIMEOUT','GATEWAY_SOURCE_UNAVAILABLE'].includes(c)){gaps.push({operation:id,reason:c,request});return null;}
   if(error===life.signal.reason)throw error;fail('COMMITMENTS_SOURCE_AUTHORITY');}
  life.check();bytes+=Buffer.byteLength(JSON.stringify(raw));if(bytes>limits.maxSourceBytes)fail('COMMITMENTS_SOURCE_BYTES');
  let result=raw;
  if(contract.binding.dispatchProfile==='bound-projection/1'){own(raw,['binding','subject','operation','argumentsSha256','result']);
   if(!same(raw.binding,context.binding)||!same(stableSubject(raw.subject),stableSubject(selected.subject))||!same(raw.operation,operation)||raw.argumentsSha256!==normalized.argumentsSha256)fail('COMMITMENTS_SOURCE_BINDING');result=raw.result;}
  if(id==='read_client_documents'&&same(result.binding,context.binding)&&same(stableSubject(result.subject),stableSubject(selected.subject)))normalizationContext={binding:context.binding,subject:result.subject};
  contract.assertOutput(result,{request,...normalizationContext});
  if(result.binding&&(!same(result.binding,context.binding)||!same(stableSubject(result.subject),stableSubject(selected.subject))))fail('COMMITMENTS_SOURCE_BINDING');
  if(result.window&&result.window.basis!=='unbounded'&&!same(result.window,selected.window))fail('COMMITMENTS_SOURCE_WINDOW');
  const receipt={operation,request,normalizationContext,resultSha256:v.hash(raw),result:raw};reads.push(receipt);return result;
 }
 const clientId=selected.subject.entityIds[0],range=selected.window.basis==='unbounded'?{}:{from:selected.window.startInclusive,to:selected.window.endExclusive};
 const subject={kind:'client',entityId:clientId};
 async function collect(){
  const anchor=new Date(Math.min(Date.parse(asOf),selected.window.basis==='unbounded'?Date.parse(asOf):Date.parse(selected.window.endExclusive)-1)).toISOString();
  const days=selected.window.basis==='unbounded'?null:Math.ceil((Date.parse(anchor)-Date.parse(selected.window.startInclusive))/86400000);
  const search=await read('mail.search_messages',{subject,query,limit:limits.maxRecords,offset:0,asOf:anchor,...(days>0&&days<=3650?{withinDays:days}:{})});
  const meetings=await read('meeting.read_client_meetings',{clientId,limit:limits.maxRecords,...range});
  const debriefs=await read('meeting.query_debriefs',{clientId,limit:limits.maxRecords,characterLimit:limits.sectionCodeUnits,...range});
  const documents=await read('read_client_documents',{clientId,limit:limits.maxRecords});
  await read('query_tasks',{clientId,limit:limits.maxRecords});await read('query_action_items',{clientId,limit:limits.maxRecords});
  if(selected.mondayBoardIds.length)await read('read_monday_client_boards',{clientId,boardContext:selected.mondayBoardIds.join(','),pageSize:limits.maxRecords});
  else gaps.push({operation:'read_monday_client_boards',reason:'NOT_MAPPED'});
  for(const candidate of(search?.messages??[]).filter(row=>selected.window.basis==='unbounded'||row.effectiveAt!==null&&Date.parse(row.effectiveAt)>=Date.parse(selected.window.startInclusive)&&Date.parse(row.effectiveAt)<Date.parse(selected.window.endExclusive)).slice(0,limits.maxRecords)){
   let offset=0;for(let page=0;page<limits.maxPages;page++){const result=await read('mail.read_thread',{subject,threadId:candidate.threadId,messageId:candidate.messageId,limit:1,bodyOffset:offset,maxCharacters:limits.sectionCodeUnits});
    const row=result?.messages?.[0];if(!row)break;if(row.section.totalCodeUnits>limits.maxBodyCodeUnits){capHits.push({operation:'mail.read_thread',kind:'body-code-unit-cap',recordId:candidate.messageId});break;}if(row.section.hasMore!==true)break;offset=row.section.endExclusive;if(page===limits.maxPages-1)capHits.push({operation:'mail.read_thread',kind:'body-page-cap',recordId:candidate.messageId,offset});}
  }
  for(const meeting of(meetings?.meetings??[]))for(const source of meeting.sources.filter(s=>s.availability==='available').slice(0,limits.maxRecords)){
   let offset=0;for(let page=0;page<limits.maxPages;page++){const result=await read('meeting.read_client_meetings',{clientId,meetingId:meeting.id,sourceKind:source.sourceKind,sourceId:source.sourceId,characterOffset:offset,characterLimit:limits.sectionCodeUnits});
    if(!result?.source)break;const c=result.source.bodyCoverage;if(c.totalCharacters>limits.maxBodyCodeUnits){capHits.push({operation:'meeting.read_client_meetings',kind:'body-code-unit-cap',recordId:source.sourceId});break;}if(!c.truncated)break;offset=c.characterEnd;if(page===limits.maxPages-1)capHits.push({operation:'meeting.read_client_meetings',kind:'body-page-cap',recordId:source.sourceId,offset});}
  }
  for(const debrief of(debriefs?.debriefs??[]).filter(d=>!d.bodyCoverage.complete).slice(0,limits.maxRecords)){
   let offset=0;for(let page=0;page<limits.maxPages;page++){const result=await read('meeting.query_debriefs',{clientId,debriefId:debrief.id,characterOffset:offset,characterLimit:limits.sectionCodeUnits});
    const row=result?.debriefs?.[0];if(row?.bodyCoverage.totalCharacters>limits.maxBodyCodeUnits){capHits.push({operation:'meeting.query_debriefs',kind:'body-code-unit-cap',recordId:debrief.id});break;}if(!row||!row.bodyCoverage.truncated)break;offset=row.bodyCoverage.characterEnd;if(page===limits.maxPages-1)capHits.push({operation:'meeting.query_debriefs',kind:'body-page-cap',recordId:debrief.id,offset});}
  }
  for(const doc of(documents?.data?.documents??[]).filter(d=>d.usable).slice(0,limits.maxRecords)){
   let cursor;for(let page=0;page<limits.maxPages;page++){const result=await read('read_client_documents',{clientId,documentId:doc.id,limit:limits.sectionCodeUnits,...(cursor?{cursor}:{})});
    if(result?.data?.coverage?.sectionCharacters>limits.maxBodyCodeUnits){capHits.push({operation:'read_client_documents',kind:'body-code-unit-cap',recordId:doc.id});break;}cursor=result?.data?.coverage?.nextCursor;if(!cursor||result.data.coverage.continuationBlocked)break;if(page===limits.maxPages-1)capHits.push({operation:'read_client_documents',kind:'body-page-cap',recordId:doc.id,cursor});}
  }
  for(const result of[search,meetings,debriefs,documents])if(result&&(result.hasMore||result.pageCoverage?.nextCursor||result.data?.coverage?.nextCursor))capHits.push({kind:'inventory-page-limit',resultSha256:v.hash(result)});
 }
 return {collect,read,reads,gaps,capHits,stats:()=>({calls,bytes,limits})};
}
