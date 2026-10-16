/** Synthetic source-shaped stored DTOs and echo credentials; never native identity qualification. */
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../bill-text/test/fixture.mjs';
import {createDisclosuresHandlers} from '../handler.mjs';
export const ids=['search_lda_filings','search_sec_filings','search_fara_registrations'];
export function setup(id=ids[0],request={}){
 const base=billTextCase(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),normalized=contract.normalizeInput(request,{});
 const {authority,state,now}=base;authority.decision.operation=`${id}@0.2.0`;authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(row=>row.sourceId))];
 const at=new Date('2026-10-12T00:00:00.000Z'),page={tool:id,generatedAt:new Date(now()),total:0,data:[]};
 if(id==='search_lda_filings')Object.assign(page,{page:normalized.input.page,limit:normalized.input.limit,data:[{filingUuid:'synthetic-lda',filingType:'LD-2',filingYear:normalized.input.year??2026,filingPeriod:null,income:-10.5,expenses:0,dtPosted:at,registrantId:null,registrantName:'Synthetic Registrant',clientId:17,clientName:'Public LDA Registry Client',clientState:null,issueCodes:[normalized.input.issueCode??'DEF']}]});
 else if(id==='search_sec_filings')page.data=[{id:'synthetic-sec',cik:normalized.input.cik??'0000000123',companyName:'Synthetic Issuer',formType:normalized.input.formType??'10-K',accessionNumber:'opaque-accession',filingDate:at,description:'Stored normalized summary...',url:null}];
 else page.data=[{id:'synthetic-fara',registrationNumber:'opaque-registration',registrantName:'Synthetic Registrant',foreignPrincipal:'Synthetic Foreign Principal',country:normalized.input.country??null,status:normalized.input.status??null,registrationDate:null,description:''}];
 const wire=[],proofs=[],call={input:normalized.input,request,authority,argumentsSha256:normalized.argumentsSha256,normalizationContext:{}};
 const configuration={origin:'https://core.example.invalid',now,maxRequestMs:250,maxResponseBytes:65536,
  async getCredentials(raw){proofs.push(raw);const {input,deadlineMs,signal,...proof}=raw;const receipt={...proof,bearerToken:'SYNTHETIC_USER',serviceSecret:'SYNTHETIC_SERVICE',expiresAtMs:deadlineMs};state.credentialMutator?.(receipt);return receipt;},
  async fetchImpl(url,options){wire.push({url,options,body:JSON.parse(options.body)});state.afterFetch?.();return state.responseFactory?state.responseFactory(page,options):Response.json(page);}};
 const handler=(changes={})=>createDisclosuresHandlers({...configuration,...changes},[operation])[0].execute;
 return {operation,contract,normalized,request,authority,state,now,page,call,configuration,handler,wire,proofs,hash};
}
