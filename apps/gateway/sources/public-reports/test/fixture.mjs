/** Synthetic offline source responses and receipts; no native identity qualification. */
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {fixture,NOW} from '../../../test/fixtures.mjs';
import {createHandlers} from '../../../general-reads/families/public-reports.mjs';

export {NOW};
export const stamp=new Date(NOW).toISOString();
export const ids=['search_cbo_cost_estimates','search_gao_reports','search_crs_reports'];
export const noEstimate=label=>label===undefined
 ? 'No CBO cost estimates matched. Say so explicitly — do not estimate or guess a score.'
 : `No CBO cost estimate on record for ${label}. Say so explicitly — do not estimate or guess a score.`;
export function nativeResult(id){
 if(id===ids[0])return {tool:id,generatedAt:stamp,estimatesFound:1,estimates:[{
  id:'synthetic-cbo',billId:'hr-1',congress:119,billType:'hr',billNumber:'1',title:'Synthetic cost estimate',
  description:null,pubDate:new Date('2026-10-10T12:30:00.000Z'),cboUrl:'https://cbo.invalid/synthetic'}]};
 if(id===ids[1])return {tool:id,generatedAt:stamp,total:0,data:[{
  id:'synthetic-gao',title:'Synthetic report',url:null,publishDate:new Date('2026-10-10T00:00:00.000Z'),
  reportType:'Report',topics:['oversight'],agencies:['Synthetic Agency'],summary:'Stored excerpt',recommendations:2}]};
 return {tool:id,generatedAt:stamp,total:12,data:[{
  id:'synthetic-crs',title:'Synthetic CRS report',date:new Date('2026-10-09T00:00:00.000Z'),authors:['Synthetic Author'],
  topics:['policy'],summary:'Stored excerpt',pdfUrl:'https://crs.invalid/synthetic.pdf',htmlUrl:null}]};
}
export function setup(id=ids[0],request={},changes={}){
 const f=fixture(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation);
 const normalized=contract.normalizeInput(request,{}),wire=[],proofs=[],state={now:NOW};
 const authority={binding:f.binding,subject:f.subject,claims:f.claims,policyRevision:f.subject.policyRevision,
  sourceIds:[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))],deadlineMs:NOW+10000};
 const call={input:normalized.input,request:normalized.request,authority,argumentsSha256:normalized.argumentsSha256,normalizationContext:{}};
 const credential=pins=>({...Object.fromEntries(['binding','subject','operation','policyRevision','sourceIds',
  'argumentsSha256','requestSha256','normalizationContext','origin'].map(key=>[key,pins[key]])),
  bearerToken:'SYNTHETIC_USER_JWT',serviceSecret:'SYNTHETIC_INTERNAL_SECRET',expiresAtMs:NOW+5000});
 const config={origin:'https://core.invalid',now:()=>state.now,maxRequestMs:1000,maxResponseBytes:65536,
  getCredentials:async pins=>{proofs.push(pins);return credential(pins);},
  fetchImpl:async(url,options)=>{wire.push({url,options});return new Response(JSON.stringify(state.page??nativeResult(id)),{
   headers:{'content-type':'application/json'}});},...changes};
 const handlers=createHandlers(config),handler=handlers.find(h=>h.operation.id===id);
 return {operation,contract,normalized,call,authority,wire,proofs,state,credential,config,handlers,
  execute:async(value=call)=>JSON.parse(await handler.execute(value)),hash:canonicalSha256};
}
