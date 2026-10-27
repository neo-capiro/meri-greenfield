import schema from './client-record-action.schema.json' with {type:'json'};
import {data,own} from '../commands-0.2/execution-boundary.mjs';
const operations=Object.freeze({create_client:'CreateClientInput',update_client_profile:'UpdateClientProfileInput'});
const fields=['name','website','description','productDescription','primaryContactName','primaryContactEmail','primaryContactPhone','sectorTag','uei','cageCode','issueCodes','naicsCodes','pscCodes'];
const fail=()=>{throw Object.assign(Error('INVALID_RESULT'),{code:'INVALID_RESULT'});};
const bounded=v=>{if(new TextEncoder().encode(JSON.stringify(v)).length>65536)fail();return v;};
/** Normalize exactly the finite Core string fields. JSON Schema counts code points; Core counts UTF-16 units. */
function normalize(v,s){if(typeof v==='string'){v=v.trim();if(v.length<(s.minLength??0)||v.length>(s.maxLength??Infinity))fail();return v;}
 if(Array.isArray(v))return v.map(x=>normalize(x,s.items));if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,normalize(x,s.properties[k])]));return v;}
export function createClientRecordValidators({validateShape,canonicalSha256:hash}){
 const same=(a,b)=>hash(a)===hash(b);
 function normalizeInput(operation,value){const name=operations[operation];if(!name)fail();validateShape(name,value);const r=normalize(data(value),schema.$defs[name]);validateShape(name,r);
  if(operation==='update_client_profile'&&!fields.some(k=>Object.hasOwn(r,k))&&!['facilities','capabilities','people'].some(k=>r[k]?.length))fail();return bounded(r);}
 function request(value){const r=data(own(value,['operation','input']));const input=normalizeInput(r.operation,r.input);if(!same(input,r.input))fail();return bounded(r);}
 function receipt(value,expected){validateShape('ClientRecordReceipt',value);const r=data(value);if(!same(r.request,expected))fail();
  if(expected.operation==='create_client'){if(r.outcome!=='created'||r.client.name!==expected.input.name||expected.input.ldaClientId!==undefined&&r.ldaMatch?.ldaClientId!==expected.input.ldaClientId)fail();}
  else {const names=fields.filter(k=>Object.hasOwn(expected.input,k));if(r.clientId!==expected.input.clientId||!same([...r.fieldsWritten].sort(),names.sort()))fail();
   const changed=r.fieldsWritten.length+r.facilitiesCreated.length+r.capabilitiesCreated.length+r.peopleCreated.length+r.peopleUpdated.length>0;
   if(r.outcome!==(r.rowErrors.length?(changed?'partially_updated':'not_updated'):(changed?'updated':'unchanged')))fail();}return r;}
 function coreResult(value,expected={}){validateShape('ClientRecordCoreResult',value);const r=data(value);request(r.request);
  if(Date.parse(r.expiresAt)<=Date.parse(r.createdAt)||r.request.operation==='update_client_profile'&&r.context.selectedClientId!==null&&r.request.input.clientId!==r.context.selectedClientId)fail();
  for(const key of ['proposalId','request','context','createdAt','expiresAt'])if(expected[key]!==undefined&&!same(r[key],expected[key]))fail();
  if(r.status==='succeeded'){if(r.receipt===null)fail();receipt(r.receipt,r.request);}else if(r.receipt!==null)fail();return r;}
 function assertProposal(value){validateShape('ClientRecordProposal',value);const p=data(value),{commandSha256,...bound}=p;
  if(p.operation!==p.request.operation||hash(bound)!==commandSha256||p.context.conversationId!==p.binding.conversationId)fail();
  const [s]=p.scopes,selected=p.context.selectedClientId;if(s.tenantId!==p.binding.tenantId||s.kind!==(selected===null?'private-user':'client')||s.resourceId!==(selected??p.binding.actorId))fail();
  coreResult({version:'0.1.0',proposalId:p.proposalId,status:'proposed',request:p.request,context:p.context,createdAt:p.createdAt,expiresAt:p.expiresAt,receipt:null});return p;}
 function assertOutput(value,expectedInput,operation){validateShape('ClientRecordPrepared',value);const p=assertProposal(value.proposal);if(operation&&p.operation!==operation||expectedInput&&!same(p.request.input,normalizeInput(operation??p.operation,expectedInput)))fail();return data(value);}
 return Object.freeze({normalizeInput,request,receipt,coreResult,assertProposal,assertOutput});
}
