// Pure retained evidence boundary. Feature, actor, folder, source and publisher
// qualification remain with trusted adapters. This module never compiles/fetches.
import {snapshotOperationData} from './operation-contracts.mjs';
import {assertPublicDataInstant} from './public-data-deadlines.mjs';
const ID='search_legiwatch_news',URN='urn:meri:retrieval:research-legal-news:0.2.0';
export const RESEARCH_LEGAL_NEWS_OPERATION_IDS=Object.freeze([ID]);
const fail=m=>{throw Error(m);};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const int32=n=>Number.isInteger(n)&&n>=-2147483648&&n<=2147483647;
const unique=rows=>{if(new Set(rows.map(x=>x.id)).size!==rows.length)fail('Duplicate news evidence identity');};
const instant=x=>{assertPublicDataInstant(x);return Date.parse(x);};
const object=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
export function createResearchLegalNewsValidators({validateShape,schema}){
 if(typeof validateShape!=='function'||schema?.$id!==URN||!schema.$defs)fail('News validator configuration');
 const names=new Set(Object.keys(schema.$defs));
 const endpoints=snapshotOperationData(schema.$defs.ResearchLegalNewsIntakeEndpoints.const);
 const operation=id=>{if(id!==ID)fail('Unknown news operation');};
 function researchLegalNewsInputDefinition(id){operation(id);return 'ResearchLegalNewsInput';}
 function researchLegalNewsOutputDefinition(id){operation(id);return 'ResearchLegalNewsOutput';}
 function validateResearchLegalNewsShape(name,value){if(typeof name!=='string'||!names.has(name))fail('Unknown news definition');const x=snapshotOperationData(value);validateShape(name,x);return x;}
 function selection(id,request,options){
  operation(id);const raw=validateResearchLegalNewsShape('ResearchLegalNewsRequest',request),ctx=validateResearchLegalNewsShape('ResearchLegalNewsContext',options);
  const view=['source','personnel','monitors'].includes(raw.view)?raw.view:'news';
  const selected=raw.clientId?.trim().slice(0,80).trim()||null,r=ctx.clientResolution;
  let client=null;
  // The wrapper resolves client before the monitors route discards its body.
  if(selected===null){if(r!==null)fail('Absent news client cannot carry resolution');}
  else {if(r===null||r.reference!==selected||UUID.test(selected)&&selected.toLowerCase()!==r.clientId.toLowerCase())fail('News client resolution differs');client=r.clientId.toLowerCase();}
  let scope=null;
  if(view==='monitors'){if(ctx.effectiveScope!==null)fail('Monitor list discards caller scope');}
  else {
   const sessionKey=raw.sessionKey??'',folderId=raw.folderId||null;scope=ctx.effectiveScope;
   if(folderId!==null&&folderId.length>100)fail('News folder exceeds UTF16 bound');
   if(scope===null||scope.sessionKey!==sessionKey||scope.folderId!==folderId||client!==null&&scope.clientId!==client||folderId===null&&scope.clientId!==client)fail('News effective folder/client scope differs');
  }
  const input={view,scope,q:'',publisher:'',monitorId:null,kind:null,id:null,branch:'',limit:50,offset:0,days:7,year:null};
  if(view==='news'){
   if(ctx.windowAsOf===null)fail('News cutoff observation required');instant(ctx.windowAsOf);
   input.limit=Math.min(100,Math.max(1,Math.trunc(Number(raw.limit)||50)));input.offset=Math.max(0,Number(raw.offset)||0);input.days=Number(raw.days??7);input.q=(raw.q??'').slice(0,500);input.publisher=raw.publisher??'';input.monitorId=raw.monitorId||null;
  }else if(ctx.windowAsOf!==null)fail('Unused news cutoff observation');
  if(view==='personnel'){
   const defaulted=raw.year===undefined||raw.year===null;
   if(defaulted&&!int32(ctx.defaultYear)||!defaulted&&ctx.defaultYear!==null)fail('Personnel default-year observation differs');
   input.year=defaulted?ctx.defaultYear:Number(raw.year);input.kind=raw.kind??'change';input.branch=raw.branch??'';input.q=(raw.q??'').slice(0,200);input.offset=Math.max(0,Math.trunc(Number(raw.offset)||0));
   if(!['change','registration'].includes(input.kind)||!['','legislative','executive'].includes(input.branch))fail('Invalid personnel selection');
  }else if(ctx.defaultYear!==null)fail('Unused personnel year observation');
  if(view==='source'){
   input.kind=raw.kind??null;input.id=raw.id??null;
   if(!['news','budget','personnel','research'].includes(input.kind)||typeof input.id!=='string'||!input.id||input.id.length>200)fail('Exact typed news source required');
  }
  validateShape('ResearchLegalNewsInput',input);return {input,ctx};
 }
 function normalizeResearchLegalNewsInput(id,request,options){const {input}=selection(id,request,options);return freeze({input,metadata:{sourceConnected:false,producerQualified:false,authorizationEstablished:false,parserQualified:false,publisherIntakeQualified:false,absenceEvidence:false}});}
 function timestamps(row,keys){for(const key of keys)if(row[key]!==null)instant(row[key]);}
 function tracking(row){if(row.saved&&row.tracking_version===null)fail('Saved evidence lacks tracking row');}
 function article(row){timestamps(row,['provider_parsed_at','published_at','observed_at']);if(row.body_complete&&row.body===null)fail('Complete news body absent');}
 function coverage(row){
  const expected=endpoints.filter(e=>e.publisher.trim().toLowerCase()===row.publisher.trim().toLowerCase()||e.url===row.source_url);
  const feeds=row.intake.feeds;if(feeds.length!==expected.length)fail('Publisher intake endpoint window differs');
  feeds.forEach((f,i)=>{if(f.url!==expected[i].url||f.publisher!==expected[i].slug)fail('Publisher intake endpoint substitution');if(f.observedAt!==null)instant(f.observedAt);if(f.status==='not_checked'&&(f.observedAt!==null||f.reason!==null||f.primaryFailure!==null)||f.status!=='not_checked'&&f.observedAt===null)fail('Publisher intake receipt observation differs');});
  const status=!feeds.length?'no_verified_endpoint':feeds.every(f=>f.status==='succeeded')?'succeeded':feeds.every(f=>f.status==='failed')?'failed':feeds.every(f=>f.status==='not_checked')?'not_checked':'partial';
  if(row.intake.status!==status)fail('Publisher intake aggregate differs');
  if(row.retained.fullTextArticles>row.retained.articles)fail('Publisher full-text count exceeds retained count');
  timestamps(row.retained,['latestPublishedAt','latestObservedAt']);
  // Retained article presence cannot turn a failed latest intake into success.
 }
 function assertResearchLegalNewsOutput(id,value,request,options){
  const {input,ctx}=selection(id,request,options),page=validateResearchLegalNewsShape('ResearchLegalNewsOutput',value),r=page.result;
  instant(page.generatedAt);
  if(input.view==='news'){
   if(!Object.hasOwn(r,'coverage'))fail('News output branch differs');
   for(const key of ['jurisdiction','sessionKey','folderId','clientId'])if(r.scope[key]!==input.scope[key])fail('News returned scope differs');
   const since=instant(ctx.windowAsOf)-input.days*86400000;
   if(!Number.isFinite(since)||r.window.since!==new Date(since).toISOString()||r.window.days!==input.days)fail('News cutoff window differs');
   if(r.items.length>input.limit||r.nextOffset!==null&&(r.items.length!==input.limit||r.nextOffset!==input.offset+input.limit))fail('News page continuation differs');
   if(input.monitorId===null?r.matchDefinition!==null:r.matchDefinition===null||r.matchDefinition.id!==input.monitorId)fail('Private monitor selection differs');
   unique(r.items);unique(r.coverage);let prior=null;
   for(const row of r.items){article(row);tracking(row);const time=instant(row.published_at??row.observed_at);if(!row.is_current||time<since||input.publisher&&row.publisher!==input.publisher)fail('News retained selection differs');if(prior&&time>prior.time)fail('News temporal order differs');prior={time,id:row.id};}
   r.coverage.forEach(coverage);
  }else if(input.view==='personnel'){
   if(!Object.hasOwn(r,'year')||r.year!==input.year)fail('Personnel result differs');
   if(r.nextOffset!==null&&(r.items.length!==100||r.nextOffset!==input.offset+100))fail('Personnel continuation differs');unique(r.items);
   const sourceKeys=new Set();for(const row of r.items){instant(row.observed_at);tracking(row);if(row.kind!==input.kind||row.registration_year!==null&&row.registration_year!==input.year||input.branch&&row.branch!==input.branch)fail('Personnel selection differs');if(sourceKeys.has(row.source_key))fail('Duplicate latest personnel source identity');sourceKeys.add(row.source_key);}
  }else if(input.view==='monitors'){
   if(!Object.hasOwn(r,'monitors'))fail('Monitor result branch differs');unique(r.monitors);const keys=new Set();
   for(const row of r.monitors){if(row.tenant_id!==ctx.owner.tenantId||row.owner_clerk_id!==ctx.owner.clerkUserId||keys.has(row.source_key))fail('Private monitor owner/source differs');keys.add(row.source_key);timestamps(row,['baseline_at','checkpoint','last_attempt_at','created_at']);const config=object(row.config),source=object(row.source);if(row.interpretation.raw!==String(config.query??source.raw??''))fail('Monitor interpretation raw binding differs');if(row.interpretation.status==='supported'&&(row.interpretation.ast===null||row.interpretation.providerQuery===null)||row.interpretation.status==='empty'&&(row.interpretation.ast!==null||row.interpretation.providerQuery!==null))fail('Monitor compilation projection differs');}
  }else {
   const definitions={news:'ResearchLegalNewsSourceNews',budget:'ResearchLegalNewsSourceBudget',personnel:'ResearchLegalNewsSourcePersonnel',research:'ResearchLegalNewsSourceResearch'};
   validateShape(definitions[input.kind],r);if(r.id!==input.id)fail('Exact evidence identity differs');instant(r.observedAt);
   if(input.kind==='research'){
    if(r.text!==r.sections.map(s=>s.text).join('\n'))fail('Research source sections/text differ');
   }else{
    const time=instant(r.observed_at);if(instant(r.observedAt)!==Math.floor(time/1000)*1000)fail('Raw Date/string source observation precision differs');
    if(r.sourceUrl!==r.source_url)fail('Exact source URL alias differs');
    if(input.kind==='news'){
     article(r);if(r.complete!==r.body_complete||r.text!==[r.title,r.summary,r.body].filter(Boolean).join('\n'))fail('Exact news body projection differs');
    }else if(input.kind==='budget'){
     const sections=Array.isArray(r.sections)?r.sections:[];
     if(r.revision!==r.content_hash||r.authority!==`Florida fiscal source: ${r.stage}`||r.text!==sections.map(s=>String(object(s).text??'')).join('\n'))fail('Exact budget source projection differs');
    }else if(r.title!==r.name||r.authority!==r.confirmation||r.text!==String(object(r.payload).sourceText??''))fail('Exact personnel source projection differs');
   }
  }
  return page;
 }
 return Object.freeze({researchLegalNewsSchemaId:URN,RESEARCH_LEGAL_NEWS_OPERATION_IDS,researchLegalNewsInputDefinition,researchLegalNewsOutputDefinition,validateResearchLegalNewsShape,normalizeResearchLegalNewsInput,assertResearchLegalNewsOutput});
}
