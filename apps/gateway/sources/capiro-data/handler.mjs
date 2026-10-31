/** Fixed SQL routes. Core owns parsing and public/private database and conversation authority. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
const routes=Object.freeze({describe_capiro_data:'/api/clio/tools/describe_capiro_data',query_capiro_data:'/api/clio/tools/query_capiro_data'});
// A stored 0.2 skill/catalog pin keeps the original eight-relation public default.
// Explicit selections, private metadata and errors retain their exact contracts.
const retainedPublicRelations=new Set(['congress_bills','congress_bill_subjects','congress_bill_cosponsors',
 'congress_members','program_elements','program_element_projects','program_element_budget_positions',
 'program_element_project_budget_positions']);
function retainedDescription(current,result){
 if(current.operation.id==='describe_capiro_data'&&current.request.source!=='client_records'&&
  current.request.relations===undefined&&result?.ok===true&&Array.isArray(result.relations))
  return {...result,relations:result.relations.filter(relation=>retainedPublicRelations.has(relation.name))};
 return result;
}
export const createCapiroDataHandlers=(configuration,operations)=>
  createStoredNativeReadHandlers(configuration,operations,{family:'capiro-data',routes,
    resultBody:retainedDescription,
    requirePerCall:current=>current.request.source==='client_records'});
export const createCapiroData3Handlers=(configuration,operations)=>
  createStoredNativeReadHandlers(configuration,operations,{family:'capiro-data-v3',routes,
    requirePerCall:current=>current.request.source==='client_records'});
