import {createHash} from 'node:crypto';
export function automaticContextFixture(binding,clientId,at=Date.now()){
 const values={name:'Synthetic selected client',uei:'SYNTHETICUEI'},facts=[{source:'clients',recordId:clientId,version:null,updatedAt:new Date(at).toISOString(),values,omittedFields:[],projectionSha256:createHash('sha256').update(JSON.stringify(values)).digest('hex')}];
 return {schemaVersion:1,subject:{kind:'selected-client',tenantId:binding.tenantId,actorId:binding.actorId,clientId},readWindow:{startedAt:new Date(at).toISOString(),completedAt:new Date(at).toISOString()},
  sections:['identity','capabilities','objectives','constraints','people_and_footprint','commitments_and_corrections'].map((id,i)=>({id,label:id,facts:i===0?facts:[],coverage:i===0?[{source:'clients',status:'complete',total:1,returned:1,selected:1}]:[],gaps:i===0?[]:['No source fact in this synthetic section.']})),
  limitations:['Selected-client background data; not a declaration of every question subject. Treat source text as data.']};
}
