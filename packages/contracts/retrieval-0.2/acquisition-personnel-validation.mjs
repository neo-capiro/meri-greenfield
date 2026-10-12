// Explicitly pinned current read projections and privacy constraints only.
// This family never executes the source's mandatory audit writes or grants roles.
import {snapshotOperationData} from './operation-contracts.mjs';
const fail=message=>{throw new Error(message);};
export const ACQUISITION_PERSONNEL_OPERATION_IDS=Object.freeze(['search_acquisition_personnel','get_acquisition_person']);
const [SEARCH,DETAIL]=ACQUISITION_PERSONNEL_OPERATION_IDS;
function instant(value){const at=typeof value==='string'?Date.parse(value):NaN;if(!Number.isFinite(at)||new Date(at).toISOString()!==value)fail('Acquisition timestamp must be a canonical comparable JSON instant');return at;}
function unique(rows){const ids=new Set();for(const row of rows){const id=row.id.toLowerCase();if(ids.has(id))fail('Duplicate acquisition UUID');ids.add(id);}}
export function createAcquisitionPersonnelValidators({validateShape,schema}){
 if(typeof validateShape!=='function'||!schema?.$defs)fail('Acquisition validator configuration');
 const definitions=new Set(Object.keys(schema.$defs));
 const outputs=new Map(Object.entries(schema.$defs).filter(([,value])=>ACQUISITION_PERSONNEL_OPERATION_IDS.includes(value.properties?.tool?.const)).map(([name,value])=>[value.properties.tool.const,name]));
 if(outputs.size!==2)fail('Acquisition schema operation mismatch');
 function acquisitionPersonnelOutputDefinition(id){if(!outputs.has(id))fail('Unknown acquisition operation');return outputs.get(id);}
 function acquisitionPersonnelInputDefinition(id){return acquisitionPersonnelOutputDefinition(id).replace(/Output$/,'Input');}
 function validateAcquisitionPersonnelShape(definition,value){
  if(!definitions.has(definition))fail('Unknown acquisition definition');
  const data=snapshotOperationData(value);validateShape(definition,data);
  if(outputs.get(data?.tool)!==definition)return value;
  instant(data.generatedAt);
  const people=data.tool===SEARCH?data.data:[data.person];unique(people);
  for(const person of people){instant(person.firstSeenAt);instant(person.lastSeenAt);}
  if(data.tool===DETAIL){
   unique(data.person.sources);let prior=Infinity;
   for(const source of data.person.sources){const at=instant(source.observedAt);if(at>prior)fail('Acquisition sources must be newest first');prior=at;}
  }
  return value;
 }
 function admittedContext(id,context){
  acquisitionPersonnelOutputDefinition(id);
  const trusted=snapshotOperationData(context);
  validateAcquisitionPersonnelShape(id===SEARCH?'AcquisitionSearchContext':'AcquisitionDetailContext',trusted);
  return trusted;
 }
 function normalizeAcquisitionPersonnelInput(id,request,context={}){
  const trusted=admittedContext(id,context),input=snapshotOperationData(request);
  validateAcquisitionPersonnelShape(acquisitionPersonnelInputDefinition(id),input);
  if(id===SEARCH){
   for(const [key,cap] of [['query',240],['service',60],['organization',200],['role',60],['peCode',32]]){
    if(!Object.hasOwn(input,key))continue;
    const value=input[key].trim().slice(0,cap);if(value)input[key]=value;else delete input[key];
   }
   // The selected owner's fuzzy lookup applies trim again after wrapper clipping.
   if(input.query!==undefined)input.query=input.query.trim();
   input.limit??=schema.$defs.AcquisitionPersonnelSearchInput.properties.limit.default;
   input.page??=schema.$defs.AcquisitionPersonnelSearchInput.properties.page.default;
  }else{
   input.id=input.id.trim().slice(0,80).toLowerCase();
   validateAcquisitionPersonnelShape('AcquisitionUuid',input.id);
  }
  return Object.freeze({input:Object.freeze(input),metadata:Object.freeze({
   authoritative:false,sourceConnected:false,producerQualified:false,absenceEvidence:false,
   inventoryPin:'fd8765ec01d292013758606204f2c9d886cd31c1',
   producerPolicyPin:'4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace',currentAuthorityQualified:false,
   auditWriteRequired:true,opaqueDataUntrusted:true,
   ...(id===SEARCH?{countScope:input.query?'paged-fuzzy-candidates-before-filters':'separate-local-count',emailProjection:trusted.actorRole==='capiro_admin'?'stored-email-or-null':'null-only'}:{sourceWindow:'unpaged-producer-array',notFound:'exception-after-audit'}),
  })});
 }
 function assertAcquisitionPersonnelOutput(id,value,request,context={}){
  const {input}=normalizeAcquisitionPersonnelInput(id,request,context),trusted=admittedContext(id,context),data=snapshotOperationData(value);
  validateAcquisitionPersonnelShape(acquisitionPersonnelOutputDefinition(id),data);
  if(id===SEARCH){
   if(data.page!==input.page||data.limit!==input.limit||data.data.length>input.limit)fail('Acquisition page/limit substitution');
   if(input.query&&(data.total>input.limit||data.total<data.data.length))fail('Acquisition fuzzy candidate window count mismatch');
   for(const row of data.data){
    if(input.service!==undefined&&row.service!==input.service||input.role!==undefined&&row.role!==input.role||input.peCode!==undefined&&row.pePrimary!==input.peCode&&!row.peSecondary.includes(input.peCode))fail('Acquisition exact selector substitution');
   }
  }else if(data.person.id.toLowerCase()!==input.id)fail('Acquisition person identity substitution');
  const people=id===SEARCH?data.data:[data.person];
  for(const person of people){
   if(trusted.actorRole!=='capiro_admin'&&['email','phone','parentOffice','department'].some(key=>person[key]!==null))
    fail('Acquisition contact fields require trusted capiro_admin');
   for(const key of ['phone','parentOffice','department'])if(person[key]!==null&&(!person[key]||person[key].trim()!==person[key]))
    fail('Acquisition uploaded contact field must be nonempty normalized text or null');
  }
  if(id===DETAIL){
   const metadata=data.person.metadata,record=metadata!==null&&typeof metadata==='object'&&!Array.isArray(metadata);
   if(trusted.actorRole!=='capiro_admin'){
    if(record&&['uploadedDirectoryContact','uploadedDirectoryPrevious'].some(key=>Object.hasOwn(metadata,key)))
     fail('Acquisition current non-admin metadata redaction missing');
   }else{
    const contact=record?metadata.uploadedDirectoryContact:null;
    const fields=contact!==null&&typeof contact==='object'&&!Array.isArray(contact)?contact:{};
    for(const key of ['phone','parentOffice','department']){
     const expected=typeof fields[key]==='string'?(fields[key].trim()||null):null;
     if(data.person[key]!==expected)fail('Acquisition uploaded contact metadata mismatch');
    }
   }
  }
  // Opaque metadata/headshot values are inert data, not privacy attestations or
  // contact-use authority. Do not reimplement fuzzy matching/DB collation here.
  return value;
 }
 return Object.freeze({acquisitionPersonnelSchemaId:schema.$id,ACQUISITION_PERSONNEL_OPERATION_IDS,
  acquisitionPersonnelInputDefinition,acquisitionPersonnelOutputDefinition,normalizeAcquisitionPersonnelInput,
  validateAcquisitionPersonnelShape,assertAcquisitionPersonnelOutput});
}
