/** Exact immutable body aggregation; no source authenticity or semantic verification. */
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash,validateShape} from '../../contracts/validate.mjs';
export const same=(a,b)=>hash(a)===hash(b);
export const fail=code=>{throw Object.assign(new Error(code),{code});};
export const utf8Sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
export function aggregateMaterial(sections,context){
 const groups=new Map();
 for(const section of sections){
  const s=section;
  if(typeof s.text!=='string'||!s.text.isWellFormed()||!Number.isSafeInteger(s.start)||!Number.isSafeInteger(s.end)||!Number.isSafeInteger(s.total)||s.start<0||s.end<s.start||s.end>s.total||s.total>2000000||s.end-s.start!==s.text.length||!/^[a-f0-9]{64}$/u.test(s.contentSha256??'')||typeof s.recordId!=='string'||!s.recordId||typeof s.recordVersionId!=='string'||!s.recordVersionId)fail('WORKFLOW_MATERIAL_REFUSED');
  if(!Array.isArray(s.scopes)||!s.scopes.length||s.scopes.some(scope=>{validateShape('Scope',scope);return !context.subject.scopes.some(authorized=>same(scope,authorized));}))fail('WORKFLOW_MATERIAL_SCOPE');
  const key=hash([s.sourceId,s.recordId,s.recordVersionId]);let group=groups.get(key);
  const identity={sourceId:s.sourceId,recordId:s.recordId,recordVersionId:s.recordVersionId,contentSha256:s.contentSha256,scopes:s.scopes,total:s.total,metadata:s.metadata};
  if(group&&!same(group.identity,identity))fail('WORKFLOW_IMMUTABLE_SOURCE_CONFLICT');
  if(!group){group={identity,sections:[]};groups.set(key,group);}group.sections.push(s);
 }
 const records=new Map(),incomplete=[];
 for(const [key,g] of groups){let end=0,text='',bad=false;const decisions=new Set();
  for(const s of g.sections.sort((a,b)=>a.start-b.start||a.end-b.end)){
   decisions.add(s.authorizationDecisionId);
   if(s.start<end){if(text.slice(s.start,s.end)!==s.text){bad=true;break;}if(s.end<=end)continue;}
   if(s.start!==end){bad=true;break;}text+=s.text;end=s.end;
  }
  if(bad||end!==g.identity.total||text.length!==end){incomplete.push({...g.identity,reason:'MISSING_OR_CONFLICTING_BODY_SECTIONS',readSections:g.sections.map(s=>({start:s.start,end:s.end}))});continue;}
  if(utf8Sha(text)!==g.identity.contentSha256)fail('WORKFLOW_MATERIAL_HASH');
  const last=g.sections.at(-1),record={sourceId:g.identity.sourceId,recordId:g.identity.recordId,recordVersionId:g.identity.recordVersionId,content:{kind:'full-read',text},contentSha256:g.identity.contentSha256,citationId:g.sections[0].citationId,scopes:g.identity.scopes,metadata:g.identity.metadata};
  records.set(key,{record,source:last.source,authorizationDecisionId:last.authorizationDecisionId,authorizationDecisionIds:[...decisions],receiptSha256s:[...new Set(g.sections.map(s=>s.receiptSha256))],verification:g.identity.metadata.materialKind==='stored-extracted-section'?'bound-extracted-section':'bound-source-excerpt'});
 }
 return {records,incomplete};
}
