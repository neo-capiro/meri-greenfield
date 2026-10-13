/** Canonical source collection and exact lineage; no HTTP, permissions or model loop. */
import {artifactValidators as v,assertSubject,assertWindow,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {types} from 'node:util';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
export const asset=selectSkill('quick_skill.mail_history','1.0.0');
export const same=(a,b)=>v.hash(a)===v.hash(b);
export const fail=code=>{throw Object.assign(new Error(code),{code});};
export function text(value,max=4000){if(typeof value!=='string'||!value.trim()||value.length>max||!value.isWellFormed()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value))fail('MAIL_HISTORY_INPUT');return value;}
export function input(value){
 const i=own(v.snapshot(value),['skill','title','target','asOf','quotes','interpretations']);
 if(!same(i.skill,asset.pin))fail('MAIL_HISTORY_SKILL_PIN');text(i.title,200);own(i.target,['query'],['participant']);text(i.target.query,200);if(i.target.participant!==undefined)text(i.target.participant,200);
 if(typeof i.asOf!=='string'||!Number.isFinite(Date.parse(i.asOf))||new Date(i.asOf).toISOString()!==i.asOf||!Array.isArray(i.quotes)||i.quotes.length>24||!Array.isArray(i.interpretations)||i.interpretations.length>20)fail('MAIL_HISTORY_INPUT');
 for(const q of i.quotes){own(q,['mailboxId','threadId','messageId','sourceVersionId','start','end','text'],['url']);for(const k of ['mailboxId','threadId','messageId'])if(!/^[a-f0-9-]{36}$/u.test(q[k]??''))fail('MAIL_HISTORY_INPUT');text(q.sourceVersionId,256);text(q.text,4000);if(!Number.isSafeInteger(q.start)||!Number.isSafeInteger(q.end)||q.start<0||q.end<=q.start||q.end-q.start!==q.text.length)fail('MAIL_HISTORY_INPUT');if(q.url!==undefined){text(q.url,2000);try{if(new URL(q.url).protocol!=='https:')fail('MAIL_HISTORY_INPUT');}catch{fail('MAIL_HISTORY_INPUT');}}}
 i.interpretations.forEach(s=>text(s,4000));return i;
}
export function selection(value,context){
 const s=own(v.snapshot(value),['subject','window']);assertSubject(s.subject,context.binding);assertWindow(s.window);
 if(!['client','personal'].includes(s.subject.kind)||!same(s.subject.scopes,context.scopes)||!asset.manifest.windowBases.includes(s.window.basis)||!s.subject.scopes.some(x=>x.kind==='mailbox'))fail('MAIL_HISTORY_SELECTION');
 if(s.subject.kind==='client'&&!s.subject.scopes.some(x=>x.kind==='client'&&x.resourceId===s.subject.entityIds[0]))fail('MAIL_HISTORY_SELECTION');return s;
}
const stableSubject=subject=>{const {authorizationDecisionId,...rest}=subject;return rest;};
function sourceFault(error){const d=error&&typeof error==='object'&&!types.isProxy(error)?Object.getOwnPropertyDescriptors(error):{};return d.code?.value??d.message?.value;}
export function createCollection({readSource,context,selected,asOf,defaultCongress,life,now,limits}){
 let calls=0,bytes=0;const reads=[],coverage=[],capHits=[];
 async function read(id,request,previousPage){
  life.check();if(calls>=limits.maxCalls){capHits.push({kind:'call-cap',operation:id});return {unavailable:true,reason:'CALL_BUDGET_EXHAUSTED'};}
  const operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),normalizationContext=id==='resolve_entity'?{defaultCongress}:id==='find_contacts'?{}:{nowMs:now(),...(previousPage?{previousPage}:{})};
  const normalized=contract.normalizeInput(request,normalizationContext);calls++;
  let value;try{value=await life.run(signal=>readSource({...v.snapshot({operation,request,binding:context.binding,subject:selected.subject,window:selected.window,deadlineMs:context.deadlineMs,normalizationContext}),signal}));}
  catch(error){const code=sourceFault(error);if(error===life.signal.reason&&['MAIL_HISTORY_CANCELLED','MAIL_HISTORY_DEADLINE'].includes(code))throw error;if(['UNAVAILABLE','SOURCE_UNAVAILABLE','GATEWAY_SOURCE_UNAVAILABLE','TIMEOUT'].includes(code)){reads.push({operation,request,argumentsSha256:normalized.argumentsSha256,status:'unavailable',reason:code});return {unavailable:true,reason:code};}fail(['ACCESS_DENIED','SESSION_REFUSED','STALE_WRITER','CANCELLED','DEADLINE'].includes(code)?'MAIL_HISTORY_SOURCE_AUTHORITY':'MAIL_HISTORY_SOURCE_FAILED');}
  life.check();const raw=v.snapshot(value);bytes+=Buffer.byteLength(JSON.stringify(raw));if(bytes>limits.maxSourceBytes)fail('MAIL_HISTORY_SOURCE_LIMIT');
  let result=raw;
  if(['resolve_entity','find_contacts'].includes(id)){own(raw,['binding','subject','operation','argumentsSha256','result']);if(!same(raw.binding,context.binding)||!same(stableSubject(raw.subject),stableSubject(selected.subject))||!same(raw.operation,operation)||raw.argumentsSha256!==normalized.argumentsSha256)fail('MAIL_HISTORY_SOURCE_BINDING');assertSubject(raw.subject,raw.binding);result=raw.result;}
  contract.assertOutput(result,{request,...normalizationContext});
  if(id==='find_contacts'&&selected.subject.kind==='client'&&result.clientId!==selected.subject.entityIds[0])fail('MAIL_HISTORY_SOURCE_BINDING');
  if(id.startsWith('mail.')){
   if(!same(result.binding,context.binding)||!same(stableSubject(result.subject),stableSubject(selected.subject))||!same(result.window,selected.window)||!same(result.operation,operation)||result.argumentsSha256!==normalized.argumentsSha256||result.sources.length!==1||result.sources[0].sourceId!=='mail'||result.sources[0].authority!=='authoritative'||Date.parse(result.sources[0].retrievedAt)>now()+1000)fail('MAIL_HISTORY_SOURCE_BINDING');
  }
  reads.push({operation,request,argumentsSha256:normalized.argumentsSha256,resultSha256:v.hash(raw),result:raw});return {result};
 }
 async function identity(id,request){const got=await read(id,request);const sourceId=id==='resolve_entity'?'entity_candidates':'tenant_contacts';coverage.push({sourceId,operation:id,status:got.unavailable?'unavailable':'candidate-metadata',reason:got.reason??null,verified:false,enumeration:'unknown',authority:'derived',generatedAt:got.result?.generatedAt??null,freshness:'unknown',snapshotVersionId:null,result:got.result??null});return got;}
 const subjectRequest=selected.subject.kind==='client'?{kind:'client',entityId:selected.subject.entityIds[0]}:{kind:'personal'};
 const anchor=new Date(Math.min(Date.parse(asOf),selected.window.basis==='unbounded'?Date.parse(asOf):Date.parse(selected.window.endExclusive)-1)).toISOString();
 const days=selected.window.basis==='unbounded'?null:Math.ceil((Date.parse(anchor)-Date.parse(selected.window.startInclusive))/86400000);
 const withinDays=days>0&&days<=3650?days:null;
 async function candidates(id,extra={}){
  const rows=[],pages=[];let previous,offset=0,reason=null;
  for(let n=0;n<limits.maxCandidatePages;n++){
   const request={subject:subjectRequest,limit:limits.candidatePageSize,offset,asOf:anchor,...(withinDays===null?{}:{withinDays}),...extra};
   const got=await read(id,request,previous);if(got.unavailable){reason=got.reason;break;}
   const page=got.result;pages.push(page);rows.push(...page.messages);
   if(page.hasMore!==true||page.nextOffset===null)break;offset=page.nextOffset;previous=page;
  }
  const last=pages.at(-1);if(last?.hasMore===true&&pages.length===limits.maxCandidatePages){reason='CANDIDATE_PAGE_CAP';capHits.push({kind:'candidate-page-cap',operation:id,remainingOffset:last.nextOffset});}
  coverage.push({sourceId:'mail',operation:id,status:pages.length?'bounded-candidates':'unavailable',reason,verified:false,enumeration:'unknown',returned:rows.length,hasMore:last?.hasMore??null,nextOffset:last?.nextOffset??null,queryScope:last?.queryScope??null,sources:last?.sources??[],limitations:[...new Set(pages.flatMap(p=>p.coverage.limitations))],remainingReads:rows.map(row=>row.readHandle)});
  return rows;
 }
 return {read,identity,candidates,subjectRequest,reads,coverage,stats:()=>({calls,bytes,limits,capHits})};
}
