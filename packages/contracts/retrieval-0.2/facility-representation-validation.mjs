// Claimed source-lineage and projection consistency only. No authorization,
// facility/geography resolution, source querying, geocoding or currentness proof.
import {snapshotOperationData} from './operation-contracts.mjs';
const fail=message=>{throw new Error(message);};
const optional=(value,cap)=>typeof value==='string'&&value.trim()?value.trim().slice(0,cap):null;
function instant(value){
  const at=Date.parse(value);
  if(!Number.isFinite(at)||!/^\d{4}-/.test(value)||new Date(at).toISOString()!==value)
    fail('Facility timestamp must be a canonical four-digit JSON instant');
}
function unique(values){if(new Set(values).size!==values.length)fail('Duplicate facility representation identity');}

export function createFacilityRepresentationValidators({validateShape,assertSubject,canonicalSha256}){
  function context(raw){
    const value=snapshotOperationData(raw);validateShape('FacilityRepresentationContext',value);
    assertSubject(value.subject,value.binding);
    if(value.subject.kind!=='client'||value.subject.entityType!=='client'||value.subject.entityIds.length!==1)
      fail('One client subject required for facility representation');
    return value;
  }
  function normalizeFacilityRepresentationInput(request,options={}){
    const raw=snapshotOperationData(request),ctx=context(options);validateShape('FacilityRepresentationInput',raw);
    const input={clientId:optional(raw.clientId,64),state:optional(raw.state,2)?.toUpperCase()??null};
    if(input.state!==null&&input.state.length>2)fail('Facility state uppercase expansion exceeds selector bound');
    validateShape('FacilityRepresentationSelection',input);
    if(input.clientId!==null&&input.clientId!==ctx.subject.entityIds[0])fail('Facility client differs from selected subject');
    return input;
  }
  function assertFacilityRepresentationResult(result,request,options={}){
    const input=normalizeFacilityRepresentationInput(request,options),ctx=context(options),value=snapshotOperationData(result);
    validateShape('FacilityRepresentationResult',value);assertSubject(value.subject,value.binding);
    if(canonicalSha256(value.binding)!==canonicalSha256(ctx.binding)||canonicalSha256(value.subject)!==canonicalSha256(ctx.subject))
      fail('Facility result differs from current binding or subject');
    const data=value.data;instant(data.generatedAt);
    const note=input.clientId===null?'Provide a client UUID.':data.facilities.length?null:
      `No facilities found for this client${input.state?` in ${input.state}`:''} — say so explicitly, do not guess a representative.`;
    if(data.note!==note||(input.clientId===null&&data.facilities.length))fail('Facility selector/refusal note mismatch');
    unique(data.facilities.map(row=>row.facilityId.toLowerCase()));
    for(const row of data.facilities){
      if(input.state!==null&&row.state!==input.state)fail('Facility stored state differs from filter');
      const representation=row.representation;
      if(Object.hasOwn(representation,'unresolved')){
        if((representation.reason==='no_state')!==!row.state)fail('Facility unresolved state contradiction');
        continue;
      }
      if(!row.state)fail('Resolved facility requires its stored state');
      const {house,senate}=representation.federal;
      if(house!==null&&house.chamber!=='house'||senate.some(member=>member.chamber!=='senate'))
        fail('Facility federal chamber substitution');
      unique(senate.map(member=>member.bioguideId));
      for(const chamber of ['lower','upper']){
        const member=representation.state[chamber];
        if(member!==null&&(member.chamber!==chamber||member.state!==row.state))fail('Facility state join substitution');
      }
      // Federal fullname/abbreviation resolution remains an adapter obligation;
      // no copy of the private geography resolver is embedded here. The DTO
      // also omits district/geocode inputs. Empty slots prove no absence.
    }
    return result;
  }
  return {normalizeFacilityRepresentationInput,assertFacilityRepresentationResult};
}
