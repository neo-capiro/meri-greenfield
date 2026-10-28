/** Bind gateway-owned canonical decisive reads for the general cited report; never authenticate model
 * citations. The passage, observation and conflict kernel is the existing shared one; only the read
 * identity rule for a general subject is added here. */
import {artifactValidators as v,assertEvidence} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {fail,text} from './input.mjs';
import {citedReportReadOperation} from './skill.mjs';
import {sha,filterName,assessFacts} from '../research-brief/evidence.mjs';
export {sha,filterName,assessFacts};
export function bindRead(value,call,asOf,selected){
 if(!selected||typeof selected!=='object')fail('CITED_REPORT_READ_BINDING');
 const r=own(v.snapshot(value),['envelope','evidence']),e=r.envelope;assertEvidence(e),selected;
 if(v.hash(e.binding)!==v.hash(call.binding)||v.hash(e.subject.scopes)!==v.hash(call.scopes)||e.method!=='source-read'||
  e.argumentsSha256!==v.hash(call.selector)||e.coverage.sourcesRequested.length!==1||e.coverage.sourcesRequested[0]!==call.sourceId||
  e.sources.length!==1||e.sources[0].sourceId!==call.sourceId||
  v.hash(citedReportReadOperation(call.sourceId))!==v.hash(e.operation)||
  // The read must have been made as exactly the trusted selected subject, with its own scopes and roster.
  e.subject.kind!==selected.subject.kind||v.hash(e.subject.entityIds)!==v.hash(selected.subject.entityIds)||
  e.subject.rosterVersionId!==selected.subject.rosterVersionId||v.hash(e.subject.scopes)!==v.hash(selected.subject.scopes)||
  !Object.entries(call.selector.subject).every(([name,val])=>{
   const matches=e.appliedFilters.filter(f=>f.name===filterName(name));
   return matches.length===1&&matches[0].valueSha256===v.hash(val);
  })||
  Date.parse(e.sources[0].retrievedAt)>Date.parse(asOf)||
  !Array.isArray(r.evidence)||r.evidence.length>40)fail('CITED_REPORT_READ_BINDING');
 const records=e.data?.records??[];if(records.length!==r.evidence.length||records.length>40)fail('CITED_REPORT_READ_BINDING');
 const ids=new Set();
 for(const record of records){
  const p=r.evidence.find(x=>x.citationId===record.citationId);if(!p)fail('CITED_REPORT_READ_BINDING');v.nativeSourceEvidence(p);
  if(ids.has(p.citationId)||v.hash(p.binding)!==v.hash(e.binding)||p.sourceId!==call.sourceId||p.recordId!==record.recordId||p.sourceVersionId!==record.recordVersionId||
   p.contentSha256!==record.contentSha256||p.contentSha256!==sha(Buffer.from(record.content.text))||
   v.hash(p.scopes)!==v.hash(record.scopes)||p.scopes.some(s=>!call.scopes.some(t=>v.hash(s)===v.hash(t)))||
   p.observedAt!==e.sources[0].retrievedAt||Date.parse(p.observedAt)>Date.parse(asOf)||
   p.sourceUpdatedAt!==null&&Date.parse(p.sourceUpdatedAt)>Date.parse(p.observedAt))fail('CITED_REPORT_READ_BINDING');
  text(record.content.text,200000);ids.add(p.citationId);
 }
 return r;
}
