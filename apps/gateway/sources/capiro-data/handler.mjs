/** Fixed SQL routes. Core owns parsing and public/private database and conversation authority. */
import {deny} from '../../dispatch/operation-result.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {RETAINED_CAPIRO_PRIVATE_RELATIONS} from '../../../../packages/contracts/retrieval-0.2/capiro-data-validation.mjs';
const routes=Object.freeze({describe_capiro_data:'/api/clio/tools/describe_capiro_data',query_capiro_data:'/api/clio/tools/query_capiro_data'});
// A stored 0.2 skill/catalog pin keeps the original eight-relation public default.
// Explicit selections and errors retain their exact contracts.
/** The public relations the describe path publishes by default; the data-access reader lists the same names. */
export const RETAINED_PUBLIC_RELATIONS=Object.freeze(['congress_bills','congress_bill_subjects','congress_bill_cosponsors',
 'congress_members','program_elements','program_element_projects','program_element_budget_positions',
 'program_element_project_budget_positions']);
const retainedPublicRelations=new Set(RETAINED_PUBLIC_RELATIONS);
const retainedDefault=current=>current.operation.id==='describe_capiro_data'&&current.request.source!=='client_records'&&current.request.relations===undefined;
function retainedRequest(current){
 return retainedDefault(current)?{...current.request,relations:[...retainedPublicRelations]}:retainedPrivateRequest(current);
}
function retainedPrivateRequest(current){
 return current.operation.id==='describe_capiro_data'&&current.request.source==='client_records'&&current.request.relations===undefined?{...current.request,relations:[...RETAINED_CAPIRO_PRIVATE_RELATIONS]}:current.request;
}
function retainedDescription(current,result){
 // A descriptor binds Core's exact returned relations. Never post-filter digest-bound metadata.
 if(retainedDefault(current)&&result?.ok===true){
  if(!Array.isArray(result.relations)||result.relations.length!==retainedPublicRelations.size||
   result.relations.some(relation=>!retainedPublicRelations.has(relation.name)))deny('INVALID_RESULT');
  return result;
 }
 return retainedPrivateDescription(current,result);
}
function retainedPrivateDescription(current,result){
 if(current.operation.id==='describe_capiro_data'&&current.request.source==='client_records'&&current.request.relations===undefined&&result?.ok===true&&Object.hasOwn(result,'contract')){
  if(!Array.isArray(result.relations)||result.relations.length!==RETAINED_CAPIRO_PRIVATE_RELATIONS.length||result.relations.some(r=>!RETAINED_CAPIRO_PRIVATE_RELATIONS.includes(r.name)))deny('INVALID_RESULT');
  return result;
 }
 if(current.operation.id==='describe_capiro_data'&&current.request.source==='client_records'&&
  current.request.relations===undefined&&result?.ok===true&&Array.isArray(result.relations))
  return {...result,relations:result.relations.filter(relation=>RETAINED_CAPIRO_PRIVATE_RELATIONS.includes(relation.name))};
 return result;
}
export const createCapiroDataHandlers=(configuration,operations)=>
  createStoredNativeReadHandlers(configuration,operations,{family:'capiro-data',routes,
    requestBody:retainedRequest,resultBody:retainedDescription,
    requirePerCall:current=>current.request.source==='client_records'});
export const createCapiroData3Handlers=(configuration,operations)=>
  createStoredNativeReadHandlers(configuration,operations,{family:'capiro-data-v3',routes,
    requestBody:retainedPrivateRequest,resultBody:retainedPrivateDescription,
    requirePerCall:current=>current.request.source==='client_records'});
export const createCapiroData4Handlers=(configuration,operations)=>
  createStoredNativeReadHandlers(configuration,operations,{family:'capiro-data-v4',routes,
    requirePerCall:current=>current.request.source==='client_records'});

export const createCapiroData5Handlers=(configuration,operations)=>
 createStoredNativeReadHandlers(configuration,operations,{family:'capiro-data-v5',routes,requirePerCall:current=>current.request.source!==undefined&&current.request.source!=='public'});
