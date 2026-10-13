/** Bind gateway-owned canonical decisive reads; never authenticate model citations. */
import {createHash} from 'node:crypto';
import {artifactValidators as v,assertEvidence} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {validateShape as publicShape} from '../../../../packages/contracts/validate.mjs';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {fail,text} from './input.mjs';
import {briefReadOperation} from './skill.mjs';
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const filterName=name=>name.replace(/[A-Z]/gu,x=>'_'+x.toLowerCase());
export function bindRead(value,call,asOf){
  const r=own(v.snapshot(value),['envelope','evidence']),e=r.envelope;assertEvidence(e);
  if(v.hash(e.binding)!==v.hash(call.binding)||v.hash(e.subject.scopes)!==v.hash(call.scopes)||e.method!=='source-read'||
    e.argumentsSha256!==v.hash(call.selector)||e.coverage.sourcesRequested.length!==1||e.coverage.sourcesRequested[0]!==call.sourceId||
    e.sources.length!==1||e.sources[0].sourceId!==call.sourceId||
    v.hash(briefReadOperation(call.sourceId))!==v.hash(e.operation)||e.subject.kind!=='client'||
    !call.scopes.some(x=>x.kind==='client'&&x.resourceId===e.subject.entityIds[0])||
    !Object.entries(call.selector.subject).every(([name,val])=>e.appliedFilters.some(f=>f.name===filterName(name)&&f.valueSha256===v.hash(val)))||
    Date.parse(e.sources[0].retrievedAt)>Date.parse(asOf)||
    !Array.isArray(r.evidence)||r.evidence.length>40)fail('BRIEF_READ_BINDING');
  const records=e.data?.records??[];if(records.length!==r.evidence.length||records.length>40)fail('BRIEF_READ_BINDING');
  const ids=new Set();
  for(const record of records){
    const p=r.evidence.find(x=>x.citationId===record.citationId);if(!p)fail('BRIEF_READ_BINDING');publicShape('SourceEvidence',p);
    if(ids.has(p.citationId)||p.authorizationDecisionId!==e.subject.authorizationDecisionId||p.sourceId!==call.sourceId||p.recordId!==record.recordId||p.sourceVersionId!==record.recordVersionId||
      p.contentSha256!==record.contentSha256||p.contentSha256!==sha(Buffer.from(record.content.text))||
      v.hash(p.scopes)!==v.hash(record.scopes)||p.scopes.some(s=>!call.scopes.some(t=>v.hash(s)===v.hash(t)))||
      p.observedAt!==e.sources[0].retrievedAt||Date.parse(p.observedAt)>Date.parse(asOf)||
      p.sourceUpdatedAt!==null&&Date.parse(p.sourceUpdatedAt)>Date.parse(p.observedAt))fail('BRIEF_READ_BINDING');
    text(record.content.text,200000);ids.add(p.citationId);
  }
  return r;
}
export function assessFacts(facts,reads){
  return facts.map(f=>{
    const links=f.citations.map(c=>{
      const read=reads.find(x=>x.envelope.sources[0].sourceId===c.sourceId),record=read?.envelope.data?.records.find(x=>x.recordId===c.recordId&&x.recordVersionId===c.sourceVersionId);
      if(!record||c.end>record.content.text.length)return {citation:c,status:'missing-or-version-mismatch',evidence:null,passage:null};
      const passage=record.content.text.slice(c.start,c.end),evidence=read.evidence.find(x=>x.citationId===record.citationId);
      return {citation:c,status:'read-and-bound',evidence,passage,passageSha256:sha(Buffer.from(passage)),freshness:read.envelope.sources[0].freshness};
    });
    let status='unverified-claim';
    if(f.kind==='excerpt')status=links[0]?.status!=='read-and-bound'?'missing-evidence':links[0].passage!==f.text?'quote-mismatch':links[0].freshness!=='fresh'?'bound-excerpt-stale':'bound-excerpt';
    const distinct=new Set(links.filter(x=>x.passage!==null).map(x=>x.passage));
    const conflict=distinct.size>1; // Potential conflict only: unequal text is not a semantic contradiction proof.
    return {...f,status,conflict,links};
  });
}
