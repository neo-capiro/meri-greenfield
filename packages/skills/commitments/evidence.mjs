/** Read correlation only. Qualified gateway reads and current control authority remain required. */
import {createHash} from 'node:crypto';
import {assertEvidence,assertSubject,assertWindow} from '../../contracts/retrieval-0.2/validate.mjs';
import {validateShape as publicShape,canonicalSha256 as hash} from '../../contracts/validate.mjs';
import {data,own} from '../../contracts/commands-0.2/execution-boundary.mjs';
import {selectSkill} from '../index.mjs';

export const same=(a,b)=>hash(a)===hash(b);
export const fail=code=>{throw new Error(code);};
export function text(value,max=2000){if(typeof value!=='string'||!value.length||value.length>max||!value.isWellFormed())fail('COMMITMENTS_INPUT');return value;}
const digest=value=>createHash('sha256').update(Buffer.from(value)).digest('hex');
const sourceIds=[...new Set(selectSkill('quick_skill.commitments_audit','1.0.0').manifest.requiredSources.map(row=>row.sourceId))];
const allowed=selectSkill('quick_skill.commitments_audit','1.0.0').manifest.allowedOperations;

export function bindReads(rawContext,rawReads){
  const context=data(own(rawContext,['binding','subject','window','asOf','mondayBoardIds']));
  publicShape('RunBinding',context.binding);assertSubject(context.subject,context.binding);assertWindow(context.window);
  if(context.subject.kind!=='client'||context.subject.entityIds.length!==1||!Number.isFinite(Date.parse(context.asOf))||
    !/^\d{4}-\d\d-\d\dT.*Z$/u.test(context.asOf)||!Array.isArray(context.mondayBoardIds)||context.mondayBoardIds.length>100||
    new Set(context.mondayBoardIds).size!==context.mondayBoardIds.length)fail('COMMITMENTS_CONTEXT');
  context.mondayBoardIds.forEach(id=>text(id,256));
  const reads=data(rawReads);
  if(!Array.isArray(reads)||reads.length>64)fail('COMMITMENTS_INPUT');
  const records=new Map(),coverage=new Map();
  for(const envelope of reads){
    assertEvidence(envelope);
    if(!same(envelope.binding,context.binding)||!same(envelope.subject,context.subject)||!same(envelope.window,context.window)||
      !allowed.some(ref=>same(ref,envelope.operation))||envelope.sources.length!==1||
      !sourceIds.includes(envelope.sources[0].sourceId)||Date.parse(envelope.sources[0].retrievedAt)>Date.parse(context.asOf)||
      envelope.data!==null&&envelope.method!=='source-read')fail('COMMITMENTS_READ_BINDING');
    const source=envelope.sources[0],sourceId=source.sourceId;
    if(sourceId==='client_knowledge_monday'&&(!context.mondayBoardIds.length||
      !envelope.appliedFilters.some(filter=>filter.name==='board_ids'&&filter.valueSha256===hash([...context.mondayBoardIds].sort()))))fail('COMMITMENTS_MONDAY_SCOPE');
    if(coverage.has(sourceId))fail('COMMITMENTS_DUPLICATE_SOURCE'); // Pass the retained full read; incomplete continuation stays visible.
    coverage.set(sourceId,{sourceId,status:source.status,freshness:source.freshness,asOf:source.asOf,retrievedAt:source.retrievedAt,
      snapshotVersionId:source.snapshotVersionId,enumeration:envelope.coverage.enumeration,
      returnedCount:envelope.coverage.returnedCount,limitations:envelope.coverage.limitations,
      continuation:envelope.continuation,complete:envelope.status==='complete'});
    for(const record of envelope.data?.records??[]){
      if(record.content.kind!=='full-read'||record.contentSha256!==digest(record.content.text))fail('COMMITMENTS_READ_HASH');
      const key=hash([record.sourceId,record.recordId,record.recordVersionId]);
      if(records.has(key))fail('COMMITMENTS_DUPLICATE_RECORD');
      records.set(key,{record,source,authorizationDecisionId:envelope.subject.authorizationDecisionId});
    }
  }
  const cells=sourceIds.map(sourceId=>coverage.get(sourceId)??{sourceId,status:sourceId==='client_knowledge_monday'&&!context.mondayBoardIds.length?'not-mapped':'not-read',
    freshness:'unknown',asOf:null,retrievedAt:null,snapshotVersionId:null,enumeration:'unknown',returnedCount:0,
    limitations:[sourceId==='client_knowledge_monday'&&!context.mondayBoardIds.length?'No authorized client board mapping was supplied.':'Required source has no decisive read.'],
    continuation:{cursor:null,requiredReads:[],remainingSources:[sourceId]},complete:false});
  return {context,records,coverage:cells};
}
export function passage(raw,bound){
  const p=data(own(raw,['sourceId','recordId','recordVersionId','start','end','quote']));
  for(const name of ['sourceId','recordId','recordVersionId'])text(p[name],256);
  text(p.quote,200000);
  const found=bound.records.get(hash([p.sourceId,p.recordId,p.recordVersionId]));
  if(!found||!Number.isSafeInteger(p.start)||!Number.isSafeInteger(p.end)||p.start<0||p.end<=p.start||p.end>found.record.content.text.length||
    found.record.content.text.slice(p.start,p.end)!==p.quote)fail('COMMITMENTS_PASSAGE');
  return {...p,citationId:found.record.citationId,contentSha256:found.record.contentSha256,passageSha256:digest(p.quote),
    scopes:found.record.scopes,authorizationDecisionId:found.authorizationDecisionId,observedAt:found.source.retrievedAt,
    freshness:found.source.freshness,verification:'bound-source-excerpt'};
}
