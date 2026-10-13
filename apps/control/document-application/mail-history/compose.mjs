/** Original skill output compiled to the existing editable Word specification. */
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {asset,input,selection,createCollection,same,fail} from './source.mjs';
import {readBody,sha} from './bodies.mjs';
const prepared=new WeakMap(),marker='Meri Mail History provenance: ';
const paragraph=(text,style='Normal')=>({kind:'paragraph',style,runs:[{text}]});
const defaults={maxCalls:24,maxCandidatePages:3,candidatePageSize:5,maxMessages:10,bodySectionCodeUnits:2000,maxBodyCodeUnits:120000,maxSourceBytes:2097152};
function baseRecord(value,base,context,i,selected){
 const r=own(v.snapshot(value),['version','spec','specSha256','requestSha256','inspection']);v.version(r.version);v.request(r.spec);v.inspection(r.inspection);
 if(r.version.versionId!==base.versionId||r.specSha256!==base.specSha256||r.specSha256!==v.hash(r.spec)||r.version.binding.tenantId!==context.binding.tenantId||r.version.binding.actorId!==context.binding.actorId||r.version.binding.conversationId!==context.binding.conversationId||!same(r.version.scopes,context.scopes)||r.spec.operation!=='create_word'||r.spec.format!=='docx'||r.version.mimeType!=='application/vnd.openxmlformats-officedocument.wordprocessingml.document'||r.inspection.format!=='docx'||r.inspection.sha256!==r.version.object.sha256||r.inspection.bytes!==r.version.object.bytes)fail('MAIL_HISTORY_BASE');
 const matches=r.spec.content.blocks.filter(b=>b.kind==='paragraph'&&b.runs.length===1&&b.runs[0].text.startsWith(marker));if(matches.length!==1)fail('MAIL_HISTORY_BASE');
 let prior;try{prior=JSON.parse(matches[0].runs[0].text.slice(marker.length));}catch{fail('MAIL_HISTORY_BASE');}
 const stableSelection=s=>{const {authorizationDecisionId,...subject}=s.subject;return {subject,window:s.window};};
 if(!same(prior.skill,i.skill)||!same(stableSelection(prior.selection),stableSelection(selected))||!same(prior.target,i.target)||Date.parse(i.asOf)<Date.parse(prior.asOf))fail('MAIL_HISTORY_BASE_CONTEXT');
 return {versionId:r.version.versionId,objectSha256:r.version.object.sha256,specSha256:r.specSha256,provenanceSha256:v.hash(prior)};
}
function assessQuotes(quotes,bodies){return quotes.map(q=>{
 const body=bodies.find(b=>b.candidate.mailboxId===q.mailboxId&&b.candidate.threadId===q.threadId&&b.candidate.messageId===q.messageId);
 let status='missing-or-unread-version',evidence=null,passage=null;
 if(body?.evidence&&body.evidence.sourceVersionId===q.sourceVersionId){passage=body.text.slice(q.start,q.end);status=q.end<=body.text.length&&passage===q.text?'bound-source-excerpt':'quote-mismatch';if(status==='bound-source-excerpt')evidence=body.evidence;}
 return {...q,status,evidence,passage:status==='bound-source-excerpt'?passage:null,passageSha256:status==='bound-source-excerpt'?sha(Buffer.from(passage)):null};
});}
function blocks(i,selected,bodies,quotes,coverage,provenance){
 const p=paragraph,out=[p(i.title,'Title'),p('Mail History brief | Editable draft for review'),p(`Requested correspondent/topic: ${i.target.query}. Identity matches remain candidate metadata.`),p('As of '+i.asOf),p('Exact selected window: '+JSON.stringify(selected.window)),p('Source-supplied correspondence timeline','Heading 1'),p('Dates, subjects and participants below are supplied discovery metadata; they do not verify identity or the meaning of a promise. Candidate previews are never decisive evidence.')];
 for(const b of bodies){const m=b.candidate;out.push(p(`${m.effectiveAt??'Unknown message date'} | ${m.subjectText??'Unknown subject'}`));out.push(p(`Message ${m.messageId}; thread ${m.threadId}; mailbox ${m.mailboxId}. Received ${m.receivedAt??'unknown'}; sent ${m.sentAt??'unknown'}; created ${m.createdAt}.`));out.push(p(`From: ${m.from.name??'unknown'} ${m.from.email??''}; To: ${m.to.map(x=>x.email??x.name??'unknown').join(', ')||'unknown'}. Metadata is unversioned and unverified; connection ${m.connectionStatus}; body ${b.status}.`));if(b.conflicts?.length)out.push(p('Conflicting discovery metadata: '+b.conflicts.map(x=>JSON.stringify(x)).join(' | ')));}
 if(!bodies.length)out.push(p('No correspondence candidates were compiled in the checked portion. This does not establish that no correspondence exists.'));
 out.push(p('Exact quoted passages','Heading 1'));
 for(const q of quotes){out.push(p(`[${q.status}] ${q.text}`));out.push(p(`Mail ${q.mailboxId} / thread ${q.threadId} / message ${q.messageId} / version ${q.sourceVersionId}; UTF-16 characters ${q.start}-${q.end}${q.url?'; locator URL, not verification: '+q.url:''}.`));}
 if(!quotes.length)out.push(p('No decisive excerpt was selected for quotation.'));
 out.push(p('Interpretations and outstanding items','Heading 1'),p('All semantic chronology, ask, promise, owner, completion and follow-up interpretations are unverified drafts for human review. A citation or completed task cannot establish delivery or acceptance.'));
 i.interpretations.forEach(s=>out.push(p('[unverified interpretation] '+s)));
 out.push(p('Coverage and verification appendix','Heading 1'),p('A bound excerpt means exact authorized supplied body bytes were reconstructed and hash-bound; source authenticity/freshness still depend on qualified gateway adapters. Unknown snapshots, source limits, missing dates, disconnection, candidate matching and paging never establish complete history or absence.'));
 for(const c of coverage){out.push(p(`${c.sourceId} | ${c.operation} | ${c.status}; enumeration ${c.enumeration}; reason ${c.reason??'none'}; verified false.`));if(c.returned!==undefined)out.push(p(`Returned ${c.returned}; more ${c.hasMore??'unknown'}; next offset ${c.nextOffset??'none'}; source query scope ${JSON.stringify(c.queryScope)}.`));if(c.remainingReads?.length)out.push(p('Candidate body handles remain discovery locators: '+c.remainingReads.join(', ')));if(c.unreadCount!==undefined){out.push(p(`Decisive body reads: ${c.boundBodyCount} bound / ${c.distinctEligibleCount} eligible; unread ${c.unreadCount}; body attempts ${c.bodyAttempts}; excluded by selected window ${c.excludedByWindow}.`));for(const row of c.unread)out.push(p(`Unread message ${row.messageId}; handle ${row.readHandle}; reason ${row.reason}.`));}if(c.result)out.push(p(`Unverified ${c.sourceId} candidate projection: ${c.result.matchesFound??c.result.contacts?.length??0} returned; source result SHA256 ${v.hash(c.result)}. This does not establish identity, relationship or absence.`));if(c.authority==='derived')out.push(p(`Source ${c.sourceId}; authority derived; supplied projection generatedAt ${c.generatedAt??'unknown'} (unverified); freshness unknown; snapshot unknown.`));for(const s of c.sources??[])out.push(p(`Source ${s.sourceId}; authority ${s.authority}; snapshot ${s.snapshotVersionId??'unknown'}; freshness ${s.freshness}; retrieved ${s.retrievedAt}.`));for(const limit of c.limitations??[])out.push(p('Limitation: '+limit));}
 for(const b of bodies)out.push(p(`Body ${b.candidate.messageId}: ${b.status}${b.reason?'; '+b.reason:''}; sections ${b.sections.length}; connection ${b.candidate.connectionStatus}; full-body evidence ${b.evidence?'retained':'unavailable'}.`));
 for(const q of quotes)if(q.evidence){const e=q.evidence;out.push(p(`Citation ${e.citationId}; source ${e.sourceId}; record ${e.recordId}; immutable version ${e.sourceVersionId}; authority authoritative; authorization decision ${e.authorizationDecisionId}.`));out.push(p(`Full body SHA256 ${e.contentSha256}\nQuoted passage SHA256 ${q.passageSha256}\nScope ${JSON.stringify(e.scopes)}\nObserved ${e.observedAt}; source updated unknown.`));}
 out.push(p('Original skill and immutable revision provenance','Heading 2'),p(marker+JSON.stringify(provenance)));return out;
}
export function createMailHistoryCompiler({readSource,readBase,now,defaultCongress,limits={}}){
 if(typeof readSource!=='function'||typeof now!=='function'||readBase!==undefined&&typeof readBase!=='function'||!Number.isInteger(defaultCongress)||defaultCongress<1)fail('MAIL_HISTORY_CONFIGURATION');
 const supplied=own(v.snapshot(limits),[],Object.keys(defaults)),bounds={...defaults,...supplied};for(const [key,value]of Object.entries(bounds))if(!Number.isSafeInteger(value)||value<1||value>defaults[key])fail('MAIL_HISTORY_CONFIGURATION');
 return Object.freeze({async prepare(raw,rawContext,options){
  const i=input(raw),context=v.context(rawContext),opts=own(options,['selection'],['base','signal']),selected=selection(opts.selection,context),base=opts.base??null;
  if(Date.parse(i.asOf)>now()||context.assets.length||context.analysisAdmission||context.evidence.length)fail('MAIL_HISTORY_CONTEXT');
  if(base!==null){own(base,['versionId','specSha256']);if(!readBase||!/^[a-f0-9]{64}$/u.test(base.specSha256??''))fail('MAIL_HISTORY_BASE');}
  const life=createOperationLifetime({deadlineMs:context.deadlineMs,now,signal:opts.signal,errorFactory:code=>Object.assign(new Error('MAIL_HISTORY_'+code),{code:'MAIL_HISTORY_'+code})});
  try{
   let parent=null;if(base)parent=baseRecord(await life.run(signal=>readBase({versionId:base.versionId,context:v.snapshot(context),signal})),base,context,i,selected);
   const collect=createCollection({readSource,context,selected,asOf:i.asOf,defaultCongress,life,now,limits:bounds});
   await collect.identity('resolve_entity',{query:i.target.query,limit:5});await collect.identity('find_contacts',{query:i.target.query,limit:10,...(selected.subject.kind==='client'?{clientId:selected.subject.entityIds[0]}:{})});
   await collect.candidates('mail.list_messages');const candidates=await collect.candidates('mail.search_messages',{query:i.target.query,...(i.target.participant?{participant:i.target.participant}:{})});
   const unique=new Map();for(const row of candidates){const key=v.hash([row.mailboxId,row.internetMessageId||row.messageId]);if(unique.has(key)){const previous=unique.get(key);if(!same(previous.candidate,row))previous.conflicts.push(row);}else unique.set(key,{candidate:row,conflicts:[]});}
   const eligible=[...unique.values()].filter(row=>{const at=row.candidate.effectiveAt;return selected.window.basis==='unbounded'||at!==null&&Date.parse(at)>=Date.parse(selected.window.startInclusive)&&Date.parse(at)<Date.parse(selected.window.endExclusive);});
   const bodies=[];for(const row of eligible.slice(0,bounds.maxMessages)){const body=await readBody(row.candidate,collect,bounds);bodies.push({...body,conflicts:row.conflicts});}
   const unread=[...bodies.filter(b=>!b.evidence).map(b=>({messageId:b.candidate.messageId,readHandle:b.candidate.readHandle,reason:b.reason??b.status})),...eligible.slice(bounds.maxMessages).map(b=>({messageId:b.candidate.messageId,readHandle:b.candidate.readHandle,reason:'MESSAGE_BODY_CAP'}))];
   collect.coverage.push({sourceId:'mail',operation:'mail.read_thread',status:unread.length?'partial-decisive-reads':'bound-bodies-source-incomplete',reason:eligible.length>bounds.maxMessages?'MESSAGE_BODY_CAP':null,verified:false,enumeration:'unknown',candidateCount:candidates.length,distinctEligibleCount:eligible.length,excludedByWindow:unique.size-eligible.length,bodyAttempts:bodies.length,boundBodyCount:bodies.filter(b=>b.evidence).length,unreadCount:unread.length,unread,remainingReads:unread.map(b=>b.readHandle)});
   bodies.sort((a,b)=>(Date.parse(a.candidate.effectiveAt??'')||0)-(Date.parse(b.candidate.effectiveAt??'')||0));
   const quotes=assessQuotes(i.quotes,bodies),evidence=bodies.filter(b=>b.evidence).map(b=>b.evidence);if(new Set(evidence.map(e=>e.citationId)).size!==evidence.length)fail('MAIL_HISTORY_CITATION_COLLISION');
   const provenance={recipe:'mail-history-brief',skill:i.skill,selection:selected,target:i.target,asOf:i.asOf,inputSha256:v.hash(i),readsSha256:v.hash(collect.reads),parent,collection:{...collect.stats(),distinctEligibleCount:eligible.length,bodyAttempts:bodies.length,boundBodyCount:evidence.length,unreadCount:unread.length,unread}};
   const request=v.request({operation:'create_word',format:'docx',title:i.title,content:{blocks:blocks(i,selected,bodies,quotes,collect.coverage,provenance)}}),nextContext=v.context({...context,evidence});life.check();
   const result=data({request,context:nextContext,baseVersionId:base?.versionId??null,provenance,bodies,quotes,coverage:collect.coverage,reads:collect.reads});prepared.set(result,{requestSha256:v.hash(request),contextSha256:v.hash(nextContext),baseVersionId:result.baseVersionId});return result;
  }finally{life.close();}
 }});
}
export function admitPreparedMailHistory(value,context){const pin=prepared.get(value);if(!pin||pin.contextSha256!==v.hash(context))fail('MAIL_HISTORY_CONFIGURATION');return intent=>{if(v.hash(intent.request)!==pin.requestSha256||intent.baseVersionId!==pin.baseVersionId)fail('MAIL_HISTORY_REQUEST_SUBSTITUTION');};}
