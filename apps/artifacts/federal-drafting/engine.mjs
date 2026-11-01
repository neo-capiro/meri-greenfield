/** Deterministic amendments for an exact UTF-8 plain-text federal source snapshot. This private compiler neither
 * fetches legislation nor decides legal correctness. Canonical source custody and publication stay with artifacts.
 * Flat v1, explicitly nested scoped-text v2 and raw USLM XML v1 retain separate parser identities. USLM scopes are
 * the declared element spans derived by `uslm-source.mjs`; a compiled USLM result must still read as one document. */
import {createHash} from 'node:crypto';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertFederalTextLayout,FEDERAL_SCOPED_TEXT_PARSER,FEDERAL_USLM_XML_PARSER,FEDERAL_USLM_SCHEMA_PARSER,isFederalUslm,FEDERAL_PARSERS} from '../../../packages/contracts/federal-workbench/source-layout.mjs';
import {scopedApplication} from './scoped-application.mjs';
import {deriveUslmScopes,assertUslmResult,USLM_ROOT_SCOPE} from './uslm-source.mjs';
import canonicalize from 'canonicalize';
import {assertSchemaReceipt} from '../../../packages/contracts/federal-workbench/schema-receipt.mjs';
export {FEDERAL_SCOPED_TEXT_PARSER};

export const FEDERAL_TEXT_PARSER='federal-plain-text/1';
export const DRAFT_LIMITS=Object.freeze({sourceBytes:131072,scopes:128,uslmScopes:1024,operations:64,operationBytes:16384});
const SHA=/^[a-f0-9]{64}$/u,ID=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u;
export const textSha256=text=>createHash('sha256').update(text,'utf8').digest('hex');
const fault=(code,operationId=null)=>{throw Object.assign(Error(code),{code,operationId});};
const text=(value,max)=>typeof value==='string'&&value.length>0&&!value.includes('\0')&&Buffer.from(value).toString('utf8')===value&&Buffer.byteLength(value)<=max;
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

/** Identity is supplied by the source custodian, not inferred from text or an amendment instruction. */
export function federalDraftSource(raw){
 let source;try{source=data(own(raw,['documentId','publisher','sourceVersion','sourceUrl','publishedAt','parserVersion','sha256','text','coverage','scopes'],['validation']));}catch{fault('DRAFT_SOURCE_INVALID');}
 for(const field of ['documentId','publisher','sourceVersion'])if(!text(source[field],512))fault('DRAFT_SOURCE_INVALID');
 let url;try{url=new URL(source.sourceUrl);}catch{fault('DRAFT_SOURCE_INVALID');}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search||!text(source.sourceUrl,2048))fault('DRAFT_SOURCE_INVALID');
 const date=typeof source.publishedAt==='string'?Date.parse(source.publishedAt+'T00:00:00Z'):NaN;
 if(source.publishedAt!==null&&(!/^\d{4}-\d{2}-\d{2}$/u.test(source.publishedAt)||!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==source.publishedAt))fault('DRAFT_SOURCE_INVALID');
 if(!FEDERAL_PARSERS.includes(source.parserVersion)||!SHA.test(source.sha256)||!text(source.text,DRAFT_LIMITS.sourceBytes)||textSha256(source.text)!==source.sha256)fault('DRAFT_SOURCE_MISMATCH');
 let coverage;try{coverage=own(source.coverage,['complete','limitations']);}catch{fault('DRAFT_SOURCE_INVALID');}
 if(typeof coverage.complete!=='boolean'||!Array.isArray(coverage.limitations)||coverage.limitations.length>32||coverage.limitations.some(v=>!text(v,1000))||!coverage.complete&&!coverage.limitations.length)fault('DRAFT_SOURCE_INVALID');
 const uslm=isFederalUslm(source.parserVersion),nested=uslm||source.parserVersion===FEDERAL_SCOPED_TEXT_PARSER;
 if(!Array.isArray(source.scopes)||!source.scopes.length||source.scopes.length>(uslm?DRAFT_LIMITS.uslmScopes:DRAFT_LIMITS.scopes))fault('DRAFT_SOURCE_INVALID');
 const seen=new Set();
 for(const rawScope of source.scopes){
  let scope;try{scope=own(rawScope,['id','label','start','end','sha256',...(nested?['ancestorPath']:[])]);}catch{fault('DRAFT_SCOPE_INVALID');}
  if(!ID.test(scope.id)||seen.has(scope.id)||!text(scope.label,512)||!Number.isSafeInteger(scope.start)||!Number.isSafeInteger(scope.end)
   ||scope.start<0||scope.end<=scope.start||scope.end>source.text.length||!SHA.test(scope.sha256))fault('DRAFT_SCOPE_INVALID');
  seen.add(scope.id);
 }
 assertFederalTextLayout(source);
 if(source.parserVersion===FEDERAL_USLM_SCHEMA_PARSER)assertSchemaReceipt(source.validation,source.sha256,Buffer.byteLength(source.text));
 else if(Object.hasOwn(source,'validation'))fault('DRAFT_SOURCE_INVALID');
 for(const scope of source.scopes){const slice=source.text.slice(scope.start,scope.end);
  if(Buffer.from(slice).toString('utf8')!==slice||textSha256(slice)!==scope.sha256)fault('DRAFT_SCOPE_MISMATCH');}
 // Declared USLM identity must be exactly what the one derivation owner reads from the bytes; no custodian may
 // declare an element span, identifier or ancestry the markup does not carry.
 if(uslm&&canonicalize(deriveUslmScopes(source.text,source.parserVersion).scopes)!==canonicalize(source.scopes))fault('DRAFT_USLM_SCOPES_MISMATCH');
 return freeze(source);
}

function operation(raw,seen){
 let op;try{
  const candidate=data(own(raw,['id','kind','expectedTextSha256','dependsOn'],['scopeId','expectedScopeSha256','expectedText','text','position','expectedSourceSha256']));
  op=data(candidate.kind==='remove_source_text'?own(candidate,['id','kind','expectedSourceSha256','expectedTextSha256','dependsOn']):
   own(candidate,['id','kind','scopeId','expectedScopeSha256','expectedText','expectedTextSha256','dependsOn'],['text','position']));
 }catch{fault('DRAFT_OPERATION_INVALID');}
 const refuse=code=>fault(code,op.id);
 if(op.kind==='remove_source_text'){
  if(!ID.test(op.id)||seen.has(op.id)||!SHA.test(op.expectedSourceSha256)||!SHA.test(op.expectedTextSha256))refuse('DRAFT_OPERATION_INVALID');
  if(!Array.isArray(op.dependsOn)||new Set(op.dependsOn).size!==op.dependsOn.length||op.dependsOn.some(id=>!seen.has(id)))refuse('DRAFT_DEPENDENCY_INVALID');
  return op;
 }
 if(!ID.test(op.id)||seen.has(op.id)||!ID.test(op.scopeId)||!['replace','insert','delete'].includes(op.kind)
  ||!SHA.test(op.expectedScopeSha256)||!text(op.expectedText,DRAFT_LIMITS.operationBytes)||!SHA.test(op.expectedTextSha256)
  ||textSha256(op.expectedText)!==op.expectedTextSha256)refuse('DRAFT_OPERATION_INVALID');
 if(!Array.isArray(op.dependsOn)||new Set(op.dependsOn).size!==op.dependsOn.length||op.dependsOn.some(id=>!seen.has(id)))refuse('DRAFT_DEPENDENCY_INVALID');
 if(op.kind==='delete'?(op.text!==undefined||op.position!==undefined):!text(op.text,DRAFT_LIMITS.operationBytes))refuse('DRAFT_OPERATION_INVALID');
 if(op.kind==='insert'?!['before','after'].includes(op.position):op.position!==undefined)refuse('DRAFT_OPERATION_INVALID');
 if(op.kind==='replace'&&op.text===op.expectedText)refuse('DRAFT_NO_CHANGE');
 return op;
}

function apply(scope,op){
 if(textSha256(scope)!==op.expectedScopeSha256)fault('DRAFT_ANCESTOR_CHANGED',op.id);
 const at=scope.indexOf(op.expectedText);
 if(at<0)fault('DRAFT_TARGET_MISSING',op.id);
 if(scope.indexOf(op.expectedText,at+1)>=0)fault('DRAFT_TARGET_AMBIGUOUS',op.id);
 const start=op.kind==='insert'&&op.position==='after'?at+op.expectedText.length:at;
 const end=op.kind==='insert'?start:at+op.expectedText.length,replacement=op.kind==='delete'?'':op.text;
 return {text:scope.slice(0,start)+replacement+scope.slice(end),start,end,replacement};
}

/** A redline is a typed sequence of unchanged/deleted/inserted exact text, not markup that can be confused with
 * literal source characters. One replacement span per changed scope makes the original/final relation explicit. */
function redline(before,after){
 const original=Array.from(before),revised=Array.from(after);
 let left=0;while(left<original.length&&left<revised.length&&original[left]===revised[left])left++;
 let right=0;while(right<original.length-left&&right<revised.length-left&&original[original.length-1-right]===revised[revised.length-1-right])right++;
 return [{kind:'unchanged',text:original.slice(0,left).join('')},{kind:'delete',text:original.slice(left,original.length-right).join('')},
  {kind:'insert',text:revised.slice(left,revised.length-right).join('')},{kind:'unchanged',text:original.slice(original.length-right).join('')}].filter(part=>part.text);
}

/** Adjacent segments of one kind are one segment: the comparison depends on the exact text and operations alone,
 * never on how scopes or surviving pieces happened to partition it. */
function merged(parts){
 const segments=[];
 for(const part of parts){
  if(!part.text)continue;
  if(segments.length&&segments.at(-1).kind===part.kind)segments[segments.length-1]={kind:part.kind,text:segments.at(-1).text+part.text};
  else segments.push({kind:part.kind,text:part.text});
 }
 return segments;
}
function outputs(source,ops,working,scoped){
 const amendment=[],parts=[];let cursor=0;
 if(scoped)for(const {before,after} of scoped.comparisons())parts.push(...(before===after?[{kind:'unchanged',text:before}]:redline(before,after)));
 else for(const scope of source.scopes){
  const before=source.text.slice(scope.start,scope.end),after=working.get(scope.id);
  if(scope.start>cursor)parts.push({kind:'unchanged',text:source.text.slice(cursor,scope.start)});
  parts.push(...(before===after?[{kind:'unchanged',text:before}]:redline(before,after)));cursor=scope.end;
 }
 if(!scoped&&cursor<source.text.length)parts.push({kind:'unchanged',text:source.text.slice(cursor)});
 const segments=ops.at(-1)?.kind==='remove_source_text'?[{kind:'delete',text:source.text}]:merged(parts);
 for(const op of ops){
  if(op.kind==='remove_source_text'){
   amendment.push(`${op.id}. Proposed removal of all selected source text from ${source.documentId}, bound to original SHA-256 ${op.expectedSourceSha256} and current text SHA-256 ${op.expectedTextSha256}. Consolidated source text is empty. This proposal does not establish enactment or legal effect.`);
   continue;
  }
  const label=source.scopes.find(scope=>scope.id===op.scopeId).label;
  const action=op.kind==='replace'?`strike ${JSON.stringify(op.expectedText)} and insert ${JSON.stringify(op.text)}`
   :op.kind==='delete'?`strike ${JSON.stringify(op.expectedText)}`:`insert ${JSON.stringify(op.text)} ${op.position} ${JSON.stringify(op.expectedText)}`;
  amendment.push(`${op.id}. In ${label}, ${action}.`);
 }
 const citation=`${source.documentId}; ${source.publisher}; version ${source.sourceVersion}; published ${source.publishedAt??'unreported'}; ${source.sourceUrl}; SHA-256 ${source.sha256}`;
 return {operative:`Source: ${citation}\nOperations apply in the stated order.\n\n${amendment.join('\n\n')}\n`,
  consolidated:segments.filter(part=>part.kind!=='delete').map(part=>part.text).join(''),
  redline:`Source: ${citation}\nExact legal text comparison; each line is a JSON text segment.\n${segments.map(part=>JSON.stringify(part)).join('\n')}\n`,segments};
}

/** Validates every intermediate scope on private copies. Any invalid operation throws before an output exists. */
export function compileFederalDraft(rawSource,rawOperations){
 const source=federalDraftSource(rawSource);
 if(!Array.isArray(rawOperations)||!rawOperations.length||rawOperations.length>DRAFT_LIMITS.operations)fault('DRAFT_OPERATION_INVALID');
 const scoped=source.parserVersion===FEDERAL_TEXT_PARSER?null:scopedApplication(source);
 const working=new Map(source.scopes.map(scope=>[scope.id,source.text.slice(scope.start,scope.end)])),last=new Map(),seen=new Set(),operations=[];
 for(const raw of rawOperations){
  const op=operation(raw,seen);
  if(operations.at(-1)?.kind==='remove_source_text')fault('DRAFT_SOURCE_REMOVED',op.id);
  if(op.kind==='remove_source_text'){
   if(!source.coverage.complete)fault('DRAFT_SOURCE_INCOMPLETE',op.id);
   if(op.expectedSourceSha256!==source.sha256)fault('DRAFT_SOURCE_MISMATCH',op.id);
   const closure=new Set(),include=id=>{if(closure.has(id))return;closure.add(id);operations.find(previous=>previous.id===id).dependsOn.forEach(include);};
   op.dependsOn.forEach(include);
   if([...seen].some(id=>!closure.has(id)))fault('DRAFT_DEPENDENCY_REQUIRED',op.id);
   const current=outputs(source,operations,working,scoped).consolidated;
   if(textSha256(current)!==op.expectedTextSha256)fault('DRAFT_ANCESTOR_CHANGED',op.id);
   if(!current.length)fault('DRAFT_NO_CHANGE',op.id);
   operations.push(op);seen.add(op.id);continue;
  }
  const current=scoped?.read(op),before=current?current.text:working.get(op.scopeId);if(before===undefined)fault('DRAFT_SCOPE_UNKNOWN',op.id);
  if(!scoped&&last.has(op.scopeId)&&!op.dependsOn.includes(last.get(op.scopeId)))fault('DRAFT_DEPENDENCY_REQUIRED',op.id);
  const edit=apply(before,op),after=edit.text;if(Buffer.byteLength(after)>DRAFT_LIMITS.sourceBytes)fault('DRAFT_OUTPUT_LIMIT',op.id);
  if(scoped){scoped.apply(op,edit,current.closure);if(Buffer.byteLength(scoped.text)>DRAFT_LIMITS.sourceBytes)fault('DRAFT_OUTPUT_LIMIT',op.id);}
  working.set(op.scopeId,after);seen.add(op.id);last.set(op.scopeId,op.id);operations.push(op);
 }
 const result=outputs(source,operations,working,scoped),removed=operations.at(-1).kind==='remove_source_text';
 if(Buffer.byteLength(result.consolidated)>DRAFT_LIMITS.sourceBytes)fault('DRAFT_OUTPUT_LIMIT');
 // Removing the entire source is a proposed repeal, not a text amendment: there is no exact consolidated text to
 // retain, so it is an explicit refusal rather than an empty document or a placeholder that falsifies bytes.
 if(!removed&&(!result.consolidated.length||isFederalUslm(source.parserVersion)&&working.get(USLM_ROOT_SCOPE)===''))fault('DRAFT_WHOLE_SOURCE_REPEAL_UNSUPPORTED');
 if(result.consolidated===source.text)fault('DRAFT_NO_CHANGE');
 if(!removed&&isFederalUslm(source.parserVersion))assertUslmResult(result.consolidated,deriveUslmScopes(source.text,source.parserVersion).root,DRAFT_LIMITS.uslmScopes,source.parserVersion);
 const findings=[{category:'source-integrity',status:'passed',location:source.documentId,severity:'info'},
  ...operations.map(op=>({category:'exact-target',status:'passed',location:op.scopeId??source.documentId,operationId:op.id,severity:'info'})),
  ...['numbering','cross-references','arithmetic','substantive-law'].map(category=>({category,status:'unresolved',location:source.documentId,severity:'review-required'}))];
 const revision={parserVersion:source.parserVersion,source,operations,outputs:result,findings,...(removed?{resultKind:'source-text-removed'}:{}),
  outputHashes:Object.fromEntries(['operative','consolidated','redline'].map(kind=>[kind,textSha256(result[kind])]))};
 return freeze({...revision,revisionSha256:canonicalSha256(revision),approval:'unapproved'});
}
