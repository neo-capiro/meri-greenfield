/** Native congressional source receiving for the sourced cited report.
 * The report reads the real federal families through the trusted gateway port: every call is the
 * selected-runtime request shape {operation,request,binding,subject,window} and every answer is Core's
 * native typed {binding,subject,operation,argumentsSha256,result}. There is no synthetic EvidenceEnvelope,
 * no second retrieval loop and no invented envelope authority: the evidence emitted here is the artifact
 * NativeSourceEvidence shape, minted only from fields Core actually returned for a read that was received
 * and verified against the pinned contract. A citation id identifies this evidence instance; it is never a
 * claim that the source is authoritative, current or complete. */
import {createHash,randomUUID} from 'node:crypto';
import {artifactValidators as v,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {fail} from './input.mjs';
import {reportManifest,reportReadOperation,reportSourceIds} from './skill.mjs';
const sha256=value=>createHash('sha256').update(value,'utf8').digest('hex');
const same=(a,b)=>v.hash(a)===v.hash(b);
/** Declared report sources and the exact canonical selector each one can be asked for.
 * A null selector is a source this recipe cannot address with its congressional subject: it stays
 * disclosed as unread instead of being invented, silently dropped or replaced by a blanket refusal. */
const SOURCES=Object.freeze({
  bill_text:Object.freeze({id:'read_bill_text',selector:subject=>({billId:subject.billId,versionCode:subject.billVersion}),
    context:subject=>Object.freeze({defaultCongress:subject.congress})}),
  federal_legislation:Object.freeze({id:'get_bill_status',selector:subject=>({billId:subject.billId}),
    context:subject=>Object.freeze({defaultCongress:subject.congress})}),
  program_elements:Object.freeze({id:'get_pe_budget_timeline',selector:null,context:null}),
});
/** Private read ceilings. The gateway's own budgets and the run lifetime remain the outer bound. */
export const REPORT_SOURCE_LIMITS=Object.freeze({maxPages:8,maxBytes:1048576});
function declared(sourceId){
  const spec=SOURCES[sourceId];
  if(!spec)fail('REPORT_CONFIGURATION');
  let ref;try{ref=reportReadOperation(sourceId);}catch{ref=null;}
  if(!ref||ref.id!==spec.id||ref.version!=='0.2.0')fail('REPORT_CONFIGURATION');
  return {spec,ref,contract:resolveOperationContract(ref)};
}
/** The report's evidence verdict for one supplied finding, from the evidence actually received. */
export function assessReportFindings(findings,sources){
  const records=new Map();
  for(const source of sources)for(const record of source.records)records.set(`${record.recordId}\u0000${record.sourceVersionId}`,record);
  return findings.map(finding=>{
    const links=finding.citations.map(citation=>{
      const record=records.get(`${citation.recordId}\u0000${citation.sourceVersionId}`);
      if(!record)return {citation,status:'missing-or-version-mismatch',evidence:null,passage:null,passageSha256:null};
      if(record.evidence===null)return {citation,status:'not-bound-as-evidence',evidence:null,passage:null,passageSha256:null};
      if(record.text===null)return {citation,status:'no-exact-text',evidence:record.evidence,passage:null,passageSha256:null};
      if(citation.end>record.text.length)return {citation,status:'offset-outside-read-text',evidence:null,passage:null,passageSha256:null};
      const passage=record.text.slice(citation.start,citation.end);
      return {citation,status:'read-and-bound',evidence:record.evidence,passage,passageSha256:sha256(passage)};
    });
    let status='unverified-claim';
    if(finding.kind==='excerpt'){
      const first=links[0];
      status=first.status!=='read-and-bound'?'missing-evidence':first.passage!==finding.text?'quote-mismatch':'bound-excerpt';
    }
    const bound=new Set(links.filter(link=>link.passage!==null).map(link=>link.passage));
    return {id:finding.id,kind:finding.kind,text:finding.text,status,conflict:bound.size>1,links};
  });
}
/** One native receiving session over the compiler's trusted gateway port.
 * `selected` is the run's canonical selection (the identity the port checks); `subject` is the report's own
 * bill identity, which is the only thing that may address a source record. */
export function createReportNativeSources({readSource,selected,subject,context,asOf,limits=REPORT_SOURCE_LIMITS}){
  if(typeof readSource!=='function'||!Number.isSafeInteger(asOf))fail('REPORT_CONFIGURATION');
  const saved={binding:context.binding,subject:selected.subject,window:selected.window},receipts=[];
  const budget=reportManifest().budgets.maxToolCalls;
  let calls=0,bytes=0;
  for(const sourceId of reportSourceIds)declared(sourceId);
  /** The exact selected-runtime request. Identity is enforced by that owner, never assumed here. */
  async function read(sourceId,request,signal){
    const {ref,contract,spec}=declared(sourceId),normalizationContext=spec.context(subject);
    const normalized=contract.normalizeInput(request,normalizationContext);
    if(calls>=budget)fail('REPORT_SOURCE_BUDGET');calls++;
    const call=v.snapshot({operation:ref,request:normalized.request,binding:saved.binding,subject:saved.subject,window:saved.window});
    let raw;
    try{raw=await readSource({...call,...(signal===undefined?{}:{signal})});}
    catch(error){
      const code=error?.code??error?.message;
      // A cancelled or expired lifetime is the report's own abort, never a source limitation.
      if(code==='DEADLINE')fail('REPORT_DEADLINE');
      if(code==='CANCELLED')fail('REPORT_CANCELLED');
      if(code==='UNAVAILABLE'){receipts.push({sourceId,operation:ref,request:normalized.request,status:'unavailable',reason:code});return {unavailable:true,reason:code};}
      // Current authority and selector integrity are refusals: they may never be shown as missing data.
      if(code==='ACCESS_DENIED')fail('REPORT_SOURCE_AUTHORITY');
      if(code==='SKILL_COMPILER_CONTEXT_REFUSED')fail('REPORT_SOURCE_CONTEXT');
      if(code==='SKILL_OPERATION_REFUSED')fail('REPORT_SOURCE_OPERATION');
      // The gateway's own refusals of this request or this reply keep their meaning.
      if(code==='INVALID_ARGUMENTS')fail('REPORT_SOURCE_REQUEST');
      if(code==='INVALID_RESULT')fail('REPORT_SOURCE_RESULT');
      fail('REPORT_SOURCE_FAILED');
    }
    const received=v.snapshot(raw);bytes+=Buffer.byteLength(JSON.stringify(received),'utf8');
    if(bytes>limits.maxBytes)fail('REPORT_SOURCE_LIMIT');
    own(received,['binding','subject','operation','argumentsSha256','result']);
    if(!same(received.binding,saved.binding))fail('REPORT_SOURCE_BINDING');
    if(!same(received.subject,saved.subject))fail('REPORT_SOURCE_CONTEXT');
    if(!same(received.operation,ref))fail('REPORT_SOURCE_OPERATION');
    if(received.argumentsSha256!==normalized.argumentsSha256)fail('REPORT_SOURCE_ARGUMENTS');
    try{contract.assertOutput(received.result,{request:normalized.request,...normalizationContext});}
    catch{fail('REPORT_SOURCE_RESULT');}
    receipts.push({sourceId,operation:ref,request:normalized.request,resultSha256:v.hash(received)});
    return {result:received.result};
  }
  function bind(sourceId,recordId,sourceVersionId,observedAt,sourceUpdatedAt,contentSha256){
    const citationId=randomUUID();
    const item=v.nativeSourceEvidence({sourceId,recordId,sourceVersionId,observedAt,sourceUpdatedAt,contentSha256,
      citationId,scopes:context.scopes,binding:context.binding});
    return {citationId,item};
  }
  /** read_bill_text: bounded sequential pages of the one pinned bill-version revision. */
  async function billText(signal){
    const spec=SOURCES.bill_text,limitations=[],pages=[];
    let request=spec.selector(subject),text='',offset=0,pin=null,reason=null,status='read',total=null;
    for(let page=0;;page++){
      if(page>=limits.maxPages){status='partial';reason='PAGE_CEILING_REACHED';
        limitations.push(`Stopped after ${limits.maxPages} pages; the bill-version text received is not the whole document.`);break;}
      const next=await read('bill_text',request,signal);
      if(next.unavailable){status='unavailable';reason=next.reason;
        limitations.push('No current complete bill-version text was returned, so no bill-text evidence was bound.');break;}
      const value=next.result;
      if(value.found!==true||value.currentStatus!=='available')fail('REPORT_SOURCE_RESULT');
      // The subject named one bill and one version; any other record is a substitution, not a read.
      if(value.billId!==subject.billId)fail('REPORT_SOURCE_SELECTOR');
      if(value.versionCode!==subject.billVersion)fail('REPORT_SOURCE_VERSION');
      const identity={recordId:value.billId,sourceVersionId:value.revisionId,versionCode:value.versionCode,packageId:value.packageId,
        versionHash:value.versionHash,textHash:value.textHash,sourceLocator:value.sourceLocator,
        observedAt:value.fetchedAt,sourceUpdatedAt:value.sourceModifiedAt,publishedAt:value.publishedAt};
      // Every page must belong to the same immutable revision; a moved pin is not a continuation.
      if(pin===null)pin=identity;else if(!same(pin,identity))fail('REPORT_SOURCE_VERSION');
      if(value.coverage.locator.offset!==offset)fail('REPORT_SOURCE_CONTINUITY');
      if(value.coverage.locator.endOffset-value.coverage.locator.offset!==value.text.length)fail('REPORT_SOURCE_CONTINUITY');
      pages.push({offset:value.coverage.locator.offset,endOffset:value.coverage.locator.endOffset,
        totalCharacters:value.coverage.totalCharacters,nextCursor:value.coverage.nextCursor,truncated:value.coverage.truncated});
      text+=value.text;offset=value.coverage.locator.endOffset;total=value.coverage.totalCharacters;
      if(value.coverage.nextCursor===null)break;
      request=Object.freeze({...spec.selector(subject),cursor:value.coverage.nextCursor});
    }
    // `truncated` describes this read: a page that is not the whole document is normal, a read that stopped
    // early is not, and only the latter is reported as truncation.
    const coverage={pages:pages.length,offset,totalCharacters:total,complete:reason===null&&pages.length>0&&offset===total,
      truncated:reason!==null,nextCursor:null};
    if(reason!==null)return {sourceId:'bill_text',operation:spec.id,status,reason,pin,coverage,verified:false,evidence:null,records:[],
      limitations:[...limitations,`Only ${offset} of ${total===null?'unknown':total} characters were received, so no bill-text evidence was bound.`]};
    if(!coverage.complete)fail('REPORT_SOURCE_CONTINUITY');
    // The pinned text hash is the identity of the text this report may cite: unequal bytes are not citable.
    if(sha256(text)!==pin.textHash)fail('REPORT_SOURCE_TEXT_HASH');
    if(pin.observedAt===null)fail('REPORT_SOURCE_RESULT');
    if(Date.parse(pin.observedAt)>asOf)return {sourceId:'bill_text',operation:spec.id,status:'read',reason:null,pin,coverage,verified:true,
      evidence:null,records:[],limitations:[...limitations,`Observed ${pin.observedAt}, after the report as-of instant; it is disclosed but not bound as evidence.`]};
    const bound=bind('bill_text',pin.recordId,pin.sourceVersionId,pin.observedAt,pin.sourceUpdatedAt,pin.textHash);
    return {sourceId:'bill_text',operation:spec.id,status:'read',reason:null,pin,coverage,verified:true,evidence:bound.item,
      records:[{recordId:pin.recordId,sourceVersionId:pin.sourceVersionId,text,evidence:bound.item,citationId:bound.citationId}],
      limitations:[...limitations,`Pinned text SHA256 ${pin.textHash} was recomputed over the received text and matched.`]};
  }
  /** get_bill_status: the current stored status record for the same bill identity. */
  async function billStatus(signal){
    const spec=SOURCES.federal_legislation,next=await read('federal_legislation',spec.selector(subject),signal);
    if(next.unavailable)return {sourceId:'federal_legislation',operation:spec.id,status:'unavailable',reason:next.reason,
      evidence:null,records:[],limitations:['No current stored bill status was returned, so no status evidence was bound.']};
    const value=next.result;
    if(value.billId!==subject.billId)fail('REPORT_SOURCE_SELECTOR');
    if(value.currentStatus==='invalid_request')return {sourceId:'federal_legislation',operation:spec.id,status:'refused',reason:'INVALID_REQUEST',
      evidence:null,records:[],currentStatus:value.currentStatus,note:value.note,
      limitations:[`The stored bill selector was refused: ${value.note}`]};
    const observed=value.currentStatus==='available'?value.generatedAt:null;
    const fields={title:value.title??null,currentStatus:value.currentStatus,billStatus:value.status??null,statusLabel:value.statusLabel??null,
      statusAt:value.statusAt??null,latestAction:value.latestAction??null,note:value.note??null,observed};
    if(value.currentStatus==='unavailable')return {sourceId:'federal_legislation',operation:spec.id,status:'unavailable',reason:'UNAVAILABLE',
      evidence:null,records:[],...fields,limitations:[`No stored status is on record for ${subject.billId}: ${value.note}`]};
    if(observed===null)fail('REPORT_SOURCE_RESULT');
    if(Date.parse(observed)>asOf)return {sourceId:'federal_legislation',operation:spec.id,status:'read',reason:null,evidence:null,records:[],...fields,
      limitations:[`Observed ${observed}, after the report as-of instant; it is disclosed but not bound as evidence.`]};
    const bound=bind('federal_legislation',value.billId,observed,observed,null,v.hash(value));
    return {sourceId:'federal_legislation',operation:spec.id,status:'read',reason:null,...fields,evidence:bound.item,
      records:[{recordId:value.billId,sourceVersionId:observed,text:null,evidence:bound.item,citationId:bound.citationId}],limitations:[]};
  }
  const readers=Object.freeze({bill_text:billText,federal_legislation:billStatus});
  return Object.freeze({receipts:()=>v.snapshot(receipts),async collect(signal){
    const sources=[];
    for(const sourceId of reportSourceIds){
      const reader=readers[sourceId];
      if(reader){sources.push(await reader(signal));continue;}
      // Declared but not addressable from this report's subject: disclosed, never fabricated.
      const spec=SOURCES[sourceId];
      sources.push({sourceId,operation:spec.id,status:'not-read',reason:'NO_CANONICAL_SELECTOR',evidence:null,records:[],
        limitations:[`The report subject carries no canonical program-element selector, so ${spec.id} was not read and no program-element evidence is claimed.`]});
    }
    return sources;
  }});
}
