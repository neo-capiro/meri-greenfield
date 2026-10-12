// Retained source projections only. No parser, query execution, source access,
// inventory/cursor authenticity or current actor/tenant/folder authority here.
import {snapshotOperationData} from './operation-contracts.mjs';
import {assertPublicDataInstant} from './public-data-deadlines.mjs';
const URN='urn:meri:retrieval:research-legal-legislation:0.2.0';
const SEARCH='search_legislative_research', REFERENCE='get_legal_reference';
export const RESEARCH_LEGAL_LEGISLATION_OPERATION_IDS=Object.freeze([SEARCH,REFERENCE]);
const fail=m=>{throw Error(m);};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const bound=(x,n,label)=>{if(x.length>n)fail(`${label} exceeds source UTF-16 bound`);return x;};
function unique(rows){if(new Set(rows.map(r=>r.id)).size!==rows.length)fail('Duplicate retained source identity');}
function orderIds(rows){unique(rows);for(let i=1;i<rows.length;i++)if(Buffer.compare(Buffer.from(rows[i-1].id),Buffer.from(rows[i].id))>=0)fail('Retained source identity order');}
function newest(rows,tie=false){unique(rows);let prior=null;for(const r of rows){assertPublicDataInstant(r.observed_at);const t=Date.parse(r.observed_at);if(prior&&(t>prior.t||tie&&t===prior.t&&Buffer.compare(Buffer.from(prior.id),Buffer.from(r.id))>=0))fail('Retained observation order');prior={t,id:r.id};}}
export function createResearchLegalLegislationValidators({validateShape,schema}){
 if(typeof validateShape!=='function'||schema?.$id!==URN||!schema.$defs)fail('Legal legislation validator configuration');
 const names=new Set(Object.keys(schema.$defs));
 const stem=id=>{if(id===SEARCH)return 'ResearchLegalLegislationSearch';if(id===REFERENCE)return 'ResearchLegalLegislationReference';fail('Unknown legal legislation operation');};
 function researchLegalLegislationInputDefinition(id){return `${stem(id)}Input`;}
 function researchLegalLegislationOutputDefinition(id){return `${stem(id)}Output`;}
 function validateResearchLegalLegislationShape(name,value){if(typeof name!=='string'||!names.has(name))fail('Unknown legal legislation definition');const x=snapshotOperationData(value);validateShape(name,x);return x;}
 function normalizeResearchLegalLegislationInput(id,request,options){
  const name=stem(id),raw=validateResearchLegalLegislationShape(`${name}Request`,request),ctx=validateResearchLegalLegislationShape('ResearchLegalLegislationContext',options);
  const selected=raw.clientId?.trim().slice(0,80).trim()||null,resolution=ctx.clientResolution;
  let clientId=null;
  if(selected===null){if(resolution!==null)fail('Absent legal client cannot carry resolution');}
  else {if(resolution===null||resolution.reference!==selected||UUID.test(selected)&&selected.toLowerCase()!==resolution.clientId.toLowerCase())fail('Legal client resolution mismatch');clientId=resolution.clientId.toLowerCase();}
  const scope={jurisdiction:raw.jurisdiction??'FL',sessionKey:bound(raw.sessionKey??'',60,'Session'),folderId:raw.folderId||null,clientId};
  if(scope.folderId!==null)bound(scope.folderId,100,'Folder');validateShape('ResearchLegalScope',scope);
  let input;
  if(id===SEARCH){
   if(!scope.sessionKey)fail('Explicit research session required');if(ctx.citationResolution!==null)fail('Search cannot carry citation resolution');
   const billIds=[...new Set(raw.billIds??[])].sort();for(const id of billIds)bound(id,180,'Bill identity');
   input={scope,query:raw.query??'',versionPolicy:raw.versionPolicy??'any_retained',versionStage:raw.versionStage??'all',kind:raw.kind??'all',billIds,title:bound(raw.title??'',160,'Title'),sponsor:bound(raw.sponsor??'',160,'Sponsor'),chamber:bound(raw.chamber??'',160,'Chamber'),action:bound(raw.action??'',160,'Action'),referenceId:raw.referenceId??null,cursor:raw.cursor||null};
   // A successful parsed result requires a nonblank, bounded expression. Grammar
   // interpretation and retained cursor verification belong to the source adapter.
   if(input.query&&(!input.query.trim()||input.query.length>4096))fail('Research query requires parser review');
  } else {
   const view=raw.view==='rules'?'rules':raw.view==='versions'?'versions':'references';
   const citation=bound(raw.citation??'',180,'Citation'),parsed=ctx.citationResolution;
   if(view!=='references'&&parsed!==null)fail('Unused citation resolution');
   if(parsed!==null&&parsed.citation!==citation)fail('Citation resolution substitution');
   const referenceId=raw.referenceId||(parsed?.referenceId??'');
   const edition=view==='references'?(parsed?.code==='constitution'||raw.code==='constitution'?'':raw.edition??''):'';
   if(edition&&!/^20\d{2}$/.test(edition))fail('Legal edition requires four-digit 20xx year');
   if(view==='versions'&&(typeof raw.billId!=='string'||!scope.sessionKey))fail('Version view requires bill and session');
   input={scope,view,billId:raw.billId??null,citation,referenceId,edition:edition||null,code:raw.code??'',ruleNumber:bound(raw.ruleNumber??'',60,'Rule number'),noticeId:bound(raw.noticeId??'',100,'Notice identity')};
  }
  validateShape(`${name}Input`,input);
  return freeze({input,metadata:{sourceConnected:false,producerQualified:false,authorizationEstablished:false,parserQualified:false,cursorQualified:false,absenceEvidence:false,coverageQualified:false}});
 }
 function assertResearchLegalLegislationOutput(id,value,request,options){
  const {input}=normalizeResearchLegalLegislationInput(id,request,options);
  const page=validateResearchLegalLegislationShape(researchLegalLegislationOutputDefinition(id),value),r=page.result;
  assertPublicDataInstant(page.generatedAt);
  for(const key of ['jurisdiction','sessionKey','folderId','clientId'])if(r.scope[key]!==input.scope[key])fail('Legal scope substitution');
  if(id===SEARCH){
   if(!Object.hasOwn(r,'items'))fail('Research result branch mismatch');
   if(r.versionPolicy!==input.versionPolicy||r.searchedKinds!==input.kind||!same(r.coverage.billIds,input.billIds))fail('Research selectors differ');
   if(r.items.length>r.scanned||r.cursor!==null&&(r.cursor.length===0||r.scanned!==25))fail('Research scan/cursor window mismatch');
   if(input.query===''){if(r.interpretedQuery!==null||r.items.length!==r.scanned)fail('Unfiltered research query projection');}
   else if(r.interpretedQuery===null||r.interpretedQuery.raw!==input.query)fail('Research interpretation binding');
   const qualified=!r.coverage.retainedVersionsOnly;
   if(qualified&&(!input.billIds.length||r.coverage.manifestId===null))fail('Qualified projected inventory lacks selected bills/receipt');
   if(!input.billIds.length&&r.coverage.manifestId!==null)fail('Unselected inventory cannot carry queried receipt');
   const reason=input.referenceId?'LEGAL_REFERENCE_CLASSIFICATION_NOT_QUALIFIED':qualified?'EXPLICIT_BILL_INVENTORY_ONLY':'SOURCE_DOCUMENT_INVENTORY_NOT_QUALIFIED';
   const message=schema.$defs.ResearchLegalSearchResult.properties.message.enum[qualified?0:1];
   if(r.coverage.reason!==reason||r.coverage.complete!==(qualified&&!input.referenceId)||r.message!==message)fail('Research retained coverage semantics');
   orderIds(r.items);
   for(const row of r.items){
    assertVersion(row,input.scope);
    if(input.billIds.length&&!input.billIds.includes(row.billId)||input.kind!=='all'&&row.kind!==input.kind||input.versionPolicy!=='any_retained'&&!row.isCurrent)fail('Research selected version differs');
    if(input.versionStage!=='all'&&(row.kind!=='text'||row.versionType?.toLowerCase()!==input.versionStage))fail('Research stage differs');
    if(input.versionPolicy==='newest_dated_text'&&(row.kind!=='text'||row.publishedDate===null))fail('Research dated text projection');
    if(input.chamber&&row.chamber!==input.chamber)fail('Research chamber differs');
    // Locale-sensitive ILIKE comparisons require the admitted database adapter.
    if(input.query===''){if(row.evaluation!==null)fail('Unqueried research cannot carry evaluation');}
    else if(row.evaluation===null||row.evaluation.complete!==row.complete)fail('Research evaluation completeness differs');
    const evidence=row.evaluation?.evidence??[];
    for(const e of evidence)if(e.end<=e.start||e.quote.length!==e.end-e.start)fail('Research evidence UTF-16 offsets');
    if(evidence.length){if(!same(row.excerpt,evidence[0]))fail('Research excerpt differs from first evidence');}
    else if(Object.hasOwn(row.excerpt,'expression')||row.excerpt.start!==0||row.excerpt.end!==row.excerpt.quote.length||row.excerpt.quote.length>280)fail('Research default excerpt differs');
   }
  } else if(input.view==='versions'){
   if(!Object.hasOwn(r,'versions'))fail('Legal version branch mismatch');
   if(!r.complete&&r.versions.length!==200)fail('Incomplete retained version window');orderIds(r.versions);
   for(const row of r.versions){assertVersion(row,input.scope);if(row.billId!==input.billId)fail('Legal version bill substitution');}
  } else if(input.view==='rules'){
   if(!Object.hasOwn(r,'adopted'))fail('Legal rules branch mismatch');newest(r.rows,true);newest(r.adopted);
   if(!input.ruleNumber&&r.adopted.length)fail('Unselected adopted rule history');
   if(input.noticeId&&r.rows.some(row=>row.notice_id!==input.noticeId))fail('Legal notice substitution');
  } else {
   if(!Object.hasOwn(r,'related'))fail('Legal reference branch mismatch');
   if(r.referenceId!==input.referenceId||r.edition!==input.edition)fail('Legal reference selection differs');orderIds(r.rows);unique(r.related);
   if(!input.referenceId&&r.related.length)fail('Unselected legal occurrences');
   const joined=['revision_id','edition','title','source_url','content_hash','extraction_hash','parser_version','sections','history_text','complete','coverage','observed_at'];
   for(const row of r.rows){
    assertPublicDataInstant(row.created_at);
    if(row.jurisdiction!==input.scope.jurisdiction||input.code&&row.code_kind!==input.code)fail('Legal reference scope/code differs');
    if(row.revision_id===null){if(joined.some(key=>row[key]!==null))fail('Absent lateral revision must have all null columns');}
    else {for(const key of ['title','source_url','content_hash','extraction_hash','parser_version','complete','observed_at'])if(row[key]===null)fail('Present revision lost nonnullable column');assertPublicDataInstant(row.observed_at);if(input.edition!==null&&row.edition!==input.edition)fail('Legal edition substitution');}
   }
   for(const row of r.related){assertPublicDataInstant(row.observed_at);if(row.reference_id!==input.referenceId||input.scope.sessionKey&&row.session_key!==input.scope.sessionKey||row.end_offset<=row.start_offset)fail('Legal occurrence selection/offset mismatch');}
  }
  return page;
 }
 function assertVersion(row,scope){assertPublicDataInstant(row.observedAt);if(row.jurisdiction!==scope.jurisdiction||row.sessionKey!==scope.sessionKey)fail('Retained version scope substitution');}
 return Object.freeze({researchLegalLegislationSchemaId:URN,RESEARCH_LEGAL_LEGISLATION_OPERATION_IDS,researchLegalLegislationInputDefinition,researchLegalLegislationOutputDefinition,validateResearchLegalLegislationShape,normalizeResearchLegalLegislationInput,assertResearchLegalLegislationOutput});
}
