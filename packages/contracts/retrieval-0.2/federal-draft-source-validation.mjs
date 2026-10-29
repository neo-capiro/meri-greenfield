import {createHash} from 'node:crypto';
import {snapshotOperationData} from './operation-contracts.mjs';
import {canonicalSha256} from '../validate.mjs';
import canonicalize from 'canonicalize';
const fail=()=>{throw Error('FEDERAL_DRAFT_SOURCE_INVALID');};
const pins=['billId','versionCode','revisionId','versionHash','textHash'];
export function createFederalDraftSourceValidators({validateShape}){
 function normalizeInput(request,context={}){
  const input=snapshotOperationData(request),options=snapshotOperationData(context);
  if(!options||Object.keys(options).length)fail();
  validateShape('FederalDraftSourceInput',input);return {input};
 }
 function assertOutput(value,request){
  const {input}=normalizeInput(request),out=snapshotOperationData(value);
  validateShape('FederalDraftSourceOutput',out);
  const source=out.currentStatus==='available'?out.source:out.selection;
  if(pins.some(key=>source[key]!==input[key]))fail();
  if(out.currentStatus==='unavailable')return value;
  const bytes=Buffer.from(source.text,'utf8');
  if(bytes.length>131072||bytes.toString('utf8')!==source.text||source.text.includes('\0')||createHash('sha256').update(bytes).digest('hex')!==source.textHash)fail();
  const url=new URL(source.sourceLocator),hosts=source.provider==='govinfo'?['govinfo.gov','www.govinfo.gov','api.govinfo.gov']:['congress.gov','www.congress.gov'];
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||!hosts.includes(url.hostname))fail();
  return value;
 }
 const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b),digest=text=>createHash('sha256').update(text,'utf8').digest('hex');
 function normalizePreparation(request,context={}){
  const input=snapshotOperationData(request);validateShape('FederalDraftPreparationInput',input);normalizeInput(input.selection,context);
  const ids=new Set();
  for(const op of input.operations){
   if(ids.has(op.id)||digest(op.expectedText)!==op.expectedTextSha256||new Set(op.dependsOn).size!==op.dependsOn.length||op.dependsOn.some(id=>!ids.has(id)))fail();
   if(op.kind==='delete'?(op.text!==undefined||op.position!==undefined):op.text===undefined)fail();
   if(op.kind==='insert'?!['before','after'].includes(op.position):op.position!==undefined)fail();
   ids.add(op.id);
  }
  return {input};
 }
 function assertPreparation(value,request){
  const {input}=normalizePreparation(request),out=snapshotOperationData(value);validateShape('FederalDraftPrepared',out);
  assertOutput(out.nativeSource,input.selection);
  if(!same(out.sourceSelection,input.selection)||!same(out.draft.operations,input.operations))fail();
  const source=out.nativeSource.source,draft=out.draft;
  if(draft.source.text!==source.text||draft.source.sha256!==source.textHash||draft.source.sourceUrl!==source.sourceLocator||draft.source.publisher!==source.provider||draft.source.documentId!==source.billId||draft.source.sourceVersion!==source.versionCode+'/'+source.revisionId||draft.source.publishedAt!==(source.publishedAt?.slice(0,10)??null))fail();
  const {text,...metadata}=source;
  if(draft.source.coverage.limitations.at(-1)!=='Canonical federal source metadata: '+canonicalize(metadata)||!same(draft.source.scopes,[{id:'document',label:'the selected bill text',start:0,end:text.length,sha256:source.textHash}]))fail();
  const {revisionSha256,approval,...revision}=draft;if(canonicalSha256(revision)!==revisionSha256)fail();
  for(const kind of ['operative','consolidated','redline'])if(digest(draft.outputs[kind])!==draft.outputHashes[kind]||out.exports[kind].content.text!==draft.outputs[kind])fail();
  if(draft.outputs.segments.filter(p=>p.kind!=='insert').map(p=>p.text).join('')!==text||draft.outputs.segments.filter(p=>p.kind!=='delete').map(p=>p.text).join('')!==draft.outputs.consolidated)fail();
  return value;
 }
 return Object.freeze({normalizeInput,assertOutput,normalizePreparation,assertPreparation});
}
