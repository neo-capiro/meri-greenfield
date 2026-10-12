// Concrete caller examples through existing canonical normalization and schemas.
// No source/producer invocation. Request names are cross-checked against each
// family's actual raw admission before this one-time repair is composed.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolveOperationContract,validateShape} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {CATALOG_OPERATION_BINDINGS} from '../../../../../packages/contracts/retrieval-0.2/catalog-validation.mjs';
const T='2026-10-12T12:00:00.000Z',U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',V='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const binding={tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:U,runId:V,attemptId:U,workerId:V,writerFence:1};
const subject={kind:'client',entityType:'client',entityIds:[U],tenantId:binding.tenantId,actorId:binding.actorId,
  authorizationDecisionId:V,policyRevision:'synthetic-policy',rosterVersionId:null,
  scopes:[{tenantId:binding.tenantId,kind:'client',resourceId:U,policyRevision:'synthetic-policy'}]};
const requests={search_public_web:{query:'synthetic'},scrape_web_page:{url:'https://example.test/'},
  get_program_element:{peCode:' 0600001 '},get_pe_budget_timeline:{peCode:' 0600001 '},
  get_pe_contractors:{peCode:' 0600001 '},get_pe_bills:{peCode:' 0600001 '},get_pe_report_language:{peCode:' 0600001 '},
  search_tracked_bills:{clientId:' Named client '},get_certification_status:{program:'fedramp',query:' synthetic '},
  lookup_client_registry:{name:'x'.repeat(301)}};
const facts={clientResolution:null,evidenceAccuracyMode:'off',asOf:T,sourceStatusAsOf:T,sourceHealthAsOf:T,
  effectiveScope:{jurisdiction:'FL',sessionKey:'',folderId:null,clientId:null},defaultCongress:119,
  binding,subject,clientReference:'Named client',stageAsOf:T,commentAsOf:T,comparisonLocale:'en-US'};
const rows=[];
for(const b of CATALOG_OPERATION_BINDINGS){
  const schemaPath=new URL(`../../../../../packages/contracts/retrieval-0.2/${b.group}.schema.json`,import.meta.url);
  const schema=JSON.parse(readFileSync(schemaPath));
  const raw=b.input.replace(/Input$/,'Request');
  if(raw===b.input||!schema.$defs[raw])continue;
  const request=requests[b.id]??{},context=Object.fromEntries((b.contextKeys??[]).map(key=>[key,facts[key]]));
  const contract=resolveOperationContract({id:b.id,version:b.version});
  let normalized=null,failure=null;try{validateShape(raw,request);normalized=contract.normalizeInput(request,context);}catch(e){failure=e.message;}
  let previousAdmitted=true;try{validateShape(b.input,request);}catch{previousAdmitted=false;}
  const sourcePath=new URL(`../../../../../packages/contracts/retrieval-0.2/${b.group}-validation.mjs`,import.meta.url);
  rows.push({id:b.id,group:b.group,before:b.input,after:raw,request,context,normalizationSucceeded:failure===null,
    failure,previousAdvertisementAdmittedRequest:previousAdmitted,
    normalizedInput:normalized?.input??null,
    moduleSha256:createHash('sha256').update(readFileSync(sourcePath)).digest('hex')});
}
writeFileSync(new URL('raw-request-admission-before.json',import.meta.url),JSON.stringify({sourceOnly:true,rows},null,2)+'\n');
console.log(JSON.stringify({rows:rows.length,validExamples:rows.filter(row=>row.normalizationSucceeded).length,
  demonstratedAdvertisementRefusals:rows.filter(row=>row.normalizationSucceeded&&!row.previousAdvertisementAdmittedRequest).length,
  setupFailures:rows.filter(row=>row.failure).map(({id,failure})=>({id,failure}))}));
if(rows.some(row=>row.failure))process.exitCode=1;
