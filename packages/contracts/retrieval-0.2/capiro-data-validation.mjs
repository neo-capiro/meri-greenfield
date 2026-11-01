/** Validate Core's bounded public/private SQL wire. Core alone parses SQL and admits private scope. */
import {canonicalSha256} from '../validate.mjs';
import {snapshotOperationData} from './operation-contracts.mjs';

export const RETAINED_CAPIRO_PRIVATE_RELATIONS=Object.freeze(['client_objectives','client_activity','client_team_roster','client_account_owners','client_targets','client_profiles','client_profile_codes','client_people','client_contacts','client_engagement_tasks','client_action_items','client_tracked_bills','client_outreach_campaigns','client_campaign_recipients']);

const fail=()=>{throw Error('Invalid Capiro data contract');};
const bytes=value=>Buffer.byteLength(JSON.stringify(value),'utf8');
const unique=values=>new Set(values).size===values.length;
const sameSet=(a,b)=>a.length===b.length&&a.every(value=>b.includes(value));
const integer=/^-?(?:0|[1-9]\d*)$/u;
const decimal=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/u;
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
// Core 362 (capiro-backend#362) returns timestamp cells as PostgreSQL text in UTC with microseconds
// (`2025-01-04 01:02:03.123456+00`; plain `timestamp` carries no offset) and moves the envelope version
// public 0.1.0 -> 0.2.0, private 0.2.0 -> 0.3.0. The two services deploy separately, so both generations
// are accepted here. TRANSITIONAL: the ISO timestamp form, the first version of each pair and their
// fixtures are deleted by the follow-up fable/sql-envelope-retire-old-generation once Core 362 is live.
const pgTimestamp=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:[+-]\d{2}(?::\d{2})?)?$/u;
const isoTimestamp=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u;
const ENVELOPE_VERSIONS=Object.freeze({public:Object.freeze(['0.1.0','0.2.0']),client_records:Object.freeze(['0.2.0','0.3.0'])});

function privateScope(input,context){
 const scope=context.capiroDataScope;
 if(input.source!=='client_records'){if(scope!==undefined||Object.hasOwn(input,'clientId'))fail();return null;}
 if(!scope||typeof scope!=='object'||Array.isArray(scope)||Object.keys(scope).sort().join(',')!=='clientId,identityRevision,membershipRevision'||
  scope.clientId!==null&&(typeof scope.clientId!=='string'||!uuid.test(scope.clientId))||
  ![scope.identityRevision,scope.membershipRevision].every(value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value))||
  input.clientId!==undefined&&input.clientId!==scope.clientId)fail();
 return scope;
}

function cell(column,value){
  if(value===null){if(!column.nullable)fail();return;}
  switch(column.type){
    case 'string':if(typeof value!=='string')fail();break;
    case 'integer':if(typeof value!=='string'||!integer.test(value))fail();break;
    case 'decimal':if(typeof value!=='string'||!decimal.test(value))fail();break;
    case 'boolean':if(typeof value!=='boolean')fail();break;
    case 'date':if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/u.test(value)||!instant(value)||new Date(value).toISOString().slice(0,10)!==value)fail();break;
    case 'timestamp':if(!instant(value)||!(pgTimestamp.test(value)||isoTimestamp.test(value)))fail();break;
    default:fail();
  }
}

function describe(page,input){
  if(page.contract!==undefined){
    const {revisionSha256,...contract}=page.contract;
    const {maxColumns,...limits}=page.limits;
    if(contract.source!==(input.source??'public')||canonicalSha256(contract.limits)!==canonicalSha256(limits)||
      canonicalSha256({...contract,relations:page.relations})!==revisionSha256)fail();
  }
  const names=page.relations.map(relation=>relation.name);
  if(!unique(names)||input.relations&&!sameSet(input.relations,names))fail();
  for(const relation of page.relations){
    const fields=relation.fields.map(field=>field.name);
    if(!unique(fields)||relation.primaryKey.some(name=>!fields.includes(name))||relation.freshness.field!==null&&!fields.includes(relation.freshness.field))fail();
    for(const join of relation.relationships){
      if(join.fields.length!==join.referencedFields.length||join.fields.some(name=>!fields.includes(name)))fail();
      const target=page.relations.find(item=>item.name===join.referencedRelation);
      if(target&&join.referencedFields.some(name=>!target.fields.some(field=>field.name===name)))fail();
    }
  }
}

function query(page,input){
  const limit=input.rowLimit??200,names=page.columns.map(column=>column.name);
  if(page.limits.rowLimit!==limit||page.rowCount!==page.rows.length||page.rowCount>limit||!unique(names))fail();
  if(page.rowLimitReached&&!page.byteTruncated&&page.rowCount!==limit)fail();
  if(page.coverage.sqlLimit!==null&&page.rowCount>page.coverage.sqlLimit)fail();
  const relations=page.coverage.relations.map(relation=>relation.name);
  if(!unique(relations)||!sameSet(relations,page.relationsUsed))fail();
  for(const row of page.rows){
    if(!sameSet(Object.keys(row),names))fail();
    for(const column of page.columns)cell(column,row[column.name]);
  }
}

export function createCapiroDataValidators({validateShape,privateRelations=RETAINED_CAPIRO_PRIVATE_RELATIONS,domainSources=false}){
  function sourceScope(input,context){
    if(!domainSources||!['research_portfolio','classic_outreach'].includes(input.source))return privateScope(input,context);
    if(Object.hasOwn(input,'clientId'))fail();
    const scope=context.capiroDataScope,keys=input.source==='research_portfolio'?'contextRevision,identityRevision,membershipRevision,researchPortfolio,source':'clientId,contextRevision,identityRevision,membershipRevision,source';
    if(!scope||typeof scope!=='object'||Array.isArray(scope)||Object.keys(scope).sort().join(',')!==keys||scope.source!==input.source||
      ![scope.identityRevision,scope.membershipRevision,scope.contextRevision].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v)))fail();
    if(input.source==='research_portfolio'){
      validateShape('CapiroDataResearchScope',scope.researchPortfolio);
      const p=scope.researchPortfolio;
      if(p.stale!==(p.researchPortfolioName!==p.currentResearchPortfolioName||p.researchPortfolioRevision!==p.currentResearchPortfolioRevision))fail();
    }else validateShape('CapiroDataClassicScope',{kind:'classic_outreach',clientId:scope.clientId});
    return scope;
  }
  const sourceRelations=input=>input.source==='research_portfolio'?['research_portfolios','research_portfolio_members']:input.source==='classic_outreach'?['classic_outreach_records']:privateRelations;
  const definition=(id,output=false)=>{
    if(!['describe_capiro_data','query_capiro_data'].includes(id))fail();
    return `CapiroData${id==='describe_capiro_data'?'Describe':'Query'}${output?'Output':'Request'}`;
  };
  function normalizeInput(id,raw,context={}){
    const input=snapshotOperationData(raw);validateShape(definition(id),input);
    const scope=sourceScope(input,context);
    if(scope&&id==='describe_capiro_data'&&input.relations&&(input.relations.length>sourceRelations(input).length||input.relations.some(name=>!sourceRelations(input).includes(name))))fail();
    if(id==='query_capiro_data'&&(Buffer.byteLength(input.sql,'utf8')>16384||bytes(input.parameters)>32768||
      input.parameters.some(value=>typeof value==='number'&&(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER))))fail();
    return {input,metadata:scope?{scope:input.source,...(input.source==='research_portfolio'?{}:{clientId:scope.clientId}),absenceEvidence:false}:{scope:'public_curated_relations',absenceEvidence:false}};
  }
  function assertOutput(id,raw,request,context={}){
    const {input}=normalizeInput(id,request,context),page=snapshotOperationData(raw);validateShape(definition(id,true),page);
    const scope=sourceScope(input,context);
    const domain=scope&&['research_portfolio','classic_outreach'].includes(input.source);
    if(!(domain?['0.3.0']:ENVELOPE_VERSIONS[scope?'client_records':'public']).includes(page.version))fail();
    if(page.ok&&scope){
      const expected=input.source==='research_portfolio'?scope.researchPortfolio:{kind:input.source,clientId:scope.clientId};
      if(canonicalSha256(page.scope)!==canonicalSha256(expected))fail();
      const used=id==='describe_capiro_data'?page.relations.map(r=>r.name):page.relationsUsed;
      if(used.some(name=>!sourceRelations(input).includes(name)))fail();
      if(id==='describe_capiro_data'&&domain&&page.relations.some(r=>r.coverage.basis!==(input.source==='research_portfolio'?'authorized_research_portfolio':'authorized_classic_outreach')))fail();
    }
    if(!instant(page.generatedAt)||bytes(page)>262144)fail();
    if(!page.ok)return page;
    if(id==='describe_capiro_data')describe(page,input);else query(page,input);
    return page;
  }
  return Object.freeze({normalizeInput,assertOutput});
}
